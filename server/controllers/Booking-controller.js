const mongoose = require('mongoose');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model');
const CommissionRule = require('../models/CommissionRule-model');
const Coupon = require('../models/Coupon-model');
const Transaction = require('../models/Transaction-model');
const ProviderEarning = require('../models/ProviderEarning-model');
const ExcelJS = require('exceljs');
const { sendNotification, notifyAdmins } = require('../utils/notificationHelper');
const { generateBookingId } = require('../utils/generateUniqueId');
const { getBookingTimeline } = require('../utils/bookingHelper');


// Helper to get synchronized payout status
const getPayoutStatus = (earning, booking) => {
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
};


// Verification & Fraud Helper Functions
const getStartPin = (booking) => {
  if (!booking.statusHistory) return null;
  for (const history of booking.statusHistory) {
    if (history.note) {
      const match = history.note.match(/START_PIN:(\d{4})/);
      if (match) return match[1];
    }
  }
  return null;
};

const getCompletionPin = (booking) => {
  if (!booking.statusHistory) return null;
  for (const history of booking.statusHistory) {
    if (history.note) {
      const match = history.note.match(/COMPLETION_PIN:(\d{4})/);
      if (match) return match[1];
    }
  }
  return null;
};

const ensureAndPersistPins = async (bookingId, bookingObj, session = null) => {
  let startPin = null;
  let completionPin = null;

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

  if (!startPin || !completionPin) {
    if (!startPin) startPin = Math.floor(1000 + Math.random() * 9000).toString();
    if (!completionPin) completionPin = Math.floor(1000 + Math.random() * 9000).toString();

    const BookingModel = mongoose.model('Booking');
    const query = BookingModel.findById(bookingId);
    if (session) {
      query.session(session);
    }
    const dbBooking = await query;
    if (dbBooking) {
      if (dbBooking.statusHistory && dbBooking.statusHistory.length > 0) {
        const firstEntry = dbBooking.statusHistory[0];
        let note = firstEntry.note || '';
        if (!note.includes('START_PIN:')) {
          firstEntry.note = `${note} START_PIN:${startPin} COMPLETION_PIN:${completionPin}`.trim();
        } else {
          const startMatch = note.match(/START_PIN:(\d{4})/);
          const completionMatch = note.match(/COMPLETION_PIN:(\d{4})/);
          const sp = startMatch ? startMatch[1] : startPin;
          const cp = completionMatch ? completionMatch[1] : completionPin;
          firstEntry.note = note.replace(/START_PIN:\d{4}/, `START_PIN:${sp}`).replace(/COMPLETION_PIN:\d{4}/, `COMPLETION_PIN:${cp}`);
          startPin = sp;
          completionPin = cp;
        }
      } else {
        dbBooking.statusHistory = [{
          status: dbBooking.status || 'pending',
          timestamp: new Date(),
          note: `START_PIN:${startPin} COMPLETION_PIN:${completionPin}`,
          updatedBy: 'system'
        }];
      }
      await dbBooking.save({ session });
    }
  }

  return { startPin, completionPin };
};

const getFailedAttempts = (booking) => {
  if (!booking.statusHistory) return 0;
  for (let i = booking.statusHistory.length - 1; i >= 0; i--) {
    if (booking.statusHistory[i].note) {
      const match = booking.statusHistory[i].note.match(/FAILED_ATTEMPTS:(\d+)/);
      if (match) return parseInt(match[1]);
    }
  }
  return 0;
};

const getLockoutTime = (booking) => {
  if (!booking.statusHistory) return null;
  for (let i = booking.statusHistory.length - 1; i >= 0; i--) {
    if (booking.statusHistory[i].note) {
      const match = booking.statusHistory[i].note.match(/LOCKOUT_UNTIL:(\d+)/);
      if (match) return new Date(parseInt(match[1]));
    }
  }
  return null;
};

const recordPinFailure = async (booking, isStart, session = null) => {
  const attempts = getFailedAttempts(booking) + 1;
  const pinType = isStart ? 'START_PIN' : 'COMPLETION_PIN';
  let note = `Failed verification attempt for ${pinType}. FAILED_ATTEMPTS:${attempts}`;

  if (attempts >= 5) {
    const cooldownMs = 15 * 60 * 1000; // 15-minute cooldown
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
};

const resetPinFailures = async (booking, session = null) => {
  booking.statusHistory.push({
    status: booking.status,
    timestamp: new Date(),
    note: `Verification successful. FAILED_ATTEMPTS:0`,
    updatedBy: 'system'
  });
  await booking.save({ session });
};

const getTargetLocation = (booking) => {
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
};

const setTargetLocation = async (booking, latitude, longitude, session = null) => {
  booking.statusHistory.push({
    status: booking.status,
    timestamp: new Date(),
    note: `Target address location recorded. TARGET_LOCATION:${latitude},${longitude}`,
    updatedBy: 'system'
  });
  await booking.save({ session });
};

const getBookingAddressLocation = (booking) => {
  const target = getTargetLocation(booking);
  if (target) return target;

  const address = booking.address || {};
  const lat = parseFloat(address.lat);
  const lng = parseFloat(address.lng);
  if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
    return { latitude: lat, longitude: lng };
  }

  return null;
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // in metres
  return d;
};

const getFraudScore = (booking) => {
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
};

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

const sanitizeStatusHistoryForProvider = (statusHistory) => {
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
};
// USER BOOKING CONTROLLERS

