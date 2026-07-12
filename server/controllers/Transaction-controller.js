const Transaction = require('../models/Transaction-model');
const Booking = require('../models/Booking-model');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Service = require('../models/Service-model');
const CommissionRule = require('../models/CommissionRule-model');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const razorpay = require('../services/razorpay');

const rollbackWalletDeduction = async (transaction, session) => {
  if (transaction.paymentMethod === 'mixed' && transaction.paymentStatus === 'pending' && !transaction.description?.includes('Rolled Back')) {
    const match = transaction.description && transaction.description.match(/Wallet \(₹([\d.]+)\)/);
    if (match) {
      const walletDeduction = parseFloat(match[1]);
      if (walletDeduction > 0) {
        const user = await User.findById(transaction.user).session(session);
        if (user) {
          if (!user.wallet) {
            user.wallet = { availableBalance: 0, walletTransactions: [], totalRefunded: 0, lastUpdated: new Date() };
          }
          user.wallet.availableBalance += walletDeduction;
          user.wallet.walletTransactions.push({
            type: 'credit',
            amount: walletDeduction,
            reason: 'Booking Payment Rollback (Failed Payment)',
            booking: transaction.booking
          });
          user.wallet.lastUpdated = new Date();
          await user.save({ session });

          transaction.description = transaction.description.replace('Pending:', 'Failed (Rolled Back):').replace('Mixed Payment Pending:', 'Mixed Payment Failed (Rolled Back):') + ' (Wallet Deduction Rolled Back)';
          transaction.paymentStatus = 'failed';
          await transaction.save({ session });
        }
      }
    }
  }
};

