// controllers/paymentController.js
const mongoose = require('mongoose');
const crypto = require('crypto');
const ProviderEarning = require('../models/ProviderEarning-model');
const PaymentRecord = require('../models/PaymentRecord-model');
const Provider = require('../models/Provider-model');
const Booking = require('../models/Booking-model');
const Transaction = require('../models/Transaction-model');
const ExcelJS = require('exceljs');
const { sendNotification, notifyAdmins } = require('../utils/notificationHelper');
const { sendMail } = require('../utils/sendmail');

const bcrypt = require('bcryptjs');

// Helper to mask an email for UI responses (e.g., abcd@gmail.com -> abcd***@gmail.com)
// Always safe to call even if email is missing/invalid.
const maskEmail = (email) => {
  try {
    if (!email || typeof email !== 'string') return '';
    const trimmed = email.trim();
    if (!trimmed.includes('@')) return trimmed;

    const [localPart, domainPart] = trimmed.split('@');
    if (!localPart || !domainPart) return trimmed;

    // Keep first 3 chars of local part, mask the rest
    const head = localPart.slice(0, 3);
    const maskedLocal = head + (localPart.length > 3 ? '***' : '');

    return `${maskedLocal}@${domainPart}`;
  } catch {
    return '';
  }
};


// Helper to sync earnings status based on time and disputes
const syncEarningsStatus = async (providerId) => {
  // We can just call the global release task but filter for this provider
  // Or just let the background task handle it. 
  // For immediate UI update, we'll implement a targeted version.
  const now = new Date();
  const heldEarnings = await ProviderEarning.find({
    provider: providerId,
    status: 'held',
    isHeldByAdmin: false,
    availableAfter: { $lte: now }
  }).populate('booking');

  if (heldEarnings.length === 0) return;

  const session = await mongoose.startSession();
  try {
    for (const earning of heldEarnings) {
      if (earning.booking && !earning.booking.disputeRaised && earning.booking.disputeStatus === 'none') {
        await session.withTransaction(async () => {
          earning.status = 'available';
          await earning.save({ session });

          await Provider.findByIdAndUpdate(
            providerId,
            {
              $inc: { 'wallet.availableBalance': earning.netAmount },
              $set: { 'wallet.lastUpdated': new Date() }
            },
            { session }
          );
        });
      }
    }
  } catch (err) {
    console.error(`Error in syncEarningsStatus for provider ${providerId}:`, err);
  } finally {
    await session.endSession();
  }
};

