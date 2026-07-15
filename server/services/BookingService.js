const mongoose = require('mongoose');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const Zone = require('../models/Zone-model');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model');
const CommissionRule = require('../models/CommissionRule-model');
const Coupon = require('../models/Coupon-model');
const Transaction = require('../models/Transaction-model');
const ProviderEarning = require('../models/ProviderEarning-model');
const ExcelJS = require('exceljs');
const { sendNotification, notifyAdmins } = require('../utils/notificationHelper');
const { generateBookingId } = require('../utils/generateUniqueId');
const { getBookingTimeline, enrichBookingData } = require('../utils/bookingHelper');
const ProviderAssignmentService = require('./ProviderAssignmentService');
const { validateBookingTransition } = require('../validation/booking.validation');


const runInTransactionOrSequential = async (operationsFunc) => {
  let session = null;
  let useTransactions = true;

  try {
    session = await mongoose.startSession();
  } catch (sessionErr) {
    console.warn("[Transaction Fallback] Failed to start Mongoose session. Standalone MongoDB detected. Running sequential fallback.", sessionErr.message);
    useTransactions = false;
  }

  if (!useTransactions || !session) {
    return await operationsFunc(null);
  }

  const maxRetries = 3;
  const backoffDelays = [100, 300, 700];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let result;
      await session.withTransaction(async () => {
        result = await operationsFunc(session);
      });
      return result;
    } catch (error) {
      const isWriteConflict = error.code === 112 || error.message?.includes("WriteConflict") || error.name === "WriteConflict";
      const isTransient = error.errorLabels?.includes("TransientTransactionError");

      if ((isWriteConflict || isTransient) && attempt < maxRetries) {
        const delay = backoffDelays[attempt - 1] || 100;
        console.warn(`[Transaction Retry] Write conflict or transient error detected (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms... Error:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};

const safeAbort = async (session) => {
  if (session) {
    try {
      await session.abortTransaction();
    } catch (err) {
      console.warn("[Transaction] abort failed:", err.message);
    }
  }
};

const safeCommit = async (session) => {
  if (session) {
    try {
      await session.commitTransaction();
    } catch (err) {
      console.error("[Transaction] commit failed:", err.message);
      throw err;
    }
  }
};

const safeEnd = (session) => {
  if (session) {
    try {
      session.endSession();
    } catch (err) {
      console.warn("[Transaction] end failed:", err.message);
    }
  }
};

const emitBookingUpdate = (bookingId, bookingData, actionName) => {
  try {
    const { getIO } = require('../socket/socketServer');
    const io = getIO();
    if (io) {
      const payload = {
        bookingId: bookingId.toString(),
        booking: bookingData,
        meta: {
          action: actionName,
          timestamp: new Date(),
          updatedAt: bookingData?.updatedAt
        }
      };
      io.to(`booking_${bookingId}`).emit('booking-updated', payload);
      if (bookingData?.customer) {
        const custId = bookingData.customer._id || bookingData.customer;
        io.to(custId.toString()).emit('booking-updated', payload);
      }
      if (bookingData?.provider) {
        const provId = bookingData.provider._id || bookingData.provider;
        io.to(provId.toString()).emit('booking-updated', payload);
      }
      io.to('admin_live_room').emit('booking-updated', payload);
      io.to('admin_live_room').emit('admin-booking-update', {
        bookingId: bookingId.toString(),
        event: actionName === 'arrived' ? 'provider-arrived' : 'status-changed',
        status: bookingData?.status,
        booking: bookingData
      });
    }
  } catch (err) {
    console.error('Error emitting booking update:', err.message);
  }
};

const emitBookingDeleted = (bookingId) => {
  try {
    const { getIO } = require('../socket/socketServer');
    const io = getIO();
    if (io) {
      io.to(`booking_${bookingId}`).emit('booking-deleted', { bookingId });
      io.to('admin_live_room').emit('booking-deleted', { bookingId });
      io.emit('booking-deleted', { bookingId });
    }
  } catch (err) {
    console.error('Error emitting booking deleted:', err.message);
  }
};

const addSystemMessageToChat = async (bookingId, content) => {
  try {
    const ChatRoom = require('../models/ChatRoom-model');
    const { getIO } = require('../socket/socketServer');
    const room = await ChatRoom.findOne({ bookingId, roomType: 'provider_customer' });
    if (!room) return;
    const newMessage = {
      senderId: new mongoose.Types.ObjectId(),
      senderRole: 'admin',
      messageType: 'system',
      content: content,
      seen: false,
      delivered: true,
      createdAt: new Date()
    };
    room.messages.push(newMessage);
    room.lastMessage = content;
    await room.save();
    const savedMessage = room.messages[room.messages.length - 1];
    try {
      const io = getIO();
      io.to(room._id.toString()).emit('chat:new-message', {
        roomId: room._id,
        message: savedMessage,
        lastMessage: content,
        unreadCustomer: room.unreadCustomer,
        unreadProvider: room.unreadProvider,
        unreadAdmin: room.unreadAdmin
      });
    } catch (sErr) {
      console.warn('Socket emit for system message failed:', sErr.message);
    }
  } catch (err) {
    console.error('Error adding system message to chat:', err.message);
  }
};

const checkProviderOverlap = (newBooking, providerBookings, bufferMinutes = 30) => ProviderAssignmentService.checkProviderOverlap(newBooking, providerBookings, bufferMinutes);
const calculateDistance = (lat1, lon1, lat2, lon2) => ProviderAssignmentService.calculateDistance(lat1, lon1, lat2, lon2);

const createFraudLog = async (booking, actionType, reason, score, req) => {
  try {
    const FraudLog = require('../models/FraudLog-model');
    const log = new FraudLog({
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0',
      userId: req.user?._id || booking.provider || booking.customer,
      userModel: req.user?.role === 'provider' ? 'Provider' : 'User',
      role: req.user?.role || 'provider',
      device: req.headers['user-agent'] ? require('crypto').createHash('sha256').update(req.headers['user-agent']).digest('hex') : 'N/A',
      deviceDetails: {
        userAgent: req.headers['user-agent'] || 'N/A',
        screenResolution: 'N/A',
        timezone: 'N/A',
        language: 'N/A',
        platform: req.headers['sec-ch-ua-platform'] || 'N/A',
      },
      actionType: actionType,
      bookingId: booking._id,
      fraudScore: score,
      riskLevel: score >= 50 ? 'HIGH' : (score >= 25 ? 'MEDIUM' : 'LOW'),
      isFlagged: score >= 25,
      flagReason: reason,
      status: 'pending_review'
    });
    await log.save();
  } catch (err) {
    console.error('Failed to save FraudLog:', err);
  }
};

const autoAssignProviderIfEnabled = async (bookingId) => ProviderAssignmentService.autoAssignProviderIfEnabled(bookingId);

const logCancellationFraud = async (req, booking, userId, role) => {
  try {
    const FraudLog = require('../models/FraudLog-model');
    const userType = role === 'provider' ? 'Provider' : 'User';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
    const userAgent = req.headers['user-agent'] || 'N/A';

    const recentCancellations = await Booking.countDocuments({
      [role]: userId,
      status: 'cancelled',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    let scoreChange = 0;
    let reasons = [];

    if (recentCancellations >= 3) {
      scoreChange += 30;
      reasons.push('High frequency cancellation (>=3 in 24h)');
    }

    const scheduledTime = new Date(booking.date);
    const [hours, minutes] = (booking.time || '00:00').split(':').map(Number);
    scheduledTime.setHours(hours, minutes, 0, 0);

    const timeDiffMs = scheduledTime - new Date();
    if (timeDiffMs > 0 && timeDiffMs < 2 * 60 * 60 * 1000) {
      scoreChange += 25;
      reasons.push('Late cancellation (under 2 hours before schedule)');
    }

    const matchedIpLog = await FraudLog.findOne({
      ip: ipAddress,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
      actionType: 'booking_cancellation'
    }).lean();

    if (matchedIpLog) {
      scoreChange += 20;
      reasons.push('Shared IP cancellation pattern');
    }

    if (scoreChange > 0) {
      booking.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        note: `CANCELLATION_FRAUD_FLAG. Score: +${scoreChange}. Reason: ${reasons.join(', ')}`,
        updatedBy: 'system'
      });
      await booking.save();

      const fLog = new FraudLog({
        ip: ipAddress,
        userId: userId,
        userModel: userType,
        role: role,
        device: userAgent !== 'N/A' ? require('crypto').createHash('sha256').update(userAgent).digest('hex') : 'N/A',
        deviceDetails: { userAgent },
        actionType: 'booking_cancellation',
        bookingId: booking._id,
        fraudScore: scoreChange,
        riskLevel: scoreChange >= 50 ? 'HIGH' : (scoreChange >= 25 ? 'MEDIUM' : 'LOW'),
        isFlagged: scoreChange >= 25,
        flagReason: reasons.join('; '),
        status: 'pending_review'
      });
      await fLog.save();
    }
  } catch (err) {
    console.error('[Fraud Log Error] Failed to compute cancellation fraud score:', err);
  }
};

const getZoneRelation = async (bookingZoneId, providerZoneId) => {
  try {
    if (bookingZoneId.toString() === providerZoneId.toString()) return 'same';
    const Zone = mongoose.model('Zone');
    let curr = await Zone.findById(bookingZoneId).select('parentZone').lean();
    while (curr && curr.parentZone) {
      if (curr.parentZone.toString() === providerZoneId.toString()) {
        return 'ancestor';
      }
      curr = await Zone.findById(curr.parentZone).select('parentZone').lean();
    }
    return 'none';
  } catch (err) {
    console.error('Error in getZoneRelation:', err);
    return 'none';
  }
};


class BookingService {
  static getPayoutStatus(earning, booking) {
    if (!earning) return 'Not Processed';
    if (booking.disputeRaised || booking.disputeStatus === 'under_review') return 'Dispute Hold';

    switch (earning.status) {
      case 'held': return 'Payout On Hold';
      case 'available': return 'Payout Ready';
      case 'paid':
      case 'withdrawn': return 'Payout Released';
      case 'cancelled': return 'Refund Adjusted';
      default: return earning.status;
    }
  }

  static getStartPin(booking) {
    if (!booking.statusHistory) return null;
    for (const history of booking.statusHistory) {
      if (history.note) {
        const match = history.note.match(/START_PIN:(\d{4})/);
        if (match) return match[1];
      }
    }
    return null;
  }

  static getCompletionPin(booking) {
    if (!booking.statusHistory) return null;
    for (const history of booking.statusHistory) {
      if (history.note) {
        const match = history.note.match(/COMPLETION_PIN:(\d{4})/);
        if (match) return match[1];
      }
    }
    return null;
  }

  static async ensureAndPersistPins(bookingId, bookingObj, session = null) {
    let startPin = null;
    let completionPin = null;

    const Booking = mongoose.model('Booking');
    const dbBooking = session
      ? await Booking.findById(bookingId).select('+startPin +completionPin').session(session)
      : await Booking.findById(bookingId).select('+startPin +completionPin');

    if (dbBooking) {
      startPin = dbBooking.startPin;
      completionPin = dbBooking.completionPin;
    }

    if (!startPin || !completionPin) {
      if (bookingObj.statusHistory) {
        for (const history of bookingObj.statusHistory) {
          if (history.note) {
            const startMatch = history.note.match(/START_PIN:(\d{4})/);
            const completionMatch = history.note.match(/COMPLETION_PIN:(\d{4})/);
            if (startMatch) startPin = startMatch[1];
            if (completionMatch) completionPin = completionMatch[1];
          }
        }
      }
    }

    let modified = false;
    if (!startPin || !completionPin) {
      if (!startPin) startPin = Math.floor(1000 + Math.random() * 9000).toString();
      if (!completionPin) completionPin = Math.floor(1000 + Math.random() * 9000).toString();
      modified = true;
    }

    if (dbBooking) {
      let firstEntry = dbBooking.statusHistory && dbBooking.statusHistory[0];
      if (firstEntry) {
        let note = firstEntry.note || '';
        if (note.match(/START_PIN:\d{4}/) || !note.includes('START_PIN:')) {
          firstEntry.note = note.replace(/START_PIN:\d{4}/g, 'START_PIN:****').replace(/COMPLETION_PIN:\d{4}/g, 'COMPLETION_PIN:****');
          if (!firstEntry.note.includes('START_PIN:')) {
            firstEntry.note = `${firstEntry.note} START_PIN:**** COMPLETION_PIN:****`.trim();
          }
          dbBooking.markModified('statusHistory');
          modified = true;
        }
      } else {
        dbBooking.statusHistory = [{
          status: dbBooking.status || 'pending',
          timestamp: new Date(),
          note: `START_PIN:**** COMPLETION_PIN:****`,
          updatedBy: 'system'
        }];
        modified = true;
      }

      if (dbBooking.startPin !== startPin || dbBooking.completionPin !== completionPin) {
        dbBooking.startPin = startPin;
        dbBooking.completionPin = completionPin;
        modified = true;
      }

      if (modified) {
        if (session) {
          await dbBooking.save({ session });
        } else {
          await dbBooking.save();
        }
      }
    }

    return { startPin, completionPin };
  }

  static getFailedAttempts(booking) {
    if (!booking.statusHistory) return 0;
    for (let i = booking.statusHistory.length - 1; i >= 0; i--) {
      if (booking.statusHistory[i].note) {
        const match = booking.statusHistory[i].note.match(/FAILED_ATTEMPTS:(\d+)/);
        if (match) return parseInt(match[1]);
      }
    }
    return 0;
  }

  static getLockoutTime(booking) {
    if (!booking.statusHistory) return null;
    for (let i = booking.statusHistory.length - 1; i >= 0; i--) {
      if (booking.statusHistory[i].note) {
        const match = booking.statusHistory[i].note.match(/LOCKOUT_UNTIL:(\d+)/);
        if (match) return new Date(parseInt(match[1]));
      }
    }
    return null;
  }

  static async recordPinFailure(booking, isStart, session = null) {
    const attempts = this.getFailedAttempts(booking) + 1;
    const pinType = isStart ? 'START_PIN' : 'COMPLETION_PIN';
    let note = `Failed verification attempt for ${pinType}. FAILED_ATTEMPTS:${attempts}`;

    if (attempts >= 5) {
      const cooldownMs = 15 * 60 * 1000;
      const lockoutUntil = Date.now() + cooldownMs;
      note += ` LOCKOUT_UNTIL:${lockoutUntil}`;
    }

    booking.statusHistory.push({
      status: booking.status,
      timestamp: new Date(),
      note,
      updatedBy: 'system'
    });

    await booking.save({ session });
  }

  static async resetPinFailures(booking, session = null) {
    booking.statusHistory.push({
      status: booking.status,
      timestamp: new Date(),
      note: `Verification successful. FAILED_ATTEMPTS:0`,
      updatedBy: 'system'
    });
    await booking.save({ session });
  }

  static getTargetLocation(booking) {
    if (booking.location && booking.location.coordinates &&
      booking.location.coordinates.length === 2 &&
      (booking.location.coordinates[0] !== 0 || booking.location.coordinates[1] !== 0)) {
      return {
        latitude: booking.location.coordinates[1],
        longitude: booking.location.coordinates[0]
      };
    }
    if (booking.statusHistory) {
      for (const history of booking.statusHistory) {
        if (history.note) {
          const match = history.note.match(/TARGET_LOCATION:([-\d.]+),([-\d.]+)/);
          if (match) {
            return {
              latitude: parseFloat(match[1]),
              longitude: parseFloat(match[2])
            };
          }
        }
      }
    }
    return null;
  }

  static async setTargetLocation(booking, latitude, longitude, session = null) {
    booking.location = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };
    if (booking.address) {
      booking.address.lat = latitude;
      booking.address.lng = longitude;
    }
    booking.statusHistory.push({
      status: booking.status,
      timestamp: new Date(),
      note: `Target address location recorded. TARGET_LOCATION:${latitude},${longitude}`,
      updatedBy: 'system'
    });
    await booking.save({ session });
  }

  static getBookingAddressLocation(booking) {
    if (booking.location && booking.location.coordinates &&
      booking.location.coordinates.length === 2 &&
      (booking.location.coordinates[0] !== 0 || booking.location.coordinates[1] !== 0)) {
      return {
        latitude: booking.location.coordinates[1],
        longitude: booking.location.coordinates[0]
      };
    }
    const target = this.getTargetLocation(booking);
    if (target) return target;

    const address = booking.address || {};
    const lat = parseFloat(address.lat);
    const lng = parseFloat(address.lng);
    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
      return { latitude: lat, longitude: lng };
    }

    return null;
  }

  static getFraudScore(booking) {
    let score = 0;
    if (booking.statusHistory) {
      for (const history of booking.statusHistory) {
        if (history.note) {
          if (history.note.includes('Failed verification attempt for START_PIN')) {
            score += 10;
          }
          if (history.note.includes('Failed verification attempt for COMPLETION_PIN')) {
            score += 15;
          }
          if (history.note.includes('Geofencing verification failed')) {
            score += 25;
          }
          if (history.note.includes('CANCELLATION_FRAUD_FLAG')) {
            score += 20;
          }
          if (history.note.includes('SUSPICIOUS_COMPLAINT_FLAG')) {
            score += 30;
          }
          if (history.note.includes('SAME_IP_ABUSE_FLAG')) {
            score += 20;
          }
        }
      }
    }
    return score;
  }

  static sanitizeStatusHistoryForProvider(statusHistory) {
    if (!statusHistory) return [];
    return statusHistory.map(h => {
      if (!h.note) return h;
      let cleanNote = h.note
        .replace(/START_PIN:\d{4}/g, 'START_PIN:****')
        .replace(/COMPLETION_PIN:\d{4}/g, 'COMPLETION_PIN:****')
        .replace(/TARGET_LOCATION:[-\d.]+,[-\d.]+/g, 'TARGET_LOCATION:hidden');
      return {
        ...h,
        note: cleanNote
      };
    });
  }

  static async recalculateProviderPerformance(providerId, session = null) {
    try {
      const provider = await Provider.findById(providerId).session(session);
      if (!provider) return;

      // 1. Get all bookings related to provider (assigned, rejected, or ignored)
      const bookings = await Booking.find({
        $or: [
          { provider: providerId },
          { rejectedBy: providerId },
          { 'metadata.ignoredProviders': providerId }
        ]
      }).session(session).lean();

      const totalAccepted = bookings.filter(b => b.provider?.toString() === providerId.toString() && ['accepted', 'in-progress', 'completed', 'cancelled'].includes(b.status)).length;
      const completedCount = bookings.filter(b => b.provider?.toString() === providerId.toString() && b.status === 'completed').length;
      const providerCancelledCount = bookings.filter(b => b.status === 'cancelled' && b.rejectedBy?.toString() === providerId.toString()).length;
      const totalRejected = bookings.filter(b => b.rejectedBy?.toString() === providerId.toString() || b.metadata?.ignoredProviders?.map(id => id.toString()).includes(providerId.toString())).length;

      // 2. Rates calculation
      const totalAssigned = totalAccepted + totalRejected;
      const acceptanceRate = totalAssigned > 0 ? (totalAccepted / totalAssigned) * 100 : 100;
      const completionPercentage = totalAccepted > 0 ? (completedCount / totalAccepted) * 100 : 100;
      const completionRate = completionPercentage;
      const cancellationRatio = totalAccepted > 0 ? (providerCancelledCount / totalAccepted) * 100 : 0;
      const cancellationRate = cancellationRatio;

      const emergencyBookings = bookings.filter(b => (b.bookingType === 'emergency' || b.isEmergency) && b.provider?.toString() === providerId.toString());
      const emergencyAccepted = emergencyBookings.filter(b => ['accepted', 'in-progress', 'completed', 'cancelled'].includes(b.status)).length;
      const emergencyCompleted = emergencyBookings.filter(b => b.status === 'completed').length;
      const emergencySuccessRate = emergencyAccepted > 0 ? (emergencyCompleted / emergencyAccepted) * 100 : 100;

      // 3. On-time rate
      let onTimeCompleted = 0;
      const completedJobs = bookings.filter(b => b.status === 'completed');
      completedJobs.forEach(job => {
        if (job.completedAt && job.date && job.time) {
          const scheduledDate = new Date(job.date);
          const [hours, minutes] = job.time.split(':').map(Number);
          scheduledDate.setHours(hours, minutes, 0, 0);

          // 6-hour buffer
          const maxCompletionTime = new Date(scheduledDate.getTime() + 6 * 60 * 60 * 1000);
          if (new Date(job.completedAt) <= maxCompletionTime) {
            onTimeCompleted++;
          }
        }
      });
      const onTimePercentage = completedCount > 0 ? (onTimeCompleted / completedCount) * 100 : 100;

      // 4. Rating
      const Feedback = mongoose.model('Feedback');
      const feedbacks = await Feedback.find({ 'providerFeedback.provider': providerId }).session(session).lean();
      const averageRating = feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + (f.providerFeedback.rating || 0), 0) / feedbacks.length
        : 5; // Default to 5 star rating if none exists

      // 5. Trust score calculation
      let trustScore = 100;

      // For every completed booking: +2 (capped at 100)
      trustScore += completedCount * 2;
      if (trustScore > 100) trustScore = 100;

      // For every cancelled booking by provider: -10
      trustScore -= providerCancelledCount * 10;

      // For complaints / COD abuse: query Complaint model
      const Complaint = mongoose.model('Complaint');
      const complaints = await Complaint.find({ provider: providerId }).session(session).lean();
      const complaintCount = complaints.length;
      const complaintRatio = totalAccepted > 0 ? (complaintCount / totalAccepted) * 100 : 0;

      // Deduct for complaints
      trustScore -= complaintCount * 15;

      // Deduct for COD balance threshold if wallet balance is extremely negative
      const codAbuseRisk = provider.wallet?.availableBalance < -500 ? 'HIGH' : provider.wallet?.availableBalance < -200 ? 'MEDIUM' : 'LOW';
      if (codAbuseRisk === 'HIGH') {
        trustScore -= 20;
      } else if (codAbuseRisk === 'MEDIUM') {
        trustScore -= 10;
      }

      if (trustScore < 0) trustScore = 0;
      if (trustScore > 100) trustScore = 100;

      // 6. Penalty Warnings & Risk Indicators (No Auto-Restrictions)
      let restrictionsActive = provider.performanceScore?.restrictionsActive || false;
      let restrictedUntil = provider.performanceScore?.restrictedUntil || null;
      let restrictionReason = provider.performanceScore?.restrictionReason || null;

      if (trustScore < 60) {
        // Log an Admin Warning in FraudLog if one doesn't exist recently
        try {
          const FraudLog = mongoose.model('FraudLog');
          const alreadyFlagged = await FraudLog.findOne({
            userId: providerId,
            actionType: 'warning',
            flagReason: { $regex: 'Trust score dropped below 60' },
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // within last 24h
          }).session(session);

          if (!alreadyFlagged) {
            await FraudLog.create([{
              userId: providerId,
              userModel: 'Provider',
              role: 'provider',
              actionType: 'warning',
              fraudScore: Math.round(100 - trustScore),
              riskLevel: 'HIGH',
              isFlagged: true,
              flagReason: `Trust score (${trustScore.toFixed(0)}) dropped below 60 due to high cancellations/complaints. Needs Admin manual review.`,
              status: 'pending_review'
            }], { session });

            if (global.logger) {
              global.logger.warn(`[Admin Warning] Provider ${providerId} trust score dropped below 60. Logged for manual admin review.`);
            }
          }
        } catch (err) {
          console.error('Error creating Admin warning log:', err);
        }
      }

      const lateArrival = Math.max(0, completedJobs.length - onTimeCompleted);
      const providerReliabilityScore = Math.round(
        (acceptanceRate * 0.2) +
        (completionRate * 0.3) +
        (emergencySuccessRate * 0.3) +
        ((100 - cancellationRate) * 0.2)
      );

      // Save back to provider doc
      provider.performanceScore = {
        rating: averageRating,
        onTimePercentage,
        completionPercentage,
        trustScore,
        cancellationRatio,
        complaintRatio,
        codAbuseRisk,
        restrictionsActive,
        restrictedUntil,
        restrictionReason,
        acceptanceRate,
        completionRate,
        emergencySuccessRate,
        cancellationRate,
        averageRating,
        lateArrival
      };

      provider.providerReliabilityScore = providerReliabilityScore;
      provider.completedBookings = completedCount;
      provider.canceledBookings = providerCancelledCount;

      await provider.save({ session });

    } catch (error) {
      console.error('recalculateProviderPerformance error:', error);
    }
  }

  static async createBooking(req, res) {
    try {
      const {
        serviceId,
        date,
        time,
        address,
        notes,
        couponCode,
        quantity = 1,
        paymentMethod = 'online', // Default to online payment
        isRebook,
        originalBooking,
        isFavoriteProviderBooking,
        preferredProviderId,
        bookingType,
        estimatedDuration,
        travelBufferMinutes,
        expectedStartTime,
        expectedEndTime,
        providerAcceptanceStatus,
        reassignmentReason,
        isEmergency,
        isInstant,
        surgeCharge,
        providerBonus,
        bookingPriority,
        providerResponseDeadline,
        trustedProviderOnly
      } = req.body;

      const resolvedBookingType = bookingType || (isEmergency ? 'emergency' : (isInstant ? 'instant' : 'scheduled'));
      const resolvedIsEmergency = !!(isEmergency || resolvedBookingType === 'emergency');
      const resolvedIsInstant = !!(isInstant || resolvedBookingType === 'instant');

      // Validate required fields
      if (!serviceId || !date || !address || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Service ID, date, address, and payment method are required'
        });
      }

      // Validate customer phone number exists
      if (!req.user || !req.user.phone) {
        return res.status(400).json({
          success: false,
          message: 'Please update your mobile number in your profile before placing a booking request.'
        });
      }

      // Validate payment method
      if (!['online', 'cash', 'wallet', 'mixed'].includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Payment method must be either "online", "cash", "wallet" or "mixed"'
        });
      }

      let bookingResult = await runInTransactionOrSequential(async (session) => {
        // Parallelize lookups
        const ZoneModel = mongoose.model('Zone');
        const SurgeModel = mongoose.model('Surge');
        const { SystemConfig } = require('../models/SystemSetting');

        const promises = [
          session ? Service.findById(serviceId).session(session) : Service.findById(serviceId),
          (address && typeof address.lat === 'number' && typeof address.lng === 'number')
            ? ZoneModel.findZoneByCoordinates(address.lat, address.lng)
            : Promise.resolve(null),
          session ? SurgeModel.find({ active: true }).session(session) : SurgeModel.find({ active: true }),
          (isRebook && originalBooking)
            ? (session ? Booking.findById(originalBooking).session(session).lean() : Booking.findById(originalBooking).lean())
            : Promise.resolve(null),
          (isFavoriteProviderBooking && preferredProviderId)
            ? (session ? Provider.findById(preferredProviderId).session(session).lean() : Provider.findById(preferredProviderId).lean())
            : Promise.resolve(null),
          session ? SystemConfig.findOne().session(session) : SystemConfig.findOne()
        ];

        let [service, detectedZone, allActiveSurges, oldBooking, providerDoc, settings] = await Promise.all(promises);

        if (!settings) {
          settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
          await settings.save(session ? { session } : {});
        }

        // Validate if Pay after Service (COD) is allowed
        if (paymentMethod === 'cash') {
          const allowCOD = settings?.bookingSettings?.allowCOD ?? true;
          if (!allowCOD) {
            throw new Error('Pay After Service is currently disabled for this service. Please proceed with online payment.');
          }
        }

        if (!service) {
          throw new Error('Service not found');
        }

        // Validate date
        const bookingDate = new Date(date);
        if (isNaN(bookingDate.getTime())) {
          throw new Error('Invalid date format');
        }

        // Smart rules: Rebook validation
        if (isRebook && originalBooking) {
          if (!oldBooking) {
            throw new Error('Original booking not found');
          }

          // Rebook allowed only if previous booking is completed and not cancelled
          if (oldBooking.status !== 'completed' || oldBooking.status === 'cancelled') {
            throw new Error('Rebooking is only allowed for completed services');
          }
        }

        // Smart rules: Favorite provider validation
        let assignedProviderId = null;
        if (isFavoriteProviderBooking && preferredProviderId) {
          if (!providerDoc) {
            throw new Error('Preferred provider not found');
          }

          // Check smart rules: approved, online, active, service category matches
          const isApproved = providerDoc.approved === true;
          const isOnline = providerDoc.isOnline === true;
          const isActive = providerDoc.isActive === true;
          const isSuspended = providerDoc.isSuspended === true;
          const blockedTill = providerDoc.blockedTill;
          const isBlocked = blockedTill && new Date(blockedTill) > new Date();

          const serviceCategory = service.category?.toString();
          const serviceCategoryMatch = providerDoc.services?.some(catId => catId.toString() === serviceCategory);

          if (!isApproved || !isOnline || !isActive || isSuspended || isBlocked || !serviceCategoryMatch) {
            throw new Error('Provider unavailable');
          }

          assignedProviderId = providerDoc._id;
        }

        // Resolve booking zone from address coordinates upfront
        if (!detectedZone) {
          throw new Error('Selected address is outside our active service zones');
        }
        let detectedZoneId = detectedZone._id;

        const PricingService = require('./PricingService');
        const priceDetails = await PricingService.calculatePriceEstimate({
          serviceId,
          quantity,
          couponCode,
          date,
          time,
          lat: address?.lat,
          lng: address?.lng,
          isEmergency: resolvedIsEmergency,
          isInstant: resolvedIsInstant,
          userId: req.user._id,
          session
        });

        const {
          subtotal,
          totalDiscount,
          couponDetails,
          rainCharge,
          trafficCharge,
          nightCharge,
          demandSurge,
          visitingCharge,
          platformFee,
          customCharges,
          emergencySurge,
          totalSurcharge,
          surchargeBreakdown,
          totalAmount
        } = priceDetails;

        // CHECK FOR DUPLICATE BOOKING (Idempotency)
        const existingQuery = Booking.findOne({
          customer: req.user._id,
          'services.service': serviceId,
          date: bookingDate,
          time: time || null,
          totalAmount: totalAmount,
          status: { $nin: ['cancelled'] },
          paymentStatus: { $in: ['pending', 'processing'] }
        });
        const existingBooking = session ? await existingQuery.session(session) : await existingQuery;

        if (existingBooking) {
          return {
            isDuplicate: true,
            data: existingBooking.toObject(),
            bookingId: existingBooking.bookingId || existingBooking._id,
            _id: existingBooking._id
          };
        }

        const startPin = Math.floor(1000 + Math.random() * 9000).toString();
        const completionPin = Math.floor(1000 + Math.random() * 9000).toString();

        // Create booking
        const booking = new Booking({
          bookingId: generateBookingId(),
          customer: req.user._id,
          services: [{
            service: serviceId,
            quantity,
            price: service.discountPrice || service.basePrice,
            discountAmount: totalDiscount,
            serviceDetails: {
              title: service.title,
              description: service.description,
              duration: service.duration,
              category: service.category
            }
          }],
          date: bookingDate,
          time: time || null,
          address,
          location: (address && typeof address.lat === 'number' && typeof address.lng === 'number') ? {
            type: 'Point',
            coordinates: [address.lng, address.lat]
          } : undefined,
          notes: notes || null,
          couponApplied: couponDetails,
          totalDiscount,
          subtotal,
          totalAmount,
          paymentMethod,
          isRebook: isRebook || false,
          originalBooking: originalBooking || null,
          isFavoriteProviderBooking: !!assignedProviderId,
          provider: assignedProviderId || undefined,
          zoneId: detectedZoneId || undefined,
          bookingType: resolvedBookingType,
          isEmergency: resolvedIsEmergency,
          isInstant: resolvedIsInstant,
          estimatedDuration: estimatedDuration !== undefined ? estimatedDuration : null,
          travelBufferMinutes: travelBufferMinutes !== undefined ? travelBufferMinutes : null,
          expectedStartTime: expectedStartTime ? new Date(expectedStartTime) : null,
          expectedEndTime: expectedEndTime ? new Date(expectedEndTime) : null,
          providerAcceptanceStatus: providerAcceptanceStatus !== undefined ? providerAcceptanceStatus : null,
          reassignmentReason: reassignmentReason !== undefined ? reassignmentReason : null,
          surgeCharge: surgeCharge !== undefined ? surgeCharge : 0,
          providerBonus: providerBonus !== undefined ? providerBonus : 0,
          bookingPriority: bookingPriority || 'medium',
          providerResponseDeadline: providerResponseDeadline ? new Date(providerResponseDeadline) : null,
          trustedProviderOnly: trustedProviderOnly !== undefined ? trustedProviderOnly : false,
          startPin,
          completionPin,
          status: paymentMethod === 'cash' ? (assignedProviderId ? 'accepted' : 'pending') : 'pending',
          paymentStatus: paymentMethod === 'cash' ? 'pending' : 'processing',
          confirmedBooking: paymentMethod === 'cash',
          rainCharge,
          trafficCharge,
          nightCharge,
          demandSurge,
          visitingCharge,
          emergencySurge,
          platformFee,
          customCharges,
          statusHistory: [{
            status: paymentMethod === 'cash' ? (assignedProviderId ? 'accepted' : 'pending') : 'pending',
            timestamp: new Date(),
            note: assignedProviderId
              ? `Booking created with preferred provider. START_PIN:**** COMPLETION_PIN:****`
              : `Booking created. START_PIN:**** COMPLETION_PIN:****`,
            updatedBy: 'customer'
          }],
          metadata: {
            ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            totalSurcharge,
            surchargeBreakdown
          }
        });

        // Save booking
        if (session) {
          await booking.save({ session });
        } else {
          await booking.save();
        }

        // Link active booking if directly assigned with cash payment
        if (paymentMethod === 'cash' && assignedProviderId) {
          const provUpdate = Provider.findByIdAndUpdate(assignedProviderId, {
            activeBooking: booking._id,
            lastUpdated: new Date()
          });
          if (session) await provUpdate.session(session);
          else await provUpdate;
        }

        // If paymentMethod is cash, create or update a transaction record
        if (paymentMethod === 'cash') {
          const Transaction = mongoose.model('Transaction');
          let transaction;
          if (session) {
            transaction = await Transaction.findOne({ booking: booking._id }).session(session);
          } else {
            transaction = await Transaction.findOne({ booking: booking._id });
          }

          if (transaction) {
            transaction.amount = booking.totalAmount;
            transaction.paymentMethod = 'cash';
            transaction.paymentStatus = 'pending';
            transaction.type = 'payment';
            transaction.description = 'Pay After Service (Cash/COD) Payment pending';
            transaction.updatedAt = new Date();
          } else {
            transaction = new Transaction({
              booking: booking._id,
              bookingId: booking.bookingId || booking._id.toString(),
              user: req.user._id,
              customerId: req.user._id.toString(),
              amount: booking.totalAmount,
              paymentMethod: 'cash',
              paymentStatus: 'pending',
              type: 'payment',
              description: 'Pay After Service (Cash/COD) Payment pending'
            });
          }

          if (session) await transaction.save({ session });
          else await transaction.save();
        }

        // If coupon was applied, save the updated coupon and flag user firstBookingUsed if first-booking coupon
        if (couponCode && couponDetails && coupon) {
          coupon.usedBy.push({
            user: req.user._id,
            bookingValue: subtotal,
            usedAt: new Date()
          });
          if (coupon.usageLimit !== null && coupon.usedBy.length >= coupon.usageLimit) {
            coupon.isActive = false;
          }
          if (session) await coupon.save({ session });
          else await coupon.save();

          if (coupon.isFirstBooking) {
            const userUpdate = User.findByIdAndUpdate(req.user._id, {
              $set: { firstBookingUsed: true }
            });
            if (session) await userUpdate.session(session);
            else await userUpdate;
          }
        }

        return {
          isDuplicate: false,
          data: { ...booking.toObject(), startPin, completionPin },
          bookingId: booking.bookingId,
          _id: booking._id
        };
      });

      if (bookingResult.isDuplicate) {
        return res.status(200).json({
          success: true,
          message: 'Existing booking found. Returning current booking.',
          data: enrichBookingData(bookingResult.data),
          bookingId: bookingResult.bookingId,
          _id: bookingResult._id,
          isDuplicate: true
        });
      }

      res.status(201).json({
        success: true,
        message: 'Booking created successfully. Please confirm payment to complete booking.',
        data: enrichBookingData(bookingResult.data),
        bookingId: bookingResult.bookingId,
        _id: bookingResult._id
      });

      // Trigger auto-assignment if booking is confirmed immediately (cash payment method)
      if (paymentMethod === 'cash') {
        autoAssignProviderIfEnabled(bookingResult._id);
      }

      // Real-time notification (non-blocking)
      try {
        if (bookingResult.data.provider) {
          const providerDoc = await Provider.findById(bookingResult.data.provider).select('_id').lean();
          if (providerDoc?._id) {
            sendNotification(
              providerDoc._id,
              'provider',
              'New Booking Request',
              `You have a new booking request for ${bookingResult.data.services?.[0]?.serviceDetails?.title || 'a service'}.`,
              'booking',
              bookingResult._id
            );
          }
        }
      } catch (e) { /* ignore notification errors */ }

    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create booking',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  static async confirmBooking(req, res) {
    try {
      const { bookingId, paymentMethod, paymentDetails } = req.body || {};
      const userId = req.user._id;

      if (!bookingId || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Booking ID and payment method are required'
        });
      }

      const confirmResult = await runInTransactionOrSequential(async (session) => {
        const bookingQuery = Booking.findOne({
          _id: bookingId,
          customer: userId
        }).populate('services.service');
        const booking = session ? await bookingQuery.session(session) : await bookingQuery;

        if (!booking) {
          throw new Error('Booking not found');
        }

        if (booking.confirmedBooking) {
          throw new Error('Booking is already confirmed');
        }

        if (booking.status === 'cancelled') {
          throw new Error('Cannot confirm a cancelled booking');
        }

        let paymentResult;
        switch (paymentMethod) {
          case 'online':
            throw new Error('Direct online processing is deprecated. Please use the secure Razorpay payment flow via /api/transaction/create-order');

          case 'wallet': {
            const updatedUser = await User.findOneAndUpdate(
              { _id: userId, "wallet.availableBalance": { $gte: booking.totalAmount } },
              {
                $inc: { "wallet.availableBalance": -booking.totalAmount },
                $push: {
                  "wallet.walletTransactions": {
                    type: 'debit',
                    amount: booking.totalAmount,
                    reason: 'Booking Payment',
                    booking: booking._id,
                    createdAt: new Date()
                  }
                },
                $set: { "wallet.lastUpdated": new Date() }
              },
              { new: true, session }
            );

            if (!updatedUser) {
              throw new Error('Insufficient wallet balance or concurrent transaction lock. Please retry.');
            }

            paymentResult = {
              success: true,
              transactionId: `TXN-WLT-${Date.now()}`,
              paymentStatus: 'paid'
            };
            break;
          }

          case 'mixed': {
            const userMixedQuery = User.findById(userId);
            const userMixed = session ? await userMixedQuery.session(session) : await userMixedQuery;
            const walletBal = userMixed.wallet?.availableBalance || 0;

            if (walletBal <= 0) {
              throw new Error('No wallet balance available for mixed payment. Please use online payment.');
            }

            const walletDeduction = Math.min(walletBal, booking.totalAmount);
            const remainingAmount = booking.totalAmount - walletDeduction;

            if (remainingAmount > 0) {
              return {
                isMixedRequired: true,
                data: {
                  walletDeduction,
                  remainingAmount
                }
              };
            } else {
              const updatedUser = await User.findOneAndUpdate(
                { _id: userId, "wallet.availableBalance": { $gte: walletDeduction } },
                {
                  $inc: { "wallet.availableBalance": -walletDeduction },
                  $push: {
                    "wallet.walletTransactions": {
                      type: 'debit',
                      amount: walletDeduction,
                      reason: 'Booking Payment',
                      booking: booking._id,
                      createdAt: new Date()
                    }
                  },
                  $set: { "wallet.lastUpdated": new Date() }
                },
                { new: true, session }
              );

              if (!updatedUser) {
                throw new Error('Insufficient wallet balance or concurrent transaction lock. Please retry.');
              }

              paymentResult = {
                success: true,
                transactionId: `TXN-WLT-${Date.now()}`,
                paymentStatus: 'paid'
              };
            }
            break;
          }

          case 'cash':
            paymentResult = {
              success: true,
              paymentStatus: 'pending'
            };
            break;

          default:
            throw new Error('Invalid payment method');
        }

        if (!paymentResult.success) {
          throw new Error(paymentResult.message || 'Payment failed');
        }

        booking.paymentMethod = paymentMethod;
        booking.paymentStatus = paymentResult.paymentStatus || 'paid';
        booking.status = 'pending';
        booking.confirmedBooking = true;

        const transactionUpdate = Transaction.findOneAndUpdate(
          { booking: bookingId },
          {
            paymentMethod,
            paymentStatus: booking.paymentStatus,
            transactionId: paymentResult.transactionId,
            razorpayOrderId: paymentResult.razorpayOrderId,
            razorpayPaymentId: paymentResult.razorpayPaymentId,
            amount: booking.totalAmount,
            completedAt: new Date(),
            user: userId,
            customerId: userId.toString(),
            bookingId: booking.bookingId,
            provider: booking.provider,
            providerId: booking.provider ? booking.provider.toString() : undefined
          },
          { new: true, upsert: true }
        );
        const transaction = session ? await transactionUpdate.session(session) : await transactionUpdate;

        if (session) await booking.save({ session });
        else await booking.save();

        if (booking.provider) {
          const provUpdate = Provider.findByIdAndUpdate(booking.provider, {
            activeBooking: booking._id,
            lastUpdated: new Date()
          });
          if (session) await provUpdate.session(session);
          else await provUpdate;
        }

        const userUpdate = User.findByIdAndUpdate(userId, { $inc: { totalBookings: 1 } });
        if (session) await userUpdate.session(session);
        else await userUpdate;

        return {
          success: true,
          booking,
          transaction
        };
      });

      if (confirmResult.isMixedRequired) {
        return res.status(400).json({
          success: false,
          isMixedRequired: true,
          message: 'Partial wallet balance applied. Please complete the remaining payment via Razorpay.',
          data: confirmResult.data
        });
      }

      res.status(200).json({
        success: true,
        message: 'Booking confirmed successfully',
        data: {
          booking: confirmResult.booking,
          transaction: confirmResult.transaction
        }
      });

      autoAssignProviderIfEnabled(confirmResult.booking._id);

    } catch (error) {
      console.error('Error confirming booking:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to confirm booking',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  static async updateBookingStatus(req, res) {
    try {
      const { id } = req.params;
      // Fix: Add null check for req.body before destructuring
      const { status } = req.body || {};

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check if user is authorized to update this booking
      if (booking.customer.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to update this booking'
        });
      }

      // Validate status transition
      const allowedTransitions = {
        'pending': ['confirmed', 'cancelled'],
        'scheduled': ['accepted', 'cancelled'],
        'confirmed': ['completed', 'cancelled'],
        'cancelled': []
      };

      if (!allowedTransitions[booking.status]?.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from ${booking.status} to ${status}`
        });
      }

      booking.status = status;
      await booking.save();

      res.status(200).json({
        success: true,
        message: 'Booking status updated successfully',
        data: booking
      });

    } catch (error) {
      console.error('Error updating booking status:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update booking status'
      });
    }
  }

  static async getUserBookings(req, res) {
    try {
      const { status, timeFilter, searchTerm, page = 1, limit = 10 } = req.query;
      const query = { customer: req.user._id };
      const currentPage = parseInt(page);
      const itemsPerPage = parseInt(limit);

      // Status filter
      if (status) {
        if (status === 'upcoming') {
          query.status = { $in: ['scheduled', 'accepted', 'in-progress'] };
        } else if (status === 'pending_payment') {
          query.paymentStatus = 'pending';
        } else if (status !== 'all') {
          query.status = status;
        }
      }

      // Time filter
      if (timeFilter && timeFilter !== 'all') {
        const now = new Date();
        let startDate;
        switch (timeFilter) {
          case '7days':
            startDate = new Date(now.setDate(now.getDate() - 7));
            break;
          case '1month':
            startDate = new Date(now.setMonth(now.getMonth() - 1));
            break;
          case '6months':
            startDate = new Date(now.setMonth(now.getMonth() - 6));
            break;
          case '1year':
            startDate = new Date(now.setFullYear(now.getFullYear() - 1));
            break;
          default:
            startDate = null;
        }
        if (startDate) {
          query.createdAt = { $gte: startDate };
        }
      }

      // Search: match by bookingId (always) or service title (via populate below)
      if (searchTerm) {
        query.$or = [
          { bookingId: { $regex: searchTerm, $options: 'i' } }
        ];
      }

      // Get total count and bookings in parallel
      const [totalBookings, bookings] = await Promise.all([
        Booking.countDocuments(query),
        Booking.find(query)
          .populate({
            path: 'services.service',
            select: 'title description basePrice category images duration',
            populate: {
              path: 'category',
              select: 'name'
            },
            match: searchTerm ? { title: { $regex: searchTerm, $options: 'i' } } : {}
          })
          .populate({
            path: 'provider',
            select: 'name email phone completedBookings performanceScore providerId profilePicUrl rating averageRating experience yearsOfExperience isVerified completionRate'
          })
          .populate('customer', 'name email phone profilePicUrl')
          .sort({ createdAt: -1 })
          .skip((currentPage - 1) * itemsPerPage)
          .limit(itemsPerPage)
          .lean()
      ]);

      // Keep bookings where service title matched OR bookingId matched the search term
      const filteredBookings = bookings.filter(b => {
        const serviceMatch = b.services && b.services.length > 0 && b.services[0].service;
        const bookingIdMatch = searchTerm && b.bookingId &&
          new RegExp(searchTerm, 'i').test(b.bookingId);
        return serviceMatch || bookingIdMatch;
      });

      const bookingIds = filteredBookings.map(b => b._id);

      // Batch fetch transactions and provider earnings to prevent N+1 database queries
      const Transaction = require('../models/Transaction-model');
      const [transactions, earnings] = await Promise.all([
        Transaction.find({
          booking: { $in: bookingIds },
          paymentStatus: { $in: ['completed', 'paid'] }
        }).sort({ createdAt: -1 }).lean(),
        ProviderEarning.find({
          booking: { $in: bookingIds }
        }).lean()
      ]);

      const transactionMap = {};
      transactions.forEach(t => {
        if (t.booking && !transactionMap[t.booking.toString()]) {
          transactionMap[t.booking.toString()] = t;
        }
      });

      const earningMap = {};
      earnings.forEach(e => {
        if (e.booking) {
          earningMap[e.booking.toString()] = e;
        }
      });

      // Process bookings
      const bookingsWithTransactions = await Promise.all(
        filteredBookings.map(async (booking) => {
          const bookingObj = booking;

          const transaction = transactionMap[booking._id.toString()];
          if (transaction) {
            bookingObj.transactionId = transaction.transactionId;
            bookingObj.razorpayPaymentId = transaction.razorpayPaymentId;
            bookingObj.paymentMethod = transaction.paymentMethod;
            bookingObj.paymentDate = transaction.updatedAt;
          }

          const earning = earningMap[booking._id.toString()];
          const pStatus = BookingService.getPayoutStatus(earning, bookingObj);
          bookingObj.payoutStatus = pStatus;

          // Ensure and persist PINs, then attach based on visibility rules
          const { startPin, completionPin } = await BookingService.ensureAndPersistPins(bookingObj._id, bookingObj);
          if (['pending', 'accepted', 'scheduled', 'assigned', 'on_the_way', 'arriving', 'arrived'].includes(bookingObj.status)) {
            bookingObj.startPin = startPin;
          } else if (bookingObj.status === 'in-progress' || bookingObj.status === 'inprogress') {
            bookingObj.completionPin = completionPin;
          }

          bookingObj.timeline = getBookingTimeline(bookingObj, pStatus);

          return enrichBookingData(bookingObj, transaction);
        })
      );

      const totalPages = Math.ceil(totalBookings / itemsPerPage);

      res.status(200).json({
        success: true,
        message: 'Bookings retrieved successfully',
        data: bookingsWithTransactions,
        pagination: {
          currentPage,
          totalPages,
          totalBookings,
          itemsPerPage,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1
        }
      });

    } catch (error) {
      console.error('Error fetching user bookings:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch bookings'
      });
    }
  }

  static async getCustomerBookings(req, res) {
    return BookingService.getUserBookings(req, res);
  }

  static async updateBookingPayment(req, res) {
    try {
      const { id } = req.params;
      // Fix: Add null check for req.body before destructuring
      const { paymentMethod, paymentStatus } = req.body || {};
      const userId = req.user._id;

      // Validate required fields
      if (!paymentMethod || !paymentStatus) {
        return res.status(400).json({
          success: false,
          message: 'Payment method and payment status are required'
        });
      }

      // Validate payment method
      if (!['online', 'cash', 'wallet', 'mixed'].includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment method. Must be "online", "cash", "wallet" or "mixed"'
        });
      }

      // Validate if Pay after Service (COD) is allowed
      if (paymentMethod === 'cash') {
        const { SystemConfig } = require('../models/SystemSetting');
        let settings = await SystemConfig.findOne();
        if (!settings) {
          settings = new SystemConfig({ companyName: 'Raj Electrical Services' });
          await settings.save();
        }
        const allowCOD = settings?.bookingSettings?.allowCOD ?? true;
        if (!allowCOD) {
          return res.status(400).json({
            success: false,
            message: 'Pay after service (COD/Cash) is currently disabled. Please choose online payment.'
          });
        }
      }

      // Validate payment status
      if (!['pending', 'processing', 'paid', 'failed'].includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment status. Must be "pending", "processing", "paid", or "failed"'
        });
      }

      // Find booking
      const booking = await Booking.findOne({
        _id: id,
        customer: userId
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check if booking can be updated
      if (booking.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'Cannot update payment for cancelled booking'
        });
      }

      // Enforce valid payment status transitions
      const validPaymentTransitions = {
        'pending': ['processing', 'paid', 'failed'],
        'processing': ['paid', 'failed'],
        'paid': [],
        'failed': ['pending', 'processing', 'paid']
      };

      if (booking.paymentStatus && !validPaymentTransitions[booking.paymentStatus]?.includes(paymentStatus)) {
        if (booking.paymentStatus === paymentStatus) {
          // Already in that state, ignore duplicate
          return res.status(200).json({
            success: true,
            message: 'Payment details already up to date',
            data: {
              bookingId: booking._id,
              paymentMethod: booking.paymentMethod,
              paymentStatus: booking.paymentStatus,
              status: booking.status
            }
          });
        }
        return res.status(400).json({
          success: false,
          message: `Invalid payment status transition from ${booking.paymentStatus} to ${paymentStatus}`
        });
      }

      // Update payment details
      booking.paymentMethod = paymentMethod;
      booking.paymentStatus = paymentStatus;

      // Keep booking status as "pending" until provider accepts
      if (booking.status !== 'accepted' && booking.status !== 'completed') {
        booking.status = 'pending';
      }

      await booking.save();
      emitBookingUpdate(booking._id, booking, 'payment_updated');

      res.status(200).json({
        success: true,
        message: 'Payment details updated successfully',
        data: {
          bookingId: booking._id,
          paymentMethod: booking.paymentMethod,
          paymentStatus: booking.paymentStatus,
          status: booking.status
        }
      });

    } catch (error) {
      console.error('Error updating booking payment:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update payment details'
      });
    }
  }

  static async getProviderById(req, res) {
    try {
      const { id } = req.params;

      let query = { providerId: id };
      if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
        query = { $or: [{ _id: id }, { providerId: id }] };
      }

      const provider = await Provider.findOne(query)
        .select('name email phone rating services experience serviceArea address providerId')
        .lean();

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Provider not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Provider details retrieved successfully',
        data: provider
      });

    } catch (error) {
      console.error('Error fetching provider details:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch provider details'
      });
    }
  }

  static async getServiceById(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid service ID'
        });
      }

      const service = await Service.findById(id)
        .select('title description basePrice category images duration isActive')
        .lean();

      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Service details retrieved successfully',
        data: service
      });

    } catch (error) {
      console.error('Error fetching service details:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch service details'
      });
    }
  }

  static async payBooking(req, res) {
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (err) {
      console.warn("[Transaction Fallback] Session start failed. Standalone MongoDB detected. Running sequential fallback.", err.message);
      session = null;
    }
    try {
      const { id } = req.params;
      const { paymentDetails } = req.body;
      const userId = req.user._id;

      const booking = await Booking.findOne({ _id: id, customer: userId }).session(session);
      if (!booking) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      if (['in-progress', 'in_progress', 'completed', 'cancelled'].includes(booking.status)) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: 'Cannot pay for a booking that is in progress, completed, or cancelled' });
      }

      if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold') {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: 'Booking already paid' });
      }

      let paymentResult;
      if (paymentDetails?.paymentMethod === 'wallet') {
        const { SystemConfig } = require('../models/SystemSetting');
        const settings = session
          ? await SystemConfig.findOne().session(session)
          : await SystemConfig.findOne();
        const usagePercentage = settings?.referralSettings?.walletUsagePercentage ?? 20;

        if (usagePercentage < 100) {
          await safeAbort(session);
          if (session) safeEnd(session);
          return res.status(400).json({
            success: false,
            message: `Wallet usage is limited to ${usagePercentage}% of booking value. Please use mixed payment instead.`
          });
        }

        const userWallet = await User.findById(userId).session(session);
        if (!userWallet.wallet) {
          userWallet.wallet = { availableBalance: 0, walletTransactions: [], totalRefunded: 0, lastUpdated: new Date() };
        }
        const bal = userWallet.wallet.availableBalance || 0;
        if (bal < booking.totalAmount || booking.totalAmount <= 0) {
          await safeAbort(session);
          if (session) safeEnd(session);
          return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
        }
        userWallet.wallet.availableBalance -= booking.totalAmount;
        userWallet.wallet.walletTransactions.push({
          type: 'debit',
          amount: booking.totalAmount,
          reason: 'Booking Payment',
          booking: booking._id
        });
        userWallet.wallet.lastUpdated = new Date();
        await userWallet.save({ session });

        paymentResult = {
          success: true,
          transactionId: `TXN-WLT-${Date.now()}`,
          paymentStatus: 'paid'
        };
        booking.paymentMethod = 'wallet';
      } else if (paymentDetails?.paymentMethod === 'mixed') {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentDetails;
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
          await safeAbort(session);
          if (session) safeEnd(session);
          return res.status(400).json({ success: false, message: 'Razorpay payment details are required' });
        }

        // Verify Razorpay signature
        const crypto = require('crypto');
        const generatedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

        if (generatedSignature !== razorpay_signature) {
          await safeAbort(session);
          if (session) safeEnd(session);
          return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        const userMixed = await User.findById(userId).session(session);
        const walletBal = userMixed.wallet?.availableBalance || 0;

        const { SystemConfig } = require('../models/SystemSetting');
        const settings = session
          ? await SystemConfig.findOne().session(session)
          : await SystemConfig.findOne();
        const usagePercentage = settings?.referralSettings?.walletUsagePercentage ?? 20;
        const maxAllowedDeduction = (booking.totalAmount * usagePercentage) / 100;

        const walletDeduction = Math.min(walletBal, booking.totalAmount, maxAllowedDeduction);

        if (walletDeduction > 0) {
          userMixed.wallet.availableBalance -= walletDeduction;
          userMixed.wallet.walletTransactions.push({
            type: 'debit',
            amount: walletDeduction,
            reason: 'Booking Payment',
            booking: booking._id
          });
          userMixed.wallet.lastUpdated = new Date();
          await userMixed.save({ session });
        }

        paymentResult = {
          success: true,
          transactionId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          paymentStatus: 'paid'
        };
        booking.paymentMethod = 'mixed';
      } else if (paymentDetails?.paymentMethod === 'online') {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentDetails;
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
          await safeAbort(session);
          safeEnd(session);
          return res.status(400).json({ success: false, message: 'Razorpay payment details are required' });
        }

        // Verify Razorpay signature
        const crypto = require('crypto');
        const generatedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

        if (generatedSignature !== razorpay_signature) {
          await safeAbort(session);
          safeEnd(session);
          return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        paymentResult = {
          success: true,
          transactionId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          paymentStatus: 'paid'
        };
        booking.paymentMethod = 'online';
      } else {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: 'Invalid payment method' });
      }

      if (!paymentResult.success) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: paymentResult.message || 'Payment failed' });
      }

      // Update booking
      booking.paymentStatus = 'escrow_hold';
      booking.confirmedBooking = true;
      if (booking.status !== 'accepted' && booking.status !== 'completed' && booking.status !== 'in-progress') {
        booking.status = 'pending';
      }
      await booking.save({ session });

      // Record/Update Transaction
      await Transaction.findOneAndUpdate(
        { booking: booking._id },
        {
          user: userId,
          customerId: userId.toString(),
          booking: booking._id,
          amount: booking.totalAmount,
          paymentMethod: booking.paymentMethod,
          paymentStatus: 'success',
          bookingId: booking.bookingId,
          provider: booking.provider,
          providerId: booking.provider ? booking.provider.toString() : undefined,
          commission: booking.commissionAmount || 0,
          providerEarning: booking.providerEarnings || 0,
          transactionId: paymentResult.transactionId,
          razorpayOrderId: paymentResult.razorpayOrderId,
          razorpayPaymentId: paymentResult.razorpayPaymentId,
          completedAt: new Date()
        },
        { upsert: true, new: true, session }
      );

      await safeCommit(session);
      safeEnd(session);
      emitBookingUpdate(booking._id, booking, 'payment_updated');

      res.status(200).json({
        success: true,
        message: 'Payment successful',
        data: booking
      });
    } catch (error) {
      await safeAbort(session);
      safeEnd(session);
      console.error('Error in payBooking:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to process payment' });
    }
  }

  static async getBooking(req, res) {
    try {
      const { id } = req.params;

      const booking = await Booking.findById(id)
        .populate('services.service', 'title description basePrice category images duration')
        .populate('customer', 'name email phone profilePicUrl')
        .populate('provider', 'name email phone businessName contactPerson rating address currentLocation isOnline profilePicUrl performanceScore completedBookings activeBooking experience')
        .populate('feedback')
        .lean();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Check if user is authorized to view this booking
      if (booking.customer._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized to view this booking'
        });
      }

      // Sanitize live location / tracking data if the provider is not active on this specific booking
      if (booking.provider) {
        const isThisBookingActive = booking.provider.activeBooking &&
          booking.provider.activeBooking.toString() === booking._id.toString();
        const isTrackable = (isThisBookingActive && ['accepted'].includes(booking.status)) ||
          ['arriving', 'started', 'in-progress', 'in_progress'].includes(booking.status);
        if (!isTrackable) {
          if (booking.provider.currentLocation) {
            booking.provider.currentLocation = null;
          }
          booking.providerLiveLocation = null;
          booking.liveDistance = null;
          booking.liveDuration = null;
          booking.routeCoordinates = null;
        }
      }

      // Fetch transaction details
      const Transaction = require('../models/Transaction-model');
      const transactions = await Transaction.find({
        booking: booking._id
      }).sort({ createdAt: -1 });

      // Fetch earning for payout status
      const earning = await ProviderEarning.findOne({ booking: booking._id }).lean();

      const bookingObj = booking;

      if (transactions.length > 0) {
        const completedTransaction = transactions.find(t =>
          ['completed', 'paid'].includes(t.paymentStatus)
        ) || transactions[0];

        bookingObj.transactionId = completedTransaction.transactionId;
        bookingObj.razorpayPaymentId = completedTransaction.razorpayPaymentId;
        bookingObj.razorpayOrderId = completedTransaction.razorpayOrderId;
        bookingObj.paymentMethod = completedTransaction.paymentMethod;
        bookingObj.paymentDate = completedTransaction.updatedAt;
        bookingObj.transactions = transactions;
      }

      bookingObj.payoutStatus = BookingService.getPayoutStatus(earning, bookingObj);

      // Ensure and persist PINs, then attach based on visibility rules
      const { startPin, completionPin } = await BookingService.ensureAndPersistPins(bookingObj._id, bookingObj);
      if (bookingObj.status === 'accepted' || bookingObj.status === 'scheduled') {
        bookingObj.startPin = startPin;
      } else if (bookingObj.status === 'in-progress') {
        bookingObj.completionPin = completionPin;
      }

      bookingObj.timeline = getBookingTimeline(bookingObj, bookingObj.payoutStatus);

      res.status(200).json({
        success: true,
        message: 'Booking details retrieved successfully',
        data: enrichBookingData(bookingObj, transactions?.[0])
      });

    } catch (error) {
      console.error('Error fetching booking details:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch booking details'
      });
    }
  }

  static async cancelBooking(req, res) {
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (err) {
      console.warn("[Transaction Fallback] Session start failed. Standalone MongoDB detected. Running sequential fallback.", err.message);
      session = null;
    }

    try {
      const { id } = req.params;
      // Handle cases where req.body might be undefined or empty
      const { reason } = req.body || {}; // Optional cancellation reason
      const userId = req.user.id;

      const booking = await Booking.findOne({ _id: id, customer: userId }).session(session);
      if (!booking) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (!validateBookingTransition(booking.status, 'cancelled')) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: `Cannot cancel booking from its current status: ${booking.status}`
        });
      }

      if (booking.status === 'completed') {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel completed booking. Please file a complaint for refund requests.'
        });
      }

      if (booking.status === 'cancelled') {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: 'Booking is already cancelled'
        });
      }

      // --- NEW STRICT EARNING STATUS CHECKS ---
      const earning = await ProviderEarning.findOne({ booking: booking._id }).session(session);
      if (earning && (earning.status === 'available' || earning.status === 'withdrawn' || earning.status === 'paid')) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: `Cancellation with automatic refund is blocked because the payout is already ${earning.status}. Please contact support.`
        });
      }

      const previousStatus = booking.status;
      const isStarted = !!booking.serviceStartedAt;

      // Check cancellation window dynamically from System Settings
      const { SystemConfig } = require('../models/SystemSetting');
      let settings = await SystemConfig.findOne();
      if (!settings) {
        settings = new SystemConfig({ companyName: 'Raj Electrical Services' });
        await settings.save({ session });
      }
      const cancelWindowMinutes = settings?.bookingSettings?.cancellationWindowMinutes ?? 60;

      const now = new Date();
      const scheduledTime = new Date(booking.date);
      if (booking.time) {
        const [hours, minutes] = booking.time.split(':').map(Number);
        scheduledTime.setHours(hours, minutes, 0, 0);
      }
      const diffMins = (scheduledTime.getTime() - now.getTime()) / (1000 * 60);
      const outsideCancelWindow = diffMins < cancelWindowMinutes;

      let refundDetails = null;

      if (isStarted || outsideCancelWindow) {
        // CASE 2: After serviceStartedAt or too close to scheduled time
        booking.status = 'cancelled';
        if (global.logger) global.logger.warn(`Booking cancelled: ${booking._id}`);

        booking.disputeRaised = true;
        if (global.logger) global.logger.warn(`Dispute raised for booking: ${booking._id}`);

        booking.disputeStatus = 'pending';
        booking.cancellationProgress.status = 'cancelled';
        booking.cancellationProgress.reason = reason || (isStarted ? 'Customer requested cancellation after start' : `Cancellation too close to scheduled time (within ${cancelWindowMinutes} mins)`);
        booking.cancellationProgress.cancelledAt = new Date();

        await booking.save({ session });

        // Update provider stats if booking was already accepted
        if (booking.provider) {
          await Provider.findByIdAndUpdate(booking.provider, {
            $inc: { canceledBookings: 1 },
            $set: { activeBooking: null }
          }, { session });
        }

        await safeCommit(session);
        safeEnd(session);
        emitBookingUpdate(booking._id, booking, 'cancelled');

        if (booking.provider) {
          try {
            await BookingService.recalculateProviderPerformance(booking.provider);
          } catch (err) {
            console.error("Error recalculating provider performance after customer cancellation commit:", err);
          }
        }

        // Track cancellation fraud in background (non-blocking)
        logCancellationFraud(req, booking, userId, 'customer');

        // Notify customer that it's under review
        try {
          sendNotification(
            userId,
            'customer',
            'Cancellation Under Review',
            isStarted
              ? `Your cancellation for booking ${booking._id} is under review for refund as the service had already started.`
              : `Your cancellation for booking ${booking._id} is under review for refund as it was within the ${cancelWindowMinutes}-minute window before scheduled start.`,
            'refund_processing',
            booking._id
          );
        } catch (err) { }

        // Notify Admin
        try {
          notifyAdmins(
            'Refund Dispute Raised',
            isStarted
              ? `Booking ${booking._id} was cancelled after service started. Admin review required for refund.`
              : `Booking ${booking._id} was cancelled within the ${cancelWindowMinutes}-minute window before start. Admin review required for refund.`,
            'dispute',
            booking._id
          );
        } catch (err) { }

        return res.json({
          success: true,
          message: isStarted
            ? 'Booking cancelled. Since the service had already started, a refund dispute has been raised for admin review.'
            : `Booking cancelled. Since the cancellation was made within the ${cancelWindowMinutes}-minute window before the scheduled time, a refund dispute has been raised for admin review.`,
          data: {
            bookingId: booking._id,
            status: booking.status,
            disputeRaised: true,
            cancellationProgress: booking.cancellationProgress
          }
        });
      } else {
        // CASE 1: Before serviceStartedAt
        booking.status = 'cancelled';
        booking.cancellationProgress.status = 'cancelled';
        booking.cancellationProgress.reason = reason || 'Customer requested cancellation';
        booking.cancellationProgress.cancelledAt = new Date();

        // Rollback any pending payment transaction wallet deduction
        const pendingTxn = await Transaction.findOne({ booking: booking._id, paymentStatus: 'pending' }).session(session);
        if (pendingTxn) {
          const { rollbackWalletDeduction } = require('./Transaction-controller');
          if (rollbackWalletDeduction) {
            await rollbackWalletDeduction(pendingTxn, session);
          }
          pendingTxn.paymentStatus = 'failed';
          pendingTxn.description = (pendingTxn.description || '') + ' (Cancelled due to booking cancellation)';
          await pendingTxn.save({ session });
        }

        if ((booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold') && ['online', 'wallet', 'mixed'].includes(booking.paymentMethod)) {
          const previouslyRefunded = booking.cancellationProgress?.refundAmount || 0;
          const platformFee = booking.platformFee || 0;
          const refundAmount = Math.max(0, booking.totalAmount - platformFee - previouslyRefunded);

          if (refundAmount > 0) {
            // Lock transaction to prevent double refund
            const transaction = await Transaction.findOneAndUpdate(
              { booking: booking._id, paymentStatus: { $in: ['completed', 'paid', 'success', 'escrow_hold'] }, refundStatus: { $ne: 'completed' } },
              {
                refundStatus: 'completed',
                refundReason: reason || 'Customer cancelled before service start',
                refundedAt: new Date(),
                paymentStatus: 'refunded',
                refundedAmount: refundAmount
              },
              { session, new: true }
            );

            if (!transaction) {
              console.warn(`[Refund Engine] Duplicate cancellation refund attempt for booking ${booking._id}`);
              throw new Error('Transaction not found or already refunded');
            }

            const refundToWalletOnly = settings?.walletSettings?.refundToWalletOnly ?? true;

            if (refundToWalletOnly) {
              // Full refund to wallet atomically
              await User.findByIdAndUpdate(
                userId,
                {
                  $inc: { 'wallet.availableBalance': refundAmount, 'wallet.totalRefunded': refundAmount },
                  $push: {
                    'wallet.walletTransactions': {
                      type: 'credit',
                      amount: refundAmount,
                      reason: 'Booking Refund',
                      booking: booking._id
                    }
                  },
                  $set: { 'wallet.lastUpdated': new Date() }
                },
                { session }
              );

              // Create or update transaction record for audit
              let refundTransaction = await Transaction.findOne({ booking: booking._id }).session(session);
              if (refundTransaction) {
                refundTransaction.amount = refundAmount;
                refundTransaction.paymentStatus = 'refunded';
                refundTransaction.paymentMethod = 'wallet';
                refundTransaction.type = 'refund';
                refundTransaction.description = `Customer cancelled booking - Automatic refund to wallet: ${reason || 'Customer requested cancellation'}`;
                refundTransaction.refundReason = reason || 'Customer cancelled booking';
                refundTransaction.updatedAt = new Date();
                await refundTransaction.save({ session });
              } else {
                refundTransaction = new Transaction({
                  booking: booking._id,
                  bookingId: booking.bookingId || booking._id.toString(),
                  user: userId,
                  amount: refundAmount,
                  paymentStatus: 'completed',
                  paymentMethod: 'wallet',
                  type: 'refund',
                  description: `Customer cancelled booking - Automatic refund to wallet: ${reason || 'Customer requested cancellation'}`,
                  refundReason: reason || 'Customer cancelled booking'
                });
                await refundTransaction.save({ session });
              }

              booking.paymentStatus = 'refunded';
              booking.cancellationProgress.status = 'refund_completed';
              booking.cancellationProgress.refundAmount = previouslyRefunded + refundAmount;
              booking.cancellationProgress.refundCompletedAt = new Date();

              refundDetails = {
                amount: refundAmount,
                method: 'wallet',
                status: 'completed'
              };

              // Notify customer
              try {
                sendNotification(
                  userId,
                  'customer',
                  'Refund Completed',
                  `A full refund of ₹${refundAmount} has been added to your wallet.`,
                  'refund',
                  booking._id
                );
              } catch (err) { }
            } else {
              // If refund to wallet only is disabled, push to processing_refund (Razorpay automatic payout or manual approval queue)
              booking.paymentStatus = 'processing';
              booking.cancellationProgress.status = 'processing_refund';
              booking.cancellationProgress.refundAmount = previouslyRefunded + refundAmount;
              booking.cancellationProgress.refundInitiatedAt = new Date();

              // Create or update transaction record for audit trail
              let refundTransaction = await Transaction.findOne({ booking: booking._id }).session(session);
              if (refundTransaction) {
                refundTransaction.amount = refundAmount;
                refundTransaction.paymentStatus = 'pending';
                refundTransaction.paymentMethod = 'online';
                refundTransaction.type = 'refund';
                refundTransaction.description = `Customer cancelled booking - Automatic gateway refund initiated: ${reason || 'Customer requested cancellation'}`;
                refundTransaction.refundReason = reason || 'Customer cancelled booking';
                refundTransaction.updatedAt = new Date();
                await refundTransaction.save({ session });
              } else {
                refundTransaction = new Transaction({
                  booking: booking._id,
                  bookingId: booking.bookingId || booking._id.toString(),
                  user: userId,
                  amount: refundAmount,
                  paymentStatus: 'pending',
                  paymentMethod: 'online',
                  type: 'refund',
                  description: `Customer cancelled booking - Automatic gateway refund initiated: ${reason || 'Customer requested cancellation'}`,
                  refundReason: reason || 'Customer cancelled booking'
                });
                await refundTransaction.save({ session });
              }

              refundDetails = {
                amount: refundAmount,
                method: 'gateway',
                status: 'processing'
              };

              // Notify customer
              try {
                sendNotification(
                  userId,
                  'customer',
                  'Refund Initiated',
                  `A refund of ₹${refundAmount} has been initiated back to your original payment method.`,
                  'refund_processing',
                  booking._id
                );
              } catch (err) { }
            }
          }
        }

        await booking.save({ session });

        // Update user stats
        await User.findByIdAndUpdate(userId, {
          $inc: { totalBookings: -1 }
        }, { session });

        // Update provider stats if booking was already accepted
        if (previousStatus === 'accepted' && booking.provider) {
          await Provider.findByIdAndUpdate(booking.provider, {
            $inc: { canceledBookings: 1 },
            $set: { activeBooking: null }
          }, { session });
        }

        await safeCommit(session);
        safeEnd(session);
        emitBookingUpdate(booking._id, booking, 'cancelled');

        if (previousStatus === 'accepted' && booking.provider) {
          try {
            await BookingService.recalculateProviderPerformance(booking.provider);
          } catch (err) {
            console.error("Error recalculating provider performance after customer cancellation commit:", err);
          }
        }

        // Add system message to chat
        await addSystemMessageToChat(booking._id, 'Booking cancelled by customer');

        // Track cancellation fraud in background (non-blocking)
        logCancellationFraud(req, booking, userId, 'customer');

        return res.json({
          success: true,
          message: refundDetails ? 'Booking cancelled and full refund added to wallet.' : 'Booking cancelled successfully.',
          data: {
            bookingId: booking._id,
            status: booking.status,
            refundDetails,
            cancellationProgress: booking.cancellationProgress
          }
        });
      }

      // Real-time notification for provider if booking was accepted
      try {
        if (previousStatus === 'accepted' && booking.provider) {
          sendNotification(
            booking.provider,
            'provider',
            'Booking Cancelled',
            `A booking for ${booking.services[0]?.serviceDetails?.title || 'Service'} has been cancelled by the customer.`,
            'booking',
            booking._id
          );
        }
      } catch (fcmError) {
        console.error('FCM Notification Error (Booking Cancelled):', fcmError);
      }
      // Invalidate dashboard caches
      try {


      } catch (e) { }

    } catch (error) {
      await safeAbort(session);
      safeEnd(session);

      console.error('Error cancelling booking:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel booking'
      });
    }
  }

  static async userUpdateBookingDateTime(req, res) {
    try {
      const { id } = req.params;
      // Fix: Add null check for req.body before destructuring
      const { date, time } = req.body || {};
      const userId = req.user.id;

      // Validate input
      if (!date && !time) {
        return res.status(400).json({
          success: false,
          message: 'Please provide either date or time to update'
        });
      }

      // Find booking
      const booking = await Booking.findOne({ _id: id, customer: userId });
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (!validateBookingTransition(booking.status, 'rescheduled') && booking.status !== 'pending' && booking.status !== 'confirmed') {
        return res.status(400).json({
          success: false,
          message: `Cannot reschedule booking from its current status: ${booking.status}`
        });
      }

      // User can only modify pending or confirmed bookings
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return res.status(403).json({
          success: false,
          message: 'Only pending or confirmed bookings can be rescheduled'
        });
      }

      // Calculate minimum allowed time (6 hours from now)
      const now = new Date();
      const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      const bookingDateTime = new Date(`${booking.date.toISOString().split('T')[0]}T${booking.time || '00:00'}`);

      // Check if it's too close to booking time
      if (bookingDateTime < sixHoursLater) {
        return res.status(403).json({
          success: false,
          message: 'Cannot reschedule within 6 hours of booking time. Please contact support.'
        });
      }

      // Validate new date if provided
      if (date) {
        const newDate = new Date(date);
        if (isNaN(newDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format'
          });
        }

        if (newDate < now) {
          return res.status(400).json({
            success: false,
            message: 'New booking date must be in the future'
          });
        }
        booking.date = newDate;
      }

      // Validate new time if provided
      if (time) {
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid time format (use HH:MM)'
          });
        }
        booking.time = time;
      }

      // Save changes
      await booking.save();
      emitBookingUpdate(booking._id, booking, 'rescheduled');

      res.json({
        success: true,
        message: 'Booking date/time updated successfully',
        data: {
          _id: booking._id,
          date: booking.date,
          time: booking.time,
          status: booking.status
        }
      });
    } catch (error) {
      console.error('Error updating booking date/time:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update booking date/time'
      });
    }
  }

  static async getProviderBookingById(req, res) {
    try {
      const { id } = req.params;
      const providerId = req.provider._id;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      const provider = await Provider.findById(providerId)
        .select('services performanceScore currentZone')
        .lean();

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Provider not found'
        });
      }

      const servicesInCategory = await Service.find({
        category: { $in: provider.services }
      }).select('_id');

      const serviceIds = servicesInCategory.map(s => s._id);

      const booking = await Booking.findOne({
        _id: id,
        'services.service': { $in: serviceIds },
        $or: [
          { provider: { $exists: false } },
          { provider: providerId }
        ]
      })
        .populate('customer', 'name email phone profilePicUrl' + ' createdAt')
        .populate('services.service', 'title description duration price basePrice images serviceType warranty tags faqs shortDescription isFeatured prerequisites discountPrice specialNotes serviceIncludes serviceExcludes serviceGuarantees materialsUsed')
        .lean();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found or not available for this provider'
        });
      }

      const [commissionRule, earning, transactions] = await Promise.all([
        CommissionRule.getCommissionForProvider(
          providerId,
          booking.zoneId,
          'standard',
          booking.services && booking.services[0]?.service
        ),
        ProviderEarning.findOne({ booking: id }).lean(),
        Transaction.find({ booking: id }).sort({ createdAt: -1 }).lean()
      ]);

      const baseForCommission = Math.max(0, booking.subtotal - (booking.totalDiscount || 0));
      const { commission, netAmount } = CommissionRule.calculateCommission(
        baseForCommission,
        commissionRule
      );

      const cleanBooking = { ...booking };
      if (cleanBooking.statusHistory) {
        cleanBooking.statusHistory = BookingService.sanitizeStatusHistoryForProvider(cleanBooking.statusHistory);
      }

      const zoneRelation = await getZoneRelation(cleanBooking.zoneId, provider.currentZone);

      const responseData = {
        ...cleanBooking,
        zoneRelation,
        commission: {
          rule: commissionRule ? {
            _id: commissionRule._id,
            name: commissionRule.name,
            type: commissionRule.type,
            value: commissionRule.value
          } : null,
          amount: commission
        },
        netAmount,
        providerCommissionRate: commissionRule ? commissionRule.value : 0,
        feedback: cleanBooking.feedback,
        complaint: cleanBooking.complaint,
        adminRemark: cleanBooking.adminRemark,
        payoutHoldUntil: cleanBooking.payoutHoldUntil,
        earningHoldStatus: earning ? earning.status : 'none',
        payoutStatus: BookingService.getPayoutStatus(earning, cleanBooking),
        earningDetails: earning,
        refundData: cleanBooking.cancellationProgress,
        transactions: transactions
      };

      res.status(200).json({
        success: true,
        data: enrichBookingData(responseData, transactions?.[0])
      });
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching booking',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async getBookingsByStatus(req, res) {
    try {
      const providerId = req.provider._id;
      let { status } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // BOOKING STATUS STATE MACHINE UPGRADE
      const normalizeParam = (s) => {
        if (!s) return 'all';
        const map = {
          'pending': 'Pending',
          'searchingprovider': 'SearchingProvider',
          'offered': 'Offered',
          'assigned': 'Assigned',
          'accepted': 'Accepted',
          'ontheway': 'OnTheWay',
          'arrived': 'Arrived',
          'started': 'Started',
          'inprogress': 'InProgress',
          'in-progress': 'InProgress',
          'in_progress': 'InProgress',
          'completed': 'Completed',
          'cancelled': 'Cancelled',
          'rejected': 'Rejected',
          'expired': 'Expired',
          'reassigned': 'Reassigned',
          'refunded': 'Refunded',
          'all': 'all'
        };
        const clean = s.toLowerCase().replace(/[^a-z]/g, '');
        return map[clean] || map[s.toLowerCase()] || s;
      };

      const normalizedStatus = normalizeParam(status);

      const validStatuses = ['Pending', 'SearchingProvider', 'Offered', 'Assigned', 'Accepted', 'OnTheWay', 'Arrived', 'Started', 'InProgress', 'Completed', 'Cancelled', 'Rejected', 'Expired', 'Reassigned', 'Refunded', 'all'];
      if (!validStatuses.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status parameter'
        });
      }

      if (normalizedStatus === 'Cancelled') {
        return res.status(200).json({
          success: true,
          count: 0,
          total: 0,
          page: parseInt(page),
          pages: 0,
          data: []
        });
      }

      const provider = await Provider.findById(providerId)
        .select('services performanceScore currentZone')
        .lean();

      if (!provider) {
        return res.status(404).json({
          success: false,
          message: 'Provider not found'
        });
      }

      // Check parallel bookings limit for pending bookings list
      const { SystemConfig } = require('../models/SystemSetting');
      let settings = await SystemConfig.findOne();
      const maxBookings = settings?.bookingSettings?.maxBookingsPerProvider ?? 10;

      const providerBookingsCount = await Booking.countDocuments({
        provider: providerId,
        status: { $in: ['Accepted', 'InProgress', 'Started', 'Assigned', 'Offered', 'OnTheWay', 'Arrived'] }
      });

      if (normalizedStatus === 'Pending' && providerBookingsCount >= maxBookings) {
        return res.status(200).json({
          success: true,
          count: 0,
          total: 0,
          page: parseInt(page),
          pages: 0,
          data: []
        });
      }

      const servicesInCategory = await Service.find({
        category: { $in: provider.services }
      }).select('_id').lean();

      const serviceIds = servicesInCategory.map(s => s._id);

      let query;
      if (normalizedStatus === 'Pending') {
        query = {
          'services.service': { $in: serviceIds },
          $or: [
            { status: { $in: ['Pending', 'SearchingProvider', 'pending', 'searchingprovider'] }, $or: [{ provider: { $exists: false } }, { provider: null }] },
            { status: { $in: ['Assigned', 'assigned'] }, provider: providerId },
            { status: { $in: ['Offered', 'offered'] }, provider: providerId }
          ]
        };
      } else if (normalizedStatus === 'Completed') {
        const heldEarnings = await ProviderEarning.find({
          provider: providerId,
          $or: [
            { status: 'held' },
            { availableAfter: { $gt: new Date() } }
          ]
        }).select('booking').lean();

        const heldBookingIds = heldEarnings.map(e => e.booking);

        query = {
          $or: [
            { _id: { $in: heldBookingIds } },
            { payoutHoldUntil: { $gt: new Date() } }
          ],
          status: 'Completed',
          provider: providerId,
          'services.service': { $in: serviceIds }
        };
      } else if (normalizedStatus === 'all') {
        query = {
          provider: providerId,
          'services.service': { $in: serviceIds }
        };
      } else if (normalizedStatus === 'Accepted') {
        query = {
          status: { $in: ['Accepted', 'Assigned', 'Offered'] },
          provider: providerId,
          'services.service': { $in: serviceIds }
        };
      } else if (normalizedStatus === 'InProgress') {
        query = {
          status: { $in: ['InProgress', 'Started', 'OnTheWay', 'Arrived'] },
          provider: providerId,
          'services.service': { $in: serviceIds }
        };
      } else {
        query = {
          status: normalizedStatus,
          provider: providerId,
          'services.service': { $in: serviceIds }
        };
      }
      // END BOOKING STATUS STATE MACHINE UPGRADE

      const bookings = await Booking.find(query)
        .populate('customer', 'name email phone profilePicUrl')
        .populate('services.service', 'title price duration category')
        .sort({ date: 1, time: 1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      const bookingsWithCommission = await Promise.all(bookings.map(async (booking) => {
        const cleanBooking = { ...booking };
        if (cleanBooking.statusHistory) {
          cleanBooking.statusHistory = BookingService.sanitizeStatusHistoryForProvider(cleanBooking.statusHistory);
        }

        const [zoneRelation, bookingCommissionRule] = await Promise.all([
          getZoneRelation(cleanBooking.zoneId, provider.currentZone),
          CommissionRule.getCommissionForProvider(
            providerId,
            cleanBooking.zoneId,
            'standard',
            cleanBooking.services && cleanBooking.services[0]?.service
          )
        ]);

        const baseForCommission = Math.max(0, cleanBooking.subtotal - (cleanBooking.totalDiscount || 0));
        const { commission, netAmount } = CommissionRule.calculateCommission(
          baseForCommission,
          bookingCommissionRule
        );

        const enrichedObj = {
          ...cleanBooking,
          zoneRelation,
          commission: {
            rule: bookingCommissionRule ? {
              _id: bookingCommissionRule._id,
              name: bookingCommissionRule.name,
              type: bookingCommissionRule.type,
              value: bookingCommissionRule.value
            } : null,
            amount: commission
          },
          netAmount,
          providerCommissionRate: bookingCommissionRule ? bookingCommissionRule.value : 0
        };

        return enrichBookingData(enrichedObj);
      }));

      const total = await Booking.countDocuments(query);

      res.status(200).json({
        success: true,
        count: bookings.length,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        data: bookingsWithCommission
      });

    } catch (error) {
      console.error('Booking Fetch Error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async acceptBooking(req, res) {
    try {
      const { id } = req.params;
      const providerId = req.provider._id;
      const { time } = req.body || {};
      // Validate booking ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      // BOOKING LOCK UPGRADE
      // DOUBLE CLICK PROTECTION
      const existingAcceptedBooking = await Booking.findById(id)
        .populate('customer', 'name email phone profilePicUrl')
        .populate('services.service', 'title description price');
      if (existingAcceptedBooking && existingAcceptedBooking.status === 'accepted' && existingAcceptedBooking.provider && existingAcceptedBooking.provider.toString() === providerId.toString()) {
        global.logger.info(`[BookingService.acceptBooking] Double click protection triggered. Provider ${providerId} already accepted booking ${id}. Returning existing accepted booking.`);
        return res.status(200).json({
          success: true,
          message: 'Booking accepted successfully',
          data: {
            ...existingAcceptedBooking.toObject(),
            paymentStatus: existingAcceptedBooking.paymentStatus,
            paymentMethod: existingAcceptedBooking.paymentMethod
          }
        });
      }

      if (existingAcceptedBooking && (existingAcceptedBooking.status === 'accepted' || (existingAcceptedBooking.provider && existingAcceptedBooking.provider.toString() !== providerId.toString()))) {
        global.logger.warn(`[BookingService.acceptBooking] Booking conflict. Booking ${id} already accepted by provider ${existingAcceptedBooking.provider}.`);
        return res.status(409).json({
          success: false,
          message: 'Booking already accepted.'
        });
      }

      const result = await runInTransactionOrSequential(async (session) => {
        // Check if provider exists and get their services and status
        const provider = session
          ? await Provider.findById(providerId).select('services name isSuspended blockedTill performanceScore approved isActive wallet').session(session)
          : await Provider.findById(providerId).select('services name isSuspended blockedTill performanceScore approved isActive wallet');
        if (!provider) {
          throw new Error('Provider not found');
        }

        global.logger.info(`[BookingService.acceptBooking] Provider ${providerId} (${provider.name}) attempted acceptance for booking ${id}`);

        const lockQuery = {
          _id: id,
          status: 'pending',
          $or: [
            { provider: null },
            { provider: { $exists: false } },
            { provider: providerId }
          ],
          $or: [
            { lockedBy: null },
            { lockedBy: { $exists: false } },
            { lockExpiresAt: { $lt: new Date() } }
          ]
        };

        const lockUpdate = {
          $set: {
            lockedBy: providerId,
            lockedAt: new Date(),
            lockExpiresAt: new Date(Date.now() + 30000) // lock expires in 30 seconds
          },
          $inc: { bookingVersion: 1 }
        };

        const lockedBooking = session
          ? await Booking.findOneAndUpdate(lockQuery, lockUpdate, { new: true, session })
          : await Booking.findOneAndUpdate(lockQuery, lockUpdate, { new: true });

        if (!lockedBooking) {
          global.logger.warn(`[BookingService.acceptBooking] Booking conflict or already locked. Lock attempt failed for booking ${id} by provider ${providerId}`);
          throw new Error('This booking has already been accepted by another provider.');
        }

        global.logger.info(`[BookingService.acceptBooking] Booking ${id} locked successfully by provider ${providerId}`);

        try {
          // Validate: Provider Approved
          if (!provider.approved) {
            throw new Error('Provider account is not approved.');
          }

          // Validate: Provider Active
          if (!provider.isActive) {
            throw new Error('Provider account is not active.');
          }

          // Validate: Provider Not Blocked
          if (provider.isSuspended) {
            throw new Error('Your account is suspended. You cannot accept bookings.');
          }

          if (provider.blockedTill && new Date(provider.blockedTill) > new Date()) {
            throw new Error('Your account is blocked. You cannot accept bookings.');
          }

          if (provider.performanceScore?.restrictionsActive) {
            throw new Error('Your account is restricted from accepting new bookings.');
          }

          // Validate: Booking Not Expired
          const isExpired = lockedBooking.providerResponseDeadline && new Date(lockedBooking.providerResponseDeadline) < new Date();
          if (isExpired) {
            global.logger.info(`[BookingService.acceptBooking] Lock expired or booking response deadline passed for booking ${id}`);
            throw new Error('Booking has expired.');
          }

          const populatedLockedBooking = session
            ? await Booking.findById(id).populate('services.service', 'category').session(session)
            : await Booking.findById(id).populate('services.service', 'category');

          // Verify provider can service this booking
          const canService = populatedLockedBooking.services.every(serviceItem =>
            provider.services.includes(serviceItem.service.category)
          );

          if (!canService) {
            throw new Error('Provider is not qualified for all services in this booking');
          }

          // Validate time format if provided
          if (time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
            throw new Error('Invalid time format (use HH:MM)');
          }

          // Check parallel bookings limit & scheduling conflict based on system configuration
          const { SystemConfig } = require('../models/SystemSetting');
          let settings = session
            ? await SystemConfig.findOne().session(session)
            : await SystemConfig.findOne();
          const maxBookings = settings?.bookingSettings?.maxBookingsPerProvider ?? 10;
          const bufferMinutes = settings?.bookingSettings?.bookingBufferTime ?? 30;

          const providerBookings = session
            ? await Booking.find({
              provider: providerId,
              status: { $in: ['accepted', 'in-progress', 'started', 'confirmed', 'scheduled', 'assigned', 'Accepted', 'InProgress', 'Started', 'Confirmed', 'Scheduled', 'Assigned'] }
            }).session(session)
            : await Booking.find({
              provider: providerId,
              status: { $in: ['accepted', 'in-progress', 'started', 'confirmed', 'scheduled', 'assigned', 'Accepted', 'InProgress', 'Started', 'Confirmed', 'Scheduled', 'Assigned'] }
            });

          if (providerBookings.length >= maxBookings) {
            throw new Error(`You have reached the maximum limit of parallel bookings (${maxBookings}). Complete your current jobs first.`);
          }

          if (checkProviderOverlap(populatedLockedBooking, providerBookings, bufferMinutes)) {
            throw new Error(`You already have a booking scheduled during this time. Please complete your current booking before accepting a new one. Try again after ${bufferMinutes} minutes.`);
          }

          // Wallet Balance Check for Cash/PAS Bookings
          // For cash bookings, provider collects full amount from customer but must remit platform commission.
          // Ensure provider has sufficient wallet balance to cover the commission before accepting.
          const isCashBooking = lockedBooking.paymentMethod === 'cash' || lockedBooking.paymentType === 'pay_after_service';
          if (isCashBooking) {
            const commissionRequired = lockedBooking.commissionAmount || 0;
            const providerBalance = provider.wallet?.availableBalance || 0;
            if (commissionRequired > 0 && providerBalance < commissionRequired) {
              throw new Error(`Insufficient wallet balance. You need ₹${commissionRequired} in your wallet to accept this cash booking. Your current balance is ₹${providerBalance}. Please add funds to your wallet first.`);
            }
          }
        } catch (validationError) {
          // Release lock if validation fails (Assignment failed)
          global.logger.error(`[BookingService.acceptBooking] Assignment failed for booking ${id} by provider ${providerId} due to validation error: ${validationError.message}`);

          const releaseUpdate = {
            $set: {
              lockedBy: null,
              lockedAt: null,
              lockExpiresAt: null
            }
          };
          if (session) {
            await Booking.updateOne({ _id: id, lockedBy: providerId }, releaseUpdate, { session });
          } else {
            await Booking.updateOne({ _id: id, lockedBy: providerId }, releaseUpdate);
          }
          throw validationError;
        }

        // Assign provider and unlock atomically after assignment
        const updatedBooking = session
          ? await Booking.findOneAndUpdate(
            {
              _id: id,
              lockedBy: providerId,
              status: 'pending'
            },
            {
              $set: {
                status: 'accepted',
                provider: providerId,
                // EMERGENCY BOOKING ENGINE UPGRADE
                providerAcceptanceStatus: 'accepted',
                // END EMERGENCY BOOKING ENGINE UPGRADE
                acceptedAt: new Date(),
                updatedAt: new Date(),
                lockedBy: null,
                lockedAt: null,
                lockExpiresAt: null,
                ...(time && { time })
              },
              $push: {
                statusHistory: {
                  status: 'accepted',
                  timestamp: new Date(),
                  note: `Booking accepted atomically by provider: ${provider.name}`,
                  updatedBy: 'provider'
                }
              }
            },
            { new: true, runValidators: true, session }
          )
          : await Booking.findOneAndUpdate(
            {
              _id: id,
              lockedBy: providerId,
              status: 'pending'
            },
            {
              $set: {
                status: 'accepted',
                provider: providerId,
                // EMERGENCY BOOKING ENGINE UPGRADE
                providerAcceptanceStatus: 'accepted',
                // END EMERGENCY BOOKING ENGINE UPGRADE
                acceptedAt: new Date(),
                updatedAt: new Date(),
                lockedBy: null,
                lockedAt: null,
                lockExpiresAt: null,
                ...(time && { time })
              },
              $push: {
                statusHistory: {
                  status: 'accepted',
                  timestamp: new Date(),
                  note: `Booking accepted atomically by provider: ${provider.name}`,
                  updatedBy: 'provider'
                }
              }
            },
            { new: true, runValidators: true }
          );

        if (!updatedBooking) {
          throw new Error('This booking has already been accepted by another provider.');
        }

        global.logger.info(`[BookingService.acceptBooking] Booking accepted successfully for booking ${id} by provider ${providerId}`);

        // Sync transaction record with the new provider and calculated commission
        try {
          const isOnline = updatedBooking.paymentMethod?.toLowerCase() === 'online' || updatedBooking.paymentMethod?.toLowerCase() === 'upi';
          const transOpts = session ? { session } : {};
          await Transaction.updateMany(
            { booking: updatedBooking._id },
            {
              provider: updatedBooking.provider,
              providerId: updatedBooking.provider.toString(),
              commission: updatedBooking.commissionAmount || 0,
              providerEarning: updatedBooking.providerEarnings || 0,
              commissionRule: updatedBooking.commissionRule,
              // Sync payment status if booking is already paid
              ...((updatedBooking.paymentStatus === 'paid' || updatedBooking.paymentStatus === 'escrow_hold') && {
                paymentStatus: isOnline ? 'success' : 'completed'
              })
            },
            transOpts
          );
        } catch (transError) {
          console.error('Error syncing transaction on booking acceptance:', transError);
        }

        // Populate booking details for response
        const populatedBooking = session
          ? await Booking.findById(updatedBooking._id)
            .populate('customer', 'name email phone profilePicUrl')
            .populate('services.service', 'title description price')
            .session(session)
          : await Booking.findById(updatedBooking._id)
            .populate('customer', 'name email phone profilePicUrl')
            .populate('services.service', 'title description price');

        return {
          populatedBooking,
          providerName: provider.name,
          paymentStatus: updatedBooking.paymentStatus,
          paymentMethod: updatedBooking.paymentMethod
        };
      });
      // BOOKING LOCK UPGRADE

      // Real-time notification for customer
      try {
        if (result.populatedBooking.customer) {
          await sendNotification(
            result.populatedBooking.customer._id,
            'customer',
            'Booking Accepted',
            `Your booking for ${result.populatedBooking.services[0].service.title} has been accepted by ${result.providerName}.`,
            'booking',
            id
          );
          const { triggerEventNotification } = require('../utils/notificationHelper');
          await triggerEventNotification('provider_accepted', {
            serviceName: result.populatedBooking.services[0].service.title,
            providerName: result.providerName,
            booking: result.populatedBooking
          }, result.populatedBooking.customer._id);
        }
      } catch (fcmError) {
        console.error('FCM Notification Error (Booking Accepted):', fcmError);
      }

      // Add system message to chat
      await addSystemMessageToChat(id, `Booking accepted by partner: ${result.providerName}`);
      emitBookingUpdate(result.populatedBooking._id, result.populatedBooking, 'accepted');

      return res.status(200).json({
        success: true,
        message: 'Booking accepted successfully',
        data: {
          ...result.populatedBooking.toObject(),
          paymentStatus: result.paymentStatus,
          paymentMethod: result.paymentMethod
        }
      });

    } catch (error) {
      console.error('Error accepting booking:', error);
      const conflictErrors = [
        'This booking has already been accepted by another provider.',
        'Booking already accepted.'
      ];
      const isConflictError = conflictErrors.some(errMsg => error.message?.includes(errMsg));
      if (isConflictError) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      const clientErrors = [
        'Provider not found',
        'Your account is suspended. You cannot accept bookings.',
        'Your account is blocked. You cannot accept bookings.',
        'Your account is restricted from accepting new bookings.',
        'Booking not found or not available for acceptance',
        'Provider is not qualified for all services in this booking',
        'Invalid time format (use HH:MM)',
        'You have reached the maximum limit of parallel bookings',
        'Scheduling conflict',
        'Provider account is not approved.',
        'Provider account is not active.',
        'Booking has expired.'
      ];
      const isClientError = clientErrors.some(errMsg => error.message?.includes(errMsg));
      if (isClientError) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        message: 'Internal server error while accepting booking',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async startBooking(req, res) {
    try {
      const { id } = req.params;
      const providerId = req.provider._id;

      // Validate booking ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      // Find the booking
      const booking = await Booking.findOne({
        _id: id,
        provider: providerId,
        status: { $in: ['accepted', 'assigned', 'Accepted', 'Assigned'] }
      }).populate('customer', 'name email phone profilePicUrl')
        .populate('services.service', 'title description');

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found or not available to start'
        });
      }

      // STEP 4 — PAYMENT BEFORE SERVICE START (Accepts either paid, escrow_hold, or cash payment method)
      const isCashOrPayAfterService = booking.paymentMethod === 'cash' || booking.paymentType === 'pay_after_service';
      if (!isCashOrPayAfterService && booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'escrow_hold') {
        return res.status(400).json({
          success: false,
          message: "Customer payment pending. Service cannot start."
        });
      }

      // Handle before-work proof images (Mandatory: min 1)
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Before work proof images are required before starting service'
        });
      }

      const { latitude, longitude, pin } = req.body;

      // 1. Check PIN presence
      if (!pin) {
        return res.status(400).json({
          success: false,
          message: 'Start verification PIN is required to start the service'
        });
      }

      // 2. Check Lockout Cooldown
      const lockoutTime = BookingService.getLockoutTime(booking);
      if (lockoutTime && lockoutTime > new Date()) {
        const remainingMinutes = Math.ceil((lockoutTime - new Date()) / (60 * 1000));
        return res.status(403).json({
          success: false,
          message: `Too many failed attempts. Verification is locked. Try again in ${remainingMinutes} minutes.`
        });
      }

      // 3. Verify START PIN
      const { startPin } = await BookingService.ensureAndPersistPins(booking._id, booking);
      if (pin !== startPin) {
        await BookingService.recordPinFailure(booking, true);
        await createFraudLog(booking, 'failed_login', `Incorrect START PIN entered: ${pin}`, 10, req);

        return res.status(400).json({
          success: false,
          message: 'Invalid verification PIN'
        });
      }

      // 4. Verify Coordinates
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: 'GPS coordinates are required to start the service'
        });
      }

      const providerLat = parseFloat(latitude);
      const providerLng = parseFloat(longitude);

      const targetLoc = BookingService.getBookingAddressLocation(booking);
      if (!targetLoc) {
        return res.status(400).json({
          success: false,
          message: 'Booking address has no GPS coordinates. Ask customer to pin exact location on map.'
        });
      }

      if (!BookingService.getTargetLocation(booking)) {
        await BookingService.setTargetLocation(booking, targetLoc.latitude, targetLoc.longitude);
      }

      const distance = calculateDistance(providerLat, providerLng, targetLoc.latitude, targetLoc.longitude);

      // Dual-Layer S2 Precise Geofencing Verification (Level 20)
      /* BACKUP COMMENT: Original was synchronous S2 calculations, blocking the main Event Loop. Offloading to worker threads now. */
      const { latLngToS2CellIdAsync, getNeighborsAsync, getLevelAsync } = require('../utils/s2HelperAsync');
      const providerS2Precise = await latLngToS2CellIdAsync(providerLat, providerLng, 16);
      let targetS2Precise = booking.address?.s2CellIdPrecise;

      let isTargetValid = false;
      if (targetS2Precise && targetS2Precise.length === 16) {
        try {
          const lvl = await getLevelAsync('0x' + targetS2Precise);
          if (lvl === 16) isTargetValid = true;
        } catch (e) { }
      }

      if (!isTargetValid) {
        targetS2Precise = await latLngToS2CellIdAsync(targetLoc.latitude, targetLoc.longitude, 16);
      }
      const neighborCells = await getNeighborsAsync(targetS2Precise);
      const acceptableCells = [targetS2Precise, ...neighborCells];
      if (!acceptableCells.includes(providerS2Precise)) {
        await createFraudLog(booking, 'failed_login', `S2 Geofence mismatch during start verification: Provider at ${providerLat}, ${providerLng} (Cell: ${providerS2Precise}) but target at ${targetLoc.latitude}, ${targetLoc.longitude} (Cell: ${targetS2Precise})`, 25, req);

        booking.statusHistory.push({
          status: booking.status,
          timestamp: new Date(),
          note: `Provider Cell: ${providerS2Precise}, Target Cell: ${targetS2Precise}.`,
          updatedBy: 'system'
        });
        await booking.save();

        return res.status(400).json({
          success: false,
          message: `You are outside the precise geofence boundary of the service location.`,
          providerLocation: { latitude: providerLat, longitude: providerLng },
          targetLocation: { latitude: targetLoc.latitude, longitude: targetLoc.longitude },
          providerS2Cell: providerS2Precise,
          targetS2Cell: targetS2Precise,
          distanceMeters: Math.round(distance)
        });
      }

      if (distance > 150) { // Allow start/completion within 150 meters
        await createFraudLog(booking, 'failed_login', `Geofencing mismatch during start verification: Provider at ${providerLat}, ${providerLng} but target at ${targetLoc.latitude}, ${targetLoc.longitude} (Distance: ${Math.round(distance)}m)`, 25, req);

        // Push warning to history
        booking.statusHistory.push({
          status: booking.status,
          timestamp: new Date(),
          note: `Geofencing verification failed. Distance: ${Math.round(distance)}m.`,
          updatedBy: 'system'
        });
        await booking.save();

        return res.status(400).json({
          success: false,
          message: `Geofencing verification failed. You must be within 150 meters of the service location. Current distance: ${Math.round(distance)}m`
        });
      }

      // Reset failures on success
      await BookingService.resetPinFailures(booking);

      // Update booking status to in-progress
      booking.status = 'in-progress';
      booking.serviceStartedAt = new Date();
      booking.updatedAt = new Date();

      const beforeImages = req.files.map(file => ({
        url: file.path || file.secure_url,
        uploadedAt: new Date()
      }));

      booking.providerWorkProof = {
        ...booking.providerWorkProof,
        beforeImages: beforeImages,
        startLocation: { latitude: providerLat, longitude: providerLng }
      };

      // Add to status history
      booking.statusHistory.push({
        status: 'in-progress',
        timestamp: new Date(),
        note: 'Work proof submitted. Service started. Verification successful.',
        updatedBy: 'provider'
      });

      await booking.save();
      emitBookingUpdate(booking._id, booking, 'started');

      // Add system message to chat
      await addSystemMessageToChat(booking._id, 'Service started by partner');

      // Real-time notification for customer
      try {
        if (booking.customer) {
          await sendNotification(
            booking.customer._id,
            'customer',
            'Service Started',
            `The provider has started working on your booking for ${booking.services[0].service.title}.`,
            'booking',
            booking._id
          );
          const { triggerEventNotification } = require('../utils/notificationHelper');
          await triggerEventNotification('work_started', {
            serviceName: booking.services[0].service.title,
            booking
          }, booking.customer._id);
        }
      } catch (fcmError) {
        console.error('FCM Notification Error (Service Started):', fcmError);
      }

      // Invalidate dashboard caches
      try {


      } catch (e) { }

      return res.status(200).json({
        success: true,
        message: 'Service started successfully',
        data: {
          bookingId: booking._id,
          status: booking.status,
          startedAt: booking.startedAt
        }
      });
    } catch (error) {
      console.error('Error starting booking:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while starting service',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async rejectBooking(req, res) {
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (err) {
      console.warn("[Transaction Fallback] Session start failed. Standalone MongoDB detected. Running sequential fallback.", err.message);
      session = null;
    }

    try {
      const { id } = req.params;
      const providerId = req.provider._id;
      const { reason } = req.body || {};

      // Validate booking ID format
      if (!mongoose.Types.ObjectId.isValid(id)) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      // Find the booking
      const booking = await Booking.findOne({
        _id: id,
        status: { $in: ['pending', 'assigned'] },
        $or: [
          { provider: { $exists: false } },
          { provider: providerId }
        ]
      }).session(session)
        .populate('customer')
        .populate('services.service', 'title description');

      if (!booking) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(404).json({
          success: false,
          message: 'Booking not found or not available for rejection'
        });
      }

      const previousStatus = booking.status;

      // Disassociate provider activeBooking
      await Provider.findByIdAndUpdate(providerId, { $set: { activeBooking: null } }, { session });

      // Update booking status to pending, clear current provider, and ignore this provider
      booking.status = 'pending';
      booking.provider = null;
      if (!booking.metadata) booking.metadata = {};
      if (!booking.metadata.ignoredProviders) booking.metadata.ignoredProviders = [];
      if (!booking.metadata.ignoredProviders.some(p => p.toString() === providerId.toString())) {
        booking.metadata.ignoredProviders.push(providerId);
      }
      booking.updatedAt = new Date();

      booking.statusHistory.push({
        status: 'pending',
        timestamp: new Date(),
        note: `Booking rejected by provider (reason: ${reason || 'Provider declined'}). Seeking reassignment.`,
        updatedBy: 'system'
      });

      await booking.save({ session });
      await safeCommit(session);
      safeEnd(session);
      emitBookingUpdate(booking._id, booking, 'rejected');

      // Trigger auto-reassignment
      const ProviderAssignmentService = require('./ProviderAssignmentService');
      const newProvider = await ProviderAssignmentService.autoAssignProviderIfEnabled(booking._id);

      if (!newProvider) {
        try {
          const { notifyAdmins } = require('../utils/notificationHelper');
          await notifyAdmins({
            title: `${booking.bookingType ? booking.bookingType.charAt(0).toUpperCase() + booking.bookingType.slice(1) : 'Booking'} Reassignment Failure`,
            message: `Booking ${booking.bookingId || booking._id} could not be automatically reassigned and is placed in the Admin Queue.`
          });
        } catch (adminErr) {
          console.error("Error notifying admins for booking reassignment failure:", adminErr);
        }
      }

      // Recalculate provider stats and trust score dynamically
      try {
        await BookingService.recalculateProviderPerformance(providerId);
      } catch (err) {
        console.error("Error recalculating provider performance after rejectBooking:", err);
      }

      // Add system message to chat
      try {
        const { addSystemMessageToChat } = require('../utils/chatHelper');
        if (addSystemMessageToChat) {
          await addSystemMessageToChat(booking._id, 'Booking declined by partner');
        }
      } catch (chatErr) { }

      res.status(200).json({
        success: true,
        message: newProvider
          ? `Booking rejected by provider and auto-reassigned to provider ${newProvider.name}.`
          : 'Booking rejected by provider. No other providers available; placed in Admin Queue.',
        data: {
          bookingId: booking._id,
          status: booking.status,
          reassigned: !!newProvider
        }
      });


    } catch (error) {
      await safeAbort(session);
      safeEnd(session);
      console.error('Error rejecting booking:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while rejecting booking',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async completeBooking(req, res) {
    const { id } = req.params;
    const providerId = req.provider._id;

    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (err) {
      console.warn("[Transaction Fallback] Session start failed. Standalone MongoDB detected. Running sequential fallback.", err.message);
      session = null;
    }

    try {
      const provider = await Provider.findById(providerId)
        .select('name email performanceTier wallet completedBookings performanceScore')
        .session(session);

      if (!provider) throw new Error('Provider not found');

      const booking = await Booking.findOne({
        _id: id,
        provider: providerId,
        status: { $in: ['in-progress', 'InProgress', 'started', 'Started'] }
      }).populate('customer', '_id name').session(session);

      if (!booking) {
        const currentBooking = await Booking.findById(id).select('status commissionProcessed').lean();

        if (currentBooking && ['completed', 'Completed'].includes(currentBooking.status)) {
          await safeCommit(session);
          safeEnd(session);
          return res.json({
            success: true,
            message: 'Booking already completed.'
          });
        }
        throw new Error('Booking must be In Progress or Started before it can be completed.');
      }

      // Map provider performanceScore stats to a tier for commission rule selection
      const stats = provider.performanceScore || { rating: 0, onTimePercentage: 0, completionPercentage: 0 };
      const avgScore = (stats.rating * 20 + (stats.onTimePercentage || 0) + (stats.completionPercentage || 0)) / 3;

      let performanceTier = 'standard';
      if (avgScore >= 80) performanceTier = 'premium';
      else if (avgScore < 40) performanceTier = 'basic';

      // Get commission rule for provider using booking zoneId and serviceId
      const firstService = booking.services && booking.services[0];
      const serviceId = firstService ? firstService.service : null;
      const commissionRule = await CommissionRule.getCommissionForProvider(
        providerId,
        booking.zoneId,
        performanceTier,
        serviceId
      );

      if (!commissionRule) {
        throw new Error('No active commission rule found for this provider. Cannot complete booking.');
      }

      // Prevent duplicate commission
      if (booking.commissionProcessed) {
        await safeCommit(session);
        safeEnd(session);
        return res.status(409).json({
          success: false,
          message: 'Commission already processed for this booking.'
        });
      }

      const { SystemConfig } = require('../models/SystemSetting');
      let systemConfigDoc = await SystemConfig.findOne().session(session).lean();
      if (!systemConfigDoc) {
        systemConfigDoc = { bookingSettings: { minCompletedImages: 1 } };
      }
      const minImages = systemConfigDoc.bookingSettings?.minCompletedImages || 1;

      // Handle after-work proof images (Required: minImages)
      if (!req.files || req.files.length < minImages) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: `At least ${minImages} completion proof images are required before completing service`
        });
      }

      const { latitude, longitude, pin, completionNotes } = req.body;

      // Check completionNotes presence
      if (!completionNotes || !completionNotes.trim()) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: 'Completion notes are mandatory to complete the service'
        });
      }

      // 1. Check PIN presence
      if (!pin) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: 'Completion verification PIN is required to complete the service'
        });
      }

      // 2. Check Lockout Cooldown
      const lockoutTime = BookingService.getLockoutTime(booking);
      if (lockoutTime && lockoutTime > new Date()) {
        const remainingMinutes = Math.ceil((lockoutTime - new Date()) / (60 * 1000));
        await safeAbort(session);
        safeEnd(session);
        return res.status(403).json({
          success: false,
          message: `Too many failed attempts. Verification is locked. Try again in ${remainingMinutes} minutes.`
        });
      }

      // 3. Verify COMPLETION PIN
      const { completionPin } = await BookingService.ensureAndPersistPins(booking._id, booking, session);
      if (pin !== completionPin) {
        await BookingService.recordPinFailure(booking, false, session);
        await createFraudLog(booking, 'failed_login', `Incorrect COMPLETION PIN entered: ${pin}`, 15, req);

        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: 'Invalid verification PIN'
        });
      }

      // 4. Verify Coordinates
      if (!latitude || !longitude) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: 'GPS coordinates are required to complete the service'
        });
      }

      const providerLat = parseFloat(latitude);
      const providerLng = parseFloat(longitude);

      const targetLoc = BookingService.getBookingAddressLocation(booking);
      if (!targetLoc) {
        return res.status(400).json({
          success: false,
          message: 'Booking address has no GPS coordinates for completion verification.'
        });
      }

      const distance = calculateDistance(providerLat, providerLng, targetLoc.latitude, targetLoc.longitude);

      // Dual-Layer S2 Geofencing Verification (Level 16 ~150m cells - realistic for mobile GPS accuracy)
      /* BACKUP COMMENT: Original S2 calculations were synchronous. Offloading to worker threads now. */
      const { latLngToS2CellIdAsync, getNeighborsAsync, getLevelAsync } = require('../utils/s2HelperAsync');
      const S2_LEVEL = 16; // Level 16 = ~150m cells (Level 20 was ~1cm, too strict for GPS drift)
      const providerS2Precise = await latLngToS2CellIdAsync(providerLat, providerLng, S2_LEVEL);
      let targetS2Precise = booking.address?.s2CellIdPrecise;

      let isTargetValid = false;
      if (targetS2Precise && targetS2Precise.length === 16) {
        try {
          const lvl = await getLevelAsync('0x' + targetS2Precise);
          if (lvl === S2_LEVEL) isTargetValid = true;
        } catch (e) { }
      }

      if (!isTargetValid) {
        targetS2Precise = await latLngToS2CellIdAsync(targetLoc.latitude, targetLoc.longitude, S2_LEVEL);
      }
      const neighborCells = await getNeighborsAsync(targetS2Precise);
      const acceptableCells = [targetS2Precise, ...neighborCells];
      if (!acceptableCells.includes(providerS2Precise)) {
        // S2 cell mismatch - but only block if distance is also > 300m (handles edge cases)
        if (distance > 300) {
          await createFraudLog(booking, 'failed_login', `S2 Geofence mismatch during completion verification: Provider at ${providerLat}, ${providerLng} (Cell: ${providerS2Precise}) but target at ${targetLoc.latitude}, ${targetLoc.longitude} (Cell: ${targetS2Precise}), Distance: ${Math.round(distance)}m`, 25, req);

          booking.statusHistory.push({
            status: booking.status,
            timestamp: new Date(),
            note: `S2 Geofence failed. Provider Cell: ${providerS2Precise}, Target Cell: ${targetS2Precise}, Distance: ${Math.round(distance)}m`,
            updatedBy: 'system'
          });
          await booking.save({ session });

          await safeAbort(session);
          safeEnd(session);
          return res.status(400).json({
            success: false,
            message: `You are outside the geofence boundary of the service location. Distance: ${Math.round(distance)}m`
          });
        }
        // S2 mismatch but within 300m - log warning but allow (GPS drift tolerance)
        console.warn(`[completeBooking] S2 cell mismatch but within distance tolerance (${Math.round(distance)}m). Provider: ${providerS2Precise}, Target: ${targetS2Precise}. Allowing completion.`);
      }

      if (distance > 300) {
        await createFraudLog(booking, 'failed_login', `Geofencing mismatch during completion verification: Provider at ${providerLat}, ${providerLng} but target at ${targetLoc.latitude}, ${targetLoc.longitude} (Distance: ${Math.round(distance)}m)`, 25, req);

        // Push warning to history
        booking.statusHistory.push({
          status: booking.status,
          timestamp: new Date(),
          note: `Geofencing verification failed. Distance: ${Math.round(distance)}m.`,
          updatedBy: 'system'
        });
        await booking.save({ session });

        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({
          success: false,
          message: `Geofencing verification failed. You must be within 300 meters of the service location. Current distance: ${Math.round(distance)}m`
        });
      }

      // Reset failures on success
      await BookingService.resetPinFailures(booking, session);
      booking.statusHistory.push({
        status: booking.status,
        timestamp: new Date(),
        note: 'Verification successful. FAILED_ATTEMPTS:0',
        updatedBy: 'system'
      });

      const afterImages = req.files.map(file => ({
        url: file.path || file.secure_url,
        uploadedAt: new Date()
      }));

      // Commission & Surcharge Splits Calculation
      const baseForCommission = Math.max(0, booking.subtotal - booking.totalDiscount);
      let activeCommissionRule = commissionRule;
      if (provider.referralBenefit && provider.referralBenefit.validTill > new Date() && provider.referralBenefit.commissionDiscountPercent > 0) {
        activeCommissionRule = commissionRule.toObject ? commissionRule.toObject() : { ...commissionRule };
        activeCommissionRule.value = Math.max(0, activeCommissionRule.value - provider.referralBenefit.commissionDiscountPercent);
      }
      const { commission, netAmount } = CommissionRule.calculateCommission(
        baseForCommission,
        activeCommissionRule
      );

      let settings = await SystemConfig.findOne();
      if (!settings) {
        settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
        await settings.save(session ? { session } : {});
      }
      const splits = settings.surgeSplitSettings || {};
      const splitVisiting = typeof splits.visiting === 'number' && !isNaN(splits.visiting) ? splits.visiting : 60;
      const splitRain = typeof splits.rain === 'number' && !isNaN(splits.rain) ? splits.rain : 70;
      const splitTraffic = typeof splits.traffic === 'number' && !isNaN(splits.traffic) ? splits.traffic : 70;
      const splitNight = typeof splits.night === 'number' && !isNaN(splits.night) ? splits.night : 70;
      const splitDemand = typeof splits.demand === 'number' && !isNaN(splits.demand) ? splits.demand : 50;
      const splitEmergency = typeof splits.emergency === 'number' && !isNaN(splits.emergency) ? splits.emergency : 85;

      // Surcharge amounts on this booking
      const visiting = typeof booking.visitingCharge === 'number' && !isNaN(booking.visitingCharge) ? booking.visitingCharge : 0;
      const rain = typeof booking.rainCharge === 'number' && !isNaN(booking.rainCharge) ? booking.rainCharge : 0;
      const traffic = typeof booking.trafficCharge === 'number' && !isNaN(booking.trafficCharge) ? booking.trafficCharge : 0;
      const night = typeof booking.nightCharge === 'number' && !isNaN(booking.nightCharge) ? booking.nightCharge : 0;
      const demand = typeof booking.demandSurge === 'number' && !isNaN(booking.demandSurge) ? booking.demandSurge : 0;
      const emergency = typeof booking.emergencySurge === 'number' && !isNaN(booking.emergencySurge) ? booking.emergencySurge : 0;
      const custom = typeof booking.customCharges === 'number' && !isNaN(booking.customCharges) ? booking.customCharges : 0;

      // Provider splits
      const provVisitingShare = parseFloat((visiting * (splitVisiting / 100)).toFixed(2)) || 0;
      const provRainShare = parseFloat((rain * (splitRain / 100)).toFixed(2)) || 0;
      const provTrafficShare = parseFloat((traffic * (splitTraffic / 100)).toFixed(2)) || 0;
      const provNightShare = parseFloat((night * (splitNight / 100)).toFixed(2)) || 0;
      const provDemandShare = parseFloat((demand * (splitDemand / 100)).toFixed(2)) || 0;
      const provEmergencyShare = parseFloat((emergency * (splitEmergency / 100)).toFixed(2)) || 0;

      const providerSurgeShare = parseFloat((provVisitingShare + provRainShare + provTrafficShare + provNightShare + provDemandShare + provEmergencyShare).toFixed(2)) || 0;
      const totalSurcharges = visiting + rain + traffic + night + demand + emergency + custom;
      const companySurgeShare = parseFloat((totalSurcharges - providerSurgeShare).toFixed(2)) || 0;

      booking.providerWorkProof = {
        ...booking.providerWorkProof,
        afterImages: afterImages,
        completionLocation: { latitude: providerLat, longitude: providerLng },
        completionNotes: completionNotes ? completionNotes.trim() : ''
      };

      booking.status = 'completed';
      booking.completedAt = new Date();
      booking.paymentStatus = 'paid';
      booking.commissionProcessed = true;

      booking.commissionAmount = commission || 0;
      booking.providerEarnings = parseFloat((netAmount + providerSurgeShare).toFixed(2));
      booking.providerSurgeShare = providerSurgeShare;
      booking.companySurgeShare = companySurgeShare;
      booking.surgeSplitSettings = splits;

      // Fraud score checking for Hold extension
      let fraudScore = 0;
      let holdPeriodHours = 0;
      if (booking.paymentMethod === 'cash') {
        booking.payoutHoldUntil = null;
      } else {
        fraudScore = BookingService.getFraudScore(booking);
        holdPeriodHours = typeof settings?.commissionSettings?.payoutHoldHours === 'number' ? settings.commissionSettings.payoutHoldHours : 48;
        if (fraudScore >= 50) {
          holdPeriodHours = 168; // 7 days (168 hours)
          booking.disputeRaised = true; // Flag for review
          booking.disputeStatus = 'under_review';
        }
        booking.payoutHoldUntil = new Date(Date.now() + holdPeriodHours * 60 * 60 * 1000);
      }

      // Add status history note
      booking.statusHistory.push({
        status: 'completed',
        timestamp: new Date(),
        note: booking.paymentMethod === 'cash'
          ? `Service completed. Cash payment verified.`
          : fraudScore >= 50
            ? `Service completed. Verification successful. Suspicious activity detected (Fraud Score: ${fraudScore}). Payout held for 7 days (168 hours) for admin review.`
            : `Service completed. Verification successful. Payout held for ${holdPeriodHours} hours for dispute review.`,
        updatedBy: 'system'
      });

      await booking.save({ session });

      // Atomic cross-document write moved from pre-save hook into the transactional session
      /* BACKUP COMMENT: Incrementing customer completed bookings count atomically under active session. */
      const User = mongoose.model('User');
      const customerId = booking.customer?._id || booking.customer;
      if (customerId) {
        await User.findByIdAndUpdate(customerId, { $inc: { totalBookings: 1 } }, { session });
      }


      // ------------------------------
      //  CASH PAYMENT: Create a cash transaction
      // ------------------------------
      if (booking.paymentMethod === 'cash') {
        const Transaction = require('../models/Transaction-model');

        let cashTransaction = await Transaction.findOne({ booking: booking._id }).session(session);
        if (cashTransaction) {
          cashTransaction.amount = booking.totalAmount;
          cashTransaction.paymentStatus = 'completed';
          cashTransaction.provider = booking.provider;
          cashTransaction.providerId = booking.provider?.toString();
          cashTransaction.commission = booking.commissionAmount || 0;
          cashTransaction.providerEarning = booking.providerEarnings || 0;
          cashTransaction.completedAt = new Date();
          cashTransaction.description = `Cash payment for booking ${booking.bookingId || booking._id}`;
          cashTransaction.updatedAt = new Date();
          await cashTransaction.save({ session });
        } else {
          cashTransaction = new Transaction({
            booking: booking._id,
            user: booking.customer,
            amount: booking.totalAmount,
            paymentMethod: 'cash',
            paymentStatus: 'completed',
            bookingId: booking.bookingId,
            customerId: booking.customer?.toString(),
            provider: booking.provider,
            providerId: booking.provider?.toString(),
            commission: booking.commissionAmount || 0,
            providerEarning: booking.providerEarnings || 0,
            transactionId: `CASH-${Date.now()}-${booking._id.toString().slice(-6)}`,
            currency: settings?.defaultCurrency || 'INR',
            completedAt: new Date(),
            type: 'payment',
            description: `Cash payment for booking ${booking.bookingId || booking._id}`
          });
          await cashTransaction.save({ session });
        }
      }

      //  PREVENT DUPLICATE EARNING RECORD USING UPSERT
      // ------------------------------
      let earningStatus, availableAfter;

      if (booking.paymentMethod === "cash") {
        earningStatus = "paid"; // provider already received cash
        availableAfter = new Date();
      } else {
        earningStatus = "held"; // 48h hold for online payments
        availableAfter = booking.payoutHoldUntil;
      }

      const providerEarningResult = await ProviderEarning.findOneAndUpdate(
        { booking: booking._id, provider: providerId },
        {
          $setOnInsert: {
            grossAmount: booking.totalAmount,
            commissionRate: commissionRule ? commissionRule.value : 0,
            commissionAmount: commission,
            netAmount: booking.providerEarnings,
            status: earningStatus,
            availableAfter
          }
        },
        { session, upsert: true, new: true, rawResult: true }
      );

      if (providerEarningResult.lastErrorObject && providerEarningResult.lastErrorObject.updatedExisting) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(409).json({
          success: false,
          message: 'Earning already recorded for this booking!'
        });
      }

      // ------------------------------
      // Earning was safely created in the DB through the upsert above.

      // ------------------------------
      //  FIXED WALLET LOGIC (Updated for 48h hold)
      // ------------------------------
      if (booking.paymentMethod === "cash") {
        // Cash Booking Commission Logic
        const updatedProvider = await Provider.findOneAndUpdate(
          { _id: providerId, 'wallet.availableBalance': { $gte: commission } },
          {
            $inc: { 'wallet.availableBalance': -commission, completedBookings: 1 },
            $set: { 'wallet.lastUpdated': new Date(), activeBooking: null }
          },
          { session, new: true }
        );
        if (!updatedProvider) {
          await safeAbort(session);
          safeEnd(session);
          return res.status(400).json({
            success: false,
            message: "Insufficient wallet balance to cover commission for this cash booking. Please recharge your wallet."
          });
        }
      } else {
        await Provider.findByIdAndUpdate(
          providerId,
          {
            $inc: { completedBookings: 1 },
            $set: { 'wallet.lastUpdated': new Date(), activeBooking: null }
          },
          { session }
        );
      }

      // Notify provider about payout hold
      if (booking.paymentMethod !== "cash") {
        try {
          sendNotification(
            providerId,
            'provider',
            'Payout Under Review',
            `Booking ${booking.bookingId || booking._id} completed. Your payout of ₹${netAmount} is under review for ${holdPeriodHours} hours.`,
            'payout_hold',
            booking._id
          );
        } catch (err) { console.error("Error sending payout hold notification:", err); }
      }

      await safeCommit(session);
      safeEnd(session);
      emitBookingUpdate(booking._id, booking, 'completed');

      // Trigger Referral & Rewards System
      try {
        const referralController = require('../controllers/Referral-controller');
        await referralController.triggerCustomerReferralReward(booking);
        if (booking.provider) {
          await referralController.triggerProviderReferralReward(booking.provider);
        }
      } catch (refRewardErr) {
        console.error('Error triggering referral rewards on booking completion:', refRewardErr);
      }

      // Recalculate performance score and trust score dynamically after transaction commits successfully to avoid write conflicts
      try {
        await BookingService.recalculateProviderPerformance(providerId);
      } catch (err) {
        console.error("Error recalculating provider performance after completeBooking commit:", err);
      }

      // Add system message to chat
      await addSystemMessageToChat(booking._id, 'Service completed by partner');

      // Real-time notifications for customer and admins
      try {
        if (booking.customer) {
          const customerId = booking.customer._id || booking.customer;
          await sendNotification(
            customerId,
            'customer',
            'Booking Completed',
            `Your booking has been completed successfully.`,
            'booking',
            booking._id
          );
          const { triggerEventNotification } = require('../utils/notificationHelper');
          await triggerEventNotification('booking_completed', {
            booking
          }, customerId);
        }
        await notifyAdmins(
          'Booking Completed',
          `Booking ${booking._id} has been completed by the provider.`,
          'booking',
          booking._id
        );
      } catch (fcmError) {
        console.error('FCM Notification Error (Booking Completed):', fcmError);
      }

      // Invalidate dashboard caches
      try {


      } catch (e) { }

      return res.json({
        success: true,
        message: "Booking completed successfully.",
        data: {
          bookingId: booking._id,
          status: "completed",
          totalAmount: booking.totalAmount,
          commission,
          netAmount
        }
      });

    } catch (error) {
      await safeAbort(session);
      safeEnd(session);
      console.error("Complete Booking Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to complete booking"
      });
    }
  }

  static async providerBookingReport(req, res) {
    try {
      const providerId = req.provider._id; // Authenticated provider
      const { startDate, endDate } = req.query;

      // Validate date inputs
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "Please provide both startDate and endDate",
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validation: min 7 days, max 2 months (62 days)
      const diffDays = (end - start) / (1000 * 60 * 60 * 24);
      if (diffDays < 7 || diffDays > 62) {
        return res.status(400).json({
          success: false,
          message: "Date range must be between 7 days and 2 months",
        });
      }

      // Get provider to ensure they exist and for commission calculations
      const provider = await Provider.findById(providerId).select('performanceScore');
      if (!provider) {
        return res.status(404).json({ success: false, message: "Provider not found." });
      }

      // Fetch bookings
      const bookings = await Booking.find({
        provider: providerId,
        date: { $gte: start, $lte: end },
      })
        .populate("customer", "name email phone profilePicUrl createdAt")
        .populate("services.service", "title")
        .sort({ date: -1 })
        .lean();

      if (!bookings.length) {
        return res.json({
          success: true,
          message: "No bookings found for the selected date range",
        });
      }

      // Add commission calculations to bookings
      const bookingsWithCommission = await Promise.all(bookings.map(async (booking) => {
        const bookingRule = await CommissionRule.getCommissionForProvider(
          providerId,
          booking.zoneId,
          provider.performanceScore || 'standard',
          booking.services && booking.services[0]?.service
        );
        const { commission, netAmount } = CommissionRule.calculateCommission(
          booking.totalAmount,
          bookingRule
        );
        return {
          ...booking,
          commissionAmount: booking.commissionAmount !== undefined ? booking.commissionAmount : commission,
          providerEarnings: booking.providerEarnings !== undefined ? booking.providerEarnings : netAmount
        };
      }));

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Booking Report");

      // Define columns
      worksheet.columns = [
        { header: "Booking ID", key: "bookingId", width: 25 },
        { header: "Customer Name", key: "customerName", width: 25 },
        { header: "Services Booked", key: "services", width: 40 },
        { header: "Date & Time", key: "dateTime", width: 25 },
        { header: "Status", key: "status", width: 20 },
        { header: "Payment Method", key: "paymentMethod", width: 20 },
        { header: "Payment Status", key: "paymentStatus", width: 20 },
        { header: "Total Amount", key: "totalAmount", width: 20 },
        { header: "Commission Amount", key: "commissionAmount", width: 20 },
        { header: "Provider Earnings", key: "providerEarnings", width: 20 },
        { header: "Service Completed At", key: "completedAt", width: 25 },
      ];

      // Add rows
      bookingsWithCommission.forEach((booking) => {
        // Format services
        const serviceDetails = booking.services
          .map(
            (s) =>
              `${s.service?.title || "Unknown"} (Qty: ${s.quantity}, Price: ₹${s.price})`
          )
          .join("; ");

        worksheet.addRow({
          bookingId: booking.bookingId || booking._id.toString(),
          customerName: booking.customer?.name || "N/A",
          services: serviceDetails,
          dateTime: `${booking.date.toISOString().split("T")[0]} ${booking.time}`,
          status: booking.status,
          paymentMethod: booking.paymentMethod,
          paymentStatus: booking.paymentStatus,
          totalAmount: booking.totalAmount,
          commissionAmount: booking.commissionAmount,
          providerEarnings: booking.providerEarnings,
          completedAt: booking.completedAt
            ? booking.completedAt.toISOString().split("T")[0]
            : "N/A",
        });
      });

      // File name
      const fileName = `Booking_Report_${startDate}_to_${endDate}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to download booking report",
        error: error.message,
      });
    }
  }

  static async getAllBookings(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let sort = {};
      if (req.query.sortBy) {
        const sortFields = req.query.sortBy.split(',');
        sortFields.forEach(field => {
          const [key, order] = field.split(':');
          sort[key] = order === 'desc' ? -1 : 1;
        });
      } else {
        sort = { date: -1 };
      }

      const match = {};

      if (req.query.forRefunds === 'true') {
        match.$or = [
          { complaint: { $exists: true, $ne: null } },
          { disputeRaised: true },
          { paymentStatus: 'refunded' },
          { disputeStatus: { $exists: true, $ne: 'none' } },
          {
            paymentMethod: 'online',
            paymentStatus: { $in: ['paid', 'refunded'] },
            status: 'cancelled'
          }
        ];
      }

      // 1. Time Range Filter
      if (req.query.timeRange) {
        const now = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        switch (req.query.timeRange) {
          case 'today':
            match.date = { $gte: start };
            break;
          case 'week':
            start.setDate(now.getDate() - 7);
            match.date = { $gte: start };
            break;
          case 'month':
            start.setMonth(now.getMonth() - 1);
            match.date = { $gte: start };
            break;
          case 'quarterly':
            start.setMonth(now.getMonth() - 3);
            match.date = { $gte: start };
            break;
          case 'half-year':
            start.setMonth(now.getMonth() - 6);
            match.date = { $gte: start };
            break;
          case 'year':
            start.setFullYear(now.getFullYear() - 1);
            match.date = { $gte: start };
            break;
        }
      }

      // 2. Manual Date Filters
      if (req.query.startDate || req.query.endDate) {
        if (!match.date) match.date = {};
        if (req.query.startDate) {
          match.date.$gte = new Date(req.query.startDate);
        }
        if (req.query.endDate) {
          match.date.$lte = new Date(req.query.endDate);
        }
      }

      // Clone match for stats (before adding status/payment/search filters)
      const statsMatch = { ...match };

      // 3. Status and Payment Status Filters
      if (req.query.status) {
        match.status = { $in: req.query.status.split(',') };
      }

      if (req.query.paymentStatus) {
        match.paymentStatus = { $in: req.query.paymentStatus.split(',') };
      }

      const pipeline = [];
      if (Object.keys(match).length > 0) {
        pipeline.push({ $match: match });
      }

      // Lookups for customer, provider, and services
      pipeline.push(
        {
          $lookup: {
            from: 'users',
            localField: 'customer',
            foreignField: '_id',
            as: 'customer'
          }
        },
        {
          $unwind: {
            path: '$customer',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'providers',
            localField: 'provider',
            foreignField: '_id',
            as: 'provider'
          }
        },
        {
          $unwind: {
            path: '$provider',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'complaints',
            localField: 'complaint',
            foreignField: '_id',
            as: 'complaint'
          }
        },
        {
          $unwind: {
            path: '$complaint',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'services',
            localField: 'services.service',
            foreignField: '_id',
            as: 'serviceDetails'
          }
        },
        {
          $lookup: {
            from: 'providerearnings',
            localField: '_id',
            foreignField: 'booking',
            as: 'earning'
          }
        },
        {
          $addFields: {
            earningStatus: { $ifNull: [{ $arrayElemAt: ['$earning.status', 0] }, 'N/A'] },
            payoutStatus: {
              $cond: {
                if: { $eq: [{ $size: '$earning' }, 0] },
                then: 'Not Processed',
                else: {
                  $cond: {
                    if: { $or: [{ $eq: ['$disputeRaised', true] }, { $eq: ['$disputeStatus', 'under_review'] }] },
                    then: 'Dispute Hold',
                    else: {
                      $switch: {
                        branches: [
                          { case: { $eq: [{ $arrayElemAt: ['$earning.status', 0] }, 'held'] }, then: 'Payout On Hold' },
                          { case: { $eq: [{ $arrayElemAt: ['$earning.status', 0] }, 'available'] }, then: 'Payout Ready' },
                          { case: { $in: [{ $arrayElemAt: ['$earning.status', 0] }, ['paid', 'withdrawn']] }, then: 'Payout Released' },
                          { case: { $eq: [{ $arrayElemAt: ['$earning.status', 0] }, 'cancelled'] }, then: 'Refund Adjusted' }
                        ],
                        default: { $arrayElemAt: ['$earning.status', 0] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      );

      if (req.query.search) {
        const search = req.query.search;
        const searchRegex = { $regex: search, $options: 'i' };

        const searchMatch = {
          $or: [
            { bookingId: search }, // Prioritize exact match for bookingId
            { 'customer.name': searchRegex },
            { 'customer.email': searchRegex },
            { 'provider.name': searchRegex },
            { 'provider.email': searchRegex },
            { 'serviceDetails.title': searchRegex },
            { status: searchRegex },
            { bookingId: searchRegex }, // Keep fuzzy match as fallback
            { 'address.street': searchRegex },
            { 'address.city': searchRegex },
            { 'address.postalCode': searchRegex },
            { 'address.state': searchRegex },
          ]
        };

        if (mongoose.Types.ObjectId.isValid(search)) {
          searchMatch.$or.push({ _id: new mongoose.Types.ObjectId(search) });
        }

        pipeline.push({ $match: searchMatch });
      }

      pipeline.push({
        $addFields: {
          'services': {
            $map: {
              input: '$services',
              as: 'serviceItem',
              in: {
                $mergeObjects: [
                  '$serviceItem',
                  {
                    service: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$serviceDetails',
                            as: 'sd',
                            cond: { $eq: ['$sd._id', '$serviceItem.service'] }
                          }
                        },
                        0
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      });

      pipeline.push({
        $project: {
          serviceDetails: 0
        }
      });

      // Inject late match for refundStatus filter if forRefunds is true
      if (req.query.forRefunds === 'true' && req.query.refundStatus && req.query.refundStatus !== 'all') {
        const refundMatch = {};
        if (req.query.refundStatus === 'pending') {
          refundMatch.paymentStatus = { $in: ['paid', 'escrow_hold'] };
          refundMatch.disputeRaised = true;
        } else if (req.query.refundStatus === 'completed') {
          refundMatch.$or = [
            { paymentStatus: 'refunded' },
            { adminRefundDecision: 'approved' }
          ];
        } else if (req.query.refundStatus === 'rejected') {
          refundMatch.adminRefundDecision = 'rejected';
        } else if (req.query.refundStatus === 'disputed') {
          refundMatch.disputeStatus = { $in: ['UNDER_REVIEW', 'pending'] };
        } else if (req.query.refundStatus === 'held') {
          refundMatch.$or = [
            { earningStatus: 'held' },
            { payoutHoldUntil: { $ne: null } }
          ];
        }
        pipeline.push({ $match: refundMatch });
      }

      // Stats Pipeline (independent of search and pagination)
      const statsPipeline = [
        { $match: statsMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            revenue: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'completed'] }, { $eq: ['$paymentStatus', 'paid'] }] },
                  '$totalAmount',
                  0
                ]
              }
            }
          }
        }
      ];

      const countPipeline = [...pipeline, { $count: 'total' }];

      pipeline.push({ $sort: sort });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      // Setup concurrent promise for refund wide statistics
      let refundStatsPromise = Promise.resolve(null);
      if (req.query.forRefunds === 'true') {
        const statsMatchForRefunds = {
          $or: [
            { complaint: { $exists: true, $ne: null } },
            { disputeRaised: true },
            { paymentStatus: 'refunded' },
            { disputeStatus: { $exists: true, $ne: 'none' } },
            {
              paymentMethod: 'online',
              paymentStatus: { $in: ['paid', 'refunded'] },
              status: 'cancelled'
            }
          ]
        };

        refundStatsPromise = Booking.aggregate([
          { $match: statsMatchForRefunds },
          {
            $lookup: {
              from: 'providerearnings',
              localField: '_id',
              foreignField: 'booking',
              as: 'earning'
            }
          },
          {
            $group: {
              _id: null,
              processedRefunds: {
                $sum: {
                  $cond: [
                    { $or: [{ $eq: ['$paymentStatus', 'refunded'] }, { $eq: ['$adminRefundDecision', 'approved'] }] },
                    1,
                    0
                  ]
                }
              },
              activeDisputes: {
                $sum: {
                  $cond: [
                    { $or: [{ $eq: ['$disputeRaised', true] }, { $ne: [{ $ifNull: ['$disputeStatus', 'none'] }, 'none'] }] },
                    1,
                    0
                  ]
                }
              },
              escrowHolds: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: [{ $arrayElemAt: ['$earning.status', 0] }, 'held'] },
                        { $ne: [{ $ifNull: ['$payoutHoldUntil', null] }, null] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]);
      }

      const [bookings, totalResult, statsResult, refundStatsResult] = await Promise.all([
        Booking.aggregate(pipeline),
        Booking.aggregate(countPipeline),
        Booking.aggregate(statsPipeline),
        refundStatsPromise
      ]);

      if (req.query.forRefunds === 'true') {
        const { enrichComplaintData } = require('../controllers/Complaint-controller');
        await Promise.all(bookings.map(async (b) => {
          if (b.complaint) {
            try {
              b.complaint = await enrichComplaintData(b.complaint, req, false);
            } catch (e) {
              console.error("Error enriching complaint in bookings list:", e);
            }
          }
        }));
      }

      const total = totalResult.length > 0 ? totalResult[0].total : 0;
      const pages = Math.ceil(total / limit);
      const stats = statsResult.length > 0 ? statsResult[0] : {
        total: 0,
        pending: 0,
        accepted: 0,
        completed: 0,
        cancelled: 0,
        revenue: 0
      };

      const refundStats = (refundStatsResult && refundStatsResult.length > 0) ? refundStatsResult[0] : {
        processedRefunds: 0,
        activeDisputes: 0,
        escrowHolds: 0
      };

      res.status(200).json({
        success: true,
        count: bookings.length,
        page,
        pages,
        total,
        stats,
        refundStats,
        data: bookings.map(b => enrichBookingData(b))
      });

    } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while fetching bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  static async getBookingDetails(req, res) {
    try {
      const { id } = req.params;

      const booking = await Booking.findById(id)
        .populate('customer', 'name email phone profilePicUrl')
        .populate({
          path: 'provider',
          select: 'providerId name email phone experience serviceArea rating services profilePicUrl bankDetails currentLocation isOnline',
          populate: {
            path: 'services',
            select: 'name'
          }
        })
        .populate({
          path: 'services.service',
          select: 'title category description basePrice duration image',
          populate: {
            path: 'category',
            select: 'name'
          }
        })
        .populate('feedback')
        .populate('complaint')
        .populate('commissionRule', 'name rate type')
        .populate('zoneId', 'name city status zoneLevel')
        .select('+startPin +completionPin')
        .lean();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      // Get earning hold status
      const ProviderEarning = mongoose.model('ProviderEarning');
      const earning = await ProviderEarning.findOne({ booking: booking._id }).select('status availableAfter').lean();

      // Format services with service details
      const formattedServices = booking.services.map(item => ({
        _id: item._id,
        service: {
          _id: item.service?._id,
          title: item.service?.title,
          category: item.service?.category,
          description: item.service?.description,
          basePrice: item.service?.basePrice,
          duration: item.service?.duration,
          images: item.service?.images
        },
        quantity: item.quantity,
        price: item.price,
        discountAmount: item.discountAmount
      }));

      // Get payment details from transactions
      let paymentDetails = null;
      const Transaction = require('../models/Transaction-model');
      const transactions = await Transaction.find({
        booking: booking._id
      }).sort({ createdAt: -1 });

      if (transactions.length > 0 && booking.paymentMethod === 'online') {
        const transaction = transactions[0];
        const isOnline = transaction.paymentMethod === 'online' || transaction.paymentMethod === 'upi';
        paymentDetails = {
          transactionId: transaction.transactionId,
          amount: isOnline ? (transaction.amount / 100) : transaction.amount,
          paymentStatus: transaction.paymentStatus,
          paymentMethod: transaction.paymentMethod,
          currency: transaction.currency,
          razorpayOrderId: transaction.razorpayOrderId,
          razorpayPaymentId: transaction.razorpayPaymentId,
          createdAt: transaction.createdAt
        };
      }

      // Explicitly add refund status from the first transaction if exists
      const firstTx = transactions[0] || {};
      const isOnlineRefund = firstTx.paymentMethod === 'online' || firstTx.paymentMethod === 'upi';
      const refundData = transactions.length > 0 ? {
        status: firstTx.refundStatus,
        refundedAmount: isOnlineRefund ? (firstTx.refundedAt / 100) : firstTx.refundedAt,
        refundReason: firstTx.refundReason,
        refundedAt: firstTx.refundedAt
      } : null;

      // Map transactions for history view
      const formattedTransactions = transactions.map(tx => {
        const isTxOnline = tx.paymentMethod === 'online' || tx.paymentMethod === 'upi';
        return {
          ...tx.toObject ? tx.toObject() : tx,
          amount: isTxOnline ? (tx.amount / 100) : tx.amount,
          refundedAmount: isTxOnline ? (tx.refundedAt / 100) : tx.refundedAt
        };
      });

      // Fetch complaint associated with this booking
      const Complaint = require('../models/Complaint-model');
      const complaint = await Complaint.findOne({
        $or: [{ booking: booking._id }, { bookingId: booking._id }]
      }).lean();

      // Format the response — enrich the nested booking object so pricingBreakdown is on response.booking
      const enrichedBooking = enrichBookingData({
        ...booking,
        adminEarning: booking.commissionAmount + (booking.companySurgeShare || 0),
        providerWorkProof: booking.providerWorkProof || { beforeImages: [], afterImages: [] },
        complaintProofs: booking.complaintProofs || []
      }, transactions?.[0]);

      const response = {
        booking: enrichedBooking,
        customer: booking.customer,
        provider: booking.provider,
        services: formattedServices,
        payment: {
          ...booking.payment,
          method: booking.paymentMethod,
          status: booking.paymentStatus,
          subtotal: booking.subtotal,
          totalDiscount: booking.totalDiscount,
          totalAmount: booking.totalAmount,
          couponApplied: booking.couponApplied,
          details: paymentDetails
        },
        commission: {
          amount: booking.commissionAmount,
          rule: booking.commissionRule
        },
        feedback: booking.feedback,
        complaint: complaint,
        adminRemark: booking.adminRemark,
        payoutHoldUntil: booking.payoutHoldUntil,
        earningHoldStatus: earning ? earning.status : 'N/A',
        payoutStatus: BookingService.getPayoutStatus(earning, booking),
        disputeRaised: booking.disputeRaised,
        disputeStatus: booking.disputeStatus,
        timeline: getBookingTimeline(booking, BookingService.getPayoutStatus(earning, booking)),
        transactions: formattedTransactions,
        refundData: refundData
      };

      if (response.complaint) {
        try {
          const { enrichComplaintData } = require('../controllers/Complaint-controller');
          response.complaint = await enrichComplaintData(response.complaint, req);
        } catch (e) {
          console.error("Error enriching complaint in getBookingDetails response:", e);
        }
      }

      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async assignProvider(req, res) {
    try {
      const { id } = req.params;
      const { providerId } = req.body || {};

      if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(providerId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID or provider ID format'
        });
      }

      const result = await runInTransactionOrSequential(async (session) => {
        const booking = session ? await Booking.findById(id).session(session) : await Booking.findById(id);
        if (!booking) {
          throw new Error('Booking not found');
        }

        if (booking.provider) {
          throw new Error('Booking has already been assigned to a provider');
        }

        // EMERGENCY BOOKING ENGINE UPGRADE
        if (booking.status !== 'pending' && booking.status !== 'Waiting Admin Assignment') {
          throw new Error('Only pending or waiting admin assignment bookings can be assigned');
        }
        // END EMERGENCY BOOKING ENGINE UPGRADE

        const provider = session ? await Provider.findById(providerId).session(session) : await Provider.findById(providerId);
        if (!provider || !provider.approved || provider.isDeleted) {
          throw new Error('Invalid provider');
        }

        // Check parallel bookings limit & scheduling conflict based on system configuration
        const { SystemConfig } = require('../models/SystemSetting');
        let settings = session ? await SystemConfig.findOne().session(session) : await SystemConfig.findOne();
        const maxBookings = settings?.bookingSettings?.maxBookingsPerProvider ?? 10;
        const bufferMinutes = settings?.bookingSettings?.bookingBufferTime ?? 30;

        const providerBookings = session
          ? await Booking.find({
            provider: providerId,
            status: { $in: ['accepted', 'in-progress', 'started', 'confirmed', 'scheduled', 'assigned'] }
          }).session(session)
          : await Booking.find({
            provider: providerId,
            status: { $in: ['accepted', 'in-progress', 'started', 'confirmed', 'scheduled', 'assigned'] }
          });

        if (providerBookings.length >= maxBookings) {
          throw new Error(`This provider has reached the maximum limit of parallel bookings (${maxBookings}).`);
        }

        if (checkProviderOverlap(booking, providerBookings, bufferMinutes)) {
          throw new Error(`Scheduling conflict: This provider already has another booking scheduled around this time. Please complete their current booking first.`);
        }

        if (!validateBookingTransition(booking.status, 'assigned') && !validateBookingTransition(booking.status, 'scheduled')) {
          throw new Error(`Cannot assign provider from current status: ${booking.status}`);
        }

        booking.provider = providerId;
        booking.status = 'scheduled';
        await booking.save({ session });

        // Sync transaction record with the new provider and calculated commission
        try {
          const isOnline = booking.paymentMethod?.toLowerCase() === 'online' || booking.paymentMethod?.toLowerCase() === 'upi';
          await Transaction.updateMany(
            { booking: booking._id },
            {
              provider: booking.provider,
              providerId: booking.provider.toString(),
              commission: booking.commissionAmount || 0,
              providerEarning: booking.providerEarnings || 0,
              commissionRule: booking.commissionRule,
              ...((booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold') && {
                paymentStatus: isOnline ? 'success' : 'completed'
              })
            },
            session ? { session } : {}
          );
        } catch (transError) {
          console.error('Error syncing transaction on provider assignment:', transError);
        }

        return { booking, provider };
      });

      const populatedBooking = await Booking.findById(result.booking._id)
        .populate('customer', 'name email phone')
        .populate('services.service', 'title description price');

      emitBookingUpdate(result.booking._id, populatedBooking, 'assigned');

      // Add system message to chat
      await addSystemMessageToChat(result.booking._id, `Booking assigned to partner: ${result.provider.name}`);

      // Send notifications
      try {
        if (result.booking.customer) {
          await sendNotification(
            result.booking.customer,
            'customer',
            'Provider Assigned',
            `A service provider, ${result.provider.name}, has been assigned to your booking.`,
            'booking',
            result.booking._id
          );
        }
        await sendNotification(
          result.provider._id,
          'provider',
          'New Booking Assigned',
          `You have been assigned a new booking for ${populatedBooking.services && populatedBooking.services[0] ? populatedBooking.services[0].service.title : 'requested service'}.`,
          'booking',
          result.booking._id
        );
      } catch (notifErr) {
        console.error('Failed to send notification on provider assignment:', notifErr);
      }

      res.json({
        success: true,
        message: 'Provider assigned successfully',
        data: populatedBooking
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteBooking(req, res) {
    try {
      const { id } = req.params;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (['completed', 'in-progress'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete ${booking.status} booking`
        });
      }

      // Get customer details for email notification
      const customer = await User.findById(booking.customer);

      await Booking.findByIdAndDelete(id);
      emitBookingDeleted(id);

      // Invalidate dashboard caches
      try {


      } catch (e) { }

      res.json({
        success: true,
        message: 'Booking deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async deleteUserBooking(req, res) {
    try {
      const { userId, bookingId } = req.params;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const booking = await Booking.findOne({ _id: bookingId, customer: userId });
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found for this user'
        });
      }

      if (['completed', 'cancelled', 'in-progress'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete ${booking.status} booking`
        });
      }

      const service = await Service.findById(booking.services);

      await Booking.findByIdAndDelete(bookingId);
      emitBookingDeleted(bookingId);

      res.json({
        success: true,
        message: 'User booking deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateBookingDateTime(req, res) {
    try {
      const { id } = req.params;
      // Fix: Add null check for req.body before destructuring
      const { date, time } = req.body || {};

      // Validate input
      if (!date && !time) {
        return res.status(400).json({
          success: false,
          message: 'Please provide either date or time to update'
        });
      }

      // Find booking
      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }

      if (!validateBookingTransition(booking.status, 'rescheduled') && booking.status !== 'pending' && booking.status !== 'confirmed') {
        return res.status(400).json({
          success: false,
          message: `Cannot reschedule booking from its current status: ${booking.status}`
        });
      }

      if (['completed', 'in-progress'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot reschedule a ${booking.status} booking.`
        });
      }

      // Validate new date if provided
      if (date) {
        const newDate = new Date(date);
        if (newDate < new Date()) {
          return res.status(400).json({
            success: false,
            message: 'New booking date must be in the future'
          });
        }
        booking.date = newDate;
      }

      // Validate new time if provided
      if (time) {
        if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid time format (use HH:MM)'
          });
        }
        booking.time = time;
      }

      // Save changes
      await booking.save();
      emitBookingUpdate(booking._id, booking, 'rescheduled');

      res.json({
        success: true,
        message: 'Booking date/time updated successfully',
        data: {
          _id: booking._id,
          date: booking.date,
          time: booking.time,
          status: booking.status
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async downloadBookingReport(req, res) {
    try {
      let { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      startDate = new Date(startDate);
      endDate = new Date(endDate);

      // Validate date range (min 7 days, max 2 months)
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 7) {
        return res.status(400).json({ message: "Minimum date range should be 7 days" });
      }

      if (diffDays > 60) {
        return res.status(400).json({ message: "Maximum date range should be 2 months" });
      }

      // Fetch bookings with necessary details
      const bookings = await Booking.find({
        date: { $gte: startDate, $lte: endDate }
      })
        .populate('customer', 'name email phone')
        .populate('provider', 'name area providerId')
        .populate({
          path: 'services.service',
          select: 'title category',
          populate: {
            path: 'category',
            select: 'name'
          }
        })
        .populate('complaint', 'complaintId')
        .lean();

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Booking Report');

      // Columns
      worksheet.columns = [
        { header: 'Booking ID', key: '_id', width: 25 },
        { header: 'Complaint ID', key: 'complaintId', width: 25 },
        { header: 'Booking Date', key: 'date', width: 15 },
        { header: 'Booking Time', key: 'time', width: 10 },
        { header: 'Booking Status', key: 'status', width: 15 },
        { header: 'Confirmed', key: 'confirmedBooking', width: 10 },

        { header: 'Customer Name', key: 'customerName', width: 20 },
        { header: 'Customer Email', key: 'customerEmail', width: 25 },
        { header: 'Customer Phone', key: 'customerPhone', width: 15 },
        { header: 'Customer Address', key: 'customerAddress', width: 30 },

        { header: 'Provider Name', key: 'providerName', width: 20 },
        { header: 'Provider ID', key: 'providerId', width: 15 },
        { header: 'Provider Area', key: 'providerArea', width: 15 },

        { header: 'Service Details', key: 'serviceDetails', width: 40 },

        { header: 'Payment Method', key: 'paymentMethod', width: 10 },
        { header: 'Payment Status', key: 'paymentStatus', width: 10 },
        { header: 'Subtotal', key: 'subtotal', width: 10 },
        { header: 'Total Discount', key: 'totalDiscount', width: 10 },
        { header: 'Total Amount', key: 'totalAmount', width: 10 },
        { header: 'Commission Amount', key: 'commissionAmount', width: 12 },
        { header: 'Provider Earnings', key: 'providerEarnings', width: 12 },

        { header: 'Coupon Code', key: 'couponCode', width: 15 },
        { header: 'Notes / Admin Remark', key: 'notes', width: 30 },
        { header: 'Service Start', key: 'serviceStartedAt', width: 15 },
        { header: 'Service Completed', key: 'serviceCompletedAt', width: 15 }
      ];

      // Add rows
      bookings.forEach(b => {
        const serviceDetails = b.services.map(s => {
          const title = s.service?.title || 'Unknown Service';
          const categoryName = s.service?.category?.name || s.service?.category || 'N/A';
          return `${title} (${categoryName}) x${s.quantity} = ${s.price - s.discountAmount}`;
        }).join('; ');

        worksheet.addRow({
          _id: b.bookingId || b._id.toString(),
          complaintId: b.complaint?.complaintId || '-',
          date: b.date.toISOString().split('T')[0],
          time: b.time,
          status: b.status,
          confirmedBooking: b.confirmedBooking ? 'Yes' : 'No',
          customerName: b.customer?.name || '',
          customerEmail: b.customer?.email || '',
          customerPhone: b.customer?.phone || '',
          customerAddress: `${b.address.street}, ${b.address.city}, ${b.address.state}, ${b.address.postalCode}`,
          providerName: b.provider?.name || '',
          providerId: b.provider?.providerId || '',
          providerArea: b.provider?.area || '',
          serviceDetails,
          paymentMethod: b.paymentMethod,
          paymentStatus: b.paymentStatus,
          subtotal: b.subtotal,
          totalDiscount: b.totalDiscount,
          totalAmount: b.totalAmount,
          commissionAmount: b.commissionAmount,
          providerEarnings: b.providerEarnings,
          couponCode: b.couponApplied?.code || '',
          notes: `${b.notes || ''} ${b.adminRemark || ''}`,
          serviceStartedAt: b.serviceStartedAt ? new Date(b.serviceStartedAt).toLocaleString() : '',
          serviceCompletedAt: b.serviceCompletedAt ? new Date(b.serviceCompletedAt).toLocaleString() : ''
        });
      });

      // Set response headers
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=Booking_Report_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.xlsx`
      );

      // Write workbook to response
      await workbook.xlsx.write(res);
      res.status(200).end();

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

}

module.exports = BookingService;
