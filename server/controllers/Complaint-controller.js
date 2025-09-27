const Complaint = require('../models/Complaint-model');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const mongoose = require('mongoose');

// @desc    Submit a new complaint
// @route   POST /api/complaints
// @access  Private (Customer)
const submitComplaint = async (req, res) => {
  try {
    const { title, description, category, priority, bookingId } = req.body;
    const customerId = req.user._id;

    // 1. Validation
    if (!title || !description || !category || !bookingId) {
      return res.status(400).json({ message: 'Please provide title, description, category, and bookingId.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking || booking.customer.toString() !== customerId.toString()) {
      return res.status(404).json({ message: 'Booking not found or you are not authorized.' });
    }

    // 2. Handle Image Uploads
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => ({
        secure_url: file.path, // courtesy of multer-storage-cloudinary
        public_id: file.filename, // courtesy of multer-storage-cloudinary
      }));
    }

    // 3. Create Complaint
    const complaint = await Complaint.create({
      customer: customerId,
      booking: bookingId,
      provider: booking.provider,
      title,
      description,
      category,
      priority: priority || "Medium",
      images
    });

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      complaint
    });
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
      priority,
      category,
      search,
      startDate,
      endDate,
    } = req.query;

    // Build the query
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;

    if (search) {
      query.$or = [
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
      .populate('booking', 'date services')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Complaint.countDocuments(query);

    res.json({
      success: true,
      data: complaints,
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
      query = { provider: req.user._id };
    } else if (req.user.role === 'user') {
      query = { customer: req.user._id };
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const complaints = await Complaint.find(query)
      .populate('customer', 'name email')
      .populate('provider', 'name email')
      .populate('booking', 'date services')
      .sort({ createdAt: -1 });
    
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
const getComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('booking', 'date services bookingId');

    if (!complaint) {
      return res.status(404).json({ 
        success: false,
        message: 'Complaint not found' 
      });
    }

    // Check authorization
    if (req.user.role === 'user' && complaint.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this complaint'
      });
    }

    if (req.user.role === 'provider' && complaint.provider._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this complaint'
      });
    }
    
    res.json({
      success: true,
      data: complaint
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

    // Find complaint by ID and populate references
    const complaint = await Complaint.findById(id)
      .populate("customer", "name email phone")
      .populate("provider", "name email phone")
      .populate("booking", "bookingId serviceName date")
      .populate("resolvedBy", "name email");

    if (!complaint) {
      return res.status(404).json({ 
        success: false,
        message: "Complaint not found" 
      });
    }

    res.status(200).json({
      success: true,
      data: complaint
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

    if (complaint.customer.toString() !== req.user._id.toString()) {
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

module.exports = {
  submitComplaint,
  getAllComplaints,
  getMyComplaints,
  getComplaint,
  resolveComplaint,
  updateComplaintStatus,
  reopenComplaint,
  getComplaintDetails
};