const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId, amount, paymentMethod } = req.body;
    const userId = req.user._id;

    const { SystemConfig } = require('../models/SystemSetting');
    let settings = await SystemConfig.findOne().session(session);
    if (!settings) {
      settings = await SystemConfig.findOne();
      if (!settings) {
        settings = new SystemConfig({ companyName: 'Raj Electrical Services' });
        await settings.save();
      }
    }
    const systemCurrency = settings?.defaultCurrency || 'INR';

    // Validate input with more detailed checks
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Valid booking ID is required'
      });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Valid positive amount is required'
      });
    }

    // Check if booking exists and belongs to user
    const booking = await Booking.findOne({
      _id: bookingId,
      customer: userId
    }).session(session);

    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found or unauthorized'
      });
    }

    // CHECK: booking.paymentStatus !== 'paid'
    if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold' || booking.paymentStatus === 'success' || booking.paymentStatus === 'completed') {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Booking is already paid'
      });
    }

    // IMPORTANT: Only allow online/mixed payments to create transactions
    if (!paymentMethod || !['online', 'mixed'].includes(paymentMethod)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Transaction records can only be created for online or mixed payments.'
      });
    }

    // Rollback any existing pending transaction for this booking
    const existingPending = await Transaction.findOne({
      booking: bookingId,
      paymentStatus: 'pending'
    }).session(session);

    if (existingPending) {
      await rollbackWalletDeduction(existingPending, session);
      existingPending.paymentStatus = 'failed';
      existingPending.description = (existingPending.description || '') + ' (Cancelled by starting new checkout flow)';
      await existingPending.save({ session });
    }

    // SECURITY: Validate amount against booking total and wallet balance
    let expectedAmountPaise = Math.round(booking.totalAmount * 100);
    let walletDeduction = 0;

    if (paymentMethod === 'mixed') {
      const user = await User.findById(userId).session(session);
      const walletBalance = user.wallet?.availableBalance || 0;
      const usagePercentage = settings?.referralSettings?.walletUsagePercentage ?? 20;
      const maxAllowedDeduction = (booking.totalAmount * usagePercentage) / 100;
      walletDeduction = Math.min(walletBalance, booking.totalAmount, maxAllowedDeduction);
      expectedAmountPaise = Math.round((booking.totalAmount - walletDeduction) * 100);

      if (expectedAmountPaise <= 0) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Wallet balance covers full amount. Please use wallet payment instead.'
        });
      }

      // Deduct wallet balance immediately
      if (walletDeduction > 0) {
        if (!user.wallet) {
          user.wallet = { availableBalance: 0, walletTransactions: [], totalRefunded: 0, lastUpdated: new Date() };
        }
        user.wallet.availableBalance -= walletDeduction;
        user.wallet.walletTransactions.push({
          type: 'debit',
          amount: walletDeduction,
          reason: 'Booking Payment (Pending Mixed Verification)',
          booking: booking._id
        });
        user.wallet.lastUpdated = new Date();
        await user.save({ session });
      }
    }

    if (Math.round(amount) !== expectedAmountPaise) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Amount mismatch. Expected ${expectedAmountPaise} paise, but got ${amount} paise.`
      });
    }

    // Validate Razorpay credentials
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      await session.abortTransaction();
      return res.status(500).json({
        success: false,
        message: 'Payment gateway configuration error'
      });
    }

    // Create Razorpay order with better error handling
    const options = {
      amount: expectedAmountPaise,
      currency: systemCurrency,
      receipt: `booking_${bookingId}`,
      payment_capture: 1,
      notes: {
        bookingId: bookingId.toString(),
        userId: userId.toString(),
        paymentMethod: paymentMethod
      }
    };

    let order;
    try {
      order = await razorpay.orders.create(options);
    } catch (razorpayError) {
      global.logger.error('Razorpay order creation failed: ' + razorpayError.message, razorpayError);
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: razorpayError.error?.description || 'Payment gateway error',
        error: razorpayError
      });
    }

    // Calculate commission and provider earnings if missing
    let commission = booking.commissionAmount || 0;
    let providerEarning = booking.providerEarnings || 0;
    let commissionRuleId = booking.commissionRule || null;

    if (commission === 0 && providerEarning === 0) {
      try {
        const rule = await CommissionRule.getCommissionForProvider(booking.provider || null, booking.zoneId);

        if (rule) {
          const { commission: calculatedComm, netAmount } = CommissionRule.calculateCommission(booking.totalAmount, rule);
          commission = calculatedComm || 0;
          providerEarning = netAmount || booking.totalAmount;
          commissionRuleId = rule._id;
        } else {
          const { SystemConfig } = require('../models/SystemSetting');
          let settings = await SystemConfig.findOne();
          if (!settings) {
            settings = new SystemConfig({ companyName: 'Raj Electrical Services' });
            await settings.save();
          }
          const defaultCommPercent = settings?.commissionSettings?.defaultCommission ?? 10;
          const calculatedComm = parseFloat(((booking.totalAmount * defaultCommPercent) / 100).toFixed(2));
          commission = calculatedComm || 0;
          providerEarning = parseFloat((booking.totalAmount - commission).toFixed(2));
        }
      } catch (err) {
        global.logger.error('Error calculating initial commission: ' + err.message, err);
        providerEarning = booking.totalAmount;
      }
    }

    // Store online payment values in Rupees
    const finalAmount = booking.totalAmount - walletDeduction;
    const finalCommission = commission;
    const finalProviderEarning = providerEarning;

    // Save the payment splits on the booking
    booking.walletUsed = walletDeduction;
    booking.onlinePaid = finalAmount;
    booking.cashToPay = 0;
    await booking.save({ session });

    // Create transaction record
    const transaction = new Transaction({
      amount: finalAmount,
      currency: systemCurrency,
      paymentMethod: paymentMethod || 'online',
      booking: bookingId,
      bookingId: booking.bookingId,
      user: userId,
      customerId: req.user.customerId || userId.toString(),
      provider: booking.provider,
      providerId: booking.providerId || (booking.provider ? booking.provider.toString() : null),
      commission: finalCommission,
      providerEarning: finalProviderEarning,
      commissionRule: commissionRuleId,
      razorpayOrderId: order.id,
      type: 'payment',
      paymentStatus: 'pending',
      description: paymentMethod === 'mixed'
        ? `Mixed Payment Pending: Razorpay + Wallet (₹${walletDeduction})`
        : `Online Payment Pending`
    });

    await transaction.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount,
        key: process.env.RAZORPAY_KEY_ID,
        transactionId: transaction._id,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency || systemCurrency
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    global.logger.error(`[TransactionController.createOrder] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  } finally {
    session.endSession();
  }
};

const verifyPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingId,
      transactionId
    } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId || !transactionId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'All payment verification fields are required'
      });
    }

    // Verify the payment signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      global.logger.warn(`[Payment Security Alert] Invalid signature for order: ${razorpay_order_id}, payment: ${razorpay_payment_id}. Generated: ${generatedSignature}, Received: ${razorpay_signature}`);
      // Update transaction status to failed and rollback wallet balance
      const transaction = await Transaction.findById(transactionId).session(session);
      if (transaction) {
        transaction.paymentStatus = 'failed';
        await rollbackWalletDeduction(transaction, session);
        await transaction.save({ session });
      }
      await session.commitTransaction();
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Update transaction record
    const transaction = await Transaction.findById(transactionId).session(session);
    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Check if razorpayPaymentId already exists globally (IDEMPOTENCY)
    const duplicatePayment = await Transaction.findOne({ razorpayPaymentId: razorpay_payment_id }).session(session);
    if (duplicatePayment && duplicatePayment._id.toString() !== transactionId) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Duplicate payment ID detected'
      });
    }

    if (transaction.paymentStatus === 'success' || transaction.paymentStatus === 'completed' || transaction.razorpayPaymentId === razorpay_payment_id) {
      await session.commitTransaction();
      return res.status(200).json({
        success: true,
        message: 'Payment already verified.',
        data: {
          transactionId: transaction._id,
          bookingId: bookingId,
          paymentStatus: transaction.paymentStatus,
          isDuplicate: true
        }
      });
    }

    // Fetch payment details from Razorpay to capture full response state
    let razorpayResponse = null;
    try {
      razorpayResponse = await razorpay.payments.fetch(razorpay_payment_id);
    } catch (fetchError) {
      global.logger.warn('Failed to fetch captured payment details from Razorpay API: ' + fetchError.message, fetchError);
    }

    // Update Transaction
    transaction.razorpayPaymentId = razorpay_payment_id;
    transaction.transactionId = razorpay_payment_id;
    transaction.razorpaySignature = razorpay_signature;
    transaction.razorpayOrderId = razorpay_order_id;
    if (razorpayResponse) {
      transaction.razorpayResponse = razorpayResponse;
      transaction.paymentMethod = razorpayResponse.method || transaction.paymentMethod;
    }
    transaction.paymentStatus = 'success';
    transaction.updatedAt = new Date();

    // Update booking payment status
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // SECURITY: Validate booking ownership
    if (booking.customer.toString() !== userId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Booking does not belong to you'
      });
    }

    // Handle Wallet Deduction for Mixed Payments - ALREADY deducted in createOrder!
    if (transaction.paymentMethod === 'mixed') {
      const match = transaction.description && transaction.description.match(/Wallet \(₹([\d.]+)\)/);
      const walletDeduction = match ? parseFloat(match[1]) : 0;
      transaction.description = `Mixed Payment: Razorpay + Wallet (₹${walletDeduction})`;
    }

    await transaction.save({ session });

    booking.paymentStatus = 'escrow_hold';
    booking.paymentMethod = ['online', 'cash', 'wallet', 'mixed'].includes(transaction.paymentMethod) ? transaction.paymentMethod : 'online';
    booking.confirmedBooking = true;
    if (booking.status !== 'accepted' && booking.status !== 'completed' && booking.status !== 'in-progress') {
      booking.status = 'pending';
    }
    booking.updatedAt = new Date();
    await booking.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully. Booking is pending provider acceptance.',
      data: {
        transactionId: transaction._id,
        bookingId: booking._id,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status
      }
    });

    // Trigger auto-assignment asynchronously
    try {
      const ProviderAssignmentService = require('../services/ProviderAssignmentService');
      ProviderAssignmentService.autoAssignProviderIfEnabled(booking._id);
    } catch (assignError) {
      global.logger.error('Error triggering auto-assignment after verification: ' + assignError.message, assignError);
    }

  } catch (error) {
    await session.abortTransaction();
    global.logger.error(`[TransactionController.verifyPayment] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Razorpay webhook handler
 * @route   POST /api/payments/webhook
 * @access  Public
 */
const handleWebhook = async (req, res, next) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const razorpaySignature = req.headers['x-razorpay-signature'];

  if (!webhookSecret) {
    global.logger.error('Webhook secret not configured');
    return res.status(500).send('Server error');
  }

  // Verify webhook signature using raw body buffer for security
  const shasum = crypto.createHmac('sha256', webhookSecret);
  const bodyData = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body)));
  shasum.update(bodyData);
  const generatedSignature = shasum.digest('hex');

  if (generatedSignature !== razorpaySignature) {
    global.logger.warn(`[Payment Security Alert] Webhook signature verification failed for signature ${razorpaySignature}. Generated: ${generatedSignature}`);
    return res.status(400).send('Invalid signature');
  }

  // Parse payload from rawBody buffer if available, fallback to req.body
  let payload;
  try {
    payload = req.rawBody ? JSON.parse(req.rawBody.toString()) : (Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString()) : req.body);
  } catch (parseErr) {
    global.logger.error('Failed to parse webhook payload: ' + parseErr.message, parseErr);
    return res.status(400).send('Invalid JSON payload');
  }
  const event = payload.event;
  const payment = payload.payload.payment?.entity;

  if (!payment) {
    return res.status(400).send('Invalid webhook payload');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let bookingToAssignId = null;

  try {
    // Handle different webhook events
    switch (event) {
      case 'payment.captured':
        await handleSuccessfulPayment(payment, session);
        // Find the transaction to get booking ID
        const txn = await Transaction.findOne({ razorpayOrderId: payment.order_id }).session(session);
        if (txn) {
          bookingToAssignId = txn.booking;
        }
        break;
      case 'payment.failed':
        await handleFailedPayment(payment, session);
        break;
      case 'refund.processed':
        await handleRefundProcessed(payload.payload.refund?.entity, session);
        break;
      default:
        console.log(`Unhandled event type: ${event}`);
    }

    await session.commitTransaction();
    res.json({ success: true });

    if (bookingToAssignId) {
      try {
        const ProviderAssignmentService = require('../services/ProviderAssignmentService');
        ProviderAssignmentService.autoAssignProviderIfEnabled(bookingToAssignId);
      } catch (assignError) {
        global.logger.error('Error triggering auto-assignment after webhook captured: ' + assignError.message, assignError);
      }
    }
  } catch (error) {
    await session.abortTransaction();
    global.logger.error(`[TransactionController.handleWebhook] Route: ${req.originalUrl || req.url} - Webhook processing error: ${error.message}`, error);
    next(error);
  } finally {
    session.endSession();
  }
};

// Helper function to handle successful payment from webhook
const handleSuccessfulPayment = async (payment, session) => {
  // 1. Find transaction by order ID
  const transaction = await Transaction.findOne({ razorpayOrderId: payment.order_id }).session(session);

  if (!transaction) {
    throw new Error('Transaction not found for successful payment');
  }

  if (transaction.paymentStatus === 'success' || transaction.paymentStatus === 'completed' || transaction.razorpayPaymentId === payment.id) {
    global.logger.info(`Payment already processed for order: ${payment.order_id}`);
    const { notifyAdmins } = require('../utils/notificationHelper');
    try {
      notifyAdmins(
        'Duplicate Payment Alert',
        `Duplicate payment success received for order ${payment.order_id}, payment ID: ${payment.id}. Already processed.`,
        'payment_alert',
        transaction._id
      );
    } catch (e) { }
    return;
  }

  transaction.paymentStatus = 'success';
  transaction.razorpayPaymentId = payment.id;
  transaction.transactionId = payment.id;
  transaction.razorpayResponse = payment;
  transaction.paymentMethod = payment.method || 'online';
  transaction.updatedAt = new Date();
  await transaction.save({ session });

  // 2. Find the booking
  const booking = await Booking.findById(transaction.booking).session(session);

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Handle Wallet Deduction for Mixed Payments (Webhook Path)
  if (transaction.paymentMethod === 'mixed') {
    const match = transaction.description && transaction.description.match(/Wallet \(₹([\d.]+)\)/);
    const walletDeduction = match ? parseFloat(match[1]) : 0;
    transaction.description = `Mixed Payment: Razorpay + Wallet (₹${walletDeduction})`;
    await transaction.save({ session });
  }

  booking.paymentStatus = 'escrow_hold';
  booking.paymentMethod = ['online', 'cash', 'wallet', 'mixed'].includes(transaction.paymentMethod) ? transaction.paymentMethod : 'online';
  booking.paidAmount = transaction.amount;
  booking.paymentDate = new Date();
  booking.confirmedBooking = true;
  if (booking.status !== 'accepted' && booking.status !== 'completed' && booking.status !== 'in-progress') {
    booking.status = 'pending';
  }
  await booking.save({ session });

  // 5. Post-service payment handling - invoice generation removed
  // Payment is now handled directly through transactions and provider earnings
};

// Helper function to handle failed payment from webhook
const handleFailedPayment = async (payment, session) => {
  await Transaction.findOneAndUpdate(
    { razorpayOrderId: payment.order_id },
    {
      paymentStatus: 'failed',
      razorpayPaymentId: payment.id,
      transactionId: payment.id,
      razorpayResponse: payment,
      updatedAt: new Date()
    },
    { session }
  );

  const transaction = await Transaction.findOne({
    razorpayOrderId: payment.order_id
  }).session(session);

  if (transaction) {
    await rollbackWalletDeduction(transaction, session);
    await Booking.findByIdAndUpdate(
      transaction.booking,
      { paymentStatus: 'failed' },
      { session }
    );
  }
};

// Helper function to handle refund from webhook
const handleRefundProcessed = async (refund, session) => {
  if (!refund || !refund.payment_id) return;

  // Use findOneAndUpdate atomically to prevent duplicate processing
  const transaction = await Transaction.findOneAndUpdate(
    {
      razorpayPaymentId: refund.payment_id,
      refundStatus: { $ne: 'completed' }
    },
    {
      $set: {
        paymentStatus: 'refunded',
        refundStatus: 'completed',
        refundedAt: new Date(),
        updatedAt: new Date(),
        razorpayResponse: refund // update response field
      }
    },
    { session, new: true }
  );

  if (transaction) {
    await Booking.findByIdAndUpdate(
      transaction.booking,
      {
        paymentStatus: 'refunded',
        'cancellationProgress.status': 'refund_completed',
        'cancellationProgress.refundCompletedAt': new Date()
      },
      { session }
    );
  }
};


/**
 * Get all transactions for admin
 */
const getAllTransactions = async (req, res, next) => {
  try {
    const { bookingId, status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate);
      }
    }

    if (req.query.zoneIds) {
      const mongoose = require('mongoose');
      const zoneIdsArray = req.query.zoneIds.split(',').map(id => {
        try {
          return new mongoose.Types.ObjectId(id);
        } catch (e) {
          return id;
        }
      });
      const Booking = require('../models/Booking-model');
      const bookingsInZones = await Booking.find({ zoneId: { $in: zoneIdsArray } }).select('_id');
      const bookingIds = bookingsInZones.map(b => b._id);
      filter.booking = { $in: bookingIds };
    }

    if (bookingId) {
      const mongoose = require('mongoose');
      const Booking = require('../models/Booking-model');

      // 1. Find any bookings that match the search term (human-readable ID or internal ID)
      const matchingBookings = await Booking.find({
        $or: [
          { bookingId: { $regex: bookingId, $options: 'i' } },
          ...(mongoose.Types.ObjectId.isValid(bookingId) ? [{ _id: bookingId }] : [])
        ]
      }).select('_id');

      const bookingObjectIds = matchingBookings.map(b => b._id);

      // 2. Build a comprehensive search filter for the transaction
      filter.$or = [
        { bookingId: { $regex: bookingId, $options: 'i' } },
        { transactionId: { $regex: bookingId, $options: 'i' } },
        { razorpayOrderId: { $regex: bookingId, $options: 'i' } },
        { razorpayPaymentId: { $regex: bookingId, $options: 'i' } },
        { booking: { $in: bookingObjectIds } }
      ];
    }
    if (status && status !== 'all') {
      filter.paymentStatus = status;
    }

    const transactions = await Transaction.find(filter)
      .populate('user', 'name email phone')
      .populate({
        path: 'booking',
        select: 'bookingId services totalAmount status subtotal totalDiscount couponApplied commissionAmount providerEarnings companySurgeShare providerSurgeShare visitingCharge rainCharge trafficCharge nightCharge demandSurge platformFee customCharges commissionRule',
        populate: [
          { path: 'services.service', select: 'title' },
          { path: 'commissionRule', select: 'name rate type' }
        ]
      })
      .populate('provider', 'name email phone providerId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Transaction.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: transactions
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getAllTransactions] Route: ${req.originalUrl || req.url} - Get transactions error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Get single transaction details
 */
const getTransactionById = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate({
        path: 'booking',
        select: 'bookingId services totalAmount status subtotal totalDiscount couponApplied commissionAmount providerEarnings companySurgeShare providerSurgeShare visitingCharge rainCharge trafficCharge nightCharge demandSurge platformFee customCharges commissionRule',
        populate: [
          { path: 'services.service', select: 'title' },
          { path: 'commissionRule', select: 'name rate type' }
        ]
      })
      .populate('provider', 'name email phone providerId')
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getTransactionById] Route: ${req.originalUrl || req.url} - Get transaction details error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Get customer wallet activity
 * Only shows wallet-relevant events:
 *   - Refund credits (from cancelled bookings)
 *   - Wallet payments used for bookings
 *   - Admin wallet adjustments
 * Does NOT show raw Razorpay / gateway payment transactions.
 */
const getCustomerTransactions = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const walletActivity = [];

    // ── 1. Refund Credits ──────────────────────────────────────────────────────
    // Bookings that were cancelled and a refund was credited to wallet
    const refundedBookings = await Booking.find({
      customer: userId,
      status: 'cancelled',
      paymentStatus: 'refunded',
    })
      .populate({ path: 'services.service', select: 'title' })
      .select('bookingId services totalAmount cancellationProgress createdAt updatedAt adminRefundDecision')
      .sort({ updatedAt: -1 })
      .lean();

    for (const booking of refundedBookings) {
      const refundAmount = booking.cancellationProgress?.refundAmount || booking.totalAmount || 0;
      const refundedAt = booking.cancellationProgress?.refundCompletedAt || booking.updatedAt;
      const serviceTitle = booking.services?.[0]?.service?.title || 'Booking';

      // Determine label based on whether there was an admin dispute resolution
      const isAdminApproved = booking.adminRefundDecision === 'approved' || booking.adminRefundDecision === 'partial';
      const label = isAdminApproved ? 'Dispute Resolved – Refund Credited' : 'Refund for Cancelled Booking';

      walletActivity.push({
        _id: `refund_${booking._id}`,
        type: 'refund_credit',
        label,
        description: `${serviceTitle}`,
        bookingRef: booking.bookingId,
        amount: refundAmount,
        direction: 'credit',
        date: refundedAt,
        status: 'completed',
      });
    }

    // ── 2. Wallet Payments Used for Bookings ───────────────────────────────────
    // Transactions where payment method was 'wallet'
    const walletTransactions = await Transaction.find({
      user: userId,
      paymentMethod: { $in: ['wallet'] },
      paymentStatus: { $in: ['success', 'completed', 'paid'] },
    })
      .populate({ path: 'booking', select: 'bookingId services', populate: { path: 'services.service', select: 'title' } })
      .select('bookingId amount paymentMethod paymentStatus createdAt booking')
      .sort({ createdAt: -1 })
      .lean();

    for (const txn of walletTransactions) {
      const serviceTitle = txn.booking?.services?.[0]?.service?.title || 'Booking';
      const amountInRupees = txn.isRupees || ['cash', 'wallet'].includes(txn.paymentMethod?.toLowerCase())
        ? txn.amount
        : txn.amount / 100;

      walletActivity.push({
        _id: `wallet_pay_${txn._id}`,
        type: 'wallet_debit',
        label: 'Wallet Used for Booking',
        description: `${serviceTitle}`,
        bookingRef: txn.booking?.bookingId || txn.bookingId,
        amount: amountInRupees,
        direction: 'debit',
        date: txn.createdAt,
        status: 'completed',
      });
    }

    // ── 3. Bookings Paid via Wallet (from Booking model paymentMethod) ─────────
    // Catch wallet bookings that don't have a Transaction record (direct wallet deduction path)
    const walletBookings = await Booking.find({
      customer: userId,
      paymentMethod: { $in: ['wallet', 'mixed'] },
      paymentStatus: 'paid',
    })
      .populate({ path: 'services.service', select: 'title' })
      .select('bookingId services totalAmount paymentMethod createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Track which bookings we already added via Transaction to avoid duplicates
    const addedWalletBookingRefs = new Set(walletTransactions.map(t => t.booking?._id?.toString()).filter(Boolean));

    for (const booking of walletBookings) {
      if (addedWalletBookingRefs.has(booking._id.toString())) continue;

      const serviceTitle = booking.services?.[0]?.service?.title || 'Booking';
      const label = booking.paymentMethod === 'mixed' ? 'Partial Wallet Payment for Booking' : 'Wallet Used for Booking';

      walletActivity.push({
        _id: `wallet_booking_${booking._id}`,
        type: 'wallet_debit',
        label,
        description: `${serviceTitle}`,
        bookingRef: booking.bookingId,
        amount: booking.totalAmount || 0,
        direction: 'debit',
        date: booking.createdAt,
        status: 'completed',
      });
    }

    // ── Sort all activity by date descending ────────────────────────────────────
    walletActivity.sort((a, b) => new Date(b.date) - new Date(a.date));

    // ── Wallet Summary Stats ────────────────────────────────────────────────────
    const totalRefundCredits = walletActivity
      .filter(e => e.type === 'refund_credit')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalWalletUsed = walletActivity
      .filter(e => e.direction === 'debit')
      .reduce((sum, e) => sum + e.amount, 0);

    res.status(200).json({
      success: true,
      data: walletActivity,
      summary: {
        totalRefundCredits,
        totalWalletUsed,
        totalEntries: walletActivity.length,
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getCustomerTransactions] Route: ${req.originalUrl || req.url} - Get customer wallet activity error: ${error.message}`, error);
    next(error);
  }
};

