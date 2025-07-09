const Feedback = require('../models/Feedback-model');
const Booking = require('../models/Booking-model');
const { sendEmail } = require('../utils/sendEmail');

// Customer: Submit feedback for a completed booking
const submitFeedback = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const customerId = req.user._id;

    // Validate input
    if (!bookingId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and rating are required'
      });
    }

    // Check if booking exists and belongs to this customer
    const booking = await Booking.findOne({
      _id: bookingId,
      customer: customerId,
      status: 'completed'
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Completed booking not found or unauthorized'
      });
    }

    // Check if feedback already exists for this booking
    const existingFeedback = await Feedback.findOne({ booking: bookingId });
    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'Feedback already submitted for this booking'
      });
    }

    // Create new feedback
    const feedback = await Feedback.create({
      customer: customerId,
      provider: booking.provider,
      booking: bookingId,
      rating,
      comment
    });

    // Update booking with feedback reference
    booking.feedback = feedback._id;
    await booking.save();

    // Send notification email to provider
    try {
      const provider = await mongoose.model('Provider').findById(booking.provider);
      await sendEmail({
        to: provider.email,
        subject: 'New Feedback Received',
        html: `<p>You have received new feedback for booking ${booking._id}. Rating: ${rating} stars</p>`
      });
    } catch (emailError) {
      console.error('Failed to send feedback notification:', emailError);
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

// Customer: Get all their feedbacks
const getCustomerFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ customer: req.user._id })
      .populate('provider', 'name profilePicUrl')
      .populate('booking', 'date service')
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

// Customer: Get single feedback detail
const getFeedbackDetail = async (req, res) => {
  try {
    const feedback = await Feedback.findOne({
      _id: req.params.id,
      customer: req.user._id
    })
      .populate('provider', 'name profilePicUrl')
      .populate('booking', 'date service');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found or unauthorized'
      });
    }

    return res.json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Error getting feedback detail:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching feedback detail'
    });
  }
};

// Customer: Update feedback
const updateFeedback = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const feedback = await Feedback.findOneAndUpdate(
      { _id: req.params.id, customer: req.user._id },
      { rating, comment },
      { new: true, runValidators: true }
    );

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found or unauthorized'
      });
    }

    return res.json({
      success: true,
      feedback
    });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating feedback'
    });
  }
};

// Provider: Get all feedbacks for their services
const getProviderFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ provider: req.user._id })
      .populate('customer', 'name profilePicUrl')
      .populate('booking', 'date service')
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

// Admin: Get all feedbacks for a specific service
const getServiceFeedbacks = async (req, res) => {
  try {
    // First find all bookings for this service
    const serviceBookings = await Booking.find({ 
      service: req.params.serviceId 
    }).select('_id');

    const bookingIds = serviceBookings.map(b => b._id);

    const feedbacks = await Feedback.find({ booking: { $in: bookingIds } })
      .populate('customer', 'name')
      .populate('provider', 'name')
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
  getFeedbackDetail,
  updateFeedback,
  getProviderFeedbacks,
  getServiceFeedbacks
};