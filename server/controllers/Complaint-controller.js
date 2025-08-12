const Complaint = require('../models/Complaint-model');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const sendEmail = require('../utils/sendEmail');
const path = require('path');
const fs = require('fs');

const submitComplaint = async (req, res) => {
  try {
    const { bookingId, message } = req.body;
    const customerId = req.user._id;

    if (!bookingId || !message) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Booking ID and message are required'
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      customer: customerId
    }).populate('provider');

    if (!booking) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Booking not found or unauthorized'
      });
    }

    const existingComplaint = await Complaint.findOne({ booking: bookingId });
    if (existingComplaint) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'A complaint already exists for this booking'
      });
    }

    const complaintData = {
      customer: customerId,
      provider: booking.provider._id,
      booking: bookingId,
      message,
      status: 'open'
    };

    if (req.file) {
      complaintData.imageProof = req.file.path;
    }

    const complaint = await Complaint.create(complaintData);
    booking.complaint = complaint._id;
    await booking.save();

    const responseComplaint = complaint.toObject();
    if (complaint.imageProof) {
      responseComplaint.imageProof = `${req.protocol}://${req.get('host')}/${complaint.imageProof}`;
    }

    return res.status(201).json({
      success: true,
      complaint: responseComplaint
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('Error submitting complaint:', error);
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Server error while submitting complaint'
    });
  }
};

const getAllComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate({
        path: 'customer',
        select: 'name phone email'
      })
      .populate({
        path: 'provider',
        select: 'name phone email'
      })
      .populate('booking')
      .sort({ createdAt: -1 });

    const complaintsWithImageUrl = complaints.map(complaint => {
      const complaintObj = complaint.toObject();
      if (complaint.imageProof) {
        complaintObj.imageProof = `${req.protocol}://${req.get('host')}/${complaint.imageProof}`;
      }
      return complaintObj;
    });

    return res.json({
      success: true,
      count: complaints.length,
      complaints: complaintsWithImageUrl
    });
  } catch (error) {
    console.error('Error getting all complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching complaints'
    });
  }
};

const getMyComplaints = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = {};
    if (userRole === 'customer') {
      query.customer = userId;
    } else if (userRole === 'provider') {
      query.provider = userId;
    }

    const complaints = await Complaint.find(query)
      .populate({
        path: userRole === 'customer' ? 'provider' : 'customer',
        select: 'name phone email'
      })
      .populate('booking')
      .sort({ createdAt: -1 });

    const complaintsWithImageUrl = complaints.map(complaint => {
      const complaintObj = complaint.toObject();
      if (complaint.imageProof) {
        complaintObj.imageProof = `${req.protocol}://${req.get('host')}/${complaint.imageProof}`;
      }
      return complaintObj;
    });

    return res.json({
      success: true,
      count: complaints.length,
      complaints: complaintsWithImageUrl
    });
  } catch (error) {
    console.error('Error getting user complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching user complaints'
    });
  }
};

const getComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate({
        path: 'customer',
        select: 'name phone email'
      })
      .populate({
        path: 'provider',
        select: 'name phone email'
      })
      .populate('booking');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    const isCustomer = req.user.role === 'customer' && complaint.customer._id.equals(req.user._id);
    const isProvider = req.user.role === 'provider' && complaint.provider._id.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this complaint'
      });
    }

    const complaintWithImageUrl = complaint.toObject();
    if (complaint.imageProof) {
      complaintWithImageUrl.imageProof = `${req.protocol}://${req.get('host')}/${complaint.imageProof}`;
    }

    return res.json({
      success: true,
      complaint: complaintWithImageUrl
    });
  } catch (error) {
    console.error('Error getting complaint:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching complaint'
    });
  }
};

const resolveComplaint = async (req, res) => {
  try {
    const { response } = req.body;
    const complaint = await Complaint.findById(req.params.id)
      .populate('customer', 'email name')
      .populate('provider', 'email name');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    if (complaint.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Complaint is already resolved'
      });
    }

    complaint.status = 'resolved';
    complaint.adminResponse = response;
    complaint.resolvedAt = new Date();
    await complaint.save();

    // Send email to customer
    try {
      await sendEmail({
        to: complaint.customer.email,
        subject: 'Your Complaint Has Been Resolved',
        html: `
          <h2>Dear ${complaint.customer.name},</h2>
          <p>Your complaint regarding booking ${complaint.booking} has been resolved by our team.</p>
          <p><strong>Admin Response:</strong> ${response}</p>
          <p>If you have any further questions, please don't hesitate to contact us.</p>
          <p>Best regards,</p>
          <p>Raj Electrical Service Team</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send resolution email to customer:', emailError);
      // Don't fail the whole request if email fails
    }

    // Send email to provider (if applicable)
    try {
      await sendEmail({
        to: complaint.provider.email,
        subject: 'Complaint Resolution Notification',
        html: `
          <h2>Dear ${complaint.provider.name},</h2>
          <p>A complaint against your service (Booking ${complaint.booking}) has been resolved by our admin team.</p>
          <p><strong>Admin Response:</strong> ${response}</p>
          <p>Please review this resolution and ensure better service quality in future.</p>
          <p>Best regards,</p>
          <p>Raj Electrical Service Team</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send resolution email to provider:', emailError);
    }

    const complaintWithImageUrl = complaint.toObject();
    if (complaint.imageProof) {
      complaintWithImageUrl.imageProof = `${req.protocol}://${req.get('host')}/${complaint.imageProof}`;
    }

    return res.json({
      success: true,
      message: 'Complaint resolved successfully and notifications sent',
      complaint: complaintWithImageUrl
    });
  } catch (error) {
    console.error('Error resolving complaint:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while resolving complaint'
    });
  }
};

const reopenComplaint = async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for reopening complaint'
      });
    }

    const complaint = await Complaint.findById(req.params.id)
      .populate('customer', 'email name')
      .populate('provider', 'email name');

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    if (!complaint.customer._id.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to reopen this complaint'
      });
    }

    if (complaint.status !== 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Only resolved complaints can be reopened'
      });
    }

    await complaint.reopenComplaint(reason, req.user._id);

    // Send email notification about reopening
    try {
      await sendEmail({
        to: complaint.provider.email,
        subject: 'Complaint Reopened Notification',
        html: `
          <h2>Dear ${complaint.provider.name},</h2>
          <p>The complaint regarding booking ${complaint.booking} has been reopened by the customer.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Please review this matter and contact support if needed.</p>
          <p>Best regards,</p>
          <p>Raj Electrical Service Team</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send reopening email:', emailError);
    }

    const complaintWithImageUrl = complaint.toObject();
    if (complaint.imageProof) {
      complaintWithImageUrl.imageProof = `${req.protocol}://${req.get('host')}/${complaint.imageProof}`;
    }

    return res.json({
      success: true,
      message: 'Complaint reopened successfully',
      complaint: complaintWithImageUrl
    });
  } catch (error) {
    console.error('Error reopening complaint:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while reopening complaint'
    });
  }
};

module.exports = {
  submitComplaint,
  getAllComplaints,
  getMyComplaints,
  getComplaint,
  resolveComplaint,
  reopenComplaint
};