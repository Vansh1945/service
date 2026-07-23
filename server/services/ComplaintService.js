const Complaint = require('../models/Complaint-model');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const mongoose = require('mongoose');
const { notifyAdmins } = require('../utils/notificationHelper');
const { generateComplaintId } = require('../utils/generateUniqueId');


const checkAndAutoEscalate = async (complaintId) => {
  try {
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) return null;

    const isPending = ['submitted', 'under_review', 'Open', 'In-Progress'].includes(complaint.status);
    if (isPending && complaint.responseDeadline && new Date() > new Date(complaint.responseDeadline)) {
      complaint.status = 'admin_review';
      await complaint.save();

      if (complaint.booking) {
        await Booking.findByIdAndUpdate(complaint.booking, {
          disputeStatus: 'admin_review'
        });
      }
    }
  } catch (err) {
    console.error('Error auto-escalating complaint:', err);
  }
};

const calculateRecoverySplits = async (booking, refundAmount, absorption, absorbPlatformCommission) => {
  const ProviderEarning = mongoose.model('ProviderEarning');
  const earningDoc = await ProviderEarning.findOne({ booking: booking._id || booking }).lean();

  const grossBilled = booking.totalAmount || 0;
  const originalProvider = booking.providerEarnings || 0;
  const originalPlatform = (booking.commissionAmount || 0) + (booking.companySurgeShare || 0);

  let providerLoss = 0;
  let platformLoss = 0;

  if (absorption === 'platform') {
    providerLoss = 0;
    platformLoss = refundAmount;
  } else if (absorption === 'provider') {
    providerLoss = Math.min(originalProvider, refundAmount);
    platformLoss = Math.max(0, refundAmount - providerLoss);
  } else {
    const ratio = refundAmount / (grossBilled || 1);
    providerLoss = parseFloat((originalProvider * ratio).toFixed(2));
    platformLoss = parseFloat((refundAmount - providerLoss).toFixed(2));
  }

  let commissionRate = 10;
  let providerEarningsReversal = providerLoss;
  let adminRevenueReversal = platformLoss;

  if (earningDoc) {
    if (earningDoc.commissionRate > 0) {
      commissionRate = earningDoc.commissionRate;
    } else if (booking.totalAmount > 0) {
      commissionRate = ((booking.commissionAmount || 0) / booking.totalAmount) * 100;
    }
    const ratio = refundAmount / (booking.totalAmount || 1);
    providerEarningsReversal = (booking.totalAmount - (booking.totalAmount * (commissionRate / 100))) * ratio;
    adminRevenueReversal = (booking.totalAmount * (commissionRate / 100)) * ratio;
  }

  let held = 0;
  let pendingRelease = 0;
  let available = 0;
  let paidWithdrawn = 0;
  let platformAbsorption = platformLoss;

  const earningStatus = earningDoc ? earningDoc.status : 'paid';

  if (earningStatus === 'held') {
    held = providerLoss;
  } else if (earningStatus === 'under_review') {
    held = providerLoss;
  } else if (earningStatus === 'pending_release') {
    pendingRelease = providerLoss;
  } else if (earningStatus === 'available') {
    available = providerLoss;
  } else if (earningStatus === 'paid' || earningStatus === 'withdrawn') {
    const platformAbsorbedShare = absorbPlatformCommission ? adminRevenueReversal : 0;
    paidWithdrawn = Math.max(0, providerEarningsReversal - platformAbsorbedShare);
    platformAbsorption = platformLoss + platformAbsorbedShare;
  } else {
    paidWithdrawn = providerLoss;
  }

  return {
    customerReceives: refundAmount,
    providerLoss,
    platformLoss,
    providerEarningsReversal,
    adminRevenueReversal,
    splits: {
      held,
      pendingRelease,
      available,
      paidWithdrawn,
      platformAbsorption
    }
  };
};


class ComplaintService {

  static async submitComplaint(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { title, description, category, bookingId, complaintType } = req.body;
      const userId = req.user._id;
      const userRole = req.user.role;

      // 1. Validation
      if (!title || !description || !category) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Please provide title, description, and category.' });
      }

