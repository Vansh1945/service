// src/features/admin/complaints/Refund.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/auth';
import * as AdminService from '../../../services/AdminService';
import * as BookingService from '../../../services/BookingService';
import {
  RefreshCw, Eye, CheckCircle, AlertCircle,
  User, Briefcase, Clock, X, Filter, Calendar, Inbox,
  DollarSign, XCircle, Lock, Unlock, ChevronRight, ChevronLeft,
  RotateCw, ArrowRight, ShieldCheck, Wallet, CreditCard, FileText
} from 'lucide-react';
import Pagination from '../../../components/Pagination';
import StatsCard from '../../../components/ui/StatsCard';
import { formatDate, formatDateTime } from '../../../utils/format';
import PriceDisplay from '../../../components/PriceDisplay';

const refundOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed Payout' },
  { value: 'rejected', label: 'Rejected Claim' }
];

const destinationOptions = [
  { value: 'all', label: 'All Destinations' },
  { value: 'wallet', label: 'Customer Wallet' },
  { value: 'original_payment', label: 'Original Gateway' },
  { value: 'hybrid', label: 'Hybrid Split' }
];

// ── Status Badges ────────────────────────
const RefundStatusBadge = ({ status }) => {
  const cfg = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    refund_pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-blue-50 text-blue-800 border-blue-200',
    processing: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    refunded: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    failed: 'bg-red-50 text-red-800 border-red-200',
    rejected: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${cfg[status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

// ── Comprehensive Inspection & Judgment Modal ──────────────────
const DetailedInspectionModal = ({ data, isLedgerItem, onClose, onActionSuccess, onRetry }) => {
  const { showToast } = useAuth();
  const [decisionType, setDecisionType] = useState('refund_full');
  const [refundAmount, setRefundAmount] = useState(data?.refundAmount || data?.totalAmount || 0);
  const [absorption, setAbsorption] = useState('shared');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!data) return null;

  const booking = isLedgerItem ? (data.bookingId || {}) : data;
  const customer = isLedgerItem ? (data.customerId || booking.customer || {}) : (booking.customer || {});
  const provider = isLedgerItem ? (data.providerId || booking.provider || {}) : (booking.provider || {});
  const totalAmount = booking.totalAmount || data.requestedAmount || data.refundAmount || 0;
  const cancellationReason = data.cancellationReason || data.refundReason || booking.cancellationProgress?.reason || booking.adminRemark || 'Booking Cancellation / Support Dispute';
  const isAlreadyRefunded = data.refundStatus === 'completed' || booking.paymentStatus === 'refunded' || booking.adminRefundDecision === 'approved';

  const handleProcessRefundAction = async () => {
    if (!decisionType) return;
    setSubmitting(true);
    try {
      if (decisionType === 'reject') {
        const res = await AdminService.rejectRefund(booking._id, { reason: resolutionNotes });
        if (res.data?.success) {
          showToast('Refund claim rejected', 'success');
          onActionSuccess();
          onClose();
        }
      } else {
        const payload = {
          amount: decisionType === 'refund_partial' ? refundAmount : totalAmount,
          reason: resolutionNotes || 'Admin approved refund',
          type: decisionType === 'refund_partial' ? 'partial' : 'full',
          absorption,
        };
        const res = await AdminService.processRefund(booking._id, payload);
        if (res.data?.success) {
          showToast(res.data.message || 'Refund successfully processed', 'success');
          onActionSuccess();
          onClose();
        }
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Error processing refund action', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-secondary/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-secondary">
                {isLedgerItem ? `Refund Ledger Record #${data.refundId}` : `Booking Dispute #${booking.bookingId || booking._id}`}
              </h3>
              <p className="text-xs text-gray-500">Booking Reference: #{booking.bookingId || booking._id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Total Paid / Refundable</span>
              <span className="text-base font-extrabold text-purple-900">₹{totalAmount}</span>
            </div>
            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Refund Destination</span>
              <span className="text-xs font-bold text-blue-900 capitalize flex items-center gap-1 mt-0.5">
                {(data.refundDestination === 'wallet' || booking.paymentMethod === 'wallet') ? <Wallet size={12} /> : <CreditCard size={12} />}
                {data.refundDestination ? data.refundDestination.replace('_', ' ') : (booking.paymentMethod === 'wallet' ? 'Wallet' : 'Original Gateway')}
              </span>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Payment Method</span>
              <span className="text-xs font-bold text-gray-800 uppercase">{booking.paymentMethod || 'Online'}</span>
            </div>
            <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Refund Status</span>
              <div className="mt-0.5"><RefundStatusBadge status={data.refundStatus || booking.paymentStatus} /></div>
            </div>
          </div>

          {/* Mixed Payment & Split Refund Breakdown */}
          {(data.walletRefundAmount > 0 || data.gatewayRefundAmount > 0 || booking.walletUsed > 0) && (
            <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-150 space-y-2">
              <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet size={14} className="text-purple-600" /> Mixed Payment & Proportional Refund Breakdown
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Wallet Paid</span>
                  <span className="font-extrabold text-purple-800">₹{booking.walletUsed || data.walletRefundAmount || 0}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Gateway Paid</span>
                  <span className="font-extrabold text-blue-800">₹{booking.onlinePaid || data.gatewayRefundAmount || 0}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Wallet Refunded</span>
                  <span className="font-extrabold text-purple-900">₹{data.walletRefundAmount || (data.refundDestination === 'wallet' ? data.refundAmount : 0)}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-purple-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Gateway Refunded</span>
                  <span className="font-extrabold text-blue-900">₹{data.gatewayRefundAmount || (data.refundDestination === 'original_payment' ? data.refundAmount : 0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Refund & Cancellation Reason Banner */}
          <div className="bg-amber-50/80 rounded-xl p-4 border border-amber-200/80 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
              <FileText size={14} /> Refund / Cancellation Reason
            </span>
            <p className="text-xs font-semibold text-amber-950 leading-relaxed">{cancellationReason}</p>
          </div>

          {/* Transaction & Gateway Tracking Details */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Gateway & Transaction Identifiers</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-gray-400 font-semibold block text-[10px] uppercase">Razorpay / Gateway Payment ID</span>
                <span className="font-mono font-bold text-gray-800">{data.gatewayPaymentId || booking.razorpayPaymentId || booking.paymentDetails?.razorpay_payment_id || 'pay_N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-[10px] uppercase">Razorpay Order ID</span>
                <span className="font-mono font-bold text-purple-700">{data.gatewayOrderId || booking.razorpayOrderId || 'order_N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-[10px] uppercase">Gateway Refund ID (Razorpay)</span>
                <span className="font-mono font-bold text-emerald-700">{data.gatewayRefundId || 'rfnd_pending'}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-[10px] uppercase">Wallet Transaction Reference</span>
                <span className="font-mono font-bold text-indigo-700">{data.walletTransactionId || 'WTX_N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold block text-[10px] uppercase">Transaction Hash / Lock</span>
                <span className="font-mono text-gray-600 text-[11px]">{data.transactionId || booking._id}</span>
              </div>
            </div>
          </div>

          {/* Customer & Provider Parties */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Customer Information</span>
              <p className="font-bold text-secondary text-sm">{customer.name || 'N/A'}</p>
              <p className="text-gray-500">{customer.email || 'No email'}</p>
              <p className="text-gray-500">{customer.phone || 'No phone'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Assigned Provider Information</span>
              <p className="font-bold text-secondary text-sm">{provider.name || 'Unassigned Provider'}</p>
              <p className="text-gray-500">{provider.email || '—'}</p>
              <p className="text-gray-500">{provider.phone || '—'}</p>
            </div>
          </div>

          {/* Action Judgment Form (Only if not fully refunded) */}
          {!isAlreadyRefunded && (
            <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-200 space-y-4">
              <h4 className="text-xs font-bold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-purple-600" /> Admin Refund Judgment Panel
              </h4>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'refund_full', label: 'Full Refund (100%)' },
                  { id: 'refund_partial', label: 'Partial Refund' },
                  { id: 'reject', label: 'Reject Claim' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDecisionType(opt.id);
                      if (opt.id === 'refund_full') setRefundAmount(totalAmount);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      decisionType === opt.id ? 'bg-purple-600 text-white border-purple-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-purple-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {decisionType === 'refund_partial' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 uppercase flex justify-between">
                    <span>Partial Refund Amount (₹)</span>
                    <span>Max: ₹{totalAmount}</span>
                  </label>
                  <input
                    type="number"
                    value={refundAmount}
                    max={totalAmount}
                    onChange={e => setRefundAmount(Math.min(totalAmount, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-400"
                  />
                </div>
              )}

              {decisionType !== 'reject' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase block">Refund Loss Absorption Split</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'shared', label: 'Shared Ratio Split' },
                      { id: 'platform', label: '100% Platform Loss' },
                      { id: 'provider', label: '100% Provider Loss' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAbsorption(opt.id)}
                        className={`p-2 rounded-lg text-left text-xs font-bold border transition-all cursor-pointer ${
                          absorption === opt.id ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500' : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase block">Admin Resolution Notes / Comment</label>
                <textarea
                  rows={2}
                  value={resolutionNotes}
                  onChange={e => setResolutionNotes(e.target.value)}
                  placeholder="Enter detailed reason for refund approval or rejection..."
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleProcessRefundAction}
                  className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-extrabold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? <RotateCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Confirm & Execute Refund Action
                </button>
              </div>
            </div>
          )}

          {/* Timeline */}
          {data.timeline && data.timeline.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-primary" /> Lifecycle Progress Timeline
              </h4>
              <div className="relative pl-4 border-l-2 border-purple-200 space-y-3">
                {data.timeline.map((step, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-purple-600 ring-4 ring-purple-100" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-secondary uppercase">{step.status?.replace('_', ' ')}</span>
                        <span className="text-[10px] text-gray-400">by {step.actor} • {formatDateTime(step.timestamp)}</span>
                      </div>
                      {step.notes && <p className="text-xs text-gray-600 mt-0.5">{step.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-150 flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl font-semibold text-xs hover:bg-gray-100 cursor-pointer">
            Close
          </button>
          {isLedgerItem && data.refundStatus === 'failed' && (
            <button onClick={() => onRetry(data._id)} className="px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-xs hover:bg-purple-700 flex items-center gap-1.5 shadow-xs cursor-pointer">
              <RotateCw size={14} /> Retry Refund Payout
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Refund Management Component ─────
const RefundPage = () => {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' or 'disputes'
  const [refunds, setRefunds] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isLedgerItem, setIsLedgerItem] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDestination, setFilterDestination] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'ledger') {
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          status: filterStatus === 'all' ? undefined : filterStatus,
          destination: filterDestination === 'all' ? undefined : filterDestination,
        };
        const res = await AdminService.getRefundLedger(params);
        if (res.data?.success) {
          setRefunds(res.data.data || []);
          setPagination(p => ({
            ...p,
            total: res.data.pagination?.total || 0,
            pages: res.data.pagination?.pages || 1,
          }));
        }
      } else {
        const params = {
          page: pagination.page,
          limit: pagination.limit,
          search: searchTerm,
          forRefunds: true,
          refundStatus: filterStatus,
        };
        const res = await BookingService.getAllBookings(params);
        if (res.data?.success) {
          setBookings(res.data.data || []);
          setPagination(p => ({
            ...p,
            total: res.data.total || 0,
            pages: res.data.pages || 1,
          }));
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load refund data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryRefund = async (refundId) => {
    try {
      const res = await AdminService.retryRefundLedger(refundId);
      if (res.data?.success) {
        showToast(res.data.message || 'Refund retry successful', 'success');
        setSelectedItem(null);
        fetchLedgerData();
      }
    } catch (err) {
      console.error(err);
      showToast(err.response?.data?.message || 'Failed to retry refund', 'error');
    }
  };

  useEffect(() => {
    fetchLedgerData();
  }, [activeTab, pagination.page, searchTerm, filterStatus, filterDestination]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-inter">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header & Tab Selector */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-secondary font-poppins">Refund Management Engine</h1>
            <p className="text-sm text-gray-500 mt-1">Enterprise Centralized Refund Ledger & Dispute Audit System</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-gray-200 p-1 rounded-xl flex items-center text-xs font-bold">
              <button
                onClick={() => { setActiveTab('ledger'); setPagination(p => ({ ...p, page: 1 })); }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'ledger' ? 'bg-white text-purple-900 shadow-xs' : 'text-gray-600 hover:text-secondary'}`}
              >
                Centralized Refund Ledger
              </button>
              <button
                onClick={() => { setActiveTab('disputes'); setPagination(p => ({ ...p, page: 1 })); }}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'disputes' ? 'bg-white text-purple-900 shadow-xs' : 'text-gray-600 hover:text-secondary'}`}
              >
                Booking Financial Cases
              </button>
            </div>

            <button
              onClick={fetchLedgerData}
              className="flex items-center gap-2 px-4 py-2 bg-white text-secondary hover:text-primary border border-gray-300 rounded-xl shadow-xs font-semibold text-xs shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Console Filter Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-150 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="w-full md:w-1/3">
            <input
              type="text"
              placeholder="Search by Booking ID, Customer, Transaction ID, Gateway Refund ID..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer"
            >
              {refundOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {activeTab === 'ledger' && (
              <select
                value={filterDestination}
                onChange={e => { setFilterDestination(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none cursor-pointer"
              >
                {destinationOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Data Table View */}
        <div className="bg-white rounded-2xl shadow-xs border border-gray-150 overflow-hidden">
          <div className="overflow-x-auto">
            {activeTab === 'ledger' ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/80 border-b border-gray-150 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Refund ID</th>
                    <th className="px-4 py-3">Booking Ref</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Destination</th>
                    <th className="px-4 py-3">Gateway / Wallet ID</th>
                    <th className="px-4 py-3">Refund Reason</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="p-8 text-center text-gray-400">Loading Enterprise Refund Ledger...</td>
                    </tr>
                  ) : refunds.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-12 text-center text-gray-400">
                        <Inbox size={32} className="mx-auto mb-2 text-gray-300" />
                        <p className="font-bold text-gray-600">No refund ledger records found</p>
                      </td>
                    </tr>
                  ) : (
                    refunds.map(r => (
                      <tr key={r._id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-purple-900">{r.refundId}</td>
                        <td className="px-4 py-3 font-semibold text-secondary">#{r.bookingId?.bookingId || r.bookingId?._id?.slice(-8) || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-gray-800">{r.customerId?.name || '—'}</p>
                          <p className="text-[10px] text-gray-400">{r.customerId?.email}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-700">{r.providerId?.name || 'Unassigned'}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold capitalize inline-flex items-center gap-1 text-gray-700">
                            {r.refundDestination === 'wallet' ? <Wallet size={12} className="text-purple-600" /> : <CreditCard size={12} className="text-blue-600" />}
                            {r.refundDestination?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-gray-600">
                          {r.gatewayRefundId || r.walletTransactionId || '—'}
                        </td>
                        <td className="px-4 py-3 max-w-[180px] truncate text-gray-600 font-medium" title={r.refundReason || r.cancellationReason}>
                          {r.refundReason || r.cancellationReason || '—'}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-purple-900 text-sm">₹{r.refundAmount}</td>
                        <td className="px-4 py-3"><RefundStatusBadge status={r.refundStatus} /></td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { setSelectedItem(r); setIsLedgerItem(true); }}
                            className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold rounded-lg transition-colors text-xs inline-flex items-center gap-1 cursor-pointer"
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
                    <th className="px-4 py-3">Transaction / Order ID</th>
                    <th className="px-4 py-3">Cancellation / Dispute Reason</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Payment Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-gray-400">Loading Booking Financial Cases...</td>
                    </tr>
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-12 text-center text-gray-400">
                        <Inbox size={32} className="mx-auto mb-2 text-gray-300" />
                        <p className="font-bold text-gray-600">No booking financial cases found</p>
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
                          {b.cancellationProgress?.reason || b.adminRemark || 'Customer Cancellation / Support Case'}
                        </td>
                        <td className="px-4 py-3 font-extrabold text-secondary text-sm">₹{b.totalAmount}</td>
                        <td className="px-4 py-3"><RefundStatusBadge status={b.paymentStatus} /></td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => { setSelectedItem(b); setIsLedgerItem(false); }}
                            className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold rounded-lg transition-colors text-xs inline-flex items-center gap-1 cursor-pointer"
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

          {/* Pagination */}
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-semibold">Total Records: {pagination.total}</span>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={p => setPagination(prev => ({ ...prev, page: p }))}
            />
          </div>
        </div>

        {/* Inspection & Action Modal */}
        {selectedItem && (
          <DetailedInspectionModal
            data={selectedItem}
            isLedgerItem={isLedgerItem}
            onClose={() => setSelectedItem(null)}
            onActionSuccess={fetchLedgerData}
            onRetry={handleRetryRefund}
          />
        )}
      </div>
    </div>
  );
};

export default RefundPage;