const autoAssignProviderIfEnabled = async (bookingId) => {
  try {
    const { SystemConfig } = require('../models/SystemSetting');
    const settings = await SystemConfig.findOne();

    // Check if auto assign is enabled
    if (!settings || !settings.bookingSettings || !settings.bookingSettings.autoAssignProvider) {
      return null;
    }

    const booking = await Booking.findById(bookingId).populate('services.service');
    // Ensure booking exists and is not already assigned
    if (!booking || booking.provider) {
      return null;
    }

    const maxDistanceKm = settings.bookingSettings.autoAssignRadius || 15;
    const maxDistanceMeters = maxDistanceKm * 1000;

    let lat = booking.address?.lat;
    let lng = booking.address?.lng;

    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      const coords = getBookingAddressLocation(booking);
      lat = coords?.latitude;
      lng = coords?.longitude;
    }

    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      console.warn(`[AutoAssign] Skipped auto-assign for booking ${booking._id}: Coordinates missing`);
      return null;
    }

    const bookingServicesCategories = booking.services.map(item => {
      const cat = item.service?.category;
      return cat?._id ? cat._id.toString() : cat?.toString();
    }).filter(Boolean);

    const { latLngToS2CellId, getNeighbors } = require('../utils/s2Helper');
    let targetCell = booking.address?.s2CellId;
    if (!targetCell) {
      targetCell = latLngToS2CellId(lat, lng, 13);
    }
    const searchCells = [targetCell, ...getNeighbors(targetCell)];

    const query = {
      role: 'provider',
      isActive: true,
      approved: true,
      isOnline: true,
      isSuspended: { $ne: true },
      kycStatus: 'approved',
      $or: [
        { blockedTill: { $exists: false } },
        { blockedTill: null },
        { blockedTill: { $lte: new Date() } }
      ],
      'performanceScore.restrictionsActive': { $ne: true },
      services: { $all: bookingServicesCategories },
      s2CellId: { $in: searchCells }
    };

    const nearbyProviders = await Provider.find(query);

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; // metres
      const φ1 = lat1 * Math.PI / 180;
      const φ2 = lat2 * Math.PI / 180;
      const Δφ = (lat2 - lat1) * Math.PI / 180;
      const Δλ = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // Sort in memory by distance
    const providersWithDistance = nearbyProviders.map(p => {
      const pLng = p.currentLocation?.coordinates?.[0];
      const pLat = p.currentLocation?.coordinates?.[1];
      let dist = Infinity;
      if (typeof pLat === 'number' && typeof pLng === 'number' && (pLat !== 0 || pLng !== 0)) {
        dist = calculateDistance(lat, lng, pLat, pLng);
      }
      return { provider: p, distance: dist };
    }).filter(item => item.distance <= maxDistanceMeters);

    providersWithDistance.sort((a, b) => a.distance - b.distance);

    if (providersWithDistance.length === 0) {
      console.log(`[AutoAssign] No nearby providers found for booking ${booking._id} within ${maxDistanceKm}km (S2 Matchmaking)`);
      return null;
    }

    const nearestProvider = providersWithDistance[0].provider;

    // Auto-assign to nearest provider
    booking.provider = nearestProvider._id;
    booking.status = 'accepted';
    booking.updatedAt = new Date();

    booking.statusHistory.push({
      status: 'accepted',
      timestamp: new Date(),
      note: `Booking auto-assigned to nearest provider: ${nearestProvider.name} (Auto-Assign Mode)`,
      updatedBy: 'system'
    });

    await booking.save();

    try {
      await Provider.findByIdAndUpdate(nearestProvider._id, {
        activeBooking: booking._id,
        lastUpdated: new Date()
      });
    } catch (e) {
      console.error('Error updating provider activeBooking:', e);
    }

    // Sync transaction record
    try {
      const isOnline = booking.paymentMethod?.toLowerCase() === 'online' || booking.paymentMethod?.toLowerCase() === 'upi';
      await Transaction.updateMany(
        { booking: booking._id },
        {
          provider: booking.provider,
          providerId: booking.provider.toString(),
          commission: isOnline ? (booking.commissionAmount * 100) : (booking.commissionAmount || 0),
          providerEarning: isOnline ? (booking.providerEarnings * 100) : (booking.providerEarnings || 0),
          commissionRule: booking.commissionRule,
          ...((booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold') && {
            paymentStatus: isOnline ? 'success' : 'completed'
          })
        }
      );
    } catch (transError) {
      console.error('Error syncing transaction on auto-assign:', transError);
    }

    // Emit live booking socket and notifications
    try {
      await sendNotification(
        booking.customer,
        'customer',
        'Provider Auto-Assigned',
        `Your booking has been auto-assigned to ${nearestProvider.name}. Live tracking started!`,
        'booking',
        booking._id
      );

      await sendNotification(
        nearestProvider._id,
        'provider',
        'New Auto-Assigned Booking',
        `You have been auto-assigned a new booking at ${booking.address?.street || 'your area'}.`,
        'booking',
        booking._id
      );

      const { getIO } = require('../socket/socketServer');
      const io = getIO();
      if (io) {
        io.to(`booking_${booking._id}`).emit('tracking-started', {
          bookingId: booking._id,
          trackingEnabled: true,
          providerLiveLocation: nearestProvider.currentLocation ? {
            lat: nearestProvider.currentLocation.coordinates[1],
            lng: nearestProvider.currentLocation.coordinates[0],
            updatedAt: new Date()
          } : null,
          provider: nearestProvider,
          status: 'accepted'
        });

        io.to('admin_live_room').emit('admin-booking-update', {
          bookingId: booking._id,
          event: 'auto-assigned',
          providerId: nearestProvider._id,
          status: 'accepted'
        });
      }
    } catch (socketErr) {
      console.error('Error sending auto-assign sockets/notifications:', socketErr);
    }

    console.log(`[AutoAssign] Booking ${booking._id} successfully assigned to provider ${nearestProvider.name}`);
    return nearestProvider;

  } catch (error) {
    console.error('Error in autoAssignProviderIfEnabled:', error);
    return null;
  }
};

