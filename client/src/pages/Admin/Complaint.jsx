// src/pages/admin/ComplaintsPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { useSearchParams } from 'react-router-dom';
import * as ComplaintService from '../../services/ComplaintService';
import * as AdminService from '../../services/AdminService';
import {
  FiSearch, FiRefreshCw, FiEye, FiCheckCircle, FiAlertTriangle,
  FiUsers, FiUser, FiTool, FiClock, FiBarChart2, FiX,
  FiChevronLeft, FiChevronRight, FiMail, FiPhone, FiMessageSquare,
  FiFilter, FiCalendar, FiInbox
} from 'react-icons/fi';
import Pagination from '../../components/Pagination';
import { formatDate, formatDateTime } from '../../utils/format';
import CDNImage from '../../components/CDNImage';
import { useAdminFilter } from '../../context/AdminFilterContext';
import AdminFilterBar from '../../components/AdminFilterBar';

// ── Helpers ───────────────────────────────────────────────────

// ── Status Badge ──────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = {
    Open: 'bg-amber-100 text-amber-700 border-amber-200',
    'In-Progress': 'bg-blue-100 text-blue-700 border-blue-200',
    Solved: 'bg-green-100 text-green-700 border-green-200',
    Reopened: 'bg-orange-100 text-orange-700 border-orange-200',
    Closed: 'bg-gray-100 text-gray-500 border-gray-200',
    submitted: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    under_review: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    provider_responded: 'bg-purple-100 text-purple-700 border-purple-200',
    admin_review: 'bg-red-100 text-red-700 border-red-200',
    resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-100 text-rose-700 border-rose-200',
    refunded: 'bg-teal-100 text-teal-700 border-teal-200',
  };
  const label = {
    'In-Progress': 'In Progress',
    under_review: 'Under Review',
    provider_responded: 'Provider Responded',
    admin_review: 'Admin Review',
    resolved: 'Resolved',
    rejected: 'Rejected',
    refunded: 'Refunded',
    submitted: 'Submitted',
  }[status] || status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg[status] || cfg.Closed}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70" />
      {label}
    </span>
  );
};

