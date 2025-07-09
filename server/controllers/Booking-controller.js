const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model');
const Invoice = require('../models/Invoice-model');
const Coupon = require('../models/Coupon-model');
const sendEmail = require('../utils/sendEmail');

// USER CONTROLLERS

// Create new booking
const createBooking = async (req, res) => {
  try {
    const { serviceId, date, time, address, couponCode, notes } = req.body;
    const userId = req.user.id;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate service
    const service = await Service.findById(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or inactive'
      });
    }

    // Validate date
    const bookingDate = new Date(date);
    if (bookingDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Booking date must be in the future'
      });
    }

    // Validate time
    if (time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format (use HH:MM)'
      });
    }

    // Calculate total amount
    let totalAmount = service.basePrice;
    let discountAmount = 0;

    if (couponCode) {
      try {
        const coupon = await Coupon.validateCoupon(userId, couponCode, service.basePrice);
        const discountDetails = coupon.applyCoupon(service.basePrice);
        totalAmount = discountDetails.finalAmount;
        discountAmount = discountDetails.discount;
      } catch (couponError) {
        return res.status(400).json({
          success: false,
          message: couponError.message
        });
      }
    }

    // Find providers in the same city
    const providers = await Provider.find({
      services: service.category,
      approved: true,
      testPassed: true,
      isDeleted: false,
      'address.city': address.city // Match by city instead of coordinates
    }).limit(5);

    if (providers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No available providers in your area'
      });
    }

    // Create booking
    const booking = await Booking.create({
      customer: userId,
      provider: providers[0]._id, // Assign to first available provider
      service: serviceId,
      date: bookingDate,
      time: time || null,
      address,
      couponApplied: couponCode || null,
      discountAmount,
      notes: notes || null,
      servicePrice: service.basePrice
    });

    // Send confirmation email
    try {
      const emailHtml = `
        <h2>Your Booking is Confirmed</h2>
        <p>Thank you for booking with us!</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${service.title}</p>
        <p><strong>Date:</strong> ${bookingDate.toDateString()}</p>
        ${time ? `<p><strong>Time:</strong> ${time}</p>` : ''}
        <p><strong>Address:</strong> ${address.street}, ${address.city}, ${address.state}</p>
        <p><strong>Total Amount:</strong> ₹${totalAmount.toFixed(2)}</p>
        ${discountAmount > 0 ? `<p><strong>Discount Applied:</strong> ₹${discountAmount.toFixed(2)}</p>` : ''}
      `;

      await sendEmail({
        to: user.email,
        subject: 'Booking Confirmation',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get user bookings
const getUserBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const userId = req.user.id;

    const query = { customer: userId };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('provider', 'name profilePicUrl')
      .populate('service', 'title category image')
      .sort({ date: -1, time: -1 });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get single booking
const getBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findOne({ _id: id, customer: userId })
      .populate('provider', 'name phone profilePicUrl')
      .populate('service', 'title category description image')
      .populate('invoice');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findOne({ _id: id, customer: userId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed booking'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    const previousStatus = booking.status;
    booking.status = 'cancelled';
    await booking.save();

    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { totalBookings: -1 }
    });

    // Update provider stats if booking was already accepted
    if (previousStatus === 'accepted') {
      await Provider.findByIdAndUpdate(booking.provider, {
        $inc: { canceledBookings: 1 }
      });
    }

    // Send cancellation email
    try {
      const user = await User.findById(userId);
      const service = await Service.findById(booking.service);
      
      const emailHtml = `
        <h2>Booking Cancelled</h2>
        <p>Your booking has been successfully cancelled.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${service.title}</p>
        <p><strong>Original Date:</strong> ${booking.date.toDateString()}</p>
        ${booking.time ? `<p><strong>Time:</strong> ${booking.time}</p>` : ''}
        <p>If this was a mistake or you need to reschedule, please contact our support.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Booking Cancelled - Raj Electrical Service',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// PROVIDER CONTROLLERS

// Get provider bookings
const getProviderBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const providerId = req.provider.id;

    // Get provider's address details
    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const query = { provider: providerId };
    if (status) query.status = status;

    // Add address matching to populate
    const bookings = await Booking.find(query)
      .populate({
        path: 'customer',
        select: 'name phone profilePicUrl',
        match: {
          $or: [
            { 'address.city': provider.address.city },
            { 'address.zipCode': provider.address.zipCode }
          ]
        }
      })
      .populate('service', 'title category')
      .sort({ date: 1, time: 1 });

    // Filter out bookings where customer address doesn't match (if needed)
    const filteredBookings = bookings.filter(booking => 
      booking.customer && (
        booking.customer.address?.city === provider.address.city ||
        booking.customer.address?.zipCode === provider.address.zipCode
      )
    );

    res.json({
      success: true,
      count: filteredBookings.length,
      data: filteredBookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Accept booking
const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.provider.id;
    const { time } = req.body; // Provider can set time if not set by user

    const booking = await Booking.findOne({ _id: id, provider: providerId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${booking.status}`
      });
    }

    // If time wasn't set by user and provider is setting it
    if (!booking.time && time) {
      if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time format (use HH:MM)'
        });
      }
      booking.time = time;
    }

    booking.status = 'accepted';
    await booking.save();

    // Send acceptance email to customer
    try {
      const user = await User.findById(booking.customer);
      const service = await Service.findById(booking.service);
      
      const emailHtml = `
        <h2>Booking Accepted</h2>
        <p>Your service provider has accepted your booking request.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${service.title}</p>
        <p><strong>Date:</strong> ${booking.date.toDateString()}</p>
        <p><strong>Time:</strong> ${booking.time || 'To be confirmed'}</p>
        <p>Your service provider will contact you shortly to confirm details.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Booking Accepted - Raj Electrical Service',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Failed to send acceptance email:', emailError);
    }

    res.json({
      success: true,
      message: 'Booking accepted successfully',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Complete booking
const completeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.provider.id;

    const booking = await Booking.findOne({ _id: id, provider: providerId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Only accepted bookings can be completed'
      });
    }

    booking.status = 'completed';
    await booking.save();

    // Create invoice
    const invoice = await Invoice.create({
      bookingId: booking._id,
      provider: providerId,
      customer: booking.customer,
      serviceAmount: booking.servicePrice,
      discountAmount: booking.discountAmount || 0,
      totalAmount: booking.servicePrice - (booking.discountAmount || 0),
      paidBy: 'cod' // Default to cash on delivery
    });

    // Update booking with invoice
    booking.invoice = invoice._id;
    await booking.save();

    // Update provider stats
    await Provider.findByIdAndUpdate(providerId, {
      $inc: { completedBookings: 1 }
    });

    // Update user stats
    await User.findByIdAndUpdate(booking.customer, {
      $inc: { totalBookings: 1, totalSpent: invoice.totalAmount }
    });

    // Mark coupon as used if applied
    if (booking.couponApplied) {
      const coupon = await Coupon.findOne({ code: booking.couponApplied });
      if (coupon) {
        await coupon.markAsUsed(booking.customer, invoice.totalAmount);
      }
    }

    // Send completion email to customer
    try {
      const user = await User.findById(booking.customer);
      const service = await Service.findById(booking.service);
      
      const emailHtml = `
        <h2>Service Completed</h2>
        <p>Your service has been successfully completed.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${service.title}</p>
        <p><strong>Date:</strong> ${booking.date.toDateString()}</p>
        <p><strong>Amount Paid:</strong> ₹${invoice.totalAmount.toFixed(2)}</p>
        <p>Thank you for choosing Raj Electrical Service!</p>
        <p>Please consider leaving a review for your service provider.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Service Completed - Raj Electrical Service',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Failed to send completion email:', emailError);
    }

    res.json({
      success: true,
      message: 'Booking completed successfully',
      data: invoice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ADMIN CONTROLLERS

// Get all bookings
const getAllBookings = async (req, res) => {
  try {
    const { status, customer, provider, service, from, to } = req.query;
    const query = {};

    if (status) query.status = status;
    if (customer) query.customer = customer;
    if (provider) query.provider = provider;
    if (service) query.service = service;
    
    if (from && to) {
      query.date = {
        $gte: new Date(from),
        $lte: new Date(to)
      };
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('service', 'title category')
      .sort({ date: -1, time: -1 });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get booking details
const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('customer', 'name email phone address')
      .populate('provider', 'name email phone address')
      .populate('service', 'title category description')
      .populate('invoice')
      .populate('feedback')
      .populate('complaint');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: booking
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
    const { providerId } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be reassigned'
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
    await booking.save();

    res.json({
      success: true,
      message: 'Provider assigned successfully'
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

    // Check if booking is completed or cancelled
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${booking.status} booking`
      });
    }

    // Get customer details for email notification
    const customer = await User.findById(booking.customer);
    const service = await Service.findById(booking.service);

    // Delete the booking
    await Booking.findByIdAndDelete(id);

    // Send deletion notification email
    try {
      const emailHtml = `
        <h2>Booking Deleted</h2>
        <p>Your booking has been deleted by the administrator.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${service.title}</p>
        <p><strong>Date:</strong> ${booking.date.toDateString()}</p>
        <p>If you believe this was a mistake, please contact our support team.</p>
      `;

      await sendEmail({
        to: customer.email,
        subject: 'Booking Deleted - Raj Electrical Service',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Failed to send deletion email:', emailError);
    }

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

// Delete user booking (Admin only - for specific user)
const deleteUserBooking = async (req, res) => {
  try {
    const { userId, bookingId } = req.params;

    // Verify user exists
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

    // Check if booking is completed or cancelled
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${booking.status} booking`
      });
    }

    // Get service details for email
    const service = await Service.findById(booking.service);

    // Delete the booking
    await Booking.findByIdAndDelete(bookingId);

    // Send deletion notification email
    try {
      const emailHtml = `
        <h2>Booking Deleted</h2>
        <p>One of your bookings has been deleted by the administrator.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${service.title}</p>
        <p><strong>Date:</strong> ${booking.date.toDateString()}</p>
        <p>If you believe this was a mistake, please contact our support team.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Booking Deleted - Raj Electrical Service',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Failed to send deletion email:', emailError);
    }

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

module.exports = {
  createBooking,
  getUserBookings,
  getBooking,
  cancelBooking,
  getProviderBookings,
  acceptBooking,
  completeBooking,
  getAllBookings,
  getBookingDetails,
  assignProvider,
  deleteBooking,
  deleteUserBooking
};