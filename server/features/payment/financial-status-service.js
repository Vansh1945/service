/**
 * Financial Status Service
 * Central canonical source-of-truth status normalization for Payments, Settlements,
 * Transactions, Bookings, and Reconciliations.
 */

/**
 * Normalizes values to integer paise for exact financial comparisons.
 */
function toPaise(val) {
  if (val === null || val === undefined || isNaN(val) || !isFinite(val)) return null;
  const num = Number(val);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

/**
 * Normalizes payment display status
 */
function getPaymentDisplayStatus(paymentStatus) {
  const ps = String(paymentStatus || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['success', 'completed', 'paid', 'captured'].includes(ps)) return 'Captured';
  if (['failed', 'rejected', 'cancelled'].includes(ps)) return 'Failed';
  if (['pending', 'unpaid'].includes(ps)) return 'Pending';
  if (['processing'].includes(ps)) return 'Processing';
  if (['refunded', 'refund'].includes(ps)) return 'Refunded';
  return 'Pending';
}

/**
 * Normalizes settlement status & display status
 */
function getSettlementInfo(txn, booking) {
  const pMethod = String(txn?.paymentMethod || booking?.paymentMethod || '').toLowerCase();
  const isCash = pMethod === 'cash' || pMethod === 'cod';

  if (isCash) {
    return {
      settlementStatus: 'N/A',
      settlementDisplayStatus: 'N/A',
      settlementDate: null,
      razorpaySettlementId: null
    };
  }

  const pStatus = String(txn?.paymentStatus || booking?.paymentStatus || '').toLowerCase();
  const isCaptured = ['success', 'completed', 'paid', 'captured'].includes(pStatus);
  const hasSettlementId = Boolean(txn?.razorpaySettlementId);
  const hasSettlementAmount = txn?.settlementAmount !== null && txn?.settlementAmount !== undefined;

  // Authoritative non-circular settlement proof: Captured + Individual razorpaySettlementId + Actual settlement amount
  const isSettled = isCaptured && hasSettlementId && hasSettlementAmount;

  if (isSettled) {
    return {
      settlementStatus: 'settled',
      settlementDisplayStatus: 'Settled',
      settlementDate: txn?.settlementDate || null,
      razorpaySettlementId: txn?.razorpaySettlementId || null
    };
  }

  const rawStatus = String(txn?.settlementStatus || '').toLowerCase();
  if (['failed', 'rejected'].includes(rawStatus)) {
    return {
      settlementStatus: 'failed',
      settlementDisplayStatus: 'Failed',
      settlementDate: null,
      razorpaySettlementId: null
    };
  }

  return {
    settlementStatus: 'queued',
    settlementDisplayStatus: 'Pending Settlement',
    settlementDate: null,
    razorpaySettlementId: null
  };
}

/**
 * Normalizes payment method display
 */
function getPaymentMethodDisplay(paymentMethod, razorpayResponse, booking) {
  const pm = String(paymentMethod || booking?.paymentMethod || '').toLowerCase();
  if (pm === 'cash' || pm === 'cod') return 'Cash';
  if (pm === 'mixed') return 'Mixed';
  if (pm === 'wallet') return 'Wallet';

  const isQr = booking?.paymentVerification?.method === 'qr_code' || Boolean(booking?.paymentVerification?.qrCodeId);
  if (isQr) return 'QR';

  const subMethod = String(razorpayResponse?.method || pm).toLowerCase();
  if (subMethod === 'upi') return 'UPI';
  if (subMethod === 'card') return 'Card';
  if (subMethod === 'netbanking') return 'Netbanking';
  if (subMethod === 'emi') return 'EMI';
  if (subMethod === 'wallet') return 'Gateway Wallet';
  return 'Online';
}

/**
 * Customer / Component Payment Reconciliation Status
 */
function getCustomerReconciliationStatus(txn, booking) {
  const pStatus = String(txn?.paymentStatus || booking?.paymentStatus || '').toLowerCase();
  const isEffective = ['success', 'completed', 'paid', 'captured'].includes(pStatus);
  const pMethod = String(txn?.paymentMethod || booking?.paymentMethod || '').toLowerCase();
  const isCash = pMethod === 'cash' || pMethod === 'cod';

  // 1. Cash Component Reconciliation
  if (isCash) {
    const isStrongVerified = Boolean(
      booking?.paymentVerification?.status === 'verified' ||
      booking?.cashCollectionVerified === true
    );

    const expectedCashAmount = booking?.cashToPay ?? booking?.totalAmount ?? txn?.amount ?? 0;
    const expectedCashPaise = toPaise(expectedCashAmount);

    const verifiedAmount = booking?.paymentVerification?.verifiedAmount ?? booking?.verifiedAmount ?? txn?.verifiedAmount ?? (isStrongVerified ? (txn?.amount ?? booking?.cashToPay ?? booking?.totalAmount) : null);
    const verifiedPaise = toPaise(verifiedAmount);

    if (isStrongVerified) {
      if (verifiedPaise !== null) {
        if (verifiedPaise === expectedCashPaise) {
          return 'MATCHED';
        }
        return 'CASH_MISMATCH';
      }
      return 'PENDING_VERIFICATION';
    }

    const isCollectionReported = Boolean(
      booking?.paymentVerification?.method === 'cash_received' ||
      booking?.status === 'completed'
    );

    if (isCollectionReported) {
      return 'PENDING_VERIFICATION';
    }

    return 'PENDING_COLLECTION';
  }

  // 2. Online / Gateway Component Reconciliation
  if (isEffective) {
    const rPaymentId = txn?.razorpayPaymentId || booking?.paymentVerification?.razorpayPaymentId;
    if (!rPaymentId) {
      return 'MISSING_GATEWAY_RECORD';
    }

    const expectedComponentAmount = (booking?.paymentMethod === 'mixed' && booking?.onlinePaid != null)
      ? booking.onlinePaid
      : (booking?.totalAmount ?? txn?.amount ?? 0);
    const expectedPaise = toPaise(expectedComponentAmount);
    const paidPaise = toPaise(txn?.amount ?? 0);

    if (paidPaise !== null && expectedPaise !== null && paidPaise === expectedPaise) {
      return 'MATCHED';
    }

    return 'AMOUNT_MISMATCH';
  }

  return 'UNRECONCILED';
}

/**
 * Gateway Settlement Reconciliation Status (Independent Math Validation)
 */
function getGatewaySettlementReconciliationStatus(txn, booking) {
  const pMethod = String(txn?.paymentMethod || booking?.paymentMethod || '').toLowerCase();
  const isCash = pMethod === 'cash' || pMethod === 'cod';

  if (isCash) {
    return 'N/A';
  }

  const pStatus = String(txn?.paymentStatus || booking?.paymentStatus || '').toLowerCase();
  const isEffective = ['success', 'completed', 'paid', 'captured'].includes(pStatus);

  if (!isEffective) {
    return 'NOT_RECONCILED';
  }

  const hasSettlementId = Boolean(txn?.razorpaySettlementId);
  const actualNetPaise = toPaise(txn?.netSettlementAmount ?? (txn?.settlementAmount > 0 ? txn.settlementAmount : null));

  // If no settlement record or settlement amount attached from gateway recon yet
  if (!hasSettlementId || actualNetPaise === null) {
    return 'PENDING_GATEWAY';
  }

  const actualGross = txn?.actualRazorpayGrossAmount ?? txn?.gatewayGrossAmount ?? (txn?.razorpayResponse?.amount != null ? (txn.razorpayResponse.amount / 100) : (typeof txn?.amount === 'number' ? txn.amount : null));
  const fee = txn?.gatewayFee;
  const tax = txn?.gatewayTax;
  const adjustment = txn?.gatewayAdjustment;

  // Breakdown data availability check: if any required field is missing (null or undefined), breakdown is incomplete
  if (actualGross === undefined || actualGross === null || fee === undefined || fee === null || tax === undefined || tax === null) {
    return 'PENDING_GATEWAY';
  }

  const actualGrossPaise = toPaise(actualGross);
  const feePaise = toPaise(fee);
  const taxPaise = toPaise(tax);
  const adjustmentPaise = (adjustment !== undefined && adjustment !== null) ? toPaise(adjustment) : 0;

  if (actualGrossPaise === null || feePaise === null || taxPaise === null || adjustmentPaise === null) {
    return 'PENDING_GATEWAY';
  }

  const expectedNetPaise = actualGrossPaise - feePaise - taxPaise + adjustmentPaise;

  if (actualNetPaise === expectedNetPaise) {
    return 'MATCHED';
  }

  return 'SETTLEMENT_MISMATCH';
}

/**
 * Booking-Level Aggregate Reconciliation Status for Mixed Payments
 */
function getBookingAggregateReconciliationStatus(booking, transactions = []) {
  if (!booking) return 'UNRECONCILED';

  const bookingTotalPaise = toPaise(booking.totalAmount || booking.finalAmount || 0);
  let totalPaidPaise = 0;

  for (const txn of transactions) {
    const ps = String(txn.paymentStatus || '').toLowerCase();
    if (['success', 'completed', 'paid', 'captured'].includes(ps)) {
      totalPaidPaise += (toPaise(txn.amount) || 0);
    }
  }

  if (totalPaidPaise === bookingTotalPaise) {
    return 'MATCHED';
  }

  return 'AMOUNT_MISMATCH';
}

/**
 * Legacy getReconciliationStatus wrapper for backwards compatibility
 */
function getReconciliationStatus(txn, booking) {
  return getCustomerReconciliationStatus(txn, booking);
}

/**
 * Canonical Financial Status Builder
 */
function buildCanonicalFinancialStatus(txn, booking) {
  const paymentStatus = txn?.paymentStatus || booking?.paymentStatus || 'pending';
  const paymentDisplayStatus = getPaymentDisplayStatus(paymentStatus);
  const settlementInfo = getSettlementInfo(txn, booking);
  const reconciliationStatus = getCustomerReconciliationStatus(txn, booking);
  const gatewayReconciliationStatus = getGatewaySettlementReconciliationStatus(txn, booking);
  const paymentMethodDisplay = getPaymentMethodDisplay(txn?.paymentMethod || booking?.paymentMethod, txn?.razorpayResponse, booking);

  const gatewayPaymentId = txn?.razorpayPaymentId || booking?.paymentVerification?.razorpayPaymentId || null;
  const gatewayOrderId = txn?.razorpayOrderId || null;
  const isEffective = ['success', 'completed', 'paid', 'captured'].includes(String(paymentStatus).toLowerCase());
  const gatewayStatus = isEffective ? 'captured' : (paymentStatus === 'failed' ? 'failed' : 'pending');

  return {
    paymentStatus,
    paymentDisplayStatus,
    bookingPaymentStatus: booking?.paymentStatus || paymentStatus,
    settlementStatus: settlementInfo.settlementStatus,
    settlementDisplayStatus: settlementInfo.settlementDisplayStatus,
    settlementDate: settlementInfo.settlementDate,
    razorpaySettlementId: settlementInfo.razorpaySettlementId,
    reconciliationStatus,
    gatewayReconciliationStatus,
    paymentMethodDisplay,
    gatewayStatus,
    gatewayPaymentId,
    gatewayOrderId,
    transactionId: txn?.transactionId || (txn?._id ? txn._id.toString() : null),
    bookingId: booking?.bookingId || txn?.bookingId || (booking?._id ? booking._id.toString() : null)
  };
}

module.exports = {
  toPaise,
  getPaymentDisplayStatus,
  getSettlementInfo,
  getPaymentMethodDisplay,
  getCustomerReconciliationStatus,
  getGatewaySettlementReconciliationStatus,
  getBookingAggregateReconciliationStatus,
  getReconciliationStatus,
  buildCanonicalFinancialStatus
};
