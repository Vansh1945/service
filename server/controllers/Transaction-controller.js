const Transaction = require('../models/Transaction-model ');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');

// @desc    Create Razorpay order
// @route   POST /api/payments/create-order
// @access  Private
const createRazorpayOrder = asyncHandler(async (req, res) => {
  const { amount, bookingId } = req.body;
  const userId = req.user._id;

  if (!amount || !bookingId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Amount and booking ID are required' 
    });
  }

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid booking ID' 
    });
  }

  try {
    // Verify the booking exists and belongs to the user
    const booking = await Booking.findOne({ 
      _id: bookingId, 
      user: userId 
    });

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found or does not belong to user' 
      });
    }

    // Check if booking is already paid
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ 
        success: false, 
        message: 'Booking is already paid' 
      });
    }

    // Create transaction record
    const transaction = new Transaction({
      amount,
      currency: 'INR',
      status: 'pending',
      paymentMethod: 'unknown',
      booking: bookingId,
      user: userId,
      description: `Payment for booking ${bookingId}`
    });

    await transaction.save();

    // Create Razorpay order
    const razorpayOrder = await Transaction.createRazorpayOrder(
      amount,
      'INR',
      `booking_${bookingId}`,
      {
        transactionId: transaction._id.toString(),
        bookingId: bookingId.toString(),
        userId: userId.toString()
      }
    );

    // Update transaction with Razorpay order ID
    transaction.razorpayOrderId = razorpayOrder.id;
    await transaction.save();

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt
      },
      transactionId: transaction._id,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create payment order'
    });
  }
});

// @desc    Verify payment
// @route   POST /api/payments/verify
// @access  Private
const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, paymentId, signature } = req.body;
  const userId = req.user._id;

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing payment verification data' 
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify the payment signature
    const isValidSignature = Transaction.verifySignature(orderId, paymentId, signature);
    
    if (!isValidSignature) {
      throw new Error('Invalid payment signature');
    }

    // Find the transaction
    const transaction = await Transaction.findOne({ 
      razorpayOrderId: orderId,
      user: userId
    }).session(session);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // Get payment details from Razorpay
    const paymentDetails = await Transaction.fetchPaymentDetails(paymentId);
    
    // Update transaction
    transaction.razorpayPaymentId = paymentId;
    transaction.razorpaySignature = signature;
    transaction.razorpayResponse = paymentDetails;
    transaction.paymentMethod = paymentDetails.method || 'unknown';
    
    // Check if payment was successful
    if (paymentDetails.status === 'captured') {
      transaction.status = 'completed';
      
      // Update booking payment status
      await Booking.findByIdAndUpdate(
        transaction.booking,
        { 
          $set: { 
            paymentStatus: 'paid',
            paidAmount: transaction.amount,
            paymentDate: new Date()
          } 
        },
        { session, new: true }
      );
    } else {
      transaction.status = 'failed';
    }

    await transaction.save({ session });
    await session.commitTransaction();

    res.json({
      success: transaction.status === 'completed',
      transaction: {
        id: transaction._id,
        amount: transaction.amount,
        status: transaction.status,
        paymentMethod: transaction.paymentMethod,
        createdAt: transaction.createdAt
      },
      bookingId: transaction.booking
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Payment verification failed:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  } finally {
    session.endSession();
  }
});

// @desc    Razorpay webhook handler
// @route   POST /api/payments/webhook
// @access  Public
const handleWebhook = asyncHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const razorpaySignature = req.headers['x-razorpay-signature'];

  if (!webhookSecret) {
    console.error('Webhook secret not configured');
    return res.status(500).json({ success: false, message: 'Server error' });
  }

  // Verify webhook signature
  const shasum = crypto.createHmac('sha256', webhookSecret);
  shasum.update(JSON.stringify(req.body));
  const generatedSignature = shasum.digest('hex');

  if (generatedSignature !== razorpaySignature) {
    console.warn('Webhook signature verification failed');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  const event = req.body.event;
  const payment = req.body.payload.payment?.entity;

  if (!payment) {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
  }

  try {
    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        await handleSuccessfulPayment(payment);
        break;
      case 'payment.failed':
        await handleFailedPayment(payment);
        break;
      default:
        console.log(`Unhandled event type: ${event}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to handle successful payment
const handleSuccessfulPayment = async (payment) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find transaction by order ID
    const transaction = await Transaction.findOneAndUpdate(
      { razorpayOrderId: payment.order_id },
      {
        status: 'completed',
        razorpayPaymentId: payment.id,
        razorpayResponse: payment,
        paymentMethod: payment.method || 'unknown',
        updatedAt: new Date()
      },
      { new: true, session }
    );

    if (!transaction) {
      throw new Error('Transaction not found for successful payment');
    }

    // Update booking
    await Booking.findByIdAndUpdate(
      transaction.booking,
      { 
        $set: { 
          paymentStatus: 'paid',
          paidAmount: transaction.amount,
          paymentDate: new Date()
        } 
      },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Helper function to handle failed payment
const handleFailedPayment = async (payment) => {
  await Transaction.findOneAndUpdate(
    { razorpayOrderId: payment.order_id },
    {
      status: 'failed',
      razorpayPaymentId: payment.id,
      razorpayResponse: payment,
      updatedAt: new Date()
    }
  );
};

module.exports = {
  createRazorpayOrder,
  verifyPayment,
  handleWebhook
};