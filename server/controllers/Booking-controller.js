const mongoose = require('mongoose');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model');
const Invoice = require('../models/Invoice-model');
const CommissionRule = require('../models/CommissionRule-model');
const Coupon = require('../models/Coupon-model');
const Transaction = require('../models/Transaction-model ');
const ProviderEarning = require('../models/ProviderEarning-model');
const Cart = require('../models/Cart-model');
const sendEmail = require('../utils/sendEmail');
const { autoGenerateInvoice } = require('./Invoice-controller');




// USER BOOKING CONTROLLERS

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
    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

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
      discountAmount: 0,
      serviceDetails: {
        title: item.service.title,
        description: item.service.description,
        duration: item.service.duration,
        category: item.service.category
      }
    }));

    // Calculate subtotal
    let subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.service.basePrice * item.quantity);
    }, 0);

    let totalDiscount = 0;
    let totalAmount = subtotal;
    let couponDetails = null;

    // Apply coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode });
      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coupon code'
        });
      }

      // Check if coupon is valid for user
      if (coupon.usedBy.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Coupon already used by this user'
        });
      }

      // Check if coupon is expired
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Coupon has expired'
        });
      }

      // Check minimum order value
      if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
        return res.status(400).json({
          success: false,
          message: `Minimum order value of ${coupon.minOrderValue} required for this coupon`
        });
      }

      // Calculate discount
      let discount = 0;
      if (coupon.discountType === 'percent') {
        discount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
      } else {
        discount = coupon.discountValue;
      }

      // Update discount for each service proportionally
      const discountRatio = discount / subtotal;
      serviceItems.forEach(item => {
        item.discountAmount = Math.round(item.price * item.quantity * discountRatio * 100) / 100;
      });

      totalDiscount = discount;
      totalAmount = subtotal - totalDiscount;
      couponDetails = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      };
    }

    // Create booking
    const booking = await Booking.create({
      customer: userId,
      services: serviceItems,
      date: bookingDate,
      time: time || null,
      address,
      couponApplied: couponDetails,
      totalDiscount,
      subtotal,
      totalAmount,
      notes: notes || null,
      status: 'pending',
      paymentStatus: 'unpaid',
      confirmedBooking: false
    });

    // Clear the cart
    await Cart.findOneAndUpdate(
      { user: userId },
      { $set: { items: [] } }
    );

    res.status(201).json({
      success: true,
      message: 'Booking created successfully from cart. Please confirm payment to complete booking.',
      data: booking
    });
  } catch (error) {
    console.error('Error creating booking from cart:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create booking from cart'
    });
  }
};

// Create single service booking
const createBooking = async (req, res) => {
  try {
    const {
      serviceId,
      date,
      time,
      address,
      notes,
      couponCode,
      quantity = 1
    } = req.body;

    // Validate required fields
    if (!serviceId || !date || !address) {
      return res.status(400).json({
        success: false,
        message: 'Service ID, date and address are required'
      });
    }

    // Check if service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Validate date
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    if (bookingDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Booking date must be in the future'
      });
    }

    // Calculate amount
    let subtotal = service.basePrice * quantity;
    let totalDiscount = 0;
    let totalAmount = subtotal;
    let couponDetails = null;

    // Apply coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode });
      if (!coupon) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coupon code'
        });
      }

      // Check if coupon is valid for user
      if (coupon.usedBy.includes(req.user._id)) {
        return res.status(400).json({
          success: false,
          message: 'Coupon already used by this user'
        });
      }

      // Check if coupon is expired
      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Coupon has expired'
        });
      }

      // Check minimum order value
      if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
        return res.status(400).json({
          success: false,
          message: `Minimum order value of ${coupon.minOrderValue} required for this coupon`
        });
      }

      // Calculate discount
      let discount = 0;
      if (coupon.discountType === 'percent') {
        discount = (subtotal * coupon.discountValue) / 100;
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
      } else {
        discount = coupon.discountValue;
      }

      totalDiscount = discount;
      totalAmount = subtotal - totalDiscount;
      couponDetails = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      };
    }

    // Create booking with service details
    const booking = new Booking({
      customer: req.user._id,
      services: [{
        service: serviceId,
        quantity,
        price: service.basePrice,
        discountAmount: totalDiscount,
        serviceDetails: {
          title: service.title,
          description: service.description,
          duration: service.duration,
          category: service.category
        }
      }],
      date: bookingDate,
      time: time || null,
      address,
      notes: notes || null,
      couponApplied: couponDetails,
      totalDiscount,
      subtotal,
      totalAmount,
      status: 'pending',
      confirmedBooking: false
    });

    await booking.save();

    res.status(201).json({
      success: true,
      message: 'Booking created successfully. Please confirm payment to complete booking.',
      data: booking,
      bookingId: booking._id // Explicitly include booking ID for frontend compatibility
    });

  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create booking'
    });
  }
};

