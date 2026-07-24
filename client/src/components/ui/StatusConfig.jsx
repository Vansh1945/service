import { Timer, CheckCircle, Activity, XCircle, CreditCard, AlertCircle } from 'lucide-react';

export const BOOKING_STATUS_CONFIG = {
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400', icon: Timer, label: 'Finding Provider' },
  Pending: { color: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400', icon: Timer, label: 'Finding Provider' },
  SearchingProvider: { color: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-400', icon: Timer, label: 'Finding Provider' },
  Offered: { color: 'bg-indigo-50 text-indigo-700 border-indigo-200', bar: 'bg-indigo-400', icon: Timer, label: 'Job Offered' },
  Accepted: { color: 'bg-blue-50 text-blue-700 border-blue-200', bar: 'bg-blue-500', icon: CheckCircle, label: 'Confirmed' },
  accepted: { color: 'bg-blue-50 text-blue-700 border-blue-200', bar: 'bg-blue-500', icon: CheckCircle, label: 'Confirmed' },
  OnTheWay: { color: 'bg-sky-50 text-sky-700 border-sky-200', bar: 'bg-sky-500', icon: Activity, label: 'On The Way' },
  Arrived: { color: 'bg-cyan-50 text-cyan-700 border-cyan-200', bar: 'bg-cyan-500', icon: Activity, label: 'Arrived' },
  WorkStarted: { color: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500', icon: Activity, label: 'Work Started' },
  in_progress: { color: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500', icon: Activity, label: 'In Progress' },
  'in-progress': { color: 'bg-violet-50 text-violet-700 border-violet-200', bar: 'bg-violet-500', icon: Activity, label: 'In Progress' },
  Completed: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', icon: CheckCircle, label: 'Completed' },
  completed: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500', icon: CheckCircle, label: 'Completed' },
  Cancelled: { color: 'bg-red-50 text-red-600 border-red-200', bar: 'bg-red-400', icon: XCircle, label: 'Cancelled' },
  cancelled: { color: 'bg-red-50 text-red-600 border-red-200', bar: 'bg-red-400', icon: XCircle, label: 'Cancelled' },
  payment_pending: { color: 'bg-orange-50 text-orange-700 border-orange-200', bar: 'bg-orange-400', icon: CreditCard, label: 'Payment Due' },
};

export const getBookingStatusCfg = (status) => {
  return BOOKING_STATUS_CONFIG[status] || {
    color: 'bg-gray-100 text-gray-600 border-gray-200',
    bar: 'bg-gray-400',
    icon: AlertCircle,
    label: status || 'Unknown'
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
  submitted: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
  under_review: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  provider_responded: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  admin_review: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
  refunded: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' },
};

export const getComplaintStatusStyle = (status) => {
  return COMPLAINT_STATUS_CONFIG[status] || COMPLAINT_STATUS_CONFIG['Open'];
};

export const COMPLAINT_STATUS_LABELS = {
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
