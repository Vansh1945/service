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
      // 48-hour review logic
      if (completedAt) {
        const now = new Date();
        const completedTime = new Date(completedAt).getTime();
        const fortyEightHoursInMs = 48 * 60 * 60 * 1000;

        if (now.getTime() - completedTime < fortyEightHoursInMs) {
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

  const timeline = [];
  const statusHistory = booking.statusHistory || [];

  const getStatusTime = (status) => {
    const history = [...statusHistory].reverse().find(h => h.status === status);
    return history ? history.timestamp : null;
  };

  // 1. Booking Requested
  timeline.push({
    title: "Booking Requested",
    completed: true,
    time: booking.createdAt,
    status: 'completed'
  });

  // 2. Payment Confirmed
  const isPaid = booking.paymentStatus === "paid" || booking.paymentStatus === "escrow_hold" || booking.confirmedBooking === true;
  timeline.push({
    title: "Payment Confirmed",
    completed: isPaid,
    time: isPaid ? (booking.paymentDate || booking.updatedAt) : null,
    status: isPaid ? 'completed' : 'pending'
  });

  // 3. Provider Assigned
  const isAssigned = !!booking.provider;
  timeline.push({
    title: isAssigned ? `Provider Assigned: ${booking.provider?.name || 'Assigned'}` : "Provider Assigned",
    completed: isAssigned,
    time: isAssigned ? (getStatusTime('scheduled') || getStatusTime('assigned') || getStatusTime('accepted') || booking.createdAt) : null,
    status: isAssigned ? 'completed' : 'pending'
  });

  // 4. Provider Accepted
  const isAccepted = ['accepted', 'scheduled', 'in-progress', 'completed'].includes(booking.status);
  timeline.push({
    title: "Provider Accepted Booking",
    completed: isAccepted,
    time: isAccepted ? getStatusTime('accepted') : null,
    status: isAccepted ? 'completed' : 'pending'
  });

  // 5. Provider On The Way (status === 'accepted')
  const isOnTheWay = booking.status === 'accepted';
  const hasPassedOnTheWay = ['in-progress', 'completed'].includes(booking.status);
  timeline.push({
    title: "Provider is on the way",
    completed: isOnTheWay || hasPassedOnTheWay,
    time: (isOnTheWay || hasPassedOnTheWay) ? getStatusTime('accepted') : null,
    status: isOnTheWay ? 'current' : (hasPassedOnTheWay ? 'completed' : 'pending')
  });

  // 6. Work Started
  const isStarted = booking.status === 'in-progress' || booking.status === 'completed';
  timeline.push({
    title: "Work Started",
    completed: isStarted,
    time: booking.serviceStartedAt || getStatusTime('in-progress'),
    status: booking.status === 'in-progress' ? 'current' : (isStarted ? 'completed' : 'pending')
  });

  // 7. Service Completed
  const isCompleted = booking.status === 'completed';
  timeline.push({
    title: "Service Completed Successfully",
    completed: isCompleted,
    time: booking.serviceCompletedAt || getStatusTime('completed'),
    status: isCompleted ? 'completed' : 'pending'
  });

  // 8. Payout Hold Period
  const isHold = payoutStatus && (payoutStatus.includes('Hold') || payoutStatus.includes('Review'));
  if (isHold || (isCompleted && booking.payoutHoldUntil)) {
    timeline.push({
      title: "Service under 48h review protection",
      completed: isCompleted && !isHold,
      time: booking.payoutHoldUntil,
      status: isHold ? 'current' : (isCompleted ? 'completed' : 'pending')
    });
  }

  // 9. Dispute Raised
  const isDisputed = booking.disputeRaised === true || (booking.disputeStatus && booking.disputeStatus !== 'none');
  if (isDisputed) {
    timeline.push({
      title: "Complaint / Dispute Under Review",
      completed: booking.disputeStatus === 'resolved',
      time: booking.updatedAt,
      status: booking.disputeStatus === 'resolved' ? 'completed' : 'error'
    });
  }

  // 10. Cancelled
  if (booking.status === 'cancelled') {
    const isCancelledByAdmin = booking.cancelledBy === 'admin';
    timeline.push({
      title: isCancelledByAdmin ? "Booking Cancelled By Support Team" : "Booking Cancelled",
      completed: true,
      time: booking.cancelledAt || booking.cancellationProgress?.cancelledAt || booking.updatedAt,
      status: 'error',
      note: isCancelledByAdmin
        ? `Reason: ${booking.cancellationReason || 'N/A'}${booking.complaintId ? '\nComplaint: ' + (booking.complaintId.complaintId || booking.complaintId) : ''}`
        : (booking.cancellationProgress?.reason || 'N/A')
    });
  }

  // 11. Parse Custom History entries for Security Events
  const customSteps = [];
  let hasAddedStartVerification = false;
  let hasAddedCompletionVerification = false;

  statusHistory.forEach(h => {
    if (!h.note) return;
    const time = h.timestamp || booking.updatedAt;

    if (h.note.includes('START_PIN:')) {
      customSteps.push({
        title: "Start PIN generated",
        completed: true,
        time,
        status: 'completed'
      });
      customSteps.push({
        title: "Completion PIN generated",
        completed: true,
        time,
        status: 'completed'
      });
    }

    if (h.note.includes('Verification successful')) {
      const isStart = h.status === 'accepted' || h.note.includes('Service started') || h.note.includes('Work proof submitted') || h.note.includes('start');
      if (isStart) {
        if (!hasAddedStartVerification) {
          customSteps.push({
            title: "Service start verified",
            completed: true,
            time,
            status: 'completed'
          });
          if (booking.providerWorkProof?.startLocation) {
            customSteps.push({
              title: "Geo verified",
              completed: true,
              time,
              status: 'completed'
            });
          }
          hasAddedStartVerification = true;
        }
      } else {
        if (!hasAddedCompletionVerification) {
          customSteps.push({
            title: "Service completion verified",
            completed: true,
            time,
            status: 'completed'
          });
          if (booking.providerWorkProof?.completionLocation) {
            customSteps.push({
              title: "Geo verified",
              completed: true,
              time,
              status: 'completed'
            });
          }
          hasAddedCompletionVerification = true;
        }
      }
    }

    if (h.note.includes('Failed verification attempt')) {
      const isStart = h.note.includes('START_PIN');
      customSteps.push({
        title: `Failed PIN attempt (${isStart ? 'Start' : 'Completion'})`,
        completed: true,
        time,
        status: 'error'
      });
    }

    if (h.note.includes('FRAUD_SCORE:') || h.note.includes('[SUSPICIOUS_BOOKING]')) {
      customSteps.push({
        title: "Fraud warning generated",
        completed: true,
        time,
        status: 'error'
      });
    }
  });

  // Separate completed/error steps and pending/current steps
  const allSteps = [...timeline, ...customSteps];
  const completedSteps = allSteps.filter(step => step.completed === true || step.status === 'completed' || step.status === 'error');
  const pendingSteps = allSteps.filter(step => !completedSteps.includes(step));

  // Sort completed/error steps chronologically by timestamp
  completedSteps.sort((a, b) => {
    const timeA = a.time ? new Date(a.time).getTime() : 0;
    const timeB = b.time ? new Date(b.time).getTime() : 0;
    return timeA - timeB;
  });

  return [...completedSteps, ...pendingSteps];
};

module.exports = {
  getBookingProgress,
  getBookingTimeline
};

