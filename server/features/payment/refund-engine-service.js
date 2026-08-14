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
      const setting = await SystemSetting.findOne();
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
    } = params;

    console.log(`[RefundEngine] Processing refund request for Booking ${bookingId} from source: ${refundSource}`);

    // 1. Fetch Booking
    const booking = await Booking.findById(bookingId).populate('customer provider serviceId services.service');
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found for refund processing`);
    }

    const customerId = booking.customer?._id || booking.customer;
    if (!customerId) {
      throw new Error(`Customer details missing on booking ${bookingId}`);
    }

    // 2. Idempotency & Cumulative Over-Refund Check
    const priorRefunds = await Refund.find({
      bookingId: booking._id,
      refundStatus: { $in: ['completed', 'processing', 'approved'] },
    });

    const alreadyRefunded = priorRefunds.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
    const totalPaid = booking.totalAmount || 0;
    const remainingRefundable = Math.max(0, totalPaid - alreadyRefunded);

    if (alreadyRefunded >= totalPaid && totalPaid > 0) {
      console.warn(`Booking ${booking._id} already fully refunded (₹${alreadyRefunded} refunded of ₹${totalPaid})`);
      return {
        success: true,
        alreadyProcessed: true,
        refund: priorRefunds[0],
        message: 'Refund has already been fully completed for this booking.',
      };
    }

    const existingPendingRefund = await Refund.findOne({
      bookingId: booking._id,
      refundStatus: 'pending',
    });

    if (existingPendingRefund && !approvedBy) {
      console.warn(`Refund request already pending approval for booking ${booking._id}`);
      return {
        success: true,
        alreadyPending: true,
        refund: existingPendingRefund,
        message: 'Refund request is already pending admin approval.',
      };
    }

    // 3. Determine Original Payment Breakdown & Refund Amount
    let calculatedRefundAmount = overrideAmount !== undefined && overrideAmount !== null ? Number(overrideAmount) : remainingRefundable;

    if (booking.cancellationProgress && typeof booking.cancellationProgress.refundAmount === 'number') {
      calculatedRefundAmount = Math.min(booking.cancellationProgress.refundAmount, remainingRefundable);
    }

    if (calculatedRefundAmount <= 0) {
      console.log(`Refund amount is 0 for booking ${booking._id}. Skipping monetary transfer.`);
      return {
        success: true,
        refundAmount: 0,
        message: 'No monetary refund required (Refund amount is ₹0).',
      };
    }

    if (calculatedRefundAmount > remainingRefundable) {
      throw new Error(`Refund amount (₹${calculatedRefundAmount}) exceeds maximum refundable balance (₹${remainingRefundable})`);
    }

    // Proportional breakdown for Mixed / Wallet / Online Payments
    const walletPaid = booking.walletUsed || (booking.paymentMethod === 'wallet' ? totalPaid : 0);
    const onlinePaid = booking.onlinePaid || (booking.paymentMethod === 'online' ? totalPaid : Math.max(0, totalPaid - walletPaid));
    const ratio = totalPaid > 0 ? (calculatedRefundAmount / totalPaid) : 1;

    let walletRefundAmount = Math.round((walletPaid * ratio) * 100) / 100;
    let gatewayRefundAmount = Math.round((onlinePaid * ratio) * 100) / 100;

    // Adjust any rounding residue to match exact calculatedRefundAmount
    const totalSplit = walletRefundAmount + gatewayRefundAmount;
    if (totalSplit !== calculatedRefundAmount && calculatedRefundAmount > 0) {
      if (gatewayRefundAmount > 0) {
        gatewayRefundAmount = calculatedRefundAmount - walletRefundAmount;
      } else {
        walletRefundAmount = calculatedRefundAmount;
      }
    }

    // 4. Load System Settings & Evaluate Business Rules & Destination Choice
    const settings = await this.getRefundSettings();

    // Determine explicitly declared customer choice
    let customerChoice = userChoiceParam || (requestedDestination === 'wallet' ? 'wallet' : (requestedDestination === 'original_payment' ? 'original_payment' : 'none'));

    let destination = requestedDestination || customerChoice;

    // Rule 3: Wallet Payment -> Always Refund to Wallet
    if (booking.paymentMethod === 'wallet' || onlinePaid <= 0) {
      destination = 'wallet';
      customerChoice = customerChoice === 'none' ? 'wallet' : customerChoice;
      walletRefundAmount = calculatedRefundAmount;
      gatewayRefundAmount = 0;
    } 
    // Enforce Admin Restriction: Wallet Only Policy
    else if (settings.allowedDestinations === 'wallet_only' || settings.refundToWalletOnly || !settings.allowOriginalPaymentRefund) {
      destination = 'wallet';
      walletRefundAmount = calculatedRefundAmount;
      gatewayRefundAmount = 0;
    }
    // Enforce Admin Restriction: Gateway Only Policy
    else if (settings.allowedDestinations === 'gateway_only' || !settings.allowWalletRefund) {
      destination = 'original_payment';
      gatewayRefundAmount = Math.min(onlinePaid, calculatedRefundAmount);
      walletRefundAmount = calculatedRefundAmount - gatewayRefundAmount;
    }
    // Business Rule 2: Online Payment + Customer Choice: Wallet -> Credit Wallet ONLY (Do NOT call Razorpay)
    else if (customerChoice === 'wallet' || destination === 'wallet') {
      destination = 'wallet';
      walletRefundAmount = calculatedRefundAmount;
      gatewayRefundAmount = 0;
    }
    // Business Rule 1 & 4: Customer Choice: Original Payment Method
    else if (customerChoice === 'original_payment' || destination === 'original_payment') {
      if (walletPaid > 0 && onlinePaid > 0 && settings.allowHybridRefund) {
        // Hybrid: Online portion to original payment, wallet portion to wallet
        destination = 'hybrid';
      } else if (onlinePaid > 0) {
        destination = 'original_payment';
        gatewayRefundAmount = Math.min(onlinePaid, calculatedRefundAmount);
        walletRefundAmount = calculatedRefundAmount - gatewayRefundAmount;
      } else {
        destination = 'wallet';
        walletRefundAmount = calculatedRefundAmount;
        gatewayRefundAmount = 0;
      }
    }
    // Default fallback based on Admin Settings
    else {
      if (walletPaid > 0 && onlinePaid > 0 && settings.allowHybridRefund) {
        destination = 'hybrid';
      } else if (settings.defaultDestination === 'original_payment' && onlinePaid > 0) {
        destination = 'original_payment';
        gatewayRefundAmount = Math.min(onlinePaid, calculatedRefundAmount);
        walletRefundAmount = calculatedRefundAmount - gatewayRefundAmount;
      } else {
        destination = 'wallet';
        walletRefundAmount = calculatedRefundAmount;
        gatewayRefundAmount = 0;
      }
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

    const requiresManualApproval = !approvedBy && (!qualifiesForAutoRefund || settings.manualApprovalEnabled === false ? false : !qualifiesForAutoRefund);

    // 6. Extract Original Payment Identifiers
    const originalPaymentMethod = booking.paymentMethod || 'online';
    const razorpayPaymentId = booking.razorpayPaymentId || booking.paymentDetails?.razorpay_payment_id || null;
    const razorpayOrderId = booking.razorpayOrderId || booking.paymentDetails?.razorpay_order_id || null;

    // 7. Create or Update Refund Document
    let refundDoc = existingPendingRefund;
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

      await refundDoc.save();
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
      await refundDoc.save();
    }

    // Update Booking status tracking
    if (!booking.cancellationProgress) {
      booking.cancellationProgress = {};
    }
    booking.cancellationProgress.refundId = refundDoc.refundId;
    booking.cancellationProgress.refundStatus = refundDoc.refundStatus;
    booking.adminRefundDecision = refundDoc.refundStatus === 'approved' ? 'approved' : booking.adminRefundDecision;
    await booking.save();

    // 8. If manual approval is required and not approved yet, notify admin & return
    if (requiresManualApproval && refundDoc.refundStatus === 'pending') {
      console.log(`Refund ${refundDoc.refundId} queued for manual admin approval.`);
      notificationHelper.sendAdminNotification({
        title: 'New Refund Approval Required',
        message: `Refund of ₹${calculatedRefundAmount} requested for Booking #${booking.bookingId || booking._id}.`,
        type: 'refund_approval_required',
        metadata: { refundId: refundDoc.refundId, bookingId: booking._id, amount: calculatedRefundAmount },
      }).catch(err => console.error('Admin notification error:', err));

      return {
        success: true,
        requiresApproval: true,
        refund: refundDoc,
        message: 'Refund request registered and queued for Admin approval.',
      };
    }

    // 9. Execute Refund Dispatches (Wallet, Gateway, or Hybrid)
    return await this.executeRefundPayout(refundDoc, booking, settings, ip);
  }

  /**
   * Internal Method: Execute physical money transfer (Wallet credit, Gateway Refund, or Hybrid Split)
   */
  static async executeRefundPayout(refundDoc, booking, settings, ip = '') {
    refundDoc.refundStatus = 'processing';
    refundDoc.addTimelineStep('processing', 'System', `Initiating payout via ${refundDoc.actualRefundDestination || refundDoc.refundDestination}`);
    await refundDoc.save();

    const customerId = refundDoc.customerId;
    const totalRefund = refundDoc.refundAmount;

    try {
      // A. Process Wallet Credit Portion
      if (refundDoc.walletRefundAmount > 0 || refundDoc.actualRefundDestination === 'wallet' || refundDoc.refundDestination === 'wallet') {
        const walletCreditAmt = refundDoc.walletRefundAmount || (refundDoc.actualRefundDestination === 'wallet' ? totalRefund : 0);
        
        if (walletCreditAmt > 0) {
          const user = await User.findById(customerId);
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
            description: `Refund credited for Booking #${booking.bookingId || booking._id}`,
            bookingId: booking._id,
            createdAt: new Date(),
          });

          await user.save();

          const transaction = new Transaction({
            bookingId: booking._id,
            user: customerId,
            provider: booking.provider?._id || booking.provider || null,
            amount: walletCreditAmt,
            type: 'refund',
            paymentMethod: 'wallet',
            paymentStatus: 'completed',
            refundStatus: 'completed',
            refundReason: refundDoc.refundReason || 'Booking cancellation refund',
            refundedAt: new Date(),
            description: `Refund credited to Wallet for Booking #${booking.bookingId || booking._id}`,
          });
          await transaction.save();

          refundDoc.walletTransactionId = walletTxId;
          refundDoc.transactionId = transaction._id;
          refundDoc.addTimelineStep('completed', 'System', `₹${walletCreditAmt} credited to Customer Wallet`);
          refundDoc.addAuditLog('WALLET_REFUND_COMPLETED', customerId, 'system', { walletCreditAmt, walletTxId, balanceBefore, balanceAfter: newBalance }, ip);
        }
      }

      // B. Process Gateway Refund Portion (Rule 1 & 4)
      if (refundDoc.gatewayRefundAmount > 0 || refundDoc.actualRefundDestination === 'original_payment') {
        const gatewayAmt = refundDoc.gatewayRefundAmount || (refundDoc.actualRefundDestination === 'original_payment' ? totalRefund : 0);
        const razorpayPaymentId = refundDoc.gatewayPaymentId || booking.razorpayPaymentId;

        if (gatewayAmt > 0 && razorpayPaymentId && process.env.RAZORPAY_KEY_ID && !razorpayPaymentId.startsWith('pay_mock')) {
          console.log(`Initiating Razorpay refund for payment ${razorpayPaymentId}, amount: ₹${gatewayAmt}`);
          try {
            const razorpayResponse = await razorpay.payments.refund(razorpayPaymentId, {
              amount: Math.round(gatewayAmt * 100), // paise
              notes: {
                refundId: refundDoc.refundId,
                bookingId: String(booking._id),
                reason: refundDoc.refundReason || 'Customer refund',
                customerChoice: refundDoc.customerChoice || 'original_payment',
              },
            });

            refundDoc.gatewayRefundId = razorpayResponse.id;
            refundDoc.gatewayRefundAmount = gatewayAmt;
            refundDoc.gatewayResponse = razorpayResponse;
            refundDoc.addTimelineStep('completed', 'Gateway', `Gateway refund initiated via Razorpay (ID: ${razorpayResponse.id}) for ₹${gatewayAmt}`);
            refundDoc.addAuditLog('GATEWAY_REFUND_COMPLETED', refundDoc.approvedBy || customerId, 'gateway', { razorpayRefundId: razorpayResponse.id, gatewayAmt, response: razorpayResponse }, ip);
          } catch (rzpErr) {
            console.error('Razorpay API refund error:', rzpErr);
            
            // Rule 5: Fallback handling
            if (settings.allowWalletFallback !== false) {
              console.warn('Gateway error fallback: Crediting remaining refund portion to Customer Wallet (Rule 5)');
              const user = await User.findById(customerId);
              if (user) {
                user.wallet = user.wallet || { availableBalance: 0, walletTransactions: [], totalRefunded: 0 };
                user.wallet.availableBalance += gatewayAmt;
                user.wallet.totalRefunded += gatewayAmt;
                await user.save();
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
              await refundDoc.save();

              return {
                success: false,
                refund: refundDoc,
                error: refundDoc.failureReason,
              };
            }
          }
        }
      }

      // Complete refund status if not explicitly marked failed
      if (refundDoc.refundStatus !== 'failed') {
        refundDoc.refundStatus = 'completed';
        refundDoc.completedAt = new Date();
        refundDoc.processedBy = refundDoc.approvedBy || customerId;
        await refundDoc.save();
      }

      // 10. Update Booking & Cancellation Progress status
      booking.paymentStatus = 'refunded';
      if (!booking.cancellationProgress) {
        booking.cancellationProgress = {};
      }
      booking.cancellationProgress.status = 'refundcompleted';
      booking.cancellationProgress.refundAmount = totalRefund;
      booking.cancellationProgress.refundCompletedAt = new Date();
      booking.cancellationProgress.refundId = refundDoc.refundId;
      await booking.save();

      // 11. Re-align Provider Earnings & Escrow
      await this.realignProviderEarningsAndEscrow(booking, refundDoc);

      // 12. Send Customer Notifications
      const customer = await User.findById(customerId);
      if (customer) {
        notificationHelper.sendNotification({
          userId: customerId,
          title: 'Refund Processed',
          message: `Your refund of ₹${totalRefund} for Booking #${booking.bookingId || booking._id} has been processed (${refundDoc.walletRefundAmount > 0 ? `₹${refundDoc.walletRefundAmount} Wallet` : ''}${refundDoc.gatewayRefundAmount > 0 ? ` + ₹${refundDoc.gatewayRefundAmount} Gateway` : ''}).`,
          type: 'refund_completed',
          metadata: { refundId: refundDoc.refundId, bookingId: booking._id, amount: totalRefund },
        }).catch(err => console.error('Customer notification error:', err));
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

      notificationHelper.sendAdminNotification({
        title: 'Refund Execution Failed',
        message: `Refund ${refundDoc.refundId} of ₹${totalRefund} failed: ${err.message}`,
        type: 'refund_failed',
        metadata: { refundId: refundDoc.refundId, bookingId: booking._id },
      }).catch(e => console.error('Failure notification error:', e));

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
  static async realignProviderEarningsAndEscrow(booking, refundDoc) {
    try {
      if (!booking.provider) return;

      const ProviderEarning = mongoose.models.ProviderEarning;
      if (ProviderEarning) {
        const earning = await ProviderEarning.findOne({ booking: booking._id });
        if (earning && (earning.status === 'pending' || earning.status === 'on_hold')) {
          earning.status = 'cancelled';
          earning.cancelledAt = new Date();
          earning.cancellationReason = `Customer refund processed (${refundDoc.refundId})`;
          await earning.save();
          console.log(`Cancelled provider earning ${earning._id} due to refund ${refundDoc.refundId}`);
        }
      }
    } catch (err) {
      console.error('Error realigning provider earnings:', err);
    }
  }
}

module.exports = RefundEngineService;
