/**
 * Resolves current booking state into a UI-friendly progress status.
 * @param {Object} booking - The booking document or object
 * @returns {String} - The progress status identifier
 */
const getBookingProgress = (booking) => {
  if (!booking) return 'unknown';

  const { status, paymentStatus, provider, disputeRaised, completedAt } = booking;

  // 1. Dispute has highest priority for UI
  if (disputeRaised === true) {
    return 'disputed';
  }

  // 2. Map based on current internal status
  switch (status) {
    case 'pending':
      if (paymentStatus !== 'paid' && paymentStatus !== 'escrow_hold') {
        return 'pending_payment';
      }
      return 'confirmed';

    case 'scheduled':
      if (provider) {
        return 'assigned';
      }
      return 'scheduled'; // Fallback if no provider but scheduled

    case 'accepted':
      return 'provider_traveling';

    case 'in-progress':
      return 'in_progress';

    case 'completed':
      // Dynamic review logic using payoutHoldUntil
      if (booking.payoutHoldUntil) {
        const now = new Date();
        if (new Date(booking.payoutHoldUntil) > now) {
          return 'completed_pending_review';
        }
      }
      return 'completed';

    case 'cancelled':
      return 'cancelled';

    default:
      return status || 'unknown';
  }
};

/**
 * Generates a dynamic timeline for the booking based on existing fields.
 * @param {Object} booking - The booking document
 * @param {String} payoutStatus - The payout status string from getPayoutStatus
 * @returns {Array} - Array of timeline steps
 * */
const getBookingTimeline = (booking, payoutStatus = '') => {
  if (!booking) return [];

  const statusHistory = booking.statusHistory || [];

  const getStatusTime = (statusName) => {
    const normalize = (s) => s?.toLowerCase().replace(/[^a-z]/g, '') || '';
    const target = normalize(statusName);
    const history = [...statusHistory].reverse().find(h => normalize(h.status) === target);
    return history ? history.timestamp : null;
  };

  const getOTPVerifiedTime = () => {
    const history = [...statusHistory].find(h => h.note && h.note.includes('Verification successful'));
    return history ? history.timestamp : null;
  };

  const steps = [];

  // 1. Booking Created
  steps.push({
    title: "Booking Created",
    completed: true,
    time: booking.createdAt,
    status: 'completed'
  });

  // 2. Provider Assigned
  const isAssigned = !!booking.provider;
  steps.push({
    title: isAssigned ? `Provider Assigned: ${booking.provider?.name || 'Assigned'}` : "Provider Assigned",
    completed: isAssigned,
    time: isAssigned ? (getStatusTime('assigned') || getStatusTime('scheduled') || booking.updatedAt) : null,
    status: isAssigned ? 'completed' : 'pending'
  });

  // BOOKING STATUS STATE MACHINE UPGRADE
  const bStatus = (booking.status || '').toLowerCase().replace(/[^a-z]/g, '');

  // 3. Provider Accepted
  const isAccepted = ['accepted', 'ontheway', 'arrived', 'started', 'inprogress', 'completed'].includes(bStatus);
  steps.push({
    title: "Provider Accepted",
    completed: isAccepted,
    time: isAccepted ? getStatusTime('accepted') : null,
    status: isAccepted ? 'completed' : 'pending'
  });

  // 4. Provider Arrived
  const isArrived = ['arrived', 'started', 'inprogress', 'completed'].includes(bStatus);
  steps.push({
    title: "Provider Arrived",
    completed: isArrived,
    time: isArrived ? getStatusTime('arrived') : null,
    status: isArrived ? 'completed' : 'pending'
  });

  // 5. OTP Verified
  const isOtpVerified = ['started', 'inprogress', 'completed'].includes(bStatus) || !!getOTPVerifiedTime();
  steps.push({
    title: "OTP Verified",
    completed: isOtpVerified,
    time: isOtpVerified ? (getOTPVerifiedTime() || getStatusTime('started') || getStatusTime('inprogress')) : null,
    status: isOtpVerified ? 'completed' : 'pending'
  });

  // 6. Work Started
  const isStarted = ['started', 'inprogress', 'completed'].includes(bStatus);
  steps.push({
    title: "Work Started",
    completed: isStarted,
    time: booking.serviceStartedAt || getStatusTime('started') || getStatusTime('inprogress'),
    status: isStarted ? 'completed' : 'pending'
  });

  // 7. Images Uploaded
  const hasImages = !!((booking.providerWorkProof?.beforeImages?.length > 0) || (booking.providerWorkProof?.afterImages?.length > 0));
  steps.push({
    title: "Images Uploaded",
    completed: hasImages,
    time: hasImages ? (booking.providerWorkProof?.beforeImages?.[0]?.uploadedAt || booking.providerWorkProof?.afterImages?.[0]?.uploadedAt || booking.serviceStartedAt) : null,
    status: hasImages ? 'completed' : 'pending'
  });

  // 8. Work Completed
  const isCompleted = bStatus === 'completed';
  steps.push({
    title: "Work Completed",
    completed: isCompleted,
    time: booking.serviceCompletedAt || getStatusTime('completed'),
    status: isCompleted ? 'completed' : 'pending'
  });

  // 9. Payment Completed
  const isPaid = ['paid', 'escrow_hold'].includes(booking.paymentStatus);
  steps.push({
    title: "Payment Completed",
    completed: isPaid,
    time: isPaid ? (booking.paymentDate || booking.updatedAt) : null,
    status: isPaid ? 'completed' : 'pending'
  });

  // 10. Commission Calculated
  steps.push({
    title: "Commission Calculated",
    completed: isCompleted,
    time: isCompleted ? (booking.serviceCompletedAt || getStatusTime('completed')) : null,
    status: isCompleted ? 'completed' : 'pending'
  });

  // 11. Provider Earnings Released
  const isReleased = payoutStatus === 'Released' || payoutStatus === 'paid' || (isCompleted && !booking.payoutHoldUntil);
  steps.push({
    title: "Provider Earnings Released",
    completed: isReleased,
    time: isReleased ? (booking.payoutHoldUntil || booking.serviceCompletedAt) : null,
    status: isReleased ? 'completed' : 'pending'
  });

  // If booking is cancelled, append Cancellation status
  if (['cancelled', 'refunded'].includes(bStatus)) {
    const isCancelledByAdmin = booking.cancelledBy === 'admin';
    steps.push({
      title: isCancelledByAdmin ? "Booking Cancelled By Support Team" : "Booking Cancelled",
      completed: true,
      time: booking.cancelledAt || booking.cancellationProgress?.cancelledAt || booking.updatedAt,
      status: 'error',
      note: isCancelledByAdmin
        // END BOOKING STATUS STATE MACHINE UPGRADE
        ? `Reason: ${booking.cancellationReason || 'N/A'}`
        : (booking.cancellationProgress?.reason || 'N/A')
    });
  }

  return steps;
};