// Create single service booking
const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

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
      preferredProviderId
    } = req.body;

    // Validate required fields
    if (!serviceId || !date || !address || !paymentMethod) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Service ID, date, address, and payment method are required'
      });
    }

    // Validate payment method
    if (!['online', 'cash', 'wallet', 'mixed'].includes(paymentMethod)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Payment method must be either "online", "cash", "wallet" or "mixed"'
      });
    }

    // Check if service exists
    const service = await Service.findById(serviceId).session(session);
    if (!service) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Validate date
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Smart rules: Rebook validation
    if (isRebook && originalBooking) {
      const oldBooking = await Booking.findById(originalBooking).session(session);
      if (!oldBooking) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Original booking not found'
        });
      }

      // Rebook allowed only if previous booking is completed and not cancelled
      if (oldBooking.status !== 'completed' || oldBooking.status === 'cancelled') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Rebooking is only allowed for completed services'
        });
      }
    }

    // Smart rules: Favorite provider validation
    let assignedProviderId = null;
    if (isFavoriteProviderBooking && preferredProviderId) {
      const providerDoc = await Provider.findById(preferredProviderId).session(session);
      if (!providerDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Preferred provider not found'
        });
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
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Provider unavailable'
        });
      }

      assignedProviderId = providerDoc._id;
    }

    // Calculate amounts
    let subtotal = service.basePrice * quantity;
    let totalDiscount = 0;
    let couponDetails = null;

    // Process coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode }).session(session);
      if (!coupon) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Invalid coupon code'
        });
      }

      // Validate coupon correctly (since usedBy is an array of objects)
      const alreadyUsed = coupon.usedBy.some(usage => usage.user && usage.user.toString() === req.user._id.toString());
      if (alreadyUsed) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Coupon already used by this user'
        });
      }

      const now = new Date();
      if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Coupon has expired'
        });
      }

      if (coupon.minBookingValue && subtotal < coupon.minBookingValue) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Minimum order value of ${coupon.minBookingValue} required for this coupon`
        });
      }

      // Calculate discount
      let discount = 0;
      if (coupon.discountType === 'percent') {
        discount = (subtotal * coupon.discountValue) / 100;
      } else {
        discount = coupon.discountValue;
      }

      totalDiscount = discount;
      couponDetails = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      };
    }

    const totalAmount = subtotal - totalDiscount;

    // CHECK FOR DUPLICATE BOOKING (Idempotency)
    const existingBooking = await Booking.findOne({
      customer: req.user._id,
      'services.service': serviceId,
      date: bookingDate,
      time: time || null,
      totalAmount: totalAmount,
      status: { $nin: ['cancelled'] },
      paymentStatus: { $in: ['pending', 'processing'] }
    }).session(session);

    if (existingBooking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        message: 'Existing booking found. Returning current booking.',
        data: existingBooking.toObject(),
        bookingId: existingBooking.bookingId || existingBooking._id,
        _id: existingBooking._id,
        isDuplicate: true
      });
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
        price: service.basePrice,
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
      status: paymentMethod === 'cash' ? (assignedProviderId ? 'accepted' : 'pending') : 'pending',
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'processing',
      confirmedBooking: paymentMethod === 'cash',
      statusHistory: [{
        status: paymentMethod === 'cash' ? (assignedProviderId ? 'accepted' : 'pending') : 'pending',
        timestamp: new Date(),
        note: assignedProviderId
          ? `Booking created with preferred provider. START_PIN:${startPin} COMPLETION_PIN:${completionPin}`
          : `Booking created. START_PIN:${startPin} COMPLETION_PIN:${completionPin}`,
        updatedBy: 'customer'
      }],
      metadata: {
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      }
    });

    // Save booking
    await booking.save({ session });

    // Link active booking if directly assigned with cash payment
    if (paymentMethod === 'cash' && assignedProviderId) {
      await Provider.findByIdAndUpdate(assignedProviderId, {
        activeBooking: booking._id,
        lastUpdated: new Date()
      }).session(session);
    }

    // If paymentMethod is cash, create a transaction record
    if (paymentMethod === 'cash') {
      const Transaction = mongoose.model('Transaction');
      const transaction = new Transaction({
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
      await transaction.save({ session });
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
      await coupon.save({ session });

      if (coupon.isFirstBooking) {
        await User.findByIdAndUpdate(req.user._id, {
          $set: { firstBookingUsed: true }
        }, { session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Booking created successfully. Please confirm payment to complete booking.',
      data: booking.toObject(),
      bookingId: booking.bookingId,
      _id: booking._id
    });

    // Trigger auto-assignment if booking is confirmed immediately (cash payment method)
    if (paymentMethod === 'cash') {
      autoAssignProviderIfEnabled(booking._id);
    }

    // Real-time notification (non-blocking)
    try {
      // Notify provider about new booking request
      if (booking.provider) {
        const providerDoc = await Provider.findById(booking.provider).select('_id').lean();
        if (providerDoc?._id) {
          sendNotification(
            providerDoc._id,
            'provider',
            'New Booking Request',
            `You have a new booking request for ${booking.services?.[0]?.title || 'a service'}.`,
            'booking',
            booking._id
          );
        }
      }
    } catch (e) { /* ignore notification errors */ }

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Confirm booking and process payment 
const confirmBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fix: Add null check for req.body before destructuring
    const { bookingId, paymentMethod, paymentDetails } = req.body || {};
    const userId = req.user._id;

    // Validate required fields
    if (!bookingId || !paymentMethod) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Booking ID and payment method are required'
      });
    }

    // Find booking with all necessary data
    const booking = await Booking.findOne({
      _id: bookingId,
      customer: userId
    })
      .populate('services.service')
      .session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check booking status
    if (booking.confirmedBooking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Booking is already confirmed'
      });
    }

    if (booking.status === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Cannot confirm a cancelled booking'
      });
    }

    // Process payment
    let paymentResult;
    switch (paymentMethod) {
      case 'online':
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Direct online processing is deprecated. Please use the secure Razorpay payment flow via /api/transaction/create-order'
        });

      case 'wallet': {
        const userWallet = await User.findById(userId).session(session);
        const bal = userWallet.wallet?.availableBalance || 0;
        if (bal < booking.totalAmount) {
          await session.abortTransaction();
          session.endSession();
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
        break;
      }

      case 'mixed': {
        const userMixed = await User.findById(userId).session(session);
        const walletBal = userMixed.wallet?.availableBalance || 0;

        if (walletBal <= 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'No wallet balance available for mixed payment. Please use online payment.'
          });
        }

        const walletDeduction = Math.min(walletBal, booking.totalAmount);
        const remainingAmount = booking.totalAmount - walletDeduction;

        if (remainingAmount > 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            isMixedRequired: true,
            message: 'Partial wallet balance applied. Please complete the remaining payment via Razorpay.',
            data: {
              walletDeduction,
              remainingAmount
            }
          });
        } else {
          // Full coverage by wallet
          userMixed.wallet.availableBalance -= walletDeduction;
          userMixed.wallet.walletTransactions.push({
            type: 'debit',
            amount: walletDeduction,
            reason: 'Booking Payment',
            booking: booking._id
          });
          userMixed.wallet.lastUpdated = new Date();
          await userMixed.save({ session });

          paymentResult = {
            success: true,
            transactionId: `TXN-WLT-${Date.now()}`,
            paymentStatus: 'paid'
          };
        }
        break;
      }

      case 'cash':
        // Cash payment - just record it
        paymentResult = {
          success: true,
          paymentStatus: 'pending'
        };
        break;

      default:
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Invalid payment method'
        });
    }

    if (!paymentResult.success) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: paymentResult.message || 'Payment failed'
      });
    }

    // Update booking status
    booking.paymentMethod = paymentMethod;
    booking.paymentStatus = paymentResult.paymentStatus || 'paid';
    booking.status = 'pending';
    booking.confirmedBooking = true;

    // Update or create transaction
    const transaction = await Transaction.findOneAndUpdate(
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
      { new: true, upsert: true, session }
    );

    await booking.save({ session });

    // Link active booking for provider if assigned
    if (booking.provider) {
      await Provider.findByIdAndUpdate(booking.provider, {
        activeBooking: booking._id,
        lastUpdated: new Date()
      }).session(session);
    }

    // Increment user's total bookings
    await User.findByIdAndUpdate(userId, { $inc: { totalBookings: 1 } }, { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: {
        booking,
        transaction
      }
    });

    // Trigger auto-assignment upon successful online or wallet payment confirmation
    autoAssignProviderIfEnabled(booking._id);

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error confirming booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm booking',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};



// Update booking status
const updateBookingStatus = async (req, res) => {
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
};

// Get user bookings
const getUserBookings = async (req, res) => {
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

    // Get total count for pagination
    const totalBookings = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
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
        select: 'name email phone completedBookings performanceScore providerId'
      })
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .lean();

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
        const pStatus = getPayoutStatus(earning, bookingObj);
        bookingObj.payoutStatus = pStatus;

        // Ensure and persist PINs, then attach based on visibility rules
        const { startPin, completionPin } = await ensureAndPersistPins(bookingObj._id, bookingObj);
        if (bookingObj.status === 'accepted' || bookingObj.status === 'scheduled') {
          bookingObj.startPin = startPin;
        } else if (bookingObj.status === 'in-progress') {
          bookingObj.completionPin = completionPin;
        }

        bookingObj.timeline = getBookingTimeline(bookingObj, pStatus);

        return bookingObj;
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
};

// Get customer bookings (alias for getUserBookings to match frontend requirements)
const getCustomerBookings = async (req, res) => {
  return getUserBookings(req, res);
};

// Update booking payment method and status
const updateBookingPayment = async (req, res) => {
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
};

// Convert COD to Online Payment
const payBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { paymentDetails } = req.body;
    const userId = req.user._id;

    const booking = await Booking.findOne({ _id: id, customer: userId }).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['in-progress', 'in_progress', 'completed', 'cancelled'].includes(booking.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Cannot pay for a booking that is in progress, completed, or cancelled' });
    }

    if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Booking already paid' });
    }

    let paymentResult;
    if (paymentDetails?.paymentMethod === 'wallet') {
      const userWallet = await User.findById(userId).session(session);
      if (!userWallet.wallet) {
        userWallet.wallet = { availableBalance: 0, walletTransactions: [], totalRefunded: 0, lastUpdated: new Date() };
      }
      const bal = userWallet.wallet.availableBalance || 0;
      if (bal < booking.totalAmount || booking.totalAmount <= 0) {
        await session.abortTransaction();
        session.endSession();
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
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Razorpay payment details are required' });
      }

      // Verify Razorpay signature
      const crypto = require('crypto');
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }

      const userMixed = await User.findById(userId).session(session);
      const walletBal = userMixed.wallet?.availableBalance || 0;
      const walletDeduction = Math.min(walletBal, booking.totalAmount);

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
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Razorpay payment details are required' });
      }

      // Verify Razorpay signature
      const crypto = require('crypto');
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        await session.abortTransaction();
        session.endSession();
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
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid payment method' });
    }

    if (!paymentResult.success) {
      await session.abortTransaction();
      session.endSession();
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

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Payment successful',
      data: booking
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error in payBooking:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to process payment' });
  }
};

// Get provider details by ID
const getProviderById = async (req, res) => {
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
};

// Get service details by ID
const getServiceById = async (req, res) => {
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
};

// Get single booking
const getBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('services.service', 'title description basePrice category images duration')
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone businessName contactPerson rating address currentLocation isOnline profilePicUrl performanceScore completedBookings')
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

    bookingObj.payoutStatus = getPayoutStatus(earning, bookingObj);

    // Ensure and persist PINs, then attach based on visibility rules
    const { startPin, completionPin } = await ensureAndPersistPins(bookingObj._id, bookingObj);
    if (bookingObj.status === 'accepted' || bookingObj.status === 'scheduled') {
      bookingObj.startPin = startPin;
    } else if (bookingObj.status === 'in-progress') {
      bookingObj.completionPin = completionPin;
    }

    bookingObj.timeline = getBookingTimeline(bookingObj, bookingObj.payoutStatus);

    res.status(200).json({
      success: true,
      message: 'Booking details retrieved successfully',
      data: bookingObj
    });

  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch booking details'
    });
  }
};

// Fraud helper for booking cancellations
const logCancellationFraud = async (req, booking, userId, role) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    // Calculate dynamic risk parameters
    const userCancellations = await mongoose.model('Booking').countDocuments({
      customer: booking.customer,
      status: 'cancelled',
      'cancellationProgress.cancelledAt': { $gte: oneDayAgo }
    });

    let providerCancellations = 0;
    if (booking.provider) {
      providerCancellations = await mongoose.model('Booking').countDocuments({
        provider: booking.provider,
        status: 'cancelled',
        'cancellationProgress.cancelledAt': { $gte: oneDayAgo }
      });
    }

    const FraudLog = require('../models/FraudLog-model');
    const networkCancellations = await FraudLog.countDocuments({
      $or: [
        { ip: req.clientIp },
        { device: req.deviceFingerprint }
      ],
      actionType: 'cancellation',
      createdAt: { $gte: oneDayAgo }
    });

    const isImmediate = (now - new Date(booking.createdAt)) <= 5 * 60 * 1000;
    let immediateCount = 0;
    if (isImmediate) {
      const pastBookings = await mongoose.model('Booking').find({
        customer: booking.customer,
        status: 'cancelled'
      }).lean();

      for (const pb of pastBookings) {
        const pbCreated = new Date(pb.createdAt);
        const pbCancelled = pb.cancellationProgress?.cancelledAt ? new Date(pb.cancellationProgress.cancelledAt) : null;
        if (pbCancelled && (pbCancelled - pbCreated) <= 5 * 60 * 1000) {
          immediateCount++;
        }
      }
    }

    let fraudScore = 0;
    let reasons = [];

    if (userCancellations >= 3) {
      fraudScore += 30;
      reasons.push(`${userCancellations} user cancellations in 24h`);
    }
    if (providerCancellations >= 3) {
      fraudScore += 35;
      reasons.push(`${providerCancellations} provider cancellations in 24h`);
    }
    if (networkCancellations >= 5) {
      fraudScore += 25;
      reasons.push(`${networkCancellations} network cancellations in 24h`);
    }
    if (isImmediate && immediateCount >= 2) {
      fraudScore += 40;
      reasons.push('Repeated immediate post-booking cancellations');
    }

    let riskLevel = 'LOW';
    if (fraudScore >= 70) {
      riskLevel = 'HIGH';
    } else if (fraudScore >= 40) {
      riskLevel = 'MEDIUM';
    }

    // Cooldown check
    const recentLog = await FraudLog.findOne({
      userId,
      actionType: 'cancellation',
      createdAt: { $gte: new Date(Date.now() - 5 * 1000) }
    });

    if (!recentLog) {
      const { trackEvent } = require('../middlewares/fraud-middleware');
      await trackEvent({
        req,
        actionType: 'cancellation',
        userId,
        userModel: role === 'customer' ? 'User' : 'Provider',
        role,
        bookingId: booking._id,
        fraudScore,
        riskLevel,
        flagReason: reasons.join(', ') || 'Normal booking cancellation'
      });
    }
  } catch (err) {
    console.error('logCancellationFraud error:', err);
  }
};

// Cancel booking with e-commerce style progress tracking
const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    // Handle cases where req.body might be undefined or empty
    const { reason } = req.body || {}; // Optional cancellation reason
    const userId = req.user.id;

    const booking = await Booking.findOne({ _id: id, customer: userId }).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'completed') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed booking. Please file a complaint for refund requests.'
      });
    }

    if (booking.status === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    // --- NEW STRICT EARNING STATUS CHECKS ---
    const earning = await ProviderEarning.findOne({ booking: booking._id }).session(session);
    if (earning && (earning.status === 'available' || earning.status === 'withdrawn' || earning.status === 'paid')) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Cancellation with automatic refund is blocked because the payout is already ${earning.status}. Please contact support.`
      });
    }

    const previousStatus = booking.status;
    const isStarted = !!booking.serviceStartedAt;
    let refundDetails = null;

    if (isStarted) {
      // CASE 2: After serviceStartedAt but before completed
      booking.status = 'cancelled';
      if (global.logger) global.logger.warn(`Booking cancelled: ${booking._id}`);

      booking.disputeRaised = true;
      if (global.logger) global.logger.warn(`Dispute raised for booking: ${booking._id}`);

      booking.disputeStatus = 'pending';
      booking.cancellationProgress.status = 'cancelled';
      booking.cancellationProgress.reason = reason || 'Customer requested cancellation after start';
      booking.cancellationProgress.cancelledAt = new Date();

      await booking.save({ session });

      // Update provider stats if booking was already accepted
      if (booking.provider) {
        await Provider.findByIdAndUpdate(booking.provider, {
          $inc: { canceledBookings: 1 }
        }, { session });
        await recalculateProviderPerformance(booking.provider, session);
      }

      await session.commitTransaction();
      session.endSession();

      // Track cancellation fraud in background (non-blocking)
      logCancellationFraud(req, booking, userId, 'customer');

      // Notify customer that it's under review
      try {
        sendNotification(
          userId,
          'customer',
          'Cancellation Under Review',
          `Your cancellation for booking ${booking._id} is under review for refund as the service had already started.`,
          'refund_processing',
          booking._id
        );
      } catch (err) { }

      // Notify Admin
      try {
        notifyAdmins(
          'Refund Dispute Raised',
          `Booking ${booking._id} was cancelled after service started. Admin review required for refund.`,
          'dispute',
          booking._id
        );
      } catch (err) { }

      return res.json({
        success: true,
        message: 'Booking cancelled. Since the service had already started, a refund dispute has been raised for admin review.',
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
        const refundAmount = booking.totalAmount - previouslyRefunded;

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

          // Full refund to wallet
          const user = await User.findById(userId).session(session);
          if (!user.wallet) {
            user.wallet = { availableBalance: 0, totalRefunded: 0, lastUpdated: new Date() };
          }
          user.wallet.availableBalance += refundAmount;
          user.wallet.totalRefunded += refundAmount;
          user.wallet.walletTransactions.push({
            type: 'credit',
            amount: refundAmount,
            reason: 'Booking Refund',
            booking: booking._id
          });
          user.wallet.lastUpdated = new Date();
          await user.save({ session });

          // Create transaction record for audit
          const refundTransaction = new Transaction({
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
          $inc: { canceledBookings: 1 }
        }, { session });
        await recalculateProviderPerformance(booking.provider, session);
      }

      await session.commitTransaction();
      session.endSession();

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
    await session.abortTransaction();
    session.endSession();

    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel booking'
    });
  }
};