// Confirm booking and process payment
const confirmBooking = async (req, res) => {
  try {
    const { bookingId, paymentMethod, paymentDetails } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!bookingId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and payment method are required'
      });
    }

    // Find booking
    const booking = await Booking.findOne({
      _id: bookingId,
      customer: userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking is already confirmed
    if (booking.confirmedBooking) {
      return res.status(400).json({
        success: false,
        message: 'Booking is already confirmed'
      });
    }

    // Check if booking is already cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot confirm a cancelled booking'
      });
    }

    // Process payment based on payment method
    let paymentResult;
    switch (paymentMethod) {
      case 'credit_card':
        // Validate card details
        if (!paymentDetails || !paymentDetails.cardNumber || !paymentDetails.expiry || !paymentDetails.cvv) {
          return res.status(400).json({
            success: false,
            message: 'Card details are required for credit card payment'
          });
        }
        // Process card payment (in a real app, you'd use a payment gateway here)
        paymentResult = await processCardPayment({
          amount: booking.totalAmount,
          cardDetails: paymentDetails,
          bookingId: booking._id
        });
        break;

      case 'wallet':
        // Check if user has sufficient wallet balance
        const user = await User.findById(userId);
        if (user.walletBalance < booking.totalAmount) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient wallet balance'
          });
        }
        // Deduct from wallet
        user.walletBalance -= booking.totalAmount;
        await user.save();
        paymentResult = { success: true, transactionId: `WALLET-${Date.now()}` };
        break;

      case 'cash':
        // For cash payments, just record it
        paymentResult = { success: true, transactionId: `CASH-${Date.now()}` };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid payment method'
        });
    }

    if (!paymentResult.success) {
      return res.status(400).json({
        success: false,
        message: paymentResult.message || 'Payment failed'
      });
    }

    // Update booking status
    booking.paymentStatus = 'paid';
    booking.paymentMethod = paymentMethod;
    booking.paymentDetails = {
      transactionId: paymentResult.transactionId,
      amount: booking.totalAmount,
      date: new Date()
    };
    booking.confirmedBooking = true;
    booking.status = 'confirmed';

    // Mark coupon as used if applied
    if (booking.couponApplied) {
      await Coupon.findOneAndUpdate(
        { code: booking.couponApplied.code },
        { $addToSet: { usedBy: userId } }
      );
    }

    await booking.save();

    // Send confirmation email
    try {
      const user = await User.findById(userId);
      const emailHtml = `
        <h2>Booking Confirmed</h2>
        <p>Your booking has been successfully confirmed.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Total Amount:</strong> ${booking.totalAmount}</p>
        <p><strong>Payment Method:</strong> ${paymentMethod}</p>
        <p><strong>Transaction ID:</strong> ${paymentResult.transactionId}</p>
        <p>We'll contact you soon with more details about your service appointment.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Booking Confirmation',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: {
        booking,
        payment: {
          method: paymentMethod,
          transactionId: paymentResult.transactionId,
          amount: booking.totalAmount
        }
      }
    });

  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm booking'
    });
  }
};

// Helper function to simulate card payment processing
async function processCardPayment({ amount, cardDetails, bookingId }) {
  // In a real application, this would integrate with a payment gateway like Stripe
  // This is just a simulation for demonstration purposes

  // Validate card details (basic validation)
  if (!cardDetails.cardNumber || !cardDetails.expiry || !cardDetails.cvv) {
    return { success: false, message: 'Invalid card details' };
  }

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Simulate a successful payment 90% of the time
  if (Math.random() > 0.1) {
    return {
      success: true,
      transactionId: `CARD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    };
  } else {
    return {
      success: false,
      message: 'Payment declined by bank'
    };
  }
}

