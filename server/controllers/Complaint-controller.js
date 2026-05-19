const Complaint = require('../models/Complaint-model');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const mongoose = require('mongoose');
const { notifyAdmins } = require('../utils/notificationHelper');
const { generateComplaintId } = require('../utils/generateUniqueId');


// @desc    Submit a new complaint
// @route   POST /api/complaints
// @access  Private (Customer)
const submitComplaint = async (req, res) => {
  try {
    const { title, description, category, bookingId, complaintType } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    // 1. Validation
    if (!title || !description || !category) {
      return res.status(400).json({ message: 'Please provide title, description, and category.' });
    }

    // Validate Complaint Type if provided
    const validTypes = ['bad_work', 'late_arrival', 'rude_behavior', 'incomplete_work', 'overcharge'];
    if (complaintType && !validTypes.includes(complaintType)) {
      return res.status(400).json({ message: 'Invalid complaint type.' });
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
        return res.status(400).json({ message: 'Booking ID is required for service-related complaints.' });
      }
      booking = await Booking.findById(bookingId);
      if (!booking || booking.customer.toString() !== userId.toString()) {
        return res.status(404).json({ message: 'Booking not found or you are not authorized.' });
      }
      if (!booking.provider) {
        return res.status(400).json({ message: 'Cannot submit complaint for booking without assigned provider.' });
      }
      provider = booking.provider;

      // Prevent duplicate complaint submissions for same booking by same user
      const existingComplaint = await Complaint.findOne({
        booking: bookingId,
        role: userRole,
        status: { $in: ['Open', 'In-Progress', 'Reopened'] }
      });
      if (existingComplaint) {
        return res.status(400).json({
          success: false,
          message: 'There is already an active dispute or complaint open for this booking. Please wait for resolution.'
        });
      }
    }

    // 2. Handle Image Uploads
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => ({
        secure_url: file.path,
        public_id: file.filename,
      }));
    }

    // 3. Prepare Description with Complaint Type
    const formattedDescription = complaintType ? `[${complaintType}]\n${description}` : description;

    // 4. Create Complaint
    const complaint = await Complaint.create({
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
      role: userRole
    });

    // Invalidate dashboard caches
    try {


    } catch (e) { }

    res.status(201).json({
      success: true,
      message: 'Support ticket submitted successfully',
      complaint
    });

    // Update Booking with complaint proof and set dispute status
    if (bookingId) {
      try {
        const updateData = {
          $push: {
            complaintProofs: {
              uploadedBy: userRole,
              images: images.map(img => ({ url: img.secure_url })),
              message: description,
              createdAt: new Date()
            }
          }
        };

        // If customer raises service issue, mark as dispute
        if (category === 'Service issue' && userRole === 'customer') {
          updateData.disputeRaised = true;
          updateData.disputeStatus = 'under_review'; // Consistent with existing enum in model if possible, or lowercase

          // Hold provider earnings if they exist
          const ProviderEarning = mongoose.model('ProviderEarning');
          await ProviderEarning.findOneAndUpdate(
            { booking: bookingId },
            { status: 'held' }
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

        await Booking.findByIdAndUpdate(bookingId, updateData);
      } catch (err) {
        console.error('Error updating booking with complaint proof:', err);
      }
    }

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
    console.error('Error submitting complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting complaint.'
    });
  }
};



