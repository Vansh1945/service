// src/features/admin/complaints/Refund.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/auth';
import * as AdminService from '../../../services/AdminService';
import {
  RefreshCw, Eye, Clock, X, Inbox, DollarSign,
  RotateCw, ShieldCheck, Wallet, CreditCard, FileText,
  Plus, CheckCircle2, XCircle, AlertTriangle, ArrowUpRight,
  Filter, Search, Calendar, ChevronRight, User, UserCheck
} from 'lucide-react';
import Pagination from '../../../components/ui/Pagination';
import { formatDateTime } from '../../../utils/format';
import { normalizeStatus } from '../../../utils/status';

// ── Dropdown Configs ────────────────────────
const refundStatusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed Payout' },
  { value: 'rejected', label: 'Rejected Claim' },
  { value: 'cancelled', label: 'Cancelled' },
];

const sourceOptions = [
  { value: 'all', label: 'All Sources' },
  { value: 'customer_cancellation', label: 'Customer Cancellation' },
  { value: 'provider_cancellation', label: 'Provider Cancellation' },
  { value: 'admin_cancellation', label: 'Admin Cancellation' },
  { value: 'auto_cancellation', label: 'System Auto Cancel' },
  { value: 'complaint_resolution', label: 'Complaint Resolution' },
  { value: 'duplicate_payment', label: 'Duplicate Payment' },
  { value: 'failed_payment', label: 'Gateway Failure' },
  { value: 'wallet_adjustment', label: 'Wallet Adjustment' },
  { value: 'manual_refund', label: 'Manual Action' },
];

const destinationOptions = [
  { value: 'all', label: 'All Destinations' },
  { value: 'original_payment', label: 'Original Gateway' },
  { value: 'wallet', label: 'Customer Wallet' },
  { value: 'hybrid', label: 'Split / Hybrid' }
];

const refundTypeOptions = [
  { value: 'all', label: 'All Refund Types' },
  { value: 'cancellation', label: 'Cancellation' },
  { value: 'complaint', label: 'Complaint Refund' },
  { value: 'admin_adjustment', label: 'Admin Adjustment' },
  { value: 'payment_failure', label: 'Payment Failure' },
  { value: 'duplicate_payment', label: 'Duplicate Payment' },
  { value: 'manual', label: 'Manual Refund' },
  { value: 'auto', label: 'Auto Refund' },
  { value: 'partial', label: 'Partial Refund' },
  { value: 'full', label: 'Full Refund' },
];

const paymentMethodOptions = [
  { value: 'all', label: 'All Payment Methods' },
  { value: 'online', label: 'Online' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'cash', label: 'Cash / COD' },
  { value: 'mixed', label: 'Mixed' }
];

