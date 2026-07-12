// src/pages/admin/ComplaintsPage.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { useSearchParams } from 'react-router-dom';
import StatsCard from '../../components/ui/StatsCard';
import * as ComplaintService from '../../services/ComplaintService';
import {
  FiRefreshCw, FiEye, FiCheckCircle, FiAlertTriangle,
  FiUser, FiTool, FiClock, FiBarChart2, FiX,
  FiMail, FiMessageSquare,
  FiInbox
} from 'react-icons/fi';
import Pagination from '../../components/Pagination';
import { formatDate, formatDateTime } from '../../utils/format';
import CDNImage from '../../components/CDNImage';
import { useAdminFilter } from '../../context/AdminFilterContext';
import { AdminLocalFilterBar } from '../../components/AdminFilterBar';

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



// ── Priority Badge ───────────────────────────────────────────
const PriorityBadge = ({ priority }) => {
  const cfg = {
    Critical: 'bg-red-100 text-red-800 border-red-300',
    High: 'bg-orange-100 text-orange-700 border-orange-300',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    Low: 'bg-blue-100 text-blue-600 border-blue-200',
  };
  if (!priority) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg[priority] || cfg.Low}`}>
      {priority === 'Critical' && <span className="mr-1">⚠️</span>}
      {priority}
    </span>
  );
};

// ── Case Age Display ─────────────────────────────────────────
const CaseAge = ({ hoursOpen, daysOpen }) => {
  if (hoursOpen === undefined) return <span className="text-gray-300 text-xs">—</span>;
  if (daysOpen >= 1) {
    return (
      <span className={`text-xs font-semibold ${daysOpen >= 3 ? 'text-red-600' : daysOpen >= 1 ? 'text-amber-600' : 'text-gray-500'}`}>
        {daysOpen}d {hoursOpen % 24}h
      </span>
    );
  }
  return <span className="text-xs font-semibold text-gray-500">{hoursOpen}h</span>;
};


const ComplaintDetailsModal = ({ data, onClose, onUpdateStatus, onResolve }) => {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const { complaint, booking } = data || {};
  const [statusUpdate, setStatusUpdate] = useState(complaint?.status || '');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState(booking?.totalAmount || complaint?.booking?.totalAmount || 0);
  const [penaltyAmount, setPenaltyAmount] = useState(500);
  const [confirmAction, setConfirmAction] = useState(null); // 'approve_refund', 'reject_refund', 'manual_review', etc.
  const [submitting, setSubmitting] = useState(false);
  const [absorbPlatformCommission, setAbsorbPlatformCommission] = useState(false);

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
      const extra = {};
      if (['partial_refund', 'platform_credit'].includes(confirmAction)) {
        extra.refundAmount = Number(refundAmount);
      }
      if (confirmAction === 'provider_penalty') {
        extra.penaltyAmount = Number(penaltyAmount);
      }
      await onResolve(complaint._id, resolutionNotes, confirmAction, extra);
      setResolutionNotes('');
      setConfirmAction(null);
      showToast('Complaint resolved!', 'success');
    }
    catch (err) { showToast(err.response?.data?.message || 'Failed to resolve', 'error'); }
    finally { setSubmitting(false); }
  };

  if (!data || !complaint) return null;

  const actualUserType = complaint.userType || (complaint.userId || complaint.customer ? 'customer' : 'provider');
  const submitterInfo = actualUserType === 'customer'
    ? (complaint.userId || complaint.customer)
    : (complaint.providerId || complaint.provider);
  const opposingParty = actualUserType === 'customer'
    ? (complaint.provider || booking?.provider)
    : (complaint.customer || booking?.customer || complaint.userId);

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
            {[
              { id: 'details', label: 'Overview' },
              { id: 'timeline', label: 'Evidence Locker' },
              { id: 'actions', label: 'Actions' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-4 text-sm font-medium capitalize transition-all border-b-2 -mb-px ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-400 hover:text-secondary'
                  }`}
              >
                {tab.label}
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

              {/* Dedicated Recommendation Panel (Fix 1) */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h4 className="text-sm font-black text-blue-900 flex items-center gap-2">
                    <FiBarChart2 className="text-blue-600" /> Dedicated Recommendation Panel
                  </h4>
                  <span className="text-xs bg-white px-3 py-1 rounded-full border border-blue-150 font-bold text-blue-800">
                    Advisory Only (Admin holds final control)
                  </span>
                </div>

                {complaint.slaTracking && (
                  <div className="space-y-1.5 bg-white p-3 rounded-lg border border-blue-50">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FiClock className={complaint.slaTracking.slaStatus === 'breached' ? 'text-red-500 animate-pulse' : 'text-gray-400'} />
                        <span className="text-gray-500 font-medium">SLA Status:</span>
                        <span className={`font-bold uppercase ${complaint.slaTracking.slaStatus === 'breached' ? 'text-red-600' :
                          complaint.slaTracking.slaStatus === 'warning' ? 'text-amber-600' : 'text-green-600'
                        }`}>
                          {complaint.slaTracking.slaStatus === 'breached' ? '⚠️ Breached' : 'Within SLA'}
                        </span>
                      </div>
                      <span className="text-gray-500 font-medium">
                        Elapsed: <strong>{complaint.slaTracking.hoursElapsed}h</strong> / Limit: {complaint.slaTracking.slaThresholdHours}h
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${complaint.slaTracking.slaStatus === 'breached' ? 'bg-red-500' :
                          complaint.slaTracking.slaStatus === 'warning' ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${complaint.slaTracking.percentageUsed}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Complaint Score</p>
                    <p className={`text-xl font-black ${complaint.complaintScore > 60 ? 'text-red-600' : 'text-secondary'}`}>{complaint.complaintScore || 0}/100</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Provider Trust Score</p>
                    <p className={`text-xl font-black ${complaint.providerTrustScore < 50 ? 'text-red-600' : 'text-green-600'}`}>{complaint.providerTrustScore || 0}/100</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Customer Risk Profile</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className={`text-xl font-black ${complaint.customerFraudScore > 60 ? 'text-red-600' : 'text-green-600'}`}>{complaint.customerFraudScore || 0}/100</p>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${complaint.riskScore === 'high' ? 'bg-red-100 text-red-700' :
                        complaint.riskScore === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                        {complaint.riskScore || 'low'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Evidence Strength</p>
                    <p className={`text-xl font-black ${complaint.evidenceStrength > 50 ? 'text-green-600' : 'text-amber-600'}`}>{complaint.evidenceStrength || 0}/100</p>
                  </div>
                </div>

                {/* Explainable Risk Contributors (FIX 4) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-3.5 rounded-lg border border-blue-50">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer Risk Contributors (Score: {complaint.customerFraudScore || 0})</p>
                    {complaint.customerHistory?.riskContributors?.length > 0 ? (
                      <ul className="text-xs space-y-1 font-medium text-gray-650">
                        {complaint.customerHistory.riskContributors.map((c, i) => (
                          <li key={i} className="flex justify-between">
                            <span>• {c.label}</span>
                            <span className="text-red-650 font-bold">+{c.value}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No negative risk factors detected.</p>
                    )}
                  </div>
                  <div className="space-y-1 border-t md:border-t-0 md:border-l border-gray-100 pt-2 md:pt-0 md:pl-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Provider Trust Contributors (Score: {complaint.providerTrustScore || 0})</p>
                    {complaint.providerHistory?.trustContributors?.length > 0 ? (
                      <ul className="text-xs space-y-1 font-medium text-gray-650">
                        {complaint.providerHistory.trustContributors.map((c, i) => (
                          <li key={i} className="flex justify-between">
                            <span>• {c.label}</span>
                            <span className="text-red-650 font-bold">{c.value}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-green-600 font-semibold italic">Perfect service record maintained (+0 penalties)</p>
                    )}
                  </div>
                </div>

                {/* Advisory Disclaimer Banner */}
                <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 flex items-start gap-2.5">
                  <FiAlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={14} />
                  <div>
                    <p className="text-[11px] font-black text-amber-800 uppercase tracking-wide">Recommendation Only</p>
                    <p className="text-[10px] text-amber-700 font-medium mt-0.5">Final decision requires explicit admin approval. No automatic actions will be taken.</p>
                  </div>
                </div>

                {complaint.recommendation && (
                  <div className="bg-white p-4 rounded-lg border border-blue-100 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Suggested Action:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                          complaint.recommendation.action === 'approve_refund' || complaint.recommendation.action === 'refund' ? 'bg-green-100 text-green-700' :
                          complaint.recommendation.action === 'reject_refund' || complaint.recommendation.action === 'reject' ? 'bg-red-100 text-red-700' :
                          complaint.recommendation.action === 're_service' ? 'bg-purple-100 text-purple-700' :
                          complaint.recommendation.action === 'platform_credit' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {complaint.recommendation.action.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-gray-500">
                        Confidence Level: <span className="text-blue-600 font-extrabold">{complaint.recommendation.confidenceLevel} ({complaint.recommendation.confidence}%)</span>
                      </span>
                    </div>
                    {complaint.recommendation.reasons?.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reason List:</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-600">
                          {complaint.recommendation.reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {complaint.recommendation.contraIndicators?.length > 0 && (
                      <div className="space-y-1 border-t border-dashed border-gray-100 pt-2">
                        <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Contra Indicators:</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-xs text-red-650">
                          {complaint.recommendation.contraIndicators.map((ci, idx) => (
                            <li key={idx}>{ci}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Refund Eligibility Section */}
              <div className={`p-4 rounded-xl border flex flex-col gap-1.5 ${
                complaint.isRefundEligible !== false 
                  ? 'bg-green-50/60 border-green-200 text-green-800' 
                  : 'bg-red-50/60 border-red-200 text-red-800'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider">Refund Eligibility</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                    complaint.isRefundEligible !== false 
                      ? 'bg-green-100 text-green-700 border-green-300' 
                      : 'bg-red-100 text-red-700 border-red-300'
                  }`}>
                    {complaint.isRefundEligible !== false ? 'YES' : 'NO'}
                  </span>
                </div>
                <p className="text-xs font-medium">
                  Reason: <strong className="font-bold">{complaint.eligibilityReason || (complaint.isRefundEligible !== false ? "Service Quality Issue" : "Technical Support Ticket")}</strong>
                </p>
              </div>

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
                    ['Complaint Type', <span className="font-bold text-red-600 uppercase">{complaint.complaintType?.replace('_', ' ') || 'N/A'}</span>],
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
                  {/* Priority and Case Age */}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Priority</span>
                    <PriorityBadge priority={complaint.priority} />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Case Age</span>
                    <span className="text-xs font-semibold text-secondary">
                      {complaint.daysOpen >= 1
                        ? `${complaint.daysOpen}d ${(complaint.hoursOpen || 0) % 24}h open`
                        : `${complaint.hoursOpen || 0}h open`}
                    </span>
                  </div>
                </div>

                {/* Submitter & Opposing Parties */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                  <div>
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FiUser className="text-primary" size={12} /> Submitted By ({actualUserType === 'customer' ? 'Customer' : 'Provider'})
                    </h4>
                    {submitterInfo ? (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-100">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${actualUserType === 'customer' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                          <FiUser className="text-white" size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-secondary">{submitterInfo.name || 'N/A'}</p>
                          {submitterInfo.email && (
                            <p className="text-xs text-gray-450 flex items-center gap-1 mt-0.5">
                              <FiMail size={10} /> {submitterInfo.email}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : <p className="text-xs text-gray-405 italic">No submitter info available</p>}
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      {actualUserType === 'customer' ? (
                        <><FiTool className="text-purple-500" size={12} /> Affected Provider</>
                      ) : (
                        <><FiUser className="text-blue-500" size={12} /> Involved Customer</>
                      )}
                    </h4>
                    {opposingParty ? (
                      <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-100">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${actualUserType === 'customer' ? 'bg-purple-500' : 'bg-blue-500'}`}>
                          {actualUserType === 'customer' ? <FiTool className="text-white" size={14} /> : <FiUser className="text-white" size={14} />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-secondary">{opposingParty.name || 'N/A'}</p>
                          {opposingParty.email && (
                            <p className="text-xs text-gray-455 flex items-center gap-1 mt-0.5">
                              <FiMail size={10} /> {opposingParty.email}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : <p className="text-xs text-gray-405 italic">No opposing party info available</p>}
                  </div>
                </div>
              </div>

              {/* Booking & Financial Details Breakdown */}
              {complaint.booking && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                  <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                    <FiBarChart2 className="text-primary" size={14} /> Payment &amp; Refund Breakdown
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-white p-2.5 rounded-lg border">
                      <p className="text-[10px] font-bold text-gray-450 uppercase">Booking Amount</p>
                      <p className="text-sm font-black text-secondary">₹{booking?.totalAmount || 0}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border">
                      <p className="text-[10px] font-bold text-gray-450 uppercase">Commission</p>
                      <p className="text-sm font-black text-secondary">₹{booking?.commissionAmount || 0}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border">
                      <p className="text-[10px] font-bold text-gray-450 uppercase">Provider Share</p>
                      <p className="text-sm font-black text-secondary">₹{booking?.providerEarnings || 0}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border bg-teal-50">
                      <p className="text-[10px] font-bold text-teal-600 uppercase">Refunded Amount</p>
                      <p className="text-sm font-black text-teal-700">₹{booking?.cancellationProgress?.refundAmount || 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* History Cards Grid */}
              {(complaint.providerHistory || complaint.customerHistory) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Provider History */}
                  {complaint.providerHistory && (
                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <h4 className="text-sm font-bold text-secondary mb-3 flex items-center gap-2">
                        <FiTool className="text-purple-500" /> Provider Trust Profile
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Completed Jobs</p>
                          <p className="font-bold text-secondary">{complaint.providerHistory.completedBookings}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Provider Rating</p>
                          <p className="font-bold text-secondary">{complaint.providerHistory.avgRating} ★</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Complaint Ratio</p>
                          <p className={`font-bold ${complaint.providerHistory.complaintRatio > 10 ? 'text-red-500' : 'text-secondary'}`}>{complaint.providerHistory.complaintRatio}%</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Trust Score</p>
                          <p className={`font-bold ${complaint.providerTrustScore < 60 ? 'text-red-600' : 'text-green-600'}`}>{complaint.providerTrustScore}/100</p>
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
                          <p className="text-[10px] text-gray-400 uppercase">Total Orders</p>
                          <p className="font-bold text-secondary">{complaint.customerHistory.totalBookings}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Refund Count</p>
                          <p className={`font-bold ${complaint.customerHistory.refundRequests > 2 ? 'text-red-500' : 'text-secondary'}`}>{complaint.customerHistory.refundRequests}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Complaints Count</p>
                          <p className={`font-bold ${complaint.customerHistory.complaintCount > 2 ? 'text-red-500' : 'text-secondary'}`}>{complaint.customerHistory.complaintCount}</p>
                        </div>
                        <div className="bg-gray-50 p-2 rounded-lg">
                          <p className="text-[10px] text-gray-400 uppercase">Risk Level</p>
                          <p className={`font-bold uppercase ${complaint.riskScore === 'high' ? 'text-red-600' : complaint.riskScore === 'medium' ? 'text-amber-500' : 'text-green-600'}`}>{complaint.riskScore || 'low'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* ── Evidence Locker (formerly Timeline) Tab ── */}
          {activeTab === 'timeline' && (
            <div className="space-y-6 animate-fade-in">
              {/* Image Comparison Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                  <FiEye className="text-primary" /> Image Comparison (Evidence)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Customer Complaint Images */}
                  <div className="bg-red-50/30 rounded-xl p-4 border border-red-100 min-h-[160px]">
                    <p className="text-[10px] font-black text-red-600 uppercase mb-3 tracking-wider">Complaint Evidence (Customer)</p>
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
                      ) : (
                        <div className="col-span-2 h-20 flex items-center justify-center bg-gray-100 rounded-lg border border-dashed border-gray-300">
                          <span className="text-[10px] text-gray-400 font-bold">No images</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Provider Before Work */}
                  <div className="bg-amber-50/30 rounded-xl p-4 border border-amber-100 min-h-[160px]">
                    <p className="text-[10px] font-black text-amber-600 uppercase mb-3 tracking-wider">Before Work Proof (Provider)</p>
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
                    <p className="text-[10px] font-black text-green-600 uppercase mb-3 tracking-wider">After Work Proof (Provider)</p>
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

              {/* Provider Response Replies */}
              <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                <div className="bg-white px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                    <FiMessageSquare className="text-primary" /> Provider responses &amp; replies
                  </h4>
                </div>
                <div className="p-4 space-y-4">
                  {booking?.complaintProofs?.filter(p => p.uploadedBy !== 'customer').length > 0 ? (
                    booking.complaintProofs.filter(p => p.uploadedBy !== 'customer').map((reply, idx) => (
                      <div key={idx} className={`p-3 rounded-xl border ${reply.uploadedBy === 'admin' ? 'bg-blue-50 border-blue-100' : 'bg-purple-50 border-purple-100'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${reply.uploadedBy === 'admin' ? 'bg-blue-200 text-blue-700' : 'bg-purple-200 text-purple-700'}`}>
                            {reply.uploadedBy}
                          </span>
                          <span className="text-[9px] text-gray-400">{formatDateTime(reply.createdAt)}</span>
                        </div>
                        <p className="text-sm text-secondary leading-relaxed">{reply.message || 'No message'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 italic text-center py-2">No response submitted by provider yet.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 pt-6">
                {/* Booking Timeline */}
                {complaint.booking && (
                  <div className="space-y-6">
                    <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                      <FiClock className="text-blue-500" /> Booking Progress
                    </h4>
                    {booking?.timeline?.length > 0 ? (
                      <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
                        {booking.timeline.map((step, i) => (
                          <div key={i} className="relative">
                            <div className="absolute -left-6 top-1.5 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center bg-gray-300">
                              <div className="w-1.5 h-1.5 bg-white rounded-full" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-secondary uppercase tracking-tight">{step.label}</p>
                              <p className="text-[10px] text-gray-400 font-medium">{formatDateTime(step.date)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-405 italic">No booking progress history found</p>}
                  </div>
                )}

                {/* Resolution timeline */}
                <div className="space-y-6">
                  <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                    <FiMessageSquare className="text-amber-500" /> Resolution Steps &amp; History
                  </h4>
                  {complaint.resolutionHistory?.length > 0 ? (
                    <div className="space-y-4">
                      {complaint.resolutionHistory.map((h, i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className="flex flex-col items-center">
                            <div className="w-3 h-3 rounded-full mt-1 bg-primary ring-4 ring-primary/10" />
                            {i < complaint.resolutionHistory.length - 1 && <div className="w-0.5 h-12 bg-gray-100 mt-1" />}
                          </div>
                          <div className="flex-1 bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-xs font-bold text-secondary uppercase tracking-tight">{h.event}</p>
                              <span className="text-[10px] text-gray-400">{formatDateTime(h.timestamp)}</span>
                            </div>
                            {h.note && <p className="text-sm text-gray-600 mt-1 leading-relaxed">"{h.note}"</p>}
                            <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1 uppercase font-bold">
                              By: {h.by}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-405 italic">No resolution steps logged</p>}
                </div>
              </div>
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
                    {['Open', 'In-Progress', 'resolved', 'Reopened', 'Closed', 'request_more_evidence', 'under_review'].map(s => (
                      <option key={s} value={s}>{s === 'resolved' ? 'Resolved' : s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={!statusUpdate}
                    className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Update Status
                  </button>
                </div>
              </div>

              {/* Resolve actions */}
              {['Solved', 'Closed', 'resolved', 'rejected', 'refunded'].includes(complaint.status) ? (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
                  <p className="text-sm font-bold text-green-700">Dispute Resolved</p>
                  <p className="text-xs text-green-600 mt-1">Status: {complaint.status.toUpperCase()} | Notes: {complaint.resolutionNotes || 'None'}</p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                  <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                    <FiCheckCircle className="text-green-500" size={16} /> Admin Actions Dashboard
                  </h4>

                  <textarea
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    placeholder="Enter resolution notes, required before executing any action..."
                    rows="3"
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-secondary"
                  />

                  {/* Contextual inputs for partial refund or penalty */}
                  {confirmAction === 'partial_refund' && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3 animate-fade-in">
                      <span className="text-xs font-bold text-blue-700">Refund Amount (₹):</span>
                      <input
                        type="number"
                        value={refundAmount}
                        onChange={e => setRefundAmount(e.target.value)}
                        className="w-28 px-2 py-1 bg-white border rounded text-xs outline-none"
                        max={booking?.totalAmount || 1000}
                      />
                    </div>
                  )}

                  {confirmAction === 'platform_credit' && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3 animate-fade-in">
                      <span className="text-xs font-bold text-blue-700">Wallet Credit Amount (₹):</span>
                      <input
                        type="number"
                        value={refundAmount}
                        onChange={e => setRefundAmount(e.target.value)}
                        className="w-28 px-2 py-1 bg-white border rounded text-xs outline-none"
                        max={booking?.totalAmount || 1000}
                      />
                    </div>
                  )}

                  {confirmAction === 'provider_penalty' && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 animate-fade-in">
                      <span className="text-xs font-bold text-red-700">Penalty Deduction (₹):</span>
                      <input
                        type="number"
                        value={penaltyAmount}
                        onChange={e => setPenaltyAmount(e.target.value)}
                        className="w-28 px-2 py-1 bg-white border rounded text-xs outline-none"
                      />
                    </div>
                  )}

                  {/* Buttons Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {complaint.isRefundEligible !== false ? (
                      <>
                        <button
                          onClick={() => setConfirmAction('reject')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'reject' ? 'bg-red-600 text-white' : 'bg-white hover:bg-gray-50 text-red-600 border-red-200'}`}
                        >
                          Reject Complaint
                        </button>
                        <button
                          onClick={() => setConfirmAction('request_more_evidence')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'request_more_evidence' ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-gray-50 text-indigo-600 border-indigo-200'}`}
                        >
                          Request Evidence
                        </button>
                        <button
                          onClick={() => setConfirmAction('re_service')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 're_service' ? 'bg-purple-650 text-white' : 'bg-white hover:bg-gray-50 text-purple-650 border-purple-200'}`}
                        >
                          Re-Service
                        </button>
                        <button
                          onClick={() => { setRefundAmount(booking?.totalAmount || 0); setConfirmAction('full_refund'); }}
                          disabled={!resolutionNotes.trim() || isFullyRefunded}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'full_refund' ? 'bg-green-600 text-white' : 'bg-white hover:bg-gray-50 text-green-600 border-green-200'}`}
                        >
                          Full Refund
                        </button>
                        <button
                          onClick={() => setConfirmAction('partial_refund')}
                          disabled={!resolutionNotes.trim() || isFullyRefunded}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'partial_refund' ? 'bg-teal-600 text-white' : 'bg-white hover:bg-gray-50 text-teal-600 border-teal-200'}`}
                        >
                          Partial Refund
                        </button>
                        <button
                          onClick={() => setConfirmAction('platform_credit')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'platform_credit' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50 text-blue-600 border-blue-200'}`}
                        >
                          Platform Credit
                        </button>
                        <button
                          onClick={() => setConfirmAction('provider_warning')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'provider_warning' ? 'bg-orange-500 text-white' : 'bg-white hover:bg-gray-50 text-orange-500 border-orange-200'}`}
                        >
                          Provider Warning
                        </button>
                        <button
                          onClick={() => setConfirmAction('provider_penalty')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'provider_penalty' ? 'bg-red-500 text-white' : 'bg-white hover:bg-gray-50 text-red-500 border-red-200'}`}
                        >
                          Provider Penalty
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmAction('resolve')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'resolve' ? 'bg-green-600 text-white' : 'bg-white hover:bg-gray-50 text-green-600 border-green-200'}`}
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => setConfirmAction('reject')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'reject' ? 'bg-red-600 text-white' : 'bg-white hover:bg-gray-50 text-red-600 border-red-200'}`}
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => setConfirmAction('reply')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'reply' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-50 text-blue-600 border-blue-200'}`}
                        >
                          Reply
                        </button>
                        <button
                          onClick={() => setConfirmAction('escalate')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'escalate' ? 'bg-amber-600 text-white' : 'bg-white hover:bg-gray-50 text-amber-600 border-amber-200'}`}
                        >
                          Escalate
                        </button>
                        <button
                          onClick={() => setConfirmAction('close')}
                          disabled={!resolutionNotes.trim()}
                          className={`px-3 py-2 text-xs font-bold rounded-lg transition-all border ${confirmAction === 'close' ? 'bg-red-600 text-white' : 'bg-white hover:bg-gray-50 text-red-600 border-red-200'}`}
                        >
                          Close
                        </button>
                      </>
                    )}
                  </div>

                  {confirmAction && (
                    <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-xl animate-fade-in space-y-3">
                      <p className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-1.5">
                        Are you sure you want to proceed with: <span className="uppercase text-primary font-black">{confirmAction.replace(/_/g, ' ')}</span>?
                      </p>

                      {/* Admin Confirmation Impact Summary */}
                      {['full_refund', 'partial_refund', 're_service', 'platform_credit', 'provider_penalty'].includes(confirmAction) && (
                        <div className="bg-white rounded-lg border border-blue-100 p-3 space-y-2 text-xs">
                          <p className="text-[10px] font-black text-blue-900 uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                            <FiAlertTriangle className="text-amber-500" size={12} /> Admin Confirmation Required
                          </p>
                          <div className="space-y-1.5">
                            {/* Customer Impact */}
                            <div className="flex justify-between">
                              <span className="text-gray-500 font-semibold">Customer Impact:</span>
                              <span className="font-bold text-green-700">
                                {confirmAction === 'full_refund' ? `Receives ₹${booking?.totalAmount || 0} refund` :
                                  confirmAction === 'partial_refund' ? `Receives ₹${refundAmount} partial refund` :
                                  confirmAction === 're_service' ? 'New service booking scheduled' :
                                  confirmAction === 'platform_credit' ? `Receives ₹${refundAmount} wallet credit` :
                                  'No direct impact'}
                              </span>
                            </div>
                            {/* Provider Impact */}
                            <div className="flex justify-between">
                              <span className="text-gray-500 font-semibold">Provider Impact:</span>
                              <span className="font-bold text-red-700">
                                {confirmAction === 'full_refund' || confirmAction === 'partial_refund' ? 'Earnings reversed (held/escrow/wallet)' :
                                  confirmAction === 're_service' ? 'Assigned re-service booking' :
                                  confirmAction === 'platform_credit' ? 'No earnings change' :
                                  confirmAction === 'provider_penalty' ? `₹${penaltyAmount} wallet deduction` :
                                  'No direct impact'}
                              </span>
                            </div>
                            {/* Platform Impact */}
                            <div className="flex justify-between">
                              <span className="text-gray-500 font-semibold">Platform Impact:</span>
                              <span className="font-bold text-purple-700">
                                {confirmAction === 'full_refund' || confirmAction === 'partial_refund' ?
                                  (absorbPlatformCommission ? 'Absorbs commission share' : 'Proportional commission reversal') :
                                  confirmAction === 'platform_credit' ? 'Absorbs full credit amount' :
                                  'No revenue change'}
                              </span>
                            </div>
                            {/* Reason */}
                            {resolutionNotes.trim() && (
                              <div className="border-t border-gray-100 pt-1.5">
                                <span className="text-gray-400 font-semibold">Reason: </span>
                                <span className="text-gray-700 italic">"{resolutionNotes.trim()}"</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Explicit Platform Commission Absorption Checkbox (FIX 5) */}
                      {['full_refund', 'partial_refund'].includes(confirmAction) && (
                        <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-blue-100 text-xs">
                          <input 
                            type="checkbox" 
                            id="absorbPlatformCommissionCheckbox" 
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                            checked={absorbPlatformCommission}
                            onChange={(e) => {
                              setAbsorbPlatformCommission(e.target.checked);
                            }}
                          />
                          <label htmlFor="absorbPlatformCommissionCheckbox" className="font-semibold text-gray-700 cursor-pointer">
                            Platform Commission Absorption (Requires Explicit Admin Approval)
                          </label>
                        </div>
                      )}

                      {/* Refund Simulation & Impact Preview (simulation panel) */}
                      {['full_refund', 'partial_refund'].includes(confirmAction) && (() => {
                        const sim = (() => {
                          if (!booking) return null;
                          const grossBilled = booking.totalAmount || 0;
                          const originalProvider = booking.providerEarnings || 0;
                          const originalPlatform = (booking.commissionAmount || 0) + (booking.companySurgeShare || 0);

                          const activeRefundAmt = confirmAction === 'full_refund' ? grossBilled : Number(refundAmount || 0);

                          let providerLoss = 0;
                          let platformLoss = 0;

                          const ratio = activeRefundAmt / (grossBilled || 1);
                          providerLoss = parseFloat((originalProvider * ratio).toFixed(2));
                          platformLoss = parseFloat((activeRefundAmt - providerLoss).toFixed(2));

                          let commissionRate = 10;
                          if (booking.commissionAmount > 0 && booking.totalAmount > 0) {
                            commissionRate = (booking.commissionAmount / booking.totalAmount) * 100;
                          }
                          const providerEarningsReversal = (booking.totalAmount - (booking.totalAmount * (commissionRate / 100))) * ratio;
                          const adminRevenueReversal = (booking.totalAmount * (commissionRate / 100)) * ratio;

                          let held = 0;
                          let pendingRelease = 0;
                          let available = 0;
                          let paidWithdrawn = 0;
                          let platformAbsorption = platformLoss;

                          const earningStatus = (booking.payoutStatus || '').toLowerCase();
                          const isHeld = ['held', 'under_review', 'payout on hold', 'dispute hold'].some(s => earningStatus.includes(s));
                          const isEscrow = ['available', 'pending_release', 'payout ready'].some(s => earningStatus.includes(s));
                          const isPaid = ['paid', 'withdrawn', 'payout released', 'released'].some(s => earningStatus.includes(s));

                          if (isHeld) {
                            held = providerLoss;
                          } else if (earningStatus.includes('pending')) {
                            pendingRelease = providerLoss;
                          } else if (isEscrow) {
                            available = providerLoss;
                          } else if (isPaid) {
                            const platformAbsorbedShare = absorbPlatformCommission ? adminRevenueReversal : 0;
                            paidWithdrawn = Math.max(0, providerEarningsReversal - platformAbsorbedShare);
                            platformAbsorption = platformLoss + platformAbsorbedShare;
                          } else {
                            paidWithdrawn = providerLoss;
                          }

                          return {
                            customerReceives: activeRefundAmt,
                            providerLoss,
                            platformLoss: platformAbsorption,
                            splits: { held, pendingRelease, available, paidWithdrawn, platformAbsorption }
                          };
                        })();

                        if (!sim) return null;

                        return (
                          <div className="bg-white p-4 rounded-xl border border-blue-100 text-xs space-y-3.5 mt-2 shadow-sm">
                            <p className="font-bold text-blue-900 uppercase tracking-wider text-[10px]">Financial Impact Preview</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center border-b border-gray-100 pb-2.5">
                              <div className="bg-green-50 p-2.5 rounded-lg border border-green-100">
                                <p className="text-[9px] text-green-700 font-bold uppercase">Customer Receives</p>
                                <p className="font-black text-sm text-green-800">₹{sim.customerReceives.toFixed(2)}</p>
                              </div>
                              <div className="bg-red-50 p-2.5 rounded-lg border border-red-100">
                                <p className="text-[9px] text-red-700 font-bold uppercase">Provider Loses</p>
                                <p className="font-black text-sm text-red-800">₹{sim.providerLoss.toFixed(2)}</p>
                              </div>
                              <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-100">
                                <p className="text-[9px] text-purple-700 font-bold uppercase">Platform Loses</p>
                                <p className="font-black text-sm text-purple-800">₹{sim.platformLoss.toFixed(2)}</p>
                              </div>
                              <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                                <p className="text-[9px] text-blue-700 font-bold uppercase">Refund Amount</p>
                                <p className="font-black text-sm text-blue-800">₹{sim.customerReceives.toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <p className="font-bold text-gray-500 uppercase tracking-wider text-[9px] mb-1">Recovery Path:</p>
                              <div className="flex justify-between text-[11px] font-medium text-gray-600">
                                <span>Held Earnings:</span>
                                <span className="font-bold text-secondary">₹{sim.splits.held.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-[11px] font-medium text-gray-600">
                                <span>Escrow:</span>
                                <span className="font-bold text-secondary">₹{(sim.splits.pendingRelease + sim.splits.available).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-[11px] font-medium text-gray-600">
                                <span>Provider Wallet:</span>
                                <span className="font-bold text-secondary">₹{sim.splits.paidWithdrawn.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-[11px] font-medium text-gray-650 border-t border-dashed border-gray-150 pt-1.5 mt-1">
                                <span>Platform:</span>
                                <span className="font-bold text-purple-650">₹{sim.splits.platformAbsorption.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Negative Wallet Balance Protection Warning Banner (FIX 4 & FIX 6) */}
                      {['full_refund', 'partial_refund'].includes(confirmAction) && (
                        (() => {
                          const originalProviderShare = booking?.providerEarnings || 0;
                          const availableBalance = booking?.provider?.wallet?.availableBalance || 0;
                          const calculatedProviderLoss = confirmAction === 'full_refund' ? originalProviderShare : (refundAmount * (originalProviderShare / (booking?.totalAmount || 1)));
                          
                          if (availableBalance < calculatedProviderLoss) {
                            return (
                              <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-medium flex items-start gap-1.5 animate-pulse">
                                <FiAlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <span>
                                  <strong>Caution:</strong> Deducting ₹{calculatedProviderLoss.toFixed(2)} from the provider (Payout already completed/paid) will push their wallet into a negative balance (Current Wallet: ₹{availableBalance}).
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          onClick={async () => {
                            const extraParams = {};
                            if (absorbPlatformCommission) {
                              extraParams.absorbPlatformCommission = true;
                            }
                            if (submitting) return;
                            setSubmitting(true);
                            try {
                              const extra = { ...extraParams };
                              if (['partial_refund', 'platform_credit'].includes(confirmAction)) {
                                extra.refundAmount = Number(refundAmount);
                              }
                              if (confirmAction === 'provider_penalty') {
                                extra.penaltyAmount = Number(penaltyAmount);
                              }
                              await onResolve(complaint._id, resolutionNotes, confirmAction, extra);
                              setResolutionNotes('');
                              setConfirmAction(null);
                              showToast('Complaint resolved!', 'success');
                            }
                            catch (err) { showToast(err.response?.data?.message || 'Failed to resolve', 'error'); }
                            finally { setSubmitting(false); }
                          }}
                          className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all"
                        >
                          Confirm Decision
                        </button>
                        <button
                          onClick={() => { setConfirmAction(null); setAbsorbPlatformCommission(false); }}
                          className="px-4 py-2 bg-white text-gray-600 border border-gray-200 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
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
  const urlSearch = searchParams.get('search') || '';
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [filters, setFilters] = useState({
    status: '', category: '', search: urlSearch, startDate: '',
    endDate: '', userType: '', providerId: ''
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [customerCount, setCustomerCount] = useState(0);
  const [providerCount, setProviderCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'Open', label: 'Open' },
    { value: 'In-Progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'Reopened', label: 'Reopened' },
    { value: 'Closed', label: 'Closed' },
  ];

  const userTypeOptions = [
    { value: '', label: 'All Users' },
    { value: 'customer', label: 'Customer' },
    { value: 'provider', label: 'Provider' },
  ];

  // ── Data fetching ──
  const fetchComplaints = async (silent = false) => {
    if (!silent) setLoading(true);
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
        setCustomerCount(res.data.customerCount || 0);
        setProviderCount(res.data.providerCount || 0);
        setPendingCount(res.data.pendingCount || 0);
      } else showToast('Failed to fetch complaints', 'error');
    } catch { showToast('Error fetching complaints', 'error'); }
    finally { if (!silent) setLoading(false); }
  };

  // Silent Refresh on window focus and online status
  useEffect(() => {
    const handleFocus = () => {
      fetchComplaints(true);
    };
    const handleOnline = () => {
      fetchComplaints(true);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [filters, pagination.page]);

  const fetchComplaintDetails = async (id) => {
    try {
      const res = await ComplaintService.getComplaintDetails(id);
      if (res.data?.success) { setSelectedComplaint(res.data.data); setShowModal(true); }
      else showToast('Failed to fetch complaint details', 'error');
    } catch { showToast('Failed to fetch complaint details', 'error'); }
  };

  const updateComplaintStatus = async (id, status) => {
    setUpdating(true);
    const prevComplaints = [...complaints];
    try {
      setComplaints(prev => prev.map(c => c._id === id ? { ...c, status } : c));
      const res = await ComplaintService.updateComplaintStatus(id, status);
      if (res.data?.success) {
        await fetchComplaints(true);
        if (selectedComplaint?.complaint?._id === id) {
          const detailRes = await ComplaintService.getComplaintDetails(id);
          if (detailRes.data?.success) setSelectedComplaint(detailRes.data.data);
        }
        return true;
      }
      showToast('Failed to update status', 'error');
      setComplaints(prevComplaints);
      return false;
    } catch {
      showToast('Failed to update status', 'error');
      setComplaints(prevComplaints);
      return false;
    }
    finally { setUpdating(false); }
  };

  const resolveComplaint = async (id, resolutionNotes, decision, extra = {}) => {
    setUpdating(true);
    try {
      const res = await ComplaintService.resolveComplaint(id, { resolutionNotes, decision, ...extra });
      if (res.data?.success) { await fetchComplaints(); setShowModal(false); return true; }
      showToast(res.data?.message || 'Failed to resolve complaint', 'error'); return false;
    } catch (err) { showToast(err.response?.data?.message || 'Failed to resolve complaint', 'error'); return false; }
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

  useEffect(() => {
    setFilters(prev => ({ ...prev, search: urlSearch }));
    setPagination(p => ({ ...p, page: 1 }));
  }, [urlSearch]);

  useEffect(() => {
    fetchComplaints();
  }, [filters, pagination.page]);

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary font-poppins flex items-center gap-3">
              <span className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <FiMessageSquare className="text-primary" size={20} />
              </span>
              Complaint Management
            </h1>
            <p className="text-sm text-gray-400 mt-1 ml-13 pl-0.5">Monitor and manage all customer &amp; provider complaints</p>
          </div>
          <button
            onClick={fetchComplaints}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-secondary hover:text-primary border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-all font-semibold text-sm cursor-pointer shrink-0"
          >
            <FiRefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Complaints"
            value={pagination.total}
            icon={FiBarChart2}
            iconBg="bg-primary bg-opacity-10"
            iconColor="text-primary"
          />
          <StatsCard
            title="Customer Complaints"
            value={customerCount}
            icon={FiUser}
            iconBg="bg-blue-500 bg-opacity-10"
            iconColor="text-blue-600"
          />
          <StatsCard
            title="Provider Complaints"
            value={providerCount}
            icon={FiTool}
            iconBg="bg-purple-500 bg-opacity-10"
            iconColor="text-purple-600"
          />
          <StatsCard
            title="Pending"
            value={pendingCount}
            icon={FiClock}
            iconBg="bg-amber-500 bg-opacity-10"
            iconColor="text-amber-600"
          />
        </div>

        {/* ── Filters ── */}
        <AdminLocalFilterBar
          filters={filters}
          onChange={handleFilterChange}
          onClear={clearFilters}
          fields={[
            {
              key: 'userType',
              label: 'User Type',
              type: 'select',
              options: userTypeOptions
            },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: statusOptions
            },
            {
              key: 'providerId',
              label: 'Provider ID',
              type: 'text',
              placeholder: 'Provider ID...'
            }
          ]}
        />

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
                  {['#', 'Title & Category', 'User Type', 'Customer', 'Provider', 'Status', 'Recommendation', 'SLA Status', 'Date', 'Action'].map(h => (
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
                    <td colSpan="10" className="px-6 py-16 text-center">
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
                    const customerParty = c.userId || c.customer || c.booking?.customer;
                    const providerParty = c.providerId || c.provider || c.booking?.provider;
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
                          <p className="text-xs text-gray-450 truncate mt-0.5">{c.category || '—'}</p>
                        </td>
                        <td className="px-4 py-3.5"><TypeBadge type={actualUserType} /></td>
                        <td className="px-4 py-3.5 max-w-[140px]">
                          {customerParty ? (
                            <>
                              <p className="text-sm font-medium text-secondary truncate">
                                {customerParty.name || 'Unknown'}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {customerParty.email || '—'}
                              </p>
                            </>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5 max-w-[140px]">
                          {providerParty ? (
                            <>
                              <p className="text-sm font-medium text-secondary truncate">
                                {providerParty.name || 'Unknown'}
                              </p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {providerParty.email || '—'}
                              </p>
                            </>
                          ) : <span className="text-xs text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                        {/* Recommendation */}
                        <td className="px-4 py-3.5">
                          {c.recommendation ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              c.recommendation.action?.includes('refund') ? 'bg-green-50 text-green-700 border-green-200' :
                              c.recommendation.action?.includes('reject') ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {c.recommendation.action?.replace(/_/g, ' ')}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        {/* SLA Status */}
                        <td className="px-4 py-3.5">
                          {c.slaTracking ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              c.slaTracking.slaStatus === 'breached' ? 'bg-red-100 text-red-750 border-red-200' :
                              c.slaTracking.slaStatus === 'warning' ? 'bg-amber-100 text-amber-750 border-amber-200' :
                              'bg-green-100 text-green-750 border-green-200'
                            }`}>
                              {c.slaTracking.slaStatus === 'breached' ? 'Breached' : 'Within SLA'}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
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
  );
};

export default ComplaintsPage;