const mongoose = require('mongoose');
const Feedback = require('../models/Feedback-model');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const { sendEmail } = require('../utils/sendEmail');

// Customer: Submit feedback
const submitFeedback = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const customerId = req.user._id;

    if (!bookingId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and rating are required'
      });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      customer: customerId,
      status: 'completed'
    }).populate('service');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Completed booking not found or unauthorized'
      });
    }

    const existingFeedback = await Feedback.findOne({ booking: bookingId });
    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this booking'
      });
    }

    const feedback = await Feedback.create({
      customer: customerId,
      provider: booking.provider,
      service: booking.service._id,
      booking: bookingId,
      rating,
      comment
    });

    booking.feedback = feedback._id;
    await booking.save();

    // Send notification to provider
    try {
      const provider = await mongoose.model('Provider').findById(booking.provider);
      await sendEmail({
        to: provider.email,
        subject: 'New Feedback Received',
        html: `You received ${rating} stars for service: ${booking.service.title}`
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
    }

    return res.status(201).json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while submitting feedback'
    });
  }
};

// Customer: Get their feedbacks
const getCustomerFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ customer: req.user._id })
      .populate('provider', 'name profilePicUrl')
      .populate('service', 'title image')
      .populate('booking', 'date')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: feedbacks.length,
      feedbacks
    });
  } catch (error) {
    console.error('Error getting customer feedbacks:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching feedbacks'
    });
  }
};

// Provider: Get feedbacks for their services
const getProviderFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ provider: req.user._id })
      .populate('customer', 'name profilePicUrl')
      .populate('service', 'title image')
      .populate('booking', 'date')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: feedbacks.length,
      feedbacks
    });
  } catch (error) {
    console.error('Error getting provider feedbacks:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching feedbacks'
    });
  }
};

// Admin: Get all feedbacks
const getAllFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate('customer', 'name email')
      .populate('provider', 'name email')
      .populate('service', 'title category')
      .populate('booking', 'date')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: feedbacks.length,
      feedbacks
    });
  } catch (error) {
    console.error('Error getting all feedbacks:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching feedbacks'
    });
  }
};

// Admin: Get feedbacks for specific service
const getServiceFeedbacks = async (req, res) => {
  try {
    const { serviceId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID'
      });
    }

    const feedbacks = await Feedback.find({ service: serviceId })
      .populate('customer', 'name email')
      .populate('provider', 'name email')
      .populate('service', 'title')
      .populate('booking', 'date')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: feedbacks.length,
      feedbacks
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
  getProviderFeedbacks,
  getAllFeedbacks,
  getServiceFeedbacks
};