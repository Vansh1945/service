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
// Helper to enrich complaint data with history, evidence, etc.
const enrichComplaintData = async (complaint) => {
  if (!complaint) return null;

  // Extract Complaint Type from description if present
  let complaintType = 'N/A';
  const descriptionMatch = complaint.description?.match(/^\[(bad_work|late_arrival|rude_behavior|incomplete_work|overcharge)\]/);
  if (descriptionMatch) {
    complaintType = descriptionMatch[1];
  }

  // Add total complaints count for the provider involved
  let providerComplaintsCount = 0;
  const Complaint = mongoose.model('Complaint');
  if (complaint.providerId) {
    providerComplaintsCount = await Complaint.countDocuments({
      providerId: complaint.providerId._id || complaint.providerId
    });
  } else if (complaint.provider) {
    providerComplaintsCount = await Complaint.countDocuments({
      provider: complaint.provider._id || complaint.provider
    });
  }

  // Add transaction, payout, and refund data
  let transactionData = null;
  let providerPayoutStatus = 'N/A';
  let refundStatus = 'N/A';
  let evidenceComparison = {
    beforeWorkImages: [],
    afterWorkImages: [],
    complaintImages: complaint.images?.map(img => img.secure_url) || []
  };

  if (complaint.booking) {
    const Transaction = require('../models/Transaction-model');
    const ProviderEarning = require('../models/ProviderEarning-model');

    transactionData = await Transaction.findOne({ booking: complaint.booking._id }).sort({ createdAt: -1 }).lean();

    if (transactionData) {
      refundStatus = transactionData.refundStatus || 'N/A';
    }

    const earning = await ProviderEarning.findOne({ booking: complaint.booking._id }).select('status').lean();
    if (earning) {
      providerPayoutStatus = earning.status;
    }

    // Populate evidence comparison from booking proofs
    if (complaint.booking.providerWorkProof) {
      evidenceComparison.beforeWorkImages = complaint.booking.providerWorkProof.beforeImages?.map(img => img.url) || [];
      evidenceComparison.afterWorkImages = complaint.booking.providerWorkProof.afterImages?.map(img => img.url) || [];
    }
  }

  // Format Resolution History
  const resolutionHistory = [
    {
      event: "Complaint Created",
      timestamp: complaint.createdAt,
      by: complaint.userType === 'customer' ? 'Customer' : 'Provider',
      note: complaint.title
    },
    ...(complaint.statusHistory || []).map(h => ({
      event: `Status changed to ${h.status}`,
      timestamp: h.updatedAt || h.timestamp,
      by: 'System/Admin'
    }))
  ];

  // Include replies from booking.complaintProofs as part of resolution history
  if (complaint.booking?.complaintProofs) {
    complaint.booking.complaintProofs.forEach(proof => {
      resolutionHistory.push({
        event: `${proof.uploadedBy.charAt(0).toUpperCase() + proof.uploadedBy.slice(1)} Replied`,
        timestamp: proof.createdAt,
        by: proof.uploadedBy,
        note: proof.message,
        images: proof.images?.map(img => img.url)
      });
    });
  }

  // Sort history by timestamp
  resolutionHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  return {
    ...complaint,
    complaintType,
    providerComplaintsCount,
    transaction: transactionData,
    providerPayoutStatus,
    refundStatus,
    evidenceComparison,
    resolutionHistory
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
  try {
    const { resolutionNotes } = req.body;
    if (!resolutionNotes) {
      return res.status(400).json({
        success: false,
        message: "Resolution notes are required."
      });
    }

    const complaint = await Complaint.findById(req.params.id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    complaint.status = 'Solved';
    complaint.resolvedBy = req.admin._id; // Admin's ID
    complaint.resolutionNotes = resolutionNotes;

    await complaint.save();

    res.json({
      success: true,
      message: 'Complaint resolved successfully',
      data: complaint
    });
  } catch (error) {
    console.error('Error resolving complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
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

    // Find complaint by ID and populate all references
    const complaint = await Complaint.findById(id)
      .populate("customer", "name email phone")
      .populate("provider", "name email phone")
      .populate("userId", "name email phone")
      .populate("providerId", "name email phone")
      .populate("booking", "bookingId serviceName date complaintProofs providerWorkProof disputeStatus adminRefundDecision paymentStatus statusHistory payoutHoldUntil totalAmount")
      .populate("resolvedBy", "name email")
      .lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found"
      });
    }

    const enrichedData = await enrichComplaintData(complaint);

    res.status(200).json({
      success: true,
      data: enrichedData
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
