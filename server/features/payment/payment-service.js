const mongoose = require('mongoose');
const crypto = require('crypto');
const axios = require('axios');
const ProviderEarning = require('../provider/provider-earning-model');
const PaymentRecord = require('./payment-record-model');
const Provider = require('../provider/provider-model');
const Booking = require('../booking/booking-model');
const Transaction = require('./transaction-model');
const Complaint = require('../complaint/complaint-model');
const { SystemConfig } = require('../system-setting/system-setting-model');
const cache = require('../../shared/utils/cache');
const ExcelJS = require('exceljs');
const { sendNotification, notifyAdmins } = require('../notification/notification-helper');
const { sendMail } = require('../../shared/utils/sendmail');
const bcrypt = require('bcryptjs');

const getCachedSystemConfig = async () => {
  let config = cache.get('system_config');
  if (!config) {
    config = await SystemConfig.findOne().lean();
    if (config) {
      cache.set('system_config', config, 30); // 30 seconds cache TTL
    }
  }
  return config;
};


const withdrawalLocks = new Set();

const safeStartSession = async () => {
  try {
    const session = await mongoose.startSession();
    return session;
  } catch (sessionErr) {
    console.warn("[Transaction Fallback] Failed to start Mongoose session. Standalone MongoDB detected. Running sequential fallback.", sessionErr.message);
    return null;
  }
};

const safeAbort = async (session) => {
  if (session) {
    try {
      await session.abortTransaction();
    } catch (err) {
      console.warn("[Transaction] abort failed:", err.message);
    }
  }
};

const safeCommit = async (session) => {
  if (session) {
    try {
      await session.commitTransaction();
    } catch (err) {
      console.error("[Transaction] commit failed:", err.message);
      throw err;
    }
  }
};

const safeEnd = (session) => {
  if (session) {
    try {
      session.endSession();
    } catch (err) {
      console.warn("[Transaction] end session failed:", err.message);
    }
  }
};

const syncEarningsStatus = async (providerId) => {
  try {
    // ── Four parallel aggregations as single source of truth ─────────────────
    // 1. ProviderEarning: earning lifecycle (held, available, paid, withdrawn…)
    // 2. PaymentRecord:   actual provider payout lifecycle (requested → completed)
    // 3. Deductions:      penalty / refundrecovery / commissiondeduction Transactions
    // 4. OtherCredits:    non-earning wallet credits (topup, referral, cashback,
    //                     adjustment-credit) that are NOT tracked in ProviderEarning.
    //                     These MUST be included or they get silently erased on every sync.
    const [earningsStats, withdrawalsStats, deductionsStats, otherCreditsStats] = await Promise.all([
      ProviderEarning.aggregate([
        { $match: { provider: providerId } },
        {
          $group: {
            _id: '$status',
            totalNet: { $sum: { $ifNull: ['$netAmount', { $ifNull: ['$amount', 0] }] } }
          }
        }
      ]),
      PaymentRecord.aggregate([
        { $match: { provider: providerId } },
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: { $ifNull: ['$amount', 0] } }
          }
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            provider: providerId,
            // Debit-side mutations already applied to wallet during the event.
            // Sync re-derives them from the ledger to remain idempotent.
            // NOTE: 'withdrawal' type is intentionally excluded here because
            // payout amounts are already covered by the PaymentRecord aggregation.
            $or: [
              { type: { $in: ['penalty', 'refundrecovery', 'commissiondeduction'] } },
              { type: 'adjustment', entryType: 'debit' }
            ],
            paymentStatus: { $in: ['completed', 'success', 'paid'] }
          }
        },
        {
          $group: {
            _id: null,
            totalDeducted: { $sum: { $ifNull: ['$amount', 0] } }
          }
        }
      ]),
      Transaction.aggregate([
        {
          $match: {
            provider: providerId,
            // Credit-side wallet events that are NOT part of ProviderEarning lifecycle.
            // 'withdrawalrejection' is intentionally excluded: a rejected PaymentRecord
            // is automatically dropped from totalPendingWithdrawals, so no separate
            // credit is needed — including it here would double-count the refund.
            $or: [
              { type: { $in: ['wallet_topup', 'referralreward', 'cashback', 'referral_coupon_subsidy'] } },
              { type: 'adjustment', entryType: 'credit' }
            ],
            paymentStatus: { $in: ['completed', 'success', 'paid'] }
          }
        },
        {
          $group: {
            _id: null,
            totalCredits: { $sum: { $ifNull: ['$amount', 0] } }
          }
        }
      ])
    ]);

    // ── Process ProviderEarning lifecycle ────────────────────────────────────
    // ACCOUNTING RULE #1: ProviderEarning.status = 'paid' means a CASH booking
    // where the customer paid the provider directly in cash. It is NOT a platform
    // withdrawal. Do NOT count 'paid' earnings toward the available balance or
    // toward totalWithdrawn. Only online/QR earnings that have been released to
    // 'available' status contribute to the derived wallet credit.
    let totalOnlineEarning = 0; // sum of netAmount for 'available' (online/QR released)
    let heldBalance = 0;        // sum of netAmount for 'held'|'underreview'|'pendingrelease'

    earningsStats.forEach((stat) => {
      const amount = stat.totalNet || 0;
      if (stat._id === 'available') {
        // Released online/QR earnings — provider can withdraw this
        totalOnlineEarning += amount;
      } else if (stat._id === 'withdrawn') {
        // Legacy status (same semantics as 'available' for online earnings)
        totalOnlineEarning += amount;
      } else if (stat._id === 'held' || stat._id === 'underreview' || stat._id === 'pendingrelease') {
        heldBalance += amount;
      }
      // 'paid'    → cash booking (provider received cash directly, NOT a platform credit)
      // 'cancelled' → earning voided (refund/dispute). No wallet impact.
      // Both are intentionally excluded from totalOnlineEarning.
    });

    // ── Process PaymentRecord (actual payout) lifecycle ──────────────────────
    // ACCOUNTING RULE #3 / #5: The withdrawal request immediately debits
    // wallet.availableBalance (mutable event). The sync re-derives this by
    // subtracting totalPendingWithdrawals from the base earning.
    // totalWithdrawn = ONLY successfully completed/transferred payouts.
    let totalCompletedWithdrawals = 0;
    let totalPendingWithdrawals = 0;

    withdrawalsStats.forEach((stat) => {
      const amount = stat.totalAmount || 0;
      if (stat._id === 'completed' || stat._id === 'transferred') {
        totalCompletedWithdrawals += amount;
      } else if (['requested', 'processing', 'under_review', 'underreview', 'approved'].includes(stat._id)) {
        totalPendingWithdrawals += amount;
      }
      // 'rejected' / 'failed' → PaymentRecord removed from pending; wallet refunded
      // separately. No subtraction needed here.
    });

    const totalDeductions = deductionsStats.length > 0 ? deductionsStats[0].totalDeducted : 0;
    const totalOtherCredits = otherCreditsStats.length > 0 ? otherCreditsStats[0].totalCredits : 0;

    // ── Derive wallet fields ──────────────────────────────────────────────────
    // Available Balance =
    //   (released online/QR earnings)
    //   + (topups / referral rewards / cashbacks — non-earning credits)
    //   − (completed payouts)
    //   − (pending/reserved payouts)
    //   − (penalties + refund-recoveries + cash-commission deductions)
    //
    // Running this formula 1, 10 or 100 times with no new events produces the
    // same result → fully idempotent.
    const provider = await Provider.findById(providerId);
    if (provider) {
      provider.wallet = provider.wallet || {};
      const newAvailable = parseFloat(
        (totalOnlineEarning + totalOtherCredits - totalCompletedWithdrawals - totalPendingWithdrawals - totalDeductions).toFixed(2)
      );
      const newPending = parseFloat(totalPendingWithdrawals.toFixed(2));
      const newWithdrawn = parseFloat(totalCompletedWithdrawals.toFixed(2));
      const newHeld = parseFloat(heldBalance.toFixed(2));

      const wallet = provider.wallet;
      if (
        wallet.availableBalance !== newAvailable ||
        wallet.pendingWithdrawal !== newPending ||
        wallet.totalWithdrawn !== newWithdrawn ||
        wallet.heldBalance !== newHeld
      ) {
        provider.wallet.availableBalance = newAvailable;
        provider.wallet.pendingWithdrawal = newPending;
        provider.wallet.totalWithdrawn = newWithdrawn;
        provider.wallet.heldBalance = newHeld;
        provider.wallet.lastUpdated = new Date();
        await provider.save();
      }
    }
  } catch (error) {
    console.error(`syncEarningsStatus error for provider ${providerId}:`, error.message);
  }
};

const handlePaymentCaptured = async (payment) => {
  let session = await safeStartSession();
  try {
    if (session) session.startTransaction();
    await executePaymentCapturedOperations(payment, session);
    if (session) await safeCommit(session);
  } catch (error) {
    console.error("[Webhook Error] Transaction aborted for captured payment:", error);
    await safeAbort(session);
  } finally {
    if (session) session.endSession();
  }
};

const executePaymentCapturedOperations = async (payment, session) => {
  const razorpayOrderId = payment.order_id;
  const razorpayPaymentId = payment.id;
  const amount = payment.amount / 100;

  const transaction = await Transaction.findOne({ razorpayOrderId }).session(session);
  if (!transaction) {
    console.error(`Transaction not found for order ${razorpayOrderId}`);
    return;
  }

  if (transaction.paymentStatus === 'paid' || transaction.paymentStatus === 'completed' || (razorpayPaymentId && transaction.razorpayPaymentId === razorpayPaymentId)) {
    console.log(`Transaction ${transaction._id} already processed/paid.`);
    return;
  }

  // Double check if razorpayPaymentId was already recorded on another transaction
  if (razorpayPaymentId) {
    const existingPaymentTx = await Transaction.findOne({ razorpayPaymentId, paymentStatus: { $in: ['paid', 'completed', 'success'] } }).session(session);
    if (existingPaymentTx) {
      console.log(`Payment ID ${razorpayPaymentId} already processed on transaction ${existingPaymentTx._id}.`);
      return;
    }
  }

  transaction.paymentStatus = 'paid';
  transaction.razorpayPaymentId = razorpayPaymentId;
  transaction.completedAt = new Date();
  await transaction.save({ session });

  const booking = await Booking.findById(transaction.booking).session(session);
  if (booking) {
    if (booking.paymentMethod === 'cash' || booking.paymentVerification?.status === 'verified') {
      console.log(`[Webhook Guard] Booking ${booking._id} already settled via cash. Late QR webhook ignored.`);
      return;
    }
    booking.paymentStatus = 'paid';
    booking.status = booking.provider ? 'accepted' : 'pending';
    booking.confirmedBooking = true;
    if (booking.statusHistory) {
      booking.statusHistory.push({
        status: booking.status,
        timestamp: new Date(),
        note: `Payment captured online via Razorpay. Txn: ${razorpayPaymentId}`,
        updatedBy: 'system'
      });
    }
    await booking.save({ session });

    if (booking.provider) {
      await Provider.findByIdAndUpdate(booking.provider, {
        activeBooking: booking._id,
        lastUpdated: new Date()
      }).session(session);

      sendNotification({
        userId: booking.provider,
        role: 'provider',
        title: 'Booking Confirmed',
        message: `A booking (ID: ${booking.bookingId}) has been paid and assigned to you.`,
        type: 'booking',
        referenceId: booking._id,
        eventId: 'provider_assigned',
        idempotencyKey: `provider_assigned:${booking.provider}:${booking._id}`
      });
    }

    sendNotification({
      userId: booking.customer,
      role: 'customer',
      title: 'Payment Successful',
      message: `Your payment of ₹${booking.totalAmount} for booking #${booking.bookingId} was successful.`,
      type: 'booking',
      referenceId: booking._id,
      eventId: 'payment_success',
      idempotencyKey: `payment_success:${booking.customer}:${booking._id}`
    });

    notifyAdmins(
      'New Paid Booking',
      `Booking ${booking.bookingId} is confirmed and paid via Razorpay.`
    );

    autoAssignProviderIfEnabled(booking._id);
  }
};

const autoAssignProviderIfEnabled = async (bookingId) => {
  try {
    const ProviderAssignmentService = require('../booking/provider-assignment-service');
    await ProviderAssignmentService.autoAssignProviderIfEnabled(bookingId);
  } catch (err) {
    console.warn("Auto assignment from payment webhook fallback error:", err.message);
  }
};

const handlePaymentFailed = async (payment) => {
  let session = await safeStartSession();
  try {
    if (session) session.startTransaction();
    await executePaymentFailedOperations(payment, session);
    if (session) await safeCommit(session);
  } catch (error) {
    console.error("[Webhook Error] Transaction aborted for failed payment:", error);
    await safeAbort(session);
  } finally {
    if (session) session.endSession();
  }
};

const executePaymentFailedOperations = async (payment, session) => {
  const razorpayOrderId = payment.order_id;
  const transaction = await Transaction.findOne({ razorpayOrderId }).session(session);
  if (!transaction) return;

  transaction.paymentStatus = 'failed';
  await transaction.save({ session });

  const booking = await Booking.findById(transaction.booking).session(session);
  if (booking) {
    booking.paymentStatus = 'failed';
    if (booking.statusHistory) {
      booking.statusHistory.push({
        status: booking.status,
        timestamp: new Date(),
        note: `Razorpay payment failed for order ${razorpayOrderId}`,
        updatedBy: 'system'
      });
    }
    await booking.save({ session });
  }
};

/* ==========================================
   RazorpayX Hybrid Payout Helper Functions
========================================== */
const getRazorpayXAuth = () => {
  const keyId = process.env.RAZORPAYX_KEY_ID;
  const keySecret = process.env.RAZORPAYX_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return Buffer.from(`${keyId}:${keySecret}`).toString('base64');
};

