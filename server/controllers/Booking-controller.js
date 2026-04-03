const mongoose = require('mongoose');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model');
const CommissionRule = require('../models/CommissionRule-model');
const Coupon = require('../models/Coupon-model');
const Transaction = require('../models/Transaction-model');
const ProviderEarning = require('../models/ProviderEarning-model');
const ExcelJS = require('exceljs');
const { sendNotification, notifyAdmins } = require('../utils/notificationHelper');
const { generateBookingId } = require('../utils/generateUniqueId');




// USER BOOKING CONTROLLERS


// Create single service booking
const createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      serviceId,
      date,
      time,
      address,
      notes,
      couponCode,
      quantity = 1,
      paymentMethod = 'online' // Default to online payment
    } = req.body;

    // Validate required fields
    if (!serviceId || !date || !address || !paymentMethod) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Service ID, date, address, and payment method are required'
      });
    }

    // Validate payment method
    if (!['online', 'cash'].includes(paymentMethod)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Payment method must be either "online" or "cash"'
      });
    }

    // Check if service exists
    const service = await Service.findById(serviceId).session(session);
    if (!service) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    // Validate date
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // CHECK FOR DUPLICATE BOOKING (Idempotency)
    const existingBooking = await Booking.findOne({
      customer: req.user._id,
      'services.service': serviceId,
      date: bookingDate,
      time: time || null,
      status: { $nin: ['cancelled'] }
    }).session(session);

    if (existingBooking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        message: 'Existing booking found. Returning current booking.',
        data: existingBooking.toObject(),
        bookingId: existingBooking.bookingId || existingBooking._id,
        _id: existingBooking._id,
        isDuplicate: true
      });
    }



    // Calculate amounts
    let subtotal = service.basePrice * quantity;
    let totalDiscount = 0;
    let couponDetails = null;

    // Process coupon if provided
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode }).session(session);
      if (!coupon) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Invalid coupon code'
        });
      }

      // Validate coupon
      if (coupon.usedBy.includes(req.user._id)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Coupon already used by this user'
        });
      }

      if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Coupon has expired'
        });
      }

      if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
        await session.abortTransaction();
        session.endSession();
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
      couponDetails = {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscount: coupon.maxDiscount || null
      };

      // Mark coupon as used (but don't save yet - will save after booking is created)
      coupon.usedBy.push(req.user._id);
    }

    const totalAmount = subtotal - totalDiscount;

    // Create booking
    const booking = new Booking({
      bookingId: generateBookingId(),
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
      paymentMethod, // Add the missing paymentMethod field
      status: 'pending',
      paymentStatus: 'pending',
      confirmedBooking: false
    });

    // Save booking
    await booking.save({ session });

    // If coupon was applied, save the updated coupon
    if (couponCode && couponDetails) {
      await Coupon.findOneAndUpdate(
        { code: couponCode },
        { $addToSet: { usedBy: req.user._id } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Booking created successfully. Please confirm payment to complete booking.',
      data: booking.toObject(),
      bookingId: booking.bookingId,
      _id: booking._id
    });

    // Real-time notification (non-blocking)
    try {
      // Notify provider about new booking request
      if (booking.provider) {
        const providerDoc = await Provider.findById(booking.provider).select('_id').lean();
        if (providerDoc?._id) {
          sendNotification(
            providerDoc._id,
            'provider',
            'New Booking Request',
            `You have a new booking request for ${booking.services?.[0]?.title || 'a service'}.`,
            'booking',
            booking._id
          );
        }
      }
    } catch (e) { /* ignore notification errors */ }

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Confirm booking and process payment 
const confirmBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fix: Add null check for req.body before destructuring
    const { bookingId, paymentMethod, paymentDetails } = req.body || {};
    const userId = req.user._id;

    // Validate required fields
    if (!bookingId || !paymentMethod) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Booking ID and payment method are required'
      });
    }

    // Find booking with all necessary data
    const booking = await Booking.findOne({
      _id: bookingId,
      customer: userId
    })
      .populate('services.service')
      .session(session);

    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check booking status
    if (booking.confirmedBooking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Booking is already confirmed'
      });
    }

    if (booking.status === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Cannot confirm a cancelled booking'
      });
    }

    // Process payment
    let paymentResult;
    switch (paymentMethod) {
      case 'credit_card':
      case 'online':
        // Process online payment
        paymentResult = await processOnlinePayment({
          amount: booking.totalAmount,
          bookingId: booking._id,
          paymentDetails,
          userId
        }, session);
        break;

      case 'cash':
        // Cash payment - just record it
        paymentResult = {
          success: true,
          paymentStatus: 'pending'
        };
        break;

      default:
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Invalid payment method'
        });
    }

    if (!paymentResult.success) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: paymentResult.message || 'Payment failed'
      });
    }

    // Update booking status
    booking.paymentMethod = paymentMethod;
    booking.paymentStatus = paymentResult.paymentStatus || 'paid';
    booking.confirmedBooking = true;
    booking.status = 'scheduled';

    // Update transaction
    const transaction = await Transaction.findOneAndUpdate(
      { booking: bookingId },
      {
        paymentMethod,
        paymentStatus: booking.paymentStatus,
        transactionId: paymentResult.transactionId,
        razorpayOrderId: paymentResult.razorpayOrderId,
        razorpayPaymentId: paymentResult.razorpayPaymentId,
        amount: booking.totalAmount,
        completedAt: new Date()
      },
      { new: true, session }
    );

    await booking.save({ session });

    // Increment user's total bookings
    await User.findByIdAndUpdate(userId, { $inc: { totalBookings: 1 } }, { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: {
        booking,
        transaction
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error confirming booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm booking',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Helper function to process online payments
async function processOnlinePayment({ amount, bookingId, paymentDetails, userId }, session) {
  try {


    // Validate payment details
    if (!paymentDetails || !paymentDetails.cardNumber || !paymentDetails.expiry || !paymentDetails.cvv) {
      return { success: false, message: 'Card details are required for online payment' };
    }

    // Simulate payment processing
    const paymentSuccess = Math.random() > 0.1; // 90% success rate

    if (paymentSuccess) {
      return {
        success: true,
        transactionId: `TXN-${Date.now()}`,
        razorpayOrderId: `ORDER-${Date.now()}`,
        razorpayPaymentId: `PAY-${Date.now()}`,
        paymentStatus: 'paid'
      };
    } else {
      return {
        success: false,
        message: 'Payment declined by bank'
      };
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    return {
      success: false,
      message: 'Payment processing failed'
    };
  }
}


// Update booking status
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    // Fix: Add null check for req.body before destructuring
    const { status } = req.body || {};

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
      'scheduled': ['accepted', 'cancelled'],
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
    const { status, timeFilter, searchTerm, page = 1, limit = 10 } = req.query;
    const query = { customer: req.user._id };
    const currentPage = parseInt(page);
    const itemsPerPage = parseInt(limit);

    // Status filter
    if (status) {
      if (status === 'upcoming') {
        query.status = { $in: ['scheduled', 'accepted', 'in-progress'] };
      } else if (status === 'pending_payment') {
        query.paymentStatus = 'pending';
      } else if (status !== 'all') {
        query.status = status;
      }
    }

    // Time filter
    if (timeFilter && timeFilter !== 'all') {
      const now = new Date();
      let startDate;
      switch (timeFilter) {
        case '7days':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case '1month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
        case '6months':
          startDate = new Date(now.setMonth(now.getMonth() - 6));
          break;
        case '1year':
          startDate = new Date(now.setFullYear(now.getFullYear() - 1));
          break;
        default:
          startDate = null;
      }
      if (startDate) {
        query.createdAt = { $gte: startDate };
      }
    }

    // Search: match by bookingId (always) or service title (via populate below)
    if (searchTerm) {
      query.$or = [
        { bookingId: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const totalBookings = await Booking.countDocuments(query);

    const bookings = await Booking.find(query)
      .populate({
        path: 'services.service',
        select: 'title description basePrice category images duration',
        // Search term filter on service title
        match: searchTerm ? { title: { $regex: searchTerm, $options: 'i' } } : {}
      })
      .populate({
        path: 'provider',
        select: 'name email phone completedBookings performanceScore feedbacks providerId',
        populate: {
          path: 'feedbacks',
          select: 'providerFeedback.rating'
        }
      })
      .populate('customer', 'name email phone')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .lean();

    // Keep bookings where service title matched OR bookingId matched the search term
    const filteredBookings = bookings.filter(b => {
      const serviceMatch = b.services && b.services.length > 0 && b.services[0].service;
      const bookingIdMatch = searchTerm && b.bookingId &&
        new RegExp(searchTerm, 'i').test(b.bookingId);
      return serviceMatch || bookingIdMatch;
    });


    // Fetch transaction details for each booking
    const Transaction = require('../models/Transaction-model');
    const bookingsWithTransactions = await Promise.all(
      filteredBookings.map(async (booking) => {
        const bookingObj = booking;

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

    const totalPages = Math.ceil(totalBookings / itemsPerPage);

    res.status(200).json({
      success: true,
      message: 'Bookings retrieved successfully',
      data: bookingsWithTransactions,
      pagination: {
        currentPage,
        totalPages,
        totalBookings,
        itemsPerPage,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
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
    // Fix: Add null check for req.body before destructuring
    const { paymentMethod, paymentStatus } = req.body || {};
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

// Convert COD to Online Payment
const payBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { paymentDetails } = req.body;
    const userId = req.user._id;

    const booking = await Booking.findOne({ _id: id, customer: userId }).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: 'Cannot pay for cancelled booking' });
    }

    if (booking.paymentStatus === 'paid') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Booking already paid' });
    }

    // Process online payment
    const paymentResult = await processOnlinePayment({
      amount: booking.totalAmount,
      bookingId: booking._id,
      paymentDetails,
      userId
    }, session);

    if (!paymentResult.success) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: paymentResult.message || 'Payment failed' });
    }

    // Update booking
    booking.paymentMethod = 'online';
    booking.paymentStatus = 'paid';
    await booking.save({ session });

    // Record Transaction
    await Transaction.create([{
      customer: userId,
      booking: booking._id,
      amount: booking.totalAmount,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      transactionId: paymentResult.transactionId,
      razorpayOrderId: paymentResult.razorpayOrderId,
      razorpayPaymentId: paymentResult.razorpayPaymentId,
      status: 'completed'
    }], { session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Payment successful',
      data: booking
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error in payBooking:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to process payment' });
  }
};

// Get provider details by ID
const getProviderById = async (req, res) => {
  try {
    const { id } = req.params;

    let query = { providerId: id };
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      query = { $or: [{ _id: id }, { providerId: id }] };
    }

    const provider = await Provider.findOne(query)
      .select('name email phone rating services experience serviceArea address providerId')
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
      .select('title description basePrice category images duration isActive')
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
      .populate('services.service', 'title description basePrice category images duration')
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone businessName contactPerson rating address')
      .populate('feedback')
      .lean();

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
    const Transaction = require('../models/Transaction-model');
    const transactions = await Transaction.find({
      booking: booking._id
    }).sort({ createdAt: -1 });

    const bookingObj = booking;

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

// Cancel booking with e-commerce style progress tracking
const cancelBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    // Handle cases where req.body might be undefined or empty
    const { reason } = req.body || {}; // Optional cancellation reason
    const userId = req.user.id;

    const booking = await Booking.findOne({ _id: id, customer: userId }).session(session);
    if (!booking) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'completed') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed booking'
      });
    }

    if (booking.status === 'cancelled') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    const previousStatus = booking.status;

    // Step 1: Mark booking as cancelled
    booking.status = 'cancelled';
    booking.cancellationProgress.status = 'cancelled';
    booking.cancellationProgress.reason = reason || 'Customer requested cancellation';
    booking.cancellationProgress.cancelledAt = new Date();

    await booking.save({ session });

    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { totalBookings: -1 }
    }, { session });

    // Update provider stats if booking was already accepted
    if (previousStatus === 'accepted' && booking.provider) {
      await Provider.findByIdAndUpdate(booking.provider, {
        $inc: { canceledBookings: 1 }
      }, { session });
    }

    let refundDetails = null;

    // Step 2: Process refund if payment was made
    if (booking.paymentStatus === 'paid') {
      booking.cancellationProgress.status = 'processing_refund';
      booking.cancellationProgress.refundAmount = booking.totalAmount;
      await booking.save({ session });

      refundDetails = {
        amount: booking.totalAmount,
        method: booking.paymentMethod,
        status: 'processing',
        estimatedCompletion: booking.paymentMethod === 'online' ? '3-5 business days' : 'Immediate'
      };
    }

    await session.commitTransaction();
    session.endSession();

    // Return response with e-commerce style progress information
    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        cancellationProgress: {
          status: booking.cancellationProgress.status,
          reason: booking.cancellationProgress.reason,
          cancelledAt: booking.cancellationProgress.cancelledAt,
          refundAmount: booking.cancellationProgress.refundAmount,
          estimatedRefundTime: refundDetails?.estimatedCompletion
        },
        nextSteps: refundDetails ? [
          'Cancellation confirmed',
          'Refund is being processed',
          'You will receive refund confirmation email',
          `Refund will be credited in ${refundDetails.estimatedCompletion}`
        ] : [
          'Cancellation confirmed',
          'No refund applicable'
        ]
      }
    });

    // Real-time notification for provider if booking was accepted
    try {
      if (previousStatus === 'accepted' && booking.provider) {
        sendNotification(
          booking.provider,
          'provider',
          'Booking Cancelled',
          `A booking for ${booking.services[0]?.serviceDetails?.title || 'Service'} has been cancelled by the customer.`,
          'booking',
          booking._id
        );
      }
    } catch (fcmError) {
      console.error('FCM Notification Error (Booking Cancelled):', fcmError);
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

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
    // Fix: Add null check for req.body before destructuring
    const { date, time } = req.body || {};
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
      .select('services performanceScore')
      .lean();

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId,
      provider.performanceScore
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
      .populate('customer', 'name email phone createdAt')
      .populate('services.service', 'title description duration price')
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
    let { status } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Handle status mapping - convert frontend camelCase to backend kebab-case
    const statusMapping = {
      'inProgress': 'in-progress'
    };

    // Apply status mapping if needed
    if (statusMapping[status]) {
      status = statusMapping[status];
    }

    const validStatuses = ['pending', 'accepted', 'completed', 'cancelled', 'in-progress'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status parameter'
      });
    }

    const provider = await Provider.findById(providerId)
      .select('services performanceScore');

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId,
      provider.performanceScore
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
      .populate('services.service', 'title price duration category')
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
    const { time } = req.body || {};
    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Check if provider exists and get their services
    const provider = await Provider.findById(providerId).select('services name');
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Find the booking that matches
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

    // Update booking status to accepted
    booking.status = 'accepted';
    booking.provider = providerId;
    if (time) booking.time = time;
    booking.updatedAt = new Date();

    await booking.save();

    // Populate booking details for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate('customer', 'name email phone')
      .populate('services.service', 'title description price');


    // Real-time notification for customer
    try {
      if (populatedBooking.customer) {
        await sendNotification(
          populatedBooking.customer._id,
          'customer',
          'Booking Accepted',
          `Your booking for ${populatedBooking.services[0].service.title} has been accepted by ${provider.name}.`,
          'booking',
          booking._id
        );
      }
    } catch (fcmError) {
      console.error('FCM Notification Error (Booking Accepted):', fcmError);
    }

    return res.status(200).json({
      success: true,
      message: 'Booking accepted successfully',
      data: {
        ...populatedBooking.toObject(),
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod
      }
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
 * @desc    Start a booking (change status from accepted to in-progress)
 * @route   PATCH /api/booking/provider/:id/start
 * @access  Private/Provider
 */
const startBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.provider._id;

    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Find the booking
    const booking = await Booking.findOne({
      _id: id,
      provider: providerId,
      status: 'accepted'
    }).populate('customer', 'name email phone')
      .populate('services.service', 'title description');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not available to start'
      });
    }

    // Update booking status to in-progress
    booking.status = 'in-progress';
    booking.startedAt = new Date();
    booking.updatedAt = new Date();

    await booking.save();

    // Real-time notification for customer
    try {
      if (booking.customer) {
        await sendNotification(
          booking.customer._id,
          'customer',
          'Service Started',
          `The provider has started working on your booking for ${booking.services[0].service.title}.`,
          'booking',
          booking._id
        );
      }
    } catch (fcmError) {
      console.error('FCM Notification Error (Service Started):', fcmError);
    }

    return res.status(200).json({
      success: true,
      message: 'Service started successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        startedAt: booking.startedAt
      }
    });
  } catch (error) {
    console.error('Error starting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while starting service',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Reject a booking
 * @route   PATCH /api/booking/provider/:id/reject
 * @access  Private/Provider
 */
const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const providerId = req.provider._id;
    // Fix: Add null check for req.body before destructuring
    const { reason } = req.body || {};

    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Find the booking
    const booking = await Booking.findOne({
      _id: id,
      status: 'pending',
      paymentStatus: { $ne: 'paid' },
      $or: [
        { provider: { $exists: false } },
        { provider: providerId }
      ]
    }).populate('customer', 'name email phone')
      .populate('services.service', 'title description');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not available for rejection'
      });
    }

    // Update booking status to cancelled
    booking.status = 'cancelled';
    booking.rejectedBy = providerId;
    booking.rejectionReason = reason || 'Provider declined';
    booking.rejectedAt = new Date();
    booking.updatedAt = new Date();

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking rejected successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        rejectionReason: booking.rejectionReason,
        rejectedAt: booking.rejectedAt
      }
    });

  } catch (error) {
    console.error('Error rejecting booking:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while rejecting booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



/**
 * @desc    Complete a booking
 * @route   PATCH /api/booking/provider/:id/complete
 * @access  Private/Provider
 */
const completeBooking = async (req, res) => {
  const { id } = req.params;
  const providerId = req.provider._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const provider = await Provider.findById(providerId)
      .select('name email performanceTier wallet completedBookings performanceScore')
      .session(session);

    if (!provider) throw new Error('Provider not found');

    // Map provider performanceScore stats to a tier for commission rule selection
    const stats = provider.performanceScore || { rating: 0, onTimePercentage: 0, completionPercentage: 0 };
    const avgScore = (stats.rating * 20 + (stats.onTimePercentage || 0) + (stats.completionPercentage || 0)) / 3;
    
    let performanceTier = 'standard';
    if (avgScore >= 80) performanceTier = 'premium';
    else if (avgScore < 40) performanceTier = 'basic';

    // Get commission rule for provider
    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId,
      performanceTier
    );

    if (!commissionRule) {
      throw new Error('No active commission rule found for this provider. Cannot complete booking.');
    }

    const booking = await Booking.findOne({
      _id: id,
      provider: providerId,
      status: { $in: ['accepted', 'in-progress'] }
    }).populate('customer', '_id name').session(session);

    if (!booking) {
      const currentBooking = await Booking.findById(id).select('status commissionProcessed').lean();

      if (currentBooking && currentBooking.status === 'completed') {
        await session.commitTransaction();
        session.endSession();
        return res.json({
          success: true,
          message: 'Booking already completed.'
        });
      }
      throw new Error('Booking not found or cannot be completed.');
    }

    // Prevent duplicate commission
    if (booking.commissionProcessed) {
      await session.commitTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: 'Commission already processed for this booking.'
      });
    }

    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.paymentStatus = 'paid';
    booking.commissionProcessed = true;

    await booking.save({ session });

    // ------------------------------
    // Cashback logic moved outside transaction to avoid Write Conflicts
    // ------------------------------

    const { commission, netAmount } = CommissionRule.calculateCommission(
      booking.totalAmount,
      commissionRule
    );

    // ------------------------------
    //  CASH PAYMENT: Create a cash transaction
    // ------------------------------
    if (booking.paymentMethod === 'cash') {
      const Transaction = require('../models/Transaction-model');

      const cashTransaction = new Transaction({
        booking: booking._id,
        user: booking.customer,
        amount: booking.totalAmount,
        paymentMethod: 'cash',
        paymentStatus: 'completed',
        transactionId: `CASH-${Date.now()}-${booking._id.toString().slice(-6)}`,
        currency: 'INR',
        completedAt: new Date(),
        description: `Cash payment for booking ${booking._id}`
      });

      await cashTransaction.save({ session });
    }

    // ------------------------------
    //  PREVENT DUPLICATE EARNING RECORD
    // ------------------------------
    const existingEarning = await ProviderEarning.findOne({
      booking: booking._id,
      provider: providerId
    }).session(session);

    if (existingEarning) {
      await session.commitTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: 'Earning already recorded!'
      });
    }

    // ------------------------------
    //  EARNING RELEASE DATE & STATUS
    // ------------------------------
    let earningStatus, availableAfter;

    if (booking.paymentMethod === "cash") {
      earningStatus = "paid"; // provider already received cash
      availableAfter = new Date();
    } else {
      earningStatus = "available";
      availableAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }

    const providerEarning = new ProviderEarning({
      provider: providerId,
      booking: booking._id,
      grossAmount: booking.totalAmount,
      commissionRate: commissionRule ? commissionRule.value : 0,
      commissionAmount: commission,
      netAmount: netAmount,
      status: earningStatus,
      availableAfter
    });

    await providerEarning.save({ session });

    // ------------------------------
    //  FIXED WALLET LOGIC
    // ------------------------------
    if (!provider.wallet) {
      provider.wallet = { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
    }

    if (booking.paymentMethod === "cash") {
      // Cash Booking Commission Logic
      // Check if trying to complete booking without enough balance
      if (provider.wallet.availableBalance < commission) {
        await session.commitTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Insufficient wallet balance to cover commission for this cash booking. Please recharge your wallet."
        });
      }
      // Immediately deduct commission
      provider.wallet.availableBalance -= commission;

    } else {
      // Online payment → provider gets only netAmount (do NOT add full amount)
      provider.wallet.availableBalance += netAmount;
    }

    provider.wallet.lastUpdated = new Date();
    provider.completedBookings = (provider.completedBookings || 0) + 1;

    // ------------------------------
    //  PERFORMANCE SCORE CALCULATION
    // ------------------------------
    const providerBookings = await Booking.find({
      provider: providerId,
      status: { $in: ['accepted', 'in-progress', 'completed', 'cancelled'] }
    }).session(session);

    let totalAccepted = 0;
    let totalCompleted = 0;
    let onTimeCompleted = 0;

    providerBookings.forEach(b => {
      totalAccepted++;

      if (b.status === 'completed') {
        totalCompleted++;

        if (b.completedAt && b.date && b.time) {
          const scheduledDate = new Date(b.date);
          const [hours, minutes] = b.time.split(':').map(Number);
          // Set exact time to scheduled date
          scheduledDate.setHours(hours, minutes, 0, 0);

          // 6-hour buffer
          const maxCompletionTime = new Date(scheduledDate.getTime() + 6 * 60 * 60 * 1000);

          if (b.completedAt <= maxCompletionTime) {
            onTimeCompleted++;
          }
        }
      }
    });

    const completionPercent = totalAccepted > 0 ? (totalCompleted / totalAccepted) * 100 : 0;
    const onTimePercent = totalCompleted > 0 ? (onTimeCompleted / totalCompleted) * 100 : 0;

    provider.performanceScore = {
      ...provider.performanceScore,
      rating: provider.performanceScore?.rating || 0,
      completionPercentage: parseFloat(completionPercent.toFixed(1)),
      onTimePercentage: parseFloat(onTimePercent.toFixed(1))
    };

    await provider.save({ session });


    await session.commitTransaction();
    session.endSession();

    // Real-time notifications for customer and admins
    try {
      if (booking.customer) {
        const customerId = booking.customer._id || booking.customer;
        await sendNotification(
          customerId,
          'customer',
          'Booking Completed',
          `Your booking has been completed successfully.`,
          'booking',
          booking._id
        );
      }
      await notifyAdmins(
        'Booking Completed',
        `Booking ${booking._id} has been completed by the provider.`,
        'booking',
        booking._id
      );
    } catch (fcmError) {
      console.error('FCM Notification Error (Booking Completed):', fcmError);
    }

    return res.json({
      success: true,
      message: "Booking completed successfully.",
      data: {
        bookingId: booking._id,
        status: "completed",
        totalAmount: booking.totalAmount,
        commission,
        netAmount
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Complete Booking Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to complete booking"
    });
  }
};