// ── Status Badges ────────────────────────
const RefundStatusBadge = ({ status }) => {
  const cfg = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-blue-50 text-blue-800 border-blue-200',
    processing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    failed: 'bg-red-50 text-red-800 border-red-200',
    rejected: 'bg-gray-100 text-gray-700 border-gray-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${cfg[status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

// ── Create Manual Refund Modal ──────────────────
const CreateManualRefundModal = ({ onClose, onSuccess }) => {
  const { showToast } = useAuth();
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [refundType, setRefundType] = useState('full');
  const [refundSource, setRefundSource] = useState('admin_action');
  const [refundDestination, setRefundDestination] = useState('original_payment');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bookingId.trim()) {
      showToast('Please enter a valid Booking ID', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await AdminService.createManualRefund({
        bookingId: bookingId.trim(),
        amount: amount ? Number(amount) : undefined,
        reason,
        refundType,
        refundSource,
        refundDestination,
        notes,
      });
      if (res.data?.success) {
        showToast(res.data.message || 'Manual refund request created successfully', 'success');
        onSuccess();
        onClose();
      } else {
        showToast(res.data?.message || 'Failed to create manual refund', 'error');
      }
    } catch (err) {
      console.error('Error creating manual refund:', err);
      showToast(err.response?.data?.message || 'Error processing manual refund request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-secondary/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-secondary text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Plus size={20} className="text-primary" />
            <h3 className="text-base font-bold">Create Manual Refund Request</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Booking Database ID / Reference *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 64f1a2b3c4d5e6f7a8b9c0d1 or BKG-10294"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary focus:bg-white outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Refund Type
              </label>
              <select
                value={refundType}
                onChange={(e) => setRefundType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 outline-none"
              >
                <option value="full">Full Refund</option>
                <option value="partial">Partial Refund</option>
                <option value="cancellation">Cancellation</option>
                <option value="complaint">Complaint Resolution</option>
                <option value="admin_adjustment">Admin Adjustment</option>
                <option value="duplicate_payment">Duplicate Payment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Refund Amount (₹) {refundType === 'full' ? '(Auto Full)' : '*'}
              </label>
              <input
                type="number"
                min="1"
                step="any"
                placeholder={refundType === 'full' ? 'Leave empty for full amount' : 'Enter amount in ₹'}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-secondary focus:bg-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Refund Source
              </label>
              <select
                value={refundSource}
                onChange={(e) => setRefundSource(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 outline-none"
              >
                <option value="admin_action">Admin Action</option>
                <option value="customer_cancellation">Customer Cancellation</option>
                <option value="provider_cancellation">Provider Cancellation</option>
                <option value="complaint_resolution">Complaint Resolution</option>
                <option value="duplicate_payment">Duplicate Payment</option>
                <option value="gateway_failure">Gateway Failure</option>
                <option value="wallet_adjustment">Wallet Adjustment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Refund Destination
              </label>
              <select
                value={refundDestination}
                onChange={(e) => setRefundDestination(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-800 outline-none"
              >
                <option value="original_payment">Original Gateway</option>
                <option value="wallet">Customer Wallet</option>
                <option value="hybrid">Split / Hybrid (Original Proportions)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Refund Reason / Business Justification *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Service quality dispute resolution approved by support manager"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary focus:bg-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Admin Internal Notes
            </label>
            <textarea
              rows="2"
              placeholder="Additional internal audit details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium focus:bg-white outline-none"
            />
          </div>

          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <span className="font-bold flex items-center gap-1"><AlertTriangle size={14} /> Audit & Safety Verification</span>
            <p className="text-[11px] text-amber-800">
              The system will automatically verify paid booking amounts, prior completed refunds, and calculate remaining refundable balance to prevent duplicate credits.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-150">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Submit Manual Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── View Details Modal / Operations Drawer ──────────────────
const DetailedInspectionModal = ({ data, isLedgerItem, onClose, onActionSuccess, onRetry }) => {
  const { showToast } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');
  const [decisionType, setDecisionType] = useState('refund_full');
  const [refundAmount, setRefundAmount] = useState(data?.refundAmount || data?.totalAmount || 0);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!data) return null;

  const booking = isLedgerItem ? (data.bookingId || {}) : data;
  const customer = isLedgerItem ? (data.customerId || booking.customer || {}) : (booking.customer || {});
  const provider = isLedgerItem ? (data.providerId || booking.provider || {}) : (booking.provider || {});
  const totalAmount = booking.totalAmount || data.requestedAmount || data.refundAmount || 0;
  const cancellationReason = data.cancellationReason || data.refundReason || booking.cancellationProgress?.reason || booking.adminRemark || 'Booking Cancellation / Dispute';
  const isPending = data.refundStatus === 'pending' || normalizeStatus(booking.paymentStatus) === 'refundpending';

  const handleApproveAction = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      let res;
      if (data._id && isLedgerItem) {
        res = await AdminService.approveRefundById(data._id, { reason: resolutionNotes });
      } else {
        res = await AdminService.processRefund(booking._id, {
          amount: decisionType === 'refund_partial' ? refundAmount : totalAmount,
          reason: resolutionNotes || 'Admin approved refund',
          type: decisionType === 'refund_partial' ? 'partial' : 'full',
        });
      }
      if (res.data?.success) {
        showToast(res.data.message || 'Refund successfully approved & executed', 'success');
        onActionSuccess();
        onClose();
      } else {
        showToast(res.data?.message || 'Failed to approve refund', 'error');
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        showToast(err.response?.data?.message || 'Refund claim already processed (Conflict)', 'info');
        onActionSuccess();
        onClose();
      } else {
        showToast(err.response?.data?.message || 'Error executing refund action', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectAction = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      let res;
      if (data._id && isLedgerItem) {
        res = await AdminService.rejectRefundById(data._id, { reason: resolutionNotes });
      } else {
        res = await AdminService.rejectRefund(booking._id, { reason: resolutionNotes });
      }
      if (res.data?.success) {
        showToast('Refund claim rejected successfully', 'success');
        onActionSuccess();
        onClose();
      } else {
        showToast(res.data?.message || 'Failed to reject refund', 'error');
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        showToast(err.response?.data?.message || 'Refund claim already processed (Conflict)', 'info');
        onActionSuccess();
        onClose();
      } else {
        showToast(err.response?.data?.message || 'Error rejecting refund action', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-secondary/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-xs">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isLedgerItem ? `Refund Ledger Record #${data.refundId}` : `Booking Financial Case #${booking.bookingId || booking._id}`}
              </h3>
              <p className="text-xs text-gray-400">Booking Reference: #{booking.bookingId || booking._id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 bg-gray-50 border-b border-gray-200 flex items-center gap-4 text-xs font-bold text-gray-600 overflow-x-auto">
          <button
            onClick={() => setActiveTab('summary')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${activeTab === 'summary' ? 'border-primary text-primary font-extrabold' : 'border-transparent hover:text-gray-900'}`}
          >
            Refund Summary
          </button>
          <button
            onClick={() => setActiveTab('gateway')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${activeTab === 'gateway' ? 'border-primary text-primary font-extrabold' : 'border-transparent hover:text-gray-900'}`}
          >
            Gateway & Wallet
          </button>
          <button
            onClick={() => setActiveTab('booking')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${activeTab === 'booking' ? 'border-primary text-primary font-extrabold' : 'border-transparent hover:text-gray-900'}`}
          >
            Booking & Customer
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`py-3 border-b-2 transition-colors cursor-pointer ${activeTab === 'audit' ? 'border-primary text-primary font-extrabold' : 'border-transparent hover:text-gray-900'}`}
          >
            Audit Timeline
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'summary' && (
            <>
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-primary/10 p-3.5 rounded-xl border border-primary/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">Total Refund Amount</span>
                  <span className="text-lg font-extrabold text-secondary">₹{data.refundAmount || totalAmount}</span>
                </div>
                <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Gateway Portion</span>
                  <span className="text-lg font-extrabold text-blue-900">₹{data.gatewayRefundAmount || 0}</span>
                </div>
                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Wallet Portion</span>
                  <span className="text-lg font-extrabold text-emerald-900">₹{data.walletRefundAmount || 0}</span>
                </div>
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Refund Status</span>
                  <div className="mt-1"><RefundStatusBadge status={data.refundStatus || booking.paymentStatus} /></div>
                </div>
              </div>

              {/* Status Breakdown & Attributes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-400 font-bold uppercase block text-[10px]">Refund Source</span>
                  <span className="font-extrabold text-gray-800 capitalize">{data.refundSource?.replace('_', ' ') || 'Booking Cancellation'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold uppercase block text-[10px]">Refund Destination</span>
                  <span className="font-extrabold text-secondary capitalize flex items-center gap-1">
                    {data.refundDestination === 'wallet' ? <Wallet size={12} className="text-primary" /> : <CreditCard size={12} className="text-blue-600" />}
                    {data.refundDestination?.replace('_', ' ') || 'Original Gateway'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold uppercase block text-[10px]">Refund Type</span>
                  <span className="font-extrabold text-gray-800 uppercase">{data.refundType || 'Auto'}</span>
                </div>
                <div>
                  <span className="text-gray-400 font-bold uppercase block text-[10px]">Original Payment Method</span>
                  <span className="font-extrabold text-gray-800 uppercase">{data.originalPaymentMethod || booking.paymentMethod || 'Online'}</span>
                </div>
              </div>

              {/* Reason Banner */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <FileText size={14} /> Refund / Cancellation Reason
                </span>
                <p className="text-xs font-semibold text-amber-950 leading-relaxed">{cancellationReason}</p>
              </div>

              {/* Smart Actions Bar */}
              <div className="bg-gray-100 p-3.5 rounded-xl border border-gray-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 mr-2">Smart Actions:</span>
                {booking._id && (
                  <button
                    onClick={() => navigate(`/admin/bookings`)}
                    className="px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 font-bold rounded-lg border border-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    View Booking <ArrowUpRight size={12} />
                  </button>
                )}
                <button
                  onClick={() => navigate(`/admin/payments`)}
                  className="px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 font-bold rounded-lg border border-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  View Payment <ArrowUpRight size={12} />
                </button>
                <button
                  onClick={() => navigate(`/admin/transactions`)}
                  className="px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 font-bold rounded-lg border border-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  View Transaction <ArrowUpRight size={12} />
                </button>
                {customer._id && (
                  <button
                    onClick={() => navigate(`/admin/customer-wallets`)}
                    className="px-3 py-1.5 bg-white text-gray-700 hover:bg-gray-50 font-bold rounded-lg border border-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    View Customer Wallet <ArrowUpRight size={12} />
                  </button>
                )}
                {data.refundStatus === 'failed' && (
                  <button
                    onClick={() => onRetry(data._id)}
                    className="px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCw size={12} /> Retry Gateway Sync
                  </button>
                )}
              </div>
            </>
          )}

          {activeTab === 'gateway' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Razorpay Gateway Integration Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 font-semibold block text-[10px] uppercase">Razorpay Payment ID</span>
                    <span className="font-mono font-bold text-gray-800">{data.gatewayPaymentId || booking.razorpayPaymentId || 'pay_N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-semibold block text-[10px] uppercase">Razorpay Order ID</span>
                    <span className="font-mono font-bold text-primary">{data.gatewayOrderId || booking.razorpayOrderId || 'order_N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-semibold block text-[10px] uppercase">Gateway Refund ID</span>
                    <span className="font-mono font-bold text-emerald-700">{data.gatewayRefundId || 'rfnd_N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Customer Wallet Credit Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 font-semibold block text-[10px] uppercase">Wallet Transaction ID</span>
                    <span className="font-mono font-bold text-secondary">{data.walletTransactionId || 'WTX_N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-semibold block text-[10px] uppercase">Wallet Credit Amount</span>
                    <span className="font-mono font-bold text-emerald-800">₹{data.walletRefundAmount || 0}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-semibold block text-[10px] uppercase">Ledger Transaction ID</span>
                    <span className="font-mono font-bold text-gray-700">{data.transactionId?._id || data.transactionId || 'TXN_N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'booking' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
                  <h4 className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={14} className="text-purple-600" /> Customer Information
                  </h4>
                  <p className="font-bold text-gray-900 text-sm">{customer.name || 'N/A'}</p>
                  <p className="text-gray-600">Email: {customer.email || 'N/A'}</p>
                  <p className="text-gray-600">Phone: {customer.phone || 'N/A'}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
                  <h4 className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck size={14} className="text-blue-600" /> Provider Information
                  </h4>
                  <p className="font-bold text-gray-900 text-sm">{provider.name || 'Unassigned / System'}</p>
                  <p className="text-gray-600">Email: {provider.email || 'N/A'}</p>
                  <p className="text-gray-600">Phone: {provider.phone || 'N/A'}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-2">
                <h4 className="font-bold text-gray-800 uppercase tracking-wider">Settlement & Provider Earnings Impact</h4>
                <p className="text-gray-600 leading-relaxed">
                  Upon refund completion, provider pending earnings for Booking #{booking.bookingId || booking._id} are automatically re-aligned and marked cancelled to prevent platform leakage and maintain zero-deficit balance.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Step-by-Step Audit Timeline</h4>
              {data.timeline && data.timeline.length > 0 ? (
                <div className="relative pl-6 border-l-2 border-purple-200 space-y-4 text-xs">
                  {data.timeline.map((step, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-white" />
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-900 uppercase text-[11px]">{step.status?.replace('_', ' ')}</span>
                          <span className="text-[10px] text-gray-400 font-medium">{formatDateTime(step.timestamp)}</span>
                        </div>
                        <p className="text-gray-700 text-xs mt-1">{step.notes || 'Status updated'}</p>
                        <span className="text-[10px] text-gray-400 block mt-1">Actor: {step.actor || 'System'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-xl text-center text-xs text-gray-500">
                  Created by: {data.requestedBy?.name || 'System / Customer'} on {formatDateTime(data.createdAt)}
                  {data.approvedBy && <p className="mt-1 font-semibold text-purple-900">Approved by: {data.approvedBy?.name || 'Admin'}</p>}
                </div>
              )}
            </div>
          )}

          {/* Action Execution Box for Pending Requests */}
          {isPending && (
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200 space-y-3 mt-4">
              <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-purple-700" /> Admin Decision & Approval Action
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Decision Type</label>
                  <select
                    value={decisionType}
                    onChange={e => setDecisionType(e.target.value)}
                    className="w-full p-2 bg-white border border-purple-200 rounded-lg font-bold text-purple-950 outline-none"
                  >
                    <option value="refund_full">Approve Full Refund (₹{totalAmount})</option>
                    <option value="refund_partial">Approve Partial Refund</option>
                    <option value="reject">Reject Refund Request</option>
                  </select>
                </div>

                {decisionType === 'refund_partial' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Partial Amount (₹)</label>
                    <input
                      type="number"
                      max={totalAmount}
                      value={refundAmount}
                      onChange={e => setRefundAmount(e.target.value)}
                      className="w-full p-2 bg-white border border-purple-200 rounded-lg font-bold text-purple-950 outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Resolution Remarks / Audit Notes</label>
                <textarea
                  rows="2"
                  placeholder="Reason for decision..."
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  className="w-full p-2 bg-white border border-purple-200 rounded-lg text-xs outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {decisionType === 'reject' ? (
                  <button
                    onClick={handleRejectAction}
                    disabled={submitting}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle size={14} /> Reject Refund
                  </button>
                ) : (
                  <button
                    onClick={handleApproveAction}
                    disabled={submitting}
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 size={14} /> Approve & Execute Refund
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Refund Operations Console Page ──────────────────
const RefundPage = () => {
  const { showToast } = useAuth();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' or 'disputes'
  const [refunds, setRefunds] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpiStats, setKpiStats] = useState({
    totalRefundAmount: 0,
    pendingAmount: 0,
    gatewayRefundAmount: 0,
    walletRefundAmount: 0,
    pendingCount: 0,
    completedCount: 0,
    failedCount: 0,
    autoCount: 0,
    manualCount: 0
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all');
  const [filterSource, setFilterSource] = useState('all');
  const [filterDestination, setFilterDestination] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination & Modals
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLedgerItem, setIsLedgerItem] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchAbortControllerRef = useRef(null);

  const fetchLedgerData = useCallback(async () => {
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    fetchAbortControllerRef.current = new AbortController();

    setLoading(true);
    try {
      if (activeTab === 'ledger') {
        const res = await AdminService.getRefundLedger({
          page: pagination.page,
          limit: pagination.limit,
          status: filterStatus !== 'all' ? filterStatus : undefined,
          source: filterSource !== 'all' ? filterSource : undefined,
          destination: filterDestination !== 'all' ? filterDestination : undefined,
          refundType: filterType !== 'all' ? filterType : undefined,
          paymentMethod: filterPaymentMethod !== 'all' ? filterPaymentMethod : undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          search: searchTerm || undefined,
        }, { signal: fetchAbortControllerRef.current.signal });

        if (res.data?.success) {
          setRefunds(res.data.data || []);
          if (res.data.stats) setKpiStats(res.data.stats);
          if (res.data.pagination) setPagination(res.data.pagination);
        }
      } else {
        const res = await AdminService.getCancellationAlerts({
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm || undefined,
        }, { signal: fetchAbortControllerRef.current.signal });
        if (res.data?.success) {
          setBookings(res.data.data || []);
          if (res.data.pagination) setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('Error fetching refund data:', err);
        showToast('Failed to load refund operations data', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, pagination.page, pagination.limit, filterStatus, filterSource, filterDestination, filterType, filterPaymentMethod, fromDate, toDate, searchTerm, showToast]);

  useEffect(() => {
    fetchLedgerData();
  }, [fetchLedgerData]);

  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (searchParams.get('openDetail') === 'true' && refunds.length > 0 && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const searchVal = searchParams.get('search');
      const target = refunds.find(r =>
        r.refundId === searchVal ||
        r._id === searchVal ||
        r.gatewayRefundId === searchVal ||
        r.transactionId === searchVal ||
        r.bookingId?.bookingId === searchVal ||
        r.bookingId?._id === searchVal
      ) || refunds[0];
      if (target) {
        setSelectedItem(target);
        setIsLedgerItem(true);
      }
    }
  }, [searchParams, refunds]);

  const handleRetryRefund = async (refundId) => {
    try {
      const res = await AdminService.retryRefundLedger(refundId);
      if (res.data?.success) {
        showToast(res.data.message || 'Refund retry initiated', 'success');
        fetchLedgerData();
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error retrying refund payout', 'error');
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterSource('all');
    setFilterDestination('all');
    setFilterType('all');
    setFilterPaymentMethod('all');
    setFromDate('');
    setToDate('');
    setPagination(p => ({ ...p, page: 1 }));
  };

  return (
    <div className="p-6 bg-gray-50/50 min-h-screen space-y-6">
      {/* Header Title & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-150 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-secondary flex items-center gap-2">
            <DollarSign className="text-primary" size={24} /> Refund Operations Console
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Enterprise Auto, Manual, Gateway & Wallet Refund Management, Approval Workflows & Razorpay Integration
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLedgerData}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={16} /> Create Manual Refund
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary block">Total Refunded</span>
          <span className="text-lg font-black text-secondary">₹{kpiStats.totalRefundAmount || 0}</span>
          <span className="text-[10px] text-gray-400 block">{kpiStats.completedCount || 0} Completed Payouts</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">Pending Approval</span>
          <span className="text-lg font-black text-amber-900">₹{kpiStats.pendingAmount || 0}</span>
          <span className="text-[10px] text-amber-600 block">{kpiStats.pendingCount || 0} Pending Claims</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 block">Gateway Refunds</span>
          <span className="text-lg font-black text-blue-950">₹{kpiStats.gatewayRefundAmount || 0}</span>
          <span className="text-[10px] text-gray-400 block">Razorpay Direct Payouts</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">Wallet Refunds</span>
          <span className="text-lg font-black text-emerald-950">₹{kpiStats.walletRefundAmount || 0}</span>
          <span className="text-[10px] text-gray-400 block">Customer Wallet Credits</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">Auto vs Manual</span>
          <span className="text-lg font-black text-indigo-950">{kpiStats.autoCount || 0} / {kpiStats.manualCount || 0}</span>
          <span className="text-[10px] text-gray-400 block">System / Admin Ratio</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700 block">Failed Payouts</span>
          <span className="text-lg font-black text-red-900">{kpiStats.failedCount || 0}</span>
          <span className="text-[10px] text-red-500 block">Action Required</span>
        </div>
      </div>

      {/* Console Controls & Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-150 shadow-xs space-y-3">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-gray-150 pb-3">
          <div className="flex items-center gap-3 text-xs font-bold">
            <button
              onClick={() => { setActiveTab('ledger'); setPagination(p => ({ ...p, page: 1 })); }}
              className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${activeTab === 'ledger' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Refund Ledger Console
            </button>
            <button
              onClick={() => { setActiveTab('disputes'); setPagination(p => ({ ...p, page: 1 })); }}
              className={`px-4 py-2 rounded-xl transition-colors cursor-pointer ${activeTab === 'disputes' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Cancellation & Dispute Cases
            </button>
          </div>

          <button
            onClick={handleResetFilters}
            className="text-xs text-primary font-bold hover:underline cursor-pointer"
          >
            Reset All Filters
          </button>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* Search */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search Refund ID, Booking ID, Customer, Gateway..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-medium outline-none focus:bg-white"
            />
          </div>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-700 outline-none"
          >
            {refundStatusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>

          {/* Source */}
          <select
            value={filterSource}
            onChange={e => { setFilterSource(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-700 outline-none"
          >
            {sourceOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>

          {/* Destination */}
          <select
            value={filterDestination}
            onChange={e => { setFilterDestination(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-700 outline-none"
          >
            {destinationOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>

          {/* Type */}
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-700 outline-none"
          >
            {refundTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      {/* Main Operations Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-150 overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'ledger' ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 border-b border-gray-150 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3">Refund ID</th>
                  <th className="px-3 py-3">Booking ID</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Provider</th>
                  <th className="px-3 py-3">Reason</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Destination</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Method</th>
                  <th className="px-3 py-3">Gateway Amt</th>
                  <th className="px-3 py-3">Wallet Amt</th>
                  <th className="px-3 py-3">Total Refund</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Approved By</th>
                  <th className="px-3 py-3">Created Date</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="16" className="p-8 text-center text-gray-400">Loading Refund Operations Ledger...</td>
                  </tr>
                ) : refunds.length === 0 ? (
                  <tr>
                    <td colSpan="16" className="p-12 text-center text-gray-400">
                      <Inbox size={32} className="mx-auto mb-2 text-gray-300" />
                      <p className="font-bold text-gray-600">No refund ledger records matching criteria</p>
                    </td>
                  </tr>
                ) : (
                  refunds.map(r => (
                    <tr key={r._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-3 py-3 font-mono font-bold text-secondary">{r.refundId}</td>
                      <td className="px-3 py-3 font-semibold text-secondary">
                        #{r.bookingId?.bookingId || r.bookingId?._id?.slice(-8) || 'N/A'}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-bold text-gray-800">{r.customerId?.name || '—'}</p>
                        <p className="text-[10px] text-gray-400">{r.customerId?.phone}</p>
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-700">{r.providerId?.name || 'Unassigned'}</td>
                      <td className="px-3 py-3 max-w-[140px] truncate text-gray-600" title={r.refundReason || r.cancellationReason}>
                        {r.refundReason || r.cancellationReason || '—'}
                      </td>
                      <td className="px-3 py-3 font-semibold text-gray-700 capitalize">{r.refundSource?.replace('_', ' ')}</td>
                      <td className="px-3 py-3">
                        <span className="font-bold capitalize inline-flex items-center gap-1 text-gray-700">
                          {r.refundDestination === 'wallet' ? <Wallet size={12} className="text-primary" /> : <CreditCard size={12} className="text-blue-600" />}
                          {r.refundDestination?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold uppercase text-gray-600">{r.refundType}</td>
                      <td className="px-3 py-3 font-bold uppercase text-gray-700">{r.originalPaymentMethod || 'Online'}</td>
                      <td className="px-3 py-3 font-extrabold text-blue-900">₹{r.gatewayRefundAmount || 0}</td>
                      <td className="px-3 py-3 font-extrabold text-secondary">₹{r.walletRefundAmount || 0}</td>
                      <td className="px-3 py-3 font-black text-secondary text-sm">₹{r.refundAmount}</td>
                      <td className="px-3 py-3"><RefundStatusBadge status={r.refundStatus} /></td>
                      <td className="px-3 py-3 font-semibold text-gray-600">{r.approvedBy?.name || 'Auto / System'}</td>
                      <td className="px-3 py-3 text-[11px] text-gray-500">{formatDateTime(r.createdAt)}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => { setSelectedItem(r); setIsLedgerItem(true); }}
                          className="px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-lg transition-colors text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 border-b border-gray-150 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Booking ID</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Order / Payment ID</th>
                  <th className="px-4 py-3">Cancellation Reason</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="p-8 text-center text-gray-400">Loading Dispute & Cancellation Cases...</td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="p-12 text-center text-gray-400">
                      <Inbox size={32} className="mx-auto mb-2 text-gray-300" />
                      <p className="font-bold text-gray-600">No active cancellation or dispute cases found</p>
                    </td>
                  </tr>
                ) : (
                  bookings.map(b => (
                    <tr key={b._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 font-bold text-secondary">#{b.bookingId || b._id?.slice(-8)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{b.customer?.name || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-700">{b.provider?.name || 'Unassigned'}</td>
                      <td className="px-4 py-3 font-bold uppercase text-gray-600">{b.paymentMethod}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-600">
                        {b.razorpayPaymentId || b.razorpayOrderId || '—'}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-gray-600 font-medium" title={b.cancellationProgress?.reason || b.adminRemark}>
                        {b.cancellationProgress?.reason || b.adminRemark || 'Customer Dispute'}
                      </td>
                      <td className="px-4 py-3 font-extrabold text-secondary text-sm">₹{b.totalAmount}</td>
                      <td className="px-4 py-3"><RefundStatusBadge status={b.paymentStatus} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setSelectedItem(b); setIsLedgerItem(false); }}
                          className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-lg transition-colors text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} /> Inspect / Action
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-semibold">Total Records: {pagination.total}</span>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            onPageChange={p => setPagination(prev => ({ ...prev, page: p }))}
          />
        </div>
      </div>

      {/* Create Manual Refund Modal */}
      {showCreateModal && (
        <CreateManualRefundModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchLedgerData}
        />
      )}

      {/* Detailed Inspection & Action Drawer/Modal */}
      {selectedItem && (
        <DetailedInspectionModal
          data={selectedItem}
          isLedgerItem={isLedgerItem}
          onClose={() => {
            setSelectedItem(null);
            const params = new URLSearchParams(window.location.search);
            if (params.has('openDetail')) {
              params.delete('openDetail');
              const qs = params.toString();
              navigate(qs ? `?${qs}` : window.location.pathname, { replace: true });
            }
          }}
          onActionSuccess={fetchLedgerData}
          onRetry={handleRetryRefund}
        />
      )}
    </div>
  );
};

export default RefundPage;