const ensureRazorpayContact = async (provider) => {
  if (provider.razorpayContactId) return provider.razorpayContactId;
  const auth = getRazorpayXAuth();
  if (!auth) throw new Error("RazorpayX API keys missing in environment variables (.env).");

  try {
    const res = await axios.post('https://api.razorpay.com/v1/contacts', {
      name: provider.name,
      email: provider.email,
      contact: provider.phone || "9999999999",
      type: "vendor",
      reference_id: provider._id.toString()
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    provider.razorpayContactId = res.data.id;
    await provider.save();
    return res.data.id;
  } catch (err) {
    const msg = err.response?.data?.error?.description || err.message;
    throw new Error(`RazorpayX Contact creation failed: ${msg}`);
  }
};

const ensureRazorpayFundAccount = async (provider) => {
  if (provider.bankDetails?.razorpayFundAccountId) {
    return provider.bankDetails.razorpayFundAccountId;
  }
  const contactId = await ensureRazorpayContact(provider);
  const auth = getRazorpayXAuth();
  if (!auth) throw new Error("RazorpayX API keys missing in environment variables (.env).");

  try {
    const res = await axios.post('https://api.razorpay.com/v1/fund_accounts', {
      contact_id: contactId,
      account_type: "bank_account",
      bank_account: {
        name: provider.bankDetails.accountName || provider.name,
        ifsc: provider.bankDetails.ifsc,
        account_number: provider.bankDetails.accountNo
      }
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    provider.bankDetails.razorpayFundAccountId = res.data.id;
    provider.bankDetails.verified = true;
    await provider.save();
    return res.data.id;
  } catch (err) {
    const msg = err.response?.data?.error?.description || err.message;
    throw new Error(`RazorpayX Fund Account creation failed: ${msg}`);
  }
};

const executeRazorpayXPayout = async (paymentRecord, provider, accountNumber) => {
  const auth = getRazorpayXAuth();
  if (!auth) throw new Error("RAZORPAYX_KEY_ID or RAZORPAYX_KEY_SECRET missing in .env");

  const fundAccountId = await ensureRazorpayFundAccount(provider);
  const payoutAccNo = accountNumber || process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!payoutAccNo) throw new Error("RAZORPAYX_ACCOUNT_NUMBER missing in System Settings / .env");

  const res = await axios.post('https://api.razorpay.com/v1/payouts', {
    account_number: payoutAccNo,
    fund_account_id: fundAccountId,
    amount: Math.round(paymentRecord.amount * 100),
    currency: "INR",
    mode: "IMPS",
    purpose: "payout",
    queue_if_low_balance: true,
    reference_id: paymentRecord._id.toString(),
    narration: `Payout ${provider.name}`.substring(0, 30)
  }, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  });

  const payoutData = res.data;
  paymentRecord.withdrawalType = 'razorpayx';
  paymentRecord.status = payoutData.status === 'processed' ? 'completed' : 'processing';
  paymentRecord.utrNo = payoutData.utr || payoutData.id;
  paymentRecord.transactionReference = payoutData.id;
  paymentRecord.processedAt = new Date();
  if (payoutData.status === 'processed') {
    paymentRecord.completedAt = new Date();
    provider.wallet = provider.wallet || { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
    provider.wallet.totalWithdrawn += paymentRecord.amount;
    provider.wallet.lastUpdated = new Date();
    await provider.save();
    await syncEarningsStatus(provider._id);
  }
  await paymentRecord.save();
  return payoutData;
};

const handlePayoutWebhook = async (event, payoutEntity) => {
  if (!payoutEntity) return;
  const payoutId = payoutEntity.id;
  const referenceId = payoutEntity.reference_id;
  const utr = payoutEntity.utr || payoutId;

  let paymentRecord = null;
  if (referenceId && mongoose.Types.ObjectId.isValid(referenceId)) {
    paymentRecord = await PaymentRecord.findById(referenceId).populate('provider');
  }
  if (!paymentRecord && payoutId) {
    paymentRecord = await PaymentRecord.findOne({
      $or: [{ transactionReference: payoutId }, { utrNo: payoutId }]
    }).populate('provider');
  }

  if (!paymentRecord) {
    console.warn(`[Payout Webhook] PaymentRecord not found for payout ${payoutId}`);
    return;
  }

  const provider = paymentRecord.provider;

  if (event === 'payout.processed' || (event === 'payout.updated' && payoutEntity.status === 'processed')) {
    if (paymentRecord.status !== 'completed' && paymentRecord.status !== 'transferred') {
      paymentRecord.status = 'completed';
      paymentRecord.utrNo = utr;
      paymentRecord.completedAt = new Date();
      await paymentRecord.save();

      if (provider) {
        provider.wallet = provider.wallet || { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
        provider.wallet.totalWithdrawn += paymentRecord.amount;
        provider.wallet.lastUpdated = new Date();
        await provider.save();
        await syncEarningsStatus(provider._id);

        sendNotification({
          userId: provider._id,
          role: 'provider',
          title: 'Payout Transferred',
          message: `Your payout of ₹${paymentRecord.amount} has been successfully transferred. UTR: ${utr}`,
          type: 'payout',
          referenceId: paymentRecord._id,
          eventId: 'payout_processed',
          idempotencyKey: `payout_processed:${provider._id}:${paymentRecord._id}:${utr || ''}`
        });
      }
    }
  } else if (['payout.reversed', 'payout.failed', 'payout.rejected'].includes(event) || (event === 'payout.updated' && ['reversed', 'failed', 'rejected'].includes(payoutEntity.status))) {
    if (paymentRecord.status !== 'failed' && paymentRecord.status !== 'rejected') {
      paymentRecord.status = 'failed';
      paymentRecord.lastError = payoutEntity.failure_reason || `Payout ${payoutEntity.status}`;
      paymentRecord.completedAt = new Date();
      await paymentRecord.save();

      // Refund amount back to provider's wallet balance
      if (provider) {
        const balanceBefore = provider.wallet?.availableBalance || 0;
        provider.wallet.availableBalance += paymentRecord.amount;
        const balanceAfter = provider.wallet.availableBalance;
        provider.wallet.lastUpdated = new Date();
        await provider.save();
        await syncEarningsStatus(provider._id);

        await Transaction.create({
          booking: paymentRecord._id,
          bookingId: paymentRecord.transactionReference || `WDL-REV-${Date.now()}`,
          user: provider._id,
          provider: provider._id,
          amount: paymentRecord.amount,
          paymentStatus: 'completed',
          paymentMethod: 'wallet',
          type: 'withdrawalrejection',
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          description: `RazorpayX Payout reversed/failed (${payoutId}). ₹${paymentRecord.amount} refunded to wallet.`
        });

        sendNotification({
          userId: provider._id,
          role: 'provider',
          title: 'Payout Failed / Reversed',
          message: `Your payout of ₹${paymentRecord.amount} failed and has been refunded to your wallet.`,
          type: 'payout',
          referenceId: paymentRecord._id,
          eventId: 'payout_failed',
          idempotencyKey: `payout_failed:${provider._id}:${paymentRecord._id}`
        });
      }
    }
  }
};


class PaymentService {

  static async syncProviderEarnings(providerId) {
    await syncEarningsStatus(providerId);
  }

  static async handleWebhook(req, res) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const bodyData = req.rawBody || (Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body)));

      if (!signature) {
        console.error('Webhook Error: Missing signature header');
        return res.status(400).json({ error: 'Missing signature header' });
      }

      // Verify signature (check RAZORPAYX_WEBHOOK_SECRET first, then fallback to RAZORPAY_WEBHOOK_SECRET)
      const rzpSecret = process.env.RAZORPAYX_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET;
      const expectedSignature = crypto
        .createHmac('sha256', rzpSecret)
        .update(bodyData)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error(`[Payment Security Alert] Webhook Error: Invalid signature ${signature}. Expected: ${expectedSignature}`);
        return res.status(400).json({ error: 'Invalid signature' });
      }

      const payload = JSON.parse(bodyData.toString());
      const event = payload.event;
      const payment = payload.payload?.payment?.entity;
      const payoutEntity = payload.payload?.payout?.entity;

      if (!payment && !payoutEntity) {
        console.error('Webhook Error: Missing payment/payout entity');
        return res.status(400).json({ error: 'Invalid payload structure' });
      }

      const entityId = payment?.id || payoutEntity?.id;

      // Enforce Webhook Idempotency
      const eventId = payload.id || `${event}:${entityId}`;
      try {
        const WebhookIdempotency = mongoose.models.WebhookIdempotency || mongoose.model('WebhookIdempotency', new mongoose.Schema({
          eventId: { type: String, required: true, unique: true },
          processedAt: { type: Date, default: Date.now, expires: 604800 } // TTL: 7 days
        }));
        await WebhookIdempotency.create({ eventId });
      } catch (idempErr) {
        if (idempErr.code === 11000) {
          console.warn(`[Webhook Duplicate] Webhook event ${eventId} already processed. Skipping to prevent duplicates.`);
          return res.status(200).json({ status: 'success', duplicate: true });
        }
        throw idempErr;
      }

      console.log(`Webhook received: ${event}, Entity ID: ${entityId}`);

      if (event.startsWith('payout.')) {
        await handlePayoutWebhook(event, payoutEntity);
      } else {
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
      }

      // Always return 200 to acknowledge receipt
      res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  static async getEarningsSummary(req, res) {
    try {
      const providerId = new mongoose.Types.ObjectId(req.provider._id);

      // Auto-release eligible earnings before calculating summary
      await syncEarningsStatus(providerId);

      const { startDate, endDate } = req.query;

      // Get provider wallet info
      const provider = await Provider.findById(providerId).select('wallet withdrawalSecurity');
      const availableBalance = provider?.wallet?.availableBalance || 0;
      const totalWithdrawn = provider?.wallet?.totalWithdrawn || 0;

      // Base match conditions for lifetime
      const baseMatchConditions = {
        provider: providerId,
        isVisibleToProvider: true
      };

      // ── Lifetime aggregation: both grossBilled and totalEarnings in one pass ──
      const lifetimeResult = await ProviderEarning.aggregate([
        { $match: baseMatchConditions },
        {
          $group: {
            _id: null,
            totalGross: { $sum: '$grossAmount' }, // SUM(grossAmount) — service base billed
            totalNet: { $sum: '$netAmount' }    // SUM(netAmount)   — net provider earnings
          }
        }
      ]);
      const lifetimeGross = lifetimeResult.length > 0 ? lifetimeResult[0].totalGross : 0;
      const lifetimeEarnings = lifetimeResult.length > 0 ? lifetimeResult[0].totalNet : 0;

      // Default period values equal lifetime values (overridden below if period filter given)
      let periodGrossBilled = lifetimeGross;
      let periodEarnings = lifetimeEarnings;
      let periodWithdrawn = totalWithdrawn;

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Period conditions — same boundary applied to BOTH gross and net
        const periodConditions = {
          ...baseMatchConditions,
          createdAt: { $gte: start, $lte: end }
        };

        // Period gross + net in a single pass — guarantees same period boundary
        const periodResult = await ProviderEarning.aggregate([
          { $match: periodConditions },
          {
            $group: {
              _id: null,
              totalGross: { $sum: '$grossAmount' },
              totalNet: { $sum: '$netAmount' }
            }
          }
        ]);
        periodGrossBilled = periodResult.length > 0 ? periodResult[0].totalGross : 0;
        periodEarnings = periodResult.length > 0 ? periodResult[0].totalNet : 0;

        // Period Withdrawals
        const withdrawalResult = await PaymentRecord.aggregate([
          {
            $match: {
              provider: providerId,
              status: { $in: ['completed', 'transferred'] },
              createdAt: { $gte: start, $lte: end }
            }
          },
          { $group: { _id: null, totalWithdrawn: { $sum: '$amount' } } }
        ]);
        periodWithdrawn = withdrawalResult.length > 0 ? withdrawalResult[0].totalWithdrawn : 0;
      }

      // Get total pending withdrawals
      const pendingWithdrawals = await PaymentRecord.aggregate([
        {
          $match: {
            provider: providerId,
            status: { $in: ['requested', 'processing', 'underreview', 'under_review', 'approved'] }
          }
        },
        { $group: { _id: null, totalPendingWithdrawals: { $sum: '$amount' } } }
      ]);
      const totalPendingWithdrawals = pendingWithdrawals.length > 0
        ? pendingWithdrawals[0].totalPendingWithdrawals
        : 0;

      // Get held earnings (netAmount — money still locked)
      const heldEarningsResult = await ProviderEarning.aggregate([
        {
          $match: {
            provider: providerId,
            status: { $in: ['held', 'underreview', 'under_review', 'pendingrelease', 'pending_release'] }
          }
        },
        { $group: { _id: null, totalHeld: { $sum: '$netAmount' } } }
      ]);
      const totalHeldEarnings = heldEarningsResult.length > 0 ? heldEarningsResult[0].totalHeld : 0;

      // Get dispute count
      const disputeCount = await mongoose.model('Booking').countDocuments({
        provider: providerId,
        disputeRaised: true,
        status: { $ne: 'cancelled' }
      });

      // Get today's earnings (netAmount — always fixed to today regardless of period filter)
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
        { $group: { _id: null, totalEarnings: { $sum: '$netAmount' } } }
      ]);
      const todayEarnings = todayEarningsResult.length > 0 ? todayEarningsResult[0].totalEarnings : 0;

      const { SystemConfig } = require('../system-setting/system-setting-model');
      let settings = await SystemConfig.findOne();
      const minWithdrawalLimit = settings?.walletSettings?.minWithdrawal ?? 500;

      res.json({
        success: true,
        // ── Gross Billed: SUM(grossAmount) = service base billed for the period ──
        // NEVER derived from netAmount. Separate backend aggregation.
        grossBilled: periodGrossBilled,
        lifetimeGross: lifetimeGross,
        // ── Net Earnings: SUM(netAmount) = provider's take-home for the period ──
        totalEarnings: periodEarnings,
        lifetimeEarnings: lifetimeEarnings,
        // ── Fixed-window today earnings ──
        todayEarnings: todayEarnings,
        // ── Wallet / withdrawal fields (from syncEarningsStatus + PaymentRecord) ──
        availableBalance: availableBalance,
        heldAmount: totalHeldEarnings,
        pendingWithdrawals: totalPendingWithdrawals,
        totalWithdrawn: periodWithdrawn,
        lifetimeWithdrawn: totalWithdrawn,
        disputeCount: disputeCount,
        minWithdrawalLimit,
        withdrawalSecurity: {
          lastRequestTime: provider.withdrawalSecurity?.lastRequestTime,
          isFlagged: provider.withdrawalSecurity?.isFlagged
        }
      });

    } catch (err) {
      console.error('Earnings summary error:', err);
      res.status(500).json({ success: false, error: 'Server error', details: err.message });
    }
  }


  static async getWeeklyMonthlyStats(req, res) {
    try {
      const providerId = new mongoose.Types.ObjectId(req.provider._id);

      // Get weekly stats (last 4 weeks)
      const today = new Date();
      const fourWeeksAgo = new Date(today);
      fourWeeksAgo.setDate(today.getDate() - 28);

      const weekly = await ProviderEarning.aggregate([
        {
          $match: {
            provider: providerId,
            isVisibleToProvider: true,
            createdAt: { $gte: fourWeeksAgo }
          }
        },
        {
          $group: {
            _id: { $week: "$createdAt" },
            earnings: { $sum: "$netAmount" },
            count: { $sum: 1 },
            minDate: { $min: "$createdAt" }
          }
        },
        { $sort: { minDate: -1 } }
      ]);

      // Format weekly data: e.g. "Week of May 25"
      const formattedWeekly = weekly.map((w, idx) => {
        const date = new Date(w.minDate);
        const formattedDate = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        return {
          week: `Week of ${formattedDate}`,
          earnings: w.earnings || 0,
          count: w.count || 0
        };
      });

      // Get monthly stats (last 6 months)
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(today.getMonth() - 6);

      const monthly = await ProviderEarning.aggregate([
        {
          $match: {
            provider: providerId,
            isVisibleToProvider: true,
            createdAt: { $gte: sixMonthsAgo }
          }
        },
        {
          $group: {
            _id: { $month: "$createdAt" },
            earnings: { $sum: "$netAmount" },
            minDate: { $min: "$createdAt" }
          }
        },
        { $sort: { minDate: 1 } }
      ]);

      const formattedMonthly = monthly.map(m => {
        const date = new Date(m.minDate);
        const formattedMonth = date.toLocaleDateString('en-IN', { month: 'short' });
        return {
          month: formattedMonth,
          earnings: m.earnings || 0
        };
      });

      res.json({
        success: true,
        weekly: formattedWeekly,
        monthly: formattedMonthly
      });
    } catch (err) {
      console.error('Failed to get weekly/monthly stats:', err);
      res.status(500).json({ success: false, error: 'Server error', details: err.message });
    }
  }

  static async requestBulkWithdrawal(req, res) {
    const providerId = req.provider._id;
    const lockKey = providerId.toString();

    if (withdrawalLocks.has(lockKey)) {
      return res.status(429).json({ success: false, error: "A withdrawal request is already in progress. Please wait." });
    }

    withdrawalLocks.add(lockKey);

    try {
      const { amount } = req.body;

      // Recalculate/sync balance before validation to prevent stale checks
      await syncEarningsStatus(providerId);

      // Fetch minimum withdrawal from system settings
      const { SystemConfig } = require('../system-setting/system-setting-model');
      let settings = await SystemConfig.findOne();
      if (!settings) {
        settings = new SystemConfig({ companyName: 'Raj Electrical Services' });
        await settings.save();
      }
      const minWithdrawalLimit = settings?.payoutSettings?.minWithdrawalAmount ?? settings?.walletSettings?.minWithdrawal ?? 500;
      const maxWithdrawalLimit = settings?.payoutSettings?.maxWithdrawalAmount ?? 100000;

      // STEP 1: Basic Validations
      if (!amount || isNaN(amount) || amount < minWithdrawalLimit) {
        return res.status(400).json({ success: false, error: `Minimum withdrawal limit is ₹${minWithdrawalLimit}` });
      }
      if (amount > maxWithdrawalLimit) {
        return res.status(400).json({ success: false, error: `Maximum withdrawal limit is ₹${maxWithdrawalLimit}` });
      }

      const provider = await Provider.findById(providerId)
        .select("bankDetails name email wallet approved kycStatus withdrawalSecurity fcmDevices isSuspended blockedTill performanceScore");

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

      const isBankVerified = Boolean(
        provider.bankDetails?.bankVerificationStatus === 'verified' &&
        provider.bankDetails?.verified === true &&
        provider.bankDetails?.payoutEnabled === true
      );

      if (!provider.bankDetails?.accountNo || !isBankVerified) {
        return res.status(400).json({
          success: false,
          error: "Verified bank details are required. Bank verification is pending or rejected."
        });
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

      // WITHDRAWAL COOLDOWN: configurable hours (admin-controlled via system settings)
      const cooldownEnabled = settings?.payoutSettings?.safetyCooldownEnabled ?? true;
      if (cooldownEnabled) {
        const cooldownHours = settings?.payoutSettings?.safetyCooldownHours ?? 24;
        const lastPaymentRecord = await PaymentRecord.findOne(
          { provider: new mongoose.Types.ObjectId(providerId) },
          { createdAt: 1 },
          { sort: { createdAt: -1 } }
        ).lean();
        if (lastPaymentRecord) {
          const hoursSinceLast = (new Date() - new Date(lastPaymentRecord.createdAt)) / (1000 * 60 * 60);
          if (hoursSinceLast < cooldownHours) {
            const hoursRemaining = Math.ceil(cooldownHours - hoursSinceLast);
            return res.status(403).json({ success: false, error: `Please wait ${hoursRemaining} hour(s) before making another withdrawal request.` });
          }
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

      // STEP 2: Execute Instant Withdrawal Request (Bypassing OTP generation/sending)
      // PRODUCTION FIX
      const session = await safeStartSession();
      try {
        const executeWithdrawalOps = async (currSession) => {
          // Atomic conditional update to lock pending amount and prevent concurrent double-spending
          const updateQuery = {
            _id: providerId,
            'wallet.availableBalance': { $gte: amount }
          };
          const updateOps = {
            $inc: { 'wallet.availableBalance': -amount },
            $set: {
              'wallet.lastUpdated': new Date(),
              'withdrawalSecurity.lastRequestTime': new Date(),
              'withdrawalSecurity.attempts': 0,
              'withdrawalSecurity.pendingAmount': 0
            }
          };
          const updatedProvider = currSession
            ? await Provider.findOneAndUpdate(updateQuery, updateOps, { new: true, session: currSession })
            : await Provider.findOneAndUpdate(updateQuery, updateOps, { new: true });

          if (!updatedProvider) {
            throw new Error("Insufficient available balance or concurrent withdrawal request in progress.");
          }

          const balanceAfter = updatedProvider.wallet.availableBalance;
          const balanceBefore = balanceAfter + amount;

          const preferred = provider.bankDetails?.preferredMethod || 'bank_account';
          const paymentRecord = new PaymentRecord({
            provider: providerId,
            amount,
            netAmount: amount,
            paymentMethod: preferred === 'upi' ? 'upi' : 'banktransfer',
            paymentDetails: preferred === 'upi' ? {
              upiId: provider.bankDetails.upiId,
              accountName: provider.bankDetails.accountName || provider.name,
            } : {
              accountNumber: provider.bankDetails.accountNo,
              accountName: provider.bankDetails.accountName,
              ifscCode: provider.bankDetails.ifsc,
              bankName: provider.bankDetails.bankName,
            },
            status: isFlagged ? 'under_review' : 'requested',
            withdrawalType: 'manual_bulk',
            notes: isFlagged ? `Flagged: ${flagReason}` : "Manual bulk withdrawal",
            transactionReference: `WDL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          });

          if (currSession) {
            await paymentRecord.save({ session: currSession });
          } else {
            await paymentRecord.save();
          }

          // Log withdrawal transaction for provider ledger history
          const withdrawalTx = new Transaction({
            booking: paymentRecord._id, // fallback reference to paymentRecord ID
            bookingId: paymentRecord.transactionReference || `WDL-${Date.now()}`,
            user: provider._id,
            provider: providerId,
            amount: amount,
            paymentStatus: 'completed',
            paymentMethod: 'wallet',
            type: 'withdrawal',
            ledgerType: 'withdrawal',
            entryType: 'debit',
            balanceBefore: balanceBefore,
            balanceAfter: balanceAfter,
            deductionType: 'payout_withdrawal',
            description: `Payout withdrawal request of ₹${amount} initiated (${paymentRecord.transactionReference})`
          });
          if (currSession) {
            await withdrawalTx.save({ session: currSession });
          } else {
            await withdrawalTx.save();
          }

          // Notify Admin
          if (isFlagged) {
            notifyAdmins(
              'Suspicious Withdrawal Alert',
              `Provider ${provider.name} attempted suspicious withdrawal activity. Amount: ₹${amount}. Reason: ${flagReason}`,
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
            message: isFlagged ? "Withdrawal request submitted and under security review." : "Withdrawal requested successfully",
            data: {
              reference: paymentRecord.transactionReference,
              status: paymentRecord.status
            }
          });
        };

        if (session) {
          await session.withTransaction(async () => {
            await executeWithdrawalOps(session);
          });
        } else {
          await executeWithdrawalOps(null);
        }
      } finally {
        if (session) {
          await session.endSession();
        }
      }

    } catch (error) {
      console.error("Request Withdrawal Error:", error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      withdrawalLocks.delete(lockKey);
    }
  }

  static async verifyWithdrawalOTP(req, res) {
    const session = await safeStartSession();
    try {
      const providerId = req.provider._id;
      await syncEarningsStatus(providerId);
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
      const executeWithdrawalRequest = async (currSession) => {
        const amount = security.pendingAmount;

        // Atomic conditional update to lock pending amount and prevent concurrent double-spending
        const updateQuery = {
          _id: providerId,
          'wallet.availableBalance': { $gte: amount }
        };
        const updateOps = {
          $inc: { 'wallet.availableBalance': -amount },
          $set: { 'wallet.lastUpdated': new Date() }
        };
        const updatedProvider = currSession
          ? await Provider.findOneAndUpdate(updateQuery, updateOps, { new: true, session: currSession })
          : await Provider.findOneAndUpdate(updateQuery, updateOps, { new: true });

        if (!updatedProvider) {
          throw new Error("Insufficient available balance or concurrent withdrawal request in progress.");
        }

        const balanceAfter = updatedProvider.wallet.availableBalance;
        const balanceBefore = balanceAfter + amount;

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

        if (currSession) {
          await paymentRecord.save({ session: currSession });
        } else {
          await paymentRecord.save();
        }

        // Log withdrawal transaction for provider ledger history
        const withdrawalTx = new Transaction({
          booking: paymentRecord._id,
          bookingId: paymentRecord.transactionReference || `WDL-${Date.now()}`,
          user: provider._id,
          provider: providerId,
          amount: amount,
          paymentStatus: 'completed',
          paymentMethod: 'wallet',
          type: 'withdrawal',
          balanceBefore: balanceBefore,
          balanceAfter: balanceAfter,
          deductionType: 'payout_withdrawal',
          description: `Payout withdrawal request of ₹${amount} initiated (${paymentRecord.transactionReference})`
        });
        if (currSession) {
          await withdrawalTx.save({ session: currSession });
        } else {
          await withdrawalTx.save();
        }

        // Clear OTP and update cooldown
        provider.withdrawalSecurity = {
          lastRequestTime: new Date(),
          otp: undefined,
          otpExpires: undefined,
          attempts: 0,
          pendingAmount: 0
        };
        if (currSession) {
          await provider.save({ session: currSession });
        } else {
          await provider.save();
        }

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
      };

      if (session) {
        await session.withTransaction(async () => {
          await executeWithdrawalRequest(session);
        });
      } else {
        await executeWithdrawalRequest(null);
      }

    } catch (error) {
      console.error("Verify OTP Error:", error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  static async downloadEarningsReport(req, res) {
    try {
      const providerId = req.provider._id;

      // Auto-release eligible earnings before fetching report
      await syncEarningsStatus(providerId);

      const { startDate, endDate, download, status, page = 1, limit = 20 } = req.query;

      let filter = { provider: new mongoose.Types.ObjectId(providerId) };

      if (status) {
        if (status === 'held') {
          filter.status = { $in: ['held', 'underreview', 'pendingrelease'] };
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

        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          filter.createdAt = { $gte: start, $lte: end };
        }
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
          $lookup: {
            from: "systemconfigs",
            pipeline: [
              { $limit: 1 },
              { $project: { surgeSplitSettings: 1, commissionSettings: 1 } }
            ],
            as: "systemSettings"
          }
        },
        {
          $unwind: { path: "$systemSettings", preserveNullAndEmptyArrays: true }
        },
        {
          $addFields: {
            paymentMethod: "$bookingInfo.paymentMethod",
            bookingId: "$bookingInfo.bookingId",
            disputeStatus: "$bookingInfo.disputeStatus",
            holdUntil: {
              $ifNull: [
                "$availableAfter",
                {
                  $add: [
                    "$createdAt",
                    {
                      $multiply: [
                        { $ifNull: ["$systemSettings.commissionSettings.payoutHoldHours", 48] },
                        60 * 60 * 1000
                      ]
                    }
                  ]
                }
              ]
            },
            holdReason: {
              $cond: [
                { $eq: ["$bookingInfo.disputeRaised", true] },
                "Active customer dispute under admin review",
                {
                  $cond: [
                    { $in: ["$status", ["held", "underreview", "pendingrelease"]] },
                    {
                      $concat: [
                        { $toString: { $ifNull: ["$systemSettings.commissionSettings.payoutHoldHours", 48] } },
                        "h customer protection window"
                      ]
                    },
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
                        { $in: ["$status", ["held", "underreview", "pendingrelease"]] },
                        "held",
                        "$status"
                      ]
                    }
                  ]
                }
              ]
            },
            surgeSplitSettings: {
              $ifNull: [
                "$bookingInfo.surgeSplitSettings",
                {
                  $ifNull: [
                    "$systemSettings.surgeSplitSettings",
                    { visiting: 60, rain: 70, traffic: 70, night: 70, demand: 50, emergency: 85 }
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
            isWithdrawable: 1,
            // Backend-authoritative breakdown fields — frontend uses these directly, no recalculation
            baseAmount: "$grossAmount",                         // service price = commission base
            providerSurgeShare: "$bookingInfo.providerSurgeShare",     // provider's surcharge/bonus share
            subtotal: "$bookingInfo.subtotal",
            totalDiscount: "$bookingInfo.totalDiscount",
            // Raw surcharge fields retained for reference/download only — NOT for frontend recalculation
            visitingCharge: "$bookingInfo.visitingCharge",
            rainCharge: "$bookingInfo.rainCharge",
            trafficCharge: "$bookingInfo.trafficCharge",
            nightCharge: "$bookingInfo.nightCharge",
            demandSurge: "$bookingInfo.demandSurge",
            customCharges: "$bookingInfo.customCharges",
            platformFee: "$bookingInfo.platformFee"
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
              bookingId: "$bookingInfo.bookingId",
              grossAmount: 1,
              commissionRate: 1,
              commissionAmount: "$bookingInfo.commissionAmount",
              netAmount: 1,
              createdAt: 1,
              paymentMethod: 1,
              status: 1,
              subtotal: "$bookingInfo.subtotal",
              totalDiscount: "$bookingInfo.totalDiscount",
              visitingCharge: "$bookingInfo.visitingCharge",
              rainCharge: "$bookingInfo.rainCharge",
              trafficCharge: "$bookingInfo.trafficCharge",
              nightCharge: "$bookingInfo.nightCharge",
              demandSurge: "$bookingInfo.demandSurge",
              platformFee: "$bookingInfo.platformFee",
              customCharges: "$bookingInfo.customCharges",
              providerEarnings: "$bookingInfo.providerEarnings",
              companySurgeShare: "$bookingInfo.companySurgeShare",
            },
          },
        ]);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Earnings Report");

        worksheet.columns = [
          { header: "Booking ID", key: "bookingId", width: 25 },
          { header: "Base Subtotal (₹)", key: "subtotal", width: 20 },
          { header: "Coupon Discount (₹)", key: "totalDiscount", width: 20 },
          { header: "Net Service Amount (₹)", key: "netServiceAmount", width: 20 },
          { header: "Service Commission (%)", key: "commissionRate", width: 20 },
          { header: "Service Commission Amount (₹)", key: "commissionAmount", width: 25 },
          { header: "Visiting Surcharge (₹)", key: "visitingCharge", width: 20 },
          { header: "Rain Surcharge (₹)", key: "rainCharge", width: 20 },
          { header: "Traffic Surcharge (₹)", key: "trafficCharge", width: 20 },
          { header: "Night Surcharge (₹)", key: "nightCharge", width: 20 },
          { header: "Demand Surge Surcharge (₹)", key: "demandSurge", width: 20 },
          { header: "Platform Fee Surcharge (₹)", key: "platformFee", width: 20 },
          { header: "Final Provider Receivable (₹)", key: "providerEarnings", width: 25 },
          { header: "Total Surcharge (₹)", key: "totalSurcharge", width: 25 },
          { header: "Payment Method", key: "paymentMethod", width: 15 },
          { header: "Status", key: "status", width: 20 },
          { header: "Created At", key: "createdAt", width: 25 },
        ];

        allEarnings.forEach((earning) => {
          const grossBilled = earning.grossAmount || 0;
          const baseSubtotal = earning.subtotal || 0;
          const discount = earning.totalDiscount || 0;
          const netService = Math.max(0, baseSubtotal - discount);
          const commRate = earning.commissionRate || 0;
          const commAmt = earning.commissionAmount || 0;

          const visiting = earning.visitingCharge || 0;
          const rain = earning.rainCharge || 0;
          const traffic = earning.trafficCharge || 0;
          const night = earning.nightCharge || 0;
          const demand = earning.demandSurge || 0;
          const platform = earning.platformFee || 0;
          const custom = earning.customCharges || 0;

          const providerReceivable = earning.providerEarnings ?? earning.netAmount ?? 0;
          const totalSurcharge = parseFloat((visiting + rain + traffic + night + demand + platform + custom).toFixed(2));

          worksheet.addRow({
            bookingId: earning.bookingId || earning.booking?.toString() || "N/A",
            subtotal: baseSubtotal,
            totalDiscount: discount,
            netServiceAmount: netService,
            commissionRate: commRate,
            commissionAmount: commAmt,
            visitingCharge: visiting,
            rainCharge: rain,
            trafficCharge: traffic,
            nightCharge: night,
            demandSurge: demand,
            platformFee: platform,
            providerEarnings: providerReceivable,
            totalSurcharge: totalSurcharge,
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
  }

  static async downloadWithdrawalReport(req, res) {
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

        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          filter.createdAt = { $gte: start, $lte: end };
        }
      }

      const records = await PaymentRecord.find(filter)
        .sort({ createdAt: -1 })
        .populate('provider', 'providerId')
        .populate('booking', 'bookingId')
        .lean();

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
          { header: "Provider ID", key: "providerId", width: 25 },
          { header: "Booking ID", key: "bookingId", width: 25 },
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
            providerId: record.provider?.providerId || "N/A",
            bookingId: record.booking?.bookingId || "N/A",
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
  }

  static async getAllWithdrawalRequests(req, res) {
    try {
      let { status, page = 1, limit = 10, startDate, endDate, providerSearch, sortBy, zoneIds } = req.query;

      const filter = {};
      if (status) filter.status = status; // requested / processing / completed / rejected

      if (zoneIds) {
        const zoneIdsArray = zoneIds.split(',');
        const providers = await Provider.find({ currentZone: { $in: zoneIdsArray } }).select('_id').lean();
        const providerIds = providers.map(p => p._id);
        filter.provider = { $in: providerIds };
      }

      // Date filter (optional) with validation
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          filter.createdAt = {
            $gte: start,
            $lte: end
          };
        }
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
      let countPipeline = pipeline.slice(0, -3);
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
  }

  static async approveWithdrawalRequest(req, res) {
    const session = await safeStartSession();
    if (session) {
      session.startTransaction();
    }

    try {
      const { id } = req.params;
      const { transactionReference, notes, utrNo, transferDate, transferTime } = req.body;

      // 1️⃣ Find PaymentRecord with provider populated
      let paymentRecordQuery = PaymentRecord.findById(id).populate("provider");
      let paymentRecord = session ? await paymentRecordQuery.session(session) : await paymentRecordQuery;

      if (!paymentRecord) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(404).json({ success: false, message: "Withdrawal request not found" });
      }

      if (paymentRecord.isHeld) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: `Withdrawal request is on hold: ${paymentRecord.holdReason || 'Administrative hold'}` });
      }

      // Add Safety Checks to prevent duplicate processing
      if (paymentRecord.status === 'completed' || paymentRecord.status === 'transferred') {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: "Withdrawal has already been processed" });
      }

      if (!['requested', 'processing', 'under_review', 'approved'].includes(paymentRecord.status)) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: `Cannot approve request with status: ${paymentRecord.status}` });
      }

      const settings = await SystemConfig.findOne().lean();
      const isRazorpayXEnabled = Boolean(settings?.payoutSettings?.razorpayxEnabled && process.env.RAZORPAYX_KEY_ID);

      if (isRazorpayXEnabled) {
        // --- Automatic RazorpayX Payout Flow ---
        await safeCommit(session);
        safeEnd(session);

        try {
          const payoutRes = await executeRazorpayXPayout(paymentRecord, paymentRecord.provider, settings?.payoutSettings?.razorpayxAccountNumber);
          return res.status(200).json({
            success: true,
            message: "RazorpayX payout initiated successfully",
            data: payoutRes
          });
        } catch (payoutErr) {
          console.error("RazorpayX Payout execution error:", payoutErr);
          paymentRecord.lastError = payoutErr.message;
          paymentRecord.status = 'failed';
          await paymentRecord.save();
          if (paymentRecord.provider?._id) {
            await syncEarningsStatus(paymentRecord.provider._id);
          }
          return res.status(500).json({
            success: false,
            message: `RazorpayX payout failed: ${payoutErr.message}`
          });
        }
      }

      // --- Manual Offline Transfer Flow (Default) ---
      if (!transactionReference) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: "Transaction reference is required for manual approval" });
      }

      if (!utrNo) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: "UTR number is required for manual approval" });
      }

      if (!transferDate || !transferTime) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: "Transfer date and time are required for manual approval" });
      }

      paymentRecord.status = "transferred";
      paymentRecord.withdrawalType = "manual_bulk";
      paymentRecord.transactionReference = transactionReference;
      paymentRecord.utrNo = utrNo;
      paymentRecord.transferDate = new Date(transferDate);
      paymentRecord.transferTime = transferTime;
      paymentRecord.adminRemark = notes || "";
      paymentRecord.admin = req.admin._id;
      paymentRecord.completedAt = new Date();
      if (session) {
        await paymentRecord.save({ session });
      } else {
        await paymentRecord.save();
      }

      const providerDoc = paymentRecord.provider;
      if (!providerDoc.wallet) {
        providerDoc.wallet = { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
      }

      providerDoc.wallet.totalWithdrawn += paymentRecord.amount;
      providerDoc.wallet.lastUpdated = new Date();
      if (session) {
        await providerDoc.save({ session });
      } else {
        await providerDoc.save();
      }

      await safeCommit(session);
      safeEnd(session);

      // Recalculate/sync balance immediately
      await syncEarningsStatus(paymentRecord.provider._id);

      try {
        sendNotification(
          paymentRecord.provider._id,
          'provider',
          'Withdrawal Approved',
          `Your withdrawal request for ₹${paymentRecord.netAmount} has been approved.`,
          'withdrawal',
          paymentRecord._id
        );
        await sendMail({
          to: paymentRecord.provider.email,
          templateType: 'withdrawApproved',
          variables: {
            name: paymentRecord.provider.name,
            withdrawAmount: paymentRecord.netAmount,
            remark: notes || '',
            date: new Date().toLocaleDateString()
          }
        });
      } catch (err) { /* ignore */ }

      return res.status(200).json({
        success: true,
        message: "Withdrawal request approved successfully via manual transfer",
        data: paymentRecord
      });

    } catch (error) {
      await safeAbort(session);
      safeEnd(session);
      console.error("Error approving withdrawal:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message
      });
    }
  }

  // Enterprise Feature: Retry Failed RazorpayX Payout
  static async retryFailedPayout(req, res) {
    try {
      const { id } = req.params;
      const paymentRecord = await PaymentRecord.findById(id).populate('provider');
      if (!paymentRecord) return res.status(404).json({ success: false, message: 'Withdrawal record not found' });
      if (paymentRecord.status !== 'failed') {
        return res.status(400).json({ success: false, message: `Only failed payouts can be retried. Current status: ${paymentRecord.status}` });
      }

      const settings = await SystemConfig.findOne().lean();
      const maxAttempts = settings?.payoutSettings?.retryMaxAttempts || 3;
      if (paymentRecord.retryCount >= maxAttempts) {
        return res.status(400).json({ success: false, message: `Maximum retry attempts (${maxAttempts}) reached for this payout.` });
      }

      paymentRecord.retryCount += 1;
      paymentRecord.status = 'processing';
      paymentRecord.lastError = null;
      await paymentRecord.save();

      try {
        const payoutRes = await executeRazorpayXPayout(paymentRecord, paymentRecord.provider, settings?.payoutSettings?.razorpayxAccountNumber);
        return res.status(200).json({
          success: true,
          message: "Payout retried successfully",
          data: payoutRes
        });
      } catch (err) {
        paymentRecord.status = 'failed';
        paymentRecord.lastError = err.message;
        await paymentRecord.save();
        return res.status(500).json({
          success: false,
          message: `Payout retry failed: ${err.message}`
        });
      }
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Enterprise Feature: Administrative Hold
  static async holdPayout(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const paymentRecord = await PaymentRecord.findById(id);
      if (!paymentRecord) return res.status(404).json({ success: false, message: 'Withdrawal record not found' });

      paymentRecord.isHeld = true;
      paymentRecord.holdReason = reason || 'Administrative hold';
      await paymentRecord.save();

      return res.status(200).json({
        success: true,
        message: 'Payout request placed on hold',
        data: paymentRecord
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Enterprise Feature: Release Administrative Hold
  static async releasePayout(req, res) {
    try {
      const { id } = req.params;
      const paymentRecord = await PaymentRecord.findById(id);
      if (!paymentRecord) return res.status(404).json({ success: false, message: 'Withdrawal record not found' });

      paymentRecord.isHeld = false;
      paymentRecord.holdReason = null;
      await paymentRecord.save();

      return res.status(200).json({
        success: true,
        message: 'Payout request hold released',
        data: paymentRecord
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // Enterprise Feature: Auto-Scheduler & Cron Poller for Stuck Payouts
  static async reconcileStuckPayouts(req, res) {
    try {
      const auth = getRazorpayXAuth();
      if (!auth) {
        const msg = "RazorpayX API keys not configured in environment variables.";
        if (res) return res.status(400).json({ success: false, message: msg });
        return { success: false, message: msg };
      }

      // Find processing payouts older than 30 minutes
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
      const stuckPayouts = await PaymentRecord.find({
        withdrawalType: 'razorpayx',
        status: 'processing',
        updatedAt: { $lt: thirtyMinsAgo }
      }).populate('provider');

      let reconciledCount = 0;
      for (const payoutRecord of stuckPayouts) {
        if (!payoutRecord.transactionReference) continue;
        try {
          const apiRes = await axios.get(`https://api.razorpay.com/v1/payouts/${payoutRecord.transactionReference}`, {
            headers: { 'Authorization': `Basic ${auth}` }
          });
          const payoutEntity = apiRes.data;
          await handlePayoutWebhook(payoutEntity.status === 'processed' ? 'payout.processed' : `payout.${payoutEntity.status}`, payoutEntity);
          reconciledCount++;
        } catch (err) {
          console.warn(`[Reconciler] Error checking payout ${payoutRecord.transactionReference}:`, err.message);
        }
      }

      const result = { success: true, reconciledCount, totalChecked: stuckPayouts.length };
      if (res) return res.status(200).json(result);
      return result;
    } catch (error) {
      if (res) return res.status(500).json({ success: false, message: error.message });
      return { success: false, error: error.message };
    }
  }

  static async rejectWithdrawalRequest(req, res) {
    const session = await safeStartSession();
    if (session) {
      session.startTransaction();
    }

    try {
      const { id } = req.params;
      const { rejectionReason, adminRemark } = req.body;

      // Find the payment record
      let paymentRecordQuery = PaymentRecord.findById(id).populate("provider");
      const paymentRecord = session ? await paymentRecordQuery.session(session) : await paymentRecordQuery;
      if (!paymentRecord) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(404).json({ success: false, message: "Withdrawal request not found" });
      }

      if (!['requested', 'processing', 'under_review'].includes(paymentRecord.status)) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: `Cannot reject a request with status: ${paymentRecord.status}` });
      }

      const provider = paymentRecord.provider;
      if (!provider) {
        throw new Error('Provider not found for this payment record.');
      }

      // Refund the locked withdrawal amount back to the provider's wallet available balance atomically
      const updatedProvider = session
        ? await Provider.findOneAndUpdate(
            { _id: provider._id },
            {
              $inc: { 'wallet.availableBalance': paymentRecord.amount },
              $set: { 'wallet.lastUpdated': new Date() }
            },
            { new: true, session }
          )
        : await Provider.findOneAndUpdate(
            { _id: provider._id },
            {
              $inc: { 'wallet.availableBalance': paymentRecord.amount },
              $set: { 'wallet.lastUpdated': new Date() }
            },
            { new: true }
          );

      const balanceAfter = updatedProvider?.wallet?.availableBalance || 0;
      const balanceBefore = balanceAfter - paymentRecord.amount;

      // Update payment record
      paymentRecord.status = "rejected";
      paymentRecord.rejectionReason = rejectionReason || "No reason provided";
      paymentRecord.adminRemark = adminRemark || "";
      paymentRecord.admin = req.admin._id;
      paymentRecord.completedAt = new Date();
      if (session) {
        await paymentRecord.save({ session });
      } else {
        await paymentRecord.save();
      }

      // Log withdrawal rejection transaction for provider audit visibility
      const rejectionTx = new Transaction({
        booking: paymentRecord._id,
        bookingId: paymentRecord.transactionReference || `WDL-REJ-${Date.now()}`,
        user: provider._id,
        provider: provider._id,
        amount: paymentRecord.amount,
        paymentStatus: 'completed',
        paymentMethod: 'wallet',
        type: 'withdrawalrejection',
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        approvedBy: req.admin ? req.admin._id : null,
        description: `Withdrawal request (${paymentRecord.transactionReference || paymentRecord._id}) rejected. ₹${paymentRecord.amount} refunded to wallet. Reason: ${rejectionReason || 'No reason provided'}`
      });
      if (session) {
        await rejectionTx.save({ session });
      } else {
        await rejectionTx.save();
      }

      await safeCommit(session);
      safeEnd(session);

      // Recalculate/sync balance immediately
      await syncEarningsStatus(provider._id);

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
        await sendMail({
          to: provider.email,
          templateType: 'withdrawRejected',
          variables: {
            name: provider.name,
            withdrawAmount: paymentRecord.amount,
            reason: paymentRecord.rejectionReason,
            date: new Date().toLocaleDateString()
          }
        });
      } catch (err) { /* ignore */ }

      return res.status(200).json({
        success: true,
        message: "Withdrawal request rejected successfully",
        data: paymentRecord
      });

    } catch (error) {
      await safeAbort(session);
      safeEnd(session);
      console.error("Error rejecting withdrawal:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
        error: error.message
      });
    }
  }

  static async generateWithdrawalReport(req, res) {
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

      // Ensure min 1 day and max 1 year range
      const diffMs = to - from;
      const minRangeMs = 1 * 24 * 60 * 60 * 1000;    // 1 day
      const maxRangeMs = 366 * 24 * 60 * 60 * 1000; // 366 days

      if (diffMs < minRangeMs || diffMs > maxRangeMs) {
        return res.status(400).json({
          success: false,
          message: "Date range must be between 1 day and 1 year"
        });
      }

      // Build filter
      const filter = {
        createdAt: { $gte: from, $lte: to }
      };
      if (status) {
        filter.status = status;
      }
      if (req.query.zoneIds) {
        const zones = req.query.zoneIds.split(',');
        const providers = await Provider.find({ currentZone: { $in: zones } }).select('_id').lean();
        const providerIds = providers.map(p => p._id);
        filter.provider = { $in: providerIds };
      }
      if (req.query.providerId) {
        const prov = await Provider.findOne({
          $or: [
            { providerId: req.query.providerId },
            { _id: mongoose.isValidObjectId(req.query.providerId) ? req.query.providerId : null }
          ].filter(Boolean)
        }).select('_id');
        filter.provider = prov ? prov._id : null;
      }

      // Fetch PaymentRecords with provider details populated
      const records = await PaymentRecord.find(filter)
        .populate('provider', 'name bankDetails providerId')
        .populate({
          path: 'booking',
          select: 'bookingId complaint',
          populate: {
            path: 'complaint',
            select: 'complaintId'
          }
        })
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
        { header: 'Booking ID', key: 'bookingId', width: 25 },
        { header: 'Complaint ID', key: 'complaintId', width: 25 },
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
          bookingId: record.booking ? (record.booking.bookingId || record.booking._id.toString()) : '-',
          complaintId: (record.booking && record.booking.complaint) ? (record.booking.complaint.complaintId || '-') : '-',
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
  }

  static async generateProviderEarningsReport(req, res) {
    try {
      let { fromDate, toDate, providerId } = req.query;

      // Provide default date range (last 30 days) if not supplied
      const now = new Date();
      if (!fromDate) {
        const defaultFrom = new Date(now);
        defaultFrom.setDate(defaultFrom.getDate() - 30);
        fromDate = defaultFrom.toISOString().split('T')[0];
      }
      if (!toDate) {
        toDate = now.toISOString().split('T')[0];
      }

      // Parse dates
      const start = new Date(fromDate);
      const end = new Date(toDate);
      // Ensure proper range limits (1 day to 1 year)
      const diffDays = (end - start) / (1000 * 60 * 60 * 24);
      if (diffDays < 1 || diffDays > 366) {
        return res.status(400).json({
          success: false,
          message: "Date range must be between 1 day and 1 year",
        });
      }

      // Duplicate date parsing removed

      // Fetch providers – if providerId is supplied filter accordingly, otherwise get all active providers
      const providerFilter = { isDeleted: false };
      if (providerId) {
        if (mongoose.isValidObjectId(providerId)) {
          providerFilter._id = providerId;
        } else {
          providerFilter.providerId = providerId;
        }
      }
      if (req.query.zoneIds) {
        const zones = req.query.zoneIds.split(',');
        providerFilter.currentZone = { $in: zones };
      }
      const providers = await Provider.find(providerFilter).lean();
      if (!providers.length) {
        return res.status(200).json({ success: true, message: "No providers found for the given criteria" });
      }

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
        { header: "Booking IDs", key: "bookingIds", width: 40 },
        { header: "Complaint IDs", key: "complaintIds", width: 40 },
        { header: "Total Bookings Completed", key: "totalBookings", width: 20 },
        { header: "Total Earnings (Gross)", key: "totalEarnings", width: 20 },
        { header: "Total Commission", key: "totalCommission", width: 20 },
        { header: "Net Earnings", key: "netEarnings", width: 20 },
        { header: "Total Withdrawn", key: "totalWithdrawn", width: 20 },
        { header: "Balance", key: "pendingBalance", width: 20 },
        { header: "Total Discount Given", key: "totalDiscount", width: 20 },
        { header: "Visiting Charge", key: "visitingCharge", width: 20 },
        { header: "Rain Charge", key: "rainCharge", width: 20 },
        { header: "Traffic Charge", key: "trafficCharge", width: 20 },
        { header: "Night Charge", key: "nightCharge", width: 20 },
        { header: "Demand Surge", key: "demandSurge", width: 20 },
        { header: "Platform Fee", key: "platformFee", width: 20 },
        { header: "Provider Surge Share", key: "providerSurgeShare", width: 20 },
        { header: "Platform Surge Share", key: "companySurgeShare", width: 20 },
        { header: "Refunded Amount", key: "refundAmount", width: 20 },
        { header: "Platform Fee Retained", key: "platformFeeRetained", width: 20 }
      ];

      const providerIds = providers.map(p => p._id);

      let custId = null;
      if (req.query.customerId) {
        const cust = await User.findOne({
          $or: [
            { customerId: req.query.customerId },
            { _id: mongoose.isValidObjectId(req.query.customerId) ? req.query.customerId : null }
          ].filter(Boolean)
        }).select('_id');
        if (cust) custId = cust._id;
      }

      // 1. Batch Get Earnings Stats from ProviderEarning for all matching providers
      const allEarningStats = await ProviderEarning.aggregate([
        {
          $match: {
            provider: { $in: providerIds },
            createdAt: { $gte: start, $lte: end }
          }
        },
        {
          $lookup: {
            from: 'bookings',
            localField: 'booking',
            foreignField: '_id',
            as: 'bookingInfo'
          }
        },
        { $unwind: { path: '$bookingInfo', preserveNullAndEmptyArrays: true } },
        ...(custId ? [{ $match: { 'bookingInfo.user': custId } }] : []),
        {
          $lookup: {
            from: 'complaints',
            localField: 'bookingInfo.complaint',
            foreignField: '_id',
            as: 'complaintInfo'
          }
        },
        { $unwind: { path: '$complaintInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$provider',
            totalBookings: { $sum: 1 },
            totalGross: { $sum: '$grossAmount' },
            totalCommission: { $sum: '$commissionAmount' },
            totalNet: { $sum: '$netAmount' },
            totalDiscount: { $sum: { $ifNull: ['$bookingInfo.totalDiscount', 0] } },
            visitingCharge: { $sum: { $ifNull: ['$bookingInfo.visitingCharge', 0] } },
            rainCharge: { $sum: { $ifNull: ['$bookingInfo.rainCharge', 0] } },
            trafficCharge: { $sum: { $ifNull: ['$bookingInfo.trafficCharge', 0] } },
            nightCharge: { $sum: { $ifNull: ['$bookingInfo.nightCharge', 0] } },
            demandSurge: { $sum: { $ifNull: ['$bookingInfo.demandSurge', 0] } },
            platformFee: { $sum: { $ifNull: ['$bookingInfo.platformFee', 0] } },
            providerSurgeShare: { $sum: { $ifNull: ['$bookingInfo.providerSurgeShare', 0] } },
            companySurgeShare: { $sum: { $ifNull: ['$bookingInfo.companySurgeShare', 0] } },
            refundAmount: { $sum: { $add: [{ $ifNull: ['$bookingInfo.cancellationProgress.refundAmount', 0] }, { $ifNull: ['$bookingInfo.refundAmount', 0] }] } },
            platformFeeRetained: { $sum: { $ifNull: ['$bookingInfo.platformFeeRetained', 0] } },
            bookingIds: { $addToSet: { $ifNull: ['$bookingInfo.bookingId', { $toString: '$bookingInfo._id' }] } },
            complaintIds: { $addToSet: '$complaintInfo.complaintId' }
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

      const COMPLETED_STATUSES = new Set(['completed', 'transferred', 'approved']);
      const PENDING_STATUSES = new Set(['requested', 'processing', 'under_review']);

      for (const provider of providers) {
        const stats = earningStatsMap[provider._id.toString()] || {
          totalBookings: 0,
          totalGross: 0,
          totalCommission: 0,
          totalNet: 0,
          totalDiscount: 0,
          visitingCharge: 0,
          rainCharge: 0,
          trafficCharge: 0,
          nightCharge: 0,
          demandSurge: 0,
          platformFee: 0,
          providerSurgeShare: 0,
          companySurgeShare: 0,
          refundAmount: 0,
          platformFeeRetained: 0,
          bookingIds: [],
          complaintIds: []
        };
        const wStats = withdrawalStatsMap[provider._id.toString()] || [];

        const completedWithdrawal = wStats
          .filter(s => COMPLETED_STATUSES.has(s.status))
          .reduce((sum, s) => sum + s.totalAmount, 0);

        const pendingWithdrawal = wStats
          .filter(s => PENDING_STATUSES.has(s.status))
          .reduce((sum, s) => sum + s.totalAmount, 0);

        // Pending Balance (Withdrawable) = Total Net in period - (All Withdrawals in period)
        const pendingBalance = Math.max(0, stats.totalNet - (completedWithdrawal + pendingWithdrawal));

        worksheet.addRow({
          providerId: provider.providerId || 'N/A',
          providerName: provider.name,
          bookingIds: stats.bookingIds ? stats.bookingIds.filter(Boolean).join(', ') : '-',
          complaintIds: stats.complaintIds ? stats.complaintIds.filter(Boolean).join(', ') : '-',
          totalBookings: stats.totalBookings,
          totalEarnings: stats.totalGross,
          totalCommission: stats.totalCommission,
          netEarnings: stats.totalNet,
          totalWithdrawn: completedWithdrawal,
          pendingBalance: pendingBalance,
          totalDiscount: stats.totalDiscount,
          visitingCharge: stats.visitingCharge,
          rainCharge: stats.rainCharge,
          trafficCharge: stats.trafficCharge,
          nightCharge: stats.nightCharge,
          demandSurge: stats.demandSurge,
          platformFee: stats.platformFee,
          providerSurgeShare: stats.providerSurgeShare,
          companySurgeShare: stats.companySurgeShare,
          refundAmount: stats.refundAmount,
          platformFeeRetained: stats.platformFeeRetained
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
  }

  static async getCommissionReport(req, res) {
    try {
      const { fromDate, toDate } = req.query;

      if (!fromDate || !toDate) {
        return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
      }

      const start = new Date(fromDate);
      const end = new Date(toDate);

      // Ensure min 1 day, max 1 year (~366 days)
      const diffTime = Math.abs(end - start);
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays < 1 || diffDays > 366) {
        return res.status(400).json({ success: false, message: 'Date range must be between 1 day and 1 year' });
      }

      // Fetch completed bookings in date range
      const filter = {
        status: 'completed',
        serviceCompletedAt: { $gte: start, $lte: end }
      };
      if (req.query.zoneIds) {
        const zones = req.query.zoneIds.split(',');
        filter.zoneId = { $in: zones };
      }
      if (req.query.providerId) {
        const prov = await Provider.findOne({
          $or: [
            { providerId: req.query.providerId },
            { _id: mongoose.isValidObjectId(req.query.providerId) ? req.query.providerId : null }
          ].filter(Boolean)
        }).select('_id');
        filter.provider = prov ? prov._id : null;
      }
      if (req.query.customerId) {
        const cust = await User.findOne({
          $or: [
            { customerId: req.query.customerId },
            { _id: mongoose.isValidObjectId(req.query.customerId) ? req.query.customerId : null }
          ].filter(Boolean)
        }).select('_id');
        filter.user = cust ? cust._id : null;
      }
      const bookings = await Booking.find(filter)
        .populate('provider', 'name email providerId')
        .populate('services.service', 'title basePrice')
        .populate('complaint', 'complaintId')
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
        { header: 'Complaint ID', key: 'complaintId', width: 25 },
        { header: 'Provider Name', key: 'providerName', width: 25 },
        { header: 'Provider ID', key: 'providerId', width: 25 },
        { header: 'Service Name', key: 'serviceName', width: 30 },
        { header: 'Service Qty', key: 'serviceQty', width: 10 },
        { header: 'Service Amount', key: 'serviceAmount', width: 15 },
        { header: 'Total Booking Amount', key: 'totalAmount', width: 20 },
        { header: 'Commission (%)', key: 'commissionPercent', width: 15 },
        { header: 'Commission Amount', key: 'commissionAmount', width: 20 },
        { header: 'Date', key: 'date', width: 20 },
        { header: 'Total Discount Given', key: 'totalDiscount', width: 20 },
        { header: 'Visiting Charge', key: 'visitingCharge', width: 20 },
        { header: 'Rain Charge', key: 'rainCharge', width: 20 },
        { header: 'Traffic Charge', key: 'trafficCharge', width: 20 },
        { header: 'Night Charge', key: 'nightCharge', width: 20 },
        { header: 'Demand Surge', key: 'demandSurge', width: 20 },
        { header: 'Platform Fee', key: 'platformFee', width: 20 },
        { header: 'Provider Surge Share', key: 'providerSurgeShare', width: 20 },
        { header: 'Platform Surge Share', key: 'companySurgeShare', width: 20 },
        { header: 'Refunded Amount', key: 'refundAmount', width: 20 },
        { header: 'Platform Fee Retained', key: 'platformFeeRetained', width: 20 }
      ];

      // Fill data
      bookings.forEach(booking => {
        booking.services.forEach(item => {
          worksheet.addRow({
            bookingId: booking.bookingId || booking._id.toString(),
            complaintId: booking.complaint?.complaintId || '-',
            providerName: booking.provider?.name || 'N/A',
            providerId: booking.provider?.providerId || 'N/A',
            serviceName: item.service?.title || 'N/A',
            serviceQty: item.quantity,
            serviceAmount: item.price,
            totalAmount: booking.totalAmount,
            commissionPercent: booking.commissionRule ? ((booking.commissionAmount / booking.totalAmount) * 100).toFixed(2) : 0,
            commissionAmount: booking.commissionAmount,
            date: booking.serviceCompletedAt.toISOString().split('T')[0],
            totalDiscount: booking.totalDiscount || 0,
            visitingCharge: booking.visitingCharge || 0,
            rainCharge: booking.rainCharge || 0,
            trafficCharge: booking.trafficCharge || 0,
            nightCharge: booking.nightCharge || 0,
            demandSurge: booking.demandSurge || 0,
            platformFee: booking.platformFee || 0,
            providerSurgeShare: booking.providerSurgeShare || 0,
            companySurgeShare: booking.companySurgeShare || 0,
            refundAmount: booking.refundAmount || booking.cancellationProgress?.refundAmount || 0,
            platformFeeRetained: booking.platformFeeRetained || 0
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
  }

  static async failedRejectedWithdrawalsReport(req, res) {
    try {
      const { startDate, endDate, download } = req.query; // download=true for Excel

      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'startDate and endDate are required' });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffDays = (end - start) / (1000 * 60 * 60 * 24);

      if (diffDays < 1) return res.status(400).json({ message: 'Minimum range is 1 day' });
      if (diffDays > 366) return res.status(400).json({ message: 'Maximum range is 1 year' });

      // Fetch records
      const filter = {
        status: { $in: ['failed', 'rejected'] },
        createdAt: { $gte: start, $lte: end }
      };
      if (req.query.zoneIds) {
        const zones = req.query.zoneIds.split(',');
        const providers = await Provider.find({ currentZone: { $in: zones } }).select('_id').lean();
        const providerIds = providers.map(p => p._id);
        filter.provider = { $in: providerIds };
      }
      const records = await PaymentRecord.find(filter).populate('provider', 'name email').lean();

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
  }

  static async providerLedgerReport(req, res) {
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
      if (diffDays < 1 || diffDays > 366) {
        return res.status(400).json({ success: false, error: 'Date range must be between 1 day and 1 year' });
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
            from: 'complaints',
            localField: 'booking.complaint',
            foreignField: '_id',
            as: 'complaintInfo'
          }
        },
        { $unwind: { path: '$complaintInfo', preserveNullAndEmptyArrays: true } },
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
        { header: 'Complaint ID', key: 'complaintId', width: 25 },
        { header: 'Gross Amount', key: 'grossAmount', width: 15 },
        { header: 'Commission Rate', key: 'commissionRate', width: 15 },
        { header: 'Commission Amount', key: 'commissionAmount', width: 15 },
        { header: 'Net Amount', key: 'netAmount', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 }, // cash / online
        { header: 'Withdrawal Linked', key: 'withdrawalLinked', width: 15 },
        { header: 'Withdrawal Reference ID', key: 'withdrawalRef', width: 25 },
        { header: 'Status', key: 'status', width: 15 }, // Booking status
        { header: 'Total Discount Given', key: 'totalDiscount', width: 20 },
        { header: 'Visiting Charge', key: 'visitingCharge', width: 20 },
        { header: 'Rain Charge', key: 'rainCharge', width: 20 },
        { header: 'Traffic Charge', key: 'trafficCharge', width: 20 },
        { header: 'Night Charge', key: 'nightCharge', width: 20 },
        { header: 'Demand Surge', key: 'demandSurge', width: 20 },
        { header: 'Platform Fee', key: 'platformFee', width: 20 },
        { header: 'Provider Surge Share', key: 'providerSurgeShare', width: 20 },
        { header: 'Platform Surge Share', key: 'companySurgeShare', width: 20 },
        { header: 'Refunded Amount', key: 'refundAmount', width: 20 },
        { header: 'Platform Fee Retained', key: 'platformFeeRetained', width: 20 }
      ];

      earnings.forEach(earning => {
        worksheet.addRow({
          providerId: provider.providerId || 'N/A',
          providerName: provider.name,
          date: earning.createdAt.toISOString().slice(0, 10),
          bookingId: earning.booking.bookingId || earning.booking._id.toString(),
          complaintId: earning.complaintInfo?.complaintId || '-',
          grossAmount: earning.grossAmount,
          commissionRate: earning.commissionRate,
          commissionAmount: earning.commissionAmount,
          netAmount: earning.netAmount,
          paymentMethod: earning.booking.paymentMethod,
          withdrawalLinked: earning.paymentRecord ? 'Yes' : 'No',
          withdrawalRef: earning.paymentInfo?.transactionReference || '-',
          status: earning.booking.status,
          totalDiscount: earning.booking.totalDiscount || 0,
          visitingCharge: earning.booking.visitingCharge || 0,
          rainCharge: earning.booking.rainCharge || 0,
          trafficCharge: earning.booking.trafficCharge || 0,
          nightCharge: earning.booking.nightCharge || 0,
          demandSurge: earning.booking.demandSurge || 0,
          platformFee: earning.booking.platformFee || 0,
          providerSurgeShare: earning.booking.providerSurgeShare || 0,
          companySurgeShare: earning.booking.companySurgeShare || 0,
          refundAmount: earning.booking.refundAmount || earning.booking.cancellationProgress?.refundAmount || 0,
          platformFeeRetained: earning.booking.platformFeeRetained || 0
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
  }

  static async earningsSummaryReport(req, res) {
    try {
      const { fromDate, toDate, groupBy = 'month', providerId } = req.query;

      let start, end, dateFilter = {};

      if (fromDate && toDate) {
        start = new Date(fromDate);
        end = new Date(toDate);

        const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays < 1 || diffDays > 366) {
          return res.status(400).json({ success: false, error: 'Date range must be between 1 day and 1 year' });
        }

        dateFilter = { createdAt: { $gte: start, $lte: end } };
        if (req.query.zoneIds) {
          const zones = req.query.zoneIds.split(',');
          const providers = await Provider.find({ currentZone: { $in: zones } }).select('_id').lean();
          const providerIds = providers.map(p => p._id);
          dateFilter.provider = { $in: providerIds };
        }
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

      let resolvedCustomerId = null;
      if (req.query.customerId) {
        const cust = await User.findOne({
          $or: [
            { customerId: req.query.customerId },
            { _id: mongoose.isValidObjectId(req.query.customerId) ? req.query.customerId : null }
          ].filter(Boolean)
        }).select('_id');
        if (cust) resolvedCustomerId = cust._id;
      }

      let groupId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };

      if (groupBy === 'week') {
        groupId = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
      } else if (groupBy === 'year') {
        groupId = { year: { $year: '$createdAt' } };
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
        ...(resolvedCustomerId ? [{ $match: { 'booking.user': resolvedCustomerId } }] : []),
        { $match: { 'booking.status': 'completed' } },
        {
          $lookup: {
            from: 'complaints',
            localField: 'booking.complaint',
            foreignField: '_id',
            as: 'complaintInfo'
          }
        },
        { $unwind: { path: '$complaintInfo', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: groupId,
            totalGross: { $sum: '$grossAmount' },
            totalCommission: { $sum: '$commissionAmount' },
            totalNet: { $sum: '$netAmount' },
            count: { $sum: 1 },
            bookingIds: { $addToSet: { $ifNull: ['$booking.bookingId', { $toString: '$booking._id' }] } },
            complaintIds: { $addToSet: '$complaintInfo.complaintId' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
      ]);

      // Get withdrawals for the same period
      const withdrawals = await PaymentRecord.aggregate([
        {
          $match: {
            status: { $in: ['completed', 'transferred'] },
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
        { header: 'Booking IDs', key: 'bookingIds', width: 40 },
        { header: 'Complaint IDs', key: 'complaintIds', width: 40 },
        { header: 'Total Platform Earnings (Gross)', key: 'totalGross', width: 25 },
        { header: 'Total Provider Earnings (Net)', key: 'totalNet', width: 25 },
        { header: 'Total Commission Earned', key: 'totalCommission', width: 25 },
        { header: 'Total Withdrawals Processed', key: 'totalWithdrawn', width: 25 },
        { header: 'Net Platform Revenue', key: 'netRevenue', width: 20 }
      ];

      summary.forEach(item => {
        const period = groupBy === 'week'
          ? `Week ${item._id.week}, ${item._id.year}`
          : (groupBy === 'year' ? `Year ${item._id.year}` : `${item._id.year}-${(item._id.month || 0).toString().padStart(2, '0')}`);

        const withdrawalData = withdrawals.find(w =>
          w._id.year === item._id.year &&
          (groupBy === 'week' ? w._id.week === item._id.week : (groupBy === 'year' ? true : w._id.month === item._id.month))
        );

        worksheet.addRow({
          period,
          bookingIds: item.bookingIds ? item.bookingIds.filter(Boolean).join(', ') : '-',
          complaintIds: item.complaintIds ? item.complaintIds.filter(Boolean).join(', ') : '-',
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
  }

  static async payoutHistoryReport(req, res) {
    try {
      const { fromDate, toDate } = req.query;

      if (!fromDate || !toDate) {
        return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });
      }

      const start = new Date(fromDate);
      const end = new Date(toDate);

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 1 || diffDays > 366) {
        return res.status(400).json({ success: false, error: 'Date range must be between 1 day and 1 year' });
      }

      const filter = {
        status: { $in: ['completed', 'transferred'] },
        createdAt: { $gte: start, $lte: end }
      };
      if (req.query.zoneIds) {
        const zones = req.query.zoneIds.split(',');
        const providers = await Provider.find({ currentZone: { $in: zones } }).select('_id').lean();
        const providerIds = providers.map(p => p._id);
        filter.provider = { $in: providerIds };
      }
      const payouts = await PaymentRecord.find(filter).populate('provider', 'name providerId').populate('admin', 'name').sort({ createdAt: -1 }).lean();

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
  }

  static async outstandingBalanceReport(req, res) {
    try {
      const providerFilter = { isDeleted: false };
      if (req.query.zoneIds) {
        const zones = req.query.zoneIds.split(',');
        providerFilter.currentZone = { $in: zones };
      }
      if (req.query.providerId) {
        if (mongoose.isValidObjectId(req.query.providerId)) {
          providerFilter._id = req.query.providerId;
        } else {
          providerFilter.providerId = req.query.providerId;
        }
      }
      const providers = await Provider.find(providerFilter).select('name email phone providerId').lean();

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
            $lookup: {
              from: 'complaints',
              localField: 'booking.complaint',
              foreignField: '_id',
              as: 'complaintInfo'
            }
          },
          { $unwind: { path: '$complaintInfo', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$booking.paymentMethod',
              totalNet: { $sum: '$netAmount' },
              totalCommission: { $sum: '$commissionAmount' },
              bookingIds: { $addToSet: { $ifNull: ['$booking.bookingId', { $toString: '$booking._id' }] } },
              complaintIds: { $addToSet: '$complaintInfo.complaintId' }
            }
          }
        ]);

        let availableBalance = 0;
        let providerBookingIds = new Set();
        let providerComplaintIds = new Set();
        availableBalanceResult.forEach(item => {
          if (item._id === 'online') {
            availableBalance += item.totalNet;
          } else if (item._id === 'cash') {
            availableBalance -= item.totalCommission;
          }
          if (item.bookingIds) item.bookingIds.forEach(id => providerBookingIds.add(id));
          if (item.complaintIds) item.complaintIds.forEach(id => id && providerComplaintIds.add(id));
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
          status: { $in: ['completed', 'transferred'] }
        }).sort({ completedAt: -1 }).lean();

        const lastWithdrawalDate = lastWithdrawal ? lastWithdrawal.completedAt : null;
        const daysPending = lastWithdrawalDate
          ? Math.floor((new Date() - lastWithdrawalDate) / (1000 * 60 * 60 * 24))
          : 'N/A';

        if (outstandingBalance > 0) {
          reportData.push({
            providerId: provider.providerId,
            providerName: provider.name,
            bookingIds: Array.from(providerBookingIds).filter(Boolean).join(', '),
            complaintIds: Array.from(providerComplaintIds).filter(Boolean).join(', '),
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
        { header: 'Booking IDs', key: 'bookingIds', width: 40 },
        { header: 'Complaint IDs', key: 'complaintIds', width: 40 },
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
  }

  static async releaseHeldEarnings() {
    const session = await safeStartSession();
    try {
      const now = new Date();

      const executeRelease = async (currentSession) => {
        const query = ProviderEarning.find({
          status: 'held',
          availableAfter: { $lte: now }
        }).populate('booking');

        const heldEarnings = currentSession ? await query.session(currentSession) : await query;

        if (heldEarnings.length === 0) return;

        console.log(`Processing ${heldEarnings.length} held earnings for release...`);

        for (const earning of heldEarnings) {
          // Check if dispute is raised on the booking
          const booking = earning.booking;
          if (booking) {
            const bookingId = booking._id;
            if (booking.disputeRaised || booking.disputeStatus === 'pending' || booking.disputeStatus === 'underreview') {
              console.log(`Skipping release for earning ${earning._id} - Dispute Active on booking ${bookingId}`);
              continue;
            }
            if (booking.paymentStatus === 'refunded' || booking.adminRefundDecision === 'approved') {
              console.log(`Cancelling earning ${earning._id} - Booking refunded/approved for refund`);
              if (currentSession) {
                await ProviderEarning.findOneAndUpdate(
                  { _id: earning._id, status: 'held' },
                  { $set: { status: 'cancelled' } },
                  { session: currentSession }
                );
              } else {
                await ProviderEarning.findOneAndUpdate(
                  { _id: earning._id, status: 'held' },
                  { $set: { status: 'cancelled' } }
                );
              }
              continue;
            }
          }

          // Atomically lock and update status from 'held' to 'available' to prevent race conditions
          const updateQuery = ProviderEarning.findOneAndUpdate(
            { _id: earning._id, status: 'held' },
            { $set: { status: 'available' } },
            { new: true }
          );
          const updatedEarning = currentSession ? await updateQuery.session(currentSession) : await updateQuery;

          if (!updatedEarning) {
            console.log(`Skipping release for earning ${earning._id} - Already processed by another concurrent task.`);
            continue;
          }

          // Update provider wallet atomically
          const providerId = earning.provider;
          const netAmount = earning.netAmount;

          const updatedProvider = currentSession
            ? await Provider.findByIdAndUpdate(
              providerId,
              {
                $inc: { 'wallet.availableBalance': netAmount },
                $set: { 'wallet.lastUpdated': new Date() }
              },
              { session: currentSession, new: true }
            )
            : await Provider.findByIdAndUpdate(
              providerId,
              {
                $inc: { 'wallet.availableBalance': netAmount },
                $set: { 'wallet.lastUpdated': new Date() }
              },
              { new: true }
            );

          if (updatedProvider) {
            // Notify provider
            try {
              sendNotification({
                userId: providerId,
                role: 'provider',
                title: 'Earnings Released',
                message: `Your earning of ₹${netAmount} for booking ${earning.booking?.bookingId || earning.booking?._id} has been released and is now available in your wallet.`,
                type: 'earningreleased',
                referenceId: earning.booking?._id,
                eventId: 'earning_released',
                idempotencyKey: `earning_released:${providerId}:${earning._id}`
              });
            } catch (err) { /* ignore */ }
          }
          console.log(`Released earning ${earning._id} to provider ${earning.provider}`);
        }
      };

      if (session) {
        await session.withTransaction(async () => {
          await executeRelease(session);
        });
      } else {
        await executeRelease(null);
      }

      try {
        const referralController = require('../referral/referral-controller');
        await referralController.releaseSettledReferralRewards();
      } catch (refErr) {
        console.error('Error releasing settled referral rewards in cron:', refErr);
      }
    } catch (error) {
      console.error('Error in releaseHeldEarnings:', error);
    } finally {
      if (session) {
        await session.endSession();
      }
    }
  }

  static async generateComplaintReport(req, res) {
    try {
      const { fromDate, toDate } = req.query;

      if (!fromDate || !toDate) {
        return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
      }

      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 1 || diffDays > 366) {
        return res.status(400).json({ success: false, message: 'Date range must be between 1 day and 1 year' });
      }

      const filter = {
        createdAt: { $gte: start, $lte: end }
      };
      if (req.query.zoneIds) {
        const zones = req.query.zoneIds.split(',');
        const providers = await Provider.find({ currentZone: { $in: zones } }).select('_id').lean();
        const providerIds = providers.map(p => p._id);
        filter.provider = { $in: providerIds };
      }
      if (req.query.providerId) {
        const prov = await Provider.findOne({
          $or: [
            { providerId: req.query.providerId },
            { _id: mongoose.isValidObjectId(req.query.providerId) ? req.query.providerId : null }
          ].filter(Boolean)
        }).select('_id');
        filter.provider = prov ? prov._id : null;
      }
      if (req.query.customerId) {
        const cust = await User.findOne({
          $or: [
            { customerId: req.query.customerId },
            { _id: mongoose.isValidObjectId(req.query.customerId) ? req.query.customerId : null }
          ].filter(Boolean)
        }).select('_id');
        filter.customer = cust ? cust._id : null;
      }

      const complaints = await Complaint.find(filter)
        .populate('customer', 'name email phone')
        .populate('provider', 'name providerId')
        .populate('booking', 'bookingId')
        .sort({ createdAt: -1 })
        .lean();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Complaint Report');

      worksheet.columns = [
        { header: 'Complaint ID', key: 'complaintId', width: 25 },
        { header: 'Booking ID', key: 'bookingId', width: 25 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Customer Email', key: 'customerEmail', width: 25 },
        { header: 'Customer Phone', key: 'customerPhone', width: 20 },
        { header: 'Provider Name', key: 'providerName', width: 25 },
        { header: 'Provider ID', key: 'providerId', width: 25 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'Title', key: 'title', width: 25 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Date Raised', key: 'dateRaised', width: 20 },
        { header: 'Date Resolved', key: 'dateResolved', width: 20 },
        { header: 'Resolution', key: 'resolution', width: 25 },
        { header: 'Resolution Notes', key: 'resolutionNotes', width: 30 }
      ];

      complaints.forEach(c => {
        worksheet.addRow({
          complaintId: c.complaintId || c._id.toString(),
          bookingId: c.booking ? (c.booking.bookingId || c.booking._id.toString()) : '-',
          customerName: c.customer?.name || '-',
          customerEmail: c.customer?.email || '-',
          customerPhone: c.customer?.phone || '-',
          providerName: c.provider?.name || '-',
          providerId: c.provider?.providerId || '-',
          category: c.category || '-',
          title: c.title || '-',
          description: c.description || '-',
          status: c.status || '-',
          dateRaised: c.createdAt ? c.createdAt.toLocaleString() : '-',
          dateResolved: c.resolvedAt ? c.resolvedAt.toLocaleString() : '-',
          resolution: c.resolution || '-',
          resolutionNotes: c.resolutionNotes || '-'
        });
      });

      worksheet.getRow(1).font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Complaint_Report_${fromDate}_to_${toDate}.xlsx`);

      await workbook.xlsx.write(res);
      res.status(200).end();

    } catch (error) {
      console.error('Error generating complaint report:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  }

  static async generateRefundReport(req, res) {
    try {
      const { fromDate, toDate } = req.query;

      if (!fromDate || !toDate) {
        return res.status(400).json({ success: false, message: 'fromDate and toDate are required' });
      }

      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);

      const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays < 1 || diffDays > 366) {
        return res.status(400).json({ success: false, message: 'Date range must be between 1 day and 1 year' });
      }

      const filter = {
        type: 'refund',
        createdAt: { $gte: start, $lte: end }
      };
      if (req.query.zoneIds) {
        const zones = req.query.zoneIds.split(',');
        const bookings = await Booking.find({ zoneId: { $in: zones } }).select('_id').lean();
        const bookingIds = bookings.map(b => b._id);
        filter.booking = { $in: bookingIds };
      }
      if (req.query.customerId) {
        const cust = await User.findOne({
          $or: [
            { customerId: req.query.customerId },
            { _id: mongoose.isValidObjectId(req.query.customerId) ? req.query.customerId : null }
          ].filter(Boolean)
        }).select('_id');
        filter.user = cust ? cust._id : null;
      }
      if (req.query.providerId) {
        const prov = await Provider.findOne({
          $or: [
            { providerId: req.query.providerId },
            { _id: mongoose.isValidObjectId(req.query.providerId) ? req.query.providerId : null }
          ].filter(Boolean)
        }).select('_id');
        if (prov) {
          const bookings = await Booking.find({ provider: prov._id }).select('_id').lean();
          const bookingIds = bookings.map(b => b._id);
          filter.booking = { $in: bookingIds };
        } else {
          filter.booking = null;
        }
      }

      const refunds = await Transaction.find(filter)
        .populate('user', 'name email phone')
        .populate({
          path: 'booking',
          select: 'bookingId complaint provider',
          populate: [
            { path: 'complaint', select: 'complaintId' },
            { path: 'provider', select: 'name providerId' }
          ]
        })
        .sort({ createdAt: -1 })
        .lean();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Refund Report');

      worksheet.columns = [
        { header: 'Booking ID', key: 'bookingId', width: 25 },
        { header: 'Complaint ID', key: 'complaintId', width: 25 },
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Customer Email', key: 'customerEmail', width: 25 },
        { header: 'Customer Phone', key: 'customerPhone', width: 20 },
        { header: 'Provider Name', key: 'providerName', width: 25 },
        { header: 'Provider ID', key: 'providerId', width: 25 },
        { header: 'Refunded Amount', key: 'amount', width: 15 },
        { header: 'Refund Status', key: 'status', width: 15 },
        { header: 'Refund Reason / Description', key: 'description', width: 40 },
        { header: 'Date Processed', key: 'dateProcessed', width: 20 }
      ];

      refunds.forEach(r => {
        worksheet.addRow({
          bookingId: r.booking?.bookingId || r.bookingId || '-',
          complaintId: r.booking?.complaint?.complaintId || '-',
          customerName: r.user?.name || '-',
          customerEmail: r.user?.email || '-',
          customerPhone: r.user?.phone || '-',
          providerName: r.booking?.provider?.name || '-',
          providerId: r.booking?.provider?.providerId || '-',
          amount: r.amount || 0,
          status: r.paymentStatus || '-',
          description: r.refundReason || r.description || '-',
          dateProcessed: r.createdAt ? r.createdAt.toLocaleString() : '-'
        });
      });

      worksheet.getRow(1).font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Refund_Report_${fromDate}_to_${toDate}.xlsx`);

      await workbook.xlsx.write(res);
      res.status(200).end();

    } catch (error) {
      console.error('Error generating refund report:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
  }

  static async adminDirectPayout(req, res) {
    const session = await safeStartSession();
    if (session) {
      session.startTransaction();
    }

    try {
      const { providerId, amount, paymentMethod, transactionReference, utrNo, notes, transferDate, transferTime } = req.body;

      if (!providerId) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: "Provider ID is required" });
      }

      if (!amount || isNaN(amount) || amount <= 0) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(400).json({ success: false, message: "Valid payout amount is required" });
      }

      const provider = await Provider.findById(providerId);
      if (!provider) {
        await safeAbort(session);
        safeEnd(session);
        return res.status(404).json({ success: false, message: "Provider not found" });
      }

      if (!provider.wallet) {
        provider.wallet = { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
      }

      // Resolve & verify payout details from database authoritative source
      const bank = provider.bankDetails || {};
      const isVerified = bank.bankVerificationStatus === 'verified' && bank.verified && bank.payoutEnabled;
      if (!isVerified) {
        await safeAbort(session); safeEnd(session);
        return res.status(400).json({ success: false, message: "Provider payout configuration is not verified/enabled." });
      }

      const isUpi = bank.preferredMethod === 'upi';
      if (isUpi ? !bank.upiId : (!bank.accountNo || !bank.ifsc)) {
        await safeAbort(session); safeEnd(session);
        return res.status(400).json({ success: false, message: "Preferred payout details are missing." });
      }

      const resolvedMethod = isUpi
        ? 'upi'
        : (['banktransfer', 'neft', 'rtgs', 'imps', 'other'].includes(paymentMethod) ? paymentMethod : 'banktransfer');
      const resolvedDetails = isUpi
        ? { upiId: bank.upiId, accountName: bank.accountName || provider.name }
        : { accountNumber: bank.accountNo, accountName: bank.accountName || provider.name, ifscCode: bank.ifsc, bankName: bank.bankName || 'N/A' };

      // Deduct available balance and increment total withdrawn atomically to prevent double payouts
      const updateQuery = {
        _id: provider._id,
        'wallet.availableBalance': { $gte: amount }
      };
      const updateOps = {
        $inc: {
          'wallet.availableBalance': -amount,
          'wallet.totalWithdrawn': amount
        },
        $set: { 'wallet.lastUpdated': new Date() }
      };
      const updatedProvider = session
        ? await Provider.findOneAndUpdate(updateQuery, updateOps, { new: true, session })
        : await Provider.findOneAndUpdate(updateQuery, updateOps, { new: true });

      if (!updatedProvider) {
        await safeAbort(session); safeEnd(session);
        return res.status(400).json({ success: false, message: `Insufficient provider available balance or concurrent payout in progress.` });
      }

      const balanceAfter = updatedProvider.wallet.availableBalance;
      const balanceBefore = balanceAfter + amount;

      const paymentRecord = new PaymentRecord({
        provider: provider._id,
        amount,
        netAmount: amount,
        paymentMethod: resolvedMethod,
        paymentDetails: resolvedDetails,
        status: 'completed',
        utrNo: utrNo || '',
        transferDate: transferDate ? new Date(transferDate) : new Date(),
        transferTime: transferTime || new Date().toLocaleTimeString('en-US', { hour12: false }),
        adminRemark: notes || "Direct payout processed by Admin",
        admin: req.admin._id,
        completedAt: new Date(),
        transactionReference: transactionReference || `PAYOUT-DIR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      });

      if (session) {
        await paymentRecord.save({ session });
      } else {
        await paymentRecord.save();
      }

      // Log direct payout transaction for provider ledger history
      const payoutTx = new Transaction({
        booking: paymentRecord._id, // fallback reference to paymentRecord ID
        bookingId: paymentRecord.transactionReference || `PAYOUT-DIR-${Date.now()}`,
        user: provider._id,
        provider: provider._id,
        amount: amount,
        paymentStatus: 'completed',
        paymentMethod: 'wallet',
        type: 'withdrawal',
        ledgerType: 'withdrawal',
        entryType: 'debit',
        balanceBefore: balanceBefore,
        balanceAfter: balanceAfter,
        deductionType: 'payout_withdrawal',
        description: `Direct payout of ₹${amount} processed by Admin (${paymentRecord.transactionReference})`
      });

      if (session) {
        await payoutTx.save({ session });
      } else {
        await payoutTx.save();
      }

      await safeCommit(session);
      safeEnd(session);

      // Recalculate/sync balance immediately
      await syncEarningsStatus(provider._id);

      // Notify provider about the direct payout
      try {
        sendNotification(
          provider._id,
          'provider',
          'Direct Payout Released',
          `Admin has released a direct payout of ₹${amount} to your account.`,
          'payout',
          paymentRecord._id
        );
        await sendMail({
          to: provider.email,
          templateType: 'withdrawApproved',
          variables: {
            name: provider.name,
            withdrawAmount: amount,
            remark: notes || 'Direct payout processed by Admin',
            date: new Date().toLocaleDateString()
          }
        });
      } catch (err) { /* ignore */ }

      return res.status(200).json({
        success: true,
        message: "Direct payout processed successfully",
        data: paymentRecord
      });

    } catch (error) {
      await safeAbort(session);
      safeEnd(session);
      console.error("Error initiating direct payout:", error);
      return res.status(500).json({
        success: false,
        message: "Server error during direct payout",
        error: error.message
      });
    }
  }

  /* ==========================================================================
     HYBRID WITHDRAWAL ENGINE: DECISION ROUTING & EXTENSION STUBS
     ========================================================================== */

  /**
   * Evaluates payout routing strategy based on System Settings and request amount.
   * @param {number} amount
   * @param {object} settings
   * @returns {{ route: string, requiresApproval: boolean, reason: string }}
   */
  static determinePayoutRouting(amount, settings) {
    const payoutSettings = settings?.payoutSettings || {};
    const mode = payoutSettings.mode || 'manual';

    if (mode === 'manual') {
      return {
        route: 'manual',
        requiresApproval: true,
        reason: 'System configured in Manual Operation Mode. All payouts require manual processing/approval.'
      };
    }

    if (mode === 'razorpayx') {
      const autoEnabled = Boolean(payoutSettings.autoWithdrawalEnabled);
      const instantLimit = payoutSettings.instantWithdrawalLimit ?? 5000;
      const approvalThreshold = payoutSettings.approvalRequiredAboveAmount ?? 10000;

      if (autoEnabled && amount <= instantLimit && amount < approvalThreshold) {
        return {
          route: 'razorpayx',
          requiresApproval: false,
          reason: 'Eligible for automated RazorpayX instant processing.'
        };
      }

      return {
        route: 'razorpayx',
        requiresApproval: true,
        reason: 'Amount exceeds instant threshold or requires explicit Admin approval before RazorpayX payout.'
      };
    }

    return {
      route: 'manual',
      requiresApproval: true,
      reason: 'Default fallback mode (Manual).'
    };
  }

  /* ==========================================================================
     SINGLE SOURCE OF TRUTH: RAZORPAYX PAYOUT SERVICE LAYER ARCHITECTURE
     All Razorpay Gateway (Customer Payments) and RazorpayX (Provider Payouts)
     operations are orchestrated strictly from PaymentService.
     ========================================================================== */

  // --------------------------------------------------------------------------
  // SECTION 1: CONTACTS (Created once upon bank verification, never recreated per payout)
  // --------------------------------------------------------------------------

  static async createRazorpayXContact(provider) {
    const settings = await getCachedSystemConfig();
    if (settings?.payoutSettings?.mode !== 'razorpayx') {
      return { success: false, mode: 'manual', message: 'System operating in Manual mode. Contact creation bypassed.' };
    }
    return ensureRazorpayContact(provider);
  }

  // --------------------------------------------------------------------------
  // SECTION 2: FUND ACCOUNTS (Created once upon bank verification, persisted on provider)
  // --------------------------------------------------------------------------

  static async createRazorpayXFundAccount(provider) {
    const settings = await getCachedSystemConfig();
    if (settings?.payoutSettings?.mode !== 'razorpayx') {
      return { success: false, mode: 'manual', message: 'System operating in Manual mode. Fund Account creation bypassed.' };
    }
    return ensureRazorpayFundAccount(provider);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: PAYOUTS (Instant / Batch execution, strictly guarded by System Mode)
  // --------------------------------------------------------------------------

  static async createRazorpayXPayout(paymentRecord, provider, accountNumber) {
    const settings = await getCachedSystemConfig();
    if (settings?.payoutSettings?.mode !== 'razorpayx') {
      return { success: false, mode: 'manual', message: 'System operating in Manual mode. RazorpayX Payout execution bypassed.' };
    }
    return executeRazorpayXPayout(paymentRecord, provider, accountNumber);
  }

  static async executeRazorpayXPayout(paymentRecord, provider, accountNumber) {
    return this.createRazorpayXPayout(paymentRecord, provider, accountNumber);
  }

  static async fetchRazorpayXPayout(payoutId) {
    const settings = await getCachedSystemConfig();
    if (settings?.payoutSettings?.mode !== 'razorpayx') {
      return { success: false, mode: 'manual', message: 'System operating in Manual mode. Payout fetch bypassed.' };
    }
    const auth = getRazorpayXAuth();
    if (!auth) throw new Error("RAZORPAYX_KEY_ID or RAZORPAYX_KEY_SECRET missing in .env");

    const res = await axios.get(`https://api.razorpay.com/v1/payouts/${payoutId}`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    return { success: true, data: res.data };
  }

  static async fetchRazorpayXPayoutStatus(payoutId) {
    return this.fetchRazorpayXPayout(payoutId);
  }

  static async listRazorpayXPayouts(filters = {}) {
    const settings = await getCachedSystemConfig();
    if (settings?.payoutSettings?.mode !== 'razorpayx') {
      return { success: false, mode: 'manual', data: [], message: 'System operating in Manual mode. List Payouts bypassed.' };
    }
    const auth = getRazorpayXAuth();
    if (!auth) throw new Error("RAZORPAYX_KEY_ID or RAZORPAYX_KEY_SECRET missing in .env");

    const res = await axios.get('https://api.razorpay.com/v1/payouts', {
      headers: { 'Authorization': `Basic ${auth}` },
      params: filters
    });
    return { success: true, data: res.data };
  }

  // --------------------------------------------------------------------------
  // SECTION 4: BALANCE (5-Minute Memory Cached Check)
  // --------------------------------------------------------------------------

  static async getRazorpayXBalance() {
    const settings = await getCachedSystemConfig();
    if (settings?.payoutSettings?.mode !== 'razorpayx') {
      return { success: false, mode: 'manual', balance: 0, message: 'System operating in Manual mode. Balance check bypassed.' };
    }

    let cachedBalance = cache.get('razorpayx_balance');
    if (cachedBalance !== undefined && cachedBalance !== null) {
      return { success: true, balance: cachedBalance, cached: true };
    }

    const auth = getRazorpayXAuth();
    if (!auth) throw new Error("RAZORPAYX_KEY_ID or RAZORPAYX_KEY_SECRET missing in .env");

    const payoutAccNo = process.env.RAZORPAYX_ACCOUNT_NUMBER;
    if (!payoutAccNo) throw new Error("RAZORPAYX_ACCOUNT_NUMBER missing in environment variables.");

    try {
      const res = await axios.get(`https://api.razorpay.com/v1/banking/accounts/${payoutAccNo}/balance`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });

      const balanceAmount = (res.data.balance || 0) / 100;
      cache.set('razorpayx_balance', balanceAmount, 300); // 5 minutes cache TTL
      return { success: true, balance: balanceAmount, cached: false };
    } catch (err) {
      console.error('[RazorpayX Balance Error]:', err.response?.data || err.message);
      return { success: false, balance: 0, error: err.message };
    }
  }

  // --------------------------------------------------------------------------
  // SECTION 5: TRANSACTIONS & RETRY GUARDS
  // --------------------------------------------------------------------------

  static async getRazorpayXTransactions(filters = {}) {
    const settings = await getCachedSystemConfig();
    if (settings?.payoutSettings?.mode !== 'razorpayx') {
      return { success: false, mode: 'manual', data: [], message: 'System operating in Manual mode. Transactions listing bypassed.' };
    }
    const auth = getRazorpayXAuth();
    if (!auth) throw new Error("RAZORPAYX_KEY_ID or RAZORPAYX_KEY_SECRET missing in .env");

    const res = await axios.get('https://api.razorpay.com/v1/transactions', {
      headers: { 'Authorization': `Basic ${auth}` },
      params: filters
    });
    return { success: true, data: res.data };
  }

  static async retryRazorpayXPayout(paymentRecordId) {
    const paymentRecord = await PaymentRecord.findById(paymentRecordId).populate('provider');
    if (!paymentRecord) throw new Error("Payment record not found.");

    if (!['failed', 'rejected'].includes(paymentRecord.status)) {
      throw new Error(`Cannot retry payout with status '${paymentRecord.status}'. Retries permitted only for FAILED or REJECTED payouts.`);
    }

    const settings = await getCachedSystemConfig();
    if (settings?.payoutSettings?.mode !== 'razorpayx') {
      throw new Error("Cannot retry RazorpayX payout while system is operating in Manual mode.");
    }

    paymentRecord.retryCount = (paymentRecord.retryCount || 0) + 1;
    paymentRecord.status = 'processing';
    paymentRecord.lastError = null;
    await paymentRecord.save();

    const payoutData = await executeRazorpayXPayout(paymentRecord, paymentRecord.provider, process.env.RAZORPAYX_ACCOUNT_NUMBER);
    return payoutData;
  }

  // --------------------------------------------------------------------------
  // SECTION 6: WEBHOOKS & AUDIT LOGGING
  // --------------------------------------------------------------------------

  static async handleRazorpayXWebhook(payload, signature) {
    return handlePayoutWebhook(payload?.event, payload?.payload?.payout?.entity);
  }

  /**
   * Enterprise Auto Withdrawal Scheduler Architecture.
   * Evaluates eligibility and creates queued withdrawal records without calling third-party APIs directly.
   */
  static async processAutoWithdrawalScheduler() {
    try {
      const { SystemConfig } = require('../system-setting/system-setting-model');
      const settings = await SystemConfig.findOne().lean();
      if (!settings || !settings.payoutSettings) {
        return { success: false, executed: 0, reason: 'System settings missing' };
      }

      const pSettings = settings.payoutSettings;
      const isRazorpayXMode = pSettings.mode === 'razorpayx';
      const isAutoEnabled = Boolean(pSettings.autoWithdrawalEnabled);

      if (!isRazorpayXMode || !isAutoEnabled) {
        return {
          success: true,
          executed: 0,
          reason: 'Auto Withdrawal skipped: Operating in Manual mode or Auto Withdrawal is disabled.'
        };
      }

      // Check Working Days
      const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const todayDayStr = daysMap[new Date().getDay()];
      const workingDays = pSettings.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      if (!workingDays.includes(todayDayStr)) {
        return { success: true, executed: 0, reason: `Today (${todayDayStr}) is not a configured working day.` };
      }

      const minLimit = pSettings.minWithdrawalAmount ?? 500;
      const maxLimit = pSettings.maxWithdrawalAmount ?? 100000;

      // Find eligible providers
      const eligibleProviders = await Provider.find({
        approved: true,
        kycStatus: 'approved',
        isSuspended: { $ne: true },
        'wallet.availableBalance': { $gte: minLimit },
        'bankDetails.accountNo': { $exists: true, $ne: '' }
      }).select('_id bankDetails wallet name email');

      let queuedCount = 0;

      for (const provider of eligibleProviders) {
        // Check for active pending withdrawal
        const activePending = await PaymentRecord.findOne({
          provider: provider._id,
          status: { $in: ['requested', 'processing', 'under_review', 'approved'] }
        }).lean();

        if (activePending) continue;

        const available = provider.wallet?.availableBalance || 0;
        const autoAmount = Math.min(available, maxLimit);

        if (autoAmount < minLimit) continue;

        // Evaluate routing
        const routing = PaymentService.determinePayoutRouting(autoAmount, settings);

        // Deduct balance and create queued PaymentRecord
        const session = await safeStartSession();
        try {
          provider.wallet.availableBalance -= autoAmount;
          provider.wallet.lastUpdated = new Date();
          await provider.save();

          const paymentRecord = new PaymentRecord({
            provider: provider._id,
            amount: autoAmount,
            netAmount: autoAmount,
            paymentMethod: "bank_transfer",
            paymentDetails: {
              accountNumber: provider.bankDetails.accountNo,
              accountName: provider.bankDetails.accountName || provider.name,
              ifscCode: provider.bankDetails.ifsc,
              bankName: provider.bankDetails.bankName,
            },
            status: routing.requiresApproval ? 'under_review' : 'requested',
            withdrawalType: 'auto_scheduled',
            notes: `Auto Scheduled Withdrawal (${pSettings.autoWithdrawalFrequency || 'daily'}) - Routing: ${routing.route}`,
            transactionReference: `AUTO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
          });

          await paymentRecord.save();
          queuedCount++;
        } catch (err) {
          console.error(`[AutoWithdrawalScheduler] Failed to queue provider ${provider._id}:`, err);
        } finally {
          safeEnd(session);
        }
      }

      return {
        success: true,
        executed: queuedCount,
        reason: `Successfully queued ${queuedCount} auto withdrawal request(s).`
      };

    } catch (error) {
      console.error('[AutoWithdrawalScheduler] Error processing scheduler:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * READ-ONLY Enterprise Financial Report Center Data & Reconciliation Engine
   */
  static async getFinancialReportCenterData(req, res) {
    try {
      const {
        reportType = 'summary',
        startDate,
        endDate,
        fromDate,
        toDate,
        providerId,
        customerId,
        bookingId,
        transactionId,
        paymentMethod,
        paymentStatus,
        bookingStatus,
        reconciliationStatus,
        page = 1,
        limit = 50,
        exportFormat
      } = req.query;

      const sDate = startDate || fromDate ? new Date(startDate || fromDate) : new Date(Date.now() - 30 * 86400000);
      const eDate = endDate || toDate ? new Date(new Date(endDate || toDate).setHours(23, 59, 59, 999)) : new Date();

      const dateMatch = { createdAt: { $gte: sDate, $lte: eDate } };

      // Models
      const Booking = mongoose.model('Booking');
      const Transaction = mongoose.model('Transaction');
      const ProviderEarning = mongoose.model('ProviderEarning');
      const PaymentRecord = mongoose.model('PaymentRecord');
      const Refund = mongoose.model('Refund');
      const Complaint = mongoose.model('Complaint');
      const Coupon = mongoose.model('Coupon');
      const { Referral, ReferralRewardLog } = require('../referral/referral-model');
      const User = mongoose.model('User');
      const Provider = mongoose.model('Provider');

      // ── 1. GLOBAL FINANCIAL SUMMARY METRICS (Authoritative Backend Read) ──
      const [
        bookingStats,
        txnStats,
        earningStats,
        payoutStats,
        refundStats,
        referralStats
      ] = await Promise.all([
        Booking.aggregate([
          { $match: { createdAt: { $gte: sDate, $lte: eDate } } },
          {
            $group: {
              _id: null,
              totalBookingValue: { $sum: '$totalAmount' },
              totalSubtotal: { $sum: '$subtotal' },
              totalDiscount: { $sum: '$totalDiscount' },
              totalCashToPay: { $sum: '$cashToPay' },
              totalOnlinePaid: { $sum: '$onlinePaid' },
              totalWalletUsed: { $sum: '$walletUsed' },
              count: { $sum: 1 }
            }
          }
        ]),
        Transaction.aggregate([
          { $match: { createdAt: { $gte: sDate, $lte: eDate } } },
          {
            $group: {
              _id: '$type',
              totalAmount: { $sum: '$amount' },
              count: { $sum: 1 }
            }
          }
        ]),
        ProviderEarning.aggregate([
          { $match: { createdAt: { $gte: sDate, $lte: eDate } } },
          {
            $group: {
              _id: null,
              grossAmount: { $sum: '$grossAmount' },
              commissionAmount: { $sum: '$commissionAmount' },
              netAmount: { $sum: '$netAmount' }
            }
          }
        ]),
        PaymentRecord.aggregate([
          { $match: { createdAt: { $gte: sDate, $lte: eDate }, status: { $in: ['completed', 'transferred'] } } },
          { $group: { _id: null, totalPayouts: { $sum: '$amount' } } }
        ]),
        Refund.aggregate([
          { $match: { createdAt: { $gte: sDate, $lte: eDate }, refundStatus: 'completed' } },
          { $group: { _id: null, totalRefunds: { $sum: '$refundAmount' } } }
        ]),
        ReferralRewardLog.aggregate([
          { $match: { createdAt: { $gte: sDate, $lte: eDate }, status: 'released' } },
          { $group: { _id: null, totalReferralRewards: { $sum: '$amount' } } }
        ])
      ]);

      const bStat = bookingStats[0] || {};
      const eStat = earningStats[0] || {};
      const pStat = payoutStats[0] || {};
      const rStat = refundStats[0] || {};
      const refStat = referralStats[0] || {};

      let customerPayments = 0;
      let couponSubsidy = 0;
      txnStats.forEach(t => {
        if (['payment', 'wallet_topup'].includes(t._id)) customerPayments += t.totalAmount;
        if (t._id === 'referral_coupon_subsidy') couponSubsidy += t.totalAmount;
      });

      const platformCommission = eStat.commissionAmount || 0;
      const providerEarnings = eStat.netAmount || 0;
      const totalRefunds = rStat.totalRefunds || 0;
      const totalPayouts = pStat.totalPayouts || 0;
      const referralRewards = refStat.totalReferralRewards || 0;
      const cashRecovery = bStat.totalCashToPay || 0;
      const netPlatformRevenue = parseFloat((platformCommission - referralRewards - couponSubsidy - totalRefunds).toFixed(2));

      const summaryCards = {
        totalBookingValue: bStat.totalBookingValue || 0,
        totalCustomerPayments: customerPayments || (bStat.totalOnlinePaid || 0) + (bStat.totalWalletUsed || 0),
        platformCommission,
        providerEarnings,
        totalRefunds,
        totalPayouts,
        referralRewards,
        couponSubsidy,
        cashRecovery,
        netPlatformRevenue
      };

      // ── 2. REPORT TYPE SPECIFIC DATASETS ──
      let reportData = [];
      let totalRecords = 0;

      const pNum = Math.max(1, parseInt(page, 10));
      const pLimit = Math.max(1, Math.min(1000, parseInt(limit, 10)));
      const skip = (pNum - 1) * pLimit;

      switch (reportType) {
        case 'booking_revenue': {
          const filter = { createdAt: { $gte: sDate, $lte: eDate } };
          if (bookingStatus) filter.status = bookingStatus;
          if (paymentStatus) filter.paymentStatus = paymentStatus;
          if (paymentMethod) filter.paymentMethod = paymentMethod;

          totalRecords = await Booking.countDocuments(filter);
          const bookings = await Booking.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('customer', 'name email phone')
            .populate('provider', 'name phone providerId')
            .populate('services.service', 'title category')
            .lean();

          reportData = bookings.map(b => ({
            bookingId: b.bookingId || b._id,
            bookingDate: b.createdAt,
            completionDate: b.completedAt || b.serviceCompletedAt || null,
            customer: b.customer?.name || 'N/A',
            provider: b.provider?.name || 'Unassigned',
            service: b.services?.[0]?.service?.title || 'Service',
            subtotal: b.subtotal || 0,
            normalDiscount: b.totalDiscount || 0,
            surcharges: (b.demandSurge || 0) + (b.nightCharge || 0) + (b.visitingCharge || 0),
            totalAmount: b.totalAmount || 0,
            paymentMethod: b.paymentMethod,
            paymentStatus: b.paymentStatus,
            bookingStatus: b.status,
            platformCommission: b.commissionAmount || 0,
            providerEarnings: b.providerEarnings || 0
          }));
          break;
        }

        case 'commission': {
          const filter = { createdAt: { $gte: sDate, $lte: eDate } };
          if (providerId && mongoose.Types.ObjectId.isValid(providerId)) filter.provider = providerId;

          totalRecords = await ProviderEarning.countDocuments(filter);
          const earnings = await ProviderEarning.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('provider', 'name providerId')
            .populate('booking')
            .lean();

          reportData = earnings.map(e => ({
            earningId: e._id,
            bookingId: e.booking?.bookingId || e.booking?._id || 'N/A',
            provider: e.provider?.name || 'N/A',
            bookingDate: e.createdAt,
            commissionRate: e.commissionRate || 0,
            grossAmount: e.grossAmount || 0,
            platformCommission: e.commissionAmount || 0,
            providerNetAmount: e.netAmount || 0,
            earningStatus: e.status
          }));
          break;
        }

        case 'provider_earnings': {
          const filter = { createdAt: { $gte: sDate, $lte: eDate } };
          if (providerId && mongoose.Types.ObjectId.isValid(providerId)) filter.provider = providerId;

          totalRecords = await ProviderEarning.countDocuments(filter);
          const earnings = await ProviderEarning.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('provider', 'name providerId phone')
            .populate('booking')
            .lean();

          reportData = earnings.map(e => ({
            earningId: e._id,
            provider: e.provider?.name || 'N/A',
            bookingId: e.booking?.bookingId || e.booking?._id || 'N/A',
            bookingDate: e.createdAt,
            grossAmount: e.grossAmount || 0,
            commissionRate: e.commissionRate || 0,
            commissionAmount: e.commissionAmount || 0,
            netAmount: e.netAmount || 0,
            earningStatus: e.status,
            availableAfter: e.availableAfter || null
          }));
          break;
        }

        case 'customer_payment': {
          const filter = { createdAt: { $gte: sDate, $lte: eDate } };
          if (paymentMethod) filter.paymentMethod = paymentMethod;
          if (paymentStatus) filter.paymentStatus = paymentStatus;

          totalRecords = await Transaction.countDocuments(filter);
          const txns = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('user', 'name email')
            .populate('booking')
            .lean();

          reportData = txns.map(t => ({
            transactionId: t.transactionId || t._id,
            bookingId: t.bookingId || t.booking?.bookingId || 'N/A',
            customer: t.user?.name || 'N/A',
            amount: t.amount || 0,
            paymentMethod: t.paymentMethod,
            paymentStatus: t.paymentStatus,
            transactionType: t.type,
            razorpayOrderId: t.razorpayOrderId || 'N/A',
            razorpayPaymentId: t.razorpayPaymentId || 'N/A',
            createdAt: t.createdAt
          }));
          break;
        }

        case 'razorpay_reconcile': {
          const filter = { razorpayPaymentId: { $ne: null }, createdAt: { $gte: sDate, $lte: eDate } };
          totalRecords = await Transaction.countDocuments(filter);
          const txns = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('booking')
            .lean();

          reportData = txns.map(t => {
            const b = t.booking || {};
            const rzpAmt = t.razorpayResponse?.amount ? t.razorpayResponse.amount / 100 : t.amount;
            const amtMatch = Math.abs(rzpAmt - t.amount) < 0.01;
            const statusMatch = ['success', 'completed'].includes(t.paymentStatus) && ['captured', 'paid', 'escrowhold'].includes(b.paymentStatus || 'escrowhold');

            let reconStatus = 'MATCHED';
            if (!amtMatch) reconStatus = 'AMOUNT_MISMATCH';
            else if (!statusMatch) reconStatus = 'STATUS_MISMATCH';

            return {
              transactionId: t.transactionId || t._id,
              bookingId: b.bookingId || b._id || 'N/A',
              razorpayOrderId: t.razorpayOrderId || 'N/A',
              razorpayPaymentId: t.razorpayPaymentId || 'N/A',
              razorpayAmount: rzpAmt,
              transactionAmount: t.amount,
              bookingAmount: b.totalAmount || t.amount,
              razorpayGatewayStatus: t.razorpayResponse?.status || 'captured',
              transactionPaymentStatus: t.paymentStatus,
              bookingPaymentStatus: b.paymentStatus || 'escrowhold',
              reconciliationStatus: reconStatus
            };
          });
          break;
        }

        case 'refund': {
          const filter = { createdAt: { $gte: sDate, $lte: eDate } };
          totalRecords = await Refund.countDocuments(filter);
          const refunds = await Refund.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('customerId', 'name email')
            .populate('bookingId')
            .lean();

          reportData = refunds.map(r => ({
            refundId: r.refundId || r._id,
            bookingId: r.bookingId?.bookingId || r.bookingId?._id || 'N/A',
            customer: r.customerId?.name || 'N/A',
            requestedAmount: r.requestedAmount || 0,
            refundAmount: r.refundAmount || 0,
            walletRefundAmount: r.walletRefundAmount || 0,
            gatewayRefundAmount: r.gatewayRefundAmount || 0,
            gatewayRefundId: r.gatewayRefundId || 'N/A',
            refundStatus: r.refundStatus,
            refundReason: r.refundReason || r.cancellationReason || 'N/A',
            createdAt: r.createdAt
          }));
          break;
        }

        case 'payout': {
          const filter = { createdAt: { $gte: sDate, $lte: eDate } };
          totalRecords = await PaymentRecord.countDocuments(filter);
          const records = await PaymentRecord.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('provider', 'name providerId phone')
            .lean();

          reportData = records.map(p => ({
            paymentRecordId: p._id,
            transactionReference: p.transactionReference || 'N/A',
            provider: p.provider?.name || 'N/A',
            amount: p.amount || 0,
            netAmount: p.netAmount || 0,
            withdrawalType: p.withdrawalType || 'manual',
            status: p.status,
            razorpayPayoutId: p.razorpayPayoutId || 'N/A',
            utrNo: p.utrNo || 'N/A',
            requestedAt: p.createdAt,
            completedAt: p.completedAt || null
          }));
          break;
        }

        case 'wallet_ledger': {
          const filter = { ledgerType: 'wallet', createdAt: { $gte: sDate, $lte: eDate } };
          totalRecords = await Transaction.countDocuments(filter);
          const txns = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('user', 'name role')
            .populate('provider', 'name')
            .lean();

          reportData = txns.map(t => ({
            transactionId: t.transactionId || t._id,
            walletOwner: t.provider?.name || t.user?.name || 'N/A',
            role: t.provider ? 'provider' : (t.user?.role || 'customer'),
            entryType: t.entryType,
            amount: t.amount,
            balanceBefore: t.balanceBefore ?? 'N/A',
            balanceAfter: t.balanceAfter ?? 'N/A',
            type: t.type,
            description: t.description || 'Wallet transaction',
            createdAt: t.createdAt
          }));
          break;
        }

        case 'cash_recovery': {
          const filter = { paymentMethod: 'cash', createdAt: { $gte: sDate, $lte: eDate } };
          totalRecords = await Booking.countDocuments(filter);
          const cashBookings = await Booking.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('customer', 'name')
            .populate('provider', 'name providerId')
            .lean();

          reportData = cashBookings.map(b => ({
            bookingId: b.bookingId || b._id,
            customer: b.customer?.name || 'N/A',
            provider: b.provider?.name || 'N/A',
            totalAmount: b.totalAmount || 0,
            cashCollected: b.cashToPay || b.totalAmount || 0,
            platformCommission: b.commissionAmount || 0,
            providerEarnings: b.providerEarnings || 0,
            paymentStatus: b.paymentStatus,
            verificationStatus: b.paymentVerification?.status || 'pending',
            verifiedAt: b.paymentVerification?.verifiedAt || null
          }));
          break;
        }

        case 'coupon': {
          const filter = { 'couponApplied.code': { $exists: true, $ne: null }, createdAt: { $gte: sDate, $lte: eDate } };
          totalRecords = await Booking.countDocuments(filter);
          const couponBookings = await Booking.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('customer', 'name')
            .lean();

          reportData = couponBookings.map(b => ({
            bookingId: b.bookingId || b._id,
            customer: b.customer?.name || 'N/A',
            couponCode: b.couponApplied?.code || 'N/A',
            discountType: b.couponApplied?.discountType || 'flat',
            discountValue: b.couponApplied?.discountValue || 0,
            totalDiscount: b.totalDiscount || 0,
            subtotal: b.subtotal || 0,
            finalCustomerPaid: b.totalAmount || 0,
            isReferralCoupon: b.couponApplied?.isReferralCoupon || false,
            usageDate: b.createdAt
          }));
          break;
        }

        case 'referral': {
          const filter = { createdAt: { $gte: sDate, $lte: eDate } };
          totalRecords = await ReferralRewardLog.countDocuments(filter);
          const logs = await ReferralRewardLog.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('recipient', 'name')
            .lean();

          reportData = logs.map(l => ({
            rewardLogId: l._id,
            recipient: l.recipient?.name || 'N/A',
            recipientType: l.recipientType,
            rewardType: l.rewardType,
            amount: l.amount || 0,
            status: l.status,
            createdAt: l.createdAt
          }));
          break;
        }

        case 'complaint': {
          const filter = { createdAt: { $gte: sDate, $lte: eDate } };
          totalRecords = await Complaint.countDocuments(filter);
          const complaints = await Complaint.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('customer', 'name')
            .populate('provider', 'name')
            .populate('booking')
            .lean();

          reportData = complaints.map(c => ({
            complaintId: c.complaintId || c._id,
            bookingId: c.booking?.bookingId || c.booking?._id || 'N/A',
            customer: c.customer?.name || 'N/A',
            provider: c.provider?.name || 'N/A',
            title: c.title,
            category: c.category,
            status: c.status,
            createdAt: c.createdAt
          }));
          break;
        }

        case 'master_reconcile':
        default: {
          const filter = { createdAt: { $gte: sDate, $lte: eDate } };
          totalRecords = await Booking.countDocuments(filter);
          const bookings = await Booking.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pLimit)
            .populate('customer', 'name')
            .populate('provider', 'name')
            .lean();

          const bookingIds = bookings.map(b => b._id);
          const [txns, earnings, refunds, payouts] = await Promise.all([
            Transaction.find({ booking: { $in: bookingIds } }).lean(),
            ProviderEarning.find({ booking: { $in: bookingIds } }).lean(),
            Refund.find({ bookingId: { $in: bookingIds } }).lean(),
            PaymentRecord.find({ booking: { $in: bookingIds } }).lean()
          ]);

          const txnMap = {};
          txns.forEach(t => { txnMap[t.booking.toString()] = t; });
          const earningMap = {};
          earnings.forEach(e => { earningMap[e.booking.toString()] = e; });
          const refundMap = {};
          refunds.forEach(r => { refundMap[r.bookingId.toString()] = r; });
          const payoutMap = {};
          payouts.forEach(p => { if (p.booking) payoutMap[p.booking.toString()] = p; });

          reportData = bookings.map(b => {
            const bId = b._id.toString();
            const t = txnMap[bId] || {};
            const e = earningMap[bId] || {};
            const r = refundMap[bId] || {};
            const p = payoutMap[bId] || {};

            let reconStatus = 'MATCHED';
            if (t.razorpayPaymentId && Math.abs((t.amount || 0) - (b.totalAmount || 0)) > 0.01) reconStatus = 'PAYMENT_MISMATCH';
            else if (r.refundAmount > b.totalAmount) reconStatus = 'REFUND_MISMATCH';

            return {
              bookingId: b.bookingId || b._id,
              bookingTotal: b.totalAmount || 0,
              customerPaid: t.amount || b.onlinePaid + b.walletUsed || 0,
              platformCommission: b.commissionAmount || 0,
              providerEarning: b.providerEarnings || 0,
              walletAmount: b.walletUsed || 0,
              refundAmount: r.refundAmount || 0,
              payoutAmount: p.amount || 0,
              paymentMethod: b.paymentMethod,
              bookingStatus: b.status,
              paymentStatus: b.paymentStatus,
              reconciliationStatus: reconStatus
            };
          });
          break;
        }
      }

      res.status(200).json({
        success: true,
        reportType,
        summaryCards,
        dateRange: { startDate: sDate, endDate: eDate },
        pagination: {
          totalRecords,
          page: pNum,
          limit: pLimit,
          totalPages: Math.ceil(totalRecords / pLimit) || 1
        },
        data: reportData
      });

    } catch (error) {
      console.error('[PaymentService.getFinancialReportCenterData] Error:', error);
      res.status(500).json({ success: false, message: 'Server Error generating financial report center data' });
    }
  }



}

module.exports = PaymentService;

