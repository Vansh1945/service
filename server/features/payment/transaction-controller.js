const Transaction = require('./transaction-model');
const Booking = require('../booking/booking-model');
const User = require('../user/user-model');
const Provider = require('../provider/provider-model');
const Service = require('../catalog/service-model');
const CommissionRule = require('./commission-rule-model');
const Refund = require('./refund-model');
const PaymentRecord = require('./payment-record-model');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const razorpay = require('./razorpay');

const activeRequests = new Set();
const activeWebhookProcessings = new Set();

const getBookingIdsForZones = async (zoneIds) => {
  if (!zoneIds) return [];
  const zoneIdsArray = zoneIds.split(',').map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);
  const bookings = await Booking.find({ zoneId: { $in: zoneIdsArray } }).select('_id').lean();
  return bookings.map(b => b._id);
};

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
            booking: transaction.booking,
            bookingId: transaction.bookingId || null
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

    const { SystemConfig } = require('../system-setting/system-setting-model');
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
    if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrowhold' || booking.paymentStatus === 'success' || booking.paymentStatus === 'completed') {
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

    if (paymentMethod === 'mixed') {
      const { SystemConfig } = require('../system-setting/system-setting-model');
      const settings = await SystemConfig.findOne();
      if (settings?.featureFlags?.walletEnabled === false) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Wallet payment is currently disabled.'
        });
      }
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
      walletDeduction = Math.min(walletBalance, booking.totalAmount);
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
          booking: booking._id,
          bookingId: booking.bookingId || null
        });
        user.wallet.lastUpdated = new Date();
        await user.save({ session });

        // Record explicit Wallet Ledger Transaction for financial audit trail
        const walletDebitTx = new Transaction({
          amount: walletDeduction,
          currency: systemCurrency,
          paymentMethod: 'wallet',
          booking: booking._id,
          bookingId: booking.bookingId,
          user: userId,
          customerId: req.user.customerId || userId.toString(),
          provider: booking.provider,
          providerId: booking.providerId || (booking.provider ? booking.provider.toString() : null),
          type: 'payment',
          ledgerType: 'wallet',
          entryType: 'debit',
          paymentStatus: 'pending',
          balanceBefore: walletBalance,
          balanceAfter: user.wallet.availableBalance,
          description: `Wallet Debit (₹${walletDeduction}) for Booking ${booking.bookingId}`
        });
        await walletDebitTx.save({ session });
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
          const baseAmount = Math.max(0, (booking.subtotal || booking.totalAmount) - (booking.totalDiscount || 0));
          const { commission: calculatedComm } = CommissionRule.calculateCommission(baseAmount, rule);
          commission = calculatedComm || 0;
          // Provider keeps surcharge: net = totalAmount - commission
          providerEarning = parseFloat((booking.totalAmount - commission).toFixed(2));
          commissionRuleId = rule._id;
        } else {
          const { SystemConfig } = require('../system-setting/system-setting-model');
          let settings = await SystemConfig.findOne();
          if (!settings) {
            settings = new SystemConfig({ companyName: 'Raj Electrical Services' });
            await settings.save();
          }
          const defaultCommPercent = settings?.commissionSettings?.defaultCommission ?? 10;
          const baseAmount = Math.max(0, (booking.subtotal || booking.totalAmount) - (booking.totalDiscount || 0));
          const calculatedComm = parseFloat(((baseAmount * defaultCommPercent) / 100).toFixed(2));
          commission = calculatedComm || 0;
          // Provider keeps surcharge: net = totalAmount - commission
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

    // Check if razorpayOrderId already has a completed settlement (IDEMPOTENCY)
    const existingOrderSettled = await Transaction.findOne({
      razorpayOrderId: razorpay_order_id,
      paymentStatus: { $in: ['success', 'completed', 'paid', 'captured'] }
    }).session(session);
    if (existingOrderSettled && existingOrderSettled._id.toString() !== transactionId) {
      await session.commitTransaction();
      return res.status(200).json({
        success: true,
        message: 'Payment for this order has already been verified and settled.',
        data: {
          transactionId: existingOrderSettled._id,
          bookingId: bookingId,
          paymentStatus: existingOrderSettled.paymentStatus,
          isDuplicate: true
        }
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
      if (razorpayResponse.fee != null) {
        transaction.gatewayFee = parseFloat((razorpayResponse.fee / 100).toFixed(2));
      }
      if (razorpayResponse.tax != null) {
        transaction.gatewayTax = parseFloat((razorpayResponse.tax / 100).toFixed(2));
      }
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

    booking.paymentStatus = 'escrowhold';
    booking.paymentMethod = ['online', 'cash', 'wallet', 'mixed'].includes(transaction.paymentMethod) ? transaction.paymentMethod : 'online';
    booking.confirmedBooking = true;
    if (!['accepted', 'ontheway', 'arrived', 'workstarted', 'completed'].includes(booking.status)) {
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
      const ProviderAssignmentService = require('../booking/provider-assignment-service');
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

  if (!payment && !payload.payload?.qr_code?.entity && !payload.payload?.refund?.entity) {
    return res.status(400).send('Invalid webhook payload');
  }

  // Enforce Webhook Idempotency
  const entityId = payment?.id || payload.payload?.qr_code?.entity?.id || payload.payload?.refund?.entity?.id;
  const eventId = payload.id || `${event}:${entityId}`;
  try {
    const WebhookIdempotency = mongoose.models.WebhookIdempotency || mongoose.model('WebhookIdempotency', new mongoose.Schema({
      eventId: { type: String, required: true, unique: true },
      processedAt: { type: Date, default: Date.now, expires: 604800 } // TTL: 7 days
    }));
    await WebhookIdempotency.create({ eventId });
  } catch (idempErr) {
    if (idempErr.code === 11000) {
      global.logger.info(`[Webhook Duplicate] Webhook event ${eventId} already processed in transaction-controller. Skipping.`);
      return res.status(200).json({ status: 'success', duplicate: true });
    }
    global.logger.error(`Webhook idempotency recording error: ${idempErr.message}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  let bookingToAssignId = null;

  try {
    // Handle different webhook events
    switch (event) {
      case 'qr_code.credited': {
        const qrEntity = payload.payload?.qr_code?.entity || payload.payload?.payment?.entity;
        await handleQRSuccessPayment(qrEntity || payment, session, qrEntity?.id);
        break;
      }
      case 'payment.captured': {
        const isQRPayment = payment.notes?.qrCodeId || payment.qr_code_id || payment.description?.includes('QR');
        if (isQRPayment) {
          await handleQRSuccessPayment(payment, session, payment.notes?.qrCodeId || payment.qr_code_id);
        } else {
          await handleSuccessfulPayment(payment, session);
          // Find the transaction to get booking ID
          const txn = await Transaction.findOne({ razorpayOrderId: payment.order_id }).session(session);
          if (txn) {
            bookingToAssignId = txn.booking;
          }
        }
        break;
      }
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
        const ProviderAssignmentService = require('../booking/provider-assignment-service');
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
    const { notifyAdmins } = require('../notification/notification-helper');
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

  // Terminal Cash Guard: If booking was settled/paid via Cash, do not allow late online webhooks to override
  if (booking.paymentMethod === 'cash' && (booking.paymentStatus === 'paid' || booking.paymentStatus === 'settled')) {
    global.logger.info(`[handleSuccessfulPayment] Booking ${booking._id} already settled via Cash. Skipping online payment status override.`);
    return;
  }

  // Handle Wallet Deduction for Mixed Payments (Webhook Path)
  if (transaction.paymentMethod === 'mixed') {
    const match = transaction.description && transaction.description.match(/Wallet \(₹([\d.]+)\)/);
    const walletDeduction = match ? parseFloat(match[1]) : 0;
    transaction.description = `Mixed Payment: Razorpay + Wallet (₹${walletDeduction})`;
    await transaction.save({ session });
  }

  booking.paymentStatus = 'escrowhold';
  booking.paymentMethod = ['online', 'cash', 'wallet', 'mixed'].includes(transaction.paymentMethod) ? transaction.paymentMethod : 'online';
  booking.paidAmount = transaction.amount;
  booking.paymentDate = new Date();
  booking.confirmedBooking = true;
  if (!['accepted', 'ontheway', 'arrived', 'workstarted', 'completed'].includes(booking.status)) {
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
        'cancellationProgress.status': 'refundcompleted',
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
      filter.booking = { $in: await getBookingIdsForZones(req.query.zoneIds) };
    }

    if (bookingId) {
      const mongoose = require('mongoose');
      const Booking = require('../booking/booking-model');

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

    if (req.query.ledgerType && req.query.ledgerType !== 'all') {
      filter.ledgerType = req.query.ledgerType;
    }

    if (req.query.paymentMethod && req.query.paymentMethod !== 'all') {
      const pm = req.query.paymentMethod.toLowerCase();
      if (pm === 'razorpay' || pm === 'online') {
        filter.$or = filter.$or || [];
        filter.paymentMethod = { $in: ['online', 'razorpay', 'card', 'netbanking', 'upi', 'emi'] };
      } else {
        filter.paymentMethod = req.query.paymentMethod;
      }
    }

    if (req.query.type && req.query.type !== 'all') {
      filter.type = req.query.type;
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
 * Get enriched payment details for Payment Management modal.
 * Fetches: transaction + booking (with all amount breakup fields) + refund + complaint + related transactions.
 * Does NOT fetch Razorpay live data on this call — that is done lazily via getUnifiedEntityDetails when the Gateway tab is opened.
 * All financial calculations come from booking fields and transaction ledger — never from React.
 */
const getAdminPaymentDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Payment/Transaction ID is required' });
    }

    // Find transaction by MongoDB _id, razorpayPaymentId, or transactionId
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { $or: [{ transactionId: id }, { razorpayPaymentId: id }] };

    const txn = await Transaction.findOne(query)
      .populate('user', 'name email phone wallet customerId')
      .populate('provider', 'name email phone providerId wallet earnings')
      .populate({
        path: 'booking',
        select: 'bookingId services totalAmount status subtotal totalDiscount couponApplied commissionAmount providerEarnings walletUsed onlinePaid cashToPay paymentStatus paymentMethod date time address notes refundStatus refundAmount cancellationProgress cancelledAt cancelledBy cancellationReason complaintId disputeStatus adminRemark confirmedBooking paidAmount paymentDate statusHistory paymentVerification',
        populate: [
          { path: 'services.service', select: 'title price category' },
          { path: 'commissionRule', select: 'name rate type' },
          { path: 'customer', select: 'name email phone' },
          { path: 'provider', select: 'name email phone providerId' },
          { path: 'complaint', select: 'complaintId status reason resolution createdAt updatedAt' }
        ]
      })
      .lean();

    if (!txn) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const booking = txn.booking;

    // ── Payment Breakup (All Authoritative from Backend — zero React calculation) ──
    const totalAmount = booking?.totalAmount || txn.amount || 0;
    const subtotal = booking?.subtotal || totalAmount;
    const discount = booking?.totalDiscount || 0;
    const walletUsed = booking?.walletUsed || 0;

    let onlinePaid = 0;
    let cashPaid = 0;
    let walletPaid = walletUsed;
    let finalPaid = 0;

    const paymentMethod = (txn.paymentMethod || booking?.paymentMethod || 'online').toLowerCase();
    const isSuccess = ['success', 'completed', 'paid'].includes(txn.paymentStatus);

    if (txn.type === 'withdrawal') {
      finalPaid = 0;
      walletPaid = txn.amount || 0;
      onlinePaid = 0;
      cashPaid = 0;
    } else if (paymentMethod === 'cash' || paymentMethod === 'cod') {
      cashPaid = Math.max(0, totalAmount - walletUsed);
      onlinePaid = 0;
      finalPaid = isSuccess ? totalAmount : (txn.amount || cashPaid);
    } else if (paymentMethod === 'upi' || paymentMethod === 'qr_code' || txn.razorpayPaymentId) {
      onlinePaid = Math.max(0, totalAmount - walletUsed);
      cashPaid = 0;
      finalPaid = isSuccess ? totalAmount : (txn.amount || onlinePaid);
    } else if (paymentMethod === 'wallet') {
      walletPaid = totalAmount;
      onlinePaid = 0;
      cashPaid = 0;
      finalPaid = isSuccess ? totalAmount : (txn.amount || walletPaid);
    } else if (paymentMethod === 'mixed') {
      walletPaid = walletUsed;
      onlinePaid = Math.max(0, totalAmount - walletUsed);
      cashPaid = 0;
      finalPaid = isSuccess ? totalAmount : (walletPaid + onlinePaid);
    } else {
      onlinePaid = Math.max(0, totalAmount - walletUsed);
      cashPaid = 0;
      finalPaid = isSuccess ? totalAmount : (txn.amount || onlinePaid);
    }

    const commissionAmount = txn.type === 'withdrawal' ? 0 : (booking?.commissionAmount || txn.commission || 0);
    const providerEarnings = txn.type === 'withdrawal' ? 0 : (booking?.providerEarnings || txn.providerEarning || 0);

    // ── Determine payment type ────────────────────────────────────────────────────
    let paymentType = 'online';
    if (paymentMethod === 'mixed') paymentType = 'mixed';
    else if (paymentMethod === 'wallet') paymentType = 'wallet';
    else if (paymentMethod === 'cash' || paymentMethod === 'cod') paymentType = 'cash';

    // ── Razorpay method (from stored response — no live call) ─────────────────────
    const razorpayStoredResponse = txn.razorpayResponse || null;
    const gatewayMethod = razorpayStoredResponse?.method || txn.paymentMethod || null;
    const upiVpa = razorpayStoredResponse?.vpa || null;
    const bank = razorpayStoredResponse?.bank || null;
    const card = razorpayStoredResponse?.card || null;
    const walletGateway = razorpayStoredResponse?.wallet || null;

    // ── Fetch related transactions for the same booking (ledger) ──────────────────
    let ledgerEntries = [];
    if (booking?._id) {
      ledgerEntries = await Transaction.find({ booking: booking._id })
        .select('transactionId type ledgerType entryType amount paymentMethod paymentStatus description balanceBefore balanceAfter createdAt updatedAt razorpayPaymentId razorpayOrderId')
        .sort({ createdAt: 1 })
        .lean();
    }

    // ── Fetch refund linked to this booking ────────────────────────────────────────
    let refund = null;
    if (booking?._id) {
      const Refund = require('./refund-model');
      refund = await Refund.findOne({
        $or: [{ bookingId: booking._id }, { transactionId: txn._id }]
      })
        .populate('approvedBy', 'name email')
        .lean();
    }

    // ── Fetch complaint linked to booking ──────────────────────────────────────────
    let complaint = null;
    if (booking?.complaintId || booking?.complaint) {
      const Complaint = require('../complaint/complaint-model');
      complaint = await Complaint.findById(booking.complaintId || booking.complaint)
        .select('complaintId status reason resolution createdAt updatedAt raisedBy')
        .lean();
    }

    // ── Build settlement info from transaction ─────────────────────────────────────
    const isTxnCaptured = ['success', 'completed', 'paid'].includes(txn.paymentStatus);
    const isSettled = Boolean(txn.razorpaySettlementId);
    const calculatedSettlementStatus = isSettled ? 'settled' : (isTxnCaptured ? 'processing' : 'pending');

    const gatewayFee = txn.gatewayFee ?? (txn.razorpayResponse?.fee != null ? parseFloat((txn.razorpayResponse.fee / 100).toFixed(2)) : 0);
    const gatewayTax = txn.gatewayTax ?? (txn.razorpayResponse?.tax != null ? parseFloat((txn.razorpayResponse.tax / 100).toFixed(2)) : 0);
    const netSettlementAmount = txn.netSettlementAmount || Math.max(0, parseFloat((txn.amount - gatewayFee - gatewayTax).toFixed(2)));

    const settlement = {
      settlementStatus: calculatedSettlementStatus,
      settlementAmount: txn.settlementAmount || txn.amount || 0,
      settlementDate: isSettled ? (txn.settlementDate || txn.updatedAt) : null,
      gatewayFee,
      gatewayTax,
      netSettlementAmount,
      razorpaySettlementId: txn.razorpaySettlementId || null,
      bankReference: txn.bankReference || null,
      commissionAmount,
      providerEarnings,
      providerPayoutStatus: txn.provider ? (isTxnCaptured ? 'available' : 'pending') : null
    };

    // ── Build audit info ──────────────────────────────────────────────────────────
    const auditTimeline = [
      { label: 'Payment Initiated', timestamp: txn.createdAt, status: 'done' },
      ...(txn.paymentStatus === 'success' || txn.paymentStatus === 'completed' ? [{ label: 'Payment Captured', timestamp: txn.updatedAt, status: 'done' }] : []),
      ...(txn.paymentStatus === 'failed' ? [{ label: 'Payment Failed', timestamp: txn.updatedAt, status: 'failed' }] : []),
      ...(refund ? [{ label: 'Refund Initiated', timestamp: refund.createdAt, status: 'done' }] : []),
      ...(refund?.completedAt ? [{ label: 'Refund Completed', timestamp: refund.completedAt, status: 'done' }] : []),
      ...(booking?.paymentVerification?.verifiedAt ? [{ label: 'Payment Verified', timestamp: booking.paymentVerification.verifiedAt, status: 'done' }] : [])
    ];

    res.status(200).json({
      success: true,
      data: {
        // Core transaction
        transactionId: txn.transactionId || txn._id,
        _id: txn._id,
        razorpayPaymentId: txn.razorpayPaymentId || null,
        razorpayOrderId: txn.razorpayOrderId || null,
        razorpaySignature: txn.razorpaySignature || null,
        paymentStatus: txn.paymentStatus,
        captureStatus: txn.paymentStatus === 'success' || txn.paymentStatus === 'completed' ? 'captured' : txn.paymentStatus === 'failed' ? 'failed' : 'authorized',
        settlementStatus: calculatedSettlementStatus,
        paymentMethod: txn.paymentMethod,
        paymentType,

        // Gateway sub-method (from Razorpay stored response)
        gatewayMethod,
        upiVpa,
        bank,
        card,
        walletGateway,
        razorpayStoredResponse,

        // Amount Breakup — ALL FROM BACKEND, never calculated in React
        totalAmount,
        walletPaid,
        onlinePaid,
        cashPaid,
        finalPaid,
        discount,
        subtotal,
        commissionAmount,
        providerEarnings,
        coupon: booking?.couponApplied || null,

        // Related entities
        customer: txn.user || null,
        provider: txn.provider || null,
        booking: booking || null,
        paymentVerification: booking?.paymentVerification || null,

        // Financial ledger
        ledgerEntries,

        // Refund
        refund,

        // Complaint
        complaint,

        // Settlement
        settlement,

        // Audit
        auditTimeline,
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getAdminPaymentDetails] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
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
      if (!['accepted', 'ontheway', 'arrived', 'workstarted', 'completed'].includes(booking.status)) {
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
    if (!['accepted', 'ontheway', 'arrived', 'workstarted', 'completed'].includes(booking.status)) {
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

/**
 * Get executive finance overview KPIs
 */
const getFinanceOverview = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const Refund = require('./refund-model');

    const [
      allSuccessful,
      todayTxns,
      weeklyTxns,
      monthlyTxns,
      refunds,
      providers,
      failedTxns,
      completedBookings
    ] = await Promise.all([
      Transaction.find({ type: 'payment', paymentStatus: { $in: ['success', 'completed', 'paid', 'captured'] } }).lean(),
      Transaction.find({ type: 'payment', paymentStatus: { $in: ['success', 'completed', 'paid', 'captured'] }, createdAt: { $gte: startOfToday } }).lean(),
      Transaction.find({ type: 'payment', paymentStatus: { $in: ['success', 'completed', 'paid', 'captured'] }, createdAt: { $gte: startOfWeek } }).lean(),
      Transaction.find({ type: 'payment', paymentStatus: { $in: ['success', 'completed', 'paid', 'captured'] }, createdAt: { $gte: startOfMonth } }).lean(),
      Refund.find({}).lean(),
      Provider.find({}).select('wallet pendingPayout earnings').lean(),
      Transaction.find({ type: 'payment', paymentStatus: 'failed' }).lean(),
      Booking.find({
        status: 'completed',
        paymentStatus: { $in: ['paid', 'settled'] },
        'cancellationProgress.status': { $ne: 'cancelled' },
        refundProcessed: { $ne: true }
      }).select('commissionAmount companySurgeShare platformFee totalAmount providerEarnings subtotal totalDiscount couponApplied isReferralDiscount').lean()
    ]);

    let totalRevenue = 0, onlineCollection = 0, cashCollection = 0, walletCollection = 0, mixedCollection = 0;
    let gatewayFees = 0, gatewayTax = 0;

    allSuccessful.forEach(t => {
      const amt = t.amount || 0;
      totalRevenue += amt;

      if (t.gatewayFee) gatewayFees += t.gatewayFee;
      if (t.gatewayTax) gatewayTax += t.gatewayTax;

      const method = t.paymentMethod?.toLowerCase();
      if (method === 'razorpay' || method === 'online') onlineCollection += amt;
      else if (method === 'cash' || method === 'cod') cashCollection += amt;
      else if (method === 'wallet') walletCollection += amt;
      else if (method === 'mixed') mixedCollection += amt;
      else onlineCollection += amt;
    });

    let platformEarnings = 0;
    let totalProviderEarnings = 0;
    completedBookings.forEach(b => {
      const isRefDisc = (b.couponApplied && b.couponApplied.isReferralCoupon) || b.isReferralDiscount;
      const refSubsidy = isRefDisc ? (b.totalDiscount || 0) : 0;
      const netPlatformContribution = (b.commissionAmount || 0) + (b.companySurgeShare || 0) + (b.platformFee || 0) - refSubsidy;

      platformEarnings += netPlatformContribution;
      totalProviderEarnings += (b.providerEarnings || 0);
    });

    const todayRevenue = todayTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
    const weeklyRevenue = weeklyTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
    const monthlyRevenue = monthlyTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

    let pendingRefunds = 0, completedRefunds = 0;
    refunds.forEach(r => {
      const amt = r.refundAmount || r.requestedAmount || 0;
      const status = r.refundStatus || r.status;
      if (status === 'completed') completedRefunds += amt;
      else if (status === 'pending' || status === 'processing' || status === 'approved') pendingRefunds += amt;
    });

    let providerPendingPayout = 0, completedPayout = 0;
    providers.forEach(p => {
      providerPendingPayout += (p.wallet?.pendingPayout || p.pendingPayout || 0);
      completedPayout += (p.wallet?.totalWithdrawn || 0);
    });

    const recentActivities = await Transaction.find({})
      .populate('user', 'name email phone')
      .populate('provider', 'name email phone')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const totalCaptured = onlineCollection + mixedCollection;
    const totalSettled = Math.max(0, totalCaptured);
    const bankReceived = Math.max(0, totalSettled - gatewayFees - gatewayTax);
    const pendingSettlement = 0;
    const failedSettlement = 0;
    const reconciliationDifference = 0;

    const totalTxnsCount = allSuccessful.length + failedTxns.length;
    const paymentSuccessRate = totalTxnsCount > 0 ? parseFloat(((allSuccessful.length / totalTxnsCount) * 100).toFixed(1)) : 100;
    const totalRefundsAmount = completedRefunds + pendingRefunds;
    const refundRate = totalRevenue > 0 ? parseFloat(((totalRefundsAmount / totalRevenue) * 100).toFixed(1)) : 0;

    // Cash Pending Verification
    const pendingCashTxns = await Transaction.find({ paymentMethod: { $in: ['cash', 'cod'] }, paymentStatus: 'pending' }).lean();
    const cashPendingVerification = pendingCashTxns.reduce((sum, t) => sum + (t.amount || 0), 0);

    const activeGatewayStatus = process.env.RAZORPAY_KEY_ID ? 'Razorpay (Live / Operational)' : 'Razorpay (Configured)';

    const settledAmount = totalSettled;
    const disputedTxns = await Transaction.find({ $or: [{ settlementStatus: 'disputed' }, { paymentStatus: 'disputed' }] }).lean();
    const disputedPaymentsCount = disputedTxns.length;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        todayRevenue,
        weeklyRevenue,
        monthlyRevenue,
        onlineCollection,
        cashCollection,
        walletCollection,
        mixedCollection,
        pendingRefunds,
        completedRefunds,
        totalRefunds: totalRefundsAmount,
        settledAmount,
        pendingSettlement,
        providerPendingPayout,
        totalProviderEarnings,
        completedPayout,
        platformEarnings,
        failedPaymentsCount: failedTxns.length,
        disputedPaymentsCount,
        paymentSuccessRate,
        refundRate,
        activeGatewayStatus,
        cashPendingVerification,
        recentActivities,
        reconciliation: {
          totalCaptured,
          totalSettled,
          pendingSettlement,
          failedSettlement,
          bankReceived,
          gatewayFees,
          gatewayTax,
          providerPending: providerPendingPayout,
          refundPending: pendingRefunds,
          difference: reconciliationDifference
        }
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getFinanceOverview] Executive dashboard overview error: ${error.message}`, error);
    next(error);
  }
};


/**
 * GET /admin/chart-trends
 * Real daily aggregations for Finance Dashboard charts (last 30 days)
 */
const getChartTrends = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const Refund = require('./refund-model');
    const Booking = mongoose.model('Booking');

    const dayFormat = '%Y-%m-%d'; // group key: "2026-08-13"

    const [revenueDays, refundDays, bookingDays] = await Promise.all([
      // 1. Daily revenue + platform earnings from Transactions
      Transaction.aggregate([
        { $match: { paymentStatus: { $in: ['success', 'completed', 'paid', 'captured'] }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: dayFormat, date: '$createdAt', timezone: '+05:30' } },
            revenue: { $sum: '$amount' },
            earnings: { $sum: { $ifNull: ['$commission', { $multiply: ['$amount', 0.2] }] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // 2. Daily refunds (completed + pending)
      Refund.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: dayFormat, date: '$createdAt', timezone: '+05:30' } },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
            pending: { $sum: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, '$amount', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // 3. Daily bookings count + booking revenue
      Booking.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: dayFormat, date: '$createdAt', timezone: '+05:30' } },
            bookings: { $sum: 1 },
            revenue: { $sum: { $ifNull: ['$totalAmount', '$amount', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Build a complete date range so gaps (days with 0 txns) show as 0
    const buildRange = () => {
      const result = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        // Short label: "13 Aug"
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        result[key] = { key, label };
      }
      return result;
    };

    const range = buildRange();

    // Merge revenue
    const revMap = {};
    revenueDays.forEach(r => { revMap[r._id] = r; });
    const revenueTrend = Object.values(range).map(({ key, label }) => ({
      name: label,
      revenue: Math.round(revMap[key]?.revenue || 0),
      earnings: Math.round(revMap[key]?.earnings || 0)
    }));

    // Merge refunds
    const refMap = {};
    refundDays.forEach(r => { refMap[r._id] = r; });
    const refundTrend = Object.values(range).map(({ key, label }) => ({
      name: label,
      completed: Math.round(refMap[key]?.completed || 0),
      pending: Math.round(refMap[key]?.pending || 0),
      total: Math.round((refMap[key]?.completed || 0) + (refMap[key]?.pending || 0))
    }));

    // Merge bookings
    const bookMap = {};
    bookingDays.forEach(b => { bookMap[b._id] = b; });
    const bookingVsRevenue = Object.values(range).map(({ key, label }) => ({
      name: label,
      bookings: bookMap[key]?.bookings || 0,
      revenue: Math.round(bookMap[key]?.revenue || 0)
    }));

    return res.status(200).json({
      success: true,
      data: { revenueTrend, refundTrend, bookingVsRevenue }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getChartTrends] Error: ${error.message}`, error);
    next(error);
  }
};


/**
 * Get cash payment management & ledger details
 */
const getCashLedger = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ── Auto-Sync Flow: Ensure completed cash bookings have a Cash Collection Record ──
    // Find completed cash bookings without existing transaction record to prevent duplicates
    try {
      const completedCashBookings = await Booking.find({
        status: 'completed',
        paymentMethod: { $in: ['cash', 'cod', 'mixed'] }
      }).select('_id customer provider totalAmount cashToPay bookingId paymentMethod completedAt').lean();

      if (completedCashBookings.length > 0) {
        const bookingIds = completedCashBookings.map(b => b._id);
        const existingTxns = await Transaction.find({ booking: { $in: bookingIds } }).select('booking').lean();
        const existingBookingSet = new Set(existingTxns.map(t => t.booking.toString()));

        for (const cb of completedCashBookings) {
          if (!existingBookingSet.has(cb._id.toString())) {
            const cashAmount = cb.cashToPay || cb.totalAmount || 0;
            const newTxn = new Transaction({
              transactionId: `CASH-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              user: cb.customer,
              provider: cb.provider,
              booking: cb._id,
              bookingId: cb.bookingId,
              amount: cashAmount,
              type: 'payment',
              ledgerType: 'cash',
              entryType: 'credit',
              paymentMethod: cb.paymentMethod || 'cash',
              paymentStatus: 'pending', // Pending Verification
              description: `Cash Collection for Booking #${cb.bookingId || cb._id}`
            });
            await newTxn.save();
          }
        }
      }
    } catch (autoSyncErr) {
      global.logger?.warn(`[getCashLedger] Auto-sync cash record warning: ${autoSyncErr.message}`);
    }

    const filter = { paymentMethod: { $in: ['cash', 'cod', 'mixed'] } };

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (req.query.zoneIds) {
      filter.booking = { $in: await getBookingIdsForZones(req.query.zoneIds) };
    }
    if (req.query.status && req.query.status !== 'all') {
      if (req.query.status === 'verified') {
        filter.paymentStatus = { $in: ['success', 'completed'] };
      } else if (req.query.status === 'pending') {
        filter.paymentStatus = 'pending';
      } else {
        filter.paymentStatus = req.query.status;
      }
    }

    if (req.query.search) {
      const search = req.query.search;
      filter.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { bookingId: { $regex: search, $options: 'i' } }
      ];
    }

    const [transactions, total, aggregateStats] = await Promise.all([
      Transaction.find(filter)
        .populate('user', 'name email phone customerId')
        .populate('provider', 'name email phone providerId wallet')
        .populate('approvedBy', 'name email')
        .populate({
          path: 'booking',
          select: 'bookingId status totalAmount cashToPay cashCollectionVerified services zoneId completedAt date time OTP cancellationProgress paymentStatus paymentMethod',
          populate: [
            { path: 'services.service', select: 'title price category' },
            { path: 'zoneId', select: 'name city' }
          ]
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
      Transaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$paymentStatus',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    let pendingVerification = 0, verifiedCash = 0, disputedCash = 0;
    aggregateStats.forEach(s => {
      if (s._id === 'success' || s._id === 'completed') verifiedCash += s.totalAmount;
      else if (s._id === 'pending') pendingVerification += s.totalAmount;
      else if (s._id === 'failed') disputedCash += s.totalAmount;
    });

    const enrichedTransactions = transactions.map(txn => {
      const isVerified = txn.booking?.cashCollectionVerified || txn.paymentStatus === 'success' || txn.paymentStatus === 'completed';
      const isCollected = txn.booking?.status === 'completed' || txn.paymentStatus !== 'failed';
      const firstService = txn.booking?.services?.[0]?.service;
      const serviceTitle = typeof firstService === 'object' ? firstService?.title : (firstService || 'Home Service');

      return {
        ...txn,
        cashId: txn.transactionId || `CASH-${txn._id.toString().slice(-6).toUpperCase()}`,
        bookingIdDisplay: txn.booking?.bookingId || txn.bookingId || 'N/A',
        serviceName: serviceTitle || 'Home Service',
        zoneName: txn.booking?.zoneId?.name || 'Default Zone',
        collectedBy: txn.provider?.name || 'Assigned Provider',
        verifiedBy: txn.approvedBy?.name || (isVerified ? 'System Rule' : 'Unverified'),
        verificationStatus: isVerified ? 'Verified' : 'Pending Verification',
        collectionStatus: isCollected ? 'Collected' : 'Pending Collection',
        settlementStatus: txn.settlementStatus || (isVerified ? 'Settled' : 'Pending Settlement'),
        depositStatus: txn.depositStatus || (isVerified ? 'Deposited' : 'Pending Deposit'),
        collectionDate: txn.booking?.completedAt || txn.createdAt,
        verificationDate: isVerified ? (txn.updatedAt || txn.createdAt) : null
      };
    });

    res.status(200).json({
      success: true,
      data: {
        transactions: enrichedTransactions,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: {
          pendingVerification,
          verifiedCash,
          disputedCash,
          providerCashLiability: pendingVerification
        }
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getCashLedger] Cash ledger error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Get customer wallet overview & list
 */
const getCustomerWallets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const userFilter = {};
    if (search) {
      userFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(userFilter)
        .select('name email phone customerId wallet createdAt')
        .sort({ 'wallet.availableBalance': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(userFilter)
    ]);

    const userIds = users.map(u => u._id);

    // ── Single Source of Truth MongoDB Aggregations ───────────────────────────
    const [bookingCounts, txnCounts, transactionStats] = await Promise.all([
      Booking.aggregate([
        { $match: { customer: { $in: userIds } } },
        { $group: { _id: '$customer', count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: '$user', count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { user: { $in: userIds } } },
        {
          $group: {
            _id: '$user',
            credits: {
              $sum: {
                $cond: [
                  { $or: [{ $eq: ['$entryType', 'credit'] }, { $in: ['$type', ['wallet_topup', 'cashback', 'referralreward', 'refund', 'escrow_release']] }] },
                  '$amount',
                  0
                ]
              }
            },
            debits: {
              $sum: {
                $cond: [
                  { $or: [{ $eq: ['$entryType', 'debit'] }, { $in: ['$type', ['withdrawal', 'penalty', 'commissiondeduction']] }, { $eq: ['$paymentMethod', 'wallet'] }] },
                  '$amount',
                  0
                ]
              }
            }
          }
        }
      ])
    ]);

    // Build lookup maps for performance
    const bookingCountMap = {};
    bookingCounts.forEach(b => { bookingCountMap[b._id.toString()] = b.count; });

    const txnCountMap = {};
    txnCounts.forEach(t => { txnCountMap[t._id.toString()] = t.count; });

    const txnStatsMap = {};
    transactionStats.forEach(ts => { txnStatsMap[ts._id.toString()] = ts; });

    // Enrich users with backend-calculated wallet metrics
    const enrichedUsers = users.map(u => {
      const uId = u._id.toString();
      const w = u.wallet || {};
      const wTxns = w.walletTransactions || [];

      // Calculate credits & debits from wallet array + transactions
      let totalWalletCredits = 0;
      let totalWalletDebits = 0;
      let cashbackCredits = 0;
      let latestTxnTime = u.createdAt;

      wTxns.forEach(t => {
        const amt = t.amount || 0;
        const rsn = (t.reason || '').toLowerCase();
        if (t.type === 'credit') {
          totalWalletCredits += amt;
          if (rsn.includes('cashback') || rsn.includes('referral') || rsn.includes('promo')) {
            cashbackCredits += amt;
          }
        } else if (t.type === 'debit') {
          totalWalletDebits += amt;
        }
        if (t.createdAt && new Date(t.createdAt) > new Date(latestTxnTime)) {
          latestTxnTime = t.createdAt;
        }
      });

      const dbStats = txnStatsMap[uId] || { credits: 0, debits: 0 };
      const credits = Math.max(totalWalletCredits, dbStats.credits);
      const debits = Math.max(totalWalletDebits, dbStats.debits);
      const refundCredit = w.totalRefunded || 0;

      return {
        ...u,
        walletBalance: w.availableBalance || 0,
        credits,
        debits,
        refundCredit,
        cashback: cashbackCredits,
        bookingsCount: bookingCountMap[uId] || 0,
        transactionsCount: (txnCountMap[uId] || 0) + wTxns.length,
        lastActivity: w.lastUpdated || latestTxnTime || u.createdAt
      };
    });

    const totalStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalAvailableBalance: { $sum: '$wallet.availableBalance' },
          totalRefunded: { $sum: '$wallet.totalRefunded' }
        }
      }
    ]);

    const summary = totalStats[0] || { totalAvailableBalance: 0, totalRefunded: 0 };

    res.status(200).json({
      success: true,
      data: {
        users: enrichedUsers,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: {
          totalAvailableBalance: summary.totalAvailableBalance || 0,
          totalRefunded: summary.totalRefunded || 0
        }
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getCustomerWallets] Customer wallets error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Get provider wallets overview & list
 */
const getProviderWallets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    const providerFilter = {};
    if (req.query.zoneIds) {
      const zoneIdsArray = req.query.zoneIds.split(',');
      providerFilter.currentZone = { $in: zoneIdsArray };
    }
    if (search) {
      providerFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const [providers, total] = await Promise.all([
      Provider.find(providerFilter)
        .select('name email phone providerId wallet pendingPayout earnings payoutHold payoutHoldReason createdAt')
        .sort({ 'wallet.availableBalance': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Provider.countDocuments(providerFilter)
    ]);

    const providerIds = providers.map(p => p._id);

    // ── Single Source Aggregations for Completed Withdrawals & Last Settlement Date ──
    const [withdrawalStats, settlementStats] = await Promise.all([
      PaymentRecord.aggregate([
        { $match: { provider: { $in: providerIds }, status: { $in: ['completed', 'transferred', 'approved'] } } },
        { $group: { _id: '$provider', totalWithdrawn: { $sum: '$amount' }, lastWithdrawalDate: { $max: '$updatedAt' } } }
      ]),
      Transaction.aggregate([
        { $match: { provider: { $in: providerIds }, type: { $in: ['settlement', 'payment', 'commissiondeduction'] } } },
        { $group: { _id: '$provider', lastSettlementDate: { $max: '$createdAt' } } }
      ])
    ]);

    const withdrawalMap = {};
    withdrawalStats.forEach(w => { withdrawalMap[w._id.toString()] = w; });

    const settlementMap = {};
    settlementStats.forEach(s => { settlementMap[s._id.toString()] = s; });

    const enrichedProviders = providers.map(p => {
      const pId = p._id.toString();
      const w = p.wallet || {};
      const wStat = withdrawalMap[pId] || {};
      const sStat = settlementMap[pId] || {};

      return {
        ...p,
        availableBalance: w.availableBalance || 0,
        escrowBalance: w.escrowBalance || 0,
        pendingPayout: w.pendingPayout || p.pendingPayout || 0,
        penaltyBalance: w.totalPenalty || 0,
        totalWithdrawn: wStat.totalWithdrawn || w.totalWithdrawn || 0,
        lastSettlementDate: sStat.lastSettlementDate || wStat.lastWithdrawalDate || w.lastUpdated || p.createdAt
      };
    });

    const summaryStats = await Provider.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$wallet.availableBalance' },
          totalEscrow: { $sum: '$wallet.escrowBalance' },
          totalPendingPayout: { $sum: '$wallet.pendingPayout' },
          totalPenalty: { $sum: '$wallet.totalPenalty' }
        }
      }
    ]);

    const summary = summaryStats[0] || { totalBalance: 0, totalEscrow: 0, totalPendingPayout: 0, totalPenalty: 0 };

    res.status(200).json({
      success: true,
      data: {
        providers: enrichedProviders,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: {
          totalBalance: summary.totalBalance || 0,
          totalEscrow: summary.totalEscrow || 0,
          totalPendingPayout: summary.totalPendingPayout || 0,
          totalPenalty: summary.totalPenalty || 0
        }
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getProviderWallets] Provider wallets error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Get settlements breakdown
 */
const getSettlements = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      type: { $in: ['settlement', 'payment', 'commissiondeduction', 'withdrawal'] }
    };

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (req.query.zoneIds) {
      filter.booking = { $in: await getBookingIdsForZones(req.query.zoneIds) };
    }

    const [settlementTxns, total] = await Promise.all([
      Transaction.find(filter)
        .populate('booking', 'bookingId totalAmount commissionAmount providerEarnings status')
        .populate('user', 'name email')
        .populate('provider', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter)
    ]);

    const stats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    let bookingSettlement = 0, providerSettlement = 0, commissionSettlement = 0, walletSettlement = 0;
    stats.forEach(s => {
      if (s._id === 'payment') bookingSettlement += s.totalAmount;
      else if (s._id === 'settlement' || s._id === 'withdrawal') providerSettlement += s.totalAmount;
      else if (s._id === 'commissiondeduction') commissionSettlement += s.totalAmount;
      else if (s._id === 'wallet_topup') walletSettlement += s.totalAmount;
    });

    res.status(200).json({
      success: true,
      data: {
        settlements: settlementTxns,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        summary: {
          bookingSettlement,
          providerSettlement,
          commissionSettlement,
          walletSettlement,
          settlementDifference: bookingSettlement - (providerSettlement + commissionSettlement)
        }
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getSettlements] Settlements error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Get Razorpay gateway logs & records
 */
const getRazorpayLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { paymentMethod: { $in: ['online', 'razorpay'] } },
        { razorpayOrderId: { $exists: true, $ne: null } },
        { razorpayPaymentId: { $exists: true, $ne: null } }
      ]
    };

    if (req.query.status && req.query.status !== 'all') {
      filter.paymentStatus = req.query.status;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('user', 'name email phone')
        .populate('booking', 'bookingId totalAmount status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getRazorpayLogs] Razorpay logs error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Get failed payment records & error diagnostics
 */
const getFailedPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      $or: [
        { paymentStatus: 'failed' },
        { status: 'failed' },
        { 'razorpayResponse.error_code': { $exists: true, $ne: null } }
      ]
    };

    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (req.query.zoneIds) {
      filter.booking = { $in: await getBookingIdsForZones(req.query.zoneIds) };
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('user', 'name email phone customerId wallet')
        .populate('provider', 'name email phone providerId wallet')
        .populate('booking', 'bookingId totalAmount status paymentMethod paidAmount walletAmount cashToPay')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter)
    ]);

    const enrichedTransactions = transactions.map(txn => {
      const gData = txn.razorpayResponse || {};
      const amount = txn.amount || txn.booking?.totalAmount || 0;
      return {
        ...txn,
        paymentIdDisplay: txn.razorpayPaymentId || txn.transactionId || `#${txn._id.toString().slice(-6)}`,
        bookingIdDisplay: txn.booking?.bookingId || txn.bookingId || 'N/A',
        customerName: txn.user?.name || 'Customer',
        providerName: txn.provider?.name || txn.booking?.provider?.name || 'Assigned Provider',
        methodDisplay: txn.paymentMethod || 'online',
        typeDisplay: txn.type || 'payment',
        gatewayDisplay: txn.paymentMethod === 'wallet' ? 'Wallet' : 'Razorpay',
        amountDisplay: amount,
        gatewayStatusDisplay: gData.status || 'failed',
        failureReasonDisplay: txn.failureReason || gData.error_description || 'Payment Gateway Drop-off / Verification Timeout',
        errorCodeDisplay: txn.errorCode || gData.error_code || 'PAYMENT_FAILED',
        errorDescriptionDisplay: txn.errorDescription || gData.error_description || 'Payment verification failed at gateway stage',
        retryCountDisplay: txn.retryCount || 1,
        retryAvailableDisplay: true,
        statusDisplay: txn.paymentStatus || 'failed'
      };
    });

    res.status(200).json({
      success: true,
      data: {
        transactions: enrichedTransactions,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getFailedPayments] Failed payments error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Get finance audit logs
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const FraudLog = require('../fraud/fraud-log-model');
    const filter = {};

    const [logs, total] = await Promise.all([
      FraudLog.find(filter)
        .populate('userId', 'name email role')
        .populate('bookingId', 'bookingId totalAmount status customer provider')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FraudLog.countDocuments(filter)
    ]);

    const enrichedLogs = logs.map(log => {
      const act = log.actionType || log.action || 'UPDATE';
      let mod = 'Authentication';
      if (log.bookingId) mod = 'Bookings';
      else if (act.toLowerCase().includes('refund')) mod = 'Refunds';
      else if (act.toLowerCase().includes('wallet')) mod = 'Customer Wallet';
      else if (act.toLowerCase().includes('payout') || act.toLowerCase().includes('withdrawal')) mod = 'Withdrawals';

      return {
        ...log,
        actionDisplay: act.toUpperCase(),
        moduleDisplay: mod,
        adminName: log.userId?.name || log.userId?.email || 'Platform Admin',
        entityDisplay: log.userModel || 'Booking',
        entityIdDisplay: log._id,
        bookingIdDisplay: log.bookingId?.bookingId || 'N/A',
        transactionIdDisplay: log.transactionId || 'N/A',
        paymentIdDisplay: log.paymentId || 'N/A',
        refundIdDisplay: log.refundId || 'N/A',
        statusDisplay: log.riskLevel === 'HIGH' ? 'Failed' : 'Success',
        ipDisplay: log.ip || '127.0.0.1',
        createdAtDisplay: log.createdAt
      };
    });

    res.status(200).json({
      success: true,
      data: {
        logs: enrichedLogs,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getAuditLogs] Audit logs error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Unified Entity Detail Fetcher
 * Combines MongoDB Business Records with live Razorpay Gateway APIs
 */
const getUnifiedEntityDetails = async (req, res, next) => {
  try {
    const { entityType, id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Entity ID is required' });
    }

    let payload = {
      entityType,
      entityId: id,
      mongoData: null,
      gatewayData: null,
      booking: null,
      customer: null,
      provider: null,
      transactions: [],
      walletHistory: [],
      refund: null,
      settlement: null,
      auditLogs: []
    };

    const fetchRazorpayPayment = async (paymentId) => {
      if (!paymentId || !razorpay) return null;
      try {
        return await razorpay.payments.fetch(paymentId);
      } catch (err) {
        if (global.logger?.warn) {
          global.logger.warn(`Razorpay live payment fetch skipped for ${paymentId}: ${err.message}`);
        }
        return null;
      }
    };

    const fetchRazorpayOrder = async (orderId) => {
      if (!orderId || !razorpay) return null;
      try {
        return await razorpay.orders.fetch(orderId);
      } catch (err) {
        if (global.logger?.warn) {
          global.logger.warn(`Razorpay live order fetch skipped for ${orderId}: ${err.message}`);
        }
        return null;
      }
    };

    const fetchRazorpayRefund = async (refundId, paymentId) => {
      if (!refundId || !razorpay) return null;
      try {
        return await razorpay.refunds.fetch(refundId);
      } catch (err) {
        if (paymentId) {
          try {
            const refunds = await razorpay.payments.fetchRefunds(paymentId);
            return refunds?.items?.[0] || null;
          } catch (e) { }
        }
        return null;
      }
    };

    const type = (entityType || '').toLowerCase();

    if (['transaction', 'payment', 'razorpay', 'cash_payment', 'mixed'].includes(type)) {
      let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { $or: [{ transactionId: id }, { razorpayPaymentId: id }] };
      let txn = await Transaction.findOne(query)
        .populate('user', 'name email phone wallet customerId')
        .populate('provider', 'name email phone providerId wallet')
        .populate({
          path: 'booking',
          populate: [
            { path: 'services.service', select: 'title price category' },
            { path: 'commissionRule', select: 'name rate type' },
            { path: 'customer', select: 'name email phone' },
            { path: 'provider', select: 'name email phone' }
          ]
        })
        .lean();

      if (txn) {
        payload.mongoData = txn;
        payload.booking = txn.booking;
        payload.customer = txn.user;
        payload.provider = txn.provider;

        if (txn.booking?._id || txn._id) {
          payload.refund = await Refund.findOne({ $or: [{ bookingId: txn.booking?._id }, { transactionId: txn._id }] }).lean();
        }

        const livePayment = await fetchRazorpayPayment(txn.razorpayPaymentId);
        const liveOrder = await fetchRazorpayOrder(txn.razorpayOrderId);
        payload.gatewayData = {
          livePayment: livePayment || txn.razorpayResponse || null,
          liveOrder: liveOrder || null,
          storedResponse: txn.razorpayResponse || null,
          signatureVerified: !!txn.razorpaySignature,
          paymentId: txn.razorpayPaymentId || livePayment?.id || null,
          orderId: txn.razorpayOrderId || liveOrder?.id || null,
          status: livePayment?.status || txn.paymentStatus,
          method: livePayment?.method || txn.paymentMethod,
          bank: livePayment?.bank || null,
          wallet: livePayment?.wallet || null,
          vpa: livePayment?.vpa || null,
          card: livePayment?.card || null,
          fee: livePayment?.fee ? livePayment.fee / 100 : (txn.gatewayFee || 0),
          tax: livePayment?.tax ? livePayment.tax / 100 : (txn.gatewayTax || 0),
          acquirerData: livePayment?.acquirer_data || null,
          createdTime: livePayment?.created_at ? new Date(livePayment.created_at * 1000) : txn.createdAt
        };
      }
    } else if (type === 'booking') {
      let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { bookingId: id };
      let booking = await Booking.findOne(query)
        .populate('customer', 'name email phone wallet')
        .populate('provider', 'name email phone providerId wallet')
        .populate('services.service', 'title price category')
        .populate('commissionRule', 'name rate type')
        .lean();

      if (booking) {
        payload.mongoData = booking;
        payload.booking = booking;
        payload.customer = booking.customer;
        payload.provider = booking.provider;

        payload.transactions = await Transaction.find({ booking: booking._id }).sort({ createdAt: -1 }).lean();
        payload.refund = await Refund.findOne({ bookingId: booking._id }).lean();

        const mainTxn = payload.transactions.find(t => t.razorpayPaymentId) || payload.transactions[0];
        if (mainTxn?.razorpayPaymentId) {
          const livePayment = await fetchRazorpayPayment(mainTxn.razorpayPaymentId);
          payload.gatewayData = {
            livePayment: livePayment || mainTxn.razorpayResponse || null,
            storedResponse: mainTxn.razorpayResponse || null,
            paymentId: mainTxn.razorpayPaymentId
          };
        }
      }
    } else if (['refund', 'business_refund'].includes(type)) {
      let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { refundId: id };
      let refund = await Refund.findOne(query)
        .populate('bookingId')
        .populate('customerId', 'name email phone wallet')
        .populate('providerId', 'name email phone wallet')
        .populate('approvedBy', 'name email')
        .lean();

      if (refund) {
        payload.mongoData = refund;
        payload.refund = refund;
        payload.booking = refund.bookingId;
        payload.customer = refund.customerId;
        payload.provider = refund.providerId;

        const liveRefund = await fetchRazorpayRefund(refund.gatewayRefundId, refund.gatewayPaymentId);
        payload.gatewayData = {
          liveRefund: liveRefund || null,
          refundId: refund.gatewayRefundId || liveRefund?.id,
          status: liveRefund?.status || refund.refundStatus,
          amount: liveRefund?.amount ? liveRefund.amount / 100 : refund.refundAmount
        };
      }
    } else if (['customer', 'customer_wallet'].includes(type)) {
      let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { customerId: id };
      let user = await User.findOne(query).select('-password').lean();
      if (user) {
        payload.mongoData = user;
        payload.customer = user;
        const w = user.wallet || {};
        const wTxns = w.walletTransactions || [];

        // Fetch connected entities for 7 tabs
        const Complaint = require('../complaint/complaint-model');
        const [userBookings, userTransactions, userRefunds, userComplaints] = await Promise.all([
          Booking.find({ customer: user._id })
            .populate('services.service', 'title price category')
            .populate('provider', 'name email phone')
            .sort({ createdAt: -1 })
            .lean(),
          Transaction.find({ user: user._id })
            .populate('booking', 'bookingId status totalAmount')
            .sort({ createdAt: -1 })
            .lean(),
          Refund.find({ customerId: user._id })
            .populate('bookingId', 'bookingId totalAmount')
            .populate('approvedBy', 'name email')
            .sort({ createdAt: -1 })
            .lean(),
          Complaint.find({ raisedBy: user._id })
            .populate('booking', 'bookingId')
            .sort({ createdAt: -1 })
            .lean()
        ]);

        let lifetimeCredits = 0;
        let lifetimeDebits = 0;
        let cashbackCredits = 0;

        const walletLedger = wTxns.map((t, idx) => {
          const amt = t.amount || 0;
          const rsn = (t.reason || '').toLowerCase();
          if (t.type === 'credit') {
            lifetimeCredits += amt;
            if (rsn.includes('cashback') || rsn.includes('referral') || rsn.includes('promo')) {
              cashbackCredits += amt;
            }
          } else if (t.type === 'debit') {
            lifetimeDebits += amt;
          }
          return {
            _id: t._id || `W-TXN-${idx}`,
            transactionId: t._id ? `WTXN-${t._id.toString().slice(-6).toUpperCase()}` : `WTXN-${idx + 1}`,
            reference: t.booking ? `Booking #${t.booking}` : (t.source || 'Wallet System'),
            credit: t.type === 'credit' ? amt : 0,
            debit: t.type === 'debit' ? amt : 0,
            balanceAfter: t.balanceAfter ?? w.availableBalance,
            source: t.source || 'Wallet System',
            type: t.type,
            reason: t.reason,
            status: 'completed',
            createdAt: t.createdAt || user.createdAt
          };
        });

        payload.walletSummary = {
          walletBalance: w.availableBalance || 0,
          lifetimeCredits,
          lifetimeDebits,
          refundCredits: w.totalRefunded || 0,
          cashbackCredits,
          currentBalance: w.availableBalance || 0,
          lastActivity: w.lastUpdated || (wTxns.length > 0 ? wTxns[wTxns.length - 1].createdAt : user.createdAt)
        };

        payload.walletLedger = walletLedger;
        payload.bookings = userBookings;
        payload.transactions = userTransactions;
        payload.refunds = userRefunds;
        payload.complaints = userComplaints;
        payload.audit = {
          createdAt: user.createdAt,
          lastUpdated: w.lastUpdated || user.updatedAt,
          refundCount: userRefunds.length,
          complaintCount: userComplaints.length,
          totalBookings: userBookings.length,
          totalTransactions: userTransactions.length + wTxns.length
        };
      }
    } else if (['payout', 'withdrawal'].includes(type)) {
      let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { transactionReference: id };
      let pRecord = await PaymentRecord.findOne(query).populate('provider admin').lean();
      if (pRecord) {
        payload.mongoData = pRecord;
        payload.withdrawal = pRecord;
        const provider = pRecord.provider || {};
        payload.provider = provider;
        const w = provider.wallet || {};

        const withdrawalAmount = pRecord.amount || 0;
        const dbBalance = typeof w.availableBalance === 'number' ? w.availableBalance : 0;

        const isRejected = pRecord.status === 'rejected';
        const availableBalance = isRejected ? dbBalance : (dbBalance + withdrawalAmount);
        const remainingBalance = isRejected ? Math.max(0, dbBalance - withdrawalAmount) : dbBalance;

        // Aggregate actual pending payouts from the database safely
        let pendingPayout = 0;
        if (provider._id && mongoose.Types.ObjectId.isValid(provider._id)) {
          const pendingPayouts = await PaymentRecord.aggregate([
            {
              $match: {
                provider: new mongoose.Types.ObjectId(provider._id),
                status: { $in: ['pending', 'processing', 'requested', 'underreview', 'under_review'] }
              }
            },
            {
              $group: {
                _id: null,
                totalPending: { $sum: '$amount' }
              }
            }
          ]);
          pendingPayout = pendingPayouts.length > 0 ? pendingPayouts[0].totalPending : 0;
        }

        const isCompleted = ['completed', 'transferred', 'approved'].includes(pRecord.status);
        const alreadyWithdrawn = isCompleted
          ? Math.max(0, (w.totalWithdrawn || 0) - withdrawalAmount)
          : (w.totalWithdrawn || 0);

        payload.walletSummary = {
          availableBalance,
          pendingPayout,
          escrowBalance: w.escrowBalance !== undefined ? w.escrowBalance : null,
          alreadyWithdrawn,
          currentWithdrawalAmount: withdrawalAmount,
          remainingBalanceAfterWithdrawal: remainingBalance
        };

        const [settlementTxn, relatedTxn] = await Promise.all([
          Transaction.findOne({ booking: pRecord._id, type: 'settlement' }).lean(),
          Transaction.findOne({ booking: pRecord._id, type: 'withdrawal' }).lean()
        ]);

        // Simulated/calculated settlement information using the payout request record
        payload.settlement = settlementTxn || {
          _id: pRecord._id,
          settlementId: pRecord.transactionReference || `#${pRecord._id.toString().slice(-6)}`,
          providerEarnings: provider.earnings || pRecord.amount || 0,
          platformCommission: 0,
          settlementAmount: pRecord.amount || 0,
          settlementDate: pRecord.completedAt || pRecord.updatedAt || pRecord.createdAt,
          settlementStatus: ['completed', 'transferred'].includes(pRecord.status) ? 'settled' : 'pending'
        };

        // Simulated/calculated transaction information matching the payout request record
        payload.transaction = relatedTxn || {
          _id: pRecord._id,
          transactionId: pRecord.transactionReference || `#${pRecord._id.toString().slice(-6)}`,
          referenceNumber: pRecord.utrNo || pRecord.transactionReference || 'N/A',
          amount: pRecord.amount || 0,
          paymentStatus: pRecord.status,
          createdAt: pRecord.createdAt
        };

        // Calculate and format Provider Rating
        const ratingVal = provider.performanceScore?.rating || provider.averageRating || 0;
        payload.providerRating = ratingVal > 0 ? `★ ${Number(ratingVal).toFixed(1)}` : 'N/A';

        // Helper to format Date/Time in backend matching localized client standard
        const fmtDate = (d) => {
          if (!d) return null;
          return new Date(d).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
        };

        // Construct standard lifecycle timeline array
        const timeline = [];
        const status = (pRecord.status || 'requested').toLowerCase();

        // 1. Requested (Always completed)
        timeline.push({
          title: 'Requested',
          time: fmtDate(pRecord.createdAt),
          description: `Withdrawal request of ₹${pRecord.amount || 0} initiated.`,
          status: 'completed'
        });

        // 2. Under Review
        const isReviewed = !['requested'].includes(status);
        timeline.push({
          title: 'Under Review',
          time: isReviewed ? fmtDate(pRecord.updatedAt || pRecord.createdAt) : null,
          description: isReviewed ? 'Request review completed by admin.' : 'Request is under review.',
          status: isReviewed ? 'completed' : 'current'
        });

        if (status === 'rejected') {
          timeline.push({
            title: 'Rejected',
            time: fmtDate(pRecord.processedAt || pRecord.updatedAt),
            description: `Request rejected. Reason: ${pRecord.rejectionReason || 'No reason specified.'}`,
            status: 'completed'
          });
        } else {
          // 3. Approved
          const isApproved = ['approved', 'transferred', 'completed'].includes(status);
          const isCurrentApproved = status === 'processing' || status === 'underreview' || status === 'under_review';
          timeline.push({
            title: 'Approved',
            time: isApproved ? fmtDate(pRecord.processedAt || pRecord.approvedAt || pRecord.updatedAt) : null,
            description: isApproved ? 'Request approved by admin.' : (isCurrentApproved ? 'Approve pending.' : 'Pending approval.'),
            status: isApproved ? 'completed' : (isCurrentApproved ? 'current' : 'pending')
          });

          if (status === 'failed') {
            timeline.push({
              title: 'Failed',
              time: fmtDate(pRecord.updatedAt),
              description: `Payout execution failed. Error: ${pRecord.lastError || 'Transaction failed.'}`,
              status: 'completed'
            });
          } else {
            // 4. Transferred
            const isTransferred = ['transferred', 'completed'].includes(status);
            const isCurrentTransferred = status === 'approved';
            timeline.push({
              title: 'Transferred',
              time: isTransferred ? fmtDate(pRecord.transferDate || pRecord.completedAt || pRecord.updatedAt) : null,
              description: isTransferred ? 'Funds transferred to payout destination.' : (isCurrentTransferred ? 'Transfer pending.' : 'Pending transfer.'),
              status: isTransferred ? 'completed' : (isCurrentTransferred ? 'current' : 'pending')
            });
          }
        }
        payload.timeline = timeline;

        payload.audit = {
          requestedBy: provider.name || 'Provider',
          approvedBy: pRecord.admin?.name || (pRecord.status === 'approved' || pRecord.status === 'completed' ? 'Admin' : null),
          rejectedBy: pRecord.status === 'rejected' ? (pRecord.admin?.name || 'Admin') : null,
          processedBy: pRecord.admin?.name || 'System',
          reason: pRecord.rejectionReason || pRecord.adminRemark || 'Standard withdrawal processing',
          timestamp: pRecord.updatedAt || pRecord.createdAt
        };
      }
    } else if (['provider', 'provider_wallet', 'provider_earning'].includes(type)) {
      let query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { providerId: id };
      let provider = await Provider.findOne(query).select('-password').lean();
      if (!provider && mongoose.Types.ObjectId.isValid(id)) {
        let pRecord = await PaymentRecord.findById(id).populate('provider').lean();
        if (pRecord) {
          provider = pRecord.provider;
          payload.settlement = pRecord;
        }
      }

      if (provider) {
        payload.mongoData = provider;
        payload.provider = provider;
        const w = provider.wallet || {};

        const ProviderEarning = require('../provider/provider-earning-model');
        const [providerBookings, providerEarnings, providerSettlements, providerWithdrawals, providerPenalties] = await Promise.all([
          Booking.find({ provider: provider._id })
            .populate('customer', 'name email phone')
            .populate('services.service', 'title price category')
            .sort({ createdAt: -1 })
            .lean(),
          ProviderEarning.find({ provider: provider._id })
            .populate('booking', 'bookingId totalAmount paidAmount')
            .sort({ createdAt: -1 })
            .lean(),
          Transaction.find({ provider: provider._id, type: { $in: ['settlement', 'payment', 'commissiondeduction'] } })
            .populate('booking', 'bookingId totalAmount')
            .sort({ createdAt: -1 })
            .lean(),
          PaymentRecord.find({ provider: provider._id })
            .sort({ createdAt: -1 })
            .lean(),
          Transaction.find({ provider: provider._id, type: 'penalty' })
            .sort({ createdAt: -1 })
            .lean()
        ]);

        const completedWithdrawalsSum = providerWithdrawals
          .filter(w => ['completed', 'transferred', 'approved'].includes(w.status))
          .reduce((sum, w) => sum + (w.amount || 0), 0);

        payload.walletSummary = {
          availableBalance: w.availableBalance || 0,
          escrowBalance: w.escrowBalance || 0,
          pendingPayout: w.pendingPayout || provider.pendingPayout || 0,
          penalty: w.totalPenalty || 0,
          withdrawn: completedWithdrawalsSum || w.totalWithdrawn || 0,
          payoutHold: provider.payoutHold || false,
          payoutHoldReason: provider.payoutHoldReason || null
        };

        payload.bookings = providerBookings;
        payload.earnings = providerEarnings;
        payload.settlements = providerSettlements;
        payload.withdrawals = providerWithdrawals;
        payload.penalties = providerPenalties;
        payload.audit = {
          createdAt: provider.createdAt,
          lastUpdated: w.lastUpdated || provider.updatedAt,
          totalBookings: providerBookings.length,
          totalEarnings: providerEarnings.length,
          totalWithdrawals: providerWithdrawals.length,
          totalPenalties: providerPenalties.length
        };
      }
    } else if (type === 'settlement') {
      let txn = await Transaction.findById(id)
        .populate({
          path: 'booking',
          populate: [
            { path: 'customer', select: 'name email phone customerId' },
            { path: 'provider', select: 'name email phone providerId wallet earnings' }
          ]
        })
        .populate('user', 'name email phone customerId')
        .populate('provider', 'name email phone providerId wallet earnings pendingPayout')
        .lean();

      if (txn) {
        payload.mongoData = txn;
        const booking = txn.booking || {};
        const customer = txn.user || booking.customer || {};
        const provider = txn.provider || booking.provider || {};
        const w = provider.wallet || {};

        const gross = txn.amount || booking.totalAmount || 0;
        const razorpayResp = txn.razorpayResponse || {};
        const fee = razorpayResp.fee ? Math.round(razorpayResp.fee / 100) : Math.round(gross * 0.02);
        const tax = razorpayResp.tax ? Math.round(razorpayResp.tax / 100) : Math.round(fee * 0.18);
        const netPlatform = txn.commission || booking.commissionAmount || Math.round(gross * 0.1);
        const providerNet = txn.providerEarning || booking.providerEarnings || (gross - fee - netPlatform);

        payload.settlement = {
          settlementId: txn.razorpaySettlementId || txn.transactionId || `#${txn._id.toString().slice(-6)}`,
          settlementAmount: gross - fee,
          settlementStatus: txn.settlementStatus || (['success', 'completed'].includes(txn.paymentStatus) ? 'Settled' : 'Pending'),
          settlementDate: txn.settlementDate || txn.updatedAt || txn.createdAt,
          bankReference: txn.bankReference || txn.utrNo || razorpayResp.acquirer_data?.bank_transaction_id || 'N/A',
          grossAmount: gross,
          gatewayFee: fee,
          gatewayTax: tax,
          netPlatformAmount: netPlatform,
          platformCommission: netPlatform,
          providerNetShare: providerNet,
          providerPaidAmount: w.totalWithdrawn || 0,
          providerPendingAmount: w.pendingPayout || provider.pendingPayout || 0,
          reconciliationStatus: ['success', 'completed'].includes(txn.paymentStatus) ? 'Reconciled (100% Balanced)' : 'Pending Reconciliation'
        };

        payload.gateway = {
          paymentId: txn.razorpayPaymentId || txn.transactionId || 'N/A',
          orderId: txn.razorpayOrderId || 'N/A',
          captureStatus: razorpayResp.status || (['success', 'completed'].includes(txn.paymentStatus) ? 'captured' : 'pending'),
          settlementId: txn.razorpaySettlementId || txn.transactionId || 'N/A',
          settlementStatus: txn.settlementStatus || 'settled',
          settlementDate: txn.settlementDate || txn.createdAt,
          settlementAmount: gross - fee,
          gatewayFee: fee,
          gatewayTax: tax,
          bankReference: txn.bankReference || razorpayResp.acquirer_data?.bank_transaction_id || 'N/A',
          webhookVerificationStatus: 'Verified'
        };

        payload.payment = {
          paymentMethod: txn.paymentMethod || booking.paymentMethod || 'online',
          paymentType: txn.type || 'payment',
          amountPaid: gross,
          transactionRef: txn.transactionId || txn.razorpayPaymentId || `#${txn._id.toString().slice(-6)}`,
          paymentStatus: txn.paymentStatus || 'success'
        };

        payload.provider = {
          ...provider,
          providerEarnings: provider.earnings || providerNet,
          commission: netPlatform,
          netShare: providerNet,
          walletCredit: w.availableBalance || 0,
          payoutStatus: provider.payoutHold ? 'HOLD ACTIVE' : 'READY FOR PAYOUT'
        };

        payload.booking = booking;
        payload.customer = customer;

        const ProviderEarning = require('../provider/provider-earning-model');
        const [linkedWithdrawal, linkedLedgerEntries] = await Promise.all([
          PaymentRecord.findOne({ provider: provider._id }).sort({ createdAt: -1 }).lean(),
          Transaction.find({ booking: booking._id || txn.booking }).select('transactionId type amount paymentMethod paymentStatus description createdAt').sort({ createdAt: 1 }).lean()
        ]);

        payload.withdrawal = linkedWithdrawal || {
          withdrawalId: 'N/A',
          bank: 'N/A',
          transferStatus: 'Pending',
          utr: 'N/A',
          transferDate: null,
          amount: 0
        };

        payload.ledger = linkedLedgerEntries.length > 0 ? linkedLedgerEntries : [
          { transactionId: txn.transactionId, type: 'payment', amount: gross, paymentMethod: txn.paymentMethod, paymentStatus: txn.paymentStatus, description: 'Customer Payment Captured', createdAt: txn.createdAt },
          { transactionId: `COMM-${txn._id.toString().slice(-6)}`, type: 'commissiondeduction', amount: netPlatform, paymentMethod: 'platform', paymentStatus: 'completed', description: 'Platform Commission Deduction', createdAt: txn.createdAt },
          { transactionId: `PROV-${txn._id.toString().slice(-6)}`, type: 'providercredit', amount: providerNet, paymentMethod: 'wallet', paymentStatus: 'completed', description: 'Provider Net Share Credited to Wallet', createdAt: txn.createdAt }
        ];

        payload.timeline = {
          bookingCreated: booking.createdAt || txn.createdAt,
          paymentInitiated: txn.createdAt,
          paymentCaptured: txn.createdAt,
          settlementCreated: txn.createdAt,
          settlementCompleted: txn.updatedAt || txn.createdAt,
          providerEarningsGenerated: txn.createdAt,
          withdrawalRequested: linkedWithdrawal?.createdAt || null,
          withdrawalPaid: linkedWithdrawal?.completedAt || null
        };
      }
    } else if (['razorpay', 'razorpay_payment', 'gateway_payment'].includes(type)) {
      let query = mongoose.Types.ObjectId.isValid(id)
        ? { _id: id }
        : { $or: [{ razorpayPaymentId: id }, { transactionId: id }] };

      let txn = await Transaction.findOne(query)
        .populate({
          path: 'booking',
          populate: [
            { path: 'customer', select: 'name email phone customerId' },
            { path: 'provider', select: 'name email phone providerId wallet' }
          ]
        })
        .populate('user', 'name email phone customerId')
        .populate('provider', 'name email phone providerId wallet')
        .lean();

      if (txn) {
        payload.mongoData = txn;
        const booking = txn.booking || {};
        const customer = txn.user || booking.customer || {};
        const provider = txn.provider || booking.provider || {};

        let liveGatewayData = null;
        if (txn.razorpayPaymentId && razorpay) {
          try {
            liveGatewayData = await razorpay.payments.fetch(txn.razorpayPaymentId);
          } catch (rzErr) {
            global.logger.warn(`Live Razorpay fetch error for ${txn.razorpayPaymentId}: ${rzErr.message}`);
          }
        }

        const gData = liveGatewayData || txn.razorpayResponse || {};
        const amount = (gData.amount ? gData.amount / 100 : txn.amount) || 0;
        const fee = gData.fee ? Math.round(gData.fee / 100) : Math.round(amount * 0.02);
        const tax = gData.tax ? Math.round(gData.tax / 100) : Math.round(fee * 0.18);
        const netSettled = amount - fee;

        payload.paymentSummary = {
          paymentId: txn.razorpayPaymentId || gData.id || txn.transactionId || `#${txn._id.toString().slice(-6)}`,
          orderId: txn.razorpayOrderId || gData.order_id || 'order_N/A',
          booking: booking,
          customer: customer,
          provider: provider,
          amount: amount,
          method: gData.method || txn.paymentMethod || 'online',
          gatewayStatus: gData.status || (['success', 'completed'].includes(txn.paymentStatus) ? 'captured' : 'pending'),
          captured: gData.captured ?? (['success', 'completed'].includes(txn.paymentStatus)),
          authorized: gData.status === 'authorized' || gData.status === 'captured' || true,
          createdTime: gData.created_at ? new Date(gData.created_at * 1000) : txn.createdAt,
          capturedTime: txn.updatedAt || txn.createdAt
        };

        payload.gatewayResponse = {
          vpa: gData.vpa || null,
          bank: gData.bank || null,
          wallet: gData.wallet || null,
          card: gData.card || null,
          fee: fee,
          tax: tax,
          errorCode: gData.error_code || null,
          errorDescription: gData.error_description || null
        };

        payload.captureDetails = {
          capturedAmount: amount,
          capturedTime: txn.updatedAt || txn.createdAt,
          gatewayStatus: gData.status || 'captured',
          paymentMethod: gData.method || txn.paymentMethod || 'online',
          bank: gData.bank || 'N/A',
          vpa: gData.vpa || 'N/A',
          cardNetwork: gData.card?.network || 'N/A',
          lastFour: gData.card?.last4 || 'N/A'
        };

        payload.settlement = {
          settlementId: txn.razorpaySettlementId || gData.settlement_id || `SETTL-${txn._id.toString().slice(-6)}`,
          settlementAmount: netSettled,
          settlementStatus: txn.settlementStatus || (['success', 'completed'].includes(txn.paymentStatus) ? 'settled' : 'processing'),
          settlementDate: txn.settlementDate || txn.updatedAt || txn.createdAt,
          gatewayFee: fee,
          netAmount: netSettled,
          bankReference: txn.bankReference || gData.acquirer_data?.bank_transaction_id || 'N/A'
        };

        const Refund = require('./refund-model');
        const refundObj = await Refund.findOne({ transactionId: txn._id }).lean();

        payload.refund = refundObj ? {
          refundId: refundObj._id,
          gatewayRefundId: refundObj.razorpayRefundId || 'N/A',
          refundAmount: refundObj.refundAmount || refundObj.amount || 0,
          refundStatus: refundObj.status || 'completed',
          refundSpeed: refundObj.speed || 'optimum',
          processedTime: refundObj.updatedAt || refundObj.createdAt
        } : null;

        payload.webhookTimeline = {
          paymentCreated: txn.createdAt,
          authorized: txn.createdAt,
          captured: txn.updatedAt || txn.createdAt,
          refunded: refundObj ? refundObj.createdAt : null,
          settled: txn.settlementDate || txn.updatedAt,
          failed: txn.paymentStatus === 'failed' ? txn.updatedAt : null,
          webhookReceived: txn.createdAt,
          webhookVerified: true
        };

        payload.apiResponse = gData;
      }
    } else if (['failed_payment', 'failed'].includes(type)) {
      let query = mongoose.Types.ObjectId.isValid(id)
        ? { _id: id }
        : { $or: [{ razorpayPaymentId: id }, { transactionId: id }] };

      let txn = await Transaction.findOne(query)
        .populate({
          path: 'booking',
          populate: [
            { path: 'customer', select: 'name email phone customerId wallet' },
            { path: 'provider', select: 'name email phone providerId wallet' }
          ]
        })
        .populate('user', 'name email phone customerId wallet')
        .populate('provider', 'name email phone providerId wallet')
        .lean();

      if (txn) {
        payload.mongoData = txn;
        const booking = txn.booking || {};
        const customer = txn.user || booking.customer || {};
        const provider = txn.provider || booking.provider || {};
        const gData = txn.razorpayResponse || {};

        let liveGatewayData = null;
        if (txn.razorpayPaymentId && razorpay) {
          try {
            liveGatewayData = await razorpay.payments.fetch(txn.razorpayPaymentId);
          } catch (rzErr) {
            global.logger.warn(`Live Razorpay fetch error for failed payment ${txn.razorpayPaymentId}: ${rzErr.message}`);
          }
        }
        const rData = liveGatewayData || gData;

        const amount = txn.amount || booking.totalAmount || 0;
        const failureReason = txn.failureReason || rData.error_description || 'Payment Gateway Drop-off / Verification Timeout';
        const errorCode = txn.errorCode || rData.error_code || 'BAD_REQUEST_ERROR';
        const errorDescription = txn.errorDescription || rData.error_description || 'Payment verification failed at gateway stage';

        payload.failureSummary = {
          paymentId: txn.razorpayPaymentId || txn.transactionId || `#${txn._id.toString().slice(-6)}`,
          booking: booking,
          customer: customer,
          provider: provider,
          amount: amount,
          method: txn.paymentMethod || 'online',
          gateway: txn.paymentMethod === 'wallet' ? 'Wallet' : 'Razorpay',
          failureReason: failureReason,
          status: txn.paymentStatus || 'failed'
        };

        payload.gatewayError = {
          errorCode: errorCode,
          errorSource: rData.error_source || 'customer',
          errorDescription: errorDescription,
          failureStage: rData.error_step || 'payment_verification',
          signatureVerification: 'Failed / Timed Out',
          webhookStatus: rData.status || 'payment.failed',
          gatewayResponse: rData
        };

        payload.retryHistory = [
          { attempt: 1, timestamp: txn.createdAt, result: 'Failed', reason: failureReason },
          { attempt: 2, timestamp: txn.updatedAt || txn.createdAt, result: 'Pending Re-verification', reason: 'Awaiting admin action' }
        ];

        payload.bookingInformation = {
          bookingStatus: booking.status || 'pending',
          bookingTimeline: {
            created: booking.createdAt || txn.createdAt,
            scheduled: booking.date ? `${booking.date} ${booking.time || ''}` : 'N/A',
            completed: booking.completedAt || null
          },
          assignedProvider: provider.name || 'Unassigned',
          cancellation: booking.status === 'cancelled' ? { cancelledAt: booking.updatedAt, reason: 'Payment failure timeout' } : null,
          complaint: null
        };

        payload.customerInformation = {
          name: customer.name || 'Customer',
          phone: customer.phone || 'N/A',
          email: customer.email || 'N/A',
          walletBalance: customer.wallet?.availableBalance || 0
        };

        payload.timeline = {
          bookingCreated: booking.createdAt || txn.createdAt,
          paymentInitiated: txn.createdAt,
          gatewayRequest: txn.createdAt,
          gatewayResponse: txn.updatedAt || txn.createdAt,
          failure: txn.updatedAt || txn.createdAt,
          retry: txn.updatedAt || null,
          finalStatus: txn.paymentStatus || 'failed'
        };

        payload.walletDiagnostics = {
          walletBalance: customer.wallet?.availableBalance || 0,
          requiredAmount: amount,
          failureReason: (customer.wallet?.availableBalance || 0) < amount ? 'Insufficient Wallet Balance' : failureReason
        };

        payload.mixedDiagnostics = {
          totalAmount: amount,
          onlineAmount: booking.totalAmount ? (booking.totalAmount - (booking.walletAmount || 0)) : amount,
          walletAmount: booking.walletAmount || 0,
          onlineFailure: true,
          walletSuccess: (booking.walletAmount || 0) > 0,
          overallStatus: 'Payment Partial / Online Failed'
        };
      }
    } else if (['audit', 'audit_log'].includes(type)) {
      const FraudLog = require('../fraud/fraud-log-model');
      let logObj = await FraudLog.findById(id)
        .populate('userId', 'name email role phone')
        .populate({
          path: 'bookingId',
          populate: [
            { path: 'customer', select: 'name email phone customerId' },
            { path: 'provider', select: 'name email phone providerId' }
          ]
        })
        .lean();

      if (logObj) {
        payload.mongoData = logObj;
        const adminUser = logObj.userId || {};
        const booking = logObj.bookingId || {};
        const customer = booking.customer || {};
        const provider = booking.provider || {};
        const act = logObj.actionType || logObj.action || 'UPDATE';

        let mod = 'Authentication';
        if (logObj.bookingId) mod = 'Bookings';
        else if (act.toLowerCase().includes('refund')) mod = 'Refunds';
        else if (act.toLowerCase().includes('wallet')) mod = 'Customer Wallet';
        else if (act.toLowerCase().includes('payout') || act.toLowerCase().includes('withdrawal')) mod = 'Withdrawals';

        payload.entitySummary = {
          action: act.toUpperCase(),
          module: mod,
          entity: logObj.userModel || 'Booking',
          entityId: logObj._id,
          performedBy: adminUser.name || adminUser.email || 'Platform Admin',
          role: adminUser.role || logObj.role || 'admin',
          status: logObj.riskLevel === 'HIGH' ? 'Failed' : 'Success'
        };

        payload.diffState = {
          beforeValue: logObj.beforeState || logObj.beforeValue || { status: 'PENDING', verified: false },
          afterValue: logObj.afterState || logObj.afterValue || { status: 'COMPLETED', verified: true }
        };

        payload.performedBy = {
          name: adminUser.name || 'Platform Admin',
          email: adminUser.email || 'admin@platform.com',
          role: adminUser.role || 'admin',
          ipAddress: logObj.ip || '127.0.0.1',
          deviceInfo: logObj.deviceDetails ? `${logObj.deviceDetails.platform || ''} ${logObj.deviceDetails.userAgent || ''}` : (logObj.device || 'Chrome (Windows NT 10.0)')
        };

        payload.reason = logObj.flagReason || logObj.reason || 'Administrative action logged for operational security audit';

        payload.connectedEntities = {
          booking: booking._id ? { id: booking._id, display: booking.bookingId } : null,
          payment: logObj.paymentId ? { id: logObj.paymentId, display: logObj.paymentId } : null,
          refund: logObj.refundId ? { id: logObj.refundId, display: logObj.refundId } : null,
          transaction: logObj.transactionId ? { id: logObj.transactionId, display: logObj.transactionId } : null,
          complaint: logObj.complaintId ? { id: logObj.complaintId, display: logObj.complaintId } : null,
          wallet: customer._id ? { id: customer._id, display: customer.name } : null,
          settlement: logObj.settlementId ? { id: logObj.settlementId, display: logObj.settlementId } : null,
          provider: provider._id ? { id: provider._id, display: provider.name } : null,
          customer: customer._id ? { id: customer._id, display: customer.name } : null
        };

        payload.timeline = {
          createdAt: logObj.createdAt,
          updatedAt: logObj.updatedAt || logObj.createdAt
        };
      }
    }

    res.status(200).json({
      success: true,
      data: payload
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getUnifiedEntityDetails] Error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Master Financial Ledger — All financial movements in one place.
 * Reuses Transaction model. Extends getAllTransactions with:
 *   - Running balance via MongoDB $setWindowFields (or sequential fallback)
 *   - Richer filter: transactionType, customerId, providerId, referenceNumber
 *   - Linked IDs: refundId, walletTransactionId, settlementId
 *   - Populated: customer name, provider name, booking, refund
 * NEVER creates duplicate records. Only reads existing data.
 */
const getMasterLedger = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 15,
      status,
      type,
      ledgerType,
      paymentMethod,
      startDate,
      endDate,
      search,
      bookingId,
      customerId,
      providerId,
      referenceNumber,
      zoneIds
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ── Build match filter ────────────────────────────────────────────────────
    const filter = {};

    if (zoneIds) {
      filter.booking = { $in: await getBookingIdsForZones(zoneIds) };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (status && status !== 'all') filter.paymentStatus = status;
    if (type && type !== 'all') filter.type = type;
    if (ledgerType && ledgerType !== 'all') filter.ledgerType = ledgerType;

    if (paymentMethod && paymentMethod !== 'all') {
      const pm = paymentMethod.toLowerCase();
      if (pm === 'razorpay' || pm === 'online') {
        filter.paymentMethod = { $in: ['online', 'razorpay', 'card', 'netbanking', 'upi', 'emi'] };
      } else {
        filter.paymentMethod = pm;
      }
    }

    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      filter.user = new mongoose.Types.ObjectId(customerId);
    }

    if (providerId && mongoose.Types.ObjectId.isValid(providerId)) {
      filter.provider = new mongoose.Types.ObjectId(providerId);
    }

    if (referenceNumber) {
      filter.$or = filter.$or || [];
      filter.$or.push(
        { transactionId: { $regex: referenceNumber, $options: 'i' } },
        { razorpayPaymentId: { $regex: referenceNumber, $options: 'i' } },
        { razorpayOrderId: { $regex: referenceNumber, $options: 'i' } },
        { bankReference: { $regex: referenceNumber, $options: 'i' } },
        { razorpaySettlementId: { $regex: referenceNumber, $options: 'i' } }
      );
    }

    if (search) {
      const searchOr = [
        { transactionId: { $regex: search, $options: 'i' } },
        { razorpayPaymentId: { $regex: search, $options: 'i' } },
        { razorpayOrderId: { $regex: search, $options: 'i' } },
        { bookingId: { $regex: search, $options: 'i' } },
        { bankReference: { $regex: search, $options: 'i' } }
      ];

      // Check if search looks like a booking ID — fetch matching bookings
      const matchingBookings = await Booking.find({
        $or: [
          { bookingId: { $regex: search, $options: 'i' } },
          ...(mongoose.Types.ObjectId.isValid(search) ? [{ _id: search }] : [])
        ]
      }).select('_id').lean();

      if (matchingBookings.length > 0) {
        searchOr.push({ booking: { $in: matchingBookings.map(b => b._id) } });
      }

      // Search by customer / provider name via User model
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').lean();

      if (matchingUsers.length > 0) {
        searchOr.push({ user: { $in: matchingUsers.map(u => u._id) } });
      }

      const matchingProviders = await Provider.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id').lean();

      if (matchingProviders.length > 0) {
        searchOr.push({ provider: { $in: matchingProviders.map(p => p._id) } });
      }

      if (filter.$or) {
        // Merge existing $or with search $or using $and
        filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
        delete filter.$or;
      } else {
        filter.$or = searchOr;
      }
    }

    if (bookingId) {
      const matchingBookings = await Booking.find({
        $or: [
          { bookingId: { $regex: bookingId, $options: 'i' } },
          ...(mongoose.Types.ObjectId.isValid(bookingId) ? [{ _id: bookingId }] : [])
        ]
      }).select('_id').lean();

      const bookingOr = [
        { bookingId: { $regex: bookingId, $options: 'i' } },
        { transactionId: { $regex: bookingId, $options: 'i' } },
        ...(matchingBookings.length > 0 ? [{ booking: { $in: matchingBookings.map(b => b._id) } }] : [])
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: bookingOr }];
        delete filter.$or;
      } else {
        filter.$or = bookingOr;
      }
    }

    // ── Count total docs matching filter ─────────────────────────────────────
    const total = await Transaction.countDocuments(filter);

    // ── Fetch paginated transactions ──────────────────────────────────────────
    const transactions = await Transaction.find(filter)
      .populate('user', 'name email phone customerId')
      .populate('provider', 'name email phone providerId')
      .populate({
        path: 'booking',
        select: 'bookingId totalAmount status paymentMethod walletUsed onlinePaid cashToPay commissionAmount providerEarnings',
      })
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // ── Fetch linked Refund IDs for these transactions ────────────────────────
    const Refund = require('./refund-model');
    const txnMongoIds = transactions.map(t => t._id);
    const bookingMongoIds = transactions.map(t => t.booking?._id || t.booking).filter(Boolean);

    const refunds = await Refund.find({
      $or: [
        { transactionId: { $in: txnMongoIds } },
        { bookingId: { $in: bookingMongoIds } }
      ]
    }).select('_id refundId transactionId bookingId refundAmount refundStatus gatewayRefundId walletTransactionId').lean();

    // Build lookup maps
    const refundByTxnId = {};
    const refundByBookingId = {};
    refunds.forEach(r => {
      if (r.transactionId) refundByTxnId[r.transactionId.toString()] = r;
      if (r.bookingId) refundByBookingId[r.bookingId.toString()] = r;
    });

    // ── Compute running balance sequentially (works on all MongoDB versions) ──
    // Fetch all transactions up to and including the last one on this page
    // sorted ascending to compute cumulative balance
    let runningBalanceMap = {};
    try {
      const allForBalance = await Transaction.find(filter)
        .select('_id amount entryType type createdAt')
        .sort({ createdAt: 1 })
        .lean();

      let cumulative = 0;
      allForBalance.forEach(t => {
        const isCredit = t.entryType === 'credit' ||
          ['payment', 'settlement', 'wallet_topup', 'referralreward', 'cashback', 'escrow_release', 'withdrawalrejection'].includes(t.type);
        const isDebit = t.entryType === 'debit' ||
          ['refund', 'withdrawal', 'penalty', 'commissiondeduction', 'refundrecovery', 'escrow_hold'].includes(t.type);

        if (isCredit && !isDebit) cumulative += (t.amount || 0);
        else if (isDebit && !isCredit) cumulative -= (t.amount || 0);

        runningBalanceMap[t._id.toString()] = parseFloat(cumulative.toFixed(2));
      });
    } catch (balErr) {
      global.logger?.warn('[getMasterLedger] Running balance computation skipped: ' + balErr.message);
    }

    // ── Enrich transactions with computed fields ───────────────────────────────
    const enriched = transactions.map(txn => {
      const txnIdStr = txn._id.toString();
      const bookingIdStr = (txn.booking?._id || txn.booking)?.toString();

      const linkedRefund = refundByTxnId[txnIdStr] || refundByBookingId[bookingIdStr] || null;

      // Determine debit / credit amounts
      const isCredit = txn.entryType === 'credit' ||
        ['payment', 'settlement', 'wallet_topup', 'referralreward', 'cashback', 'escrow_release', 'withdrawalrejection'].includes(txn.type);
      const isDebit = txn.entryType === 'debit' ||
        ['refund', 'withdrawal', 'penalty', 'commissiondeduction', 'refundrecovery', 'escrow_hold'].includes(txn.type);

      const creditAmount = (isCredit && !isDebit) ? (txn.amount || 0) : 0;
      const debitAmount = (isDebit && !isCredit) ? (txn.amount || 0) : 0;

      return {
        ...txn,
        // Ledger debit/credit (backend-computed, not in React)
        creditAmount,
        debitAmount,
        // Running balance
        runningBalance: runningBalanceMap[txnIdStr] ?? null,
        // Linked entity IDs
        refundId: linkedRefund?.refundId || null,
        refundMongoId: linkedRefund?._id || null,
        refundAmount: linkedRefund?.refundAmount || null,
        refundStatus: linkedRefund?.refundStatus || null,
        gatewayRefundId: linkedRefund?.gatewayRefundId || null,
        walletTransactionId: linkedRefund?.walletTransactionId || txn.description?.includes('Wallet') ? (txn.transactionId || null) : null,
        settlementId: txn.razorpaySettlementId || txn.settlementBatchId || null,
        // Human-readable transaction type
        displayType: (txn.type || 'payment').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' '),
        // Reference number (unified)
        referenceNumber: txn.transactionId || txn.razorpayPaymentId || txn._id.toString(),
        // Gateway reference
        gatewayReference: txn.razorpayPaymentId || txn.razorpayOrderId || txn.razorpaySettlementId || null,
        // Created by
        createdBy: txn.approvedBy?.name || (txn.ledgerType === 'wallet' ? 'System (Wallet)' : txn.type === 'payment' ? 'Customer' : 'System'),
      };
    });

    res.status(200).json({
      success: true,
      count: enriched.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      data: enriched
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getMasterLedger] Error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Master Ledger Detail — Full enriched record for TransactionLedgerDetailModal.
 * All 5 tabs of data: Overview, Financial Breakdown, Connected Records, Timeline, Audit.
 * Reuses existing models. Never creates records.
 */
const getLedgerDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Transaction ID is required' });
    }

    // Find by MongoDB _id, transactionId, or razorpayPaymentId
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { $or: [{ transactionId: id }, { razorpayPaymentId: id }] };

    const txn = await Transaction.findOne(query)
      .populate('user', 'name email phone customerId wallet.availableBalance wallet.totalRefunded createdAt')
      .populate('provider', 'name email phone providerId wallet.availableBalance earnings createdAt')
      .populate('approvedBy', 'name email role')
      .populate('complaint', 'complaintId status reason resolution createdAt updatedAt')
      .populate({
        path: 'booking',
        select: 'bookingId services totalAmount status subtotal totalDiscount couponApplied commissionAmount providerEarnings walletUsed onlinePaid cashToPay paymentStatus paymentMethod date time address notes refundStatus refundAmount cancellationProgress cancelledAt cancelledBy cancellationReason complaintId disputeStatus adminRemark confirmedBooking paidAmount paymentDate statusHistory createdAt updatedAt',
        populate: [
          { path: 'services.service', select: 'title price category' },
          { path: 'commissionRule', select: 'name rate type' },
          { path: 'customer', select: 'name email phone' },
          { path: 'provider', select: 'name email phone providerId' },
        ]
      })
      .lean();

    if (!txn) {
      return res.status(404).json({ success: false, message: 'Transaction record not found' });
    }

    const booking = txn.booking;

    // ── Financial Breakdown — All from backend, accurate accounting ─────────
    const isWithdrawalTxn = txn.type === 'withdrawal' || txn.ledgerType === 'withdrawal' || (txn.bookingId && txn.bookingId.startsWith('WDL-'));
    const isRefundTxn = txn.type === 'refund' || txn.type === 'refundrecovery';
    const isCommissionTxn = txn.type === 'commissiondeduction' || txn.ledgerType === 'commission';

    let totalAmount = 0;
    let walletPaid = 0;
    let onlinePaid = 0;
    let cashPaid = 0;
    let finalPaid = 0;
    let discount = 0;
    let subtotal = 0;
    let commissionAmount = 0;
    let providerEarnings = 0;

    if (isWithdrawalTxn) {
      totalAmount = txn.amount || 0;
      walletPaid = txn.amount || 0;
      finalPaid = 0; // Withdrawals are not customer payments
      commissionAmount = 0;
      providerEarnings = 0;
      subtotal = 0;
      discount = 0;
    } else if (booking) {
      totalAmount = booking.totalAmount || txn.amount || 0;
      discount = booking.totalDiscount || 0;
      subtotal = booking.subtotal || (totalAmount + discount);
      commissionAmount = booking.commissionAmount ?? (txn.commission || 0);
      providerEarnings = booking.providerEarnings ?? (txn.providerEarning || 0);

      const actualMethod = booking.paymentVerification?.method || booking.paymentMethod || txn.paymentMethod;

      if (booking.paymentMethod === 'mixed') {
        walletPaid = booking.walletUsed || 0;
        onlinePaid = booking.onlinePaid || 0;
        cashPaid = booking.cashToPay || 0;
        finalPaid = walletPaid + onlinePaid + cashPaid;
      } else if (actualMethod === 'qr_code' || txn.paymentMethod === 'upi' || ['online', 'razorpay', 'upi', 'card', 'netbanking'].includes(txn.paymentMethod)) {
        walletPaid = booking.walletUsed || 0;
        onlinePaid = totalAmount - walletPaid;
        cashPaid = 0;
        finalPaid = totalAmount;
      } else if (actualMethod === 'cash_received' || txn.paymentMethod === 'cash' || booking.paymentMethod === 'cash') {
        walletPaid = booking.walletUsed || 0;
        cashPaid = totalAmount - walletPaid;
        onlinePaid = 0;
        finalPaid = totalAmount;
      } else if (txn.paymentMethod === 'wallet' || booking.paymentMethod === 'wallet') {
        walletPaid = totalAmount;
        onlinePaid = 0;
        cashPaid = 0;
        finalPaid = totalAmount;
      } else {
        onlinePaid = txn.amount || totalAmount;
        finalPaid = totalAmount;
      }
    } else {
      totalAmount = txn.amount || 0;
      commissionAmount = isCommissionTxn ? txn.amount : (txn.commission || 0);
      providerEarnings = txn.providerEarning || 0;
      finalPaid = (txn.type === 'payment') ? (txn.amount || 0) : 0;
      if (txn.paymentMethod === 'cash') cashPaid = txn.amount || 0;
      else if (txn.paymentMethod === 'wallet') walletPaid = txn.amount || 0;
      else onlinePaid = (txn.type === 'payment') ? (txn.amount || 0) : 0;
    }

    // Debit / Credit
    const isCredit = txn.entryType === 'credit' ||
      ['payment', 'settlement', 'wallet_topup', 'referralreward', 'cashback', 'escrow_release', 'withdrawalrejection'].includes(txn.type);
    const isDebit = txn.entryType === 'debit' ||
      ['refund', 'withdrawal', 'penalty', 'commissiondeduction', 'refundrecovery', 'escrow_hold'].includes(txn.type);

    const creditAmount = (isCredit && !isDebit) ? (txn.amount || 0) : 0;
    const debitAmount = (isDebit && !isCredit) ? (txn.amount || 0) : 0;

    // ── Linked Refund ────────────────────────────────────────────────────────
    const Refund = require('./refund-model');
    const refund = await Refund.findOne({
      $or: [
        { transactionId: txn._id },
        ...(booking?._id ? [{ bookingId: booking._id }] : [])
      ]
    })
      .populate('approvedBy', 'name email')
      .lean();

    // ── Linked ProviderEarning ────────────────────────────────────────────────
    let providerEarningRecord = null;
    if (booking?._id) {
      const ProviderEarning = require('../provider/provider-earning-model');
      providerEarningRecord = await ProviderEarning.findOne({ booking: booking._id })
        .populate('paymentRecord')
        .lean();
    }

    // ── Linked PaymentRecord (Payout/Withdrawal) ──────────────────────────────
    let paymentRecord = null;
    if (providerEarningRecord?.paymentRecord) {
      paymentRecord = providerEarningRecord.paymentRecord;
    } else if (booking?._id) {
      paymentRecord = await PaymentRecord.findOne({ booking: booking._id }).lean();
    }

    // ── All Ledger Transactions for this booking ──────────────────────────────
    let ledgerEntries = [];
    if (booking?._id) {
      ledgerEntries = await Transaction.find({ booking: booking._id })
        .select('_id transactionId type ledgerType entryType amount paymentMethod paymentStatus description balanceBefore balanceAfter createdAt updatedAt razorpayPaymentId razorpayOrderId')
        .sort({ createdAt: 1 })
        .lean();
    }

    // ── Complaint ────────────────────────────────────────────────────────────
    let complaint = txn.complaint || null;
    if (!complaint && (booking?.complaintId || booking?.complaint)) {
      const Complaint = require('../complaint/complaint-model');
      complaint = await Complaint.findById(booking.complaintId || booking.complaint)
        .select('complaintId status reason resolution createdAt updatedAt raisedBy')
        .lean();
    }

    // ── Settlement info ───────────────────────────────────────────────────────
    const isTxnSettled = ['success', 'completed', 'paid'].includes(txn.paymentStatus);
    const gatewayFee = txn.gatewayFee ?? (txn.razorpayResponse?.fee != null ? parseFloat((txn.razorpayResponse.fee / 100).toFixed(2)) : 0);
    const gatewayTax = txn.gatewayTax ?? (txn.razorpayResponse?.tax != null ? parseFloat((txn.razorpayResponse.tax / 100).toFixed(2)) : 0);
    const netSettlementAmount = txn.netSettlementAmount || Math.max(0, parseFloat((txn.amount - gatewayFee - gatewayTax).toFixed(2)));

    const settlement = {
      settlementId: txn.razorpaySettlementId || txn.settlementBatchId || null,
      settlementStatus: txn.settlementStatus || (isTxnSettled ? 'settled' : 'pending'),
      settlementAmount: txn.settlementAmount || txn.amount || 0,
      settlementDate: txn.settlementDate || (isTxnSettled ? (txn.updatedAt || txn.createdAt) : null),
      gatewayFee,
      gatewayTax,
      netSettlementAmount,
      bankReference: txn.bankReference || null,
    };

    // ── Timeline — chronological events ──────────────────────────────────────
    const timeline = [];

    timeline.push({ label: 'Transaction Created', timestamp: txn.createdAt, status: 'done', actor: 'System' });

    if (txn.paymentStatus === 'success' || txn.paymentStatus === 'completed') {
      timeline.push({ label: 'Payment Captured', timestamp: txn.updatedAt, status: 'done', actor: 'Razorpay' });
    }
    if (txn.paymentStatus === 'failed') {
      timeline.push({ label: 'Payment Failed', timestamp: txn.updatedAt, status: 'failed', actor: 'Gateway' });
    }

    if (booking?.status === 'completed') {
      timeline.push({ label: 'Booking Completed', timestamp: booking.updatedAt, status: 'done', actor: 'Provider' });
    }
    if (commissionAmount > 0) {
      timeline.push({ label: `Commission Deducted (₹${commissionAmount})`, timestamp: booking?.updatedAt, status: 'done', actor: 'System' });
    }
    if (providerEarnings > 0 && providerEarningRecord) {
      timeline.push({ label: `Provider Earnings Released (₹${providerEarnings})`, timestamp: providerEarningRecord.createdAt, status: 'done', actor: 'System' });
    }
    if (paymentRecord) {
      timeline.push({ label: 'Settlement / Payout Initiated', timestamp: paymentRecord.createdAt, status: paymentRecord.status === 'completed' ? 'done' : 'pending', actor: 'Admin' });
    }
    if (refund) {
      timeline.push({ label: `Refund Initiated (₹${refund.refundAmount})`, timestamp: refund.createdAt, status: 'done', actor: refund.refundType === 'manual' ? 'Admin' : 'System' });
      if (refund.refundStatus === 'completed') {
        timeline.push({ label: 'Refund Completed', timestamp: refund.completedAt || refund.updatedAt, status: 'done', actor: 'System' });
      }
    }

    if (booking?.cancellationProgress?.refundCompletedAt) {
      const alreadyHasRefundComplete = timeline.some(t => t.label === 'Refund Completed');
      if (!alreadyHasRefundComplete) {
        timeline.push({ label: 'Refund Completed', timestamp: booking.cancellationProgress.refundCompletedAt, status: 'done', actor: 'System' });
      }
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // ── Audit trail ───────────────────────────────────────────────────────────
    const audit = {
      createdBy: txn.approvedBy?.name || (txn.type === 'payment' ? txn.user?.name || 'Customer' : 'System'),
      createdByRole: txn.approvedBy?.role || (txn.type === 'payment' ? 'customer' : 'system'),
      updatedBy: txn.approvedBy?.name || 'System',
      reason: txn.description || txn.refundReason || null,
      idempotencyKey: txn.idempotencyKey || null,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt,
    };

    // Refund audit logs if available
    const refundAuditLogs = refund?.auditLogs || [];

    res.status(200).json({
      success: true,
      data: {
        // Core
        _id: txn._id,
        transactionId: txn.transactionId || txn.razorpayPaymentId || txn._id,
        referenceNumber: txn.transactionId || txn.razorpayPaymentId || txn._id.toString(),
        gatewayReference: txn.razorpayPaymentId || txn.razorpayOrderId || null,
        type: txn.type,
        displayType: (txn.type || 'payment').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' '),
        ledgerType: txn.ledgerType,
        entryType: txn.entryType,
        paymentStatus: txn.paymentStatus,
        paymentMethod: txn.paymentMethod,
        currency: txn.currency || 'INR',
        description: txn.description,
        createdAt: txn.createdAt,
        updatedAt: txn.updatedAt,

        // Razorpay
        razorpayPaymentId: txn.razorpayPaymentId || null,
        razorpayOrderId: txn.razorpayOrderId || null,
        razorpaySettlementId: txn.razorpaySettlementId || null,
        razorpaySignature: txn.razorpaySignature || null,
        razorpayResponse: txn.razorpayResponse || null,

        // Financial Breakdown — ALL FROM BACKEND
        amount: txn.amount,
        creditAmount,
        debitAmount,
        totalAmount,
        walletPaid,
        onlinePaid,
        cashPaid,
        finalPaid,
        discount,
        subtotal,
        commissionAmount,
        providerEarnings,
        gatewayFee: txn.gatewayFee || 0,
        gatewayTax: txn.gatewayTax || 0,
        balanceBefore: txn.balanceBefore,
        balanceAfter: txn.balanceAfter,

        // Entities
        customer: txn.user || null,
        provider: txn.provider || null,
        booking: booking || null,
        complaint: complaint || null,

        // Connected Record IDs
        refundId: refund?.refundId || null,
        refundMongoId: refund?._id || null,
        refund: refund || null,
        walletTransactionId: txn.transactionId && txn.ledgerType === 'wallet' ? txn.transactionId : (refund?.walletTransactionId || null),
        settlementId: txn.razorpaySettlementId || txn.settlementBatchId || null,
        providerEarningRecord: providerEarningRecord || null,
        paymentRecord: paymentRecord || null,

        // Settlement
        settlement,

        // Ledger entries (all transactions for the same booking)
        ledgerEntries,

        // Timeline
        timeline,

        // Audit
        audit,
        refundAuditLogs,
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getLedgerDetail] Error: ${error.message}`, error);
    next(error);
  }
};

const handleQRSuccessPayment = async (payment, session, qrCodeId) => {
  const qrId = qrCodeId || payment.notes?.qrCodeId || payment.qr_code_id;
  const bookingId = payment.notes?.bookingId;

  const lockKey = `${bookingId || 'unknown'}-${payment.id || qrId || 'unknown'}`;
  if (activeWebhookProcessings.has(lockKey)) {
    global.logger.info(`[handleQRSuccessPayment] Webhook processing for ${lockKey} already in progress.`);
    return;
  }
  activeWebhookProcessings.add(lockKey);

  try {
    let booking = null;
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      booking = await Booking.findById(bookingId).session(session);
    }
    if (!booking && qrId) {
      booking = await Booking.findOne({ 'paymentVerification.qrCodeId': qrId }).session(session);
    }

    if (!booking) {
      global.logger.warn(`[handleQRSuccessPayment] No booking found for QR ${qrId} or booking ${bookingId}`);
      return;
    }

    if (booking.paymentVerification?.status === 'verified' || booking.status === 'completed' || (booking.paymentMethod === 'cash' && (booking.paymentStatus === 'paid' || booking.paymentStatus === 'settled'))) {
      global.logger.info(`[handleQRSuccessPayment] Booking ${booking._id} already completed / payment verified / settled via cash.`);
      return;
    }

    if (payment.id) {
      const existingTx = await Transaction.findOne({ razorpayPaymentId: payment.id }).session(session);
      if (existingTx) {
        global.logger.info(`[handleQRSuccessPayment] Payment ${payment.id} has already been processed.`);
        return;
      }
    }

    const providerId = booking.provider;
    const CommissionRule = require('./commission-rule-model');
    const ProviderEarning = require('../provider/provider-earning-model');

    await booking.recalculateFinancials();

    const commission = booking.commissionAmount || 0;
    const providerEarnings = booking.providerEarnings || 0;

    booking.paymentVerification = {
      method: 'qr_code',
      status: 'verified',
      qrCodeId: qrId,
      verifiedAt: new Date()
    };
    booking.status = 'completed';
    booking.paymentStatus = 'paid';
    booking.completedAt = new Date();
    booking.commissionProcessed = true;

    booking.statusHistory.push({
      status: 'completed',
      timestamp: new Date(),
      note: `Dynamic QR Payment verified via Razorpay webhook. Txn: ${payment.id || 'QR-PAY'}`,
      updatedBy: 'system'
    });

    await booking.save({ session });

    let transaction = await Transaction.findOne({
      booking: booking._id,
      type: 'payment',
      paymentStatus: 'pending'
    }).session(session);

    if (transaction) {
      transaction.paymentMethod = 'upi';
      transaction.paymentStatus = 'completed';
      transaction.amount = booking.totalAmount;
      transaction.commission = commission;
      transaction.providerEarning = providerEarnings;
      transaction.razorpayPaymentId = payment.id;
      transaction.razorpayOrderId = payment.order_id;
      transaction.razorpayResponse = payment;
      if (payment.fee != null) {
        transaction.gatewayFee = parseFloat((payment.fee / 100).toFixed(2));
      }
      if (payment.tax != null) {
        transaction.gatewayTax = parseFloat((payment.tax / 100).toFixed(2));
      }
      transaction.description = `QR Code UPI payment received for booking ${booking.bookingId || booking._id}`;
      transaction.updatedAt = new Date();
      await transaction.save({ session });
    } else {
      transaction = new Transaction({
        booking: booking._id,
        bookingId: booking.bookingId || booking._id.toString(),
        user: booking.customer,
        provider: providerId,
        amount: booking.totalAmount,
        commission: commission,
        providerEarning: providerEarnings,
        paymentMethod: 'upi',
        paymentStatus: 'completed',
        type: 'payment',
        ledgerType: 'payment',
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id,
        razorpayResponse: payment,
        description: `QR Code UPI payment received for booking ${booking.bookingId || booking._id}`
      });
      await transaction.save({ session });
    }

    const isRefDisc = (booking.couponApplied && booking.couponApplied.isReferralCoupon) || booking.isReferralDiscount;
    const refAmount = isRefDisc ? (booking.totalDiscount || 0) : 0;
    const provDiscount = Math.max(0, (booking.totalDiscount || 0) - refAmount);
    const baseAmount = Math.max(0, booking.subtotal - provDiscount);
    let rule = null;
    if (providerId) {
      rule = await CommissionRule.getCommissionForProvider(providerId, booking.zoneId, 'standard', booking.services?.[0]?.service);
    }
    const providerDoc = providerId ? await Provider.findById(providerId).session(session) : null;
    const { getReferralCommissionDiscount } = require('../referral/referral-helpers');
    const effectiveRate = rule ? getReferralCommissionDiscount(providerDoc, rule, baseAmount) : 0;
    if (effectiveRate !== (rule ? rule.value : 0)) {
      booking.referralDiscountApplied = true;
      await booking.save({ session });
    }

    let earning = await ProviderEarning.findOne({ booking: booking._id, provider: providerId }).session(session);
    if (earning) {
      if (!earning.paymentRecord && !['withdrawn', 'cancelled'].includes(earning.status)) {
        earning.grossAmount = baseAmount;
        earning.commissionRate = effectiveRate;
        earning.commissionAmount = commission;
        earning.netAmount = providerEarnings;
        earning.status = 'held';
        earning.availableAfter = new Date(Date.now() + 48 * 60 * 60 * 1000);
        await earning.save({ session });
      }
    } else {
      earning = new ProviderEarning({
        provider: providerId,
        booking: booking._id,
        grossAmount: baseAmount,
        commissionRate: effectiveRate,
        commissionAmount: commission,
        netAmount: providerEarnings,
        status: 'held',
        availableAfter: new Date(Date.now() + 48 * 60 * 60 * 1000)
      });
      await earning.save({ session });
    }

    if (providerId) {
      await Provider.findByIdAndUpdate(
        providerId,
        {
          $inc: { completedBookings: 1 },
          $set: { 'wallet.lastUpdated': new Date(), activeBooking: null }
        },
        { session }
      );
    }

    try {
      const { getIO } = require('../../shared/socket/socket-server');
      const io = getIO();
      if (io) {
        io.to(`booking_${booking._id}`).emit('payment_verified', {
          bookingId: booking._id,
          status: 'completed',
          paymentMethod: 'qr_code',
          totalAmount: booking.totalAmount,
          verifiedAt: new Date()
        });
        io.to(`booking_${booking._id}`).emit('booking_updated', {
          bookingId: booking._id,
          booking: booking
        });
      }
    } catch (socketErr) {
      console.error('[handleQRSuccessPayment] Socket error:', socketErr);
    }

    try {
      const { sendNotification } = require('../notification/notification-helper');
      if (booking.customer) {
        sendNotification(booking.customer, 'customer', 'Payment Received', `Your payment of ₹${booking.totalAmount} for booking #${booking.bookingId} via QR code was successful.`, 'booking', booking._id);
      }
      if (providerId) {
        sendNotification(providerId, 'provider', 'Payment Verified', `Customer paid ₹${booking.totalAmount} via QR Code for booking #${booking.bookingId}. Your earnings: ₹${providerEarnings}.`, 'booking', booking._id);
      }
    } catch (notifErr) {
      console.error('[handleQRSuccessPayment] Notification error:', notifErr);
    }
  } catch (error) {
    throw error;
  } finally {
    activeWebhookProcessings.delete(lockKey);
  }
};

const generateBookingQR = async (req, res, next) => {
  const { bookingId } = req.body;

  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ success: false, message: 'Valid bookingId is required' });
  }

  if (activeRequests.has(bookingId)) {
    return res.status(429).json({
      success: false,
      message: 'A QR generation request is already in progress for this booking. Please wait.'
    });
  }

  activeRequests.add(bookingId);

  try {
    const providerId = req.provider?._id || req.user?._id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.paymentVerification?.status === 'verified' || booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Booking is already completed and verified.' });
    }

    const { SystemConfig } = require('../system-setting/system-setting-model');
    let settings = await SystemConfig.findOne().lean();
    const qrExpiryMinutes = settings?.bookingSettings?.qrExpiryMinutes || 10;
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (qrExpiryMinutes * 60);

    // Reuse existing active QR code if still valid
    if (
      booking.paymentVerification?.qrCodeId &&
      booking.paymentVerification?.qrImageUrl &&
      booking.paymentVerification?.status === 'waiting_payment' &&
      booking.paymentVerification?.qrExpiresAt &&
      new Date(booking.paymentVerification.qrExpiresAt) > new Date()
    ) {
      return res.status(200).json({
        success: true,
        message: 'Active QR code reused',
        data: {
          qrCodeId: booking.paymentVerification.qrCodeId,
          imageUrl: booking.paymentVerification.qrImageUrl,
          expiresAt: booking.paymentVerification.qrExpiresAt,
          totalAmount: booking.totalAmount,
          qrExpiryMinutes
        }
      });
    }

    if (booking.paymentVerification?.qrCodeId && booking.paymentVerification?.status === 'waiting_payment') {
      try {
        await razorpay.qrCode.close(booking.paymentVerification.qrCodeId);
      } catch (err) {
        console.warn(`Non-critical warning closing previous QR: ${err.message}`);
      }
    }

    let qrCode;
    try {
      qrCode = await razorpay.qrCode.create({
        type: 'upi_qr',
        name: `Booking #${booking.bookingId || booking._id.toString().slice(-6)}`,
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: Math.round(booking.totalAmount * 100),
        description: `Payment for booking ${booking.bookingId || booking._id}`,
        close_by: expiryTimestamp,
        notes: {
          bookingId: booking._id.toString(),
          providerId: providerId?.toString()
        }
      });
    } catch (razorpayErr) {
      console.error('Razorpay QR API failed:', razorpayErr.message);
      return res.status(400).json({
        success: false,
        message: `Failed to generate Razorpay QR code: ${razorpayErr.message || 'Razorpay Gateway Error'}`
      });
    }

    const qrExpiresAt = new Date(Date.now() + qrExpiryMinutes * 60 * 1000);
    booking.paymentVerification = {
      method: 'qr_code',
      status: 'waiting_payment',
      qrCodeId: qrCode.id,
      qrImageUrl: qrCode.image_url,
      qrExpiresAt: qrExpiresAt,
      idempotencyKey: `QR-${Date.now()}`
    };

    booking.statusHistory.push({
      status: booking.status,
      timestamp: new Date(),
      note: `Dynamic QR Code generated for ₹${booking.totalAmount} (Valid for ${qrExpiryMinutes} mins). QR ID: ${qrCode.id}`,
      updatedBy: 'provider'
    });

    await booking.save();

    let qrTx = await Transaction.findOne({
      booking: booking._id,
      type: 'payment',
      paymentStatus: 'pending'
    });

    if (qrTx) {
      qrTx.paymentMethod = 'upi';
      qrTx.amount = booking.totalAmount;
      qrTx.razorpayResponse = qrCode;
      qrTx.description = `QR Code generated for booking ${booking.bookingId || booking._id}`;
      qrTx.updatedAt = new Date();
      await qrTx.save();
    } else {
      qrTx = new Transaction({
        booking: booking._id,
        bookingId: booking.bookingId || booking._id.toString(),
        user: booking.customer,
        provider: providerId,
        amount: booking.totalAmount,
        paymentMethod: 'upi',
        paymentStatus: 'pending',
        type: 'payment',
        ledgerType: 'payment',
        razorpayResponse: qrCode,
        description: `QR Code generated for booking ${booking.bookingId || booking._id}`
      });
      await qrTx.save();
    }

    try {
      const { getIO } = require('../../shared/socket/socket-server');
      const io = getIO();
      if (io) {
        io.to(`booking_${booking._id}`).emit('payment_verification_updated', {
          bookingId: booking._id,
          paymentVerification: booking.paymentVerification
        });
      }
    } catch (sErr) { }

    return res.status(200).json({
      success: true,
      message: 'Dynamic QR Code generated successfully',
      data: {
        qrCodeId: qrCode.id,
        imageUrl: qrCode.image_url,
        expiresAt: qrExpiresAt,
        totalAmount: booking.totalAmount,
        qrExpiryMinutes
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.generateBookingQR] Error: ${error.message}`, error);
    next(error);
  } finally {
    activeRequests.delete(bookingId);
  }
};

const verifyCashReceived = async (req, res, next) => {
  const { bookingId } = req.body;

  if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
    return res.status(400).json({ success: false, message: 'Valid bookingId is required' });
  }

  if (activeRequests.has(bookingId)) {
    return res.status(429).json({
      success: false,
      message: 'A payment verification request is already in progress for this booking. Please wait.'
    });
  }

  activeRequests.add(bookingId);

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (err) {
    session = null;
  }

  try {
    const providerId = req.provider?._id;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      if (session) await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Valid bookingId is required' });
    }

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      if (session) await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (
      booking.commissionProcessed ||
      booking.paymentVerification?.status === 'verified' ||
      booking.status === 'completed' ||
      booking.paymentStatus === 'paid' ||
      booking.paymentStatus === 'settled' ||
      booking.paymentStatus === 'escrowhold' ||
      booking.confirmedBooking
    ) {
      if (session) await session.abortTransaction();
      return res.status(409).json({ success: false, message: 'Payment already completed/settled for this booking.' });
    }

    const provider = await Provider.findById(providerId).session(session);
    if (!provider) {
      if (session) await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    const CommissionRule = require('./commission-rule-model');
    const firstService = booking.services && booking.services[0];
    const serviceId = firstService ? firstService.service : null;
    const rule = await CommissionRule.getCommissionForProvider(providerId, booking.zoneId, 'standard', serviceId);

    if (!rule) {
      if (session) await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'No active commission rule found for provider' });
    }

    // Centered pure financials calculation
    await booking.recalculateFinancials();

    const commission = booking.commissionAmount || 0;
    const providerEarnings = booking.providerEarnings || 0;
    const companySurgeShare = booking.companySurgeShare || 0;

    const isCompanyReferral = (booking.couponApplied && booking.couponApplied.isReferralCoupon) || booking.isReferralDiscount;
    const subsidyAmount = parseFloat((providerEarnings - booking.totalAmount).toFixed(2));

    let cashRecovery = 0;

    if (isCompanyReferral && subsidyAmount > 0) {
      // Rule 4: Company-funded referral coupon cash rule
      // Do not debit provider for subsidy. Credit provider with exact subsidy amount.
      const updatedProvider = await Provider.findByIdAndUpdate(
        providerId,
        {
          $inc: { 'wallet.availableBalance': subsidyAmount },
          $set: { 'wallet.lastUpdated': new Date() }
        },
        { session, new: true }
      );
      const balanceAfter = updatedProvider?.wallet?.availableBalance || 0;
      const balanceBefore = balanceAfter - subsidyAmount;

      const subsidyTx = new Transaction({
        booking: booking._id,
        bookingId: booking.bookingId || booking._id.toString(),
        user: booking.customer,
        provider: providerId,
        amount: subsidyAmount,
        paymentStatus: 'completed',
        paymentMethod: 'wallet',
        type: 'referral_coupon_subsidy',
        ledgerType: 'referral',
        entryType: 'credit',
        balanceBefore,
        balanceAfter,
        description: `Company-funded referral coupon subsidy of ₹${subsidyAmount} credited to wallet for Cash Booking #${booking.bookingId || booking._id}`
      });
      await subsidyTx.save({ session });
    } else {
      // Rule 5: Normal Cash Booking
      cashRecovery = parseFloat((booking.totalAmount - providerEarnings).toFixed(2));
      if (cashRecovery > 0) {
        const providerBalance = provider.wallet?.availableBalance || 0;
        if (providerBalance < cashRecovery) {
          if (session) await session.abortTransaction();
          return res.status(400).json({
            success: false,
            message: `Insufficient wallet balance. Platform cash recovery of ₹${cashRecovery} is required to verify cash payment. Your current wallet balance is ₹${providerBalance}. Please topup your wallet.`
          });
        }

        const updatedProvider = await Provider.findOneAndUpdate(
          { _id: providerId, 'wallet.availableBalance': { $gte: cashRecovery } },
          {
            $inc: { 'wallet.availableBalance': -cashRecovery },
            $set: { 'wallet.lastUpdated': new Date() }
          },
          { session, new: true }
        );

        if (!updatedProvider) {
          if (session) await session.abortTransaction();
          return res.status(400).json({ success: false, message: 'Wallet balance check failed during transaction.' });
        }

        const balanceAfter = updatedProvider?.wallet?.availableBalance || 0;
        const balanceBefore = balanceAfter + cashRecovery;

        const commissionTx = new Transaction({
          booking: booking._id,
          bookingId: booking.bookingId || booking._id.toString(),
          user: booking.customer,
          provider: providerId,
          amount: cashRecovery,
          paymentStatus: 'completed',
          paymentMethod: 'wallet',
          type: 'commissiondeduction',
          ledgerType: 'commission',
          entryType: 'debit',
          balanceBefore,
          balanceAfter,
          deductionType: 'cash_booking_commission',
          description: `Cash recovery fee of ₹${cashRecovery} (Commission: ₹${commission}, Surcharge Share: ₹${companySurgeShare}) deducted from wallet for Cash Booking #${booking.bookingId || booking._id}`
        });
        await commissionTx.save({ session });
      }
    }

    booking.paymentMethod = 'cash'; // Transition paymentMethod to cash for QR -> Cash fallback
    booking.paymentVerification = {
      method: 'cash_received',
      status: 'verified',
      verifiedAt: new Date()
    };
    booking.paymentStatus = 'paid';
    booking.commissionProcessed = true;

    booking.statusHistory.push({
      status: booking.status || 'workstarted',
      timestamp: new Date(),
      note: `Cash payment verified by provider. ${cashRecovery > 0 ? `Cash recovery of ₹${cashRecovery} deducted from wallet.` : (isCompanyReferral && subsidyAmount > 0 ? `Company referral subsidy of ₹${subsidyAmount} credited to wallet.` : 'Payment settled.')}`,
      updatedBy: 'provider'
    });

    await booking.save({ session });

    const isRefDisc = (booking.couponApplied && booking.couponApplied.isReferralCoupon) || booking.isReferralDiscount;
    const refAmount = isRefDisc ? (booking.totalDiscount || 0) : 0;
    const provDiscount = Math.max(0, (booking.totalDiscount || 0) - refAmount);
    const baseAmount = Math.max(0, booking.subtotal - provDiscount);
    const { getReferralCommissionDiscount } = require('../referral/referral-helpers');
    const effectiveRate = rule ? getReferralCommissionDiscount(provider, rule, baseAmount) : 0;
    if (effectiveRate !== (rule ? rule.value : 0)) {
      booking.referralDiscountApplied = true;
      await booking.save({ session });
    }

    const ProviderEarning = require('../provider/provider-earning-model');
    let earning = await ProviderEarning.findOne({ booking: booking._id, provider: providerId }).session(session);
    if (earning) {
      if (!earning.paymentRecord && !['withdrawn', 'cancelled'].includes(earning.status)) {
        earning.grossAmount = baseAmount;
        earning.commissionRate = effectiveRate;
        earning.commissionAmount = commission;
        earning.netAmount = providerEarnings;
        earning.status = 'paid';
        earning.availableAfter = new Date();
        await earning.save({ session });
      }
    } else {
      earning = new ProviderEarning({
        provider: providerId,
        booking: booking._id,
        grossAmount: baseAmount,
        commissionRate: effectiveRate,
        commissionAmount: commission,
        netAmount: providerEarnings,
        status: 'paid',
        availableAfter: new Date()
      });
      await earning.save({ session });
    }
    const { incrementReferralBenefitUsage } = require('../referral/referral-helpers');
    await incrementReferralBenefitUsage(booking._id, session);

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    try {
      if (booking.provider) {
        const referralController = require('../referral/referral-controller');
        await referralController.triggerProviderReferralReward(booking.provider);
      }
    } catch (refRewardErr) {
      console.error('Error triggering referral rewards on cash verification:', refRewardErr);
    }

    try {
      const { getIO } = require('../../shared/socket/socket-server');
      const io = getIO();
      if (io) {
        io.to(`booking_${booking._id}`).emit('payment_verified', {
          bookingId: booking._id,
          status: 'completed',
          paymentMethod: 'cash_received',
          totalAmount: booking.totalAmount,
          verifiedAt: new Date()
        });
        io.to(`booking_${booking._id}`).emit('booking_updated', {
          bookingId: booking._id,
          booking: booking
        });
      }
    } catch (sErr) { }

    try {
      const { sendNotification } = require('../notification/notification-helper');
      if (booking.customer) {
        sendNotification(booking.customer, 'customer', 'Booking Completed', `Your cash payment for booking #${booking.bookingId} has been verified and completed.`, 'booking', booking._id);
      }
    } catch (nErr) { }

    return res.status(200).json({
      success: true,
      message: 'Cash payment verified and booking completed successfully',
      data: {
        bookingId: booking._id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        commissionDeducted: commission,
        providerWalletBalance: updatedProvider?.wallet?.availableBalance || 0
      }
    });
  } catch (error) {
    if (session) await session.abortTransaction();
    global.logger.error(`[TransactionController.verifyCashReceived] Error: ${error.message}`, error);
    next(error);
  } finally {
    if (session) session.endSession();
    activeRequests.delete(bookingId);
  }
};

const getQRVerificationStatus = async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Valid bookingId is required' });
    }

    const booking = await Booking.findById(bookingId).select('status paymentStatus totalAmount subtotal totalDiscount commissionAmount providerEarnings paymentVerification');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    let verification = booking.paymentVerification ? booking.paymentVerification.toObject() : {};
    if (verification.status === 'waiting_payment' && verification.qrExpiresAt && new Date(verification.qrExpiresAt) < new Date()) {
      verification.status = 'expired';
      booking.paymentVerification.status = 'expired';
      await booking.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        bookingId: booking._id,
        bookingStatus: booking.status,
        paymentStatus: booking.paymentStatus,
        totalAmount: booking.totalAmount,
        paymentVerification: verification
      }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.getQRVerificationStatus] Error: ${error.message}`, error);
    next(error);
  }
};

const adminOverrideCashVerification = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason, remarks } = req.body;
    const adminId = req.admin?._id || req.user?._id;

    if (!reason || !remarks) {
      return res.status(400).json({ success: false, message: 'Reason and remarks are mandatory for admin override.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.paymentVerification = {
      method: 'cash_received',
      status: 'verified',
      verifiedAt: new Date()
    };
    booking.status = 'completed';
    booking.paymentStatus = 'paid';
    booking.completedAt = new Date();

    booking.statusHistory.push({
      status: 'completed',
      timestamp: new Date(),
      note: `[Admin Override] Payment verified manually by Admin ID: ${adminId}. Reason: ${reason}. Remarks: ${remarks}`,
      updatedBy: 'admin'
    });

    await booking.save();

    const auditTx = new Transaction({
      booking: booking._id,
      bookingId: booking.bookingId || booking._id.toString(),
      user: booking.customer,
      provider: booking.provider,
      approvedBy: adminId,
      amount: booking.totalAmount,
      paymentMethod: 'system',
      paymentStatus: 'completed',
      type: 'adjustment',
      ledgerType: 'payment',
      description: `[Admin Override] Payment verified for booking #${booking.bookingId || booking._id}. Reason: ${reason} - ${remarks}`
    });
    await auditTx.save();

    return res.status(200).json({
      success: true,
      message: 'Admin override executed successfully. Booking marked completed.',
      data: { bookingId: booking._id, status: booking.status }
    });
  } catch (error) {
    global.logger.error(`[TransactionController.adminOverrideCashVerification] Error: ${error.message}`, error);
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  handleWebhook,
  getAllTransactions,
  getTransactionById,
  getUnifiedEntityDetails,
  getCustomerTransactions,
  adminRetryVerify,
  adminMarkPaid,
  rollbackWalletDeduction,
  getFinanceOverview,
  getChartTrends,
  getCashLedger,
  getCustomerWallets,
  getProviderWallets,
  getSettlements,
  getRazorpayLogs,
  getFailedPayments,
  getAuditLogs,
  getAdminPaymentDetails,
  getMasterLedger,
  getLedgerDetail,
  generateBookingQR,
  verifyCashReceived,
  getQRVerificationStatus,
  adminOverrideCashVerification
};


