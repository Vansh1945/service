const mongoose = require('mongoose');
const Feedback = require('../models/Feedback-model');
const Booking = require('../models/Booking-model');
const { sendEmail } = require('../utils/sendEmail');

// @desc    Submit feedback for a booking (separate provider and service feedback)
// @route   POST /api/feedback
 // @access  Private (Customer)
const submitFeedback = async (req, res) => {
  try {
    const { 
      bookingId, 
      providerRating, 
      providerComment, 
      serviceRating, 
      serviceComment 
    } = req.body;
    const customerId = req.user._id;

    // Validate required fields
    if (!bookingId || !providerRating || !serviceRating) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID, provider rating and service rating are required'
      });
    }

    // Check if booking exists and belongs to this customer
    const booking = await Booking.findOne({
      _id: bookingId,
      customer: customerId,
      status: 'completed'
    }).populate('service provider');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Completed booking not found '
      });
    }

    // Check for existing feedback
    const existingFeedback = await Feedback.findOne({ booking: bookingId });
    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this booking'
      });
    }

    // Create new feedback with separate provider and service feedback
    const feedback = await Feedback.create({
      customer: customerId,
      booking: bookingId,
      providerFeedback: {
        provider: booking.provider._id,
        rating: providerRating,
        comment: providerComment || ''
      },
      serviceFeedback: {
        service: booking.service._id,
        rating: serviceRating,
        comment: serviceComment || '',
        isApproved: true // Needs admin approval
      }
    });

    // Update booking with feedback reference
    booking.feedback = feedback._id;
    await booking.save();

    // Send notification to provider
    try {
      await sendEmail({
        to: booking.provider.email,
        subject: 'New Feedback Received',
        html: `You received ${providerRating} stars for your service from a customer.`
      });
    } catch (emailError) {
      console.error('Email notification error:', emailError);
    }

    return res.status(201).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while submitting feedback'
    });
  }
};

// @desc    Get customer's own feedbacks
// @route   GET /api/feedback/my-feedbacks
// @access  Private (Customer)
const getCustomerFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ customer: req.user._id })
      .populate({
        path: 'providerFeedback.provider',
        select: 'name profilePicUrl'
      })
      .populate({
        path: 'serviceFeedback.service',
        select: 'title image'
      })
      .populate('booking', 'date')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks
    });
  } catch (error) {
    console.error('Error getting customer feedbacks:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching feedbacks'
    });
  }
};

// @desc    Get single feedback (customer can only view their own)
// @route   GET /api/feedback/:feedbackId
// @access  Private (Customer)
const getFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findOne({
      _id: req.params.feedbackId,
      customer: req.user._id
    })
    .populate({
      path: 'providerFeedback.provider',
      select: 'name profilePicUrl'
    })
    .populate({
      path: 'serviceFeedback.service',
      select: 'title image'
    })
    .populate('booking', 'date');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found or unauthorized'
      });
    }

    return res.status(200).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    console.error('Error getting feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching feedback'
    });
  }
};

// @desc    Edit feedback (customer can only edit their own)
// @route   PUT /api/feedback/:feedbackId
// @access  Private (Customer)
const editFeedback = async (req, res) => {
  try {
    const { 
      providerRating, 
      providerComment, 
      serviceRating, 
      serviceComment 
    } = req.body;

    // Find the feedback
    const feedback = await Feedback.findOne({
      _id: req.params.feedbackId,
      customer: req.user._id
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found or unauthorized'
      });
    }

    // Check if feedback is too old to edit (e.g., 7 days)
    const daysOld = (Date.now() - feedback.createdAt) / (1000 * 60 * 60 * 24);
    if (daysOld > 7) {
      return res.status(400).json({
        success: false,
        message: 'Feedback cannot be edited after 7 days'
      });
    }

    // Update provider feedback if provided
    if (providerRating) {
      feedback.providerFeedback.rating = providerRating;
      feedback.providerFeedback.comment = providerComment || feedback.providerFeedback.comment;
      feedback.providerFeedback.isEdited = true;
    }

    // Update service feedback if provided
    if (serviceRating) {
      feedback.serviceFeedback.rating = serviceRating;
      feedback.serviceFeedback.comment = serviceComment || feedback.serviceFeedback.comment;
      feedback.serviceFeedback.isEdited = true;
      feedback.serviceFeedback.isApproved = false; // Needs re-approval
    }

    await feedback.save();

    return res.status(200).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    console.error('Error editing feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while editing feedback'
    });
  }
};

// @desc    Get provider's feedbacks
// @route   GET /api/feedback/provider/my-feedbacks
// @access  Private (Provider)
const getProviderFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ 
      'providerFeedback.provider': req.user._id 
    })
    .populate('customer', 'name profilePicUrl')
    .populate({
      path: 'serviceFeedback.service',
      select: 'title image'
    })
    .populate('booking', 'date')
    .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks
    });
  } catch (error) {
    console.error('Error getting provider feedbacks:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching feedbacks'
    });
  }
};

// @desc    Get all feedbacks (admin only)
// @route   GET /api/feedback/admin/all-feedbacks
// @access  Private (Admin)
const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate('customer', 'name email')
      .populate({
        path: 'providerFeedback.provider',
        select: 'name email'
      })
      .populate({
        path: 'serviceFeedback.service',
        select: 'title category'
      })
      .populate('booking', 'date')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks
    });
  } catch (error) {
    console.error('Error getting all feedbacks:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching feedbacks'
    });
  }
};

// @desc    Get feedbacks for specific service (admin only)
// @route   GET /api/feedback/admin/service/:serviceId
// @access  Private (Admin)
const getServiceFeedbacks = async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID'
      });
    }

    const feedbacks = await Feedback.find({ 
      'serviceFeedback.service': serviceId 
    })
    .populate('customer', 'name email')
    .populate({
      path: 'providerFeedback.provider',
      select: 'name email'
    })
    .populate('booking', 'date')
    .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks
    });
  } catch (error) {
    console.error('Error getting service feedbacks:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching service feedbacks'
    });
  }
};

module.exports = {
  submitFeedback,
  getCustomerFeedbacks,
  getFeedback,
  editFeedback,
  getProviderFeedbacks,
  getAllFeedbacks,
  getServiceFeedbacks
};