// Provider - Booking Report (Excel Download)
const providerBookingReport = async (req, res) => {
  try {
    const providerId = req.provider._id; // Authenticated provider
    const { startDate, endDate } = req.query;

    // Validate date inputs
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide both startDate and endDate",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validation: min 7 days, max 2 months (62 days)
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffDays < 7 || diffDays > 62) {
      return res.status(400).json({
        success: false,
        message: "Date range must be between 7 days and 2 months",
      });
    }

    // Get provider to ensure they exist and for commission calculations
    const provider = await Provider.findById(providerId).select('performanceScore');
    if (!provider) {
      return res.status(404).json({ success: false, message: "Provider not found." });
    }

    // Fetch bookings
    const bookings = await Booking.find({
      provider: providerId,
      date: { $gte: start, $lte: end },
    })
      .populate("customer", "name email phone createdAt")
      .populate("services.service", "title")
      .sort({ date: -1 })
      .lean();

    if (!bookings.length) {
      return res.json({
        success: true,
        message: "No bookings found for the selected date range",
      });
    }

    // Get and commission rule for calculations
    const commissionRule = await CommissionRule.getCommissionForProvider(
      providerId,
      provider.performanceScore
    );

    // Add commission calculations to bookings
    const bookingsWithCommission = bookings.map(booking => {
      const { commission, netAmount } = CommissionRule.calculateCommission(
        booking.totalAmount,
        commissionRule
      );
      return {
        ...booking,
        commissionAmount: commission,
        providerEarnings: netAmount
      };
    });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Booking Report");

    // Define columns
    worksheet.columns = [
      { header: "Booking ID", key: "bookingId", width: 25 },
      { header: "Customer Name", key: "customerName", width: 25 },
      { header: "Services Booked", key: "services", width: 40 },
      { header: "Date & Time", key: "dateTime", width: 25 },
      { header: "Status", key: "status", width: 20 },
      { header: "Payment Method", key: "paymentMethod", width: 20 },
      { header: "Payment Status", key: "paymentStatus", width: 20 },
      { header: "Total Amount", key: "totalAmount", width: 20 },
      { header: "Commission Amount", key: "commissionAmount", width: 20 },
      { header: "Provider Earnings", key: "providerEarnings", width: 20 },
      { header: "Service Completed At", key: "completedAt", width: 25 },
    ];

    // Add rows
    bookingsWithCommission.forEach((booking) => {
      // Format services
      const serviceDetails = booking.services
        .map(
          (s) =>
            `${s.service?.title || "Unknown"} (Qty: ${s.quantity}, Price: ₹${s.price})`
        )
        .join("; ");

      worksheet.addRow({
        bookingId: booking.bookingId || booking._id.toString(),
        customerName: booking.customer?.name || "N/A",
        services: serviceDetails,
        dateTime: `${booking.date.toISOString().split("T")[0]} ${booking.time}`,
        status: booking.status,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        totalAmount: booking.totalAmount,
        commissionAmount: booking.commissionAmount,
        providerEarnings: booking.providerEarnings,
        completedAt: booking.completedAt
          ? booking.completedAt.toISOString().split("T")[0]
          : "N/A",
      });
    });

    // File name
    const fileName = `Booking_Report_${startDate}_to_${endDate}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to download booking report",
      error: error.message,
    });
  }
};



// ADMIN CONTROLLERS

// Get all bookings
const getAllBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let sort = {};
    if (req.query.sortBy) {
      const sortFields = req.query.sortBy.split(',');
      sortFields.forEach(field => {
        const [key, order] = field.split(':');
        sort[key] = order === 'desc' ? -1 : 1;
      });
    } else {
      sort = { date: -1 }; // Sort by date descending as requested
    }

    const pipeline = [];
    const match = {};

    if (req.query.status) {
      match.status = { $in: req.query.status.split(',') };
    }

    if (req.query.paymentStatus) {
      match.paymentStatus = { $in: req.query.paymentStatus.split(',') };
    }

    if (req.query.startDate || req.query.endDate) {
      match.date = {};
      if (req.query.startDate) {
        match.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        match.date.$lte = new Date(req.query.endDate);
      }
    }

    if (Object.keys(match).length > 0) {
      pipeline.push({ $match: match });
    }

    // Lookups for customer, provider, and services
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'customer',
          foreignField: '_id',
          as: 'customer'
        }
      },
      {
        $unwind: {
          path: '$customer',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'providers',
          localField: 'provider',
          foreignField: '_id',
          as: 'provider'
        }
      },
      {
        $unwind: {
          path: '$provider',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: 'services.service',
          foreignField: '_id',
          as: 'serviceDetails'
        }
      }
    );

    if (req.query.search) {
      const search = req.query.search;
      const searchRegex = { $regex: search, $options: 'i' };

      const searchMatch = {
        $or: [
          { 'customer.name': searchRegex },
          { 'customer.email': searchRegex },
          { 'provider.name': searchRegex },
          { 'provider.email': searchRegex },
          { 'serviceDetails.title': searchRegex },
          { status: searchRegex },
          { bookingId: searchRegex },
          { 'address.street': searchRegex },
          { 'address.city': searchRegex },
          { 'address.postalCode': searchRegex },
          { 'address.state': searchRegex },
        ]
      };

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchMatch.$or.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      pipeline.push({ $match: searchMatch });
    }

    pipeline.push({
      $addFields: {
        'services': {
          $map: {
            input: '$services',
            as: 'serviceItem',
            in: {
              $mergeObjects: [
                '$serviceItem',
                {
                  service: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: '$serviceDetails',
                          as: 'sd',
                          cond: { $eq: ['$sd._id', '$serviceItem.service'] }
                        }
                      },
                      0
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    });

    pipeline.push({
      $project: {
        serviceDetails: 0
      }
    });

    const countPipeline = [...pipeline, { $count: 'total' }];

    pipeline.push({ $sort: sort });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const [bookings, totalResult] = await Promise.all([
      Booking.aggregate(pipeline),
      Booking.aggregate(countPipeline)
    ]);

    const total = totalResult.length > 0 ? totalResult[0].total : 0;
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
      .populate({
        path: 'provider',
        select: 'providerId name email phone experience serviceArea rating services profilePicUrl bankDetails',
        populate: {
          path: 'services',
          select: 'name'
        }
      })
      .populate({
        path: 'services.service',
        select: 'title category description basePrice duration image',
        populate: {
          path: 'category',
          select: 'name'
        }
      })
      .populate('feedback')
      .populate('complaint')
      .populate('commissionRule', 'name rate type')
      .lean();

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
        images: item.service?.images
      },
      quantity: item.quantity,
      price: item.price,
      discountAmount: item.discountAmount
    }));

    // Get payment details from transactions
    let paymentDetails = null;
    const Transaction = require('../models/Transaction-model');
    const transactions = await Transaction.find({
      booking: booking._id
    }).sort({ createdAt: -1 });

    if (transactions.length > 0 && booking.paymentMethod === 'online') {
      const transaction = transactions[0];
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
        bookingId: booking.bookingId,
        date: booking.date,
        time: booking.time,
        status: booking.status,
        address: booking.address,
        specialInstructions: booking.specialInstructions,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        bookingDateTime: booking.bookingDateTime,
        isUpcoming: booking.isUpcoming,
        confirmedBooking: booking.confirmedBooking,
        statusHistory: booking.statusHistory,
        serviceStartedAt: booking.serviceStartedAt,
        serviceCompletedAt: booking.serviceCompletedAt,
        completedAt: booking.completedAt
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
    const { providerId } = req.body || {};

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.provider) {
      return res.status(400).json({
        success: false,
        message: 'Booking has already been assigned to a provider'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending bookings can be assigned'
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider || !provider.approved || provider.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider'
      });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { provider: providerId, status: 'scheduled' },
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

    if (['completed', 'in-progress'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${booking.status} booking`
      });
    }

    // Get customer details for email notification
    const customer = await User.findById(booking.customer);

    await Booking.findByIdAndDelete(id);

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

    if (['completed', 'cancelled', 'in-progress'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ${booking.status} booking`
      });
    }

    const service = await Service.findById(booking.service);

    await Booking.findByIdAndDelete(bookingId);

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
    // Fix: Add null check for req.body before destructuring
    const { date, time } = req.body || {};

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

    if (['completed', 'in-progress'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule a ${booking.status} booking.`
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

// Admin - Download Bookings as CSV
const downloadBookingReport = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    startDate = new Date(startDate);
    endDate = new Date(endDate);

    // Validate date range (min 7 days, max 2 months)
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 7) {
      return res.status(400).json({ message: "Minimum date range should be 7 days" });
    }

    if (diffDays > 60) {
      return res.status(400).json({ message: "Maximum date range should be 2 months" });
    }

    // Fetch bookings with necessary details
    const bookings = await Booking.find({
      date: { $gte: startDate, $lte: endDate }
    })
      .populate('customer', 'name email phone')
      .populate('provider', 'name area')
      .populate('services.service', 'name category')
      .lean();

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Booking Report');

    // Columns
    worksheet.columns = [
      { header: 'Booking ID', key: '_id', width: 25 },
      { header: 'Booking Date', key: 'date', width: 15 },
      { header: 'Booking Time', key: 'time', width: 10 },
      { header: 'Booking Status', key: 'status', width: 15 },
      { header: 'Confirmed', key: 'confirmedBooking', width: 10 },

      { header: 'Customer Name', key: 'customerName', width: 20 },
      { header: 'Customer Email', key: 'customerEmail', width: 25 },
      { header: 'Customer Phone', key: 'customerPhone', width: 15 },
      { header: 'Customer Address', key: 'customerAddress', width: 30 },

      { header: 'Provider Name', key: 'providerName', width: 20 },
      { header: 'Provider ID', key: 'providerId', width: 15 },
      { header: 'Provider Area', key: 'providerArea', width: 15 },

      { header: 'Service Details', key: 'serviceDetails', width: 40 },

      { header: 'Payment Method', key: 'paymentMethod', width: 10 },
      { header: 'Payment Status', key: 'paymentStatus', width: 10 },
      { header: 'Subtotal', key: 'subtotal', width: 10 },
      { header: 'Total Discount', key: 'totalDiscount', width: 10 },
      { header: 'Total Amount', key: 'totalAmount', width: 10 },
      { header: 'Commission Amount', key: 'commissionAmount', width: 12 },
      { header: 'Provider Earnings', key: 'providerEarnings', width: 12 },

      { header: 'Coupon Code', key: 'couponCode', width: 15 },
      { header: 'Notes / Admin Remark', key: 'notes', width: 30 },
      { header: 'Service Start', key: 'serviceStartedAt', width: 15 },
      { header: 'Service Completed', key: 'serviceCompletedAt', width: 15 }
    ];

    // Add rows
    bookings.forEach(b => {
      const serviceDetails = b.services.map(s => {
        return `${s.service.title} (${s.service.category}) x${s.quantity} = ${s.price - s.discountAmount}`;
      }).join('; ');

      worksheet.addRow({
        _id: b.bookingId || b._id.toString(),
        date: b.date.toISOString().split('T')[0],
        time: b.time,
        status: b.status,
        confirmedBooking: b.confirmedBooking ? 'Yes' : 'No',
        customerName: b.customer?.name || '',
        customerEmail: b.customer?.email || '',
        customerPhone: b.customer?.phone || '',
        customerAddress: `${b.address.street}, ${b.address.city}, ${b.address.state}, ${b.address.postalCode}`,
        providerName: b.provider?.name || '',
        providerId: b.provider?.providerId || '',
        providerArea: b.provider?.area || '',
        serviceDetails,
        paymentMethod: b.paymentMethod,
        paymentStatus: b.paymentStatus,
        subtotal: b.subtotal,
        totalDiscount: b.totalDiscount,
        totalAmount: b.totalAmount,
        commissionAmount: b.commissionAmount,
        providerEarnings: b.providerEarnings,
        couponCode: b.couponApplied?.code || '',
        notes: `${b.notes || ''} ${b.adminRemark || ''}`,
        serviceStartedAt: b.serviceStartedAt ? new Date(b.serviceStartedAt).toLocaleString() : '',
        serviceCompletedAt: b.serviceCompletedAt ? new Date(b.serviceCompletedAt).toLocaleString() : ''
      });
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Booking_Report_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.xlsx`
    );

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.status(200).end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  createBooking,
  confirmBooking,
  updateBookingStatus,
  getUserBookings,
  getCustomerBookings,
  updateBookingPayment,
  getProviderById,
  getServiceById,
  payBooking,
  getBooking,
  cancelBooking,
  userUpdateBookingDateTime,
  getProviderBookingById,
  getBookingsByStatus,
  acceptBooking,
  startBooking,
  rejectBooking,
  completeBooking,
  providerBookingReport,
  getAllBookings,
  getBookingDetails,
  assignProvider,
  deleteBooking,
  deleteUserBooking,
  updateBookingDateTime,
  downloadBookingReport
};