// @desc    Get all complaints (for admins) with filtering, searching, and pagination
// @route   GET /api/complaints
// @access  Private (Admin)
const getAllComplaints = async (req, res) => {
  try {
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
      .populate('booking', 'date services bookingId complaintProofs providerWorkProof disputeStatus adminRefundDecision paymentStatus statusHistory cancellationProgress totalAmount')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const total = await Complaint.countDocuments(query);

    // Add total complaints count for the provider involved in each complaint
    const complaintsWithStats = await Promise.all(complaints.map(async (c) => {
      let providerComplaintsCount = 0;
      if (c.provider) {
        providerComplaintsCount = await Complaint.countDocuments({ provider: c.provider._id || c.provider });
      }
      return { ...c, providerComplaintsCount };
    }));

    res.json({
      success: true,
      data: complaintsWithStats,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get complaints for the logged-in user (customer or provider)
// @route   GET /api/complaints/my-complaints
// @access  Private
const getMyComplaints = async (req, res) => {
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
};

// @desc    Get a single complaint by ID
// @route   GET /api/complaints/:id
// @access  Private
const enrichComplaintData = async (complaint) => {
  if (!complaint) return null;

  const Transaction = require('../models/Transaction-model');
  const ProviderEarning = require('../models/ProviderEarning-model');
  const Provider = require('../models/Provider-model');
  const Feedback = require('../models/Feedback-model');

  // ─── Extract Complaint Type ─────────────────────────────────
  let complaintType = 'N/A';
  const descriptionMatch = complaint.description?.match(/^\[(bad_work|late_arrival|rude_behavior|incomplete_work|overcharge)\]/);
  if (descriptionMatch) complaintType = descriptionMatch[1];

  // ─── Provider Complaint History ─────────────────────────────
  let providerComplaintsCount = 0;
  const ComplaintModel = mongoose.model('Complaint');
  const providerId = complaint.providerId?._id || complaint.providerId || complaint.provider?._id || complaint.provider;
  if (providerId) {
    providerComplaintsCount = await ComplaintModel.countDocuments({ provider: providerId });
  }

  // ─── Transaction / Payout / Evidence ───────────────────────
  let transactionData = null;
  let providerPayoutStatus = 'N/A';
  let refundStatus = 'N/A';
  let evidenceComparison = {
    beforeWorkImages: [],
    afterWorkImages:  [],
    complaintImages:  complaint.images?.map(img => img.secure_url) || []
  };

  if (complaint.booking) {
    transactionData = await Transaction.findOne({ booking: complaint.booking._id }).sort({ createdAt: -1 }).lean();
    if (transactionData) refundStatus = transactionData.refundStatus || 'N/A';

    const earning = await ProviderEarning.findOne({ booking: complaint.booking._id }).select('status').lean();
    if (earning) providerPayoutStatus = earning.status;

    if (complaint.booking.providerWorkProof) {
      evidenceComparison.beforeWorkImages = complaint.booking.providerWorkProof.beforeImages?.map(i => i.url) || [];
      evidenceComparison.afterWorkImages  = complaint.booking.providerWorkProof.afterImages?.map(i => i.url)  || [];
    }
    // Also pick up customer proofs from complaintProofs array
    if (complaint.booking.complaintProofs?.length > 0) {
      const customerProofImages = complaint.booking.complaintProofs
        .filter(p => p.uploadedBy === 'customer')
        .flatMap(p => p.images?.map(img => img.url) || []);
      if (customerProofImages.length > 0) evidenceComparison.complaintImages = customerProofImages;
    }
  }

  // ─── Resolution History ─────────────────────────────────────
  const resolutionHistory = [
    { event: 'Complaint Created', timestamp: complaint.createdAt, by: complaint.userType === 'customer' ? 'Customer' : 'Provider', note: complaint.title },
    ...(complaint.statusHistory || []).map(h => ({ event: `Status changed to ${h.status}`, timestamp: h.updatedAt || h.timestamp, by: 'System/Admin' }))
  ];
  if (complaint.booking?.complaintProofs) {
    complaint.booking.complaintProofs.forEach(proof => {
      resolutionHistory.push({
        event: `${proof.uploadedBy.charAt(0).toUpperCase() + proof.uploadedBy.slice(1)} Replied`,
        timestamp: proof.createdAt, by: proof.uploadedBy, note: proof.message,
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

  // ─── 2. Provider Trust Score (0–100, higher = more trustworthy) ─
  let providerTrustScore = 50; // neutral baseline
  let providerHistory = { completedBookings: 0, avgRating: 0, complaintRatio: 0, cancellationRatio: 0 };
  if (providerId) {
    const providerDoc = await Provider.findById(providerId)
      .select('completedBookings cancelledBookings averageRating performanceScore')
      .lean();
    if (providerDoc) {
      const completed   = providerDoc.completedBookings   || 0;
      const cancelled   = providerDoc.cancelledBookings   || 0;
      const rawRating   = providerDoc.averageRating || providerDoc.performanceScore || 0;
      const avgRating   = Number(rawRating) || 0;
      const totalJobs   = completed + cancelled;
      const cancelRatio = totalJobs > 0 ? cancelled / totalJobs : 0;
      const complaintRatio = completed > 0 ? providerComplaintsCount / completed : 0;

      providerHistory = {
        completedBookings: completed,
        avgRating: parseFloat(avgRating.toFixed(1)),
        complaintRatio: parseFloat((complaintRatio * 100).toFixed(1)),
        cancellationRatio: parseFloat((cancelRatio * 100).toFixed(1))
      };

      providerTrustScore  = 50;
      providerTrustScore += Math.min(completed / 5, 20);               // experience bonus (max 20)
      providerTrustScore += Math.min((avgRating / 5) * 20, 20);        // rating bonus (max 20)
      providerTrustScore -= Math.min(providerComplaintsCount * 8, 30); // complaint penalty (max -30)
      providerTrustScore -= Math.min(cancelRatio * 20, 20);            // cancellation penalty (max -20)
      providerTrustScore  = Math.max(0, Math.min(Math.round(providerTrustScore), 100));
    }
  }

  // ─── 3. Customer Fraud Score (0–100, higher = more suspicious) ─
  let customerFraudScore = 0;
  const warnings = [];
  let customerHistory = { totalBookings: 0, refundRequests: 0, complaintCount: 0, accountAgeMonths: 0 };
  const customerUserId = complaint.userId?._id || complaint.userId || complaint.customer?._id || complaint.customer;
  if (customerUserId) {
    const User = require('../models/User-model');
    const userDoc = await User.findById(customerUserId).select('createdAt totalBookings').lean();
    const [totalBookings, refundedTx, customerComplaints] = await Promise.all([
      Booking.countDocuments({ customer: customerUserId }),
      Transaction.countDocuments({ user: customerUserId, refundStatus: { $in: ['refunded', 'partial'] } }),
      ComplaintModel.countDocuments({ $or: [{ userId: customerUserId }, { customer: customerUserId }] })
    ]);

    const cancelled = await Booking.countDocuments({ customer: customerUserId, status: 'cancelled' });
    const cancelRate = totalBookings > 0 ? cancelled / totalBookings : 0;
    const ageMs = userDoc ? Date.now() - new Date(userDoc.createdAt).getTime() : 0;
    const ageMonths = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 30));

    customerHistory = {
      totalBookings,
      refundRequests: refundedTx,
      complaintCount: customerComplaints,
      accountAgeMonths: ageMonths
    };

    customerFraudScore += Math.min(refundedTx * 15, 40);              // refund abuse (max 40)
    customerFraudScore += Math.min(cancelRate * 30, 25);              // cancellation rate (max 25)
    customerFraudScore += Math.min(customerComplaints * 5, 20);       // repeated complaints (max 20)
    if (ageMonths < 3) customerFraudScore += 15;                      // new account penalty (max 15)

    // Copy-paste and complaint frequency check
    const identicalComplaints = await ComplaintModel.countDocuments({
      customer: customerUserId,
      description: complaint.description,
      _id: { $ne: complaint._id }
    });
    if (identicalComplaints > 0) {
      customerFraudScore += 30; // Highly suspicious of copy-paste spam
      warnings.push('Duplicate or copy-paste complaint text detected');
    }

    // Suspicious frequency check (more than 2 complaints in the last 24 hours)
    const recentComplaintsCount = await ComplaintModel.countDocuments({
      customer: customerUserId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    if (recentComplaintsCount > 2) {
      customerFraudScore += 25; // Repeated complaint spam
      warnings.push('Suspiciously high complaint frequency in 24 hours');
    }

    customerFraudScore = Math.max(0, Math.min(Math.round(customerFraudScore), 100));
  }

  // ─── 4. Evidence Strength (0–100) ──────────────────────────
  let evidenceStrength = 0;
  const hasBefore    = evidenceComparison.beforeWorkImages.length > 0;
  const hasAfter     = evidenceComparison.afterWorkImages.length > 0;
  const hasCustomer  = evidenceComparison.complaintImages.length > 0;
  if (hasCustomer)          evidenceStrength += 35;  // customer uploaded proof
  if (hasBefore)            evidenceStrength += 20;  // provider before proof
  if (hasAfter)             evidenceStrength += 20;  // provider after proof
  if (!hasBefore && !hasAfter) evidenceStrength += 25; // provider missing proof → boosts claim
  evidenceStrength = Math.min(evidenceStrength, 100);

  // ─── 5. Suggested Decision ─────────────────────────────────
  let suggestedDecision = 'manual_review';
  if (customerFraudScore >= 60 && providerTrustScore >= 60) {
    suggestedDecision = 'reject_refund';
  } else if (evidenceStrength >= 55 && providerComplaintsCount >= 2) {
    suggestedDecision = 'approve_refund';
  } else if (complaintScore >= 65 && providerTrustScore < 40) {
    suggestedDecision = 'approve_refund';
  } else if (customerFraudScore >= 70) {
    suggestedDecision = 'reject_refund';
  } else {
    suggestedDecision = 'manual_review';
  }

  // ─── Warnings ───────────────────────────────────────────────
  if (customerFraudScore >= 60 && !warnings.includes('High refund abuse risk detected')) warnings.push('High refund abuse risk detected');
  if (providerTrustScore <= 30 && !warnings.includes('Provider has repeated complaints')) warnings.push('Provider has repeated complaints');
  if (!hasBefore && !hasAfter && !warnings.includes('Provider uploaded no work proof')) warnings.push('Provider uploaded no work proof');

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
    providerTrustScore,
    customerFraudScore,
    evidenceStrength,
    suggestedDecision,
    warnings,
    providerHistory,
    customerHistory
  };
};


// @desc    Get a single complaint by ID
// @route   GET /api/complaints/:id
// @access  Private
const getComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('userId', 'name email phone')
      .populate('providerId', 'name email phone')
      .populate('booking', 'date services bookingId complaintProofs providerWorkProof disputeStatus adminRefundDecision paymentStatus statusHistory payoutHoldUntil totalAmount cancellationProgress')
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

    const enrichedData = await enrichComplaintData(complaint);

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
};

// @desc    Resolve a complaint
// @route   PUT /api/complaints/:id/resolve
// @access  Private (Admin)
const resolveComplaint = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { resolutionNotes, decision } = req.body; // decision: 'approve_refund' | 'reject_refund' | 'manual_review'
    if (!resolutionNotes) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Resolution notes are required.' });
    }

    const complaint = await Complaint.findById(req.params.id).populate('booking').session(session);
    if (!complaint) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Complaint not found' });
    }

    complaint.status = 'Solved';
    complaint.resolvedBy = req.admin?._id || req.user?._id;
    complaint.resolutionNotes = resolutionNotes;
    await complaint.save({ session });

    // ── Auto payout control based on decision ──────────────────
    if (complaint.booking) {
      const ProviderEarning = mongoose.model('ProviderEarning');
      const bookingId = complaint.booking._id || complaint.booking;

      if (decision === 'reject_refund') {
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
      } else if (decision === 'approve_refund') {
        // ── Refund Safety Checks ──
        if (complaint.booking.paymentStatus !== 'paid' && complaint.booking.paymentStatus !== 'completed') {
           console.log('Cannot refund: Booking payment status is not paid');
        } else if (!['online', 'wallet'].includes(complaint.booking.paymentMethod)) {
           console.log('Cannot refund: Booking payment method is not online or wallet');
        } else if (complaint.booking.paymentStatus === 'refunded' || complaint.booking.adminRefundDecision === 'approved') {
           console.log('Cannot refund: Booking already refunded');
        } else {
          // Refund approved → keep earning held/cancelled
          await ProviderEarning.findOneAndUpdate(
            { booking: bookingId },
            { status: 'cancelled' },
            { session }
          );
          await Booking.findByIdAndUpdate(bookingId, {
            disputeStatus: 'resolved',
            adminRefundDecision: 'approved'
          }, { session });
        }
      }
      // manual_review → no payout change, admin will act separately
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
};

// @desc    Update complaint status
// @route   PUT /api/complaints/:id/status
// @access  Private (Admin)
const updateComplaintStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["Open", "In-Progress", "Solved", "Reopened", "Closed"];

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

    complaint.status = status;

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
};

// GET /api/complaints/:id/details (Admin only - full details)
const getComplaintDetails = async (req, res) => {
  try {
    const { id } = req.params;

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

    const enrichedData = await enrichComplaintData(complaint);

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
        timeline: timeline
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
};

// @desc    Reopen a complaint
// @route   PUT /api/complaints/:id/reopen
// @access  Private (Customer)
const reopenComplaint = async (req, res) => {
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
};

// @desc    Add a reply/proof to a complaint
// @route   POST /api/complaints/:id/reply
// @access  Private (Admin, Provider)
const replyToComplaint = async (req, res) => {
  try {
    const { message } = req.body;
    const complaintId = req.params.id;
    const userRole = req.user?.role || req.admin?.role || 'admin';
    const userId = req.user?._id || req.admin?._id;

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found' });
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
};

module.exports = {
  submitComplaint,
  getAllComplaints,
  getMyComplaints,
  getComplaint,
  resolveComplaint,
  updateComplaintStatus,
  reopenComplaint,
  getComplaintDetails,
  replyToComplaint
};
