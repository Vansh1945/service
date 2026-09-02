const mongoose = require('mongoose');
const Refund = require('./refund-model');
const Booking = require('../booking/booking-model');
const User = require('../user/user-model');
const Transaction = require('./transaction-model');
const SystemSetting = require('../system-setting/system-setting-model');
const notificationHelper = require('../notification/notification-helper');
const razorpay = require('./razorpay');

class RefundEngineService {
  /**
   * Helper to generate unique Refund ID
   */
  static generateRefundId() {
    return `RFD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  /**
   * Fetch active System Settings for Refund Decision Engine
   */
  static async getRefundSettings() {
    try {
      const SystemConfigModel = SystemSetting.SystemConfig || SystemSetting;
      const setting = await SystemConfigModel.findOne();
      const ref = setting?.refundSettings || {};
      return {
        autoRefundEnabled: ref.autoRefundEnabled ?? true,
        manualApprovalEnabled: ref.manualApprovalEnabled ?? true,
        maxAutoRefundAmount: ref.maxAutoRefundAmount ?? 5000,
        defaultDestination: ref.defaultDestination ?? (setting?.walletSettings?.refundToWalletOnly ? 'wallet' : 'customer_choice'),
        allowWalletRefund: ref.allowWalletRefund ?? true,
        allowOriginalPaymentRefund: ref.allowOriginalPaymentRefund ?? true,
        allowedDestinations: ref.allowedDestinations ?? 'both',
        allowWalletFallback: ref.allowWalletFallback ?? true,
        allowHybridRefund: ref.allowHybridRefund ?? true,
        refundSlaHours: ref.refundSlaHours ?? 72,
        refundToWalletOnly: setting?.walletSettings?.refundToWalletOnly ?? false,
      };
    } catch (err) {
      console.error('Error loading system settings:', err);
      return {
        autoRefundEnabled: true,
        manualApprovalEnabled: true,
        maxAutoRefundAmount: 5000,
        defaultDestination: 'customer_choice',
        allowWalletRefund: true,
        allowOriginalPaymentRefund: true,
        allowedDestinations: 'both',
        allowWalletFallback: true,
        allowHybridRefund: true,
        refundSlaHours: 72,
        refundToWalletOnly: false,
      };
    }
  }

  /**
   * Booking-scoped remaining refundable balance calculation.
   * Deduplicates canonical Refund documents and unlinked legacy Transaction records.
   * Excludes excludeRefundId when validating an existing refund document.
   */
  static async calculateRemainingRefundable(booking, excludeRefundId = null, session = null) {
    const bookingId = booking._id;

    // 1. Query prior Refund records strictly scoped to bookingId
    let priorRefundsQuery = Refund.find({
      bookingId,
      refundStatus: { $in: ['completed', 'processing', 'approved'] },
    });
    if (session) priorRefundsQuery = priorRefundsQuery.session(session);
    const priorRefunds = await priorRefundsQuery.lean();

    // Exclude current refund if validating an existing document
    const filteredPriorRefunds = excludeRefundId
      ? priorRefunds.filter(r => r._id.toString() !== excludeRefundId.toString())
      : priorRefunds;

    const refundDocConsumed = filteredPriorRefunds.reduce((sum, r) => sum + (r.refundAmount || 0), 0);

    // Collect structured linked IDs to avoid double-counting with Transactions
    const linkedTxIds = filteredPriorRefunds.map(r => r.transactionId?.toString()).filter(Boolean);
    const linkedRefundIds = filteredPriorRefunds.map(r => r.refundId).filter(Boolean);

    // 2. Query unlinked legacy Transaction records strictly scoped to bookingId
    let unlinkedTxQuery = Transaction.find({
      booking: bookingId,
      type: 'refund',
      paymentStatus: 'completed',
      _id: { $nin: linkedTxIds },
    });
    if (session) unlinkedTxQuery = unlinkedTxQuery.session(session);
    const unlinkedTransactions = await unlinkedTxQuery.lean();

    const filteredUnlinkedTx = unlinkedTransactions.filter(tx => {
      if (!tx.description) return true;
      return !linkedRefundIds.some(rId => tx.description.includes(rId));
    });

    const unlinkedTxConsumed = filteredUnlinkedTx.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const alreadyRefunded = refundDocConsumed + unlinkedTxConsumed;

    // 3. Derive canonical paid base (reusing existing breakdown without double subtraction)
    const totalPaid = booking.totalAmount || 0;
    const totalPaidPaise = Math.round(totalPaid * 100);
    const alreadyRefundedPaise = Math.round(alreadyRefunded * 100);
    const remainingRefundablePaise = Math.max(0, totalPaidPaise - alreadyRefundedPaise);
    const remainingRefundable = remainingRefundablePaise / 100;

    return {
      totalPaid,
      alreadyRefunded,
      remainingRefundable,
      remainingRefundablePaise,
    };
  }

  /**
   * Primary Entry Point for all Refund Requests across the enterprise system
   */
  static async processRefundRequest(params) {
    const {
      bookingId,
      refundSource,
      refundDestination: requestedDestination,
      customerChoice: userChoiceParam,
      refundAmount: overrideAmount,
      cancellationReason = 'Cancellation / Refund request',
      refundReason = 'Booking cancellation refund',
      requestedBy = null,
      approvedBy = null,
      complaintId = null,
      isAutoTrigger = false,
      ip = '',
      session = null,
    } = params;

    const saveOpts = session ? { session } : {};

    console.log(`[RefundEngine] Processing refund request for Booking ${bookingId} from source: ${refundSource}`);

    // 1. Fetch Booking
    let bookingQuery = Booking.findById(bookingId)
      .populate('customer')
      .populate('provider')
      .populate({ path: 'services.service', strictPopulate: false });
    if (session) bookingQuery = bookingQuery.session(session);
    const booking = await bookingQuery;
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found for refund processing`);
    }

    const customerId = booking.customer?._id || booking.customer;
    if (!customerId) {
      throw new Error(`Customer details missing on booking ${bookingId}`);
    }

    let activeRefundQuery = Refund.findOne({
      bookingId: booking._id,
      refundStatus: { $in: ['draft', 'pending', 'approved', 'processing', 'completed'] },
    }).sort({ createdAt: -1 });
    if (session) activeRefundQuery = activeRefundQuery.session(session);
    const existingActiveRefund = await activeRefundQuery;

    // 2. Idempotency & Cumulative Over-Refund Check using Canonical Scoped Calculation
    const { totalPaid, alreadyRefunded, remainingRefundable, remainingRefundablePaise } =
      await this.calculateRemainingRefundable(booking, existingActiveRefund?._id, session);

    if (Math.round(alreadyRefunded * 100) >= Math.round(totalPaid * 100) && totalPaid > 0) {
      console.warn(`Booking ${booking._id} already fully refunded (₹${alreadyRefunded} refunded of ₹${totalPaid})`);
      let priorRefundQuery = Refund.findOne({ bookingId: booking._id, refundStatus: 'completed' });
      if (session) priorRefundQuery = priorRefundQuery.session(session);
      const priorRefund = await priorRefundQuery;
      return {
        success: true,
        alreadyProcessed: true,
        refund: priorRefund || existingActiveRefund,
        message: 'Refund has already been fully completed for this booking.',
      };
    }

    if (existingActiveRefund && existingActiveRefund.refundStatus === 'pending' && !approvedBy) {
      console.warn(`Refund request already pending approval for booking ${booking._id}`);
      return {
        success: true,
        alreadyPending: true,
        refund: existingActiveRefund,
        message: 'Refund request is already pending admin approval.',
      };
    }

    if (existingActiveRefund && existingActiveRefund.refundStatus === 'processing') {
      console.warn(`Refund request currently processing for booking ${booking._id}`);
      return await this.executeRefundPayout(existingActiveRefund, booking, await this.getRefundSettings(), ip, session);
    }

    // 3. Determine Original Payment Breakdown & Refund Amount
    let calculatedRefundAmount = overrideAmount !== undefined && overrideAmount !== null
      ? Number(overrideAmount)
      : (booking.cancellationProgress && typeof booking.cancellationProgress.refundAmount === 'number'
          ? Math.min(booking.cancellationProgress.refundAmount, remainingRefundable)
          : remainingRefundable);

    if (calculatedRefundAmount <= 0) {
      console.log(`Refund amount is 0 for booking ${booking._id}. Skipping monetary transfer.`);
      return {
        success: true,
        refundAmount: 0,
        message: 'No monetary refund required (Refund amount is ₹0).',
      };
    }

    const requestedPaise = Math.round(calculatedRefundAmount * 100);
    if (requestedPaise > remainingRefundablePaise) {
      throw new Error(`Refund amount (₹${calculatedRefundAmount}) exceeds maximum refundable balance (₹${remainingRefundable})`);
    }

    // 4. Load System Settings & Evaluate Business Rules & Destination Choice
    const settings = await this.getRefundSettings();

    // Determine explicitly declared customer/admin choice
    let customerChoice = userChoiceParam || (requestedDestination === 'wallet' ? 'wallet' : (requestedDestination === 'original_payment' ? 'original_payment' : 'none'));
    let destination = requestedDestination || customerChoice;

    const walletPaid = booking.walletUsed || (booking.paymentMethod === 'wallet' ? totalPaid : 0);
    const onlinePaid = booking.onlinePaid || (booking.paymentMethod === 'online' ? totalPaid : Math.max(0, totalPaid - walletPaid));

    const isMixed = booking.paymentMethod === 'mixed' || (walletPaid > 0 && onlinePaid > 0);
    const isPureWallet = booking.paymentMethod === 'wallet' || onlinePaid <= 0;
    const isCashSource = (booking.paymentMethod === 'cash' || booking.paymentMethod === 'cod');
    const isPureOnline = (booking.paymentMethod === 'online' || ['card', 'netbanking', 'upi', 'emi'].includes(booking.paymentMethod) || onlinePaid > 0) && !isMixed && !isPureWallet && !isCashSource;

    let walletRefundAmount = 0;
    let gatewayRefundAmount = 0;

    // Rule B: Explicit wallet selection by user/admin
    if (destination === 'wallet' || customerChoice === 'wallet') {
      destination = 'wallet';
      customerChoice = customerChoice === 'none' ? 'wallet' : customerChoice;
      walletRefundAmount = calculatedRefundAmount;
      gatewayRefundAmount = 0;
    }
    // Rule A.2: Original payment is Pure Wallet
    else if (isPureWallet) {
      destination = 'wallet';
      customerChoice = customerChoice === 'none' ? 'wallet' : customerChoice;
      walletRefundAmount = calculatedRefundAmount;
      gatewayRefundAmount = 0;
    }
    // Rule A.3: Original payment is Mixed (Wallet + Online) -> 100% Refund to Customer Wallet (No split/hybrid, no Razorpay API call)
    else if (isMixed) {
      destination = 'wallet';
      customerChoice = customerChoice === 'none' ? 'wallet' : customerChoice;
      walletRefundAmount = calculatedRefundAmount;
      gatewayRefundAmount = 0;
    }
    // Rule A.5: Cash / COD
    else if (isCashSource) {
      destination = 'wallet';
      walletRefundAmount = calculatedRefundAmount;
      gatewayRefundAmount = 0;
    }
    // Admin Policy Restriction: Wallet Only Policy
    else if (settings.allowedDestinations === 'wallet_only' || settings.refundToWalletOnly || !settings.allowOriginalPaymentRefund) {
      destination = 'wallet';
      walletRefundAmount = calculatedRefundAmount;
      gatewayRefundAmount = 0;
    }
    // Rule A.1: Pure Online Payment (Razorpay) with "original_payment" selected
    else if (isPureOnline && (destination === 'original_payment' || customerChoice === 'original_payment' || destination !== 'wallet')) {
      destination = 'original_payment';
      gatewayRefundAmount = calculatedRefundAmount;
      walletRefundAmount = 0;
    }
    // Rule A.4 / Default Fallback: Wallet refund
    else {
      destination = 'wallet';
      walletRefundAmount = calculatedRefundAmount;
      gatewayRefundAmount = 0;
    }

    // 5. Evaluate Auto vs Manual Approval Requirement
    const bookingStatus = (booking.status || '').toLowerCase();
    const autoEligibleStates = ['pending', 'searchingprovider', 'offered', 'cancelled'];
    const isAutoStateEligible = autoEligibleStates.includes(bookingStatus) || refundSource === 'provider_cancellation' || refundSource === 'auto_cancellation' || refundSource === 'failed_payment' || refundSource === 'duplicate_payment';

    const qualifiesForAutoRefund =
      settings.autoRefundEnabled &&
      isAutoStateEligible &&
      calculatedRefundAmount <= settings.maxAutoRefundAmount &&
      !booking.cancellationProgress?.penaltyApplied;

    const requiresManualApproval = !approvedBy && (!qualifiesForAutoRefund || settings.manualApprovalEnabled === true);

    // 6. Extract Original Payment Identifiers
    const originalPaymentMethod = booking.paymentMethod || 'online';
    let razorpayPaymentId = booking.razorpayPaymentId || 
                            booking.paymentVerification?.razorpayPaymentId || 
                            booking.paymentVerification?.paymentId || 
                            booking.paymentDetails?.razorpay_payment_id || 
                            booking.paymentDetails?.razorpayPaymentId || 
                            null;
    let razorpayOrderId = booking.razorpayOrderId || 
                          booking.paymentVerification?.razorpayOrderId || 
                          booking.paymentVerification?.orderId || 
                          booking.paymentDetails?.razorpay_order_id || 
                          booking.paymentDetails?.razorpayOrderId || 
                          null;

    if ((!razorpayPaymentId || !razorpayOrderId) && booking._id) {
      try {
        let txQuery = Transaction.findOne({
          booking: booking._id,
          paymentStatus: { $in: ['completed', 'paid', 'success'] }
        });
        if (session) txQuery = txQuery.session(session);
        const completedTx = await txQuery;
        if (completedTx) {
          razorpayPaymentId = razorpayPaymentId || completedTx.razorpayPaymentId || completedTx.paymentDetails?.razorpay_payment_id || null;
          razorpayOrderId = razorpayOrderId || completedTx.razorpayOrderId || completedTx.paymentDetails?.razorpay_order_id || null;
        }
      } catch (txErr) {
        console.warn('Transaction lookup fallback error during refund processing:', txErr.message);
      }
    }

    // 7. Create or Update Refund Document
    let refundDoc = existingActiveRefund;
    if (!refundDoc) {
      const refundId = this.generateRefundId();
      refundDoc = new Refund({
        refundId,
        bookingId: booking._id,
        customerId,
        providerId: booking.provider?._id || booking.provider || null,
        complaintId: complaintId || null,
        originalPaymentMethod,
        originalGateway: booking.paymentMethod === 'wallet' ? 'wallet' : 'razorpay',
        originalPaymentId: razorpayPaymentId,
        gatewayOrderId: razorpayOrderId,
        gatewayPaymentId: razorpayPaymentId,
        refundDestination: destination,
        customerChoice,
        actualRefundDestination: destination,
        refundMethod: destination === 'original_payment' ? 'razorpay' : (destination === 'hybrid' ? 'hybrid' : 'wallet'),
        refundSource,
        refundReason,
        cancellationReason,
        requestedAmount: totalPaid,
        refundAmount: calculatedRefundAmount,
        walletRefundAmount,
        gatewayRefundAmount,
        refundType: requiresManualApproval ? 'manual' : 'auto',
        refundStatus: requiresManualApproval ? 'pending' : 'approved',
        requestedBy: requestedBy || customerId,
        approvedBy: approvedBy || (requiresManualApproval ? null : customerId),
        approvedAt: approvedBy || !requiresManualApproval ? new Date() : null,
      });

      refundDoc.addTimelineStep(
        requiresManualApproval ? 'pending_approval' : 'approved',
        requestedBy ? 'User' : 'System',
        requiresManualApproval ? 'Submitted for admin refund approval' : 'Auto refund approved by system rules'
      );

      refundDoc.addAuditLog(
        requiresManualApproval ? 'REFUND_REQUESTED' : 'REFUND_AUTO_APPROVED',
        requestedBy || customerId,
        'user',
        { bookingId: booking._id, refundAmount: calculatedRefundAmount, destination, customerChoice, walletRefundAmount, gatewayRefundAmount, bookingStatus },
        ip
      );

      await refundDoc.save(saveOpts);
    } else if (approvedBy) {
      refundDoc.refundStatus = 'approved';
      refundDoc.approvedBy = approvedBy;
      refundDoc.approvedAt = new Date();
      refundDoc.customerChoice = customerChoice !== 'none' ? customerChoice : refundDoc.customerChoice;
      refundDoc.refundDestination = destination;
      refundDoc.actualRefundDestination = destination;
      refundDoc.walletRefundAmount = walletRefundAmount;
      refundDoc.gatewayRefundAmount = gatewayRefundAmount;
      refundDoc.addTimelineStep('approved', 'Admin', 'Refund manually approved by admin');
      refundDoc.addAuditLog('REFUND_APPROVED', approvedBy, 'admin', { approvedAmount: calculatedRefundAmount, customerChoice, destination }, ip);
      await refundDoc.save(saveOpts);
    }

    // Update Booking status tracking
    if (!booking.cancellationProgress) {
      booking.cancellationProgress = {};
    }
    booking.cancellationProgress.refundId = refundDoc.refundId;
    booking.cancellationProgress.refundStatus = refundDoc.refundStatus;
    booking.adminRefundDecision = refundDoc.refundStatus === 'approved' ? 'approved' : booking.adminRefundDecision;
    await booking.save(saveOpts);

    // 8. If manual approval is required and not approved yet, notify admin & return
    if (requiresManualApproval && refundDoc.refundStatus === 'pending') {
      console.log(`Refund ${refundDoc.refundId} queued for manual admin approval.`);
      if (notificationHelper.notifyAdmins) {
        notificationHelper.notifyAdmins(
          'New Refund Approval Required',
          `Refund of ₹${calculatedRefundAmount} requested for Booking #${booking.bookingId || booking._id}.`,
          'system',
          refundDoc._id
        ).catch(err => console.error('Admin notification error:', err));
      }

      return {
        success: true,
        requiresApproval: true,
        refund: refundDoc,
        message: 'Refund request registered and queued for Admin approval.',
      };
    }

    // 9. Execute Refund Dispatches (Wallet, Gateway, or Hybrid)
    return await this.executeRefundPayout(refundDoc, booking, settings, ip, session);
  }

  /**
   * Internal Method: Execute physical money transfer (Wallet credit, Gateway Refund, or Hybrid Split)
   */
  static async executeRefundPayout(refundDoc, booking, settings, ip = '', session = null) {
    if (!refundDoc) {
      throw new Error('Refund document is missing for payout execution.');
    }

    const saveOpts = session ? { session } : {};

    // ── RECOVERY ARCHITECTURE FOR PROCESSING STATE ──
    if (refundDoc.refundStatus === 'processing') {
      console.log(`[RefundEngine] Processing state recovery check for Refund ${refundDoc.refundId}`);
      
      // Verify Razorpay gateway state if gateway refund ID or payment ID exists
      if (refundDoc.gatewayRefundId || refundDoc.gatewayPaymentId) {
        const existingRzpRefund = await razorpay.fetchRazorpayRefund(refundDoc.gatewayRefundId, refundDoc.gatewayPaymentId, {
          amount: refundDoc.gatewayRefundAmount || refundDoc.refundAmount,
          localRefundId: refundDoc.refundId,
          idempotencyKey: refundDoc.idempotencyKey,
          createdAt: refundDoc.createdAt
        });
        if (existingRzpRefund && (existingRzpRefund.status === 'processed' || existingRzpRefund.status === 'completed')) {
          refundDoc.refundStatus = 'completed';
          refundDoc.completedAt = new Date();
          refundDoc.gatewayRefundId = existingRzpRefund.id || refundDoc.gatewayRefundId;
          refundDoc.addTimelineStep('completed', 'Gateway', 'Refund recovered: Gateway refund verified as processed.');
          await refundDoc.save(saveOpts);

          booking.paymentStatus = 'refunded';
          if (!booking.cancellationProgress) booking.cancellationProgress = {};
          booking.cancellationProgress.status = 'refundcompleted';
          await booking.save(saveOpts);

          return { success: true, refund: refundDoc, message: 'Processing refund recovered and finalized as completed.' };
        }
      }

      // Verify Wallet credit state
      if (refundDoc.walletTransactionId) {
        let userQuery = User.findById(refundDoc.customerId);
        if (session) userQuery = userQuery.session(session);
        const user = await userQuery;
        const hasWalletCredit = user?.wallet?.walletTransactions?.some(t => t.transactionId === refundDoc.walletTransactionId);
        if (hasWalletCredit) {
          refundDoc.refundStatus = 'completed';
          refundDoc.completedAt = new Date();
          refundDoc.addTimelineStep('completed', 'System', 'Refund recovered: Wallet transaction verified.');
          await refundDoc.save(saveOpts);

          booking.paymentStatus = 'refunded';
          if (!booking.cancellationProgress) booking.cancellationProgress = {};
          booking.cancellationProgress.status = 'refundcompleted';
          await booking.save(saveOpts);

          return { success: true, refund: refundDoc, message: 'Processing refund recovered and finalized as completed.' };
        }
      }
    } else if (refundDoc.refundStatus === 'completed') {
      return { success: true, refund: refundDoc, message: 'Refund has already been completed.' };
    } else if (refundDoc.refundStatus === 'rejected') {
      throw new Error(`Refund payout blocked: Refund ${refundDoc.refundId} is marked as rejected.`);
    } else if (refundDoc.refundStatus !== 'approved') {
      throw new Error(`Refund payout blocked: Refund ${refundDoc.refundId} is in '${refundDoc.refundStatus}' status (must be approved).`);
    }

    if (!refundDoc.approvedBy) {
      throw new Error(`Refund payout blocked: Refund ${refundDoc.refundId} lacks authorized admin approval.`);
    }

    // ── PRE-PAYOUT SERIAL BALANCE VERIFICATION ──
    const { remainingRefundablePaise } = await this.calculateRemainingRefundable(booking, refundDoc._id, session);
    const requestedPaise = Math.round(refundDoc.refundAmount * 100);
    if (requestedPaise > remainingRefundablePaise) {
      throw new Error(`Refund payout blocked: Requested amount (₹${refundDoc.refundAmount}) exceeds remaining refundable balance (₹${remainingRefundablePaise / 100}).`);
    }

    // Atomically claim processing status prior to money movement
    let claimedRefundDoc = await Refund.findOneAndUpdate(
      {
        _id: refundDoc._id,
        refundStatus: { $in: ['pending', 'approved'] }
      },
      {
        $set: {
          refundStatus: 'processing',
          updatedAt: new Date()
        },
        $push: {
          timeline: {
            status: 'processing',
            actor: 'System',
            notes: `Initiating payout via ${refundDoc.actualRefundDestination || refundDoc.refundDestination}`,
            timestamp: new Date()
          }
        }
      },
      { new: true, ...(session ? { session } : {}) }
    );

    if (!claimedRefundDoc) {
      // Re-read current state from DB because another request claimed or completed it
      let latestRefundQuery = Refund.findById(refundDoc._id);
      if (session) latestRefundQuery = latestRefundQuery.session(session);
      const latestRefund = await latestRefundQuery;

      if (latestRefund?.refundStatus === 'completed') {
        return { success: true, alreadyProcessed: true, refund: latestRefund, message: 'Refund has already been completed.' };
      } else if (latestRefund?.refundStatus === 'processing') {
        return { success: true, processing: true, refund: latestRefund, message: 'Refund is currently being processed.' };
      } else {
        throw new Error(`Refund payout blocked: Refund ${refundDoc._id} is in status '${latestRefund?.refundStatus || 'unknown'}'.`);
      }
    }

    refundDoc = claimedRefundDoc;

    const customerId = refundDoc.customerId;
    const totalRefund = refundDoc.refundAmount;

    try {
      // A. Process Wallet Credit Portion (Only if isWalletDestination AND walletTransactionId is NOT set)
      const isWalletDestination = (refundDoc.refundDestination === 'wallet' || refundDoc.actualRefundDestination === 'wallet' || refundDoc.walletRefundAmount > 0);
      const isOriginalRazorpayPayment = (refundDoc.actualRefundDestination === 'original_payment' || refundDoc.refundDestination === 'original_payment') && refundDoc.gatewayRefundAmount > 0 && !isWalletDestination;

      if (isWalletDestination && !refundDoc.walletTransactionId) {
        const walletCreditAmt = refundDoc.walletRefundAmount || totalRefund;

        if (walletCreditAmt > 0) {
          let userQuery = User.findById(customerId);
          if (session) userQuery = userQuery.session(session);
          const user = await userQuery;
          if (!user) {
            throw new Error(`Customer user ${customerId} not found for wallet credit`);
          }

          if (!user.wallet) {
            user.wallet = { availableBalance: 0, walletTransactions: [], totalRefunded: 0, lastUpdated: new Date() };
          }

          const balanceBefore = user.wallet.availableBalance || 0;
          const newBalance = balanceBefore + walletCreditAmt;

          user.wallet.availableBalance = newBalance;
          user.wallet.totalRefunded = (user.wallet.totalRefunded || 0) + walletCreditAmt;
          user.wallet.lastUpdated = new Date();

          const walletTxId = `WTX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

          user.wallet.walletTransactions.push({
            transactionId: walletTxId,
            type: 'credit',
            amount: walletCreditAmt,
            source: 'refund',
            reason: refundDoc.refundReason || 'Booking cancellation refund',
            description: `Refund credited for Booking #${booking.bookingId || booking._id}`,
            booking: booking._id,
            bookingId: booking.bookingId || null,
            createdAt: new Date(),
          });

          await user.save(saveOpts);

          const transaction = new Transaction({
            booking: booking._id,
            bookingId: booking.bookingId || booking._id.toString(),
            user: customerId,
            provider: booking.provider?._id || booking.provider || null,
            amount: walletCreditAmt,
            type: 'refund',
            entryType: 'debit',
            paymentMethod: 'wallet',
            paymentStatus: 'completed',
            refundStatus: 'completed',
            refundReason: refundDoc.refundReason || 'Booking cancellation refund',
            refundedAt: new Date(),
            description: `Refund credited to Wallet for Booking #${booking.bookingId || booking._id}`,
          });
          await transaction.save(saveOpts);

          refundDoc.walletRefundAmount = walletCreditAmt;
          refundDoc.gatewayRefundAmount = 0;
          refundDoc.refundDestination = 'wallet';
          refundDoc.actualRefundDestination = 'wallet';
          refundDoc.walletTransactionId = walletTxId;
          refundDoc.transactionId = transaction._id;
          refundDoc.addTimelineStep('completed', 'System', `₹${walletCreditAmt} credited to Customer Wallet`);
          refundDoc.addAuditLog('WALLET_REFUND_COMPLETED', customerId, 'system', { walletCreditAmt, walletTxId, balanceBefore, balanceAfter: newBalance }, ip);
        }
      }
      // B. Process Gateway Refund Portion (Only if isOriginalRazorpayPayment AND NOT a wallet destination)
      else if (isOriginalRazorpayPayment) {
        const gatewayAmt = refundDoc.gatewayRefundAmount || totalRefund;
        let razorpayPaymentId = refundDoc.gatewayPaymentId || 
                                refundDoc.originalPaymentId || 
                                booking.razorpayPaymentId || 
                                booking.paymentVerification?.razorpayPaymentId || 
                                booking.paymentVerification?.paymentId || 
                                booking.paymentDetails?.razorpay_payment_id || 
                                booking.paymentDetails?.razorpayPaymentId || 
                                null;

        if (!razorpayPaymentId && booking._id) {
          try {
            let txQuery = Transaction.findOne({
              booking: booking._id,
              paymentStatus: { $in: ['completed', 'paid', 'success'] }
            });
            if (session) txQuery = txQuery.session(session);
            const completedTx = await txQuery;
            if (completedTx) {
              razorpayPaymentId = completedTx.razorpayPaymentId || completedTx.paymentDetails?.razorpay_payment_id || null;
            }
          } catch (txErr) {
            console.warn('Transaction lookup fallback error in executeRefundPayout:', txErr.message);
          }
        }

        const isRealRazorpay = razorpayPaymentId && razorpayPaymentId.startsWith('pay_') && !razorpayPaymentId.startsWith('pay_mock');

        if (gatewayAmt > 0 && isRealRazorpay) {
          console.log(`Initiating Razorpay refund for payment ${razorpayPaymentId}, amount: ₹${gatewayAmt}`);
          
          // Ensure persisted idempotency key exists prior to gateway API call (Never generate a new key on retry)
          if (!refundDoc.idempotencyKey) {
            refundDoc.idempotencyKey = `IDEMP-REFUND-${refundDoc.refundId || refundDoc._id}`;
            await refundDoc.save(saveOpts);
          }

          // Recovery Pre-check: Check if gateway refund already exists for this payment before making API call
          let existingRzpRefund = null;
          if (refundDoc.gatewayRefundId) {
            existingRzpRefund = await razorpay.fetchRazorpayRefund(refundDoc.gatewayRefundId, null, {
              amount: gatewayAmt,
              localRefundId: refundDoc.refundId,
              idempotencyKey: refundDoc.idempotencyKey,
              createdAt: refundDoc.createdAt
            });
          }
          if (!existingRzpRefund && razorpayPaymentId) {
            existingRzpRefund = await razorpay.fetchRazorpayRefund(null, razorpayPaymentId, {
              amount: gatewayAmt,
              localRefundId: refundDoc.refundId,
              idempotencyKey: refundDoc.idempotencyKey,
              createdAt: refundDoc.createdAt
            });
          }

          try {
            let razorpayResponse;
            if (existingRzpRefund && existingRzpRefund.id) {
              console.log(`Gateway refund recovery: Found existing gateway refund ${existingRzpRefund.id}`);
              razorpayResponse = existingRzpRefund;
            } else {
              razorpayResponse = await razorpay.createRefundWithIdempotency(razorpayPaymentId, {
                amount: Math.round(gatewayAmt * 100), // paise
                notes: {
                  refundId: refundDoc.refundId,
                  bookingId: String(booking._id),
                  reason: refundDoc.refundReason || 'Customer refund',
                  customerChoice: refundDoc.customerChoice || 'original_payment',
                },
              }, refundDoc.idempotencyKey);
            }

            refundDoc.gatewayRefundId = razorpayResponse.id || refundDoc.gatewayRefundId;
            refundDoc.gatewayRefundAmount = gatewayAmt;
            refundDoc.gatewayResponse = razorpayResponse;
            refundDoc.addTimelineStep('completed', 'Gateway', `Gateway refund initiated via Razorpay (ID: ${razorpayResponse.id || 'recovered'}) for ₹${gatewayAmt}`);
            refundDoc.addAuditLog('GATEWAY_REFUND_COMPLETED', refundDoc.approvedBy || customerId, 'gateway', { razorpayRefundId: razorpayResponse.id, gatewayAmt, response: razorpayResponse }, ip);
          } catch (rzpErr) {
            console.error('Razorpay API refund error:', rzpErr);

            // Rule 5: Fallback handling vs Network Timeout
            const isTimeoutOrNetworkError = rzpErr.code === 'ECONNABORTED' || rzpErr.message?.includes('timeout') || rzpErr.message?.includes('network');
            
            if (isTimeoutOrNetworkError) {
              // Keep refundStatus = 'processing' (retryable state), do NOT set processed or failed on timeout
              refundDoc.refundStatus = 'processing';
              refundDoc.failureReason = `Gateway timeout: ${rzpErr.message}. Preserved as processing for safe retry.`;
              refundDoc.addTimelineStep('processing', 'Gateway', `Gateway timeout encountered. Saved idempotency key preserved for retry.`);
              await refundDoc.save(saveOpts);
              return {
                success: false,
                isRetryable: true,
                refund: refundDoc,
                error: refundDoc.failureReason
              };
            } else if (settings.allowWalletFallback !== false) {
              console.warn('Gateway error fallback: Crediting remaining refund portion to Customer Wallet (Rule 5)');
              let userQuery = User.findById(customerId);
              if (session) userQuery = userQuery.session(session);
              const user = await userQuery;
              if (user) {
                user.wallet = user.wallet || { availableBalance: 0, walletTransactions: [], totalRefunded: 0 };
                user.wallet.availableBalance += gatewayAmt;
                user.wallet.totalRefunded += gatewayAmt;
                await user.save(saveOpts);
              }
              refundDoc.walletRefundAmount = (refundDoc.walletRefundAmount || 0) + gatewayAmt;
              refundDoc.gatewayRefundAmount = 0;
              refundDoc.isFallbackUsed = true;
              refundDoc.fallbackReason = `Gateway error: ${rzpErr.message || 'Razorpay API error'}`;
              refundDoc.actualRefundDestination = 'wallet';
              refundDoc.refundMethod = 'fallback_wallet';
              refundDoc.addTimelineStep('completed', 'System', `Fallback Triggered (Rule 5): ₹${gatewayAmt} credited to Wallet due to gateway error`);
              refundDoc.addAuditLog('GATEWAY_REFUND_FALLBACK_WALLET', customerId, 'system', { fallbackAmount: gatewayAmt, error: rzpErr.message }, ip);
            } else {
              // Fallback disabled by Admin policy
              refundDoc.refundStatus = 'failed';
              refundDoc.failureReason = `Gateway error (Wallet fallback disabled by policy): ${rzpErr.message || 'Razorpay error'}`;
              refundDoc.isFallbackUsed = false;
              refundDoc.addTimelineStep('failed', 'Gateway', `Gateway refund failed: ${refundDoc.failureReason}`);
              refundDoc.addAuditLog('GATEWAY_REFUND_FAILED', customerId, 'gateway', { error: rzpErr.message }, ip);
              await refundDoc.save(saveOpts);

              return {
                success: false,
                refund: refundDoc,
                error: refundDoc.failureReason,
              };
            }
          }
        }
      }

      // Complete refund status upon successful payout dispatches
      refundDoc.refundStatus = 'completed';
      refundDoc.completedAt = new Date();
      refundDoc.processedBy = refundDoc.approvedBy || customerId;
      await refundDoc.save(saveOpts);

      // 10. Update Booking & Cancellation Progress status
      booking.paymentStatus = 'refunded';
      if (!booking.cancellationProgress) {
        booking.cancellationProgress = {};
      }
      booking.cancellationProgress.status = 'refundcompleted';
      booking.cancellationProgress.refundAmount = totalRefund;
      booking.cancellationProgress.refundCompletedAt = new Date();
      booking.cancellationProgress.refundId = refundDoc.refundId;
      await booking.save(saveOpts);

      // Expose refund state directly on the canonical original payment Transaction record
      try {
        let origTxnQuery = Transaction.findOne({ booking: booking._id, type: 'payment' });
        if (session) origTxnQuery = origTxnQuery.session(session);
        const origTxn = await origTxnQuery;

        if (origTxn) {
          const newRefundAmount = refundDoc.refundAmount || 0;
          const currentRefunded = (origTxn.refundedAmount || 0) + newRefundAmount;
          const totalPaidBase = origTxn.totalPaidAmount || origTxn.amount || booking.totalAmount || 0;
          const isFullRefund = Math.round(currentRefunded * 100) >= Math.round(totalPaidBase * 100);

          origTxn.refundedAmount = currentRefunded;
          origTxn.refundStatus = isFullRefund ? 'completed' : 'partial';
          if (isFullRefund) {
            origTxn.paymentStatus = 'refunded';
          }
          origTxn.refundedAt = new Date();
          origTxn.refundReason = refundDoc.refundReason || origTxn.refundReason;
          if (refundDoc.gatewayRefundId) origTxn.gatewayRefundId = refundDoc.gatewayRefundId;
          if (refundDoc.walletTransactionId) origTxn.walletRefundReference = refundDoc.walletTransactionId;
          await origTxn.save(saveOpts);
        }
      } catch (txErr) {
        console.warn('[RefundEngine] Original transaction refund state update error:', txErr.message);
      }

      // 11. Re-align Provider Earnings & Escrow
      await this.realignProviderEarningsAndEscrow(booking, refundDoc, session);

      // 12. Send Customer Notifications & Email (Resolves Admin Rule-Based Templates)
      const customer = await User.findById(customerId);
      if (customer) {
        const refundContext = {
          bookingId: booking.bookingId || booking._id?.toString(),
          amount: totalRefund,
          refundId: refundDoc.refundId,
          walletRefundAmount: refundDoc.walletRefundAmount || 0,
          gatewayRefundAmount: refundDoc.gatewayRefundAmount || 0,
          refundDestination: refundDoc.walletRefundAmount > 0 && refundDoc.gatewayRefundAmount > 0
            ? 'Wallet & Gateway'
            : (refundDoc.walletRefundAmount > 0 ? 'Customer Wallet' : 'Original Payment Method'),
          customerName: customer.name || 'Customer'
        };

        notificationHelper.sendNotification({
          userId: customerId,
          role: 'customer',
          title: 'Refund Processed',
          message: refundContext,
          type: 'payment',
          eventId: 'refund_completed',
          idempotencyKey: `refund_completed:${customerId}:${refundDoc._id}`,
          metadata: { refundId: refundDoc.refundId, bookingId: booking._id, amount: totalRefund },
        }).catch(err => console.error('Customer notification error:', err));

        if (customer.email) {
          try {
            const { sendMail } = require('../../shared/utils/sendmail');
            sendMail({
              to: customer.email,
              templateType: 'refundCompleted',
              variables: refundContext
            }).catch(emailErr => console.error('Customer refund email dispatch error:', emailErr));
          } catch (mErr) { }
        }
      }

      return {
        success: true,
        refund: refundDoc,
        message: `Refund of ₹${totalRefund} successfully completed.`,
      };

    } catch (err) {
      console.error(`Error executing refund payout for ${refundDoc.refundId}:`, err);
      refundDoc.refundStatus = 'failed';
      refundDoc.failureReason = err.message || 'Refund payout execution failed';
      refundDoc.addTimelineStep('failed', 'System', `Payout failed: ${refundDoc.failureReason}`);
      refundDoc.addAuditLog('REFUND_FAILED', customerId, 'system', { error: err.message }, ip);
      await refundDoc.save();

      if (notificationHelper.notifyAdmins) {
        notificationHelper.notifyAdmins(
          'Refund Execution Failed',
          `Refund ${refundDoc.refundId} of ₹${totalRefund} failed: ${err.message}`,
          'system',
          refundDoc._id
        ).catch(e => console.error('Failure notification error:', e));
      }

      return {
        success: false,
        refund: refundDoc,
        error: err.message,
      };
    }
  }

  /**
   * Re-align Provider Earnings & Escrow when refund occurs
   */
  static async realignProviderEarningsAndEscrow(booking, refundDoc, session = null) {
    try {
      if (!booking.provider) return;

      const ProviderEarning = mongoose.models.ProviderEarning;
      const Transaction = mongoose.models.Transaction;
      const Provider = mongoose.models.Provider;

      const saveOpts = session ? { session } : {};

      if (ProviderEarning) {
        let earningQuery = ProviderEarning.findOne({ booking: booking._id });
        if (session) earningQuery = earningQuery.session(session);
        const earning = await earningQuery;
        if (earning) {
          const originalStatus = earning.status;
          earning.status = 'cancelled';
          earning.cancelledAt = new Date();
          earning.cancellationReason = `Customer refund processed (${refundDoc.refundId})`;
          await earning.save(saveOpts);
          console.log(`Cancelled provider earning ${earning._id} (original status: ${originalStatus}) due to refund ${refundDoc.refundId}`);

          const providerId = booking.provider._id || booking.provider;

          if (['held', 'pendingrelease', 'underreview'].includes(originalStatus)) {
            // Provider money was never released to available balance. No wallet debit needed.
            console.log(`[RefundRecovery] Earning was in ${originalStatus} status for booking ${booking._id}. Zero wallet debit needed.`);
          } else if (originalStatus === 'available') {
            // Released earnings: recover remaining unrecovered netAmount
            const previousRecoveries = Transaction ? await Transaction.find({
              booking: booking._id,
              type: 'refundrecovery'
            }) : [];
            const alreadyRecovered = previousRecoveries.reduce((sum, t) => sum + (t.amount || 0), 0);
            const remainingRecoverableExposure = Math.max(0, (earning.netAmount || 0) - alreadyRecovered);

            if (remainingRecoverableExposure > 0 && Transaction && Provider) {
              const tx = new Transaction({
                booking: booking._id,
                bookingId: booking.bookingId || booking._id.toString(),
                provider: providerId,
                amount: remainingRecoverableExposure,
                type: 'refundrecovery',
                ledgerType: 'adjustment',
                entryType: 'debit',
                paymentStatus: 'completed',
                description: `Refund recovery (available status) for Booking #${booking.bookingId || booking._id}`
              });
              await tx.save();
            }
          } else if (originalStatus === 'paid') {
            // CASH booking: customer paid provider in cash.
            const existingDeduction = Transaction ? await Transaction.findOne({
              booking: booking._id,
              type: 'commissiondeduction'
            }) : null;
            const previousRecoveries = Transaction ? await Transaction.find({
              booking: booking._id,
              type: 'refundrecovery'
            }) : [];
            const alreadyRecovered = previousRecoveries.reduce((sum, t) => sum + (t.amount || 0), 0);

            const cashCollectedByProvider = booking.totalAmount || 0;
            const cashCommissionPaidByProvider = existingDeduction ? existingDeduction.amount : 0;
            const netCashKeptByProvider = Math.max(0, cashCollectedByProvider - cashCommissionPaidByProvider);

            const remainingRecoverableExposure = Math.max(0, netCashKeptByProvider - alreadyRecovered);

            if (remainingRecoverableExposure > 0 && Transaction && Provider) {
              const tx = new Transaction({
                booking: booking._id,
                bookingId: booking.bookingId || booking._id.toString(),
                provider: providerId,
                amount: remainingRecoverableExposure,
                type: 'refundrecovery',
                ledgerType: 'adjustment',
                entryType: 'debit',
                paymentStatus: 'completed',
                description: `Refund recovery (cash/paid status) for Booking #${booking.bookingId || booking._id}`
              });
              await tx.save();
            }
          } else if (originalStatus === 'withdrawn') {
            // Withdrawn earnings: record remaining recovery exposure using refundrecovery ledger
            const previousRecoveries = Transaction ? await Transaction.find({
              booking: booking._id,
              type: 'refundrecovery'
            }) : [];
            const alreadyRecovered = previousRecoveries.reduce((sum, t) => sum + (t.amount || 0), 0);
            const remainingRecoverableExposure = Math.max(0, (earning.netAmount || 0) - alreadyRecovered);

            if (remainingRecoverableExposure > 0 && Transaction && Provider) {
              const tx = new Transaction({
                booking: booking._id,
                bookingId: booking.bookingId || booking._id.toString(),
                provider: providerId,
                amount: remainingRecoverableExposure,
                type: 'refundrecovery',
                ledgerType: 'adjustment',
                entryType: 'debit',
                paymentStatus: 'completed',
                description: `Refund recovery (withdrawn status) for Booking #${booking.bookingId || booking._id}`
              });
              await tx.save();
            }
          }

          // Sync provider wallet balance immediately to reflect cancelled earning and recovery
          const PaymentService = require('./payment-service');
          await PaymentService.syncProviderEarnings(providerId);
        }
      }
    } catch (err) {
      console.error('Error realigning provider earnings:', err);
    }
  }
}

module.exports = RefundEngineService;