/**
 * Enriches a booking object with the standardized pricingBreakdown and defaults bookingType to scheduled.
 * Supports both Mongoose documents and plain JavaScript objects.
 * @param {Object} booking - The booking document or plain object
 * @param {Object} transaction - Optional active payment transaction to extract mixed payment splits
 * @returns {Object} - Enriched booking object
 */
const enrichBookingData = (booking, transaction = null) => {
  if (!booking) return booking;

  // Convert mongoose doc to plain object if possible, to avoid write restrictions on read-only fields
  const b = typeof booking.toObject === 'function' ? booking.toObject() : booking;

  // Calculate provider shares for lean queries
  const split = b.surgeSplitSettings || {};
  const visitingSplit = typeof split.visiting === 'number' ? split.visiting : 0;
  const rainSplit = typeof split.rain === 'number' ? split.rain : 0;
  const trafficSplit = typeof split.traffic === 'number' ? split.traffic : 0;
  const nightSplit = typeof split.night === 'number' ? split.night : 0;
  const demandSplit = typeof split.demand === 'number' ? split.demand : 0;
  const emergencySplit = typeof split.emergency === 'number' ? split.emergency : 0;

  b.providerVisitingShare = parseFloat(((b.visitingCharge || 0) * (visitingSplit / 100)).toFixed(2)) || 0;
  b.providerRainShare = parseFloat(((b.rainCharge || 0) * (rainSplit / 100)).toFixed(2)) || 0;
  b.providerTrafficShare = parseFloat(((b.trafficCharge || 0) * (trafficSplit / 100)).toFixed(2)) || 0;
  b.providerNightShare = parseFloat(((b.nightCharge || 0) * (nightSplit / 100)).toFixed(2)) || 0;
  b.providerDemandShare = parseFloat(((b.demandSurge || 0) * (demandSplit / 100)).toFixed(2)) || 0;
  b.providerEmergencyShare = parseFloat(((b.emergencySurge || 0) * (emergencySplit / 100)).toFixed(2)) || 0;

  const servicePrice = b.subtotal || 0;
  const visitingCharges = b.visitingCharge || 0;
  const emergencyCharges = b.emergencySurge || 0;
  const surgeCharges = (b.rainCharge || 0) +
    (b.trafficCharge || 0) +
    (b.nightCharge || 0) +
    (b.demandSurge || 0) +
    (b.customCharges || 0) +
    (b.platformFee || 0);
  const discount = b.totalDiscount || 0;
  const baseForComm = Math.max(0, servicePrice - discount);
  const platformCommission = b.commissionAmount || parseFloat(((baseForComm * 10) / 100).toFixed(2));
  const providerEarnings = b.providerEarnings || parseFloat((baseForComm - platformCommission + (b.providerEmergencyShare || 0) + (b.providerVisitingShare || 0) + (b.providerRainShare || 0) + (b.providerTrafficShare || 0) + (b.providerNightShare || 0) + (b.providerDemandShare || 0)).toFixed(2));
  const platformEarnings = parseFloat((platformCommission + (b.companySurgeShare || 0)).toFixed(2));
  const customerTotal = b.totalAmount || 0;

  let walletUsed = b.walletUsed || 0;
  let onlinePaid = b.onlinePaid || 0;
  let cashToPay = b.cashToPay || 0;

  if (!b.walletUsed && !b.onlinePaid && !b.cashToPay) {
    if (b.paymentMethod === 'cash') {
      cashToPay = customerTotal;
    } else if (b.paymentMethod === 'wallet') {
      walletUsed = customerTotal;
    } else if (b.paymentMethod === 'online') {
      onlinePaid = customerTotal;
    } else if (b.paymentMethod === 'mixed') {
      if (transaction) {
        const match = transaction.description?.match(/Wallet \(₹([\d.]+)\)/);
        walletUsed = match ? parseFloat(match[1]) : 0;
        onlinePaid = parseFloat((customerTotal - walletUsed).toFixed(2));
      } else {
        cashToPay = 0;
        onlinePaid = customerTotal;
        walletUsed = 0;
      }
    }
  }

  b.pricingBreakdown = {
    servicePrice,
    visitingCharges,
    emergencyCharges,
    surgeCharges,
    discount,
    walletUsed,
    platformCommission,
    providerEarnings,
    platformEarnings,
    customerTotal,
    cashRemaining: cashToPay,
    onlinePaid,
    finalAmount: customerTotal
  };

  if (!b.bookingType) {
    b.bookingType = 'scheduled';
  }

  return b;
};

module.exports = {
  getBookingProgress,
  getBookingTimeline,
  enrichBookingData
};