// Handle Razorpay Webhook
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const bodyData = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)));

    if (!signature) {
      console.error('Webhook Error: Missing signature header');
      return res.status(400).json({ error: 'Missing signature header' });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(bodyData)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error(`[Payment Security Alert] Webhook Error: Invalid signature ${signature}. Expected: ${expectedSignature}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(bodyData.toString());
    const event = payload.event;
    const payment = payload.payload?.payment?.entity;

    if (!payment) {
      console.error('Webhook Error: Missing payment entity');
      return res.status(400).json({ error: 'Invalid payload structure' });
    }

    console.log(`Webhook received: ${event}, Payment ID: ${payment.id}`);

    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payment);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payment);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Handle successful payment
const handlePaymentCaptured = async (payment) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Update Transaction status
      const existingTxn = await Transaction.findOne({ razorpayOrderId: payment.order_id }).session(session);

      if (!existingTxn) {
        console.error(`Transaction not found for order: ${payment.order_id}`);
        throw new Error('Transaction not found');
      }

      // Check for duplicate payment success
      if (existingTxn.paymentStatus === 'completed' || existingTxn.paymentStatus === 'success' || existingTxn.razorpayPaymentId === payment.id) {
        console.log(`Payment already processed for order: ${payment.order_id}`);
        try {
          notifyAdmins(
            'Duplicate Payment Alert',
            `Duplicate payment success received for order ${payment.order_id}, payment ID: ${payment.id}. Already processed.`,
            'payment_alert',
            existingTxn._id
          );
        } catch (e) { }
        return;
      }

      existingTxn.paymentStatus = 'completed';
      existingTxn.razorpayPaymentId = payment.id;
      existingTxn.updatedAt = new Date();
      await existingTxn.save({ session });

      // Update Booking status to confirmed
      const booking = await Booking.findById(existingTxn.booking).session(session);
      if (booking) {
        booking.paymentStatus = 'escrow_hold';
        if (booking.status !== 'accepted' && booking.status !== 'completed' && booking.status !== 'in-progress') {
          booking.status = 'pending';
        }
        booking.updatedAt = new Date();
        await booking.save({ session });
      }

      console.log(`Payment captured: ${payment.id}, Transaction: ${existingTxn._id}`);

      // Notify customer
      try {
        if (booking && booking.customer) {
          sendNotification(
            booking.customer,
            'customer',
            'Payment Successful',
            `Your payment for booking ${booking._id} was successful.`,
            'payment',
            booking._id
          );
        }
      } catch (e) { }

      // Invalidate dashboard caches
      try {


      } catch (e) { }
    });
  } catch (error) {
    console.error('Error handling payment.captured:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};

// Handle failed payment
const handlePaymentFailed = async (payment) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Update Transaction status to failed
      const transaction = await Transaction.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        {
          paymentStatus: 'failed',
          updatedAt: new Date()
        },
        { session, new: true }
      );

      if (!transaction) {
        console.error(`Transaction not found for order: ${payment.order_id}`);
        return;
      }

      // Rollback wallet deduction if mixed payment failed
      const { rollbackWalletDeduction } = require('./Transaction-controller');
      if (rollbackWalletDeduction) {
        await rollbackWalletDeduction(transaction, session);
      }

      await Booking.findOneAndUpdate(
        { _id: transaction.booking },
        { paymentStatus: 'failed', updatedAt: new Date() },
        { session }
      );

      console.log(`Payment failed: ${payment.id}, Transaction: ${transaction._id}`);
    });
  } catch (error) {
    console.error('Error handling payment.failed:', error);
    throw error;
  } finally {
    await session.endSession();
  }
};


// Provider - Get earnings summary
const getEarningsSummary = async (req, res) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.provider._id);

    // Auto-release eligible earnings before calculating summary
    await syncEarningsStatus(providerId);

    const { startDate, endDate } = req.query;

    // Get provider wallet info
    const provider = await Provider.findById(providerId).select('wallet');
    const availableBalance = provider?.wallet?.availableBalance || 0;
    const totalWithdrawn = provider?.wallet?.totalWithdrawn || 0;

    // Base match conditions for lifetime
    const baseMatchConditions = {
      provider: providerId,
      isVisibleToProvider: true
    };

    // Get lifetime earnings
    const lifetimeEarnings = await ProviderEarning.aggregate([
      { $match: baseMatchConditions },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$netAmount' }
        }
      }
    ]);

    const totalEarnings = lifetimeEarnings.length > 0 ? lifetimeEarnings[0].totalEarnings : 0;

    let periodEarnings = totalEarnings;
    let periodWithdrawn = totalWithdrawn;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Period Earnings
      const periodConditions = {
        ...baseMatchConditions,
        createdAt: { $gte: start, $lte: end }
      };

      const periodEarningsResult = await ProviderEarning.aggregate([
        { $match: periodConditions },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$netAmount' }
          }
        }
      ]);
      periodEarnings = periodEarningsResult.length > 0 ? periodEarningsResult[0].totalEarnings : 0;

      // Period Withdrawals
      const withdrawalConditions = {
        provider: providerId,
        status: 'completed',
        createdAt: { $gte: start, $lte: end }
      };

      const withdrawalResult = await PaymentRecord.aggregate([
        { $match: withdrawalConditions },
        {
          $group: {
            _id: null,
            totalWithdrawn: { $sum: '$amount' }
          }
        }
      ]);
      periodWithdrawn = withdrawalResult.length > 0 ? withdrawalResult[0].totalWithdrawn : 0;
    }

    // Get total pending withdrawals
    const pendingWithdrawals = await PaymentRecord.aggregate([
      {
        $match: {
          provider: providerId,
          status: { $in: ['requested', 'processing', 'under_review', 'approved'] }
        }
      },
      {
        $group: {
          _id: null,
          totalPendingWithdrawals: { $sum: '$amount' }
        }
      }
    ]);

    const totalPendingWithdrawals = pendingWithdrawals.length > 0
      ? pendingWithdrawals[0].totalPendingWithdrawals
      : 0;

    // Get held earnings
    const heldEarningsResult = await ProviderEarning.aggregate([
      {
        $match: {
          provider: providerId,
          status: { $in: ['held', 'under_review', 'pending_release'] }
        }
      },
      {
        $group: {
          _id: null,
          totalHeld: { $sum: '$netAmount' }
        }
      }
    ]);
    const totalHeldEarnings = heldEarningsResult.length > 0 ? heldEarningsResult[0].totalHeld : 0;

    // Get dispute count
    const disputeCount = await mongoose.model('Booking').countDocuments({
      provider: providerId,
      disputeRaised: true,
      status: { $ne: 'cancelled' }
    });

    // Get today's earnings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEarningsResult = await ProviderEarning.aggregate([
      {
        $match: {
          ...baseMatchConditions,
          createdAt: { $gte: today, $lt: tomorrow }
        }
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$netAmount' }
        }
      }
    ]);
    const todayEarnings = todayEarningsResult.length > 0 ? todayEarningsResult[0].totalEarnings : 0;

    res.json({
      success: true,
      totalEarnings: periodEarnings,
      lifetimeEarnings: totalEarnings,
      todayEarnings: todayEarnings,
      availableBalance: availableBalance,
      heldAmount: totalHeldEarnings,
      disputeCount: disputeCount,
      totalWithdrawn: periodWithdrawn,
      lifetimeWithdrawn: totalWithdrawn,
      pendingWithdrawals: totalPendingWithdrawals,
      withdrawalSecurity: {
        lastRequestTime: provider.withdrawalSecurity?.lastRequestTime,
        isFlagged: provider.withdrawalSecurity?.isFlagged
      }
    });

  } catch (err) {
    console.error('Earnings summary error:', err);
    res.status(500).json({ success: false, error: 'Server error', details: err.message });
  }
};


// Provider - Request bulk withdrawal (Initiate OTP)
const requestBulkWithdrawal = async (req, res) => {
  try {
    const providerId = req.provider._id;
    const { amount } = req.body;

    // STEP 1: Basic Validations
    if (!amount || isNaN(amount) || amount < 500) {
      return res.status(400).json({ success: false, error: "Minimum withdrawal ₹500" });
    }

    const provider = await Provider.findById(providerId)
      .select("bankDetails name email wallet approved kycStatus withdrawalSecurity fcmTokens isSuspended blockedTill performanceScore");

    if (!provider) return res.status(404).json({ success: false, error: "Provider not found." });

    // SECURITY IMPROVEMENTS: Validate provider status
    if (provider.isSuspended) {
      return res.status(403).json({ success: false, error: "Your account is suspended. You cannot withdraw payments." });
    }

    if (provider.blockedTill && new Date(provider.blockedTill) > new Date()) {
      return res.status(403).json({ success: false, error: "Your account is blocked. You cannot withdraw payments." });
    }

    if (provider.performanceScore?.restrictionsActive) {
      return res.status(403).json({ success: false, error: "Your account is restricted. You cannot withdraw payments." });
    }

    if (!provider.approved || provider.kycStatus !== 'approved') {
      return res.status(403).json({ success: false, error: "Your account/KYC must be approved before withdrawal." });
    }

    if (!provider.bankDetails?.accountNo || !provider.bankDetails?.verified) {
      return res.status(400).json({ success: false, error: "Verified bank details are required." });
    }

    // Check for active disputes or hold
    const activeDispute = await Booking.findOne({
      provider: providerId,
      disputeRaised: true,
      status: { $nin: ['cancelled', 'completed'] }
    });
    if (activeDispute) {
      return res.status(403).json({ success: false, error: "Withdrawal locked due to active dispute. Please resolve it first." });
    }

    // WITHDRAWAL COOLDOWN: 24 hours
    const lastWithdrawal = provider.withdrawalSecurity?.lastRequestTime;
    if (lastWithdrawal) {
      const hoursSinceLast = (new Date() - new Date(lastWithdrawal)) / (1000 * 60 * 60);
      if (hoursSinceLast < 24) {
        return res.status(403).json({ success: false, error: "Please wait 24 hours before making another withdrawal request." });
      }
    }

    // Validate balance and pending requests
    const baseAvailableBalance = provider?.wallet?.availableBalance || 0;
    const pendingWithdrawals = await PaymentRecord.aggregate([
      {
        $match: {
          provider: new mongoose.Types.ObjectId(providerId),
          status: { $in: ['requested', 'processing', 'under_review', 'approved'] }
        }
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalPending = pendingWithdrawals.length > 0 ? pendingWithdrawals[0].total : 0;
    if (totalPending > 0) {
      return res.status(400).json({ success: false, error: "You already have a pending withdrawal request." });
    }

    if (amount > baseAvailableBalance) {
      return res.status(400).json({ success: false, error: "Insufficient balance for withdrawal" });
    }

    // SUSPICIOUS WITHDRAWAL DETECTION
    let isFlagged = false;
    let flagReason = "";

    // CASE 1: Large withdrawal threshold (e.g. > 50,000)
    if (amount > 50000) {
      isFlagged = true;
      flagReason += "Large withdrawal amount. ";
    }

    // CASE 2: Check for multiple OTP attempts (rate limiting)
    if (provider.withdrawalSecurity?.attempts >= 5 && (new Date() - provider.withdrawalSecurity.otpExpires < 30 * 60 * 1000)) {
      return res.status(429).json({ success: false, error: "Too many failed attempts. Try again later." });
    }

    // STEP 2: Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Hash OTP before storing
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    // Update Provider with OTP info
    provider.withdrawalSecurity = {
      otp: hashedOtp,
      otpExpires,
      attempts: 0,
      pendingAmount: amount,
      pendingRequestTime: new Date(),
      isFlagged,
      flagReason
    };
    await provider.save();

    // STEP 3: Send OTP to phone/app first. Email is an explicit fallback from the OTP modal.
    let notificationSent = false;
    const hasRegisteredDevice = Array.isArray(provider.fcmTokens) && provider.fcmTokens.some(t => t?.token);

    // In-app / push notification fallback
    try {
      const notification = await sendNotification(
        providerId,
        'provider',
        'Withdrawal OTP Verification',
        `Your withdrawal OTP is ${otp}. Valid for 5 minutes.`,
        'withdrawal',
        null
      );
      notificationSent = Boolean(notification);
    } catch (e) { console.error("OTP Notification Error:", e); }

    res.json({
      success: true,
      message: hasRegisteredDevice
        ? "OTP sent to your phone/app notification. Use email fallback if you do not receive it."
        : "OTP generated. No registered phone/app device found, please use email fallback.",
      otpExpires: 5 * 60,
      delivery: {
        email: false,
        emailFallbackAvailable: Boolean(provider.email),
        notification: notificationSent,
        phone: hasRegisteredDevice,
        maskedEmail: maskEmail(provider.email)
      }
    });

  } catch (error) {
    console.error("Request Withdrawal Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Provider - Verify Withdrawal OTP and Create Request
const verifyWithdrawalOTP = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const providerId = req.provider._id;
    const { otp } = req.body;

    if (!otp) return res.status(400).json({ success: false, error: "OTP is required" });

    const provider = await Provider.findById(providerId);
    if (!provider || !provider.withdrawalSecurity?.otp) {
      return res.status(400).json({ success: false, error: "No active withdrawal request found." });
    }

    const security = provider.withdrawalSecurity;

    // Validate Expiry
    if (new Date() > security.otpExpires) {
      provider.withdrawalSecurity.otp = undefined;
      await provider.save();
      return res.status(400).json({ success: false, error: "OTP has expired. Please request again." });
    }

    // Validate Attempts
    if (security.attempts >= 5) {
      return res.status(403).json({ success: false, error: "Max attempts reached. Please request a new OTP." });
    }

    // Verify Hash
    const isMatch = await bcrypt.compare(otp, security.otp);
    if (!isMatch) {
      provider.withdrawalSecurity.attempts += 1;
      await provider.save();
      return res.status(400).json({ success: false, error: "Invalid OTP. Remaining attempts: " + (5 - provider.withdrawalSecurity.attempts) });
    }

    // Success - Create the withdrawal request
    await session.withTransaction(async () => {
      const amount = security.pendingAmount;

      // Final balance check
      if (provider.wallet.availableBalance < amount) {
        throw new Error("Insufficient balance");
      }

      // Lock the pending amount immediately upon OTP verification to prevent double-spending/withdrawals
      provider.wallet.availableBalance -= amount;
      provider.wallet.lastUpdated = new Date();

      const paymentRecord = new PaymentRecord({
        provider: providerId,
        amount,
        netAmount: amount,
        paymentMethod: "bank_transfer",
        paymentDetails: {
          accountNumber: provider.bankDetails.accountNo,
          accountName: provider.bankDetails.accountName,
          ifscCode: provider.bankDetails.ifsc,
          bankName: provider.bankDetails.bankName,
        },
        status: security.isFlagged ? 'under_review' : 'requested',
        withdrawalType: 'manual_bulk',
        notes: security.isFlagged ? `Flagged: ${security.flagReason}` : "Manual bulk withdrawal",
        transactionReference: `WDL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      });

      await paymentRecord.save({ session });

      // Clear OTP and update cooldown
      provider.withdrawalSecurity = {
        lastRequestTime: new Date(),
        otp: undefined,
        otpExpires: undefined,
        attempts: 0,
        pendingAmount: 0
      };
      await provider.save({ session });

      // Notify Admin
      if (security.isFlagged) {
        notifyAdmins(
          'Suspicious Withdrawal Alert',
          `Provider ${provider.name} attempted suspicious withdrawal activity. Amount: ₹${amount}. Reason: ${security.flagReason}`,
          'withdrawal_alert',
          paymentRecord._id
        );
      } else {
        notifyAdmins(
          'New Withdrawal Request',
          `Provider ${provider.name} has requested a withdrawal of ₹${amount}.`,
          'withdrawal',
          paymentRecord._id
        );
      }

      res.json({
        success: true,
        message: security.isFlagged ? "Withdrawal request submitted and under security review." : "Withdrawal requested successfully",
        data: {
          reference: paymentRecord.transactionReference,
          status: paymentRecord.status
        }
      });
    });

  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await session.endSession();
  }
};



