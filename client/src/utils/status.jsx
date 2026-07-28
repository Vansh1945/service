/**
 * Single Source of Truth for Status & UI Badge Helpers.
 * Standardizes status colors, badge classes, humanized labels, and status configurations
 * across Bookings, Payments, Transactions, Refunds, Settlements, Withdrawals, Complaints, Providers, Customers, and Deposits.
 */
import { titleCase } from './format';

/* =========================================================
   GENERIC STATUS FORMATTER
   ========================================================= */

/**
 * Format raw status string into clean human-readable text
 * @param {string} status - Raw status string (e.g. "under_review", "payment_pending", "not_deposited")
 * @returns {string} Humanized status string
 */
export const formatStatus = (status) => {
  if (!status || typeof status !== 'string') return '--';
  const clean = status.trim().toLowerCase();
  if (clean === 'not_deposited' || clean === 'notdeposited') return 'Not Deposited';
  if (clean === 'pending_deposit' || clean === 'pendingdeposit') return 'Pending Deposit';
  if (clean === 'pending_settlement' || clean === 'pendingsettlement') return 'Pending Settlement';
  if (clean === 'pending_verify' || clean === 'pendingverify') return 'Pending Verify';
  return titleCase(status);
};

/* =========================================================
   STATUS COLOR & BADGE CONFIGURATIONS
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
  unverified: 'bg-amber-50 text-amber-700 border-amber-200',

  // Warning / Hold statuses
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

/**
 * Get color styling classes for any status value
 * @param {string} status
 * @param {string} [module='generic']
 * @returns {string} Tailwind CSS class string
 */
export const getStatusColor = (status, module = 'generic') => {
  if (!status) return 'bg-gray-100 text-gray-700 border-gray-200';
  const key = String(status).toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
  return STATUS_COLOR_MAP[key] || STATUS_COLOR_MAP[String(status).toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
};

/**
 * Get structured badge configuration object containing label and styling classes
 * @param {string} status
 * @param {string} [module='generic']
 * @returns {Object} { label: string, color: string, className: string }
 */
export const getStatusBadge = (status, module = 'generic') => {
  const label = formatStatus(status);
  const color = getStatusColor(status, module);
  return {
    label,
    color,
    className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color}`
  };
};

/* =========================================================
   MODULE SPECIFIC STATUS BADGES & COLORS
   ========================================================= */

export const getBookingStatusColor = (status) => getStatusColor(status, 'booking');
export const getBookingStatusBadge = (status) => getStatusBadge(status, 'booking');

export const getPaymentStatusColor = (status) => getStatusColor(status, 'payment');
export const getPaymentStatusBadge = (status) => getStatusBadge(status, 'payment');

export const getRefundStatusColor = (status) => getStatusColor(status, 'refund');
export const getRefundStatusBadge = (status) => getStatusBadge(status, 'refund');

export const getComplaintStatusColor = (status) => getStatusColor(status, 'complaint');
export const getComplaintStatusBadge = (status) => getStatusBadge(status, 'complaint');

export const getSettlementStatusColor = (status) => getStatusColor(status, 'settlement');
export const getSettlementStatusBadge = (status) => getStatusBadge(status, 'settlement');

export const getWithdrawalStatusColor = (status) => getStatusColor(status, 'withdrawal');
export const getWithdrawalStatusBadge = (status) => getStatusBadge(status, 'withdrawal');

export const getProviderStatusColor = (status) => getStatusColor(status, 'provider');
export const getProviderStatusBadge = (status) => getStatusBadge(status, 'provider');

export const getCustomerStatusColor = (status) => getStatusColor(status, 'customer');
export const getCustomerStatusBadge = (status) => getStatusBadge(status, 'customer');

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
   PAYMENT METHODS & TYPES LABELS & COLORS
   ========================================================= */

const PAYMENT_METHOD_MAP = {
  cod: { label: 'Cash on Delivery', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  online: { label: 'Online Payment', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  razorpay: { label: 'Razorpay', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  wallet: { label: 'Wallet', color: 'bg-primary/10 text-primary border-primary/20' },
  upi: { label: 'UPI', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  card: { label: 'Card Payment', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  netbanking: { label: 'Net Banking', color: 'bg-amber-50 text-amber-700 border-amber-200' }
};

export const getPaymentMethodLabel = (method) => {
  if (!method) return '--';
  const key = String(method).toLowerCase().trim();
  return PAYMENT_METHOD_MAP[key]?.label || titleCase(method);
};

export const getPaymentMethodColor = (method) => {
  if (!method) return 'bg-gray-100 text-gray-700 border-gray-200';
  const key = String(method).toLowerCase().trim();
  return PAYMENT_METHOD_MAP[key]?.color || 'bg-gray-100 text-gray-700 border-gray-200';
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
  if (!type) return 'bg-gray-100 text-gray-700 border-gray-200';
  const key = String(type).toLowerCase().trim();
  return BOOKING_TYPE_MAP[key]?.color || 'bg-gray-100 text-gray-700 border-gray-200';
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
  if (!type) return 'bg-gray-100 text-gray-700 border-gray-200';
  const key = String(type).toLowerCase().trim();
  return REFUND_TYPE_MAP[key]?.color || 'bg-gray-100 text-gray-700 border-gray-200';
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
  if (!type) return 'bg-gray-100 text-gray-700 border-gray-200';
  const key = String(type).toLowerCase().trim();
  return TRANSACTION_TYPE_MAP[key]?.color || 'bg-gray-100 text-gray-700 border-gray-200';
};

/* =========================================================
   SEVERITY, PRIORITY, RISK & VERIFICATION BADGES
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