      // Validate Complaint Type if provided
      const validTypes = [
        'poor_quality', 'incomplete_work', 'provider_late', 'payment_issue', 'overcharged_service', 'behaviour_issue', 'cancel_booking', 'other',
        'provider_no_show', 'provider_not_responding', 'wrong_service', 'provider_left_job', 'safety_issue'
      ];
      if (complaintType && !validTypes.includes(complaintType)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: 'Invalid complaint type.' });
      }

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await Complaint.countDocuments({
        userType: userRole,
        $or: [
          { customer: userId },
          { provider: userId },
          { userId: userId },
          { providerId: userId }
        ],
        createdAt: { $gte: oneDayAgo }
      }).session(session);

      if (recentCount >= 3) {
        await session.abortTransaction();
        session.endSession();
        return res.status(429).json({
          success: false,
          message: 'Rate limit exceeded: You can only submit a maximum of 3 complaints in a 24-hour period.'
        });
      }

      const activeCount = await Complaint.countDocuments({
        userType: userRole,
        $or: [
          { customer: userId },
          { provider: userId },
          { userId: userId },
          { providerId: userId }
        ],
        status: { $in: ['Open', 'In-Progress', 'Reopened', 'submitted', 'under_review', 'provider_responded', 'admin_review'] }
      }).session(session);

      if (activeCount >= 3) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Active complaint limit reached: You have 3 or more unresolved complaints. Please wait until they are resolved.'
        });
      }

      let booking = null;
      let provider = null;
      let customer = null;

      if (userRole === 'provider') {
        provider = userId;
      } else {
        customer = userId;
      }

      if (category === 'Service issue' && userRole === 'customer') {
        if (!bookingId) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: 'Booking ID is required for service-related complaints.' });
        }

        booking = await Booking.findById(bookingId).session(session);
        if (!booking || booking.customer.toString() !== userId.toString()) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ message: 'Booking not found or you are not authorized.' });
        }
        if (!booking.provider) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: 'Cannot submit complaint for booking without assigned provider.' });
        }
        provider = booking.provider;

        // Block filing complaints on cancelled bookings
        if (booking.status === 'cancelled') {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ message: 'Cannot submit a complaint for a cancelled booking.' });
        }

        const bookingStatusNorm = (booking.status || '').toLowerCase().replace(/[^a-z]/g, '');

        // If cancel booking is requested, automatically route to BookingService.cancelBooking
        if (category === 'Service issue' && userRole === 'customer' && complaintType === 'cancel_booking') {
          const BookingService = require('./BookingService');
          req.params.id = bookingId;
          await session.abortTransaction();
          session.endSession();
          return await BookingService.cancelBooking(req, res);
        }

        // BEFORE WORK STARTS
        const beforeWorkStatuses = ['pending', 'searchingprovider', 'offered', 'assigned', 'accepted', 'ontheway', 'arrived'];
        if (beforeWorkStatuses.includes(bookingStatusNorm)) {
          const allowedBeforeStart = ['cancel_booking', 'provider_late', 'provider_no_show', 'provider_not_responding'];
          if (!complaintType || !allowedBeforeStart.includes(complaintType)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              success: false,
              message: 'Only pre-service complaints (Cancel Booking, Provider Late, Provider No Show, Provider Not Responding) are allowed before work starts.'
            });
          }
        }

        // AFTER WORK STARTS
        const activeStatuses = ['started', 'inprogress'];
        if (activeStatuses.includes(bookingStatusNorm)) {
          const allowedAfterStart = ['poor_quality', 'incomplete_work', 'wrong_service', 'provider_left_job', 'behaviour_issue', 'overcharged_service', 'safety_issue'];
          if (!complaintType || !allowedAfterStart.includes(complaintType)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              success: false,
              message: 'Invalid complaint reason for active service. Allowed reasons: Poor Service, Work Not Completed, Wrong Service, Provider Left Job, Behaviour Issue, Extra Charge, Safety Issue.'
            });
          }
        }

        // Completed: check complaint window from completedAt
        if (bookingStatusNorm === 'completed') {
          const { SystemConfig } = require('../models/SystemSetting-model');
          const sysConfig = await SystemConfig.findOne().session(session).lean();
          const windowDays = sysConfig?.bookingSettings?.complaintWindowDays ?? 7;
          const windowMs = windowDays * 24 * 60 * 60 * 1000;

          const completionDate = booking.completedAt || booking.serviceCompletedAt || booking.updatedAt || booking.createdAt;
          const ageMs = Date.now() - new Date(completionDate).getTime();
          if (ageMs > windowMs) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              success: false,
              message: `Dispute window closed: Complaints must be submitted within ${windowDays} days of service completion.`
            });
          }

          const allowedCompleted = ['poor_quality', 'incomplete_work', 'payment_issue', 'overcharged_service', 'behaviour_issue', 'other'];
          if (complaintType && !allowedCompleted.includes(complaintType)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              success: false,
              message: 'Invalid complaint reason for completed service.'
            });
          }
        }

        // Instant fake refund requests check: block service issues on unstarted bookings
        const qualityIssues = ['poor_quality', 'incomplete_work'];
        if (complaintType && qualityIssues.includes(complaintType)) {
          const notStarted = !booking.status || ['pending', 'unassigned', 'accepted'].includes(booking.status.toLowerCase());
          if (notStarted) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              success: false,
              message: `Instant refund prevention: Quality or service issues (${complaintType.replace('_', ' ')}) cannot be filed for a booking that has not started.`
            });
          }
        }

        // Prevent duplicate complaint submissions for same booking by same user
        const existingComplaint = await Complaint.findOne({
          booking: bookingId,
          userType: userRole,
          status: { $in: ['Open', 'In-Progress', 'Reopened', 'submitted', 'under_review', 'provider_responded', 'admin_review'] }
        }).session(session);

        if (existingComplaint) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'There is already an active dispute or complaint open for this booking. Please wait for resolution.'
          });
        }
      }

      // 2. Handle Image Uploads & Deduplication
      let images = [];
      if (req.files && req.files.length > 0) {
        const seenSizes = new Set();
        const seenNames = new Set();
        const uniqueFiles = [];

        for (const file of req.files) {
          const sizeKey = file.size;
          const nameKey = file.originalname;
          if (!seenSizes.has(sizeKey) && !seenNames.has(nameKey)) {
            seenSizes.add(sizeKey);
            seenNames.add(nameKey);
            uniqueFiles.push(file);
          }
        }

        images = uniqueFiles.map(file => ({
          secure_url: file.path,
          public_id: file.filename,
        }));
      }

      // Proof image requirements check
      const proofRequiredTypes = ['poor_quality', 'incomplete_work'];
      if (category === 'Service issue' && userRole === 'customer' && complaintType && proofRequiredTypes.includes(complaintType)) {
        if (images.length === 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `At least 1 proof image is strictly required for complaint type: ${complaintType.replace('_', ' ')}.`
          });
        }
      }

      // 3. Prepare Description with Complaint Type
      const formattedDescription = complaintType ? `[${complaintType}]\n${description}` : description;

      // Retrieve provider response SLA from SystemConfig dynamically
      const { SystemConfig } = require('../models/SystemSetting-model');
      const systemConfigDoc = await SystemConfig.findOne().session(session).lean();
      const providerSla = systemConfigDoc?.bookingSettings?.providerResponseSlaHours || 24;

      // Refund Eligible Classification
      let isRefundEligible = false;
      const refundEligibleCategories = [
        'Poor Quality',
        'Incomplete Work',
        'Service Not Delivered',
        'Overcharged Service',
        'Provider No Show',
        'poor_quality',
        'incomplete_work',
        'provider_late',
        'payment_issue',
        'overcharged_service',
        'provider_no_show',
        'provider_not_responding',
        'cancel_booking',
        'wrong_service',
        'provider_left_job',
        'safety_issue'
      ];

      const matchedCategory = refundEligibleCategories.some(c =>
        c.toLowerCase().replace(/[\s_-]/g, '') === category.toLowerCase().replace(/[\s_-]/g, '')
      ) || (complaintType && refundEligibleCategories.some(c =>
        c.toLowerCase().replace(/[\s_-]/g, '') === complaintType.toLowerCase().replace(/[\s_-]/g, '')
      ));

      if (matchedCategory) {
        isRefundEligible = true;
      }

      // Set provider response deadline only for refund eligible service issues
      const responseDeadline = (category === 'Service issue' && userRole === 'customer' && isRefundEligible)
        ? new Date(Date.now() + providerSla * 60 * 60 * 1000)
        : null;

      // 4. Create Complaint within transaction
      const complaintResult = await Complaint.create([{
        complaintId: generateComplaintId(),
        customer: customer || undefined,
        provider: provider || undefined,
        booking: booking ? bookingId : (bookingId || undefined),
        title,
        description: formattedDescription,
        category,
        images,
        userType: userRole,
        userId: userRole === 'customer' ? userId : undefined,
        providerId: userRole === 'provider' ? userId : undefined,
        role: userRole,
        status: 'submitted',
        responseDeadline
      }], { session });

      const complaint = complaintResult[0];

      // Update Booking with complaint proof and dispute status within transaction
      if (bookingId) {
        const updateData = {
          complaintId: complaint._id,
          $push: {
            complaintProofs: {
              uploadedBy: userRole,
              images: images.map(img => ({ url: img.secure_url })),
              message: description,
              createdAt: new Date()
            }
          }
        };

        // If customer raises service issue, mark as dispute ONLY if refund eligible
        if (category === 'Service issue' && userRole === 'customer' && isRefundEligible) {
          updateData.disputeRaised = true;
          updateData.disputeStatus = 'under_review';

          // Hold provider earnings if they exist
          const ProviderEarning = mongoose.model('ProviderEarning');
          await ProviderEarning.findOneAndUpdate(
            { booking: bookingId },
            { status: 'held' },
            { session }
          );

          // Notify Provider
          if (provider) {
            try {
              const { sendNotification } = require('../utils/notificationHelper');
              sendNotification(
                provider,
                'provider',
                'Dispute Raised ⚠️',
                `A dispute has been raised for booking #${bookingId.toString().slice(-6)}. Your payout is held.`,
                'dispute_raised',
                bookingId
              );
            } catch (e) { }
          }
        }

        await Booking.findByIdAndUpdate(bookingId, updateData, { session });
      }

      await session.commitTransaction();
      session.endSession();

      res.status(201).json({
        success: true,
        message: 'Support ticket submitted successfully',
        complaint
      });

      // Notify Admins
      try {
        notifyAdmins(
          'New Complaint Received',
          `A new complaint "${title}" was submitted under category "${category}".`,
          'complaint',
          complaint._id
        );
      } catch (e) { }
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      console.error('Error submitting complaint:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while submitting complaint.'
      });
    }
  }

  static async getAllComplaints(req, res) {
    try {
      // Auto-escalate any overdue complaints before fetching
      const overdueComplaints = await Complaint.find({
        status: { $in: ['submitted', 'under_review', 'Open', 'In-Progress'] },
        responseDeadline: { $ne: null, $lt: new Date() }
      }).select('_id').lean();
      for (const c of overdueComplaints) {
        await checkAndAutoEscalate(c._id);
      }

      const {
        page = 1,
        limit = 10,
        status,
        category,
        search,
        startDate,
        endDate,
        userType,
        providerId
      } = req.query;

      // Build the query
      const query = {};
      if (status) query.status = status;
      if (category) query.category = category;
      if (userType) query.userType = userType;
      if (providerId) query.providerId = providerId;
      if (req.query.booking) query.booking = req.query.booking;
      if (req.query.bookingId) query.booking = req.query.bookingId;

      if (search) {
        query.$or = [
          { complaintId: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      // Execute query with pagination
      const complaints = await Complaint.find(query)
        .populate('customer', 'name email')
        .populate('provider', 'name email')
        .populate('userId', 'name email')
        .populate('providerId', 'name email')
        .populate({
          path: 'booking',
          select: 'date services bookingId customer provider complaintProofs providerWorkProof disputeStatus adminRefundDecision paymentStatus statusHistory cancellationProgress totalAmount',
          populate: [
            { path: 'customer', select: 'name email phone' },
            { path: 'provider', select: 'name email phone' }
          ]
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

      // Get total count for pagination
      const total = await Complaint.countDocuments(query);

      const customerCount = await Complaint.countDocuments({ ...query, userType: 'customer' });
      const providerCount = await Complaint.countDocuments({ ...query, userType: 'provider' });
      const pendingCount = await Complaint.countDocuments({ ...query, status: { $in: ['submitted', 'Open', 'In-Progress'] } });

      // Extract all provider IDs to batch-count complaints in a single aggregate query
      const providerIds = complaints.map(c => c.provider?._id || c.provider).filter(Boolean);
      const countResults = await Complaint.aggregate([
        { $match: { provider: { $in: providerIds } } },
        { $group: { _id: '$provider', count: { $sum: 1 } } }
      ]);

      const countMap = {};
      countResults.forEach(res => {
        if (res._id) {
          countMap[res._id.toString()] = res.count;
        }
      });

      const enrichedComplaints = await Promise.all(
        complaints.map(async (c) => {
          const pId = c.provider?._id || c.provider;
          const providerComplaintsCount = pId ? (countMap[pId.toString()] || 0) : 0;
          return await ComplaintService.enrichComplaintData({ ...c, providerComplaintsCount }, null, false);
        })
      );

      res.json({
        success: true,
        data: enrichedComplaints,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        customerCount,
        providerCount,
        pendingCount
      });
    } catch (error) {
      console.error('Error fetching complaints:', error);
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }

  static async getMyComplaints(req, res) {
    try {
      let query = {};

      if (req.user.role === 'provider') {
        query = { providerId: req.user._id };
      } else if (req.user.role === 'customer') {
        query = { userId: req.user._id };
      } else {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const complaints = await Complaint.find(query)
        .populate('customer', 'name email')
        .populate('provider', 'name email')
        .populate('booking', 'date services bookingId complaintProofs providerWorkProof disputeStatus adminRefundDecision paymentStatus statusHistory cancellationProgress totalAmount')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: complaints
      });
    } catch (error) {
      console.error('Error fetching user complaints:', error);
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }

  static async getComplaint(req, res) {
    try {
      await checkAndAutoEscalate(req.params.id);

      const complaint = await Complaint.findById(req.params.id)
        .populate('customer', 'name email phone')
        .populate('provider', 'name email phone')
        .populate('userId', 'name email phone')
        .populate('providerId', 'name email phone')
        .populate('resolvedBy', 'name email')
        .populate({
          path: 'booking',
          select: 'date services bookingId customer provider complaintProofs providerWorkProof disputeStatus adminRefundDecision paymentStatus statusHistory payoutHoldUntil totalAmount cancellationProgress',
          populate: [
            { path: 'customer', select: 'name email phone' },
            { path: 'provider', select: 'name email phone' }
          ]
        })
        .lean();

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
      }

      // Check authorization using role-based userId/providerId fields
      if (req.user.role === 'customer') {
        const complaintUserId = complaint.userId?._id || complaint.userId;
        const isOwner = complaintUserId && complaintUserId.toString() === req.user._id.toString();
        if (!isOwner) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to access this complaint'
          });
        }
      }

      if (req.user.role === 'provider') {
        const complaintProviderId = complaint.providerId?._id || complaint.providerId;
        const isOwner = complaintProviderId && complaintProviderId.toString() === req.user._id.toString();
        if (!isOwner) {
          return res.status(403).json({
            success: false,
            message: 'Not authorized to access this complaint'
          });
        }
      }

      const enrichedData = await ComplaintService.enrichComplaintData(complaint, req, true);

      res.json({
        success: true,
        data: enrichedData
      });
    } catch (error) {
      console.error('Error fetching complaint:', error);
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }

  static async resolveComplaint(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { resolutionNotes, decision, absorption = 'shared' } = req.body; // decision: 'approve_refund' | 'reject_refund' | 'manual_review'
      if (!resolutionNotes) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Resolution notes are required.' });
      }

      const complaint = await Complaint.findById(req.params.id)
        .populate('booking')
        .populate('customer')
        .populate('provider')
        .populate('userId')
        .populate('providerId')
        .session(session);
      if (!complaint) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: 'Complaint not found' });
      }

      let resolvedStatus = complaint.status || 'submitted';
      if (['approve_refund', 'full_refund', 'partial_refund', 'platform_credit'].includes(decision)) {
        resolvedStatus = 'refunded';
      } else if (['reject_refund', 'reject'].includes(decision)) {
        resolvedStatus = 'rejected';
      } else if (decision === 'request_more_evidence') {
        resolvedStatus = 'request_more_evidence';
      } else if (decision === 'close' || decision === 'Close' || decision === 'Closed') {
        resolvedStatus = 'Closed';
      } else if (decision === 'escalate') {
        resolvedStatus = 'admin_review';
      } else if (decision === 'resolve' || decision === 'resolved' || decision === 'Solved') {
        resolvedStatus = 'resolved';
      } else if (decision === 'reply') {
        // reply action maintains the current status
        resolvedStatus = complaint.status;
      } else {
        resolvedStatus = 'resolved';
      }

      // --- STATE MACHINE VALIDATION ---
      const VALID_TRANSITIONS = {
        'submitted': ['under_review', 'Closed', 'request_more_evidence', 'admin_review', 'resolved', 'rejected', 'refunded'],
        'under_review': ['provider_responded', 'admin_review', 'Closed', 'request_more_evidence', 'resolved', 'rejected', 'refunded'],
        'provider_responded': ['admin_review', 'Closed', 'request_more_evidence', 'resolved', 'rejected', 'refunded'],
        'admin_review': ['resolved', 'rejected', 'refunded', 'Closed', 'request_more_evidence'],
        'resolved': ['Reopened', 'Closed'],
        'rejected': ['Reopened', 'Closed'],
        'refunded': [],
        'Closed': ['Reopened'],
        'Reopened': ['under_review', 'Closed', 'request_more_evidence', 'resolved', 'rejected', 'refunded'],
        'request_more_evidence': ['under_review', 'Closed', 'resolved', 'rejected', 'refunded'],

        'Open': ['In-Progress', 'Solved', 'Closed', 'submitted', 'under_review', 'provider_responded', 'admin_review', 'resolved', 'rejected', 'refunded', 'request_more_evidence'],
        'In-Progress': ['Solved', 'Closed', 'submitted', 'under_review', 'provider_responded', 'admin_review', 'resolved', 'rejected', 'refunded', 'request_more_evidence'],
        'Solved': ['Reopened', 'Closed'],
      };

      const currentStatus = complaint.status || 'submitted';
      const allowed = VALID_TRANSITIONS[currentStatus] || [];
      if (decision !== 'reply' && !allowed.includes(resolvedStatus) && currentStatus !== resolvedStatus) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: `Invalid status transition: cannot change status from '${currentStatus}' to '${resolvedStatus}' by resolving.`
        });
      }

      if ((decision === 'full_refund' || decision === 'approve_refund' || resolvedStatus === 'refunded') &&
        (complaint.complaintType === 'cancel_booking')) {
        const booking = complaint.booking;
        if (booking) {
          const isWorkStartedOrCompleted = booking.timeline?.some(t => t.label === 'Work Started') ||
            ['started', 'inprogress', 'completed'].includes((booking.status || '').toLowerCase());
          if (isWorkStartedOrCompleted) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({
              success: false,
              message: 'Cannot cancel this booking: work has already started or the booking is completed.'
            });
          }
        }
      }

      // --- SAFETY GUARDS (FIX 9) ---
      const customerUserId = complaint.userId || complaint.customer;
      if (['approve_refund', 'full_refund', 'partial_refund', 'platform_credit'].includes(decision) && customerUserId) {
        // 1. Loop Check: Block refund if >= 2 refund transactions processed in the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentRefundsCount = await Transaction.countDocuments({
          user: customerUserId,
          $or: [{ refundStatus: 'completed' }, { paymentStatus: 'refunded' }],
          createdAt: { $gte: thirtyDaysAgo }
        }).session(session);

        if (recentRefundsCount >= 2) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'Safety Block: Customer has reached the maximum limit of 2 processed refunds in the last 30 days.'
          });
        }

        // 2. Active parallel complaints check
        const activeComplaintsCount = await ComplaintModel.countDocuments({
          $or: [{ userId: customerUserId }, { customer: customerUserId }],
          status: { $in: ['submitted', 'under_review', 'provider_responded', 'admin_review', 'Reopened', 'Open', 'In-Progress'] },
          _id: { $ne: complaint._id }
        }).session(session);

        if (activeComplaintsCount > 0) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'Safety Block: Cannot issue a refund while the customer has other active/open complaints.'
          });
        }
      }

      // --- SECURITY REQUIRE PROVIDER RESPONSE CHECK ---
      const qualityIssues = ['poor_quality', 'incomplete_work'];
      const descriptionMatch = complaint.description?.match(/^\[(.*?)\]/);
      const complaintType = descriptionMatch ? descriptionMatch[1] : null;

      if (
        ['approve_refund', 'full_refund', 'partial_refund'].includes(decision) &&
        complaint.category === 'Service issue' &&
        complaintType &&
        qualityIssues.includes(complaintType)
      ) {
        const hasProviderResponded =
          complaint.status === 'provider_responded' ||
          (complaint.booking && complaint.booking.complaintProofs?.some(p => p.uploadedBy === 'provider'));

        const isDeadlinePassed = complaint.responseDeadline && new Date() > new Date(complaint.responseDeadline);

        if (!hasProviderResponded && !isDeadlinePassed) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: 'Security Block: A refund cannot be approved for a service quality dispute until the provider has responded or their response deadline has expired.'
          });
        }
      }

      complaint.status = resolvedStatus;
      complaint.resolvedBy = req.admin?._id || req.user?._id;
      complaint.resolutionNotes = resolutionNotes;
      await complaint.save({ session });

      // ── Execute Decision logic ──────────────────
      if (complaint.booking) {
        const ProviderEarning = mongoose.model('ProviderEarning');
        const Provider = mongoose.model('Provider');
        const Transaction = mongoose.model('Transaction');
        const bookingId = complaint.booking._id || complaint.booking;
        const booking = complaint.booking;

        const adminName = req.user?.name || req.admin?.name || req.user?.email || 'Support Admin';
        let auditAmount = 0;
        if (['approve_refund', 'full_refund', 'partial_refund'].includes(decision)) {
          const previouslyRefunded = booking.cancellationProgress?.refundAmount || 0;
          const remainingRefundable = booking.totalAmount - previouslyRefunded;
          auditAmount = decision === 'partial_refund' ? (req.body.refundAmount || (booking.totalAmount * 0.5)) : remainingRefundable;
          auditAmount = Math.min(auditAmount, remainingRefundable);
        } else if (decision === 'provider_penalty') {
          auditAmount = req.body.penaltyAmount || 500;
        }
        const auditMessage = `[Audit Trail] Admin Name: ${adminName} | Action: ${decision.toUpperCase()} | Amount: ₹${auditAmount} | Reason: ${resolutionNotes} | Timestamp: ${new Date().toISOString()}`;

        await Booking.findByIdAndUpdate(bookingId, {
          $push: {
            complaintProofs: {
              uploadedBy: 'admin',
              images: [],
              message: auditMessage,
              createdAt: new Date()
            }
          }
        }, { session });

        if (['reject_refund', 'reject'].includes(decision)) {
          // Complaint rejected → provider is innocent → release payout
          await ProviderEarning.findOneAndUpdate(
            { booking: bookingId },
            { status: 'available' },
            { session }
          );
          // Also clear dispute flags on booking
          await Booking.findByIdAndUpdate(bookingId, {
            disputeStatus: 'resolved',
            adminRefundDecision: 'rejected'
          }, { session });

          // Notify customer + provider
          try {
            const { sendNotification } = require('../utils/notificationHelper');
            const targetCustomer = booking?.customer || complaint?.customer || complaint?.userId;
            if (targetCustomer) {
              sendNotification(
                targetCustomer,
                'customer',
                'Refund Request Rejected ',
                `Your refund request for booking #${booking?.bookingId || bookingId.toString().slice(-6)} has been reviewed and rejected. Reason: ${resolutionNotes}`,
                'refund_rejected',
                bookingId
              );
            }
            const targetProvider = booking?.provider || complaint?.provider || complaint?.providerId;
            if (targetProvider) {
              sendNotification(
                targetProvider,
                'provider',
                'Dispute Resolved: Payout Released ',
                `The dispute for booking #${booking?.bookingId || bookingId.toString().slice(-6)} has been resolved in your favor. Your payout is now available.`,
                'dispute_resolved',
                bookingId
              );
            }
          } catch (e) { }
        } else if (decision === 'request_more_evidence') {
          // Update disputeStatus on booking
          await Booking.findByIdAndUpdate(bookingId, {
            disputeStatus: 'under_review'
          }, { session });

          // Notify customer
          try {
            const { sendNotification } = require('../utils/notificationHelper');
            sendNotification(
              booking.customer,
              'customer',
              'Evidence Requested ',
              `Support needs more evidence to resolve your complaint for booking #${bookingId.toString().slice(-6)}.`,
              'evidence_requested',
              bookingId
            );
          } catch (e) { }
        } else if (decision === 're_service') {
          // ── Re-Service Decision (Urban Company workflow) ──
          // 1. Release payout for the original provider
          await ProviderEarning.findOneAndUpdate(
            { booking: bookingId },
            { status: 'available' },
            { session }
          );
          // 2. Clear dispute status on original booking
          await Booking.findByIdAndUpdate(bookingId, {
            disputeStatus: 'resolved',
            adminRefundDecision: 'none'
          }, { session });

          // 3. Create a duplicate booking with isRebook: true
          const rebook = new Booking({
            customer: booking.customer,
            provider: booking.provider,
            services: booking.services,
            date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Scheduled for tomorrow
            time: booking.time || '12:00',
            status: 'pending',
            paymentMethod: booking.paymentMethod,
            paymentStatus: 'paid', // Mark as paid since customer already paid for original service
            subtotal: booking.subtotal,
            totalAmount: booking.totalAmount,
            isRebook: true,
            originalBooking: booking._id,
            address: booking.address
          });
          await rebook.save({ session });

          // Notify customer & provider
          try {
            const { sendNotification } = require('../utils/notificationHelper');
            sendNotification(
              booking.customer,
              'customer',
              'Re-service Scheduled 🛠️',
              `A free re-service has been scheduled for your booking #${bookingId.toString().slice(-6)}.`,
              'rebook_scheduled',
              rebook._id
            );
            if (booking.provider) {
              sendNotification(
                booking.provider,
                'provider',
                'Re-service Assigned ',
                `You have been assigned a re-service for booking #${bookingId.toString().slice(-6)}.`,
                'rebook_assigned',
                rebook._id
              );
            }
          } catch (e) { }
        } else if (decision === 'provider_warning') {
          // ── Provider Warning ──
          // Release payout, but issue warning record to provider
          await ProviderEarning.findOneAndUpdate(
            { booking: bookingId },
            { status: 'available' },
            { session }
          );
          await Booking.findByIdAndUpdate(bookingId, {
            disputeStatus: 'resolved',
            adminRefundDecision: 'none'
          }, { session });

          if (booking.provider) {
            const providerDoc = await Provider.findById(booking.provider).session(session);
            if (providerDoc) {
              if (!providerDoc.performanceScore) {
                providerDoc.performanceScore = {};
              }
              providerDoc.performanceScore.restrictionsActive = true;
              providerDoc.performanceScore.restrictionReason = `Warning issued on complaint resolution: ${resolutionNotes}`;
              await providerDoc.save({ session });

              // Notify provider
              try {
                const { sendNotification } = require('../utils/notificationHelper');
                sendNotification(
                  booking.provider,
                  'provider',
                  'Official Warning Issued ',
                  `An official warning has been issued due to booking quality dispute #${bookingId.toString().slice(-6)}.`,
                  'provider_warning',
                  bookingId
                );
              } catch (e) { }
            }
          }
        } else if (decision === 'provider_penalty') {
          // ── Provider Penalty ──
          // Release held payout, but apply wallet deduction penalty
          await ProviderEarning.findOneAndUpdate(
            { booking: bookingId },
            { status: 'available' },
            { session }
          );
          await Booking.findByIdAndUpdate(bookingId, {
            disputeStatus: 'resolved',
            adminRefundDecision: 'none'
          }, { session });

          if (booking.provider) {
            const providerDoc = await Provider.findById(booking.provider).session(session);
            if (providerDoc) {
              const penaltyAmount = req.body.penaltyAmount || 500; // default 500 INR
              if (!providerDoc.wallet) {
                providerDoc.wallet = { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
              }
              providerDoc.wallet.availableBalance -= penaltyAmount;
              providerDoc.wallet.lastUpdated = new Date();
              await providerDoc.save({ session });

              // Log penalty transaction
              const penaltyTx = new Transaction({
                booking: booking._id,
                bookingId: booking.bookingId || booking._id,
                user: booking.customer,
                provider: booking.provider,
                amount: penaltyAmount,
                paymentStatus: 'completed',
                paymentMethod: 'wallet',
                type: 'refund',
                description: `Penalty deduction of ₹${penaltyAmount} issued. Reason: ${resolutionNotes}`,
                refundReason: `Penalty: ${resolutionNotes}`
              });
              await penaltyTx.save({ session });

              // Notify provider
              try {
                const { sendNotification } = require('../utils/notificationHelper');
                sendNotification(
                  booking.provider,
                  'provider',
                  'Penalty Deduction Notice ',
                  `A penalty of ₹${penaltyAmount} has been deducted from your wallet due to dispute #${bookingId.toString().slice(-6)}.`,
                  'provider_penalty',
                  bookingId
                );
              } catch (e) { }
            }
          }
        } else if (decision === 'resolve' || decision === 'resolved' || decision === 'Solved') {
          // Release held payout since complaint is resolved without refund/penalty
          await ProviderEarning.findOneAndUpdate(
            { booking: bookingId },
            { status: 'available' },
            { session }
          );
          await Booking.findByIdAndUpdate(bookingId, {
            disputeStatus: 'resolved',
            adminRefundDecision: 'none'
          }, { session });
        } else if (['approve_refund', 'full_refund', 'partial_refund', 'platform_credit'].includes(decision)) {
          // ── Refund Action (Full, Partial or Platform Credit) ──
          if (booking.paymentStatus === 'refunded' || booking.adminRefundDecision === 'approved') {
            console.log('Cannot refund: Booking already refunded');
          } else if (booking.paymentMethod === 'cod') {
            console.log('Cannot refund: Pay after Service (COD) bookings are strictly ineligible for wallet refunds');
          } else {
            const previouslyRefunded = booking.cancellationProgress?.refundAmount || 0;
            const remainingRefundable = booking.totalAmount - previouslyRefunded;

            let refundAmount = remainingRefundable;
            if (decision === 'partial_refund') {
              refundAmount = req.body.refundAmount || (booking.totalAmount * 0.5); // default 50%
            }
            refundAmount = Math.min(refundAmount, remainingRefundable);

            if (refundAmount > 0) {
              // Lock transaction to prevent double refund
              const transaction = await Transaction.findOneAndUpdate(
                { booking: booking._id, paymentStatus: { $in: ['completed', 'paid', 'success'] }, refundStatus: { $ne: 'completed' } },
                { refundStatus: 'processing' },
                { session, new: true }
              );

              if (transaction) {
                // Update User wallet
                const user = await User.findById(booking.customer).session(session);
                if (user) {
                  if (!user.wallet) {
                    user.wallet = { availableBalance: 0, totalRefunded: 0, lastUpdated: new Date() };
                  }
                  user.wallet.availableBalance += refundAmount;
                  user.wallet.totalRefunded += refundAmount;
                  user.wallet.walletTransactions.push({
                    type: 'credit',
                    amount: refundAmount,
                    reason: 'Booking Refund via Support Resolution',
                    source: 'booking_refund',
                    status: 'success',
                    booking: booking._id
                  });
                  user.wallet.lastUpdated = new Date();
                  await user.save({ session });
                }

                // Create Transaction record for audit
                const refundTransaction = new Transaction({
                  booking: booking._id,
                  bookingId: booking.bookingId || booking._id,
                  user: booking.customer,
                  amount: refundAmount,
                  paymentStatus: 'completed',
                  paymentMethod: 'wallet',
                  type: 'refund',
                  description: `Refund Approved via Support ticket resolution for booking #${booking.bookingId || booking._id}. Reason: ${resolutionNotes}`,
                  refundReason: resolutionNotes
                });
                await refundTransaction.save({ session });

                // ── REFUND RECOVERY PRIORITY ──
                let recoveryStatus = 'platform_absorbed';
                let recoveredAmount = 0;
                let providerEarningsReversal = 0;
                let adminRevenueReversal = 0;

                if (decision === 'platform_credit') {
                  recoveryStatus = 'platform_credit_reserve';

                  const RecoveryLedger = mongoose.model('RecoveryLedger');
                  await RecoveryLedger.create([{
                    provider: booking.provider,
                    booking: booking._id,
                    complaint: complaint._id,
                    amount: refundAmount,
                    source: 'platform_credit_reserve',
                    reason: resolutionNotes
                  }], { session });
                } else {
                  const splitsResult = await calculateRecoverySplits(booking, refundAmount, absorption, req.body.absorbPlatformCommission === true);
                  providerEarningsReversal = splitsResult.providerEarningsReversal;
                  adminRevenueReversal = splitsResult.adminRevenueReversal;

                  const earning = await ProviderEarning.findOne({ booking: booking._id }).session(session);
                  if (earning) {
                    earning.netAmount = Math.max(0, earning.netAmount - providerEarningsReversal);
                    earning.commissionAmount = Math.max(0, earning.commissionAmount - adminRevenueReversal);
                    earning.grossAmount = Math.max(0, earning.grossAmount - refundAmount);

                    if (splitsResult.splits.held > 0) {
                      recoveryStatus = 'held_earnings';
                      recoveredAmount = splitsResult.splits.held;
                      if (earning.netAmount <= 0) {
                        earning.status = 'cancelled';
                      }
                    } else if (splitsResult.splits.pendingRelease > 0 || splitsResult.splits.available > 0) {
                      recoveryStatus = earning.status === 'pending_release' ? 'pending_release' : 'escrow';
                      recoveredAmount = splitsResult.splits.pendingRelease + splitsResult.splits.available;
                      if (earning.netAmount <= 0) {
                        earning.status = 'cancelled';
                      }
                    } else if (splitsResult.splits.paidWithdrawn > 0) {
                      recoveryStatus = 'provider_wallet';
                      recoveredAmount = splitsResult.splits.paidWithdrawn;

                      const providerDoc = await Provider.findById(booking.provider).session(session);
                      if (providerDoc && providerDoc.wallet) {
                        if (providerDoc.wallet.availableBalance === undefined) {
                          providerDoc.wallet.availableBalance = 0;
                        }
                        providerDoc.wallet.availableBalance -= recoveredAmount;
                        providerDoc.wallet.lastUpdated = new Date();
                        await providerDoc.save({ session });
                      }
                    } else {
                      recoveryStatus = 'platform_absorbed';
                      recoveredAmount = 0;
                    }
                    await earning.save({ session });
                  }

                  // Log recoveries to RecoveryLedger
                  const RecoveryLedger = mongoose.model('RecoveryLedger');
                  if (splitsResult.splits.held > 0) {
                    await RecoveryLedger.create([{
                      provider: booking.provider,
                      booking: booking._id,
                      complaint: complaint._id,
                      amount: splitsResult.splits.held,
                      source: 'held_earnings',
                      reason: resolutionNotes
                    }], { session });
                  }
                  if (splitsResult.splits.pendingRelease > 0) {
                    await RecoveryLedger.create([{
                      provider: booking.provider,
                      booking: booking._id,
                      complaint: complaint._id,
                      amount: splitsResult.splits.pendingRelease,
                      source: 'pending_release',
                      reason: resolutionNotes
                    }], { session });
                  }
                  if (splitsResult.splits.available > 0) {
                    await RecoveryLedger.create([{
                      provider: booking.provider,
                      booking: booking._id,
                      complaint: complaint._id,
                      amount: splitsResult.splits.available,
                      source: 'available',
                      reason: resolutionNotes
                    }], { session });
                  }
                  if (splitsResult.splits.paidWithdrawn > 0) {
                    await RecoveryLedger.create([{
                      provider: booking.provider,
                      booking: booking._id,
                      complaint: complaint._id,
                      amount: splitsResult.splits.paidWithdrawn,
                      source: 'wallet',
                      reason: resolutionNotes
                    }], { session });
                  }
                  if (splitsResult.splits.platformAbsorption > 0) {
                    await RecoveryLedger.create([{
                      provider: booking.provider,
                      booking: booking._id,
                      complaint: complaint._id,
                      amount: splitsResult.splits.platformAbsorption,
                      source: 'platform_absorbed',
                      reason: resolutionNotes
                    }], { session });
                  }

                  booking.providerEarnings = Math.max(0, booking.providerEarnings - providerEarningsReversal);
                  booking.commissionAmount = Math.max(0, booking.commissionAmount - adminRevenueReversal);
                }

                // Update booking fields
                if (complaintType === 'cancel_booking' || complaint.complaintType === 'cancel_booking') {
                  booking.status = 'cancelled';
                }
                booking.paymentStatus = 'refunded';
                booking.disputeStatus = 'resolved';
                booking.adminRefundDecision = (refundAmount >= booking.totalAmount) ? 'approved' : 'partial';
                if (!booking.cancellationProgress) {
                  booking.cancellationProgress = {};
                }
                booking.cancellationProgress.status = 'refund_completed';
                booking.cancellationProgress.refundAmount = previouslyRefunded + refundAmount;
                booking.cancellationProgress.refundCompletedAt = new Date();
                booking.adminRemark = resolutionNotes || 'Admin approved refund via complaint resolution';
                booking.refundStatus = 'completed';
                booking.refundMode = 'wallet';
                booking.refundProcessed = true;

                booking.adminRemark = (booking.adminRemark || '') +
                  ` | Recovery: ${recoveryStatus} (₹${recoveredAmount.toFixed(2)}/₹${providerEarningsReversal.toFixed(2)} recovered from provider)`;

                await booking.save({ session });

                // Finalize transaction record
                transaction.refundStatus = 'completed';
                transaction.refundReason = resolutionNotes;
                transaction.refundedAt = new Date();
                transaction.paymentStatus = 'refunded';
                transaction.refundedAmount = previouslyRefunded + refundAmount;
                await transaction.save({ session });

                // Notify Customer
                try {
                  const { sendNotification } = require('../utils/notificationHelper');
                  sendNotification(
                    booking.customer,
                    'customer',
                    'Refund Credited ',
                    `A refund of ₹${refundAmount} has been credited to your wallet.`,
                    'refund_processed',
                    booking._id
                  );

                  if (booking.provider) {
                    sendNotification(
                      booking.provider,
                      'provider',
                      'Refund Deduction Notice ',
                      `A refund of ₹${refundAmount} was approved for Booking #${booking.bookingId || booking._id.toString().slice(-6)}. Recovery source: ${recoveryStatus.replace(/_/g, ' ')}.`,
                      'refund_deducted',
                      booking._id
                    );
                  }
                } catch (err) { }
              }
            }
          }
        }
      }

      await session.commitTransaction();
      session.endSession();

      // Invalidate dashboard caches
      try {

      } catch (e) { }



      res.json({ success: true, message: 'Complaint resolved successfully', data: complaint });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error resolving complaint:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  }

  static async updateComplaintStatus(req, res) {
    try {
      const { status, resolutionNotes } = req.body;
      const validStatuses = ["Open", "In-Progress", "Solved", "Reopened", "Closed", "submitted", "under_review", "provider_responded", "admin_review", "resolved", "rejected", "refunded", "request_more_evidence"];

      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status is required'
        });
      }

      const complaint = await Complaint.findById(req.params.id);
      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
      }

      // --- STATE MACHINE VALIDATION ---
      const VALID_TRANSITIONS = {
        'submitted': ['under_review', 'Closed', 'request_more_evidence'],
        'under_review': ['provider_responded', 'admin_review', 'Closed', 'request_more_evidence'],
        'provider_responded': ['admin_review', 'Closed', 'request_more_evidence'],
        'admin_review': ['resolved', 'rejected', 'refunded', 'Closed', 'request_more_evidence'],
        'resolved': ['Reopened'],
        'rejected': ['Reopened'],
        'refunded': [],
        'Closed': ['Reopened'],
        'Reopened': ['under_review', 'Closed', 'request_more_evidence'],
        'request_more_evidence': ['under_review', 'Closed', 'resolved', 'rejected', 'refunded'],

        'Open': ['In-Progress', 'Solved', 'Closed', 'submitted', 'under_review', 'provider_responded', 'admin_review', 'resolved', 'rejected', 'refunded', 'request_more_evidence'],
        'In-Progress': ['Solved', 'Closed', 'submitted', 'under_review', 'provider_responded', 'admin_review', 'resolved', 'rejected', 'refunded', 'request_more_evidence'],
        'Solved': ['Reopened'],
      };

      const currentStatus = complaint.status || 'submitted';
      const allowed = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(status) && currentStatus !== status) {
        return res.status(400).json({
          success: false,
          message: `Invalid status transition: cannot change status from '${currentStatus}' to '${status}'.`
        });
      }

      complaint.status = status;
      complaint.resolutionNotes = resolutionNotes;
      complaint.resolvedBy = req.admin?._id || req.user?._id;
      if (['resolved', 'Solved'].includes(status)) {
        complaint.resolvedAt = new Date();
      }

      await complaint.save();

      // Invalidate dashboard caches
      try {


      } catch (e) { }

      res.json({
        success: true,
        message: 'Complaint status updated successfully',
        data: complaint
      });
    } catch (error) {
      console.error('Error updating complaint status:', error);
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }

  static async reopenComplaint(req, res) {
    try {
      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({
          success: false,
          message: "A reason for reopening is required."
        });
      }

      const complaint = await Complaint.findById(req.params.id);

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: 'Complaint not found'
        });
      }

      const complaintUserId = complaint.userId?._id || complaint.userId;
      const complaintProviderId = complaint.providerId?._id || complaint.providerId;
      const isCustomerOwner = complaintUserId && complaintUserId.toString() === req.user._id.toString();
      const isProviderOwner = complaintProviderId && complaintProviderId.toString() === req.user._id.toString();

      // Fallback to legacy fields
      const complaintCustomer = complaint.customer?._id || complaint.customer;
      const complaintProvider = complaint.provider?._id || complaint.provider;
      const isLegacyCustomerOwner = complaintCustomer && complaintCustomer.toString() === req.user._id.toString();
      const isLegacyProviderOwner = complaintProvider && complaintProvider.toString() === req.user._id.toString();

      if (!isCustomerOwner && !isProviderOwner && !isLegacyCustomerOwner && !isLegacyProviderOwner) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to reopen this complaint."
        });
      }

      // Check if the complaint has been reopened 3 or more times
      if (complaint.reopenHistory && complaint.reopenHistory.length >= 3) {
        return res.status(403).json({
          success: false,
          message: "This complaint has already been reopened the maximum number of times."
        });
      }

      complaint.status = 'Reopened';

      complaint.reopenHistory.push({ reason: reason });

      await complaint.save();

      // Invalidate dashboard caches
      try {


      } catch (e) { }

      res.json({
        success: true,
        message: 'Complaint reopened successfully',
        data: complaint
      });
    } catch (error) {
      console.error('Error reopening complaint:', error);
      res.status(500).json({
        success: false,
        message: 'Server Error'
      });
    }
  }

  static async getComplaintDetails(req, res) {
    try {
      const { id } = req.params;
      await checkAndAutoEscalate(id);

      const { takeOverLock } = req.query;
      const currentAdminId = req.admin?._id || req.user?._id;
      const now = new Date();

      const lockCheckComplaint = await Complaint.findById(id);
      if (!lockCheckComplaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      const reviewLockActive = lockCheckComplaint.reviewLockExpiresAt && new Date(lockCheckComplaint.reviewLockExpiresAt) > now;
      const lockOwner = lockCheckComplaint.reviewLockOwner;

      if (reviewLockActive && lockOwner && lockOwner.toString() !== currentAdminId?.toString()) {
        if (takeOverLock === 'true') {
          lockCheckComplaint.reviewLockOwner = currentAdminId;
          lockCheckComplaint.reviewLockExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
          await lockCheckComplaint.save();
        }
      } else {
        lockCheckComplaint.reviewLockOwner = currentAdminId;
        lockCheckComplaint.reviewLockExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await lockCheckComplaint.save();
      }

      // Find complaint by ID and populate all references deeply
      const complaint = await Complaint.findById(id)
        .populate("customer", "name email phone profilePic")
        .populate("provider", "name email phone profilePic")
        .populate("userId", "name email phone profilePic")
        .populate("providerId", "name email phone profilePic")
        .populate({
          path: "booking",
          populate: [
            { path: "customer", select: "name email phone profilePic" },
            { path: "provider", select: "name email phone profilePic" },
            { path: "services.service", select: "title images" }
          ]
        })
        .populate("resolvedBy", "name email")
        .lean();

      if (!complaint) {
        return res.status(404).json({
          success: false,
          message: "Complaint not found"
        });
      }

      const enrichedData = await ComplaintService.enrichComplaintData(complaint, req, true);

      // Build Booking timeline and structured response
      let bookingData = null;
      if (enrichedData.booking) {
        const b = enrichedData.booking;

        const timeline = [];
        if (b.createdAt) timeline.push({ label: "Booking Created", date: b.createdAt });
        if (b.statusHistory && b.statusHistory.length > 0) {
          b.statusHistory.forEach(history => {
            if (history.status === 'accepted') timeline.push({ label: "Accepted", date: history.timestamp });
          });
        }
        if (b.serviceStartedAt) timeline.push({ label: "Work Started", date: b.serviceStartedAt });
        if (b.serviceCompletedAt) timeline.push({ label: "Completed", date: b.serviceCompletedAt });
        if (complaint.createdAt) timeline.push({ label: "Complaint Raised", date: complaint.createdAt });

        timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

        let payoutStatus = enrichedData.providerPayoutStatus || 'N/A';
        if (b.payoutHoldUntil && new Date(b.payoutHoldUntil) > new Date()) payoutStatus = 'Held';

        bookingData = {
          bookingId: b.bookingId,
          status: b.status,
          paymentStatus: b.paymentStatus,
          disputeStatus: b.disputeStatus,
          payoutStatus: payoutStatus,
          customer: b.customer,
          provider: b.provider,
          service: b.services && b.services.length > 0 ? b.services[0].service : null,
          workProof: {
            beforeImages: b.providerWorkProof?.beforeImages || [],
            afterImages: b.providerWorkProof?.afterImages || []
          },
          complaintProofs: b.complaintProofs || [],
          timeline: timeline,
          totalAmount: b.totalAmount,
          commissionAmount: b.commissionAmount,
          providerEarnings: b.providerEarnings,
          cancellationProgress: b.cancellationProgress || { refundAmount: b.refundAmount || 0 },
          cancelledBy: b.cancelledBy,
          refundAmount: b.refundAmount,
          platformFeeRetained: b.platformFeeRetained
        };
      }

      res.status(200).json({
        success: true,
        data: {
          complaint: enrichedData,
          booking: bookingData
        }
      });
    } catch (error) {
      console.error("Error fetching complaint details:", error);
      res.status(500).json({
        success: false,
        message: "Server Error"
      });
    }
  }

  static async replyToComplaint(req, res) {
    try {
      const { message } = req.body;
      const complaintId = req.params.id;
      const userRole = req.role || req.user?.role || req.admin?.role || 'admin';
      const userId = req.user?._id || req.admin?._id || req.adminID;

      const complaint = await Complaint.findById(complaintId);
      if (!complaint) {
        return res.status(404).json({ success: false, message: 'Complaint not found' });
      }

      // Security Validation: Authorize ownership of the complaint before allowing reply
      if (userRole === 'provider') {
        const providerId = complaint.providerId?._id || complaint.providerId || complaint.provider?._id || complaint.provider;
        if (!providerId || providerId.toString() !== userId.toString()) {
          return res.status(403).json({ success: false, message: 'Security Alert: Not authorized to reply to this complaint.' });
        }
      } else if (userRole === 'customer') {
        const customerId = complaint.userId?._id || complaint.userId || complaint.customer?._id || complaint.customer;
        if (!customerId || customerId.toString() !== userId.toString()) {
          return res.status(403).json({ success: false, message: 'Security Alert: Not authorized to reply to this complaint.' });
        }
      }

      // Auto status transition: if provider replies, transition to provider_responded
      if (userRole === 'provider' && ['submitted', 'under_review', 'Open', 'In-Progress'].includes(complaint.status)) {
        complaint.status = 'provider_responded';
        await complaint.save();
      }

      // Handle Image Uploads
      let images = [];
      if (req.files && req.files.length > 0) {
        images = req.files.map(file => ({
          url: file.path || file.secure_url
        }));
      }

      if (images.length === 0 && !message) {
        return res.status(400).json({ success: false, message: 'Message or images are required' });
      }

      // Update associated booking
      if (complaint.booking) {
        await Booking.findByIdAndUpdate(complaint.booking, {
          $push: {
            complaintProofs: {
              uploadedBy: userRole,
              images: images,
              message: message || 'Reply submitted',
              createdAt: new Date()
            }
          }
        });
      }

      res.json({
        success: true,
        message: 'Reply submitted successfully'
      });
    } catch (error) {
      console.error('Error replying to complaint:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

  static async enrichComplaintData(complaint, req = null, isDetail = false) {
    if (!complaint) return null;

    if (!isDetail) {
      let complaintType = 'N/A';
      const descriptionMatch = complaint.description?.match(/^\[(poor_quality|incomplete_work|provider_late|payment_issue|overcharged_service|behaviour_issue|cancel_booking|other|bad_work|late_arrival|rude_behavior|overcharge)\]/);
      if (descriptionMatch) complaintType = descriptionMatch[1];
      return {
        ...complaint,
        complaintType,
        customerFraudScore: 0,
        providerTrustScore: 100,
        evidenceStrength: 0,
        suggestedDecision: 'manual_review',
        recommendation: {
          action: 'manual_review',
          confidence: 50,
          confidenceLevel: 'Moderate',
          reasons: [],
          contraIndicators: [],
          isAdvisoryOnly: true,
          advisoryDisclaimer: 'Recommendation Only — Final decision requires explicit admin approval.'
        },
        resolutionHistory: []
      };
    }

    const Transaction = require('../models/Transaction-model');
    const ProviderEarning = require('../models/ProviderEarning-model');
    const Provider = require('../models/Provider-model');
    const Feedback = require('../models/Feedback-model');

    // ─── Extract Complaint Type ─────────────────────────────────
    let complaintType = 'N/A';
    const descriptionMatch = complaint.description?.match(/^\[(poor_quality|incomplete_work|provider_late|payment_issue|overcharged_service|behaviour_issue|cancel_booking|other|bad_work|late_arrival|rude_behavior|overcharge)\]/);
    if (descriptionMatch) complaintType = descriptionMatch[1];

    // ─── Provider Complaint History ─────────────────────────────
    let providerComplaintsCount = 0;
    const ComplaintModel = mongoose.model('Complaint');
    const providerId = complaint.providerId?._id || complaint.providerId || complaint.provider?._id || complaint.provider;

    const calculateAgeWeight = (date) => {
      if (!date) return 0.1;
      const daysElapsed = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysElapsed <= 30) return 1.0;
      if (daysElapsed <= 90) return 0.5;
      return 0.1;
    };

    if (providerId) {
      const providerComplaintsDocs = await ComplaintModel.find({ provider: providerId }).select('createdAt').lean();
      providerComplaintsCount = providerComplaintsDocs.reduce((sum, doc) => sum + calculateAgeWeight(doc.createdAt), 0);
    }

    // ─── Transaction / Payout / Evidence ───────────────────────
    let transactionData = null;
    let providerPayoutStatus = 'N/A';
    let refundStatus = 'N/A';
    let evidenceComparison = {
      beforeWorkImages: [],
      afterWorkImages: [],
      complaintImages: complaint.images?.map(img => img.secure_url) || []
    };

    if (complaint.booking) {
      transactionData = await Transaction.findOne({ booking: complaint.booking._id }).sort({ createdAt: -1 }).lean();
      if (transactionData) refundStatus = transactionData.refundStatus || 'N/A';

      const earning = await ProviderEarning.findOne({ booking: complaint.booking._id }).select('status').lean();
      if (earning) providerPayoutStatus = earning.status;

      if (complaint.booking.providerWorkProof) {
        evidenceComparison.beforeWorkImages = complaint.booking.providerWorkProof.beforeImages?.map(i => i.url) || [];
        evidenceComparison.afterWorkImages = complaint.booking.providerWorkProof.afterImages?.map(i => i.url) || [];
      }
      // Also pick up customer proofs from complaintProofs array
      if (complaint.booking.complaintProofs?.length > 0) {
        const customerProofImages = complaint.booking.complaintProofs
          .filter(p => p.uploadedBy === 'customer')
          .flatMap(p => p.images?.map(img => img.url) || []);
        if (customerProofImages.length > 0) evidenceComparison.complaintImages = customerProofImages;
      }
    }

    // Use cleaned description for "Complaint Created" note (title may contain template text)
    const cleanedDesc = (complaint.description || '').replace(/^\[.*?\]\n/, '').trim();
    const createdNote = cleanedDesc.length > 0 && cleanedDesc.length <= 200 ? cleanedDesc : undefined;
    const resolutionHistory = [
      { event: 'Complaint Created', timestamp: complaint.createdAt, by: complaint.userType === 'customer' ? 'Customer' : 'Provider', note: createdNote }
    ];
    if (complaint.statusHistory && complaint.statusHistory.length > 0) {
      // Track seen statuses to deduplicate (same status within 60s = duplicate)
      const seenStatuses = new Map();
      complaint.statusHistory.forEach((h, index) => {
        // Skip 'submitted' entries — already covered by "Complaint Created"
        if (h.status === 'submitted') {
          return;
        }

        // Deduplicate: skip if same status was already added within 60 seconds
        const ts = new Date(h.updatedAt || h.timestamp).getTime();
        const prevTs = seenStatuses.get(h.status);
        if (prevTs && Math.abs(ts - prevTs) < 60000) {
          return;
        }
        seenStatuses.set(h.status, ts);

        const isFinalStatus = ['resolved', 'Solved', 'rejected', 'refunded', 'Closed'].includes(h.status);
        const isLatest = index === (complaint.statusHistory.length - 1);

        let note = undefined;
        let by = 'Support Team';

        if ((isFinalStatus || isLatest) && (isLatest || h.status === complaint.status)) {
          note = complaint.resolutionNotes;
          by = complaint.resolvedBy?.name || 'Support Admin';
        } else if (h.status === 'Reopened' && complaint.reopenHistory?.length > 0) {
          note = complaint.reopenHistory[complaint.reopenHistory.length - 1]?.reason;
          by = complaint.userType === 'customer' ? 'Customer' : 'Provider';
        }

        resolutionHistory.push({
          event: `Status updated to ${h.status.replace(/_/g, ' ')}`,
          timestamp: h.updatedAt || h.timestamp,
          by: by,
          note: note
        });
      });
    }
    if (complaint.booking?.complaintProofs) {
      complaint.booking.complaintProofs.forEach(proof => {
        const proofTime = new Date(proof.createdAt).getTime();
        const complaintTime = new Date(complaint.createdAt).getTime();
        const timeDiffSeconds = Math.abs(proofTime - complaintTime) / 1000;

        const normalizedDesc = (complaint.description || '').replace(/^\[.*?\]\n/, '').trim();
        const normalizedMsg = (proof.message || '').trim();

        if (timeDiffSeconds < 15 && (normalizedDesc === normalizedMsg || normalizedDesc.includes(normalizedMsg) || normalizedMsg.includes(normalizedDesc))) {
          return;
        }

        const isAudit = proof.message && proof.message.startsWith('[Audit Trail]');
        resolutionHistory.push({
          event: isAudit ? 'Audit Trail Log' : `${proof.uploadedBy.charAt(0).toUpperCase() + proof.uploadedBy.slice(1)} Replied`,
          timestamp: proof.createdAt,
          by: isAudit ? 'System Audit' : (proof.uploadedBy === 'admin' ? 'Support Admin' : proof.uploadedBy.charAt(0).toUpperCase() + proof.uploadedBy.slice(1)),
          note: proof.message,
          images: proof.images?.map(img => img.url)
        });
      });
    }
    resolutionHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // ══════════════════════════════════════════════════════════════
    // 🧠 INTELLIGENT SCORING ENGINE (runtime only — NOT stored)
    // ══════════════════════════════════════════════════════════════

    // ─── 1. Complaint Score (0–100) ─────────────────────────────
    let complaintScore = 0;
    const desc = complaint.description?.replace(/^\[.*?\]\n/, '') || '';
    complaintScore += Math.min(desc.length / 10, 20);          // description depth (max 20)
    complaintScore += Math.min((complaint.images?.length || 0) * 15, 30); // attached images (max 30)
    const severityMap = { overcharge: 25, bad_work: 20, incomplete_work: 20, late_arrival: 10, rude_behavior: 10 };
    complaintScore += severityMap[complaintType] || 10;         // complaint type severity (max 25)
    const priorComplaints = await ComplaintModel.countDocuments({
      $or: [{ userId: complaint.userId }, { customer: complaint.customer }],
      _id: { $ne: complaint._id }
    });
    complaintScore += Math.min(priorComplaints * 5, 15);        // repeated complaints (max 15)
    complaintScore = Math.min(Math.round(complaintScore), 100);

    // ─── 2. Provider Metrics (avgRating, ratios, trust score) ─
    let providerHistory = { completedBookings: 0, avgRating: 0, complaintRatio: 0, cancellationRatio: 0, trustContributors: [] };
    let providerTrustScore = 100;
    const trustContributors = [];
    if (providerId) {
      const providerDoc = await Provider.findById(providerId)
        .select('completedBookings canceledBookings performanceScore')
        .lean();
      if (providerDoc) {
        const completed = providerDoc.completedBookings || 0;
        const cancelled = providerDoc.canceledBookings || 0;
        const avgRating = providerDoc.performanceScore?.rating || 0;
        const totalJobs = completed + cancelled;
        const cancelRatio = totalJobs > 0 ? cancelled / totalJobs : 0;
        const complaintRatio = completed > 0 ? providerComplaintsCount / completed : 0;

        providerHistory = {
          completedBookings: completed,
          avgRating: parseFloat(avgRating.toFixed(1)),
          complaintRatio: parseFloat((complaintRatio * 100).toFixed(1)),
          cancellationRatio: parseFloat((cancelRatio * 100).toFixed(1))
        };

        if (providerComplaintsCount > 0) {
          const penalty = Math.min(providerComplaintsCount * 8, 40);
          providerTrustScore -= penalty;
          trustContributors.push({ label: 'Multiple Complaints (Aged)', value: -Math.round(penalty) });
        }

        const compPct = providerHistory.complaintRatio;
        if (compPct > 20) {
          providerTrustScore -= 20;
          trustContributors.push({ label: 'High Complaint Ratio', value: -20 });
        } else if (compPct > 10) {
          providerTrustScore -= 10;
          trustContributors.push({ label: 'Moderate Complaint Ratio', value: -10 });
        }

        const cancelPct = providerHistory.cancellationRatio;
        if (cancelPct > 30) {
          providerTrustScore -= 20;
          trustContributors.push({ label: 'High Cancellation Ratio', value: -20 });
        } else if (cancelPct > 15) {
          providerTrustScore -= 10;
          trustContributors.push({ label: 'Moderate Cancellation Ratio', value: -10 });
        }

        if (avgRating < 3.0) {
          providerTrustScore -= 30;
          trustContributors.push({ label: 'Critical Rating (< 3.0)', value: -30 });
        } else if (avgRating < 4.0) {
          providerTrustScore -= 20;
          trustContributors.push({ label: 'Low Rating (< 4.0)', value: -20 });
        }

        providerTrustScore = Math.max(0, providerTrustScore);
        providerHistory.trustContributors = trustContributors;
      }
    }

    // ─── 3. Customer Fraud Score (0–100, higher = more suspicious) ─
    let customerFraudScore = 0;
    const warnings = [];
    const riskContributors = [];
    let customerHistory = { totalBookings: 0, refundRequests: 0, complaintCount: 0, accountAgeMonths: 0, riskContributors: [] };
    const customerUserId = complaint.userId?._id || complaint.userId || complaint.customer?._id || complaint.customer;
    if (customerUserId) {
      const User = require('../models/User-model');
      const FraudLog = require('../models/FraudLog-model');
      const userDoc = await User.findById(customerUserId).select('createdAt totalBookings').lean();

      const [totalBookingsDocs, refundedTxDocs, customerComplaintsDocs, flaggedLogsDocs] = await Promise.all([
        Booking.find({ customer: customerUserId }).select('createdAt status').lean(),
        Transaction.find({ user: customerUserId, $or: [{ refundStatus: 'completed' }, { paymentStatus: 'refunded' }] }).select('createdAt').lean(),
        ComplaintModel.find({ $or: [{ userId: customerUserId }, { customer: customerUserId }] }).select('createdAt').lean(),
        FraudLog.find({ userId: customerUserId, $or: [{ isFlagged: true }, { riskLevel: { $in: ['HIGH', 'CRITICAL'] } }] }).select('createdAt').lean()
      ]);

      const totalBookings = totalBookingsDocs.length;
      const weightedRefundedTx = refundedTxDocs.reduce((sum, doc) => sum + calculateAgeWeight(doc.createdAt), 0);
      const weightedCustomerComplaints = customerComplaintsDocs.reduce((sum, doc) => sum + calculateAgeWeight(doc.createdAt), 0);
      const weightedFlaggedLogs = flaggedLogsDocs.reduce((sum, doc) => sum + calculateAgeWeight(doc.createdAt), 0);

      const cancelledDocs = totalBookingsDocs.filter(b => b.status === 'cancelled');
      const weightedCancellations = cancelledDocs.reduce((sum, doc) => sum + calculateAgeWeight(doc.createdAt), 0);
      const cancelRate = totalBookings > 0 ? weightedCancellations / totalBookings : 0;

      const ageMs = userDoc ? Date.now() - new Date(userDoc.createdAt).getTime() : 0;
      const ageMonths = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 30));

      customerHistory = {
        totalBookings,
        refundRequests: refundedTxDocs.length,
        complaintCount: customerComplaintsDocs.length,
        accountAgeMonths: ageMonths
      };

      if (weightedRefundedTx > 0) {
        const score = Math.min(weightedRefundedTx * 8, 24);
        customerFraudScore += score;
        riskContributors.push({ label: 'Refund History (Aged)', value: Math.round(score) });
      }
      if (cancelRate > 0) {
        const score = Math.min(cancelRate * 20, 15);
        customerFraudScore += score;
        riskContributors.push({ label: 'Cancellation History (Aged)', value: Math.round(score) });
      }
      if (weightedCustomerComplaints > 0) {
        const score = Math.min(weightedCustomerComplaints * 3, 12);
        customerFraudScore += score;
        riskContributors.push({ label: 'Repeated Complaints (Aged)', value: Math.round(score) });
      }
      if (ageMonths < 3) {
        customerFraudScore += 8;
        riskContributors.push({ label: 'New Account Penalty', value: 8 });
      }

      const identicalComplaints = await ComplaintModel.countDocuments({
        customer: customerUserId,
        description: complaint.description,
        _id: { $ne: complaint._id }
      });
      if (identicalComplaints > 0) {
        customerFraudScore += 35;
        riskContributors.push({ label: 'Duplicate Description', value: 35 });
        warnings.push('Duplicate or copy-paste complaint text detected');
      }

      const recentComplaintsCount = await ComplaintModel.countDocuments({
        customer: customerUserId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      if (recentComplaintsCount > 2) {
        customerFraudScore += 30;
        riskContributors.push({ label: 'Complaint Burst', value: 30 });
        warnings.push('Suspiciously high complaint frequency in 24 hours');
      }

      if (complaint.images && complaint.images.length > 0) {
        const secureUrls = complaint.images.map(img => img.secure_url).filter(Boolean);
        if (secureUrls.length > 0) {
          const duplicateImageComplaint = await ComplaintModel.findOne({
            _id: { $ne: complaint._id },
            'images.secure_url': { $in: secureUrls }
          });
          if (duplicateImageComplaint) {
            customerFraudScore += 40;
            riskContributors.push({ label: 'Duplicate Images', value: 40 });
            warnings.push('Same proof image reuse across different complaints detected!');
          }
        }
      }

      if (weightedFlaggedLogs > 0) {
        const score = Math.min(weightedFlaggedLogs * 25, 50);
        customerFraudScore += score;
        riskContributors.push({ label: 'Flagged Abuse History (Aged)', value: Math.round(score) });
        warnings.push('User is flagged in Fraud logs for suspicious activities');
      }

      customerFraudScore = Math.max(0, Math.min(Math.round(customerFraudScore), 100));
      customerHistory.riskContributors = riskContributors;
    }

    // ─── 4. Evidence Strength (0–100) ──────────────────────────
    let evidenceStrength = 0;
    const hasBefore = evidenceComparison.beforeWorkImages.length > 0;
    const hasAfter = evidenceComparison.afterWorkImages.length > 0;
    const hasCustomer = evidenceComparison.complaintImages.length > 0;
    if (hasCustomer) evidenceStrength += 35;  // customer uploaded proof
    if (hasBefore) evidenceStrength += 20;  // provider before proof
    if (hasAfter) evidenceStrength += 20;  // provider after proof
    if (!hasBefore && !hasAfter) evidenceStrength += 25; // provider missing proof → boosts claim
    evidenceStrength = Math.min(evidenceStrength, 100);

    // ─── 5. Decision Assistant (FIX 2 & FIX 6) ──────────────────────────
    let suggestedDecision = 'manual_review';
    let confidence = 50;
    let confidenceLevel = 'Moderate';
    const reasons = [];
    const contraIndicators = [];

    // Evaluate evidence first:
    const providerMissingProof = !hasBefore && !hasAfter;

    if (hasCustomer && providerMissingProof) {
      reasons.push('Customer provided photo evidence while provider failed to upload work proofs');
      if (customerFraudScore < 30) {
        suggestedDecision = 'approve_refund';
        confidence = 90;
        confidenceLevel = 'High';
      } else if (customerFraudScore < 55) {
        suggestedDecision = 'approve_refund';
        confidence = 70;
        confidenceLevel = 'Moderate';
        reasons.push('Customer has moderate risk score, but evidence points to provider fault');
      } else {
        suggestedDecision = 'manual_review';
        confidence = 60;
        confidenceLevel = 'Moderate';
        contraIndicators.push('High customer fraud/suspicious score overrides auto-approval');
      }
    } else if (hasCustomer && (hasBefore || hasAfter)) {
      // Both parties submitted evidence
      suggestedDecision = 'manual_review';
      confidence = 65;
      confidenceLevel = 'Moderate';
      reasons.push('Both customer and provider submitted photo evidence. Requires visual validation.');
      if (customerFraudScore >= 55) {
        contraIndicators.push('Customer has a high risk profile');
      }
    } else if (!hasCustomer) {
      suggestedDecision = 'reject_refund';
      confidence = 85;
      confidenceLevel = 'High';
      reasons.push('Customer failed to submit any supporting evidence for the complaint');
      if (hasBefore || hasAfter) {
        reasons.push('Provider successfully uploaded service work proofs');
      }
    }

    // Trust factors adjustments
    if (customerFraudScore >= 55) {
      if (suggestedDecision === 'approve_refund') {
        suggestedDecision = 'manual_review';
        confidence = 55;
        confidenceLevel = 'Moderate';
      } else if (suggestedDecision === 'manual_review') {
        suggestedDecision = 'reject_refund';
        confidence = 70;
        confidenceLevel = 'Moderate';
      }
      reasons.push('Suspicious customer behavior metrics or repeated refund requests');
    }

    if (providerHistory && providerHistory.avgRating < 3.5) {
      reasons.push('Provider has a critically low rating (< 3.5 ★)');
      if (suggestedDecision === 'reject_refund') {
        suggestedDecision = 'manual_review';
        confidence = 60;
        confidenceLevel = 'Moderate';
        contraIndicators.push('Provider has poor service history, rejection may be premature');
      } else if (suggestedDecision === 'manual_review') {
        confidence = 75;
        confidenceLevel = 'Moderate';
      }
    }

    // Refund Eligible Classification
    let isRefundEligible = false;
    let eligibilityReason = "Technical Support Ticket";

    const refundEligibleCategories = [
      'Poor Quality',
      'Incomplete Work',
      'Service Not Delivered',
      'Overcharged Service',
      'Provider No Show',
      'poor_quality',
      'incomplete_work',
      'provider_late',
      'payment_issue',
      'overcharged_service',
      'provider_no_show',
      'provider_not_responding',
      'cancel_booking',
      'wrong_service',
      'provider_left_job',
      'safety_issue'
    ];

    const category = complaint.category || '';
    const matchedCategory = refundEligibleCategories.some(c =>
      c.toLowerCase().replace(/[\s_-]/g, '') === category.toLowerCase().replace(/[\s_-]/g, '')
    ) || (complaintType && refundEligibleCategories.some(c =>
      c.toLowerCase().replace(/[\s_-]/g, '') === complaintType.toLowerCase().replace(/[\s_-]/g, '')
    ));

    if (matchedCategory) {
      isRefundEligible = true;
      eligibilityReason = "Service Quality Issue";
    } else {
      isRefundEligible = false;
      const lowerCat = category.toLowerCase();
      if (lowerCat.includes('account') || lowerCat.includes('login') || lowerCat.includes('otp') || lowerCat.includes('verification') || lowerCat.includes('profile')) {
        eligibilityReason = "Account Verification Issue";
      } else if (lowerCat.includes('bug') || lowerCat.includes('error') || lowerCat.includes('technical')) {
        eligibilityReason = "Technical Support Ticket";
      } else if (lowerCat.includes('suggestion') || lowerCat.includes('feedback')) {
        eligibilityReason = "Feedback/Suggestion";
      } else {
        eligibilityReason = "General Inquiry";
      }
    }

    // ── Advisory-Only Recommendation (platform_credit is NEVER auto-suggested) ──
    // The system may only recommend — never auto-execute. Admin holds final control.
    let advisoryAction = isRefundEligible ? suggestedDecision : 'support_resolution';
    // Override: platform_credit must never be auto-recommended (admin-only manual action)
    if (advisoryAction === 'platform_credit') {
      advisoryAction = 'manual_review';
    }
    const recommendation = {
      action: advisoryAction,
      confidence: isRefundEligible ? confidence : 100,
      confidenceLevel: isRefundEligible ? confidenceLevel : 'High',
      reasons: isRefundEligible ? reasons : ['Non-refund complaint category routed to Support Resolution Flow.'],
      contraIndicators: isRefundEligible ? contraIndicators : [],
      isAdvisoryOnly: true,
      advisoryDisclaimer: 'Recommendation Only — Final decision requires explicit admin approval.'
    };

    // ─── 6. SLA Tracking (FIX 5) ──────────────────────────
    const now = new Date();
    const createdAtTime = new Date(complaint.createdAt);
    const hoursElapsed = Math.abs(now - createdAtTime) / 36e5;

    // Retrieve configuration dynamically where possible (SLA timing overrides) (Fix 1)
    const { SystemConfig } = require('../models/SystemSetting-model');
    const systemConfigDoc = await SystemConfig.findOne().lean();
    const configHours = systemConfigDoc?.bookingSettings?.refundReviewHours || 48;
    const providerSlaHours = systemConfigDoc?.bookingSettings?.providerResponseSlaHours || 24;
    const refundSlaHours = systemConfigDoc?.bookingSettings?.refundProcessingSlaHours || 72;

    let slaThreshold = configHours; // Admin Review SLA dynamically loaded from System Settings
    let stage = 'admin_review';
    if (complaint.status === 'submitted' || complaint.status === 'under_review') {
      slaThreshold = providerSlaHours; // Provider Response SLA
      stage = 'provider_response';
    } else if (complaint.status === 'resolved' || complaint.status === 'refunded') {
      slaThreshold = refundSlaHours; // Refund Processing SLA
      stage = 'refund_processing';
    }

    let slaStatus = 'within_sla';
    const thresholdPercentage = (hoursElapsed / slaThreshold) * 100;
    if (hoursElapsed >= slaThreshold) {
      slaStatus = 'breached';
    } else if (hoursElapsed >= slaThreshold * 0.8) {
      slaStatus = 'warning';
    }

    const slaTracking = {
      stage,
      slaThresholdHours: slaThreshold,
      hoursElapsed: parseFloat(hoursElapsed.toFixed(1)),
      slaStatus,
      percentageUsed: Math.min(Math.round(thresholdPercentage), 100),
      deadline: new Date(createdAtTime.getTime() + slaThreshold * 60 * 60 * 1000)
    };

    // ─── 7. Refund Recovery Path Preview (FIX 3 & 4) ──────────────────────────
    let refundRecoveryPath = [];
    let refundSimulation = null;
    const booking = complaint.booking;
    if (isRefundEligible && booking && (booking.totalAmount || 0) > 0) {
      const sim = await calculateRecoverySplits(booking, booking.totalAmount, 'shared', false);
      refundSimulation = sim;

      refundRecoveryPath = [
        {
          source: 'held_earnings',
          label: 'Held Earnings',
          amount: sim.splits.held,
          description: 'Funds currently locked in pending held state.'
        },
        {
          source: 'pending_release',
          label: 'Pending Release',
          amount: sim.splits.pendingRelease,
          description: 'Escrow earnings awaiting final release window.'
        },
        {
          source: 'available',
          label: 'Available',
          amount: sim.splits.available,
          description: 'Escrow earnings already settled and available.'
        },
        {
          source: 'provider_wallet',
          label: 'Provider Wallet',
          amount: sim.splits.paidWithdrawn,
          description: 'Payout already processed; will be recovered from wallet balance.',
          requiresWarning: sim.splits.paidWithdrawn > 0
        },
        {
          source: 'platform_commission',
          label: 'Platform Absorption',
          amount: sim.splits.platformAbsorption,
          description: 'Absorbed charges from platform commission fees.'
        }
      ];
    }

    // ─── Warnings ───────────────────────────────────────────────
    if (customerFraudScore >= 55 && !warnings.includes('High refund abuse risk detected')) warnings.push('High refund abuse risk detected');
    if (providerHistory && providerHistory.avgRating <= 3.0 && !warnings.includes('Provider has low average rating')) warnings.push('Provider has low average rating');
    if (!hasBefore && !hasAfter && !warnings.includes('Provider uploaded no work proof')) warnings.push('Provider uploaded no work proof');

    // Dynamic riskScore calculation for non-customers
    const finalRiskScore = customerUserId ? (customerFraudScore >= 55 ? 'high' : customerFraudScore >= 30 ? 'medium' : 'low') : 'low';

    // ─── 8. Case Age (hoursOpen / daysOpen) ────────────────────
    const ageMs = Date.now() - new Date(complaint.createdAt).getTime();
    const hoursOpen = Math.floor(ageMs / 36e5);
    const daysOpen = Math.floor(hoursOpen / 24);

    // ─── 9. Dynamic Priority Classification ────────────────────
    const bookingAmount = (complaint.booking?.totalAmount || 0);
    const criticalCategories = [
      'Service Not Delivered', 'Provider No Show',
      'service_not_delivered', 'provider_no_show'
    ];
    const isCriticalCategory = criticalCategories.some(c =>
      (complaint.category || '').toLowerCase().replace(/[\s_-]/g, '') === c.toLowerCase().replace(/[\s_-]/g, '') ||
      (complaintType || '').toLowerCase().replace(/[\s_-]/g, '') === c.toLowerCase().replace(/[\s_-]/g, '')
    );

    let priority = 'Low';
    if ((isCriticalCategory && bookingAmount >= 2000) || (evidenceStrength >= 75 && customerFraudScore < 30 && bookingAmount >= 1500)) {
      priority = 'Critical';
    } else if (isCriticalCategory || bookingAmount >= 1000 || evidenceStrength >= 60) {
      priority = 'High';
    } else if (bookingAmount >= 500 || evidenceStrength >= 30) {
      priority = 'Medium';
    }

    return {
      ...complaint,
      complaintType,
      providerComplaintsCount,
      transaction: transactionData,
      providerPayoutStatus,
      refundStatus,
      evidenceComparison,
      resolutionHistory,
      // ── Smart AI Scores (runtime only) ──
      complaintScore,
      customerFraudScore,
      providerTrustScore,
      riskScore: finalRiskScore,
      evidenceStrength,
      suggestedDecision,
      recommendation,
      slaTracking,
      refundRecoveryPath,
      refundSimulation,
      isRefundEligible,
      eligibilityReason,
      isAppealOpen: !!(complaint.responseDeadline && new Date() < new Date(complaint.responseDeadline) && !(complaint.booking?.complaintProofs?.some(p => p.uploadedBy === 'provider'))),
      warnings,
      providerHistory,
      customerHistory,
      // ── Case Age ──
      hoursOpen,
      daysOpen,
      // ── Dynamic Priority ──
      priority
    };
  }

}

module.exports = ComplaintService;

