/**
 * Single Source of Truth for Status & UI Badge Helpers.
 * Standardizes status colors, badge classes, humanized labels, status configurations,
 * and predicate helpers across all domains: Bookings, Payments, Refunds, Complaints,
 * Settlements, Withdrawals, Providers, Customers, Earnings, Referrals, Assignments,
 * Disputes, SLA, Verification, Deposits, Transactions, Payment Methods, Booking Types,
 * Refund Types, Severity, Priority, and Risk.
 */
import { titleCase } from './format';
import {
  Timer, CheckCircle, Activity, XCircle, CreditCard, AlertCircle,
  Clock, ShieldAlert, Lock, CheckCheck, Check, X
} from 'lucide-react';

/* =========================================================
   DOMAIN CONSTANTS
   ========================================================= */

export const STATUS_DOMAINS = {
  BOOKING: 'booking',
  PAYMENT: 'payment',
  REFUND: 'refund',
  COMPLAINT: 'complaint',
  SETTLEMENT: 'settlement',
  WITHDRAWAL: 'withdrawal',
  PROVIDER: 'provider',
  CUSTOMER: 'customer',
  EARNING: 'earning',
  REFERRAL: 'referral',
  ASSIGNMENT: 'assignment',
  DISPUTE: 'dispute',
  SLA: 'sla',
  VERIFICATION: 'verification',
  DEPOSIT: 'deposit',
  TRANSACTION: 'transaction',
  PAYMENT_METHOD: 'paymentMethod',
  BOOKING_TYPE: 'bookingType',
  REFUND_TYPE: 'refundType',
  SEVERITY: 'severity',
  PRIORITY: 'priority',
  RISK: 'risk'
};

/* =========================================================
   SAFE DEFAULT FALLBACK CONFIGURATION
   ========================================================= */

const DEFAULT_STATUS_META = {
  key: 'unknown',
  label: '--',
  color: 'bg-gray-100 text-gray-700 border-gray-200',
  className: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-gray-100 text-gray-700 border-gray-200',
  group: 'unknown',
  isTerminal: false
};

/* =========================================================
   GENERIC STATUS FORMATTERS & NORMALIZERS
   ========================================================= */

/**
 * Normalize status string by lowercasing and stripping non-alphanumeric characters.
 * Does NOT alter financial or backend state meanings.
 * @param {*} status 
 * @returns {string}
 */