// Provider - Earnings Report (View or Download Excel)
const downloadEarningsReport = async (req, res) => {
  try {
    const providerId = req.provider._id;

    // Auto-release eligible earnings before fetching report
    await syncEarningsStatus(providerId);

    const { startDate, endDate, download, status, page = 1, limit = 20 } = req.query;

    let filter = { provider: new mongoose.Types.ObjectId(providerId) };

    if (status) {
      if (status === 'held') {
        filter.status = { $in: ['held', 'under_review', 'pending_release'] };
      } else {
        filter.status = status;
      }
    }

    if (download === "true") {
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, error: "Start date and End date are required for download" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end date

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return res.status(400).json({ success: false, error: "Minimum range is 7 days" });
      }
      if (diffDays > 62) {
        return res.status(400).json({ success: false, error: "Maximum range is 2 months" });
      }

      filter.createdAt = { $gte: start, $lte: end };
    }

    // Get total count for pagination
    const total = await ProviderEarning.countDocuments(filter);

    // Modified aggregation with sorting and pagination
    const earnings = await ProviderEarning.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "bookings",
          localField: "booking",
          foreignField: "_id",
          as: "bookingInfo",
        },
      },
      { $unwind: "$bookingInfo" },
      {
        $lookup: {
          from: "paymentrecords",
          localField: "paymentRecord",
          foreignField: "_id",
          as: "paymentInfo",
        },
      },
      { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          paymentMethod: "$bookingInfo.paymentMethod",
          bookingId: "$bookingInfo.bookingId",
          disputeStatus: "$bookingInfo.disputeStatus",
          holdUntil: { $ifNull: ["$availableAfter", { $add: ["$createdAt", 48 * 60 * 60 * 1000] }] },
          holdReason: {
            $cond: [
              { $eq: ["$bookingInfo.disputeRaised", true] },
              "Active customer dispute under admin review",
              {
                $cond: [
                  { $in: ["$status", ["held", "under_review", "pending_release"]] },
                  "48h customer protection window",
                  "$holdReason"
                ]
              }
            ]
          },
          isWithdrawable: {
            $and: [
              { $in: ["$status", ["available", "paid", "withdrawn"]] },
              { $ne: ["$bookingInfo.disputeRaised", true] },
              { $ne: ["$isHeldByAdmin", true] }
            ]
          },
          payoutStatus: {
            $cond: [
              { $eq: ["$bookingInfo.disputeRaised", true] },
              "held",
              {
                $cond: [
                  { $eq: ["$isHeldByAdmin", true] },
                  "held",
                  {
                    $cond: [
                      { $in: ["$status", ["held", "under_review", "pending_release"]] },
                      "held",
                      "$status"
                    ]
                  }
                ]
              }
            ]
          }
        },
      },
      {
        $addFields: {
          // Overlay status with payoutStatus for backward compatibility if needed
          // but we will keep the original status field as well
          displayStatus: "$payoutStatus"
        }
      },
      {
        $sort: { createdAt: -1 } // Sort by latest first
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit)
      },
      {
        $limit: parseInt(limit)
      },
      {
        $project: {
          booking: 1,
          bookingId: 1,
          grossAmount: 1,
          commissionRate: 1,
          commissionAmount: 1,
          netAmount: 1,
          createdAt: 1,
          paymentMethod: 1,
          status: 1,
          payoutStatus: 1,
          displayStatus: 1,
          availableAfter: 1,
          holdUntil: 1,
          disputeStatus: 1,
          holdReason: 1,
          isWithdrawable: 1
        },
      },
    ]);

    if (!earnings.length && page === 1) {
      return res.status(200).json({ success: false, message: "No earnings found" });
    }

    if (download === "true") {
      // For download, get all earnings without pagination
      const allEarnings = await ProviderEarning.aggregate([
        { $match: filter },
        {
          $lookup: {
            from: "bookings",
            localField: "booking",
            foreignField: "_id",
            as: "bookingInfo",
          },
        },
        { $unwind: "$bookingInfo" },
        {
          $lookup: {
            from: "paymentrecords",
            localField: "paymentRecord",
            foreignField: "_id",
            as: "paymentInfo",
          },
        },
        { $unwind: { path: "$paymentInfo", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            paymentMethod: "$bookingInfo.paymentMethod",
            status: {
              $switch: {
                branches: [
                  { case: { $eq: ["$status", "held"] }, then: "Held (48h Review)" },
                  { case: { $eq: ["$status", "available"] }, then: "Available" },
                  { case: { $eq: ["$status", "paid"] }, then: "Paid (Cash)" },
                  { case: { $eq: ["$status", "withdrawn"] }, then: "Withdrawn" },
                  { case: { $eq: ["$status", "cancelled"] }, then: "Cancelled" }
                ],
                default: "Available"
              }
            }
          },
        },
        {
          $sort: { createdAt: -1 } // Sort by latest first
        },
        {
          $project: {
            booking: 1,
            grossAmount: 1,
            commissionRate: 1,
            commissionAmount: 1,
            netAmount: 1,
            createdAt: 1,
            paymentMethod: 1,
            status: 1,
          },
        },
      ]);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Earnings Report");

      worksheet.columns = [
        { header: "Booking ID", key: "booking", width: 25 },
        { header: "Gross Amount (₹)", key: "grossAmount", width: 20 },
        { header: "Commission Rate (%)", key: "commissionRate", width: 20 },
        { header: "Commission Amount (₹)", key: "commissionAmount", width: 20 },
        { header: "Net Amount (₹)", key: "netAmount", width: 20 },
        { header: "Payment Method", key: "paymentMethod", width: 15 },
        { header: "Status", key: "status", width: 15 },
        { header: "Created At", key: "createdAt", width: 25 },
      ];

      allEarnings.forEach((earning) => {
        worksheet.addRow({
          booking: earning.booking?.toString() || "N/A",
          grossAmount: earning.grossAmount || 0,
          commissionRate: earning.commissionRate || 0,
          commissionAmount: earning.commissionAmount || 0,
          netAmount: earning.netAmount || 0,
          paymentMethod: earning.paymentMethod || "unknown",
          status: earning.status || "N/A",
          createdAt: earning.createdAt
            ? new Date(earning.createdAt).toISOString().slice(0, 19).replace("T", " ")
            : "N/A",
        });
      });

      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true };
      });

      res.setHeader("Content-Disposition", `attachment; filename=earnings_report_${startDate}_to_${endDate}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      const buffer = await workbook.xlsx.writeBuffer();
      res.send(buffer);

      console.log("Earnings report generated and sent successfully");
      return;
    } else {
      res.json({ success: true, earnings, total, page: parseInt(page), limit: parseInt(limit) });
    }
  } catch (error) {
    console.error("Error generating earnings report:", error);
    res.status(500).json({ success: false, error: "Failed to generate earnings report" });
  }
};

// Provider - Withdrawal Report (View or Download Excel) 
const downloadWithdrawalReport = async (req, res) => {
  try {
    const providerId = req.provider._id;
    const { startDate, endDate, download } = req.query;

    let filter = { provider: providerId };

    if (download === "true") {
      if (!startDate || !endDate) {
        return res.status(400).json({ success: false, message: "StartDate and EndDate are required for download" });
      }

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return res.status(400).json({ success: false, message: "Minimum range is 7 days" });
      }
      if (diffDays > 62) {
        return res.status(400).json({ success: false, message: "Maximum range is 2 months" });
      }

      filter.createdAt = { $gte: start, $lte: end };
    }

    const records = await PaymentRecord.find(filter).sort({ createdAt: -1 }).lean();

    if (!records.length) {
      return res.status(200).json({ success: true, message: "No withdrawal records found", records: [] });
    }

    if (download === "true") {
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Withdrawal Report");

      // Define columns
      worksheet.columns = [
        { header: "Reference ID", key: "reference", width: 30 },
        { header: "Requested Amount (₹)", key: "amount", width: 20 },
        { header: "Net Amount Paid (₹)", key: "netAmount", width: 20 },
        { header: "Payment Method", key: "paymentMethod", width: 20 },
        { header: "Account Number", key: "accountNumber", width: 25 },
        { header: "IFSC Code", key: "ifscCode", width: 20 },
        { header: "Bank Name", key: "bankName", width: 25 },
        { header: "Status", key: "status", width: 15 },
        { header: "Requested Date", key: "requestedDate", width: 20 },
        { header: "Processed Date", key: "processedDate", width: 25 },
        { header: "Admin Remark / Rejection", key: "remark", width: 40 },
      ];

      // Add header row
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true };
      });

      // Add data rows
      records.forEach((record) => {
        worksheet.addRow({
          reference: record.transactionReference || "N/A",
          amount: record.amount,
          netAmount: record.netAmount || record.amount,
          paymentMethod: record.paymentMethod === "bank_transfer" ? "Bank Transfer" : record.paymentMethod,
          accountNumber: record.paymentDetails?.accountNumber || "N/A",
          ifscCode: record.paymentDetails?.ifscCode || "N/A",
          bankName: record.paymentDetails?.bankName || "N/A",
          status: record.status,
          requestedDate: record.createdAt.toLocaleString('en-IN'),
          processedDate: record.completedAt ? record.completedAt.toLocaleString('en-IN') : "N/A",
          remark: record.adminRemark || record.rejectionReason || "N/A",
        });
      });

      // Set headers
      res.setHeader("Content-Disposition", `attachment; filename=withdrawal_report_${startDate}_to_${endDate}.xlsx`);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      // Use write instead of writeBuffer for better compatibility
      await workbook.xlsx.write(res);

      // End the response after writing
      res.end();

      console.log("Withdrawal report generated and sent successfully");
      return;
    } else {
      res.json({ success: true, records });
    }
  } catch (error) {
    console.error("Error generating withdrawal report:", error);
    res.status(500).json({ success: false, message: "Failed to generate withdrawal report", error: error.message });
  }
};

// Admin  Related Code

// Admin - Get All withdrawal requests
const getAllWithdrawalRequests = async (req, res) => {
  try {
    let { status, page = 1, limit = 10, startDate, endDate, providerSearch, sortBy } = req.query;

    const filter = {};
    if (status) filter.status = status; // requested / processing / completed / rejected

    // Date filter (optional) with validation
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return res.status(400).json({ success: false, error: "Minimum range is 7 days" });
      }
      if (diffDays > 62) {
        return res.status(400).json({ success: false, error: "Maximum range is 2 months" });
      }
      end.setHours(23, 59, 59, 999); // Include the entire end date
      filter.createdAt = {
        $gte: start,
        $lte: end
      };
    }

    const skip = (page - 1) * limit;

    // Calculate one week ago
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Build aggregation pipeline
    let pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: 'providerearnings',
          localField: '_id',
          foreignField: 'paymentRecord',
          as: 'earnings'
        }
      },
      {
        $addFields: {
          earningsCount: { $size: '$earnings' }
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
      { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'admins',
          localField: 'admin',
          foreignField: '_id',
          as: 'admin'
        }
      },
      { $unwind: { path: '$admin', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bookings',
          let: { providerId: '$provider._id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$provider', '$$providerId'] },
                    { $eq: ['$status', 'completed'] },
                    { $gte: ['$createdAt', oneWeekAgo] }
                  ]
                }
              }
            }
          ],
          as: 'bookingsLastWeek'
        }
      },
      {
        $addFields: {
          bookingsLastWeekCount: { $size: '$bookingsLastWeek' }
        }
      }
    ];

    // Add provider search filter
    if (providerSearch) {
      pipeline.push({
        $match: {
          $or: [
            { 'provider.name': { $regex: providerSearch, $options: 'i' } },
            { 'provider.providerId': { $regex: providerSearch, $options: 'i' } },
            { 'provider._id': mongoose.isValidObjectId(providerSearch) ? new mongoose.Types.ObjectId(providerSearch) : null }
          ].filter(Boolean)
        }
      });
    }

    // Add sorting
    let sortStage = { $sort: { createdAt: -1 } }; // default: latest first
    if (sortBy === 'amount_desc') {
      sortStage = { $sort: { amount: -1, createdAt: -1 } }; // highest amount first, then latest
    } else if (sortBy === 'amount_asc') {
      sortStage = { $sort: { amount: 1, createdAt: -1 } }; // lowest amount first, then latest
    } else if (sortBy === 'createdAt_desc') {
      sortStage = { $sort: { createdAt: -1 } }; // newest first
    } else if (sortBy === 'createdAt_asc') {
      sortStage = { $sort: { createdAt: 1 } }; // oldest first
    }
    pipeline.push(sortStage);

    // Add pagination
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $project: {
          'provider.password': 0,
          'provider.createdAt': 0,
          'provider.updatedAt': 0,
          'admin.password': 0,
          'admin.createdAt': 0,
          'admin.updatedAt': 0
        }
      }
    );

    // Get total count (need to apply filters except pagination)
    let countPipeline = pipeline.slice(0, -3); // Remove skip, limit, project
    if (providerSearch) {
      // Add search filter to count pipeline
      countPipeline.push({
        $match: {
          $or: [
            { 'provider.name': { $regex: providerSearch, $options: 'i' } },
            { 'provider._id': mongoose.isValidObjectId(providerSearch) ? new mongoose.Types.ObjectId(providerSearch) : null }
          ].filter(Boolean)
        }
      });
    }
    countPipeline.push({ $count: "total" });

    const [records, countResult] = await Promise.all([
      PaymentRecord.aggregate(pipeline),
      PaymentRecord.aggregate(countPipeline)
    ]);

    const total = countResult.length > 0 ? countResult[0].total : 0;

    return res.status(200).json({
      success: true,
      message: "Withdrawal requests fetched successfully",
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data: records
    });

  } catch (error) {
    console.error("Error fetching withdrawal requests:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Admin - Approve withdrawal request
const approveWithdrawalRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { transactionReference, notes, utrNo, transferDate, transferTime } = req.body;

    // Validate required fields for approval
    if (!transactionReference) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Transaction reference is required" });
    }

    if (!utrNo) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "UTR number is required" });
    }

    if (!transferDate || !transferTime) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Transfer date and time are required" });
    }

    // 1️⃣ Find PaymentRecord with provider populated
    let paymentRecord = await PaymentRecord.findById(id)
      .populate("provider")
      .session(session);

    if (!paymentRecord) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Withdrawal request not found" });
    }

    // Add Safety Checks to prevent duplicate processing
    if (paymentRecord.status === 'completed' || paymentRecord.status === 'transferred') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Withdrawal has already been processed" });
    }

    if (!['requested', 'processing', 'under_review', 'approved'].includes(paymentRecord.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Cannot approve request with status: ${paymentRecord.status}` });
    }

    // 2️⃣ Update payment record with new fields (requested -> under_review -> approved -> transferred -> completed)
    paymentRecord.status = "transferred";
    paymentRecord.transactionReference = transactionReference;
    paymentRecord.utrNo = utrNo;
    paymentRecord.transferDate = new Date(transferDate);
    paymentRecord.transferTime = transferTime;
    paymentRecord.adminRemark = notes || "";
    paymentRecord.admin = req.admin._id;
    paymentRecord.completedAt = new Date();
    await paymentRecord.save({ session });

    // 2.5️⃣ Increment provider's totalWithdrawn (balance was already locked/deducted at OTP verification time)
    const providerDoc = paymentRecord.provider;
    if (!providerDoc.wallet) {
      providerDoc.wallet = { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
    }

    providerDoc.wallet.totalWithdrawn += paymentRecord.amount;
    providerDoc.wallet.lastUpdated = new Date();
    await providerDoc.save({ session });

    // 3️⃣ Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Notify provider about approval
    try {
      sendNotification(
        paymentRecord.provider._id,
        'provider',
        'Withdrawal Approved',
        `Your withdrawal request for ₹${paymentRecord.netAmount} has been approved.`,
        'withdrawal',
        paymentRecord._id
      );
    } catch (err) { /* ignore */ }

    return res.status(200).json({
      success: true,
      message: "Withdrawal request approved successfully",
      data: paymentRecord
    });

  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (_) { }
    session.endSession();
    console.error("Error approving withdrawal:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


// Admin - Reject withdrawal request
const rejectWithdrawalRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { rejectionReason, adminRemark } = req.body;

    // Find the payment record
    const paymentRecord = await PaymentRecord.findById(id).populate("provider").session(session);
    if (!paymentRecord) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Withdrawal request not found" });
    }

    if (!['requested', 'processing', 'under_review'].includes(paymentRecord.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: `Cannot reject a request with status: ${paymentRecord.status}` });
    }

    const provider = paymentRecord.provider;
    if (!provider) {
      throw new Error('Provider not found for this payment record.');
    }

    // Refund the locked withdrawal amount back to the provider's wallet available balance
    if (!provider.wallet) {
      provider.wallet = { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
    }
    provider.wallet.availableBalance += paymentRecord.amount;
    provider.wallet.lastUpdated = new Date();
    await provider.save({ session });

    // Update payment record
    paymentRecord.status = "rejected";
    paymentRecord.rejectionReason = rejectionReason || "No reason provided";
    paymentRecord.adminRemark = adminRemark || "";
    paymentRecord.admin = req.admin._id;
    paymentRecord.completedAt = new Date();
    await paymentRecord.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Notify provider about rejection
    try {
      sendNotification(
        provider._id,
        'provider',
        'Withdrawal Rejected',
        `Your withdrawal request for ₹${paymentRecord.netAmount} was rejected: ${paymentRecord.rejectionReason}`,
        'withdrawal',
        paymentRecord._id
      );
    } catch (err) { /* ignore */ }

    return res.status(200).json({
      success: true,
      message: "Withdrawal request rejected successfully",
      data: paymentRecord
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error rejecting withdrawal:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


// Admin - Generate Withdrawal / Payment Report
const generateWithdrawalReport = async (req, res) => {
  try {
    const { status, fromDate, toDate, page = 1, limit = 100 } = req.query;

    // Validate required date range
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Both fromDate and toDate are required"
      });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    // Ensure min 7 days and max 2 months range
    const diffMs = to - from;
    const minRangeMs = 7 * 24 * 60 * 60 * 1000;    // 7 days
    const maxRangeMs = 62 * 24 * 60 * 60 * 1000; // 62 days

    if (diffMs < minRangeMs || diffMs > maxRangeMs) {
      return res.status(400).json({
        success: false,
        message: "Date range must be between 7 days and 2 months"
      });
    }

    // Build filter
    const filter = {
      createdAt: { $gte: from, $lte: to }
    };
    if (status) {
      filter.status = status;
    }

    // Fetch PaymentRecords with provider details populated
    const records = await PaymentRecord.find(filter)
      .populate('provider', 'name bankDetails providerId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Generate Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Withdrawal Report');

    worksheet.columns = [
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Provider ID', key: 'providerId', width: 25 },
      { header: 'Requested Amount', key: 'amount', width: 15 },
      { header: 'Net Amount Paid', key: 'netAmount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Account Number (Masked)', key: 'accountNumber', width: 25 },
      { header: 'IFSC Code', key: 'ifscCode', width: 20 },
      { header: 'Bank Name', key: 'bankName', width: 25 },
      { header: 'UTR No', key: 'utrNo', width: 25 },
      { header: 'Transfer Date Time', key: 'transferDateTime', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Requested Date', key: 'requestedDate', width: 20 },
      { header: 'Completed Date', key: 'completedDate', width: 20 },
      { header: 'Admin Remark / Rejection Reason', key: 'adminRemark', width: 30 }
    ];

    records.forEach(record => {
      const rawAccount = record.paymentDetails.accountNumber || '';
      const maskedAccount = rawAccount.length > 4 ? 'X'.repeat(rawAccount.length - 4) + rawAccount.slice(-4) : rawAccount;

      worksheet.addRow({
        providerName: record.provider ? record.provider.name : '-',
        providerId: record.provider ? record.provider.providerId : '-',
        amount: record.amount,
        netAmount: record.netAmount,
        paymentMethod: record.paymentMethod,
        accountNumber: maskedAccount,
        ifscCode: record.paymentDetails.ifscCode || '-',
        bankName: record.paymentDetails.bankName || '-',
        utrNo: record.utrNo || '-',
        transferDateTime: record.transferDate && record.transferTime ? new Date(`${record.transferDate.toISOString().split('T')[0]}T${record.transferTime}`).toLocaleString() : '-',
        status: record.status,
        requestedDate: record.createdAt.toLocaleString(),
        completedDate: record.completedAt ? record.completedAt.toLocaleString() : '-',
        adminRemark: record.adminRemark || record.rejectionReason || '-'
      });
    });

    // Send Excel file as response
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=withdrawal_report_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Generate withdrawal report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while generating report',
      error: error.message
    });
  }
};