const adminRetryVerify = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id).session(session);
    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.paymentStatus === 'success' || transaction.paymentStatus === 'completed') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Transaction is already successful' });
    }

    if (!transaction.razorpayOrderId) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'No Razorpay Order ID associated with this transaction' });
    }

    // Fetch payments from Razorpay for this order
    let paymentsResponse;
    try {
      paymentsResponse = await razorpay.orders.fetchPayments(transaction.razorpayOrderId);
    } catch (razorpayError) {
      global.logger.error('Failed to fetch payments from Razorpay: ' + razorpayError.message, razorpayError);
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Razorpay API error: ${razorpayError.error?.description || razorpayError.message}`
      });
    }

    const payments = paymentsResponse.items || [];
    const successfulPayment = payments.find(p => p.status === 'captured');

    if (!successfulPayment) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'No successful (captured) payment found in Razorpay for this order ID.'
      });
    }

    // Find booking first to update and defensively restore missing fields on pre-existing transactions
    const booking = await Booking.findById(transaction.booking).session(session);

    if (booking) {
      if (!transaction.bookingId) {
        transaction.bookingId = booking.bookingId || booking._id.toString();
      }
      if (!transaction.user) {
        transaction.user = booking.customer;
      }
      if (!transaction.customerId) {
        transaction.customerId = booking.customer.toString();
      }
    }

    // Process successful payment
    transaction.paymentStatus = 'success';
    transaction.razorpayPaymentId = successfulPayment.id;
    transaction.transactionId = successfulPayment.id;
    transaction.razorpayResponse = successfulPayment;
    transaction.paymentMethod = successfulPayment.method || transaction.paymentMethod;
    transaction.updatedAt = new Date();
    await transaction.save({ session });

    if (booking) {
      booking.paymentStatus = 'paid';
      booking.paymentMethod = ['online', 'cash', 'wallet', 'mixed'].includes(transaction.paymentMethod) ? transaction.paymentMethod : 'online';
      booking.paidAmount = transaction.amount;
      booking.paymentDate = new Date();
      booking.confirmedBooking = true;
      if (booking.status !== 'accepted' && booking.status !== 'completed' && booking.status !== 'in-progress') {
        booking.status = 'pending';
      }
      await booking.save({ session });
    }

    await session.commitTransaction();
    res.status(200).json({
      success: true,
      message: 'Transaction successfully reconciled and verified from Razorpay status!',
      data: {
        paymentId: successfulPayment.id,
        amount: successfulPayment.amount / 100
      }
    });

  } catch (error) {
    await session.abortTransaction();
    global.logger.error(`[TransactionController.adminRetryVerify] Route: ${req.originalUrl || req.url} - Error in adminRetryVerify: ${error.message}`, error);
    next(error);
  } finally {
    session.endSession();
  }
};

const adminMarkPaid = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Strict accountability safeguard: Require detailed audit trail reason
    if (!reason || reason.trim().length < 5) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'A detailed reconciliation reason (minimum 5 characters) is required for audit trail.'
      });
    }

    const transaction = await Transaction.findById(id).session(session);
    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.paymentStatus === 'success' || transaction.paymentStatus === 'completed') {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Transaction is already marked paid' });
    }

    // Find and update booking
    const booking = await Booking.findById(transaction.booking).session(session);
    if (!booking) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Associated Booking not found' });
    }

    // Populate required schema fields if missing to pass Mongoose validation (Defensive legacy entry recovery)
    if (!transaction.bookingId) {
      transaction.bookingId = booking.bookingId || booking._id.toString();
    }
    if (!transaction.user) {
      transaction.user = booking.customer;
    }
    if (!transaction.customerId) {
      transaction.customerId = booking.customer.toString();
    }

    // Mark transaction successful
    transaction.paymentStatus = 'success';
    transaction.updatedAt = new Date();
    transaction.description = `${transaction.description || ''} (Manually marked paid by Admin. Audit Reason: ${reason.trim()})`;
    await transaction.save({ session });

    // Update booking
    booking.paymentStatus = 'paid';
    booking.confirmedBooking = true;
    if (booking.status !== 'accepted' && booking.status !== 'completed' && booking.status !== 'in-progress') {
      booking.status = 'pending';
    }
    await booking.save({ session });

    await session.commitTransaction();
    res.status(200).json({
      success: true,
      message: 'Transaction and Booking successfully marked as paid manually!'
    });

  } catch (error) {
    await session.abortTransaction();
    global.logger.error(`[TransactionController.adminMarkPaid] Route: ${req.originalUrl || req.url} - Error in adminMarkPaid: ${error.message}`, error);
    next(error);
  } finally {
    session.endSession();
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
  getAllTransactions,
  getTransactionById,
  getCustomerTransactions,
  adminRetryVerify,
  adminMarkPaid,
  rollbackWalletDeduction
};
