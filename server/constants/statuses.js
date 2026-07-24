/**
 * Canonical System Status Enums
 * Single source of truth across Backend Models, Services, Controllers, Sockets, and Frontend Panels.
 */

const BOOKING_STATUS = Object.freeze({
  PENDING: 'Pending',
  SEARCHING_PROVIDER: 'SearchingProvider',
  OFFERED: 'Offered',
  ACCEPTED: 'Accepted',
  ON_THE_WAY: 'OnTheWay',
  ARRIVED: 'Arrived',
  WORK_STARTED: 'WorkStarted',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired'
});

const COMPLAINT_STATUS = Object.freeze({
  NONE: 'None',
  RAISED: 'Raised',
  UNDER_INVESTIGATION: 'UnderInvestigation',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  CLOSED: 'Closed'
});

const REFUND_STATUS = Object.freeze({
  PENDING: 'Pending',
  APPROVED: 'Approved',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REJECTED: 'Rejected'
});

const TRANSACTION_TYPE = Object.freeze({
  PAYMENT: 'Payment',
  REFUND: 'Refund',
  COMMISSION: 'Commission',
  EARNING: 'Earning',
  ESCROW_HOLD: 'EscrowHold',
  ESCROW_RELEASE: 'EscrowRelease',
  PENALTY: 'Penalty',
  CLAWBACK: 'Clawback',
  WITHDRAWAL: 'Withdrawal',
  SETTLEMENT: 'Settlement'
});

module.exports = {
  BOOKING_STATUS,
  COMPLAINT_STATUS,
  REFUND_STATUS,
  TRANSACTION_TYPE
};