export function normalizeStatus(status) {
  if (status == null) return '';
  return String(status)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Format raw status string into clean human-readable text
 * @param {string} status - Raw status string (e.g. "under_review", "payment_pending", "not_deposited")
 * @returns {string} Humanized status string
 */
export const formatStatus = (status) => {
  if (status == null || status === '') return '--';
  const str = typeof status === 'string' ? status : String(status);
  const clean = str.trim().toLowerCase();
  if (!clean) return '--';
  if (clean === 'searchingprovider' || clean === 'searching_provider') return 'Searching for Provider';
  if (clean === 'ontheway' || clean === 'on_the_way') return 'On the Way';
  if (clean === 'workstarted' || clean === 'work_started') return 'Work Started';
  if (clean === 'in_progress' || clean === 'inprogress') return 'In Progress';
  if (clean === 'pending_payment' || clean === 'pendingpayment') return 'Pending Payment';
  if (clean === 'pending_settlement' || clean === 'pendingsettlement') return 'Pending Settlement';
  if (clean === 'cash_mismatch' || clean === 'cashmismatch') return 'Cash Mismatch';
  if (clean === 'amount_mismatch' || clean === 'amountmismatch') return 'Amount Mismatch';
  if (clean === 'payment_failed' || clean === 'paymentfailed') return 'Payment Failed';
  if (clean === 'not_deposited' || clean === 'notdeposited') return 'Not Deposited';
  if (clean === 'pending_deposit' || clean === 'pendingdeposit') return 'Pending Deposit';
  if (clean === 'pending_verify' || clean === 'pendingverify') return 'Pending Verify';
  if (clean === 'matched') return 'Matched';
  if (clean === 'status_mismatch') return 'Status Mismatch';
  if (clean === 'refund_mismatch') return 'Refund Mismatch';
  if (clean === 'provider_earnings') return 'Provider Earnings';
  if (clean === 'customer_payment') return 'Customer Payment';
  if (clean === 'master_reconcile') return 'Master Reconcile';
  if (clean === 'pending_collection') return 'Pending Collection';
  if (clean === 'pending_verification') return 'Pending Verification';
  if (clean === 'missing_gateway_record') return 'Missing Gateway Record';
  if (clean === 'pending_reconciliation') return 'Pending Reconciliation';
  if (clean === 'not_reconciled') return 'Not Reconciled';
  if (clean === 'pending_gateway') return 'Pending Gateway';

  const formatted = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();

  return titleCase(formatted || str);
};

/**
 * Provides a natural sentence status message for customer and provider roles
 * @param {string} status - Raw status string
 * @param {string} role - 'customer' or 'provider'
 * @returns {string} Natural conversational sentence
 */
export const getNaturalStatusMessage = (status, role = 'customer') => {
  if (status == null || status === '') return '';
  const norm = normalizeStatus(status);
  if (norm === 'searchingprovider' || norm === 'pending') {
    return role === 'provider'
      ? 'A new service request is searching for a provider.'
      : "We're finding an available service provider for your booking.";
  }
  if (norm === 'offered') {
    return role === 'provider'
      ? 'You have a new service request offer.'
      : 'Your booking has been offered to a service provider.';
  }
  if (norm === 'accepted') {
    return role === 'provider'
      ? 'Booking accepted successfully.'
      : 'Your booking has been accepted by a service provider.';
  }
  if (norm === 'ontheway') {
    return role === 'provider'
      ? 'You are on the way to the customer location.'
      : 'Your service provider is on the way.';
  }
  if (norm === 'arrived') {
    return role === 'provider'
      ? 'You have arrived at the customer location.'
      : 'Your service provider has arrived.';
  }
  if (norm === 'workstarted') {
    return role === 'provider'
      ? 'Service started successfully.'
      : 'Your service has started.';
  }
  if (norm === 'completed') {
    return role === 'provider'
      ? 'Service marked as completed.'
      : 'Your service has been completed successfully.';
  }
  if (norm === 'cancelled' || norm === 'canceled') {
    return role === 'provider'
      ? 'This booking was cancelled.'
      : 'Your booking has been cancelled successfully.';
  }
  if (norm === 'rejected') {
    return role === 'provider'
      ? 'Booking rejected.'
      : 'Your booking request could not be fulfilled at this time.';
  }
  return formatStatus(status);
};



/* =========================================================
   DOMAIN METADATA DICTIONARY
   ========================================================= */

export const DOMAIN_STATUS_MAP = {
  [STATUS_DOMAINS.BOOKING]: {
    pending: { label: 'Pending Search', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    searchingprovider: { label: 'Finding Provider', color: 'bg-blue-50 text-blue-700 border-blue-200', group: 'pending', isTerminal: false },
    offered: { label: 'Job Offered', color: 'bg-blue-50 text-blue-700 border-blue-200', group: 'pending', isTerminal: false },
    accepted: { label: 'Confirmed', color: 'bg-teal-50 text-teal-700 border-teal-200', group: 'active', isTerminal: false },
    ontheway: { label: 'On The Way', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', group: 'active', isTerminal: false },
    arrived: { label: 'Arrived', color: 'bg-sky-50 text-sky-700 border-sky-200', group: 'active', isTerminal: false },
    workstarted: { label: 'Work Started', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', group: 'active', isTerminal: false },
    work_started: { label: 'Work Started', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', group: 'active', isTerminal: false },
    completed: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'completed', isTerminal: true },
    cancelled: { label: 'Cancelled', color: 'bg-red-50 text-red-700 border-red-200', group: 'cancelled', isTerminal: true },
    canceled: { label: 'Cancelled', color: 'bg-red-50 text-red-700 border-red-200', group: 'cancelled', isTerminal: true },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', group: 'cancelled', isTerminal: true },
    noshow: { label: 'No Show', color: 'bg-rose-50 text-rose-700 border-rose-200', group: 'cancelled', isTerminal: true },
    payment_pending: { label: 'Payment Due', color: 'bg-orange-50 text-orange-700 border-orange-200', group: 'pending', isTerminal: false }
  },

  [STATUS_DOMAINS.PAYMENT]: {
    pending: { label: 'Pending Payment', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'successful', isTerminal: true },
    success: { label: 'Success', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'successful', isTerminal: true },
    successful: { label: 'Successful', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'successful', isTerminal: true },
    captured: { label: 'Captured', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'successful', isTerminal: true },
    failed: { label: 'Failed', color: 'bg-red-50 text-red-700 border-red-200', group: 'failed', isTerminal: true },
    refunded: { label: 'Refunded', color: 'bg-rose-50 text-rose-700 border-rose-200', group: 'refunded', isTerminal: true },
    partially_refunded: { label: 'Partially Refunded', color: 'bg-primary/10 text-primary border-primary/20', group: 'refunded', isTerminal: false }
  },

  [STATUS_DOMAINS.REFUND]: {
    requested: { label: 'Refund Requested', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    pending: { label: 'Pending Refund', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    approved: { label: 'Refund Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'approved', isTerminal: false },
    processing: { label: 'Processing Payout', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'processing', isTerminal: false },
    completed: { label: 'Refund Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'completed', isTerminal: true },
    failed: { label: 'Refund Failed', color: 'bg-red-50 text-red-700 border-red-200', group: 'failed', isTerminal: true },
    rejected: { label: 'Refund Rejected', color: 'bg-red-50 text-red-700 border-red-200', group: 'rejected', isTerminal: true },
    cancelled: { label: 'Refund Cancelled', color: 'bg-gray-100 text-gray-700 border-gray-200', group: 'cancelled', isTerminal: true }
  },

  [STATUS_DOMAINS.COMPLAINT]: {
    open: { label: 'Open', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'open', isTerminal: false },
    under_review: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', group: 'open', isTerminal: false },
    underreview: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', group: 'open', isTerminal: false },
    in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-200', group: 'open', isTerminal: false },
    inprogress: { label: 'In Progress', color: 'bg-blue-50 text-blue-700 border-blue-200', group: 'open', isTerminal: false },
    waitingforcustomer: { label: 'Waiting for Customer', color: 'bg-purple-50 text-purple-700 border-purple-200', group: 'open', isTerminal: false },
    waitingforprovider: { label: 'Waiting for Provider', color: 'bg-purple-50 text-purple-700 border-purple-200', group: 'open', isTerminal: false },
    escalated: { label: 'Escalated', color: 'bg-red-50 text-red-700 border-red-200', group: 'open', isTerminal: false },
    resolutionproposed: { label: 'Resolution Proposed', color: 'bg-teal-50 text-teal-700 border-teal-200', group: 'open', isTerminal: false },
    resolved: { label: 'Resolved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'resolved', isTerminal: true },
    solved: { label: 'Solved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'resolved', isTerminal: true },
    rejected: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200', group: 'closed', isTerminal: true },
    cancelled: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-200', group: 'closed', isTerminal: true },
    closed: { label: 'Closed', color: 'bg-gray-100 text-gray-700 border-gray-200', group: 'closed', isTerminal: true },
    reopened: { label: 'Reopened', color: 'bg-orange-50 text-orange-700 border-orange-200', group: 'open', isTerminal: false }
  },

  [STATUS_DOMAINS.SETTLEMENT]: {
    pending_settlement: { label: 'Pending Settlement', color: 'bg-slate-100 text-slate-700 border-slate-200', group: 'pending', isTerminal: false },
    pendingsettlement: { label: 'Pending Settlement', color: 'bg-slate-100 text-slate-700 border-slate-200', group: 'pending', isTerminal: false },
    settled: { label: 'Settled', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'settled', isTerminal: true },
    partially_settled: { label: 'Partially Settled', color: 'bg-primary/10 text-primary border-primary/20', group: 'pending', isTerminal: false },
    failed: { label: 'Settlement Failed', color: 'bg-red-50 text-red-700 border-red-200', group: 'failed', isTerminal: true }
  },

  [STATUS_DOMAINS.WITHDRAWAL]: {
    requested: { label: 'Requested', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    processing: { label: 'Processing', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    under_review: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', group: 'pending', isTerminal: false },
    underreview: { label: 'Under Review', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', group: 'pending', isTerminal: false },
    approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'approved', isTerminal: false },
    paid: { label: 'Paid', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'completed', isTerminal: true },
    completed: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'completed', isTerminal: true },
    failed: { label: 'Failed', color: 'bg-red-50 text-red-700 border-red-200', group: 'failed', isTerminal: true },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', group: 'failed', isTerminal: true },
    withdrawn: { label: 'Withdrawn', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'completed', isTerminal: true }
  },

  [STATUS_DOMAINS.PROVIDER]: {
    pending: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'active', isTerminal: false },
    active: { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'active', isTerminal: false },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', group: 'inactive', isTerminal: true },
    suspended: { label: 'Suspended', color: 'bg-red-50 text-red-700 border-red-200', group: 'inactive', isTerminal: true },
    blocked: { label: 'Blocked', color: 'bg-red-50 text-red-700 border-red-200', group: 'inactive', isTerminal: true },
    blacklisted: { label: 'Blacklisted', color: 'bg-slate-800 text-white border-slate-900', group: 'inactive', isTerminal: true }
  },

  [STATUS_DOMAINS.CUSTOMER]: {
    active: { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'active', isTerminal: false },
    blocked: { label: 'Blocked', color: 'bg-red-50 text-red-700 border-red-200', group: 'inactive', isTerminal: true },
    suspended: { label: 'Suspended', color: 'bg-red-50 text-red-700 border-red-200', group: 'inactive', isTerminal: true },
    unverified: { label: 'Unverified', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false }
  },

  [STATUS_DOMAINS.EARNING]: {
    available: { label: 'Ready for withdrawal', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'available', isTerminal: false },
    pendingrelease: { label: 'Pending Release', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    pending_release: { label: 'Pending Release', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    held: { label: 'Held', color: 'bg-orange-50 text-orange-700 border-orange-200', group: 'held', isTerminal: false },
    adminhold: { label: 'Admin Hold', color: 'bg-orange-50 text-orange-700 border-orange-200', group: 'held', isTerminal: false },
    disputehold: { label: 'Dispute Hold', color: 'bg-orange-50 text-orange-700 border-orange-200', group: 'held', isTerminal: false }
  },

  [STATUS_DOMAINS.REFERRAL]: {
    pending: { label: 'Pending Qualification', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    qualified: { label: 'Qualified', color: 'bg-blue-50 text-blue-700 border-blue-200', group: 'active', isTerminal: false },
    approved: { label: 'Approved', color: 'bg-teal-50 text-teal-700 border-teal-200', group: 'approved', isTerminal: false },
    released: { label: 'Reward Released', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'completed', isTerminal: true },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', group: 'failed', isTerminal: true },
    fraudflagged: { label: 'Fraud Flagged', color: 'bg-rose-50 text-rose-700 border-rose-200', group: 'flagged', isTerminal: true },
    expired: { label: 'Expired', color: 'bg-gray-100 text-gray-700 border-gray-200', group: 'expired', isTerminal: true }
  },

  [STATUS_DOMAINS.ASSIGNMENT]: {
    searching: { label: 'Searching', color: 'bg-blue-50 text-blue-700 border-blue-200', group: 'searching', isTerminal: false },
    offered: { label: 'Offered', color: 'bg-blue-50 text-blue-700 border-blue-200', group: 'offered', isTerminal: false },
    accepted: { label: 'Accepted', color: 'bg-teal-50 text-teal-700 border-teal-200', group: 'accepted', isTerminal: false },
    declined: { label: 'Declined', color: 'bg-red-50 text-red-700 border-red-200', group: 'declined', isTerminal: true },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', group: 'declined', isTerminal: true },
    expired: { label: 'Timed Out', color: 'bg-gray-100 text-gray-700 border-gray-200', group: 'expired', isTerminal: true }
  },

  [STATUS_DOMAINS.DISPUTE]: {
    raised: { label: 'Dispute Open', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'open', isTerminal: false },
    open: { label: 'Dispute Open', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'open', isTerminal: false },
    under_investigation: { label: 'Under Investigation', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', group: 'open', isTerminal: false },
    investigating: { label: 'Under Investigation', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', group: 'open', isTerminal: false },
    resolved: { label: 'Dispute Resolved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'resolved', isTerminal: true },
    dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-700 border-gray-200', group: 'resolved', isTerminal: true }
  },

  [STATUS_DOMAINS.SLA]: {
    on_track: { label: 'On Track', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'good', isTerminal: false },
    warning: { label: 'Near Breach', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'warning', isTerminal: false },
    near_breach: { label: 'Near Breach', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'warning', isTerminal: false },
    breached: { label: 'SLA Breached', color: 'bg-red-50 text-red-700 border-red-200', group: 'breached', isTerminal: true },
    overdue: { label: 'SLA Breached', color: 'bg-red-50 text-red-700 border-red-200', group: 'breached', isTerminal: true }
  },

  [STATUS_DOMAINS.VERIFICATION]: {
    verified: { label: 'Verified', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'verified', isTerminal: true },
    unverified: { label: 'Unverified', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'unverified', isTerminal: false },
    pending_verify: { label: 'Pending Verification', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'unverified', isTerminal: false },
    pending_verification: { label: 'Pending Verification', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'unverified', isTerminal: false },
    rejected: { label: 'Verification Rejected', color: 'bg-red-50 text-red-700 border-red-200', group: 'rejected', isTerminal: true }
  },

  [STATUS_DOMAINS.DEPOSIT]: {
    not_deposited: { label: 'Not Deposited', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    notdeposited: { label: 'Not Deposited', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    pending_deposit: { label: 'Pending Deposit', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    pendingdeposit: { label: 'Pending Deposit', color: 'bg-amber-50 text-amber-700 border-amber-200', group: 'pending', isTerminal: false },
    deposited: { label: 'Deposited', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'deposited', isTerminal: true },
    reconciled: { label: 'Deposited', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', group: 'deposited', isTerminal: true },
    cash_mismatch: { label: 'Cash Mismatch', color: 'bg-rose-50 text-rose-700 border-rose-200', group: 'mismatch', isTerminal: false }
  }
};

/* =========================================================
   GLOBAL COLOR LOOKUP MAP
   ========================================================= */

const STATUS_COLOR_MAP = {
  // Positive / Success statuses
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  successful: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  settled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  captured: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  deposited: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  reconciled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  collected: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  matched: 'bg-emerald-50 text-emerald-700 border-emerald-200',

  // Pending / In Progress statuses
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-amber-50 text-amber-700 border-amber-200',
  requested: 'bg-amber-50 text-amber-700 border-amber-200',
  under_review: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  underreview: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  investigating: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  under_investigation: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  open: 'bg-amber-50 text-amber-700 border-amber-200',
  searchingprovider: 'bg-blue-50 text-blue-700 border-blue-200',
  offered: 'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-teal-50 text-teal-700 border-teal-200',
  ontheway: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  arrived: 'bg-sky-50 text-sky-700 border-sky-200',
  workstarted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  work_started: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  pending_deposit: 'bg-amber-50 text-amber-700 border-amber-200',
  pendingdeposit: 'bg-amber-50 text-amber-700 border-amber-200',
  not_deposited: 'bg-amber-50 text-amber-700 border-amber-200',
  notdeposited: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_settlement: 'bg-slate-100 text-slate-700 border-slate-200',
  pendingsettlement: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_verify: 'bg-amber-50 text-amber-700 border-amber-200',
  pendingverify: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_collection: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_reconciliation: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_gateway: 'bg-slate-100 text-slate-700 border-slate-200',
  queued: 'bg-slate-100 text-slate-700 border-slate-200',
  unverified: 'bg-amber-50 text-amber-700 border-amber-200',

  // Warning / Mismatch / Hold statuses
  amount_mismatch: 'bg-rose-50 text-rose-700 border-rose-200',
  cash_mismatch: 'bg-rose-50 text-rose-700 border-rose-200',
  missing_gateway_record: 'bg-rose-50 text-rose-700 border-rose-200',
  not_reconciled: 'bg-rose-50 text-rose-700 border-rose-200',
  on_hold: 'bg-orange-50 text-orange-700 border-orange-200',
  held: 'bg-orange-50 text-orange-700 border-orange-200',
  dispute_hold: 'bg-orange-50 text-orange-700 border-orange-200',
  admin_hold: 'bg-orange-50 text-orange-700 border-orange-200',
  partially_refunded: 'bg-primary/10 text-primary border-primary/20',
  partially_settled: 'bg-primary/10 text-primary border-primary/20',

  // Negative / Failure statuses
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  canceled: 'bg-red-50 text-red-700 border-red-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  dismissed: 'bg-gray-100 text-gray-700 border-gray-200',
  blocked: 'bg-red-50 text-red-700 border-red-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  noshow: 'bg-rose-50 text-rose-700 border-rose-200',
  expired: 'bg-gray-100 text-gray-700 border-gray-200',
  blacklisted: 'bg-slate-800 text-white border-slate-900',
};

/* =========================================================
   CORE METADATA & BADGE RESOLVERS
   ========================================================= */

/**
 * Get domain metadata for a status with safe default fallback.
 * @param {string} domain - Domain key from STATUS_DOMAINS
 * @param {string} status - Raw status string
 * @returns {Object} { key, label, color, className, group, isTerminal }
 */
export const getDomainStatusMeta = (domain, status) => {
  if (!status) return { ...DEFAULT_STATUS_META };
  const rawStr = String(status).trim();
  const cleanKey = normalizeStatus(status);
  const domainMap = DOMAIN_STATUS_MAP[domain] || {};

  const meta = domainMap[cleanKey] || domainMap[rawStr.toLowerCase()] || null;
  if (meta) {
    return {
      key: cleanKey,
      label: meta.label || formatStatus(status),
      color: meta.color || DEFAULT_STATUS_META.color,
      className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.color || DEFAULT_STATUS_META.color}`,
      group: meta.group || 'generic',
      isTerminal: Boolean(meta.isTerminal)
    };
  }

  const color = getStatusColor(status, domain);
  const label = formatStatus(status);
  return {
    key: cleanKey || 'unknown',
    label,
    color,
    className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color}`,
    group: 'generic',
    isTerminal: false
  };
};

/**
 * Get color styling classes for any status value
 * @param {string} status
 * @param {string} [module='generic']
 * @returns {string} Tailwind CSS class string
 */
export const getStatusColor = (status, module = 'generic') => {
  if (!status) return DEFAULT_STATUS_META.color;
  const key = normalizeStatus(status);
  const rawLower = String(status).toLowerCase().trim();

  // Try domain specific map first if specified
  if (module && DOMAIN_STATUS_MAP[module]) {
    const domainMeta = DOMAIN_STATUS_MAP[module][key] || DOMAIN_STATUS_MAP[module][rawLower];
    if (domainMeta?.color) return domainMeta.color;
  }

  return STATUS_COLOR_MAP[key] || STATUS_COLOR_MAP[rawLower] || DEFAULT_STATUS_META.color;
};

/**
 * Get structured badge configuration object containing label and styling classes
 * @param {string} status
 * @param {string} [module='generic']
 * @returns {Object} { label: string, color: string, className: string }
 */
export const getStatusBadge = (status, module = 'generic') => {
  if (module && DOMAIN_STATUS_MAP[module]) {
    const meta = getDomainStatusMeta(module, status);
    return {
      label: meta.label,
      color: meta.color,
      className: meta.className
    };
  }

  const label = formatStatus(status);
  const color = getStatusColor(status, module);
  return {
    label,
    color,
    className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color}`
  };
};

/* =========================================================
   MODULE SPECIFIC STATUS BADGES & COLORS (PRESERVED EXPORTS)
   ========================================================= */

export const getBookingStatusColor = (status) => getStatusColor(status, STATUS_DOMAINS.BOOKING);
export const getBookingStatusBadge = (status) => getStatusBadge(status, STATUS_DOMAINS.BOOKING);

export const getPaymentStatusColor = (status) => getStatusColor(status, STATUS_DOMAINS.PAYMENT);
export const getPaymentStatusBadge = (status) => getStatusBadge(status, STATUS_DOMAINS.PAYMENT);

export const getRefundStatusColor = (status) => getStatusColor(status, STATUS_DOMAINS.REFUND);
export const getRefundStatusBadge = (status) => getStatusBadge(status, STATUS_DOMAINS.REFUND);

export const getComplaintStatusColor = (status) => getStatusColor(status, STATUS_DOMAINS.COMPLAINT);
export const getComplaintStatusBadge = (status) => getStatusBadge(status, STATUS_DOMAINS.COMPLAINT);

export const getSettlementStatusColor = (status) => getStatusColor(status, STATUS_DOMAINS.SETTLEMENT);
export const getSettlementStatusBadge = (status) => getStatusBadge(status, STATUS_DOMAINS.SETTLEMENT);

export const getWithdrawalStatusColor = (status) => getStatusColor(status, STATUS_DOMAINS.WITHDRAWAL);
export const getWithdrawalStatusBadge = (status) => getStatusBadge(status, STATUS_DOMAINS.WITHDRAWAL);

export const getProviderStatusColor = (status) => getStatusColor(status, STATUS_DOMAINS.PROVIDER);
export const getProviderStatusBadge = (status) => getStatusBadge(status, STATUS_DOMAINS.PROVIDER);

export const getCustomerStatusColor = (status) => getStatusColor(status, STATUS_DOMAINS.CUSTOMER);
export const getCustomerStatusBadge = (status) => getStatusBadge(status, STATUS_DOMAINS.CUSTOMER);

export const getDepositStatusBadge = (status) => {
  const raw = (status || '').toString().trim().toLowerCase();
  if (raw === 'deposited' || raw === 'reconciled') {
    return {
      label: 'Deposited',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      className: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-emerald-50 text-emerald-700 border-emerald-200'
    };
  }
  return {
    label: formatStatus(status || 'Pending Deposit'),
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    className: 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border bg-amber-50 text-amber-700 border-amber-200'
  };
};

/* =========================================================
   PAYMENT METHODS & TYPES LABELS & COLORS (PRESERVED EXPORTS)
   ========================================================= */

const PAYMENT_METHOD_MAP = {
  cod: { label: 'Cash on Delivery', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cash: { label: 'Cash', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  online: { label: 'Online Payment', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  razorpay: { label: 'Razorpay', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  wallet: { label: 'Wallet', color: 'bg-primary/10 text-primary border-primary/20' },
  upi: { label: 'UPI', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  qr: { label: 'QR', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  qr_code: { label: 'QR', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  upi_qr: { label: 'QR', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  mixed: { label: 'Mixed', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  card: { label: 'Card Payment', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  netbanking: { label: 'Net Banking', color: 'bg-amber-50 text-amber-700 border-amber-200' }
};

export const getPaymentMethodLabel = (method) => {
  if (!method) return '--';
  const key = String(method).toLowerCase().trim();
  return PAYMENT_METHOD_MAP[key]?.label || titleCase(method);
};

export const getPaymentMethodColor = (method) => {
  if (!method) return DEFAULT_STATUS_META.color;
  const key = String(method).toLowerCase().trim();
  return PAYMENT_METHOD_MAP[key]?.color || DEFAULT_STATUS_META.color;
};

const BOOKING_TYPE_MAP = {
  instant: { label: 'Instant Booking', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  slot: { label: 'Slot Booking', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  scheduled: { label: 'Scheduled', color: 'bg-primary/10 text-primary border-primary/20' },
  custom: { label: 'Custom Quote', color: 'bg-amber-50 text-amber-700 border-amber-200' }
};

export const getBookingTypeLabel = (type) => {
  if (!type) return '--';
  const key = String(type).toLowerCase().trim();
  return BOOKING_TYPE_MAP[key]?.label || titleCase(type);
};

export const getBookingTypeColor = (type) => {
  if (!type) return DEFAULT_STATUS_META.color;
  const key = String(type).toLowerCase().trim();
  return BOOKING_TYPE_MAP[key]?.color || DEFAULT_STATUS_META.color;
};

const REFUND_TYPE_MAP = {
  full: { label: 'Full Refund', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  partial: { label: 'Partial Refund', color: 'bg-primary/10 text-primary border-primary/20' },
  instant: { label: 'Instant Wallet Refund', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  manual: { label: 'Manual Bank Payout', color: 'bg-amber-50 text-amber-700 border-amber-200' }
};

export const getRefundTypeLabel = (type) => {
  if (!type) return '--';
  const key = String(type).toLowerCase().trim();
  return REFUND_TYPE_MAP[key]?.label || titleCase(type);
};

export const getRefundTypeColor = (type) => {
  if (!type) return DEFAULT_STATUS_META.color;
  const key = String(type).toLowerCase().trim();
  return REFUND_TYPE_MAP[key]?.color || DEFAULT_STATUS_META.color;
};

const TRANSACTION_TYPE_MAP = {
  credit: { label: 'Credit (+)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  debit: { label: 'Debit (-)', color: 'bg-red-50 text-red-700 border-red-200' },
  booking_payment: { label: 'Booking Payment', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  provider_payout: { label: 'Provider Payout', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  commission: { label: 'Platform Commission', color: 'bg-primary/10 text-primary border-primary/20' },
  refund: { label: 'Refund', color: 'bg-rose-50 text-rose-700 border-rose-200' }
};

export const getTransactionTypeLabel = (type) => {
  if (!type) return '--';
  const key = String(type).toLowerCase().trim();
  return TRANSACTION_TYPE_MAP[key]?.label || titleCase(type);
};

export const getTransactionTypeColor = (type) => {
  if (!type) return DEFAULT_STATUS_META.color;
  const key = String(type).toLowerCase().trim();
  return TRANSACTION_TYPE_MAP[key]?.color || DEFAULT_STATUS_META.color;
};

/* =========================================================
   SEVERITY, PRIORITY, RISK & VERIFICATION BADGES (PRESERVED EXPORTS)
   ========================================================= */

export const getSeverityBadge = (severity) => {
  const s = String(severity || '').toLowerCase();
  if (s === 'critical') return { label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300' };
  if (s === 'high') return { label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300' };
  if (s === 'medium') return { label: 'Medium', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { label: 'Low', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
};

export const getPriorityBadge = (priority) => {
  const p = String(priority || '').toLowerCase();
  if (p === 'urgent') return { label: 'Urgent', color: 'bg-rose-100 text-rose-800 border-rose-300' };
  if (p === 'high') return { label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300' };
  if (p === 'medium') return { label: 'Medium', color: 'bg-blue-100 text-blue-800 border-blue-300' };
  return { label: 'Low', color: 'bg-gray-100 text-gray-700 border-gray-300' };
};

export const getRiskBadge = (riskLevel) => {
  const r = String(riskLevel || '').toLowerCase();
  if (r === 'extreme' || r === 'critical') return { label: 'Extreme Risk', color: 'bg-red-600 text-white border-red-700' };
  if (r === 'high') return { label: 'High Risk', color: 'bg-red-100 text-red-800 border-red-300' };
  if (r === 'medium') return { label: 'Medium Risk', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { label: 'Low Risk', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
};

export const getVerificationBadge = (isVerified) => {
  if (isVerified) return { label: 'Verified', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  return { label: 'Unverified', color: 'bg-amber-50 text-amber-700 border-amber-200' };
};

/* =========================================================
   PREDICATE & DOMAIN STATUS HELPERS (NEW CENTRALIZED HELPERS)
   ========================================================= */

export const isBookingPending = (status) => {
  const norm = normalizeStatus(status);
  return ['pending', 'searchingprovider', 'offered', 'paymentpending'].includes(norm);
};

export const isBookingActive = (status) => {
  const norm = normalizeStatus(status);
  return ['accepted', 'ontheway', 'arrived', 'workstarted'].includes(norm);
};

export const isBookingTerminal = (status) => {
  const norm = normalizeStatus(status);
  return ['completed', 'cancelled', 'canceled', 'rejected', 'noshow'].includes(norm);
};

export const isPaymentSuccessful = (status) => {
  const norm = normalizeStatus(status);
  return ['paid', 'success', 'successful', 'settled', 'captured'].includes(norm);
};

export const isPaymentFailed = (status) => {
  const norm = normalizeStatus(status);
  return ['failed', 'cancelled', 'canceled', 'rejected'].includes(norm);
};

export const isComplaintOpen = (status) => {
  const norm = normalizeStatus(status);
  return ['open', 'underreview', 'inprogress', 'waitingforcustomer', 'waitingforprovider', 'escalated', 'resolutionproposed', 'reopened', 'submitted', 'providerresponded', 'adminreview'].includes(norm);
};

export const isComplaintResolved = (status) => {
  const norm = normalizeStatus(status);
  return ['resolved', 'solved', 'closed', 'rejected', 'cancelled', 'refunded'].includes(norm);
};

/* =========================================================
   UI STATUS CONFIGURATIONS & COMPATIBILITY HELPERS
   ========================================================= */

export const BOOKING_STATUS_CONFIG = {
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400', icon: Timer, label: 'Finding Provider' },
  searchingprovider: { color: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400', icon: Timer, label: 'Finding Provider' },
  offered: { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', bar: 'bg-indigo-400', icon: Timer, label: 'Job Offered' },
  accepted: { color: 'bg-blue-50 text-blue-700 border-blue-200', bar: 'bg-blue-500', icon: CheckCircle, label: 'Confirmed' },
  ontheway: { color: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-sky-500', icon: Activity, label: 'On The Way' },
  arrived: { color: 'bg-cyan-50 text-cyan-700 border-cyan-200', bar: 'bg-cyan-500', icon: Activity, label: 'Arrived' },
  workstarted: { color: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500', icon: Activity, label: 'Work Started' },
  completed: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', icon: CheckCircle, label: 'Completed' },
  cancelled: { color: 'bg-red-50 text-red-600 border-red-200', bar: 'bg-red-400', icon: XCircle, label: 'Cancelled' },
  rejected: { color: 'bg-rose-50 text-rose-600 border-rose-200', bar: 'bg-rose-400', icon: XCircle, label: 'Rejected' },
  noshow: { color: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-400', icon: XCircle, label: 'No Show' },
  payment_pending: { color: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-400', icon: CreditCard, label: 'Payment Due' },
};

export const getBookingStatusCfg = (status) => {
  if (!status) return BOOKING_STATUS_CONFIG.pending;
  const key = String(status).trim().toLowerCase().replace(/[^a-z]/g, '');
  return BOOKING_STATUS_CONFIG[key] || {
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    bar: 'bg-gray-400',
    icon: AlertCircle,
    label: status ? (String(status).charAt(0).toUpperCase() + String(status).slice(1)) : 'Unknown'
  };
};

export const COMPLAINT_STATUS_CONFIG = {
  'Open': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
  'Under Review': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'In-Progress': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Waiting for Customer': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  'Waiting for Provider': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  'Escalated': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  'Resolution Proposed': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
  'Resolved': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'Solved': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
  'Rejected': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  'Cancelled': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  'Closed': { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200', dot: 'bg-gray-400' },
  'Reopened': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  reopened: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  submitted: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
  under_review: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  provider_responded: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  admin_review: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  refunded: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
};

export const getComplaintStatusStyle = (status) => {
  if (!status) return COMPLAINT_STATUS_CONFIG['Open'];
  if (COMPLAINT_STATUS_CONFIG[status]) return COMPLAINT_STATUS_CONFIG[status];
  
  const cleanKey = normalizeStatus(status);
  
  const normalizedMap = {
    'open': COMPLAINT_STATUS_CONFIG['Open'],
    'underreview': COMPLAINT_STATUS_CONFIG['Under Review'],
    'inprogress': COMPLAINT_STATUS_CONFIG['In-Progress'],
    'waitingforcustomer': COMPLAINT_STATUS_CONFIG['Waiting for Customer'],
    'waitingforprovider': COMPLAINT_STATUS_CONFIG['Waiting for Provider'],
    'escalated': COMPLAINT_STATUS_CONFIG['Escalated'],
    'resolutionproposed': COMPLAINT_STATUS_CONFIG['Resolution Proposed'],
    'resolved': COMPLAINT_STATUS_CONFIG['Resolved'],
    'solved': COMPLAINT_STATUS_CONFIG['Solved'],
    'rejected': COMPLAINT_STATUS_CONFIG['Rejected'],
    'cancelled': COMPLAINT_STATUS_CONFIG['Cancelled'],
    'closed': COMPLAINT_STATUS_CONFIG['Closed'],
    'reopened': COMPLAINT_STATUS_CONFIG['Reopened'],
    'submitted': COMPLAINT_STATUS_CONFIG['submitted'],
    'providerresponded': COMPLAINT_STATUS_CONFIG['provider_responded'],
    'adminreview': COMPLAINT_STATUS_CONFIG['admin_review'],
    'refunded': COMPLAINT_STATUS_CONFIG['refunded'],
  };

  return normalizedMap[cleanKey] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' };
};

export const COMPLAINT_STATUS_LABELS = {
  'open': 'Open',
  'underreview': 'Under Review',
  'waitingforcustomer': 'Waiting for Customer',
  'waitingforprovider': 'Waiting for Provider',
  'escalated': 'Escalated',
  'resolutionproposed': 'Resolution Proposed',
  'reopened': 'Reopened',
  'Open': 'Open',
  'Under Review': 'Under Review',
  'In-Progress': 'In Review',
  'Waiting for Customer': 'Waiting for Customer',
  'Waiting for Provider': 'Waiting for Provider',
  'Escalated': 'Escalated',
  'Resolution Proposed': 'Resolution Proposed',
  'Resolved': 'Resolved',
  'Solved': 'Resolved',
  'Rejected': 'Rejected',
  'Cancelled': 'Cancelled',
  'Closed': 'Closed',
  'Reopened': 'Reopened',
  'submitted': 'Submitted',
  'under_review': 'Under Review',
  'provider_responded': 'Provider Responded',
  'admin_review': 'Admin Review',
  'resolved': 'Resolved',
  'rejected': 'Rejected',
  'refunded': 'Refunded',
};

export const COMPLAINT_STATUS_DETAIL_LABELS = {
  'open': '○ Open',
  'underreview': '⏳ Under Review',
  'waitingforcustomer': '⌛ Waiting for Customer',
  'waitingforprovider': '⌛ Waiting for Provider',
  'escalated': '⚠️ Escalated',
  'resolutionproposed': '💡 Resolution Proposed',
  'reopened': '↩ Reopened',
  'Open': '○ Open',
  'Under Review': '⏳ Under Review',
  'In-Progress': '⏳ Being Reviewed',
  'Waiting for Customer': '⌛ Waiting for Customer',
  'Waiting for Provider': '⌛ Waiting for Provider',
  'Escalated': '⚠️ Escalated',
  'Resolution Proposed': '💡 Resolution Proposed',
  'Resolved': '✓ Resolved',
  'Solved': '✓ Issue Resolved',
  'Rejected': '✕ Rejected',
  'Cancelled': '✕ Cancelled',
  'Closed': 'Closed',
  'Reopened': '↩ Reopened',
  'submitted': 'Submitted',
  'under_review': 'Under Review',
  'provider_responded': 'Provider Responded',
  'admin_review': 'Admin Review',
  'resolved': 'Resolved',
  'rejected': 'Rejected',
  'refunded': 'Refunded',
};

/* =========================================================
   COMPLAINT CATEGORY DEFINITIONS
   ========================================================= */

export const COMPLAINT_CATEGORIES = Object.freeze([
  { value: 'serviceissue', label: 'Service Issue', icon: '🛠' },
  { value: 'paymentissue', label: 'Payment Issue', icon: '💳' },
  { value: 'refundrequest', label: 'Refund Request', icon: '💰' },
  { value: 'suggestion', label: 'Suggestion', icon: '💡' },
  { value: 'other', label: 'Other', icon: '📞' }
]);

export const COMPLAINT_CATEGORY_MAP = Object.freeze({
  serviceissue: { label: 'Service Issue', icon: '🛠' },
  paymentissue: { label: 'Payment Issue', icon: '💳' },
  refundrequest: { label: 'Refund Request', icon: '💰' },
  suggestion: { label: 'Suggestion', icon: '💡' },
  other: { label: 'Other', icon: '📞' },
  booking: { label: 'Booking', icon: '📅' },
  account: { label: 'Account', icon: '👤' },
  deliveryissue: { label: 'Delivery Issue', icon: '🚚' },
  payment: { label: 'Payment', icon: '💳' }
});

export const getComplaintCategoryInfo = (cat) => {
  if (!cat) return { label: 'Other', icon: '📞' };
  const norm = String(cat).toLowerCase().replace(/[^a-z0-9]/g, '');
  return COMPLAINT_CATEGORY_MAP[norm] || COMPLAINT_CATEGORY_MAP[cat] || { label: String(cat), icon: '📞' };
};


/* =========================================================
   PROVIDER PANEL STATUS CONFIGURATIONS
   ========================================================= */

export const PROVIDER_STATUS_CONFIG_MAP = {
  // Earning & Withdrawal statuses
  completed: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCircle, label: 'Success' },
  paid: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCircle, label: 'Paid' },
  processing: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Clock, label: 'Processing' },
  underreview: { color: 'bg-secondary/10 text-secondary border border-secondary/20', icon: Clock, label: 'Review' },
  under_review: { color: 'bg-secondary/10 text-secondary border border-secondary/20', icon: Clock, label: 'Review' },
  pendingrelease: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Clock, label: 'Pending Release' },
  pending_release: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Clock, label: 'Pending Release' },
  approved: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCircle, label: 'Approved' },
  requested: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Clock, label: 'Requested' },
  failed: { color: 'bg-red-50 text-red-700 border border-red-200', icon: XCircle, label: 'Failed' },
  rejected: { color: 'bg-red-50 text-red-700 border border-red-200', icon: XCircle, label: 'Rejected' },
  withdrawn: { color: 'bg-secondary/10 text-secondary border border-secondary/20', icon: CheckCircle, label: 'Withdrawn' },
  disputehold: { color: 'bg-red-50 text-red-700 border border-red-200', icon: ShieldAlert, label: 'Dispute Hold' },
  dispute_hold: { color: 'bg-red-50 text-red-700 border border-red-200', icon: ShieldAlert, label: 'Dispute Hold' },
  adminhold: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Lock, label: 'Admin Hold' },
  admin_hold: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Lock, label: 'Admin Hold' },
  held: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Lock, label: 'Held' },
  available: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCircle, label: 'Ready for withdrawal' },

  // Booking statuses
  pending: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Timer, label: 'Pending' },
  searchingprovider: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Timer, label: 'Searching Provider' },
  offered: { color: 'bg-accent/10 text-accent border border-accent/20', icon: Timer, label: 'Offered' },
  accepted: { color: 'bg-primary/10 text-primary border border-primary/20', icon: CheckCheck, label: 'Accepted' },
  ontheway: { color: 'bg-secondary/10 text-secondary border border-secondary/20', icon: Activity, label: 'On The Way' },
  arrived: { color: 'bg-secondary/10 text-secondary border border-secondary/20', icon: Activity, label: 'Arrived' },
  workstarted: { color: 'bg-secondary/10 text-secondary border border-secondary/20', icon: Activity, label: 'Work Started' },
  cancelled: { color: 'bg-red-50 text-red-600 border border-red-200', icon: X, label: 'Cancelled' },
  noshow: { color: 'bg-orange-50 text-orange-700 border border-orange-200', icon: AlertCircle, label: 'No Show' }
};

export const getProviderStatusCfg = (status) => {
  if (!status) return { color: 'bg-gray-100 text-secondary/70 border border-gray-200', icon: AlertCircle, label: 'Unknown' };
  const key = normalizeStatus(status);
  return PROVIDER_STATUS_CONFIG_MAP[key] || PROVIDER_STATUS_CONFIG_MAP[String(status).toLowerCase()] || {
    color: getStatusColor(status, 'provider'),
    icon: AlertCircle,
    label: formatStatus(status)
  };
};