// User - Update Booking Date/Time (with restrictions)
const userUpdateBookingDateTime = async (req, res) => {
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
};




// PROVIDER CONTROLLERS

/**
 * @desc    Get a single booking by ID for provider
 * @route   GET /api/providers/bookings/:id
 * @access  Private/Provider
 */
const getProviderBookingById = async (req, res) => {
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
      .select('services performanceScore')
      .lean();

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId
    );

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
      .populate('customer', 'name email phone createdAt')
      .populate('services.service', 'title description duration price')
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not available for this provider'
      });
    }

    // Fetch earning and transaction details
    const earning = await ProviderEarning.findOne({ booking: id }).lean();
    const transactions = await Transaction.find({ booking: id }).sort({ createdAt: -1 }).lean();

    const { commission, netAmount } = CommissionRule.calculateCommission(
      booking.totalAmount,
      commissionRule
    );

    const cleanBooking = { ...booking };
    if (cleanBooking.statusHistory) {
      cleanBooking.statusHistory = sanitizeStatusHistoryForProvider(cleanBooking.statusHistory);
    }

    const responseData = {
      ...cleanBooking,
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
      payoutStatus: getPayoutStatus(earning, cleanBooking),
      earningDetails: earning,
      refundData: cleanBooking.cancellationProgress,
      transactions: transactions
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get all bookings for a provider by status
 * @route   GET /api/providers/bookings/status/:status
 * @access  Private/Provider
 */
const getBookingsByStatus = async (req, res) => {
  try {
    const providerId = req.provider._id;
    let { status } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Handle status mapping - convert frontend camelCase to backend kebab-case
    const statusMapping = {
      'inProgress': 'in-progress'
    };

    // Apply status mapping if needed
    if (statusMapping[status]) {
      status = statusMapping[status];
    }

    const validStatuses = ['pending', 'accepted', 'completed', 'cancelled', 'in-progress', 'scheduled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status parameter'
      });
    }

    const provider = await Provider.findById(providerId)
      .select('services performanceScore')
      .lean();

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId
    );

    const servicesInCategory = await Service.find({
      category: { $in: provider.services }
    }).select('_id').lean();

    const serviceIds = servicesInCategory.map(s => s._id);

    let query;
    if (status === 'pending') {
      query = {
        'services.service': { $in: serviceIds },
        $or: [
          { status: 'pending' },
          { status: 'scheduled', paymentMethod: 'cash' }
        ],
        $and: [
          {
            $or: [
              { provider: { $exists: false } },
              { provider: providerId }
            ]
          }
        ]
      };
    } else {
      query = {
        status,
        provider: providerId,
        'services.service': { $in: serviceIds }
      };
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'name email phone')
      .populate('services.service', 'title price duration category')
      .sort({ date: 1, time: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const bookingsWithCommission = bookings.map(booking => {
      const cleanBooking = { ...booking };
      if (cleanBooking.statusHistory) {
        cleanBooking.statusHistory = sanitizeStatusHistoryForProvider(cleanBooking.statusHistory);
      }

      const { commission, netAmount } = CommissionRule.calculateCommission(
        cleanBooking.totalAmount,
        commissionRule
      );

      return {
        ...cleanBooking,
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
        providerCommissionRate: commissionRule ? commissionRule.value : 0
      };
    });

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
};

/**
 * @desc    Accept a booking
 * @route   PUT /api/bookings/:id/accept
 * @access  Private/Provider
 */
const acceptBooking = async (req, res) => {
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

    // Check if provider exists and get their services and status
    const provider = await Provider.findById(providerId).select('services name isSuspended blockedTill performanceScore');
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Check if provider is suspended, blocked or restricted
    if (provider.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account is suspended. You cannot accept bookings.'
      });
    }

    if (provider.blockedTill && new Date(provider.blockedTill) > new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Your account is blocked. You cannot accept bookings.'
      });
    }

    if (provider.performanceScore?.restrictionsActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is restricted from accepting new bookings.'
      });
    }

    // Find the booking that matches
    const booking = await Booking.findOne({
      _id: id,
      status: { $in: ['pending', 'scheduled'] },
      $or: [
        { provider: { $exists: false } },
        { provider: providerId }
      ]
    }).populate('services.service', 'category');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not available for acceptance'
      });
    }

    // Verify provider can service this booking
    const canService = booking.services.every(serviceItem =>
      provider.services.includes(serviceItem.service.category)
    );

    if (!canService) {
      return res.status(403).json({
        success: false,
        message: 'Provider is not qualified for all services in this booking'
      });
    }

    // Validate time format if provided
    if (time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format (use HH:MM)'
      });
    }

    // Update booking status to accepted
    booking.status = 'accepted';
    booking.provider = providerId;
    if (time) booking.time = time;
    booking.updatedAt = new Date();

    // Add to status history
    booking.statusHistory.push({
      status: 'accepted',
      timestamp: new Date(),
      note: `Booking accepted by provider: ${provider.name}`,
      updatedBy: 'provider'
    });

    await booking.save();

    // Sync transaction record with the new provider and calculated commission
    try {
      const isOnline = booking.paymentMethod?.toLowerCase() === 'online' || booking.paymentMethod?.toLowerCase() === 'upi';
      await Transaction.updateMany(
        { booking: booking._id },
        {
          provider: booking.provider,
          providerId: booking.provider.toString(),
          commission: isOnline ? (booking.commissionAmount * 100) : (booking.commissionAmount || 0),
          providerEarning: isOnline ? (booking.providerEarnings * 100) : (booking.providerEarnings || 0),
          commissionRule: booking.commissionRule,
          // Sync payment status if booking is already paid
          ...((booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold') && {
            paymentStatus: isOnline ? 'success' : 'completed'
          })
        }
      );
    } catch (transError) {
      console.error('Error syncing transaction on booking acceptance:', transError);
    }

    // Populate booking details for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('services.service', 'title description price');


    // Real-time notification for customer
    try {
      if (populatedBooking.customer) {
        await sendNotification(
          populatedBooking.customer._id,
          'customer',
          'Booking Accepted',
          `Your booking for ${populatedBooking.services[0].service.title} has been accepted by ${provider.name}.`,
          'booking',
          booking._id
        );
      }
    } catch (fcmError) {
      console.error('FCM Notification Error (Booking Accepted):', fcmError);
    }

    // Invalidate dashboard caches
    try {


    } catch (e) { }

    return res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: {
        ...populatedBooking.toObject(),
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod
      }
    });

  } catch (error) {
    console.error('Error accepting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while accepting booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Start a booking (change status from accepted to in-progress)
 * @route   PATCH /api/booking/provider/:id/start
 * @access  Private/Provider
 */
const startBooking = async (req, res) => {
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
      status: 'accepted'
    }).populate('customer', 'name email phone')
      .populate('services.service', 'title description');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not available to start'
      });
    }

    // STEP 4 — PAYMENT BEFORE SERVICE START (Accepts either paid or escrow_hold)
    if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'escrow_hold') {
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
    const lockoutTime = getLockoutTime(booking);
    if (lockoutTime && lockoutTime > new Date()) {
      const remainingMinutes = Math.ceil((lockoutTime - new Date()) / (60 * 1000));
      return res.status(403).json({
        success: false,
        message: `Too many failed attempts. Verification is locked. Try again in ${remainingMinutes} minutes.`
      });
    }

    // 3. Verify START PIN
    const { startPin } = await ensureAndPersistPins(booking._id, booking);
    if (pin !== startPin) {
      await recordPinFailure(booking, true);
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

    const targetLoc = getBookingAddressLocation(booking);
    if (!targetLoc) {
      return res.status(400).json({
        success: false,
        message: 'Booking address has no GPS coordinates. Ask customer to pin exact location on map.'
      });
    }

    if (!getTargetLocation(booking)) {
      await setTargetLocation(booking, targetLoc.latitude, targetLoc.longitude);
    }

    const distance = calculateDistance(providerLat, providerLng, targetLoc.latitude, targetLoc.longitude);

    // Dual-Layer S2 Precise Geofencing Verification (Level 20)
    const { latLngToS2CellId, getNeighbors, getLevel } = require('../utils/s2Helper');
    const providerS2Precise = latLngToS2CellId(providerLat, providerLng, 20);
    let targetS2Precise = booking.address?.s2CellIdPrecise;
    if (!targetS2Precise || targetS2Precise.length !== 16 || getLevel(BigInt('0x' + targetS2Precise)) !== 20) {
      targetS2Precise = latLngToS2CellId(targetLoc.latitude, targetLoc.longitude, 20);
    }
    const acceptableCells = [targetS2Precise, ...getNeighbors(targetS2Precise)];
    if (!acceptableCells.includes(providerS2Precise)) {
      await createFraudLog(booking, 'failed_login', `S2 Geofence mismatch during start verification: Provider at ${providerLat}, ${providerLng} (Cell: ${providerS2Precise}) but target at ${targetLoc.latitude}, ${targetLoc.longitude} (Cell: ${targetS2Precise})`, 25, req);

      booking.statusHistory.push({
        status: booking.status,
        timestamp: new Date(),
        note: `S2 Geofencing verification failed. Provider Cell: ${providerS2Precise}, Target Cell: ${targetS2Precise}.`,
        updatedBy: 'system'
      });
      await booking.save();

      return res.status(400).json({
        success: false,
        message: `S2 Geofencing verification failed. You are outside the precise geofence boundary of the service location.`
      });
    }

    if (distance > 150) {
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
    await resetPinFailures(booking);

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
      note: 'Work proof submitted. Service started. Verification successful. FAILED_ATTEMPTS:0',
      updatedBy: 'provider'
    });

    await booking.save();

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
};