// ── UserType Badge ─────────────────────────────────────────────
const TypeBadge = ({ type }) => {
  const t = type || 'unknown';
  const isCustomer = t.toLowerCase() === 'customer';
  const isProvider = t.toLowerCase() === 'provider';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide
      ${isCustomer ? 'bg-blue-100 text-blue-600' : isProvider ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}`}>
      {isCustomer ? <FiUser size={10} /> : isProvider ? <FiTool size={10} /> : null}
      {t}
    </span>
  );
};

// ── Skeleton Row ──────────────────────────────────────────────
const SkeletonRow = () => (
  <tr className="animate-pulse border-b border-gray-50">
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-5 py-4">
        <div className={`h-3.5 bg-gray-200 rounded-full ${i === 1 ? 'w-36' : i === 6 ? 'w-16' : 'w-20'}`} />
        {i === 1 && <div className="h-2.5 bg-gray-100 rounded-full w-24 mt-2" />}
      </td>
    ))}
  </tr>
);



// ── Stat Card ─────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, gradient, iconBg, delay = 0 }) => (
  <div
    className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 hover:scale-105 hover:shadow-lg transition-all duration-300 cursor-default animate-fade-in border border-gray-100"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className={`${iconBg} w-12 h-12 rounded-xl flex items-center justify-center shrink-0`}>
      <Icon className={gradient} size={22} />
    </div>
    <div>
      <p className="text-3xl font-bold text-secondary font-poppins">{value ?? '—'}</p>
      <p className="text-xs text-gray-400 font-medium mt-0.5">{label}</p>
    </div>
  </div>
);

// ── Complaint Details Modal ────────────────────────────────────
// ── Complaint Details Modal ────────────────────────────────────
const ComplaintDetailsModal = ({ data, onClose, onUpdateStatus, onResolve }) => {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const { complaint, booking } = data || {};
  const [statusUpdate, setStatusUpdate] = useState(complaint?.status || '');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState(booking?.totalAmount || complaint?.booking?.totalAmount || 0);
  const [confirmAction, setConfirmAction] = useState(null); // 'approve_refund', 'reject_refund', 'manual_review'
  const [submitting, setSubmitting] = useState(false);

  const previouslyRefunded = complaint?.booking?.cancellationProgress?.refundAmount || 0;
  const isFullyRefunded = complaint?.booking?.paymentStatus === 'refunded' || complaint?.booking?.adminRefundDecision === 'approved' || (complaint?.booking?.totalAmount && previouslyRefunded >= complaint.booking.totalAmount);


  const handleStatusUpdate = async () => {
    if (!statusUpdate) { showToast('Please select a status', 'error'); return; }
    if (submitting) return;
    setSubmitting(true);
    try { 
      await onUpdateStatus(complaint._id, statusUpdate); 
      showToast('Status updated', 'success'); 
    }
    catch { showToast('Failed to update status', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleResolve = async () => {
    if (!confirmAction) return;
    if (!resolutionNotes.trim()) { showToast('Resolution notes required', 'error'); return; }
    if (submitting) return;
    setSubmitting(true);
    try { 
      await onResolve(complaint._id, resolutionNotes, confirmAction); 
      setResolutionNotes(''); 
      setConfirmAction(null);
      showToast('Complaint resolved!', 'success'); 
    }
    catch { showToast('Failed to resolve', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleProcessRefund = async (type) => {
    if (!complaint.booking) return;
    const bookingId = complaint.booking._id || complaint.booking;
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await AdminService.processRefund(bookingId, { 
        type, 
        amount: type === 'partial' ? refundAmount : undefined,
        reason: resolutionNotes 
      });
      if (res.data.success) {
        showToast(`Refund of ${type} processed`, 'success');
        onClose();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Refund failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectDispute = async () => {
    if (!complaint.booking) return;
    const bookingId = complaint.booking._id || complaint.booking;
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await AdminService.rejectRefund(bookingId, { reason: resolutionNotes });
      if (res.data.success) {
        showToast('Dispute rejected', 'success');
        onClose();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Rejection failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };


  if (!data || !complaint) return null;

  const actualUserType = complaint.userType || (complaint.userId || complaint.customer ? 'customer' : 'provider');
  const submitterInfo = actualUserType === 'customer'
    ? (complaint.userId || complaint.customer)
    : (complaint.providerId || complaint.provider);

  // Payout Badge Config
  const payoutBadgeStyles = {
    'Held': 'bg-orange-100 text-orange-700 border-orange-200',
    'Available': 'bg-green-100 text-green-700 border-green-200',
    'Dispute Hold': 'bg-red-100 text-red-700 border-red-200',
    'Released': 'bg-blue-100 text-blue-700 border-blue-200',
    'held': 'bg-orange-100 text-orange-700 border-orange-200',
    'available': 'bg-green-100 text-green-700 border-green-200',
    'cancelled': 'bg-red-100 text-red-700 border-red-200',
    'paid': 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <FiMessageSquare className="text-primary" size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-secondary font-poppins">Complaint Details</h3>
              <p className="text-xs text-gray-400">#{complaint.complaintId || complaint._id?.slice(-8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={complaint.status} />
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
              <FiX className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100 px-6">
          <nav className="flex gap-1">
            {['details', 'timeline', 'actions'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 text-sm font-medium capitalize transition-all border-b-2 -mb-px ${activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-400 hover:text-secondary'
                  }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6 space-y-5">

          {/* ── Details Tab ── */}
          {activeTab === 'details' && (
            <div className="space-y-4 animate-fade-in">
              {/* Warnings */}
              {complaint.warnings?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                  {complaint.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-red-700 text-sm font-bold">
                      <FiAlertTriangle size={16} /> ⚠ {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Payout Status Badge & Booking Summary */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FiTool className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Booking Status</p>
                    <p className="text-sm font-bold text-secondary uppercase">{booking?.status || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${booking?.payoutStatus?.toLowerCase() === 'held' ? 'bg-orange-100' : 'bg-green-100'}`}>
                    <FiBarChart2 className={booking?.payoutStatus?.toLowerCase() === 'held' ? 'text-orange-600' : 'text-green-600'} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Payout Status</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${payoutBadgeStyles[booking?.payoutStatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {booking?.payoutStatus || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <FiAlertTriangle className="text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase">Dispute Status</p>
                    <p className="text-sm font-bold text-secondary uppercase">{booking?.disputeStatus || 'None'}</p>
                  </div>
                </div>
              </div>

              {/* Smart Review Panel (Existing AI Logic) */}
              {complaint.suggestedDecision && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 shadow-sm">
                  <h4 className="text-sm font-black text-blue-900 mb-4 flex items-center gap-2">
                    <FiBarChart2 className="text-blue-600" /> Refund Decision Analysis
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-50">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Complaint Score</p>
                      <p className={`text-xl font-black ${complaint.complaintScore > 60 ? 'text-red-600' : 'text-secondary'}`}>{complaint.complaintScore}/100</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-50">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Provider Trust</p>
                      <p className={`text-xl font-black ${complaint.providerTrustScore < 40 ? 'text-red-600' : 'text-green-600'}`}>{complaint.providerTrustScore}/100</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-50">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Customer Risk</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className={`text-xl font-black ${complaint.customerFraudScore > 60 ? 'text-red-600' : 'text-green-600'}`}>{complaint.customerFraudScore}/100</p>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          complaint.riskScore === 'high' ? 'bg-red-100 text-red-700' :
                          complaint.riskScore === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {complaint.riskScore || 'low'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-50">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Evidence Strength</p>
                      <p className={`text-xl font-black ${complaint.evidenceStrength > 50 ? 'text-green-600' : 'text-amber-600'}`}>{complaint.evidenceStrength}/100</p>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase">Suggested Action:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                      complaint.suggestedDecision === 'approve_refund' ? 'bg-green-100 text-green-700' :
                      complaint.suggestedDecision === 'reject_refund' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {complaint.suggestedDecision.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Top info grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Complaint Info */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2.5">
                  <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                    <FiAlertTriangle className="text-accent" size={14} /> Complaint Info
                  </h4>
                  {[
                    ['Title', complaint.title],
                    ['Category', complaint.category],
                    ['Created', formatDateTime(complaint.createdAt)],
                    ['Complaint Type', <span className="font-bold text-red-600 uppercase">{complaint.complaintType || 'N/A'}</span>],
                    ['Dispute Status', <span className="font-bold text-accent uppercase">{complaint.booking?.disputeStatus || 'None'}</span>],
                    ['Payout Status', <span className={`font-bold uppercase ${complaint.providerPayoutStatus === 'held' ? 'text-orange-500' : 'text-green-500'}`}>{complaint.providerPayoutStatus || 'N/A'}</span>],
                    ...(complaint.resolvedAt ? [['Resolved', formatDateTime(complaint.resolvedAt)]] : []),
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between text-sm">
                      <span className="text-gray-400">{lbl}</span>
                      <span className="font-medium text-secondary text-right max-w-[55%] truncate">{val || 'N/A'}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Status</span>
                    <StatusBadge status={complaint.status} />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">User Type</span>
                    <TypeBadge type={actualUserType} />
                  </div>
                </div>

                {/* Submitter */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                  <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                    <FiUser className="text-primary" size={14} /> Submitted By
                  </h4>
                  {submitterInfo ? (
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${actualUserType === 'customer' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                        <FiUser className="text-white" size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-secondary">{submitterInfo.name || 'N/A'}</p>
                        {submitterInfo.email && (
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                            <FiMail size={10} /> {submitterInfo.email}
                          </p>
                        )}
                        {submitterInfo.phone && (
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <FiPhone size={10} /> {submitterInfo.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : <p className="text-sm text-gray-400">N/A</p>}

                  {/* Affected provider (service issue) */}
                  {complaint.provider && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-400 mb-2">Affected Provider</p>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
                          <FiTool className="text-white" size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-secondary">{complaint.provider?.name || 'N/A'}</p>
                          {complaint.provider?.email && (
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <FiMail size={10} /> {complaint.provider.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Booking ID */}
                  {complaint.booking && (
                    <div className="text-sm pt-2 border-t border-gray-200">
                      <span className="text-gray-400">Booking: </span>
                      <span className="font-medium text-secondary">
                        #{complaint.booking?.bookingId || complaint.booking?._id?.slice(-8) || complaint.booking}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* History Cards Grid */}
              {(complaint.providerHistory || complaint.customerHistory) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Provider History */}
                  {complaint.providerHistory && (
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <h4 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
                        <FiTool className="text-purple-500" /> Provider History
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Completed</p>
                          <p className="font-bold text-secondary">{complaint.providerHistory.completedBookings}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Avg Rating</p>
                          <p className="font-bold text-secondary">{complaint.providerHistory.avgRating} ★</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Complaint Ratio</p>
                          <p className={`font-bold ${complaint.providerHistory.complaintRatio > 10 ? 'text-red-500' : 'text-secondary'}`}>{complaint.providerHistory.complaintRatio}%</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Cancel Ratio</p>
                          <p className={`font-bold ${complaint.providerHistory.cancellationRatio > 20 ? 'text-red-500' : 'text-secondary'}`}>{complaint.providerHistory.cancellationRatio}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Customer History */}
                  {complaint.customerHistory && (
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <h4 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
                        <FiUser className="text-blue-500" /> Customer Risk Profile
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Total Bookings</p>
                          <p className="font-bold text-secondary">{complaint.customerHistory.totalBookings}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Refund Requests</p>
                          <p className={`font-bold ${complaint.customerHistory.refundRequests > 2 ? 'text-red-500' : 'text-secondary'}`}>{complaint.customerHistory.refundRequests}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Complaints</p>
                          <p className={`font-bold ${complaint.customerHistory.complaintCount > 2 ? 'text-red-500' : 'text-secondary'}`}>{complaint.customerHistory.complaintCount}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Account Age</p>
                          <p className={`font-bold ${complaint.customerHistory.accountAgeMonths < 3 ? 'text-amber-500' : 'text-secondary'}`}>{complaint.customerHistory.accountAgeMonths} months</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h4 className="text-sm font-bold text-secondary mb-2">Description</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{complaint.description}</p>
              </div>

              {/* Resolution Notes (if solved) */}
              {complaint.resolutionNotes && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-green-700 mb-1 flex items-center gap-1">
                    <FiCheckCircle size={14} /> Admin Resolution
                  </h4>
                  <p className="text-sm text-green-700">{complaint.resolutionNotes}</p>
                </div>
              )}

              {/* Image Comparison Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                  <FiEye className="text-primary" /> Image Comparison
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Customer Complaint Images */}
                  <div className="bg-red-50/30 rounded-xl p-4 border border-red-100 min-h-[160px]">
                    <p className="text-[10px] font-black text-red-600 uppercase mb-3 tracking-wider">Customer Proofs</p>
                    <div className="grid grid-cols-2 gap-2">
                      {booking?.complaintProofs?.length > 0 ? (
                        booking.complaintProofs.filter(p => p.uploadedBy === 'customer').flatMap(p => p.images || []).map((img, i) => (
                          <CDNImage 
                            key={i} src={img.url || img.secure_url} 
                            width={200}
                            className="w-full h-20 object-cover rounded-lg border border-red-200 cursor-zoom-in hover:scale-105 transition-all" 
                            alt="Customer Proof" 
                            onClick={() => window.open(img.url || img.secure_url, '_blank')} 
                          />
                        ))
                      ) : complaint.images?.length > 0 ? (
                        complaint.images.map((img, i) => (
                          <CDNImage 
                            key={i} src={img.secure_url || img.url} 
                            width={200}
                            className="w-full h-20 object-cover rounded-lg border border-red-200 cursor-zoom-in hover:scale-105 transition-all" 
                            alt="Customer Proof" 
                            onClick={() => window.open(img.secure_url || img.url, '_blank')} 
                          />
                        ))
                      ) : (
                        <div className="col-span-2 h-20 flex items-center justify-center bg-gray-100 rounded-lg border border-dashed border-gray-300">
                          <span className="text-[10px] text-gray-400 font-bold">No images</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Provider Before Work */}
                  <div className="bg-amber-50/30 rounded-xl p-4 border border-amber-100 min-h-[160px]">
                    <p className="text-[10px] font-black text-amber-600 uppercase mb-3 tracking-wider">Before Work (Provider)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {booking?.workProof?.beforeImages?.length > 0 ? (
                        booking.workProof.beforeImages.map((img, i) => (
                          <CDNImage 
                            key={i} src={img.url} 
                            width={200}
                            className="w-full h-20 object-cover rounded-lg border border-amber-200 cursor-zoom-in hover:scale-105 transition-all" 
                            alt="Before Work" 
                            onClick={() => window.open(img.url, '_blank')} 
                          />
                        ))
                      ) : (
                        <div className="col-span-2 h-20 flex items-center justify-center bg-gray-100 rounded-lg border border-dashed border-gray-300">
                          <span className="text-[10px] text-gray-400 font-bold">No images</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Provider After Work */}
                  <div className="bg-green-50/30 rounded-xl p-4 border border-green-100 min-h-[160px]">
                    <p className="text-[10px] font-black text-green-600 uppercase mb-3 tracking-wider">After Work (Provider)</p>
                    <div className="grid grid-cols-2 gap-2">
                      {booking?.workProof?.afterImages?.length > 0 ? (
                        booking.workProof.afterImages.map((img, i) => (
                          <CDNImage 
                            key={i} src={img.url} 
                            width={200}
                            className="w-full h-20 object-cover rounded-lg border border-green-200 cursor-zoom-in hover:scale-105 transition-all" 
                            alt="After Work" 
                            onClick={() => window.open(img.url, '_blank')} 
                          />
                        ))
                      ) : (
                        <div className="col-span-2 h-20 flex items-center justify-center bg-gray-100 rounded-lg border border-dashed border-gray-300">
                          <span className="text-[10px] text-gray-400 font-bold">No images</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Provider/Admin Reply Card */}
              <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-white px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                    <FiMessageSquare className="text-primary" /> Latest Response
                  </h4>
                  {booking?.complaintProofs?.length > 0 && (
                    <span className="text-[10px] text-gray-400 font-medium">
                      Last updated: {formatDateTime(booking.complaintProofs[booking.complaintProofs.length - 1].createdAt)}
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-4">
                  {booking?.complaintProofs?.filter(p => p.uploadedBy !== 'customer').length > 0 ? (
                    booking.complaintProofs.filter(p => p.uploadedBy !== 'customer').slice(-2).map((reply, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border ${reply.uploadedBy === 'admin' ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${reply.uploadedBy === 'admin' ? 'bg-blue-200 text-blue-700' : 'bg-purple-200 text-purple-700'}`}>
                            {reply.uploadedBy}
                          </span>
                          <span className="text-[9px] text-gray-400">{formatDateTime(reply.createdAt)}</span>
                        </div>
                        <p className="text-sm text-secondary leading-relaxed">{reply.message || 'No message provided'}</p>
                        {reply.images?.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            {reply.images.map((img, i) => (
                              <CDNImage key={i} src={img.url} width={100} className="w-10 h-10 object-cover rounded border border-white shadow-sm cursor-zoom-in hover:scale-105 transition-all" alt="Reply Proof" onClick={() => window.open(img.url, '_blank')} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-xs text-gray-400 italic">No responses from provider or admin yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Timeline Tab ── */}
          {activeTab === 'timeline' && (
            <div className="space-y-4 animate-fade-in">
              {/* Resolution Journey / Booking Timeline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Booking Timeline UI */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                    <FiClock className="text-blue-500" /> Booking Progress
                  </h4>
                  {booking?.timeline?.length > 0 ? (
                    <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                      {booking.timeline.map((step, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-6 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center
                            ${i === booking.timeline.length - 1 ? 'bg-primary animate-pulse' : 'bg-gray-300'}`}
                          >
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-secondary uppercase tracking-tight">{step.label}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{formatDateTime(step.date)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <FiClock className="text-gray-300 mb-2" size={24} />
                      <p className="text-xs text-gray-400 italic">No booking timeline available</p>
                    </div>
                  )}
                </div>

                {/* Complaint History (Resolution History) */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                    <FiMessageSquare className="text-amber-500" /> Resolution Steps
                  </h4>
                  {complaint.resolutionHistory?.length > 0 ? (
                    <div className="space-y-4">
                      {complaint.resolutionHistory.map((h, i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full mt-1 ring-4 ${
                              h.event.includes('Resolved') ? 'bg-green-500 ring-green-100' :
                              h.event.includes('Replied') ? 'bg-primary ring-primary/10' :
                              'bg-gray-300 ring-gray-100'
                            }`} />
                            {i < complaint.resolutionHistory.length - 1 && <div className="w-0.5 h-12 bg-gray-100 mt-1" />}
                          </div>
                          <div className="flex-1 bg-white rounded-xl p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-secondary uppercase tracking-tight">{h.event}</p>
                              <span className="text-[10px] text-gray-400">{formatDateTime(h.timestamp)}</span>
                            </div>
                            {h.note && <p className="text-sm text-gray-600 mt-1 leading-relaxed">"{h.note}"</p>}
                            {h.images?.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {h.images.map((img, j) => (
                                  <CDNImage key={j} src={img} width={100} className="w-10 h-10 object-cover rounded border shadow-sm cursor-zoom-in hover:scale-105 transition-all" alt="Proof" onClick={() => window.open(img, '_blank')} />
                                ))}
                              </div>
                            )}
                            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 uppercase font-bold">
                              <FiUser size={10} /> By: {h.by}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs text-center py-8 italic">No resolution history available</p>
                  )}
                </div>
              </div>

              {(complaint.reopenHistory || []).length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-bold text-secondary mb-3">Reopen History</h5>
                  <div className="space-y-3">
                    {complaint.reopenHistory.map((h, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 bg-accent rounded-full mt-1 ring-4 ring-accent/10" />
                          {i < complaint.reopenHistory.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-1" />}
                        </div>
                        <div className="flex-1 bg-orange-50 rounded-xl p-3 border border-orange-100">
                          <div className="flex justify-between mb-1">
                            <span className="text-sm font-medium text-orange-700">Reopened</span>
                            <span className="text-xs text-gray-400">{formatDateTime(h.reopenedAt)}</span>
                          </div>
                          <p className="text-xs text-gray-600">{h.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Actions Tab ── */}
          {activeTab === 'actions' && (
            <div className="space-y-4 animate-fade-in">
              {/* Update Status */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h4 className="text-sm font-bold text-secondary mb-3">Update Status</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={statusUpdate}
                    onChange={e => setStatusUpdate(e.target.value)}
                    className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-secondary"
                  >
                    <option value="">Select Status</option>
                    {['Open', 'In-Progress', 'Solved', 'Reopened', 'Closed'].map(s => (
                      <option key={s} value={s}>{s === 'In-Progress' ? 'In Progress' : s}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={!statusUpdate}
                    className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Update
                  </button>
                </div>
              </div>

              {/* Resolve */}
              {!['Solved', 'Closed'].includes(complaint.status) && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h4 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
                    <FiCheckCircle className="text-green-500" size={16} /> Resolve Complaint
                  </h4>
                  <textarea
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    placeholder="Write resolution notes for the user..."
                    rows="3"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 text-sm resize-none mb-3"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => setConfirmAction('approve_refund')}
                      disabled={!resolutionNotes.trim() || confirmAction}
                      className="px-4 py-2.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Approve Refund
                    </button>
                    <button
                      onClick={() => setConfirmAction('reject_refund')}
                      disabled={!resolutionNotes.trim() || confirmAction}
                      className="px-4 py-2.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Reject Complaint
                    </button>
                    <button
                      onClick={() => setConfirmAction('manual_review')}
                      disabled={!resolutionNotes.trim() || confirmAction}
                      className="px-4 py-2.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Hold for Investigation
                    </button>
                  </div>

                  {confirmAction && (
                    <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-xl animate-fade-in">
                      <p className="text-sm font-bold text-blue-900 mb-2">
                        Are you sure you want to {confirmAction.replace('_', ' ')}?
                      </p>
                      <p className="text-xs text-blue-700 mb-4">This action will update the complaint status and automatically adjust provider payouts.</p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleResolve}
                          className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmAction(null)}
                          className="px-4 py-2 bg-white text-gray-600 border border-gray-200 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dispute Actions */}
              {complaint.booking && (
                <div className="space-y-4">
                   <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                      <FiAlertTriangle size={16} /> Dispute Resolution Actions
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <button
                        onClick={() => handleProcessRefund('full')}
                        disabled={isFullyRefunded}
                        className="px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFullyRefunded ? 'Refund Complete' : 'Approve Full Refund'}
                      </button>
                      <button
                        onClick={handleRejectDispute}
                        disabled={isFullyRefunded}
                        className="px-4 py-2.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reject Dispute
                      </button>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-blue-200">
                      <p className="text-[11px] font-bold text-blue-600 uppercase">Partial Refund</p>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          value={refundAmount}
                          onChange={e => setRefundAmount(e.target.value)}
                          disabled={isFullyRefunded}
                          className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-400"
                          placeholder="Amount"
                        />
                        <button
                          onClick={() => handleProcessRefund('partial')}
                          disabled={isFullyRefunded}
                          className="px-4 py-2 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Process Partial
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────
const ComplaintsPage = () => {
  const { token, API, showToast } = useAuth();
  const { getComputedDateRange, getMergedQuery, resetGlobalFilters } = useAdminFilter();
  const [searchParams] = useSearchParams();
  const entityId = searchParams.get('entityId') || searchParams.get('complaintId');
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [filters, setFilters] = useState({
    status: '', category: '', search: '', startDate: '',
    endDate: '', userType: '', providerId: ''
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'Open', label: 'Open' },
    { value: 'In-Progress', label: 'In Progress' },
    { value: 'Solved', label: 'Solved' },
    { value: 'Reopened', label: 'Reopened' },
    { value: 'Closed', label: 'Closed' },
  ];

  const userTypeOptions = [
    { value: '', label: 'All Users' },
    { value: 'customer', label: 'Customer' },
    { value: 'provider', label: 'Provider' },
  ];

  // ── Data fetching ──
  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const params = getMergedQuery({
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      });

      const res = await ComplaintService.getAllComplaints(params);
      if (res.data?.success) {
        setComplaints(res.data.data || []);
        setPagination(p => ({ ...p, total: res.data.total || 0, pages: res.data.pages || 1 }));
      } else showToast('Failed to fetch complaints', 'error');
    } catch { showToast('Error fetching complaints', 'error'); }
    finally { setLoading(false); }
  };

  const fetchComplaintDetails = async (id) => {
    try {
      const res = await ComplaintService.getComplaintDetails(id);
      if (res.data?.success) { setSelectedComplaint(res.data.data); setShowModal(true); }
      else showToast('Failed to fetch complaint details', 'error');
    } catch { showToast('Failed to fetch complaint details', 'error'); }
  };

  const updateComplaintStatus = async (id, status) => {
    setUpdating(true);
    try {
      const res = await ComplaintService.updateComplaintStatus(id, status);
      if (res.data?.success) {
        await fetchComplaints();
        if (selectedComplaint?.complaint?._id === id) {
          setSelectedComplaint(p => ({
            ...p,
            complaint: { ...p.complaint, status }
          }));
        }
        return true;
      }
      showToast('Failed to update status', 'error'); return false;
    } catch { showToast('Failed to update status', 'error'); return false; }
    finally { setUpdating(false); }
  };

  const resolveComplaint = async (id, resolutionNotes, decision) => {
    setUpdating(true);
    try {
      const res = await ComplaintService.resolveComplaint(id, { resolutionNotes, decision });
      if (res.data?.success) { await fetchComplaints(); setShowModal(false); return true; }
      showToast('Failed to resolve complaint', 'error'); return false;
    } catch { showToast('Failed to resolve complaint', 'error'); return false; }
    finally { setUpdating(false); }
  };

  const handleFilterChange = (key, value) => {
    setFilters(p => ({ ...p, [key]: value }));
    setPagination(p => ({ ...p, page: 1 }));
  };

  const clearFilters = () => {
    resetGlobalFilters();
    setFilters({ status: '', category: '', search: '', startDate: '', endDate: '', userType: '', providerId: '' });
    setPagination(p => ({ ...p, page: 1 }));
  };

  // Reactively default dateRange to global computed dates on change
  const globalDates = getComputedDateRange();
  useEffect(() => {
    if (globalDates.startDate && globalDates.endDate) {
      setFilters(prev => ({
        ...prev,
        startDate: globalDates.startDate,
        endDate: globalDates.endDate
      }));
      setPagination(p => ({ ...p, page: 1 }));
    }
  }, [globalDates.startDate, globalDates.endDate]);

  useEffect(() => { fetchComplaints(); }, [filters, pagination.page]);

  useEffect(() => {
    if (entityId) {
      fetchComplaintDetails(entityId);
    }
  }, [entityId]);

  // ── Derived stats ──
  const customerCount = complaints.filter(c => c.userType === 'customer').length;
  const providerCount = complaints.filter(c => c.userType === 'provider').length;
  const pendingCount = complaints.filter(c => c.status === 'Open' || c.status === 'Reopened').length;

  const statCards = [
    { label: 'Total Complaints', value: pagination.total, icon: FiBarChart2, gradient: 'text-primary', iconBg: 'bg-primary/10', delay: 0 },
    { label: 'Customer Complaints', value: customerCount, icon: FiUser, gradient: 'text-blue-600', iconBg: 'bg-blue-100', delay: 80 },
    { label: 'Provider Complaints', value: providerCount, icon: FiTool, gradient: 'text-purple-600', iconBg: 'bg-purple-100', delay: 160 },
    { label: 'Pending', value: pendingCount, icon: FiClock, gradient: 'text-amber-600', iconBg: 'bg-amber-100', delay: 240 },
  ];

  return (
    <div className="min-h-screen bg-background font-inter flex flex-col">
      <AdminFilterBar />
      <div className="p-4 md:p-6 flex-1 w-full">
        <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Page Header ── */}
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-bold text-secondary font-poppins flex items-center gap-3">
            <span className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <FiMessageSquare className="text-primary" size={20} />
            </span>
            Complaint Management
          </h1>
          <p className="text-sm text-gray-400 mt-1 ml-13 pl-0.5">Monitor and manage all customer &amp; provider complaints</p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map(card => <StatCard key={card.label} {...card} />)}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-secondary flex items-center gap-2">
              <FiFilter className="text-primary" size={15} /> Filters
            </h2>
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium">
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Search – spans full width */}
            <div className="relative sm:col-span-2 lg:col-span-3">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search by title, user..."
                value={filters.search}
                onChange={e => handleFilterChange('search', e.target.value)}
                className="pl-9 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-white text-sm outline-none transition-all"
              />
            </div>

            {/* User Type */}
            <select
              value={filters.userType}
              onChange={e => handleFilterChange('userType', e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white text-sm text-secondary outline-none transition-all"
            >
              {userTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Status */}
            <select
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white text-sm text-secondary outline-none transition-all"
            >
              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {/* Provider ID */}
            <div className="relative">
              <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                placeholder="Provider ID..."
                value={filters.providerId}
                onChange={e => handleFilterChange('providerId', e.target.value)}
                className="pl-9 w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:bg-white text-sm outline-none transition-all"
              />
            </div>

            {/* Refresh – spans full */}
            <button
              onClick={fetchComplaints}
              className="sm:col-span-2 lg:col-span-3 w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
              <FiRefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* ── Complaints List ── */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden animate-slide-up">
          {/* Header */}
          <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-secondary font-poppins">All Complaints</h2>
            <span className="text-xs bg-primary/10 text-primary font-semibold px-3 py-1 rounded-full">
              {pagination.total} total
            </span>
          </div>

          {/* ── TABLE (all screen sizes, horizontal scroll on mobile) ── */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['#', 'Title & Category', 'Submitter', 'User Type', 'Status', 'Provider', 'Date', 'Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : complaints.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                          <FiInbox className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="text-secondary font-semibold">No complaints found</p>
                        <p className="text-sm text-gray-400">
                          {Object.values(filters).some(f => f) ? 'Try adjusting your filters' : 'No complaints yet'}
                        </p>
                        {Object.values(filters).some(f => f) && (
                          <button onClick={clearFilters} className="text-primary text-sm font-medium hover:underline">Clear Filters</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  complaints.map((c, idx) => {
                    const actualUserType = c.userType || (c.userId || c.customer ? 'customer' : 'provider');
                    const submitter = actualUserType === 'customer' ? (c.userId || c.customer) : (c.providerId || c.provider);
                    return (
                    <tr
                      key={c._id}
                      className="hover:bg-gray-50/80 transition-colors duration-150 animate-slide-up"
                      style={{ animationDelay: `${idx * 25}ms` }}
                    >
                      <td className="px-4 py-3.5 text-xs font-mono font-semibold text-gray-400 whitespace-nowrap">
                        #{(c.complaintId || (c._id || '').slice(-6)).toString().toUpperCase()}
                      </td>
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <p className="text-sm font-semibold text-secondary truncate">{c.title || 'No Title'}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{c.category || '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 max-w-[140px]">
                        <p className="text-sm font-medium text-secondary truncate">
                          {submitter?.name || 'Unknown'}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">
                          {submitter?.email || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5"><TypeBadge type={actualUserType} /></td>
                      <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3.5 max-w-[120px]">
                        {(c.providerId || c.provider) ? (
                          <div>
                            <p className="text-sm font-medium text-secondary truncate">
                              {c.providerId?.name || c.provider?.name || 'N/A'}
                            </p>
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-400 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => fetchComplaintDetails(c._id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 hover:shadow-md transition-all"
                        >
                          <FiEye size={12} /> View
                        </button>
                      </td>
                    </tr>
                  );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            limit={pagination.limit}
            onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
          />
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && selectedComplaint && (
        <ComplaintDetailsModal
          data={selectedComplaint}
          onClose={() => setShowModal(false)}
          onUpdateStatus={updateComplaintStatus}
          onResolve={resolveComplaint}
        />
      )}
      </div>
    </div>
  );
};

export default ComplaintsPage;