// Admin - Provider Wise Earnings Report
const generateProviderEarningsReport = async (req, res) => {
  try {
    const { fromDate, toDate, providerId } = req.query;

    // Validate dates
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Both fromDate and toDate are required",
      });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    // Validate min 7 days, max 2 months
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    if (diffDays < 7 || diffDays > 62) {
      return res.status(400).json({
        success: false,
        message: "Date range must be between 7 days and 2 months",
      });
    }

    // Fetch providers
    const providerFilter = { isDeleted: false };
    if (providerId) {
      if (mongoose.isValidObjectId(providerId)) {
        providerFilter._id = providerId;
      } else {
        providerFilter.providerId = providerId;
      }
    }
    const providers = await Provider.find(providerFilter).lean();

    if (!providers.length) {
      return res.status(200).json({
        success: true,
        message: "No providers found",
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Provider Earnings Report");

    worksheet.columns = [
      { header: "Provider ID", key: "providerId", width: 25 },
      { header: "Provider Name", key: "providerName", width: 25 },
      { header: "Total Bookings Completed", key: "totalBookings", width: 20 },
      { header: "Total Earnings (Gross)", key: "totalEarnings", width: 20 },
      { header: "Total Commission", key: "totalCommission", width: 20 },
      { header: "Net Earnings", key: "netEarnings", width: 20 },
      { header: "Total Withdrawn", key: "totalWithdrawn", width: 20 },
      { header: "Balance", key: "pendingBalance", width: 20 },
    ];

    const providerIds = providers.map(p => p._id);

    // 1. Batch Get Earnings Stats from ProviderEarning for all matching providers
    const allEarningStats = await ProviderEarning.aggregate([
      {
        $match: {
          provider: { $in: providerIds },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$provider',
          totalBookings: { $sum: 1 },
          totalGross: { $sum: '$grossAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalNet: { $sum: '$netAmount' }
        }
      }
    ]).lean();

    const earningStatsMap = {};
    allEarningStats.forEach(stat => {
      if (stat._id) {
        earningStatsMap[stat._id.toString()] = stat;
      }
    });

    // 2. Batch Get Withdrawal Stats for all matching providers
    const allWithdrawalStats = await PaymentRecord.aggregate([
      {
        $match: {
          provider: { $in: providerIds },
          status: { $in: ['requested', 'processing', 'under_review', 'approved', 'transferred', 'completed'] },
          type: 'withdrawal',
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { provider: '$provider', status: '$status' },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]).lean();

    const withdrawalStatsMap = {};
    allWithdrawalStats.forEach(stat => {
      const pId = stat._id.provider?.toString();
      const status = stat._id.status;
      if (pId) {
        if (!withdrawalStatsMap[pId]) {
          withdrawalStatsMap[pId] = [];
        }
        withdrawalStatsMap[pId].push({ status, totalAmount: stat.totalAmount });
      }
    });

    for (const provider of providers) {
      const stats = earningStatsMap[provider._id.toString()] || { totalBookings: 0, totalGross: 0, totalCommission: 0, totalNet: 0 };
      const wStats = withdrawalStatsMap[provider._id.toString()] || [];

      const completedWithdrawal = wStats
        .filter(s => ['completed', 'transferred', 'approved'].includes(s.status))
        .reduce((sum, s) => sum + s.totalAmount, 0);

      const pendingWithdrawal = wStats
        .filter(s => ['requested', 'processing', 'under_review'].includes(s.status))
        .reduce((sum, s) => sum + s.totalAmount, 0);

      // Pending Balance (Withdrawable) = Total Net in period - (All Withdrawals in period)
      const pendingBalance = Math.max(0, stats.totalNet - (completedWithdrawal + pendingWithdrawal));

      worksheet.addRow({
        providerId: provider.providerId || 'N/A',
        providerName: provider.name,
        totalBookings: stats.totalBookings,
        totalEarnings: stats.totalGross,
        totalCommission: stats.totalCommission,
        netEarnings: stats.totalNet,
        totalWithdrawn: completedWithdrawal,
        pendingBalance: pendingBalance
      });
    }

    // Send Excel file
    const fileName = `Provider_Earnings_Report_${fromDate}_to_${toDate}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Provider earnings report error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate provider earnings report",
      error: error.message
    });
  }
};

// Admin - Commission Report (Admin Revenue Report)
const getCommissionReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    // Ensure min 7 days, max 2 months (~62 days)
    const diffTime = Math.abs(end - start);
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (diffDays < 7 || diffDays > 62) {
      return res.status(400).json({ success: false, message: 'Date range must be between 7 days and 2 months' });
    }

    // Fetch completed bookings in date range
    const bookings = await Booking.find({
      status: 'completed',
      serviceCompletedAt: { $gte: start, $lte: end }
    })
      .populate('provider', 'name email providerId')
      .populate('services.service', 'title basePrice')
      .lean();

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({ success: true, message: 'No completed bookings in the selected date range' });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Commission Report');

    // Columns
    worksheet.columns = [
      { header: 'Booking ID', key: 'bookingId', width: 25 },
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Provider ID', key: 'providerId', width: 25 },
      { header: 'Service Name', key: 'serviceName', width: 30 },
      { header: 'Service Qty', key: 'serviceQty', width: 10 },
      { header: 'Service Amount', key: 'serviceAmount', width: 15 },
      { header: 'Total Booking Amount', key: 'totalAmount', width: 20 },
      { header: 'Commission (%)', key: 'commissionPercent', width: 15 },
      { header: 'Commission Amount', key: 'commissionAmount', width: 20 },
      { header: 'Date', key: 'date', width: 20 }
    ];

    // Fill data
    bookings.forEach(booking => {
      booking.services.forEach(item => {
        worksheet.addRow({
          bookingId: booking._id.toString(),
          providerName: booking.provider?.name || 'N/A',
          providerId: booking.provider?.providerId || 'N/A',
          serviceName: item.service?.title || 'N/A',
          serviceQty: item.quantity,
          serviceAmount: item.price,
          totalAmount: booking.totalAmount,
          commissionPercent: booking.commissionRule ? ((booking.commissionAmount / booking.totalAmount) * 100).toFixed(2) : 0,
          commissionAmount: booking.commissionAmount,
          date: booking.serviceCompletedAt.toISOString().split('T')[0]
        });
      });
    });

    // Header bold
    worksheet.getRow(1).font = { bold: true };

    // Send Excel file
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Commission_Report_${fromDate}_to_${toDate}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.status(200).end();

  } catch (error) {
    console.error('Error generating commission report:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Admin - Failed / Rejected Withdrawal Report
const failedRejectedWithdrawalsReport = async (req, res) => {
  try {
    const { startDate, endDate, download } = req.query; // download=true for Excel

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);

    if (diffDays < 7) return res.status(400).json({ message: 'Minimum range is 7 days' });
    if (diffDays > 62) return res.status(400).json({ message: 'Maximum range is 2 months' });

    // Fetch records
    const records = await PaymentRecord.find({
      status: { $in: ['failed', 'rejected'] },
      createdAt: { $gte: start, $lte: end }
    }).populate('provider', 'name email').lean();

    if (download === 'true') {
      // Excel download
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('FailedRejectedWithdrawals');

      worksheet.columns = [
        { header: 'Provider Name', key: 'providerName', width: 25 },
        { header: 'Provider ID', key: 'providerId', width: 25 },
        { header: 'Requested Amount', key: 'amount', width: 20 },
        { header: 'Reason for Rejection', key: 'reason', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Requested Date', key: 'requestedAt', width: 20 },
        { header: 'Action Taken Date', key: 'actionDate', width: 20 }
      ];

      records.forEach(record => {
        worksheet.addRow({
          providerName: record.provider ? record.provider.name : 'N/A',
          providerId: record.provider ? record.provider.providerId : 'N/A',
          amount: record.amount,
          reason: record.rejectionReason || record.adminRemark || 'N/A',
          status: record.status,
          requestedAt: record.createdAt.toISOString().slice(0, 10),
          actionDate: record.completedAt ? record.completedAt.toISOString().slice(0, 10) : 'N/A'
        });
      });

      res.setHeader('Content-Disposition', `attachment; filename=failed_rejected_withdrawals_${startDate}_to_${endDate}.xlsx`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      await workbook.xlsx.write(res);
      res.end();

    } else {
      res.json({ success: true, records });
    }
  } catch (error) {
    console.error('Failed rejected withdrawals report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate failed rejected withdrawals report' });
  }
};

// Admin - Provider Ledger Report
const providerLedgerReport = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { fromDate, toDate } = req.query;

    // Validate and fetch provider
    let provider;
    if (mongoose.isValidObjectId(providerId)) {
      provider = await Provider.findById(providerId);
    } else {
      provider = await Provider.findOne({ providerId: providerId });
    }

    if (!provider) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays < 7 || diffDays > 62) {
      return res.status(400).json({ success: false, error: 'Date range must be between 7 days and 2 months' });
    }

    // Get earnings for the provider
    const earnings = await ProviderEarning.aggregate([
      {
        $match: {
          provider: provider._id,
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'booking'
        }
      },
      { $unwind: '$booking' },
      {
        $lookup: {
          from: 'paymentrecords',
          localField: 'paymentRecord',
          foreignField: '_id',
          as: 'paymentInfo',
        },
      },
      { $unwind: { path: '$paymentInfo', preserveNullAndEmptyArrays: true } },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Provider Ledger Report');

    worksheet.columns = [
      { header: 'Provider ID', key: 'providerId', width: 20 },
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Booking ID', key: 'bookingId', width: 25 },
      { header: 'Gross Amount', key: 'grossAmount', width: 15 },
      { header: 'Commission Rate', key: 'commissionRate', width: 15 },
      { header: 'Commission Amount', key: 'commissionAmount', width: 15 },
      { header: 'Net Amount', key: 'netAmount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 }, // cash / online
      { header: 'Withdrawal Linked', key: 'withdrawalLinked', width: 15 },
      { header: 'Withdrawal Reference ID', key: 'withdrawalRef', width: 25 },
      { header: 'Status', key: 'status', width: 15 } // Booking status
    ];

    earnings.forEach(earning => {
      worksheet.addRow({
        providerId: provider.providerId || 'N/A',
        providerName: provider.name,
        date: earning.createdAt.toISOString().slice(0, 10),
        bookingId: earning.booking._id.toString(),
        grossAmount: earning.grossAmount,
        commissionRate: earning.commissionRate,
        commissionAmount: earning.commissionAmount,
        netAmount: earning.netAmount,
        paymentMethod: earning.booking.paymentMethod,
        withdrawalLinked: earning.paymentRecord ? 'Yes' : 'No',
        withdrawalRef: earning.paymentInfo?.transactionReference || '-',
        status: earning.booking.status
      });
    });

    res.setHeader('Content-Disposition', `attachment; filename=provider_ledger_${providerId}_${fromDate}_to_${toDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Provider ledger report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate provider ledger report' });
  }
};

// Admin - Earnings Summary Report
const earningsSummaryReport = async (req, res) => {
  try {
    const { fromDate, toDate, groupBy = 'month', providerId } = req.query;

    let start, end, dateFilter = {};

    if (fromDate && toDate) {
      start = new Date(fromDate);
      end = new Date(toDate);

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 7 || diffDays > 62) {
        return res.status(400).json({ success: false, error: 'Date range must be between 7 days and 2 months' });
      }

      dateFilter = { createdAt: { $gte: start, $lte: end } };
    }

    if (providerId) {
      let resolvedProviderId;
      if (mongoose.isValidObjectId(providerId)) {
        resolvedProviderId = new mongoose.Types.ObjectId(providerId);
      } else {
        const prov = await Provider.findOne({ providerId: providerId }).select('_id');
        if (prov) resolvedProviderId = prov._id;
      }

      if (resolvedProviderId) {
        dateFilter.provider = resolvedProviderId;
      } else {
        return res.status(404).json({ success: false, error: 'Provider not found for filter' });
      }
    }

    let groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };

    if (groupBy === 'week') {
      groupId = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
    }

    // Aggregate earnings
    const summary = await ProviderEarning.aggregate([
      {
        $match: dateFilter
      },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'booking'
        }
      },
      { $unwind: '$booking' },
      { $match: { 'booking.status': 'completed' } },
      {
        $group: {
          _id: groupId,
          totalGross: { $sum: '$grossAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalNet: { $sum: '$netAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Get withdrawals for the same period
    const withdrawals = await PaymentRecord.aggregate([
      {
        $match: {
          status: 'completed',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: groupId,
          totalWithdrawn: { $sum: '$amount' }
        }
      }
    ]);

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Earnings Summary Report');

    worksheet.columns = [
      { header: 'Period', key: 'period', width: 20 },
      { header: 'Total Platform Earnings (Gross)', key: 'totalGross', width: 25 },
      { header: 'Total Provider Earnings (Net)', key: 'totalNet', width: 25 },
      { header: 'Total Commission Earned', key: 'totalCommission', width: 25 },
      { header: 'Total Withdrawals Processed', key: 'totalWithdrawn', width: 25 },
      { header: 'Net Platform Revenue', key: 'netRevenue', width: 20 }
    ];

    summary.forEach(item => {
      const period = groupBy === 'week'
        ? `Week ${item._id.week}, ${item._id.year}`
        : `${item._id.year}-${(item._id.month || 0).toString().padStart(2, '0')}`;

      const withdrawalData = withdrawals.find(w =>
        w._id.year === item._id.year &&
        (groupBy === 'week' ? w._id.week === item._id.week : w._id.month === item._id.month)
      );

      worksheet.addRow({
        period,
        totalGross: item.totalGross,
        totalCommission: item.totalCommission,
        totalNet: item.totalNet,
        totalWithdrawn: withdrawalData ? withdrawalData.totalWithdrawn : 0,
        netRevenue: item.totalCommission // Platform revenue is essentially the commission
      });
    });

    res.setHeader('Content-Disposition', `attachment; filename=earnings_summary_${fromDate}_to_${toDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Earnings summary report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate earnings summary report' });
  }
};

// Admin - Payout History Report
const payoutHistoryReport = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays < 7 || diffDays > 62) {
      return res.status(400).json({ success: false, error: 'Date range must be between 7 days and 2 months' });
    }

    const payouts = await PaymentRecord.find({
      status: 'completed',
      createdAt: { $gte: start, $lte: end }
    }).populate('provider', 'name providerId').populate('admin', 'name').sort({ createdAt: -1 }).lean();

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Payout History Report');

    worksheet.columns = [
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Provider ID', key: 'providerId', width: 25 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Bank Details', key: 'bankDetails', width: 30 },
      { header: 'Transaction Reference', key: 'reference', width: 25 },
      { header: 'Requested Date', key: 'requestedDate', width: 20 },
      { header: 'Processed Date', key: 'completedDate', width: 20 },
      { header: 'Approved By', key: 'approvedBy', width: 20 }
    ];

    payouts.forEach(payout => {
      const bankInfo = payout.paymentDetails
        ? `${payout.paymentDetails.bankName} - ${payout.paymentDetails.accountNumber}`
        : 'N/A';

      worksheet.addRow({
        providerName: payout.provider.name,
        providerId: payout.provider.providerId,
        amount: payout.amount,
        paymentMethod: payout.paymentMethod,
        bankDetails: bankInfo,
        reference: payout.transactionReference,
        requestedDate: payout.createdAt.toISOString().slice(0, 10),
        completedDate: payout.completedAt ? payout.completedAt.toISOString().slice(0, 10) : '',
        approvedBy: payout.admin ? payout.admin.name : 'Admin'
      });
    });

    res.setHeader('Content-Disposition', `attachment; filename=payout_history_${fromDate}_to_${toDate}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Payout history report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate payout history report' });
  }
};

// Admin - Outstanding Balance Report
const outstandingBalanceReport = async (req, res) => {
  try {
    const providers = await Provider.find({ isDeleted: false }).select('name email phone providerId').lean();

    const reportData = [];

    for (const provider of providers) {
      // Calculate available balance
      const availableBalanceResult = await ProviderEarning.aggregate([
        {
          $match: {
            provider: provider._id,
            isVisibleToProvider: true
          }
        },
        {
          $lookup: {
            from: 'bookings',
            localField: 'booking',
            foreignField: '_id',
            as: 'booking'
          }
        },
        { $unwind: '$booking' },
        { $match: { 'booking.status': 'completed' } },
        {
          $group: {
            _id: '$booking.paymentMethod',
            totalNet: { $sum: '$netAmount' },
            totalCommission: { $sum: '$commissionAmount' }
          }
        }
      ]);

      let availableBalance = 0;
      availableBalanceResult.forEach(item => {
        if (item._id === 'online') {
          availableBalance += item.totalNet;
        } else if (item._id === 'cash') {
          availableBalance -= item.totalCommission;
        }
      });
      availableBalance = Math.max(0, availableBalance);

      // Pending withdrawals
      const pendingWithdrawals = await PaymentRecord.aggregate([
        {
          $match: {
            provider: provider._id,
            status: { $in: ['requested', 'processing'] }
          }
        },
        {
          $group: {
            _id: null,
            totalPending: { $sum: '$amount' }
          }
        }
      ]);

      const totalPending = pendingWithdrawals.length > 0 ? pendingWithdrawals[0].totalPending : 0;

      const outstandingBalance = Math.max(0, availableBalance - totalPending);

      // Get last withdrawal date
      const lastWithdrawal = await PaymentRecord.findOne({
        provider: provider._id,
        status: 'completed'
      }).sort({ completedAt: -1 }).lean();

      const lastWithdrawalDate = lastWithdrawal ? lastWithdrawal.completedAt : null;
      const daysPending = lastWithdrawalDate
        ? Math.floor((new Date() - lastWithdrawalDate) / (1000 * 60 * 60 * 24))
        : 'N/A';

      if (outstandingBalance > 0) {
        reportData.push({
          providerId: provider.providerId,
          providerName: provider.name,
          availableBalance: outstandingBalance,
          lastWithdrawalDate: lastWithdrawalDate ? lastWithdrawalDate.toISOString().slice(0, 10) : 'Never',
          daysPending
        });
      }
    }

    // Create Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Outstanding Balance Report');

    worksheet.columns = [
      { header: 'Provider Name', key: 'providerName', width: 25 },
      { header: 'Provider ID', key: 'providerId', width: 25 },
      { header: 'Available Balance', key: 'availableBalance', width: 20 },
      { header: 'Last Withdrawal Date', key: 'lastWithdrawalDate', width: 20 },
      { header: 'Days Pending', key: 'daysPending', width: 15 }
    ];

    reportData.forEach(item => {
      worksheet.addRow(item);
    });

    res.setHeader('Content-Disposition', `attachment; filename=outstanding_balance_report.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Outstanding balance report error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate outstanding balance report' });
  }
};


// Auto-release held earnings after 48 hours
const releaseHeldEarnings = async () => {
  const session = await mongoose.startSession();
  try {
    const now = new Date();
    await session.withTransaction(async () => {
      // Find earnings that are held and ready to be released
      const heldEarnings = await ProviderEarning.find({
        status: 'held',
        availableAfter: { $lte: now }
      }).populate('booking').session(session);

      if (heldEarnings.length === 0) return;

      console.log(`Processing ${heldEarnings.length} held earnings for release...`);

      for (const earning of heldEarnings) {
        // Check if dispute is raised on the booking
        if (earning.booking) {
          if (earning.booking.disputeRaised || earning.booking.disputeStatus === 'pending' || earning.booking.disputeStatus === 'under_review') {
            console.log(`Skipping release for earning ${earning._id} - Dispute Active on booking ${earning.booking._id}`);
            continue;
          }
          if (earning.booking.paymentStatus === 'refunded' || earning.booking.adminRefundDecision === 'approved') {
            console.log(`Cancelling earning ${earning._id} - Booking refunded/approved for refund`);
            await ProviderEarning.findOneAndUpdate(
              { _id: earning._id, status: 'held' },
              { $set: { status: 'cancelled' } },
              { session }
            );
            continue;
          }
        }

        // Atomically lock and update status from 'held' to 'available' to prevent race conditions
        const updatedEarning = await ProviderEarning.findOneAndUpdate(
          { _id: earning._id, status: 'held' },
          { $set: { status: 'available' } },
          { session, new: true }
        );

        if (!updatedEarning) {
          console.log(`Skipping release for earning ${earning._id} - Already processed by another concurrent task.`);
          continue;
        }

        // Update provider wallet
        const provider = await Provider.findById(earning.provider).session(session);
        if (provider) {
          if (!provider.wallet) {
            provider.wallet = { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
          }
          provider.wallet.availableBalance += earning.netAmount;
          provider.wallet.lastUpdated = new Date();
          await provider.save({ session });

          // Notify provider
          try {
            sendNotification(
              provider._id,
              'provider',
              'Earnings Released',
              `Your earning of ₹${earning.netAmount} for booking ${earning.booking?.bookingId || earning.booking?._id} has been released and is now available in your wallet.`,
              'earning_released',
              earning.booking?._id
            );
          } catch (err) { /* ignore */ }
        }
        console.log(`Released earning ${earning._id} to provider ${earning.provider}`);
      }
    });
  } catch (error) {
    console.error('Error in releaseHeldEarnings:', error);
  } finally {
    await session.endSession();
  }
};


module.exports = {
  // Webhook
  handleWebhook,

  // Provider
  getEarningsSummary,
  requestBulkWithdrawal,
  verifyWithdrawalOTP,
  downloadEarningsReport,
  downloadWithdrawalReport,

  // Admin

  getAllWithdrawalRequests,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  generateWithdrawalReport,
  generateProviderEarningsReport,
  getCommissionReport,
  failedRejectedWithdrawalsReport,
  providerLedgerReport,
  earningsSummaryReport,
  payoutHistoryReport,
  outstandingBalanceReport,
  releaseHeldEarnings
};