// Update booking status
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is authorized to update this booking
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this booking'
      });
    }

    // Validate status transition
    const allowedTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['completed', 'cancelled'],
      'cancelled': []
    };

    if (!allowedTransitions[booking.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${booking.status} to ${status}`
      });
    }

    booking.status = status;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking status updated successfully',
      data: booking
    });

  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update booking status'
    });
  }
};

// Get user bookings
const getUserBookings = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { customer: req.user._id };

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('services.service', 'title description basePrice category image duration')
      .populate('provider', 'name email phone businessName contactPerson rating')
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 });

    // Fetch transaction details for each booking
    const Transaction = require('../models/Transaction-model ');
    const bookingsWithTransactions = await Promise.all(
      bookings.map(async (booking) => {
        const bookingObj = booking.toObject();
        
        // Find transaction for this booking
        const transaction = await Transaction.findOne({ 
          booking: booking._id,
          paymentStatus: { $in: ['completed', 'paid'] }
        }).sort({ createdAt: -1 });

        if (transaction) {
          bookingObj.transactionId = transaction.transactionId;
          bookingObj.razorpayPaymentId = transaction.razorpayPaymentId;
          bookingObj.paymentMethod = transaction.paymentMethod;
          bookingObj.paymentDate = transaction.updatedAt;
        }

        return bookingObj;
      })
    );

    res.status(200).json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: bookingsWithTransactions
    });

  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch bookings'
    });
  }
};

// Get customer bookings (alias for getUserBookings to match frontend requirements)
const getCustomerBookings = async (req, res) => {
  return getUserBookings(req, res);
};

// Update booking payment method and status
const updateBookingPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paymentStatus } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!paymentMethod || !paymentStatus) {
      return res.status(400).json({
        success: false,
        message: 'Payment method and payment status are required'
      });
    }

    // Validate payment method
    if (!['online', 'cash'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Must be "online" or "cash"'
      });
    }

    // Validate payment status
    if (!['pending', 'paid', 'failed'].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status. Must be "pending", "paid", or "failed"'
      });
    }

    // Find booking
    const booking = await Booking.findOne({
      _id: id,
      customer: userId
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking can be updated
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update payment for cancelled booking'
      });
    }

    // Update payment details
    booking.paymentMethod = paymentMethod;
    booking.paymentStatus = paymentStatus;
    
    // Keep booking status as "pending" until provider accepts
    if (booking.status !== 'accepted' && booking.status !== 'completed') {
      booking.status = 'pending';
    }

    await booking.save();

    // Send confirmation email if payment is completed
    if (paymentStatus === 'paid') {
      try {
        const user = await User.findById(userId);
        const emailHtml = `
          <h2>Payment Confirmed</h2>
          <p>Your payment has been successfully processed.</p>
          <p><strong>Booking ID:</strong> ${booking._id}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p><strong>Amount:</strong> ₹${booking.totalAmount}</p>
          <p>Your booking is now pending provider acceptance.</p>
        `;

        await sendEmail({
          to: user.email,
          subject: 'Payment Confirmed',
          html: emailHtml
        });
      } catch (emailError) {
        console.error('Failed to send payment confirmation email:', emailError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment details updated successfully',
      data: {
        bookingId: booking._id,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        status: booking.status
      }
    });

  } catch (error) {
    console.error('Error updating booking payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update payment details'
    });
  }
};

// Get provider details by ID
const getProviderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider ID'
      });
    }

    const provider = await Provider.findById(id)
      .select('name email phone businessName contactPerson rating services experience serviceArea address')
      .lean();

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Provider details retrieved successfully',
      data: provider
    });

  } catch (error) {
    console.error('Error fetching provider details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch provider details'
    });
  }
};

// Get service details by ID
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID'
      });
    }

    const service = await Service.findById(id)
      .select('title description basePrice category image duration isActive')
      .lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Service details retrieved successfully',
      data: service
    });

  } catch (error) {
    console.error('Error fetching service details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch service details'
    });
  }
};

// Get single booking
const getBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('services.service', 'title description basePrice category image duration')
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone businessName contactPerson rating address')
      .populate('invoice')
      .populate('feedback');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user is authorized to view this booking
    if (booking.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this booking'
      });
    }

    // Fetch transaction details
    const Transaction = require('../models/Transaction-model ');
    const transactions = await Transaction.find({ 
      booking: booking._id 
    }).sort({ createdAt: -1 });

    const bookingObj = booking.toObject();
    
    if (transactions.length > 0) {
      const completedTransaction = transactions.find(t => 
        ['completed', 'paid'].includes(t.paymentStatus)
      ) || transactions[0];
      
      bookingObj.transactionId = completedTransaction.transactionId;
      bookingObj.razorpayPaymentId = completedTransaction.razorpayPaymentId;
      bookingObj.razorpayOrderId = completedTransaction.razorpayOrderId;
      bookingObj.paymentMethod = completedTransaction.paymentMethod;
      bookingObj.paymentDate = completedTransaction.updatedAt;
      bookingObj.transactions = transactions;
    }

    res.status(200).json({
      success: true,
      message: 'Booking details retrieved successfully',
      data: bookingObj
    });

  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch booking details'
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
    if (previousStatus === 'confirmed') {
      await Provider.findByIdAndUpdate(booking.provider, {
        $inc: { canceledBookings: 1 }
      });
    }

    // Process refund if payment was made
    if (booking.paymentStatus === 'paid') {
      // In a real app, you would initiate a refund process here
      // For wallet payments, we can credit back immediately
      if (booking.paymentMethod === 'wallet') {
        await User.findByIdAndUpdate(userId, {
          $inc: { walletBalance: booking.totalAmount }
        });
      }

      // Record refund details
      booking.refund = {
        amount: booking.totalAmount,
        method: booking.paymentMethod,
        status: booking.paymentMethod === 'wallet' ? 'completed' : 'pending',
        initiatedAt: new Date()
      };
      await booking.save();
    }

    // Send cancellation email
    try {
      const user = await User.findById(userId);
      const emailHtml = `
        <h2>Booking Cancelled</h2>
        <p>Your booking has been successfully cancelled.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Original Date:</strong> ${booking.date.toDateString()}</p>
        ${booking.time ? `<p><strong>Time:</strong> ${booking.time}</p>` : ''}
        ${booking.refund ? `<p><strong>Refund Status:</strong> ${booking.refund.status}</p>` : ''}
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
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        refund: booking.refund
      }
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel booking'
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

    // User can only modify pending or confirmed bookings
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(403).json({
        success: false,
        message: 'Only pending or confirmed bookings can be rescheduled'
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
      if (isNaN(newDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }

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
      const user = await User.findById(userId);
      const emailHtml = `
        <h2>Booking Rescheduled</h2>
        <p>Your booking has been successfully rescheduled.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>New Date:</strong> ${booking.date.toDateString()}</p>
        <p><strong>New Time:</strong> ${booking.time || 'To be confirmed'}</p>
        <p>Please contact support if you need to make any further changes.</p>
      `;

      await sendEmail({
        to: user.email,
        subject: 'Booking Rescheduled',
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
    console.error('Error updating booking date/time:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update booking date/time'
    });
  }
};



// PROVIDER CONTROLLERS

/**
 * @desc    Get a single booking by ID for provider
 * @route   GET /api/providers/bookings/:id
 * @access  Private/Provider
 */
const getProviderBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.provider._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid booking ID format' 
      });
    }

    const provider = await Provider.findById(providerId)
      .select('services performanceTier')
      .lean();
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId,
      provider.performanceTier
    );

    const servicesInCategory = await Service.find({
      category: { $in: provider.services }
    }).select('_id');

    const serviceIds = servicesInCategory.map(s => s._id);

    const booking = await Booking.findOne({
      _id: id,
      'services.service': { $in: serviceIds },
      $or: [
        { provider: { $exists: false } },
        { provider: providerId }
      ]
    })
    .populate('customer', 'name email phone')
    .populate('services.service', 'name description duration price')
    .lean();

    if (!booking) {
      return res.status(404).json({ 
        success: false,
        message: 'Booking not found or not available for this provider' 
      });
    }

    const { commission, netAmount } = CommissionRule.calculateCommission(
      booking.totalAmount,
      commissionRule
    );

    const responseData = {
      ...booking,
      commission: {
        rule: commissionRule ? {
          _id: commissionRule._id,
          name: commissionRule.name,
          type: commissionRule.type,
          value: commissionRule.value
        } : null,
        amount: commission
      },
      netAmount,
      providerCommissionRate: commissionRule ? commissionRule.value : 0
    };

    res.status(200).json({ 
      success: true,
      data: responseData 
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get all bookings for a provider by status
 * @route   GET /api/providers/bookings/status/:status
 * @access  Private/Provider
 */
const getBookingsByStatus = async (req, res) => {
  try {
    const providerId = req.provider._id;
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const validStatuses = ['pending', 'accepted', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status parameter'
      });
    }

    const provider = await Provider.findById(providerId)
      .select('services performanceTier');
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId,
      provider.performanceTier
    );

    const servicesInCategory = await Service.find({
      category: { $in: provider.services }
    }).select('_id');

    const serviceIds = servicesInCategory.map(s => s._id);

    const query = {
      status,
      'services.service': { $in: serviceIds }
    };

    if (status === 'pending') {
      query.$or = [
        { provider: { $exists: false } },
        { provider: providerId }
      ];
    } else {
      query.provider = providerId;
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'name email phone')
      .populate('services.service', 'name price duration')
      .sort({ date: 1, time: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const bookingsWithCommission = bookings.map(booking => {
      const { commission, netAmount } = CommissionRule.calculateCommission(
        booking.totalAmount,
        commissionRule
      );
      
      return {
        ...booking,
        commission: {
          rule: commissionRule ? {
            _id: commissionRule._id,
            name: commissionRule.name,
            type: commissionRule.type,
            value: commissionRule.value
          } : null,
          amount: commission
        },
        netAmount,
        providerCommissionRate: commissionRule ? commissionRule.value : 0
      };
    });

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: bookingsWithCommission
    });

  } catch (error) {
    console.error('Booking Fetch Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Accept a booking
 * @route   PUT /api/bookings/:id/accept
 * @access  Private/Provider
 */
const acceptBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.provider._id;
    const { time } = req.body;

    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Check if provider exists and get their services
    const provider = await Provider.findById(providerId).select('services');
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Find the booking that matches:
    // 1. The booking ID
    // 2. Has services the provider offers
    // 3. Is either unassigned or assigned to this provider
    // 4. Is in pending status
    const booking = await Booking.findOne({
      _id: id,
      status: 'pending',
      $or: [
        { provider: { $exists: false } },
        { provider: providerId }
      ]
    }).populate('services.service', 'category');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not available for acceptance'
      });
    }

    // Verify provider can service this booking
    const canService = booking.services.every(serviceItem => 
      provider.services.includes(serviceItem.service.category)
    );

    if (!canService) {
      return res.status(403).json({
        success: false,
        message: 'Provider is not qualified for all services in this booking'
      });
    }

    // Validate time format if provided
    if (time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid time format (use HH:MM)'
      });
    }

    // Update booking
    booking.status = 'accepted';
    booking.provider = providerId;
    if (time) booking.time = time;
    booking.updatedAt = new Date();

    await booking.save();

    // Populate booking details for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('services.service', 'title description price');

    // Send notification email (async - don't wait for it)
    try {
      const emailHtml = `
        <h2>Booking Accepted</h2>
        <p>Your booking has been accepted by the service provider.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Service:</strong> ${populatedBooking.services[0].service.title}</p>
        <p><strong>Date:</strong> ${new Date(booking.date).toDateString()}</p>
        <p><strong>Time:</strong> ${booking.time || 'To be confirmed'}</p>
        <p><strong>Provider:</strong> ${provider.name}</p>
      `;

      await sendEmail({
        to: populatedBooking.customer.email,
        subject: 'Booking Accepted',
        html: emailHtml
      });
    } catch (emailError) {
      console.error('Failed to send acceptance email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: populatedBooking
    });

  } catch (error) {
    console.error('Error accepting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while accepting booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Complete a booking and generate invoice
 * @route   PUT /api/providers/bookings/:id/complete
 * @access  Private/Provider
 */
const completeBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const providerId = req.provider._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const provider = await Provider.findById(providerId)
      .select('name email performanceTier')
      .session(session);
      
    if (!provider) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId,
      provider.performanceTier
    );

    const booking = await Booking.findOne({
      _id: id,
      provider: providerId,
      status: 'accepted'
    })
    .populate('customer', 'name email phone')
    .populate('services.service', 'title basePrice')
    .session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not available for completion'
      });
    }

    // Calculate commission and net amount
    const { commission, netAmount } = CommissionRule.calculateCommission(
      booking.totalAmount,
      commissionRule
    );

    // Update booking status
    booking.status = 'completed';
    booking.completedAt = new Date();
    await booking.save({ session });

    // Generate invoice
    const invoice = await Invoice.createFromBooking(booking, { session });

    // Create provider earning record
    const providerEarning = new ProviderEarning({
      provider: providerId,
      booking: booking._id,
      grossAmount: booking.totalAmount,
      commissionRate: commissionRule ? commissionRule.value : 0,
      commissionAmount: commission,
      netAmount: netAmount,
      status: 'available',
      availableAfter: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Available after 7 days
    });
    await providerEarning.save({ session });

    // Update provider stats
    await Provider.findByIdAndUpdate(
      providerId,
      {
        $inc: {
          completedBookings: 1,
          totalEarnings: netAmount,
          totalCommissionPaid: commission
        }
      },
      { session }
    );

    // Send confirmation emails
    try {
      const servicesList = booking.services.map(item => 
        `<li>${item.service.title} (Qty: ${item.quantity}) - ₹${item.price.toFixed(2)}</li>`
      ).join('');

      const emailHtml = `
        <h2>Service Completed</h2>
        <p>The service for your booking has been marked as completed.</p>
        <p><strong>Booking ID:</strong> ${booking._id}</p>
        <p><strong>Invoice No:</strong> ${invoice.invoiceNo}</p>
        
        <h3>Services Provided:</h3>
        <ul>${servicesList}</ul>
        
        <p><strong>Total Amount:</strong> ₹${booking.totalAmount.toFixed(2)}</p>
        <p><strong>Commission:</strong> ₹${commission.toFixed(2)} (${commissionRule ? commissionRule.value : 0}${commissionRule?.type === 'percentage' ? '%' : ''})</p>
        <p><strong>Provider Earnings:</strong> ₹${netAmount.toFixed(2)}</p>
        
        <p><strong>Payment Status:</strong> ${booking.paymentStatus === 'paid' ? 
          'Paid - Thank you!' : 
          `Pending - Please make payment by ${new Date(invoice.dueDate).toLocaleDateString()}`}</p>
          
        <p>Thank you for using our service!</p>
      `;

      await sendEmail({
        to: booking.customer.email,
        subject: `Service Completed - Invoice #${invoice.invoiceNo}`,
        html: emailHtml
      });

      await sendEmail({
        to: provider.email,
        subject: `Service Completed - Invoice #${invoice.invoiceNo}`,
        html: emailHtml.replace('Service Completed', 'Service Completed - Provider Copy')
      });
    } catch (emailError) {
      console.error('Failed to send completion email:', emailError);
    }

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'Booking completed and invoice generated successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        invoiceId: invoice._id,
        invoiceNo: invoice.invoiceNo,
        totalAmount: invoice.totalAmount,
        commission: invoice.commission.amount,
        netAmount: invoice.netAmount,
        providerEarning: {
          grossAmount: providerEarning.grossAmount,
          commission: providerEarning.commissionAmount,
          netAmount: providerEarning.netAmount,
          availableAfter: providerEarning.availableAfter
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error completing booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete booking and generate invoice',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};



// ADMIN CONTROLLERS

// Get all bookings
const getAllBookings = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Sorting
    let sort = {};
    if (req.query.sortBy) {
      const sortFields = req.query.sortBy.split(',');
      sortFields.forEach(field => {
        const [key, order] = field.split(':');
        sort[key] = order === 'desc' ? -1 : 1;
      });
    } else {
      sort = { createdAt: -1 }; // Default: newest first
    }

    // Filtering
    let filter = {};

    // Status filter
    if (req.query.status) {
      filter.status = { $in: req.query.status.split(',') };
    }

    // Payment status filter
    if (req.query.paymentStatus) {
      filter.paymentStatus = { $in: req.query.paymentStatus.split(',') };
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) {
        filter.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.date.$lte = new Date(req.query.endDate);
      }
    }

    // Search by customer name or ID (if implemented in your model)
    if (req.query.search) {
      filter.$or = [
        { 'customer.name': { $regex: req.query.search, $options: 'i' } },
        { 'customer.email': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Get bookings with filters, pagination, and sorting
    const bookings = await Booking.find(filter)
      .populate('customer', 'name email phone')
      .populate('provider', 'businessName contactPerson')
      .populate('services.service', 'name description')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Booking.countDocuments(filter);
    const pages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      count: bookings.length,
      page,
      pages,
      total,
      data: bookings
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



 // Get booking details with service and payment information
const getBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone businessName')
      .populate({
        path: 'services.service',
        select: 'title category description basePrice duration image'
      })
      .populate({
        path: 'invoice',
        populate: {
          path: 'transactions',
          model: 'Transaction'
        }
      })
      .populate('feedback')
      .populate('complaint')
      .populate('commissionRule', 'name rate type');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Format services with service details
    const formattedServices = booking.services.map(item => ({
      _id: item._id,
      service: {
        _id: item.service?._id,
        title: item.service?.title,
        category: item.service?.category,
        description: item.service?.description,
        basePrice: item.service?.basePrice,
        duration: item.service?.duration,
        image: item.service?.image
      },
      quantity: item.quantity,
      price: item.price,
      discountAmount: item.discountAmount
    }));

    // Get payment details if payment was online
    let paymentDetails = null;
    if (booking.paymentMethod === 'online' && booking.invoice?.transactions?.length > 0) {
      const transaction = booking.invoice.transactions[0];
      paymentDetails = {
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        paymentStatus: transaction.paymentStatus,
        paymentMethod: transaction.paymentMethod,
        currency: transaction.currency,
        razorpayOrderId: transaction.razorpayOrderId,
        razorpayPaymentId: transaction.razorpayPaymentId,
        createdAt: transaction.createdAt
      };
    }

    // Format the response
    const response = {
      booking: {
        _id: booking._id,
        date: booking.date,
        time: booking.time,
        status: booking.status,
        address: booking.address,
        specialInstructions: booking.specialInstructions,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        bookingDateTime: booking.bookingDateTime,
        isUpcoming: booking.isUpcoming,
        confirmedBooking: booking.confirmedBooking
      },
      customer: booking.customer,
      provider: booking.provider,
      services: formattedServices,
      payment: {
        method: booking.paymentMethod,
        status: booking.paymentStatus,
        subtotal: booking.subtotal,
        totalDiscount: booking.totalDiscount,
        totalAmount: booking.totalAmount,
        couponApplied: booking.couponApplied,
        details: paymentDetails
      },
      commission: {
        amount: booking.commissionAmount,
        rule: booking.commissionRule
      },
      invoice: booking.invoice,
      feedback: booking.feedback,
      complaint: booking.complaint,
      adminRemark: booking.adminRemark
    };

    res.json({
      success: true,
      data: response
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
  createBooking,
  confirmBooking,
  updateBookingStatus,
  getUserBookings,
  getCustomerBookings,
  updateBookingPayment,
  getProviderById,
  getServiceById,
  getBooking,
  cancelBooking,
  userUpdateBookingDateTime,
  getProviderBookingById,
  getBookingsByStatus,
  acceptBooking,
  completeBooking,
  getAllBookings,
  getBookingDetails,
  assignProvider,
  deleteBooking,
  deleteUserBooking,
  updateBookingDateTime
};