/**
 * @desc    Reject a booking
 * @route   PATCH /api/booking/provider/:id/reject
 * @access  Private/Provider
 */
const rejectBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const providerId = req.provider._id;
    const { reason } = req.body || {};

    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Find the booking
    const booking = await Booking.findOne({
      _id: id,
      status: 'pending',
      $or: [
        { provider: { $exists: false } },
        { provider: providerId }
      ]
    }).session(session)
      .populate('customer')
      .populate('services.service', 'title description');

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not available for rejection'
      });
    }

    const previousStatus = booking.status;

    // Update booking status to cancelled
    booking.status = 'cancelled';
    booking.rejectedBy = providerId;
    booking.rejectionReason = reason || 'Provider declined';
    booking.rejectedAt = new Date();
    booking.updatedAt = new Date();

    let refundAmount = 0;
    let refundDetails = null;

    // Rollback any pending payment transaction wallet deduction
    const Transaction = mongoose.model('Transaction');
    const pendingTxn = await Transaction.findOne({ booking: booking._id, paymentStatus: 'pending' }).session(session);
    if (pendingTxn) {
      const { rollbackWalletDeduction } = require('./Transaction-controller');
      if (rollbackWalletDeduction) {
        await rollbackWalletDeduction(pendingTxn, session);
      }
      pendingTxn.paymentStatus = 'failed';
      pendingTxn.description = (pendingTxn.description || '') + ' (Cancelled due to provider booking rejection)';
      await pendingTxn.save({ session });
    }

    // Handle refund if paid
    if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold') {
      refundAmount = booking.totalAmount;

      if (refundAmount > 0) {
        // Find existing successful transaction
        const existingTxn = await Transaction.findOneAndUpdate(
          { booking: booking._id, paymentStatus: { $in: ['completed', 'paid', 'success', 'escrow_hold'] }, refundStatus: { $ne: 'completed' } },
          {
            refundStatus: 'completed',
            refundReason: reason || 'Provider rejected booking',
            refundedAt: new Date(),
            paymentStatus: 'refunded',
            refundedAmount: refundAmount
          },
          { session, new: true }
        );

        if (!existingTxn) {
          console.warn(`[Refund Engine] Duplicate or invalid provider rejection refund attempt for booking ${booking._id}`);
          throw new Error('Transaction already refunded or not found.');
        }

        // Update customer wallet
        const customer = await User.findById(booking.customer._id).session(session);
        if (customer) {
          if (!customer.wallet) {
            customer.wallet = { availableBalance: 0, totalRefunded: 0, lastUpdated: new Date() };
          }
          customer.wallet.availableBalance += refundAmount;
          customer.wallet.totalRefunded += refundAmount;
          customer.wallet.walletTransactions.push({
            type: 'credit',
            amount: refundAmount,
            reason: `Booking Rejected by Provider: ${reason || 'Provider declined'}`,
            booking: booking._id
          });
          customer.wallet.lastUpdated = new Date();
          await customer.save({ session });
        }

        // Create transaction record for audit
        const refundTransaction = new Transaction({
          booking: booking._id,
          bookingId: booking.bookingId || booking._id.toString(),
          user: booking.customer._id,
          amount: refundAmount,
          paymentStatus: 'completed',
          paymentMethod: 'wallet',
          type: 'refund',
          description: `Provider rejected booking - Automatic refund to wallet: ${reason || 'Provider declined'}`,
          refundReason: reason || 'Provider rejected booking'
        });
        await refundTransaction.save({ session });

        booking.paymentStatus = 'refunded';

        refundDetails = {
          amount: refundAmount,
          method: 'wallet',
          status: 'completed'
        };
      }
    }

    await booking.save({ session });

    // Recalculate provider stats and trust score dynamically inside the same transaction session
    await recalculateProviderPerformance(providerId, session);

    await session.commitTransaction();
    session.endSession();

    // Track cancellation fraud in background (non-blocking)
    logCancellationFraud(req, booking, providerId, 'provider');

    res.status(200).json({
      success: true,
      message: booking.paymentStatus === 'refunded'
        ? 'Booking rejected successfully and customer was fully refunded to wallet.'
        : 'Booking rejected successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        rejectionReason: booking.rejectionReason,
        rejectedAt: booking.rejectedAt,
        refundDetails
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error rejecting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while rejecting booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



/**
 * @desc    Complete a booking
 * @route   PATCH /api/booking/provider/:id/complete
 * @access  Private/Provider
 */
const completeBooking = async (req, res) => {
  const { id } = req.params;
  const providerId = req.provider._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const provider = await Provider.findById(providerId)
      .select('name email performanceTier wallet completedBookings performanceScore')
      .session(session);

    if (!provider) throw new Error('Provider not found');

    // Map provider performanceScore stats to a tier for commission rule selection
    const stats = provider.performanceScore || { rating: 0, onTimePercentage: 0, completionPercentage: 0 };
    const avgScore = (stats.rating * 20 + (stats.onTimePercentage || 0) + (stats.completionPercentage || 0)) / 3;

    let performanceTier = 'standard';
    if (avgScore >= 80) performanceTier = 'premium';
    else if (avgScore < 40) performanceTier = 'basic';

    // Get commission rule for provider
    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId,
      performanceTier
    );

    if (!commissionRule) {
      throw new Error('No active commission rule found for this provider. Cannot complete booking.');
    }

    const booking = await Booking.findOne({
      _id: id,
      provider: providerId,
      status: 'in-progress'
    }).populate('customer', '_id name').session(session);

    if (!booking) {
      const currentBooking = await Booking.findById(id).select('status commissionProcessed').lean();

      if (currentBooking && currentBooking.status === 'completed') {
        await session.commitTransaction();
        session.endSession();
        return res.json({
          success: true,
          message: 'Booking already completed.'
        });
      }
      throw new Error('Booking must be In Progress before it can be completed.');
    }

    // Prevent duplicate commission
    if (booking.commissionProcessed) {
      await session.commitTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: 'Commission already processed for this booking.'
      });
    }

    // Handle after-work proof images (Required: min 1)
    if (!req.files || req.files.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Completion proof images are required before completing service'
      });
    }

    const { latitude, longitude, pin } = req.body;

    // 1. Check PIN presence
    if (!pin) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Completion verification PIN is required to complete the service'
      });
    }

    // 2. Check Lockout Cooldown
    const lockoutTime = getLockoutTime(booking);
    if (lockoutTime && lockoutTime > new Date()) {
      const remainingMinutes = Math.ceil((lockoutTime - new Date()) / (60 * 1000));
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: `Too many failed attempts. Verification is locked. Try again in ${remainingMinutes} minutes.`
      });
    }

    // 3. Verify COMPLETION PIN
    const { completionPin } = await ensureAndPersistPins(booking._id, booking, session);
    if (pin !== completionPin) {
      await recordPinFailure(booking, false, session);
      await createFraudLog(booking, 'failed_login', `Incorrect COMPLETION PIN entered: ${pin}`, 15, req);

      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid verification PIN'
      });
    }

    // 4. Verify Coordinates
    if (!latitude || !longitude) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'GPS coordinates are required to complete the service'
      });
    }

    const providerLat = parseFloat(latitude);
    const providerLng = parseFloat(longitude);

    const targetLoc = getBookingAddressLocation(booking);
    if (!targetLoc) {
      return res.status(400).json({
        success: false,
        message: 'Booking address has no GPS coordinates for completion verification.'
      });
    }

    const distance = calculateDistance(providerLat, providerLng, targetLoc.latitude, targetLoc.longitude);

    // Dual-Layer S2 Precise Geofencing Verification (Level 20)
    const { latLngToS2CellId, getNeighbors, getLevel } = require('../utils/s2Helper');
    const providerS2Precise = latLngToS2CellId(providerLat, providerLng, 20);
    let targetS2Precise = booking.address?.s2CellIdPrecise;
    if (!targetS2Precise || targetS2Precise.length !== 16 || getLevel(BigInt('0x' + targetS2Precise)) !== 20) {
      targetS2Precise = latLngToS2CellId(targetLoc.latitude, targetLoc.longitude, 20);
    }
    const acceptableCells = [targetS2Precise, ...getNeighbors(targetS2Precise)];
    if (!acceptableCells.includes(providerS2Precise)) {
      await createFraudLog(booking, 'failed_login', `S2 Geofence mismatch during completion verification: Provider at ${providerLat}, ${providerLng} (Cell: ${providerS2Precise}) but target at ${targetLoc.latitude}, ${targetLoc.longitude} (Cell: ${targetS2Precise})`, 25, req);

      booking.statusHistory.push({
        status: booking.status,
        timestamp: new Date(),
        note: `S2 Geofencing verification failed. Provider Cell: ${providerS2Precise}, Target Cell: ${targetS2Precise}.`,
        updatedBy: 'system'
      });
      await booking.save({ session });

      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `S2 Geofencing verification failed. You are outside the precise geofence boundary of the service location.`
      });
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

      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Geofencing verification failed. You must be within 300 meters of the service location. Current distance: ${Math.round(distance)}m`
      });
    }

    // Reset failures on success
    await resetPinFailures(booking, session);

    const afterImages = req.files.map(file => ({
      url: file.path || file.secure_url,
      uploadedAt: new Date()
    }));

    booking.providerWorkProof = {
      ...booking.providerWorkProof,
      afterImages: afterImages,
      completionLocation: { latitude: providerLat, longitude: providerLng }
    };

    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.paymentStatus = 'paid';
    booking.commissionProcessed = true;

    // Fraud score checking for Hold extension
    const fraudScore = getFraudScore(booking);
    let holdPeriodHours = 48;
    if (fraudScore >= 50) {
      holdPeriodHours = 168; // 7 days (168 hours)
      booking.disputeRaised = true; // Flag for review
      booking.disputeStatus = 'under_review';
    }
    booking.payoutHoldUntil = new Date(Date.now() + holdPeriodHours * 60 * 60 * 1000);

    // Add status history note
    booking.statusHistory.push({
      status: 'completed',
      timestamp: new Date(),
      note: fraudScore >= 50
        ? `Service completed. Verification successful. Suspicious activity detected (Fraud Score: ${fraudScore}). Payout held for 7 days (168 hours) for admin review.`
        : `Service completed. Verification successful. Payout held for ${holdPeriodHours} hours for dispute review.`,
      updatedBy: 'system'
    });

    await booking.save({ session });

    // ------------------------------
    // Cashback logic moved outside transaction to avoid Write Conflicts
    // ------------------------------

    const { commission, netAmount } = CommissionRule.calculateCommission(
      booking.totalAmount,
      commissionRule
    );

    // ------------------------------
    //  CASH PAYMENT: Create a cash transaction
    // ------------------------------
    if (booking.paymentMethod === 'cash') {
      const Transaction = require('../models/Transaction-model');

      const cashTransaction = new Transaction({
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
        currency: 'INR',
        completedAt: new Date(),
        type: 'payment',
        description: `Cash payment for booking ${booking.bookingId || booking._id}`
      });

      await cashTransaction.save({ session });
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
          netAmount: netAmount,
          status: earningStatus,
          availableAfter
        }
      },
      { session, upsert: true, new: true, rawResult: true }
    );

    if (providerEarningResult.lastErrorObject && providerEarningResult.lastErrorObject.updatedExisting) {
      await session.abortTransaction();
      session.endSession();
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
    if (!provider.wallet) {
      provider.wallet = { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
    }

    if (booking.paymentMethod === "cash") {
      // Cash Booking Commission Logic
      if (provider.wallet.availableBalance < commission) {
        await session.commitTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance to cover commission for this cash booking. Please recharge your wallet."
        });
      }
      // Immediately deduct commission
      provider.wallet.availableBalance -= commission;
    } else {
      // Online payment → DO NOT add to availableBalance yet.
      // It will be added after 48h hold period expires.
      // We only log the earning in ProviderEarning model with 'held' status.
    }

    // Notify provider about payout hold
    if (booking.paymentMethod !== "cash") {
      try {
        sendNotification(
          providerId,
          'provider',
          'Payout Under Review',
          `Booking ${booking.bookingId || booking._id} completed. Your payout of ₹${netAmount} is under review for 48 hours.`,
          'payout_hold',
          booking._id
        );
      } catch (err) { /* ignore */ }
    }

    provider.wallet.lastUpdated = new Date();
    provider.completedBookings = (provider.completedBookings || 0) + 1;
    await provider.save({ session });

    // Recalculate performance score and trust score
    await recalculateProviderPerformance(providerId, session);


    await session.commitTransaction();
    session.endSession();

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
    await session.abortTransaction();
    session.endSession();
    console.error("Complete Booking Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to complete booking"
    });
  }
};






// Provider - Booking Report (Excel Download)
const providerBookingReport = async (req, res) => {
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
      .populate("customer", "name email phone createdAt")
      .populate("services.service", "title")
      .sort({ date: -1 })
      .lean();

    if (!bookings.length) {
      return res.json({
        success: true,
        message: "No bookings found for the selected date range",
      });
    }

    // Get and commission rule for calculations
    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId,
      provider.performanceScore
    );

    // Add commission calculations to bookings
    const bookingsWithCommission = bookings.map(booking => {
      const { commission, netAmount } = CommissionRule.calculateCommission(
        booking.totalAmount,
        commissionRule
      );
      return {
        ...booking,
        commissionAmount: commission,
        providerEarnings: netAmount
      };
    });

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
};



// ADMIN CONTROLLERS

// Get all bookings
const getAllBookings = async (req, res) => {
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

    const [bookings, totalResult, statsResult] = await Promise.all([
      Booking.aggregate(pipeline),
      Booking.aggregate(countPipeline),
      Booking.aggregate(statsPipeline)
    ]);

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

    res.status(200).json({
      success: true,
      count: bookings.length,
      page,
      pages,
      total,
      stats,
      data: bookings
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get booking details with service and payment information
const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('customer', 'name email phone')
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

    // Format the response
    const response = {
      booking: {
        ...booking,
        providerWorkProof: booking.providerWorkProof || { beforeImages: [], afterImages: [] },
        complaintProofs: booking.complaintProofs || []
      },
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
      complaint: booking.complaint,
      adminRemark: booking.adminRemark,
      payoutHoldUntil: booking.payoutHoldUntil,
      earningHoldStatus: earning ? earning.status : 'N/A',
      payoutStatus: getPayoutStatus(earning, booking),
      disputeRaised: booking.disputeRaised,
      disputeStatus: booking.disputeStatus,
      timeline: getBookingTimeline(booking, getPayoutStatus(earning, booking)),
      transactions: formattedTransactions,
      refundData: refundData
    };

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
};

// Assign provider to booking
const assignProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { providerId } = req.body || {};

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.provider) {
      return res.status(400).json({
        success: false,
        message: 'Booking has already been assigned to a provider'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be assigned'
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider || !provider.approved || provider.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider'
      });
    }

    booking.provider = providerId;
    booking.status = 'scheduled';
    await booking.save();

    // Sync transaction record with the new provider and calculated commission
    try {
      const isOnline = booking.paymentMethod?.toLowerCase() === 'online' || booking.paymentMethod?.toLowerCase() === 'upi';
      await Transaction.updateMany(
        { booking: booking._id },
        {
          provider: booking.provider,
          providerId: booking.provider.toString(),
          commission: isOnline ? (booking.commissionAmount * 100) : (booking.commissionAmount || 0),
          providerEarning: isOnline ? (booking.providerEarnings * 100) : (booking.providerEarnings || 0),
          commissionRule: booking.commissionRule,
          // Sync payment status if booking is already paid
          ...((booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold') && {
            paymentStatus: isOnline ? 'success' : 'completed'
          })
        }
      );
    } catch (transError) {
      console.error('Error syncing transaction on provider assignment:', transError);
    }

    // Invalidate dashboard caches
    try {


    } catch (e) { }

    res.json({
      success: true,
      message: 'Provider assigned successfully',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete booking (Admin only)
const deleteBooking = async (req, res) => {
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
};

// Delete user booking (Admin only)
const deleteUserBooking = async (req, res) => {
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
};

// Admin - Update Booking Date/Time
const updateBookingDateTime = async (req, res) => {
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
};

// Admin - Download Bookings as CSV
const downloadBookingReport = async (req, res) => {
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
      .populate('provider', 'name area')
      .populate('services.service', 'name category')
      .lean();

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Booking Report');

    // Columns
    worksheet.columns = [
      { header: 'Booking ID', key: '_id', width: 25 },
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
        return `${s.service.title} (${s.service.category}) x${s.quantity} = ${s.price - s.discountAmount}`;
      }).join('; ');

      worksheet.addRow({
        _id: b.bookingId || b._id.toString(),
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
};

const recalculateProviderPerformance = async (providerId, session = null) => {
  try {
    const provider = await Provider.findById(providerId).session(session);
    if (!provider) return;

    // 1. Get all bookings related to provider
    const bookings = await Booking.find({ provider: providerId }).session(session).lean();

    const totalAccepted = bookings.filter(b => ['accepted', 'in-progress', 'completed', 'cancelled'].includes(b.status)).length;
    const completedCount = bookings.filter(b => b.status === 'completed').length;
    const providerCancelledCount = bookings.filter(b => b.status === 'cancelled' && b.rejectedBy?.toString() === providerId.toString()).length;

    // 2. Completion rate & Cancellation ratio
    const completionPercentage = totalAccepted > 0 ? (completedCount / totalAccepted) * 100 : 100;
    const cancellationRatio = totalAccepted > 0 ? (providerCancelledCount / totalAccepted) * 100 : 0;

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
      restrictionReason
    };

    provider.completedBookings = completedCount;
    provider.canceledBookings = providerCancelledCount;

    await provider.save({ session });

  } catch (error) {
    console.error('recalculateProviderPerformance error:', error);
  }
};



module.exports = {
  recalculateProviderPerformance,
  createBooking,
  confirmBooking,
  updateBookingStatus,
  getUserBookings,
  getCustomerBookings,
  updateBookingPayment,
  getProviderById,
  getServiceById,
  payBooking,
  getBooking,
  cancelBooking,
  userUpdateBookingDateTime,
  getProviderBookingById,
  getBookingsByStatus,
  acceptBooking,
  startBooking,
  rejectBooking,
  completeBooking,
  providerBookingReport,
  getAllBookings,
  getBookingDetails,
  assignProvider,
  deleteBooking,
  deleteUserBooking,
  updateBookingDateTime,
  downloadBookingReport
};
