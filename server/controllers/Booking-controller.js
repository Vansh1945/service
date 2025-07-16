const mongoose = require('mongoose');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model');
const Invoice = require('../models/Invoice-model');
const CommissionRule = require('../models/CommissionRule-model');
const Coupon = require('../models/Coupon-model');
const Cart = require('../models/Cart-model');
const sendEmail = require('../utils/sendEmail');
const { autoGenerateInvoice } = require('./Invoice-controller');

// USER CONTROLLERS

// Create new booking from cart
const createBookingFromCart = async (req, res) => {
  try {
    const { date, time, address, couponCode, notes } = req.body;
    const userId = req.user.id;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: userId }).populate('items.service');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    // Validate date and time
    const bookingDate = new Date(date);
    if (bookingDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Booking date must be in the future'
      });
    }

    // Prepare service items for booking
    const serviceItems = cart.items.map(item => ({
      service: item.service._id,
      quantity: item.quantity,
      price: item.service.basePrice,
      discountAmount: 0
    }));

    // Calculate subtotal
    let subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.service.basePrice * item.quantity);
    }, 0);

    let totalDiscount = 0;
    let totalAmount = subtotal;

    // Apply coupon if provided
    if (couponCode) {
      const coupon = await Coupon.validateCoupon(userId, couponCode, subtotal);
      const discountDetails = coupon.applyCoupon(subtotal);

      // Update discount for each service proportionally
      const discountRatio = discountDetails.discount / subtotal;
      serviceItems.forEach(item => {
        item.discountAmount = Math.round(item.price * item.quantity * discountRatio * 100) / 100;
      });

      totalDiscount = discountDetails.discount;
      totalAmount = discountDetails.finalAmount;
    }

    // Create booking
    const booking = await Booking.create({
      customer: userId,
      services: serviceItems,
      date: bookingDate,
      time: time || null,
      address,
      couponApplied: couponCode || null,
      totalDiscount,
      subtotal,
      totalAmount,
      notes: notes || null
    });

    // Clear the cart
    await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } }
    );

    res.status(201).json({
      success: true,
      message: 'Booking created successfully from cart',
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create single service booking (for backward compatibility)
const createSingleBooking = async (req, res) => {
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

    // Prepare service item
    const serviceItem = {
      service: serviceId,
      quantity: 1,
      price: service.basePrice,
      discountAmount: 0
    };

    let subtotal = service.basePrice;
    let totalDiscount = 0;
    let totalAmount = subtotal;

    // Apply coupon if provided
    if (couponCode) {
      try {
        const coupon = await Coupon.validateCoupon(userId, couponCode, subtotal);
        const discountDetails = coupon.applyCoupon(subtotal);

        serviceItem.discountAmount = discountDetails.discount;
        totalDiscount = discountDetails.discount;
        totalAmount = discountDetails.finalAmount;
      } catch (couponError) {
        return res.status(400).json({
          success: false,
          message: couponError.message
        });
      }
    }


    // Create booking
    const booking = await Booking.create({
      customer: userId,
      services: [serviceItem],
      date: bookingDate,
      time: time || null,
      address,
      couponApplied: couponCode || null,
      totalDiscount,
      subtotal,
      totalAmount,
      notes: notes || null
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
        ${totalDiscount > 0 ? `<p><strong>Discount Applied:</strong> ₹${totalDiscount.toFixed(2)}</p>` : ''}
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
      .populate('services.service', 'title category image')
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
      .populate('services.service', 'title category description image')
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
        subject: 'Booking Cancelled',
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


// User - Update Booking Date/Time (with restrictions)
const userUpdateBookingDateTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;
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

    // User can only modify pending bookings
    if (booking.status !== 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Only pending bookings can be rescheduled'
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

    // Send notification email
    try {
      const [user, provider, service] = await Promise.all([
        User.findById(userId),
        Provider.findById(booking.provider),
        Service.findById(booking.service)
      ]);

      const emailHtml = `
        <h2>Booking Rescheduled</h2>
        <p>Your booking has been rescheduled by the customer.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${service.title}</p>
        <p><strong>New Date:</strong> ${booking.date.toDateString()}</p>
        <p><strong>New Time:</strong> ${booking.time || 'To be confirmed'}</p>
        <p>Please contact the customer if you need to adjust this schedule.</p>
      `;

      await sendEmail({
        to: provider.email,
        subject: 'Booking Rescheduled by Customer',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
    }

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

// PROVIDER CONTROLLERS

// Get provider bookings
const getProviderBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const providerId = req.provider.id;

    const query = { provider: providerId };
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('customer', 'name phone profilePicUrl')

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

// Accept booking
const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.provider.id;
    const { time } = req.body;

    // Find booking with customer and service details
    const booking = await Booking.findOne({ _id: id })
      .populate('customer', 'city state address')

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Get provider details
    const provider = await Provider.findById(providerId)
      .select('serviceArea address city state');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Check if booking is pending
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Booking is already ${booking.status}`
      });
    }


    // Validate and update time if provided
    if (!booking.time && time) {
      if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid time format (use HH:MM)'
        });
      }
      booking.time = time;
    }

    // Update booking status
    booking.status = 'accepted';
    await booking.save();

    // Send acceptance email to customer
    try {
      const user = await User.findById(booking.customer._id);
      const service = await Service.findById(booking.service);

      const emailHtml = `
        <h2>Booking Accepted</h2>
        <p>Your service provider has accepted your booking request.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${service.title}</p>
        <p><strong>Date:</strong> ${booking.date.toDateString()}</p>
        <p><strong>Time:</strong> ${booking.time || 'To be confirmed'}</p>
        <p><strong>Provider Address:</strong> ${provider.address.street}, ${provider.address.city}, ${provider.address.state}</p>
        <p>Your service provider will contact you shortly to confirm details.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Booking Accepted',
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

// Complete booking with commission calculation
const completeBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.provider?.id;

    if (!providerId) {
      return res.status(401).json({
        success: false,
        message: 'Provider authentication required'
      });
    }

    // Find and validate booking
    const booking = await Booking.findOne({ _id: id })
      .populate('provider', 'id address performanceTier')
      .populate('customer', 'email')
      .populate('services.service');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Handle provider assignment
    if (!booking.provider || !booking.provider._id) {
      const rawBooking = await Booking.findOne({ _id: id }).lean();
      if (!rawBooking.provider) {
        await Booking.updateOne(
          { _id: id },
          { $set: { provider: providerId } }
        );
        booking.provider = { _id: providerId };
      } else {
        booking.provider = await Provider.findById(rawBooking.provider)
          .select('id address performanceTier');
        if (!booking.provider) {
          return res.status(400).json({
            success: false,
            message: 'Assigned provider not found'
          });
        }
      }
    }

    // Validate provider authorization
    if (booking.provider._id.toString() !== providerId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to complete this booking'
      });
    }

    // Validate booking status
    if (booking.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: `Booking must be in 'accepted' status (current: ${booking.status})`
      });
    }

    // Calculate amounts
    const servicePrice = booking.subtotal || 0;
    const discountAmount = booking.totalDiscount || 0;
    const totalAmount = booking.totalAmount || (servicePrice - discountAmount);

    // Calculate commission
    let commissionAmount = 0;
    let commissionRuleId = null;
    let commissionType = 'percentage';
    let commissionValue = 10; // Default 10%

    try {
      const performanceTier = booking.provider?.performanceTier || 'standard';
      const commissionRule = await CommissionRule.getCommissionForProvider(providerId, performanceTier);

      if (commissionRule) {
        commissionRuleId = commissionRule._id;
        commissionType = commissionRule.type;
        commissionValue = commissionRule.value;

        if (commissionType === 'percentage') {
          commissionAmount = totalAmount * (commissionValue / 100);
        } else {
          commissionAmount = commissionValue;
        }
      } else {
        // Fallback to default 10% if no rule found
        commissionAmount = totalAmount * 0.10;
      }
    } catch (commissionError) {
      console.error('Commission calculation error:', commissionError);
      commissionAmount = totalAmount * 0.10;
    }

    // Generate invoice number
    const date = new Date();
    const prefix = 'INV-' +
      date.getFullYear().toString().slice(-2) +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0') + '-';
    
    const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 });
    const lastSeq = lastInvoice ? parseInt(lastInvoice.invoiceNo.replace(prefix, '')) || 0 : 0;
    const invoiceNo = prefix + (lastSeq + 1).toString().padStart(4, '0');

    // Prepare commission data
    const commissionData = {
      amount: commissionAmount,
      type: commissionType,
      value: commissionValue
    };

    // Only add rule if it's a valid ObjectId
    if (commissionRuleId && mongoose.Types.ObjectId.isValid(commissionRuleId)) {
      commissionData.rule = commissionRuleId;
    }

    // Create invoice
    const invoice = new Invoice({
      invoiceNo,
      booking: booking._id,
      provider: booking.provider._id,
      customer: booking.customer._id,
      service: booking.services[0].service._id,
      serviceAmount: booking.subtotal,
      totalAmount: booking.totalAmount,
      netAmount: booking.totalAmount - commissionAmount,
      commission: commissionData,
      paymentStatus: booking.paymentStatus === 'paid' ? 'paid' : 'pending'
    });

    // Save invoice
    await invoice.save();

    // Update booking
    booking.status = 'completed';
    booking.invoice = invoice._id;
    booking.commission = {
      amount: commissionAmount,
      baseRule: commissionRuleId,
      penaltyRules: []
    };
    await booking.save();

    // Update provider and customer stats
    await Provider.findByIdAndUpdate(providerId, {
      $inc: {
        completedBookings: 1,
        totalEarnings: totalAmount - commissionAmount
      }
    });

    if (booking.customer?._id) {
      await User.findByIdAndUpdate(booking.customer._id, {
        $inc: { totalBookings: 1, totalSpent: totalAmount }
      });
    }

    // Handle coupon if applied
    if (booking.couponApplied) {
      try {
        const coupon = await Coupon.findOne({ code: booking.couponApplied });
        if (coupon) {
          await coupon.markAsUsed(booking.customer?._id, totalAmount);
        }
      } catch (couponError) {
        console.error('Coupon processing error:', couponError);
      }
    }

    // Send notification email
    if (booking.customer?.email) {
      try {
        await sendEmail({
          to: booking.customer.email,
          subject: 'Service Completed',
          html: `
            <h2>Service Completed</h2>
            <p>Your service has been successfully completed.</p>
            <p><strong>Booking ID:</strong> ${booking._id}</p>
            <p><strong>Invoice No:</strong> ${invoice.invoiceNo}</p>
            <p><strong>Total Amount:</strong> ₹${totalAmount.toFixed(2)}</p>
            <p><strong>Commission:</strong> ₹${commissionAmount.toFixed(2)}</p>
            <p><strong>Net Amount to Provider:</strong> ₹${(totalAmount - commissionAmount).toFixed(2)}</p>
            <p>Thank you for choosing our service!</p>
          `
        });
      } catch (emailError) {
        console.error('Email sending error:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'Booking completed successfully',
      data: {
        invoiceId: invoice._id,
        invoiceNo: invoice.invoiceNo,
        totalAmount: totalAmount.toFixed(2),
        commission: commissionAmount.toFixed(2),
        netAmount: (totalAmount - commissionAmount).toFixed(2),
        bookingStatus: 'completed'
      }
    });

  } catch (error) {
    console.error('Booking completion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  }
};


// ADMIN CONTROLLERS

// Get all bookings
const getAllBookings = async (req, res) => {
  try {
    const { status, customer, provider, service, from, to, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

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

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { 'customer.name': searchRegex },
        { 'provider.name': searchRegex },
        { 'service.title': searchRegex },
        { 'address.city': searchRegex },
        { 'address.state': searchRegex }
      ];
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('customer', 'name email phone')
        .populate('provider', 'name email phone')
        .sort({ date: -1, time: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query)
    ]);

    res.json({
      success: true,
      count: bookings.length,
      total,
      page,
      pages: Math.ceil(total / limit),
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

    // Use findByIdAndUpdate instead of modifying and saving to avoid validation issues
    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { provider: providerId },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Provider assigned successfully',
      data: updatedBooking
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

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${booking.status} booking`
      });
    }

    // Get customer details for email notification
    const customer = await User.findById(booking.customer);
    const service = await Service.findById(booking.service);

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
        subject: 'Booking Deleted',
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

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${booking.status} booking`
      });
    }

    const service = await Service.findById(booking.service);

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
        subject: 'Booking Deleted',
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

// Admin - Update Booking Date/Time
const updateBookingDateTime = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;

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

    // Send notification email to customer and provider
    try {
      const [customer, provider, service] = await Promise.all([
        User.findById(booking.customer),
        Provider.findById(booking.provider),
        Service.findById(booking.service)
      ]);

      const emailHtml = `
        <h2>Booking Schedule Updated</h2>
        <p>Your booking has been rescheduled by the administrator.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${service.title}</p>
        <p><strong>New Date:</strong> ${booking.date.toDateString()}</p>
        <p><strong>New Time:</strong> ${booking.time || 'To be confirmed'}</p>
        <p>Please contact support if you have any questions.</p>
      `;

      // Send to both customer and provider
      await Promise.all([
        sendEmail({
          to: customer.email,
          subject: 'Booking Schedule Updated',
          html: emailHtml
        }),
        sendEmail({
          to: provider.email,
          subject: 'Booking Schedule Updated',
          html: emailHtml
        })
      ]);
    } catch (emailError) {
      console.error('Failed to send notification emails:', emailError);
    }

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

module.exports = {
  createBookingFromCart,
  createSingleBooking,
  getUserBookings,
  getBooking,
  cancelBooking,
  userUpdateBookingDateTime,
  getProviderBookings,
  acceptBooking,
  completeBooking,
  getAllBookings,
  getBookingDetails,
  assignProvider,
  deleteBooking,
  deleteUserBooking,
  updateBookingDateTime
};