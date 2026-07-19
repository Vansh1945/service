// src/pages/admin/Refund.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import * as BookingService from '../../services/BookingService';
import {
  RefreshCw, Eye, CheckCircle, AlertCircle,
  User, Briefcase, Clock, X, Filter, Calendar, Inbox,
  DollarSign, XCircle, Lock, Unlock, ChevronRight, ChevronLeft
} from 'lucide-react';
import Pagination from '../../components/Pagination';
import StatsCard from '../../components/ui/StatsCard';
import { formatDate, formatDateTime } from '../../utils/format';
import CDNImage from '../../components/CDNImage';
import PriceDisplay from '../../components/PriceDisplay';
import { AdminLocalFilterBar } from '../../components/AdminFilterBar';

const refundOptions = [
  { value: 'all', label: 'All Cases' },
  { value: 'pending', label: 'Pending Refund' },
  { value: 'disputed', label: 'Disputes Only' },
  { value: 'completed', label: 'Approved Claims' },
  { value: 'rejected', label: 'Rejected Claims' },
  { value: 'held', label: 'Escrow Frozen' }
];
// ── Status Badges (Standardized Clean Designs) ────────────────────────
const RefundStatusBadge = ({ status }) => {
  const cfg = {
    pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    processing: 'bg-blue-50 text-blue-800 border-blue-200',
    refunded: 'bg-green-50 text-green-800 border-green-200',
    failed: 'bg-red-50 text-red-800 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg[status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
      {status}
    </span>
  );
};

const DisputeStatusBadge = ({ status }) => {
  const cfg = {
    none: 'bg-gray-50 text-gray-400 border-gray-100',
    pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    UNDER_REVIEW: 'bg-blue-50 text-blue-800 border-blue-200',
    resolved: 'bg-green-50 text-green-800 border-green-200',
    refunded: 'bg-green-50 text-green-800 border-green-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg[status] || 'bg-gray-50 text-gray-500 border-gray-250'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
};

const PayoutStatusBadge = ({ status }) => {
  const cfg = {
    'Payout On Hold': 'bg-orange-100 text-orange-700 border-orange-200',
    'Payout Ready': 'bg-green-100 text-green-700 border-green-200',
    'Payout Released': 'bg-blue-100 text-blue-700 border-blue-200',
    'Refund Adjusted': 'bg-gray-100 text-gray-500 border-gray-200',
    'Dispute Hold': 'bg-red-100 text-red-700 border-red-200',
    'Not Processed': 'bg-gray-50 text-gray-400 border-gray-100',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg[status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {status === 'Payout On Hold' || status === 'Dispute Hold' ? <Lock size={10} /> : <Unlock size={10} />}
      {status || 'Unknown'}
    </span>
  );
};

const RefundCaseTypeBadge = ({ booking }) => {
  const isComplaint = booking.complaint || booking.disputeRaised || (booking.disputeStatus && booking.disputeStatus !== 'none');
  const isCancellation = booking.status === 'cancelled';

  if (isComplaint) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
        Dispute Case
      </span>
    );
  } else if (isCancellation) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
        Cancelled Booking
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-650 border border-gray-200">
      General Refund
    </span>
  );
};

// ── Refund Details Modal (Overhauled Split-Screen View) ────────
const RefundDetailsModal = ({ booking, onClose, onAction }) => {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('images'); // 'images', 'timeline', 'financials'
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState(booking?.totalAmount || 0);
  const [decisionType, setDecisionType] = useState(''); // 'refund_full', 'refund_partial', 'reject'
  const [absorption, setAbsorption] = useState('shared'); // 'provider', 'platform', 'shared'
  const [updating, setUpdating] = useState(false);

  if (!booking) return null;

  const previouslyRefunded = booking?.cancellationProgress?.refundAmount || 0;
  const isFullyRefunded = booking?.paymentStatus === 'refunded' || booking?.adminRefundDecision === 'approved' || previouslyRefunded >= booking?.totalAmount;
  const complaintDetails = booking.fullData?.complaint || booking.complaint;
  const isEligible = complaintDetails ? (complaintDetails.isRefundEligible !== false) : true;

  const handleAction = async (action, type, extraOptions = {}) => {
    setUpdating(true);
    try {
      let res;
      if (action === 'refund') {
        res = await AdminService.processRefund(booking._id, {
          type,
          amount: type === 'partial' ? refundAmount : undefined,
          reason: resolutionNotes,
          absorption,
          ...extraOptions
        });
      } else if (action === 'reject') {
        res = await AdminService.rejectRefund(booking._id, { reason: resolutionNotes });
      } else if (action === 'hold') {
        res = await AdminService.togglePayoutHold(booking._id, { status: type });
      }

      if (res?.data?.success) {
        showToast(res.data.message || 'Action completed successfully', 'success');
        onAction();
        onClose();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Action failed', 'error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 md:p-6 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col animate-scale-up" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <DollarSign size={20} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-secondary">
                  {booking.services?.[0]?.service?.title || 'Refund Case Details'}
                </h3>
                <RefundCaseTypeBadge booking={booking} />
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-xs text-gray-400 font-mono">ID: {booking.bookingId || `#${booking._id?.slice(-8).toUpperCase()}`}</p>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                <button
                  onClick={() => window.open(`/admin/bookings?search=${booking.bookingId || booking._id}`, '_blank')}
                  className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded font-semibold transition-colors flex items-center gap-1"
                >
                  Inspect Booking <ChevronRight size={10} />
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-secondary hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Split Columns */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

          {/* Left Area (60% width) - Detailed Info & Evidence Locker */}
          <div className="lg:w-7/12 flex-1 overflow-y-auto p-5 space-y-5 border-r border-gray-100">

            {/* SLA & AI Recommendation Advisory Panel */}
            {(() => {
              const complaintDetails = booking.fullData?.complaint || booking.complaint;
              if (!complaintDetails) return null;
              return (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-blue-900 flex items-center gap-1.5 uppercase tracking-wider">
                      <AlertCircle size={14} className="text-blue-600" /> SLA Tracking &amp; AI Advisory
                    </h4>
                    <div className="flex items-center gap-2">
                      {complaintDetails.slaTracking && (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                          complaintDetails.slaTracking.slaStatus === 'breached' 
                            ? 'bg-red-100 text-red-700 border-red-200' 
                            : complaintDetails.slaTracking.slaStatus === 'warning' 
                              ? 'bg-amber-100 text-amber-700 border-amber-200' 
                              : 'bg-green-100 text-green-700 border-green-200'
                        }`}>
                          {complaintDetails.slaTracking.slaStatus === 'breached' ? '⚠️ BREACHED' : 'WITHIN SLA'}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase border bg-amber-100 text-amber-700 border-amber-200">
                        Advisory Only
                      </span>
                    </div>
                  </div>
                  {/* Advisory Disclaimer */}
                  <p className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                    ⚠️ Recommendations are advisory only. Final decision requires explicit admin approval. No automatic actions are performed.
                  </p>

                  {complaintDetails.slaTracking && (
                    <div className="space-y-1 bg-white p-2.5 rounded border border-blue-100/50">
                      <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
                        <span>Stage: <span className="uppercase text-blue-800 font-bold">{complaintDetails.slaTracking.stage}</span></span>
                        <span>{complaintDetails.slaTracking.hoursElapsed}h elapsed / {complaintDetails.slaTracking.slaThresholdHours}h limit</span>
                      </div>
                      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            complaintDetails.slaTracking.slaStatus === 'breached' ? 'bg-red-500' :
                            complaintDetails.slaTracking.slaStatus === 'warning' ? 'bg-amber-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${complaintDetails.slaTracking.percentageUsed}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {complaintDetails.recommendation && (
                    <div className="bg-white p-3 rounded-lg border border-blue-100 space-y-2 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-gray-105 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Suggested Action:</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            ['approve_refund', 'refund', 'full_refund', 'partial_refund'].includes(complaintDetails.recommendation.action) ? 'bg-green-50 text-green-700 border border-green-200' :
                            ['reject_refund', 'reject'].includes(complaintDetails.recommendation.action) ? 'bg-red-50 text-red-700 border border-red-200' :
                            'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {complaintDetails.recommendation.action.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-gray-500">
                          Confidence: <span className="text-blue-600 font-extrabold">{complaintDetails.recommendation.confidenceLevel} ({complaintDetails.recommendation.confidence}%)</span>
                        </span>
                      </div>

                      {complaintDetails.recommendation.reasons?.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Reasons:</span>
                          <ul className="list-disc pl-4 text-[11px] text-gray-650 space-y-0.5">
                            {complaintDetails.recommendation.reasons.map((r, i) => (
                              <li key={i}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {complaintDetails.recommendation.contraIndicators?.length > 0 && (
                        <div className="space-y-0.5 border-t border-dashed border-gray-150 pt-1.5">
                          <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider block">Contra Indicators:</span>
                          <ul className="list-disc pl-4 text-[11px] text-red-650 space-y-0.5">
                            {complaintDetails.recommendation.contraIndicators.map((ci, i) => (
                              <li key={i}>{ci}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* User Profile Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-150 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-sm border border-teal-150/50">
                  {booking.customer?.name?.charAt(0) || <User size={16} />}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Customer Details</span>
                  <p className="text-sm font-bold text-secondary">{booking.customer?.name}</p>
                  <p className="text-xs text-gray-500 font-medium truncate max-w-[180px]">{booking.customer?.email}</p>
                </div>
              </div>

              {/* Provider */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-150 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm border border-blue-150/50">
                  {booking.provider?.name?.charAt(0) || <Briefcase size={16} />}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Provider Details</span>
                  <p className="text-sm font-bold text-secondary">{booking.provider?.name || 'Unassigned'}</p>
                  <p className="text-xs text-gray-500 font-medium truncate max-w-[180px]">{booking.provider?.email || 'No email registered'}</p>
                </div>
              </div>
            </div>

            {/* Financial Status Summary banner */}
            <div className="bg-teal-50/20 p-4 rounded-lg border border-teal-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Transaction Value</span>
                <p className="text-2xl font-bold text-primary mt-1">
                  <PriceDisplay amount={booking.totalAmount} type="2xl-bold-primary" />
                </p>
              </div>
              <div className="flex gap-6 text-xs font-semibold">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-0.5">Payment Method</span>
                  <span className="text-secondary font-bold uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px] inline-block">{booking.paymentMethod}</span>
                </div>
                {isFullyRefunded && (
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400 block mb-0.5">Refund Channel</span>
                    <span className="text-purple-600 font-bold uppercase tracking-wider bg-purple-50 px-2 py-0.5 rounded border border-purple-100 text-[11px] inline-block">Wallet</span>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-6 border-b border-gray-100">
              {[
                { id: 'images', label: 'Evidence Locker', count: (booking.providerWorkProof?.beforeImages?.length || 0) + (booking.providerWorkProof?.afterImages?.length || 0) + (booking.complaintProofs?.length || 0) },
                { id: 'timeline', label: 'Case Timeline' },
                { id: 'financials', label: 'Gateway & Ledger' }
              ].map(t => (
                <button
                  key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`pb-3 text-sm font-semibold transition-all duration-200 border-b-2 flex items-center gap-1.5 ${activeTab === t.id
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-gray-450 hover:text-gray-600'
                    }`}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-primary/10 text-primary font-bold' : 'bg-gray-100 text-gray-400'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content 1: Images & Evidence Gallery */}
            {activeTab === 'images' && (
              <div className="space-y-5 animate-fade-in">
                {/* Proof comparison grids */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm" /> Before Service Proof
                    </h4>
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 min-h-[120px] flex items-center justify-center">
                      {booking.providerWorkProof?.beforeImages?.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 w-full">
                          {booking.providerWorkProof.beforeImages.map((img, i) => (
                            <CDNImage
                              key={i}
                              src={img.url}
                              alt="Before"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              containerClassName="relative group overflow-hidden rounded-lg h-20 bg-black/5 border border-gray-100"
                              previewable={true}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No before images uploaded</p>
                      )}
                    </div>
                  </div>

                  {/* After */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-sm" /> After Service Proof
                    </h4>
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 min-h-[120px] flex items-center justify-center">
                      {booking.providerWorkProof?.afterImages?.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2 w-full">
                          {booking.providerWorkProof.afterImages.map((img, i) => (
                            <CDNImage
                              key={i}
                              src={img.url}
                              alt="After"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              containerClassName="relative group overflow-hidden rounded-lg h-20 bg-black/5 border border-gray-100"
                              previewable={true}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No after images uploaded</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Complaint Proof evidence list */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm" /> Customer Claims & Evidence
                  </h4>
                  <div className="space-y-3">
                    {booking.complaintProofs?.filter(p => p.uploadedBy === 'customer').map((proof, i) => (
                      <div key={i} className="bg-red-50/20 border border-red-100/40 p-3 rounded-lg space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 border-b border-red-100/25 pb-2">
                          <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded">Uploaded by Customer</span>
                          <span>{formatDateTime(proof.createdAt)}</span>
                        </div>
                        {proof.images?.length > 0 && (
                          <div className="grid grid-cols-4 gap-2">
                            {proof.images.map((img, j) => (
                              <CDNImage
                                key={j}
                                src={img.url}
                                alt="Complaint Proof"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                containerClassName="relative group overflow-hidden rounded-lg h-16 bg-black/5 border border-gray-100"
                                previewable={true}
                              />
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-600 bg-white/70 p-2.5 rounded border border-gray-100/50 leading-relaxed italic">"{proof.message}"</p>
                      </div>
                    ))}
                    {(!booking.complaintProofs || booking.complaintProofs.filter(p => p.uploadedBy === 'customer').length === 0) && (
                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center text-xs text-gray-400 italic">
                        No customer dispute evidence uploaded
                      </div>
                    )}
                  </div>
                </div>

                {/* Provider Responses list */}
                <div className="space-y-3 pt-1">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-sm" /> Provider Response Counter-Claims
                  </h4>
                  <div className="space-y-3">
                    {booking.complaintProofs?.filter(p => p.uploadedBy === 'provider').map((proof, i) => (
                      <div key={i} className="bg-purple-50/20 border border-purple-100/40 p-3 rounded-lg space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 border-b border-purple-100/25 pb-2">
                          <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Uploaded by Provider</span>
                          <span>{formatDateTime(proof.createdAt)}</span>
                        </div>
                        {proof.images?.length > 0 && (
                          <div className="grid grid-cols-4 gap-2">
                            {proof.images.map((img, j) => (
                              <CDNImage
                                key={j}
                                src={img.url}
                                alt="Provider Response Proof"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                containerClassName="relative group overflow-hidden rounded-lg h-16 bg-black/5 border border-gray-100"
                                previewable={true}
                              />
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-600 bg-white/70 p-2.5 rounded border border-gray-100/50 leading-relaxed italic">"{proof.message}"</p>
                      </div>
                    ))}
                    {(!booking.complaintProofs || booking.complaintProofs.filter(p => p.uploadedBy === 'provider').length === 0) && (
                      <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center text-xs text-gray-400 italic">
                        No response counter-claims uploaded by provider
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Tab content 2: Case Timeline */}
            {activeTab === 'timeline' && (
              <div className="space-y-6 animate-fade-in pl-4 border-l border-gray-100 ml-3 py-2">
                {[
                  { label: 'Booking Registered', date: booking.createdAt, icon: Clock, color: 'text-gray-450 bg-gray-50 border-gray-200' },
                  { label: 'Provider Commenced Service', date: booking.serviceStartedAt || booking.startedAt, icon: Briefcase, color: 'text-blue-500 bg-blue-50 border-blue-200' },
                  { label: 'Job Marked Completed', date: booking.serviceCompletedAt || booking.completedAt, icon: CheckCircle, color: 'text-green-500 bg-green-50 border-green-200' },
                  { label: 'Dispute / Claim Registered', date: booking.complaintProofs?.find(p => p.uploadedBy === 'customer')?.createdAt || booking.complaint?.createdAt, icon: AlertCircle, color: 'text-red-500 bg-red-50 border-red-200' },
                  { label: 'Provider Countersued', date: booking.complaintProofs?.find(p => p.uploadedBy === 'provider')?.createdAt, icon: User, color: 'text-purple-500 bg-purple-50 border-purple-200' },
                  { label: 'Admin Refund Action', date: booking.cancellationProgress?.refundCompletedAt, icon: DollarSign, color: 'text-primary bg-primary/10 border-primary/20' },
                  { label: 'Escrow Earnings Adjustment', date: (booking.fullData?.earningHoldStatus === 'available' || booking.fullData?.earningHoldStatus === 'paid' || booking.fullData?.earningHoldStatus === 'withdrawn') ? (booking.fullData?.payoutHoldUntil || booking.updatedAt) : null, icon: Unlock, color: 'text-blue-500 bg-blue-50 border-blue-200' },
                ].filter(t => t.date).map((item, i) => (
                  <div key={i} className="relative flex items-center gap-4 group text-gray-700">
                    <div className="absolute -left-[21px] w-2.5 h-2.5 rounded-full bg-white border-2 border-gray-300 group-hover:border-primary transition-colors" />

                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border shadow-sm ${item.color}`}>
                      <item.icon size={15} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-secondary">{item.label}</p>
                      <p className="text-[10px] text-gray-400 font-semibold">{formatDateTime(item.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab content 3: Gateway & Ledger */}
            {activeTab === 'financials' && booking.fullData && (
              <div className="space-y-4 animate-fade-in py-1">

                {/* Hold status info card */}
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    <Lock className="text-amber-500 w-3.5 h-3.5" /> Payout Holding Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-semibold text-secondary">
                    <div className="bg-white p-2.5 rounded border border-gray-200/50">
                      <span className="text-[10px] text-gray-400 uppercase block mb-1">Escrow Earning Status</span>
                      <span className="font-bold text-sm capitalize">{booking.fullData.earningHoldStatus}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-gray-200/50">
                      <span className="text-[10px] text-gray-400 uppercase block mb-1">Payout Lock Release Date</span>
                      <span className="font-bold text-sm">{booking.fullData.payoutHoldUntil ? formatDateTime(booking.fullData.payoutHoldUntil) : 'No lock date set'}</span>
                    </div>
                  </div>
                </div>

                {/* Transactions breakdown */}
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                    <DollarSign className="text-green-600 w-3.5 h-3.5" /> Payment & Transaction Ledger
                  </h4>
                  {booking.fullData.transactions?.length > 0 ? (
                    <div className="space-y-2">
                      {booking.fullData.transactions.map((tx, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border border-gray-200 flex flex-col gap-2">
                          <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
                            <span className="text-xs font-mono font-bold text-secondary">{tx.transactionId || 'No Gateway ID'}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${tx.paymentStatus === 'refunded'
                              ? 'bg-red-50 text-red-600 border-red-100'
                              : 'bg-green-50 text-green-755 border-green-100'
                              }`}>
                              {tx.paymentStatus}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-medium text-gray-500">
                            <span className="uppercase tracking-wider text-[10px] bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{tx.paymentMethod}</span>
                            <span className="font-bold text-secondary text-sm">
                              <PriceDisplay amount={tx.amount} type="bold-secondary" />
                            </span>
                          </div>
                          {tx.refundStatus && tx.refundStatus !== 'none' && (
                            <div className="mt-1 pt-1.5 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-semibold">
                              <span>Refund State: <span className="font-bold text-red-500 uppercase">{tx.refundStatus}</span></span>
                              {tx.refundedAmount > 0 && (
                                <span className="text-gray-650">
                                  Refunded: <PriceDisplay amount={tx.refundedAmount} type="bold-secondary" />
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white p-5 rounded border border-gray-200/50 text-center text-xs text-gray-400 italic">
                      No transaction records registered.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Area (40% width) - Interactive Action Panel / Control Center */}
          <div className="lg:w-5/12 bg-gray-50/50 p-5 flex flex-col justify-between overflow-y-auto space-y-5">

            <div className="space-y-5">

              {/* Box Header */}
              <div>
                <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                  <AlertCircle className="text-accent w-4 h-4" /> Case Resolution Controls
                </h4>
                <p className="text-xs text-gray-450 mt-0.5">Determine the refund eligibility and update status instantly.</p>
              </div>

              {/* Status Spec Grid (FIX 7 Consolidated) */}
              <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm grid grid-cols-3 gap-4 text-center text-xs">
                <div className="space-y-1">
                  <span className="text-gray-400 font-bold block text-[10px] uppercase">Booking Status</span>
                  <RefundStatusBadge status={booking.paymentStatus} />
                </div>
                <div className="space-y-1 border-x border-gray-100">
                  <span className="text-gray-400 font-bold block text-[10px] uppercase">Payout Escrow</span>
                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${booking.earningHoldStatus === 'cancelled' || booking.payoutStatus === 'Refund Adjusted'
                    ? 'bg-red-50 text-red-700 border-red-100'
                    : booking.earningHoldStatus === 'available' || booking.payoutStatus === 'Payout Ready'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }`}>
                    {booking.payoutStatus || 'Pending Hold'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-400 font-bold block text-[10px] uppercase">Refund Judgment</span>
                  <span className="font-extrabold text-primary text-[10px] uppercase block mt-0.5">
                    {booking.adminRefundDecision === 'approved'
                      ? 'Full Approved'
                      : booking.adminRefundDecision === 'partial'
                        ? 'Partial Approved'
                        : booking.adminRefundDecision === 'rejected'
                          ? 'Denied'
                          : 'Awaiting Decision'}
                  </span>
                </div>
              </div>

              {/* Action Form */}
              <div className="space-y-3.5">

                {/* Decision Type Buttons Cards */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select Judgment Option</label>
                  {!isEligible && (
                    <div className="bg-red-50 border border-red-150 text-red-700 p-2.5 rounded-lg text-xs font-semibold">
                      ⚠️ Refund Blocked: Category classified as Non-Refund Support Ticket.
                    </div>
                  )}
                  {isFullyRefunded ? (
                    <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-center text-xs font-semibold text-green-700">
                      This case has already been resolved and refunded. No additional decisions can be made.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'refund_full', label: 'Full Refund', color: 'border-green-200 text-green-600 hover:bg-green-50/50', activeColor: 'bg-green-50 border-green-500 text-green-700' },
                        { id: 'refund_partial', label: 'Partial', color: 'border-primary/20 text-primary hover:bg-primary/5', activeColor: 'bg-primary/10 border-primary text-primary' },
                        { id: 'reject', label: 'Reject Claim', color: 'border-red-200 text-red-600 hover:bg-red-50/50', activeColor: 'bg-red-50 border-red-500 text-red-700' }
                      ].filter(opt => isEligible || opt.id === 'reject').map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setDecisionType(opt.id);
                            if (opt.id === 'refund_full') {
                              setRefundAmount(booking.totalAmount);
                            }
                          }}
                          className={`py-2 px-1 rounded-lg border text-xs font-bold transition-all duration-200 text-center cursor-pointer ${decisionType === opt.id ? opt.activeColor : `bg-white ${opt.color}`
                            }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Partial Refund Input fields */}
                {decisionType === 'refund_partial' && !isFullyRefunded && (
                  <div className="space-y-1 animate-slide-up">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex justify-between">
                      <span>Refund Amount (₹)</span>
                      <span className="text-gray-500">Max: ₹{booking.totalAmount}</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                      <input
                        type="number"
                        value={refundAmount}
                        max={booking.totalAmount}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (val > booking.totalAmount) {
                            setRefundAmount(booking.totalAmount);
                          } else {
                            setRefundAmount(val);
                          }
                        }}
                        className="w-full pl-8 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        placeholder="Amount to refund"
                      />
                    </div>
                  </div>
                )}

                {/* Absorption Classification */}
                {!isFullyRefunded && (decisionType === 'refund_full' || decisionType === 'refund_partial') && (
                  <div className="space-y-2 animate-slide-up">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Refund Absorption Classification</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'shared', label: 'Shared Split', desc: 'Proportional ratio' },
                        { id: 'platform', label: 'Platform Absorbed', desc: '100% Platform loss' },
                        { id: 'provider', label: 'Provider Absorbed', desc: '100% Vendor loss' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAbsorption(opt.id)}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition-all duration-200 ${absorption === opt.id
                            ? 'bg-purple-50 border-purple-500 text-purple-700 ring-1 ring-purple-500'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                          <p className="text-xs font-bold">{opt.label}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5 font-medium leading-none">{opt.desc}</p>
                        </button>
                      ))}
                    </div>

                    {/* Negative Balance Warning Banner (FIX 4) */}
                    {absorption === 'provider' && booking.provider?.wallet?.availableBalance < refundAmount && (
                      <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-medium mt-2 flex items-start gap-1.5 animate-pulse">
                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>
                          <strong>Warning:</strong> Refunding ₹{refundAmount} fully from the provider will push their wallet into a negative balance (Current: ₹{booking.provider?.wallet?.availableBalance || 0}).
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Refund Impact Preview */}
                {(decisionType === 'refund_full' || decisionType === 'refund_partial') && !isFullyRefunded && (() => {
                  const grossBilled = booking.totalAmount || 0;
                  const originalProvider = booking.providerEarnings || 0;
                  const originalPlatform = (booking.commissionAmount || 0) + (booking.companySurgeShare || 0);

                  let providerLoss = 0;
                  let platformLoss = 0;

                  if (absorption === 'platform') {
                    providerLoss = 0;
                    platformLoss = refundAmount;
                  } else if (absorption === 'provider') {
                    providerLoss = Math.min(originalProvider, refundAmount);
                    platformLoss = Math.max(0, refundAmount - providerLoss);
                  } else {
                    // Shared proportional
                    const ratio = refundAmount / (grossBilled || 1);
                    providerLoss = parseFloat((originalProvider * ratio).toFixed(2));
                    platformLoss = parseFloat((refundAmount - providerLoss).toFixed(2));
                  }

                  const statusLower = (booking.fullData?.earningHoldStatus || booking.payoutStatus || '').toLowerCase();
                  const isHeld = ['held', 'under_review', 'payout on hold', 'dispute hold'].some(s => statusLower.includes(s));
                  const isEscrow = ['available', 'pending_release', 'payout ready'].some(s => statusLower.includes(s));
                  const isPaid = ['paid', 'withdrawn', 'payout released', 'released'].some(s => statusLower.includes(s));

                  let heldEarningsRecovered = 0;
                  let pendingReleaseRecovered = 0;
                  let availableRecovered = 0;
                  let providerWalletRecovered = 0;
                  let platformAbsorptionAmt = platformLoss;

                  if (isHeld) {
                    heldEarningsRecovered = providerLoss;
                  } else if (statusLower.includes('pending')) {
                    pendingReleaseRecovered = providerLoss;
                  } else if (isEscrow) {
                    availableRecovered = providerLoss;
                  } else if (isPaid) {
                    providerWalletRecovered = providerLoss;
                  } else {
                    providerWalletRecovered = providerLoss;
                  }

                  return (
                    <details className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-xs animate-slide-up group" open>
                      <summary className="font-bold text-secondary uppercase tracking-wider text-[9px] cursor-pointer select-none outline-none flex justify-between items-center">
                        <span>Financial Loss Recovery Path Preview</span>
                        <span className="text-primary group-open:hidden text-[10px]">Show Details</span>
                        <span className="text-primary hidden group-open:inline text-[10px]">Hide Details</span>
                      </summary>
                      <div className="mt-3 space-y-3">
                        {/* Simulation panel */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center border-b border-gray-100 pb-2">
                          <div className="bg-green-50 p-2 rounded">
                            <p className="text-[9px] text-green-700 font-bold uppercase">Customer Receives</p>
                            <p className="font-extrabold text-sm text-green-800">₹{refundAmount.toFixed(2)}</p>
                          </div>
                          <div className="bg-red-50 p-2 rounded">
                            <p className="text-[9px] text-red-700 font-bold uppercase">Provider Recovery</p>
                            <p className="font-extrabold text-sm text-red-800">₹{providerLoss.toFixed(2)}</p>
                          </div>
                          <div className="bg-purple-50 p-2 rounded">
                            <p className="text-[9px] text-purple-700 font-bold uppercase">Platform Absorbs</p>
                            <p className="font-extrabold text-sm text-purple-800">₹{platformAbsorptionAmt.toFixed(2)}</p>
                          </div>
                          <div className="bg-blue-50 p-2 rounded">
                            <p className="text-[9px] text-blue-700 font-bold uppercase">Total Refund</p>
                            <p className="font-extrabold text-sm text-blue-800">₹{refundAmount.toFixed(2)}</p>
                          </div>
                        </div>

                        {/* Recovery Source Breakdown */}
                        <div className="bg-white p-2 rounded border border-gray-100 space-y-1.5">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Recovery Source Allocations</p>
                          
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Held Earnings:</span>
                            <span className={`font-bold ${heldEarningsRecovered > 0 ? 'text-green-600' : 'text-gray-400'}`}>₹{heldEarningsRecovered.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Pending Release Escrow:</span>
                            <span className={`font-bold ${pendingReleaseRecovered > 0 ? 'text-green-600' : 'text-gray-400'}`}>₹{pendingReleaseRecovered.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Available Escrow:</span>
                            <span className={`font-bold ${availableRecovered > 0 ? 'text-green-600' : 'text-gray-400'}`}>₹{availableRecovered.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-500 font-medium">Paid/Withdrawn (Provider Wallet):</span>
                            <span className={`font-bold ${providerWalletRecovered > 0 ? 'text-red-650' : 'text-gray-400'}`}>₹{providerWalletRecovered.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between text-[11px] border-t border-dashed border-gray-150 pt-1">
                            <span className="text-gray-500 font-medium">Platform Absorption:</span>
                            <span className={`font-bold ${platformAbsorptionAmt > 0 ? 'text-purple-600' : 'text-gray-400'}`}>₹{platformAbsorptionAmt.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </details>
                  );
                })()}

                {/* Notes Input Area */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resolution Remarks / Remark Log</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    disabled={isFullyRefunded}
                    className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none h-24 disabled:bg-gray-100 disabled:text-gray-400"
                    placeholder="Provide professional auditing rationale for this decision..."
                  />
                </div>

              </div>

            </div>

            {/* Form actions and controls buttons */}
            <div className="space-y-3 pt-3 border-t border-gray-100">

              {/* Submit Main Action button */}
              <button
                onClick={() => {
                  const payloadOptions = absorption === 'platform' ? { absorbPlatformCommission: true } : {};
                  if (decisionType === 'refund_full') handleAction('refund', 'full', payloadOptions);
                  else if (decisionType === 'refund_partial') handleAction('refund', 'partial', payloadOptions);
                  else if (decisionType === 'reject') handleAction('reject');
                }}
                disabled={updating || !decisionType || isFullyRefunded}
                className="w-full py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {updating && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full "></div>}
                {updating ? 'Recording Decision...' : (isFullyRefunded ? 'Resolved & Closed' : 'Execute System Decision')}
              </button>

              {/* Provider Payout hold toggles switch */}
              {!isFullyRefunded && (
                <details className="bg-gray-50 border border-gray-100 p-3 rounded-lg space-y-2 group">
                  <summary className="font-bold text-orange-600 uppercase tracking-wider text-[10px] cursor-pointer select-none outline-none flex justify-between items-center">
                    <span>Security Escalation Control</span>
                    <span className="text-orange-500 group-open:hidden text-[10px]">Show Controls</span>
                    <span className="text-orange-500 hidden group-open:inline text-[10px]">Hide Controls</span>
                  </summary>
                  <div className="mt-2 space-y-2">
                    <span className="text-[10px] text-gray-400 block">Freeze or release vendor's escrow payout immediately.</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleAction('hold', 'held')}
                        disabled={updating || booking.earningHoldStatus === 'held'}
                        className="py-1.5 bg-orange-50 border border-orange-100 hover:bg-orange-100 text-orange-700 disabled:opacity-40 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Lock size={10} /> Hold Escrow
                      </button>
                      <button
                        onClick={() => handleAction('hold', 'available')}
                        disabled={updating || booking.earningHoldStatus === 'available'}
                        className="py-1.5 bg-green-50 border border-green-100 hover:bg-green-100 text-green-700 disabled:opacity-40 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Unlock size={10} /> Release Escrow
                      </button>
                    </div>
                  </div>
                </details>
              )}
              {/* Display admin remarks logs if available */}
              {booking.adminRemark && (
                <div className="bg-gray-105 p-3 rounded-lg border border-gray-200/50 space-y-1">
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Audit Log Remarks</span>
                  <p className="text-[10px] italic leading-relaxed text-gray-500 font-medium">"{booking.adminRemark}"</p>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>


    </div>
  );
};

const RefundPage = () => {
  const { showToast } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [statsSummary, setStatsSummary] = useState({ processedRefunds: 0, escrowHolds: 0, activeDisputes: 0 });

  const fetchRefundBookings = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        forRefunds: true,
        refundStatus: filterStatus
      };

      const res = await BookingService.getAllBookings(params);
      if (res.data?.success) {
        setBookings(res.data.data || []);
        setPagination(p => ({
          ...p,
          total: res.data.total || 0,
          pages: res.data.pages || 1
        }));
        if (res.data.refundStats) {
          setStatsSummary(res.data.refundStats);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to fetch refund cases', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handleFilterChange = (status) => {
    setFilterStatus(status);
    setPagination(p => ({ ...p, page: 1 }));
  };

  const handleViewDetails = async (id) => {
    try {
      const res = await BookingService.getBookingDetails(id);
      if (res.data?.success) {
        setSelectedBooking({
          ...res.data.data.booking,
          fullData: res.data.data
        });
      }
    } catch (err) {
      console.error(err);
      showToast('Error loading details', 'error');
    }
  };

  useEffect(() => {
    fetchRefundBookings();
  }, [pagination.page, searchTerm, filterStatus]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Refunds & Escrow Ledger</h1>
            <p className="text-sm text-gray-550 mt-1">Audit dispute claims, process customer wallet refunds, and resolve vendor escrow lockouts.</p>
          </div>
          <button
            onClick={fetchRefundBookings}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-secondary hover:text-primary border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-all font-semibold text-sm cursor-pointer shrink-0"
          >
            <RefreshCw size={14} className="stroke-[2.5]" /> Sync Data
          </button>
        </div>

        {/* Stats Section with dynamic card deck */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
          <StatsCard
            title="Processed Refunds"
            value={statsSummary.processedRefunds}
            icon={DollarSign}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            className="border-l-4 border-emerald-500 shadow-md p-4 md:p-6"
          />

          <StatsCard
            title="Active Escrow Holds"
            value={statsSummary.escrowHolds}
            icon={Lock}
            iconBg="bg-yellow-50"
            iconColor="text-yellow-600"
            className="border-l-4 border-yellow-500 shadow-md p-4 md:p-6"
          />

          <StatsCard
            title="Active Claims & Disputes"
            value={statsSummary.activeDisputes}
            icon={AlertCircle}
            iconBg="bg-red-50"
            iconColor="text-red-655"
            className="border-l-4 border-red-500 shadow-md p-4 md:p-6"
          />
        </div>

        {/* Console Filter deck */}
        <AdminLocalFilterBar
          filters={{ refundStatus: filterStatus }}
          onChange={(key, value) => handleFilterChange(value)}
          onClear={() => handleFilterChange('all')}
          fields={[
            {
              key: 'refundStatus',
              label: 'Refund Status',
              type: 'select',
              options: refundOptions
            }
          ]}
        />

        {/* Data Grid table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    'Booking ID', 'Refund Type', 'Service', 'Customer', 'Provider', 'Amount',
                    'Status', 'SLA Status', 'Recommendation', 'Date', 'Action'
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-4">
                      <div className="space-y-4 p-4 animate-pulse">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-10 bg-slate-100 rounded-xl w-full" />
                        ))}
                      </div>
                    </td>
                  </tr>
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-16 text-center text-gray-400">
                      <div className="w-12 h-12 bg-gray-50 text-gray-300 rounded-lg flex items-center justify-center mx-auto mb-3 border border-gray-100">
                        <Inbox size={22} className="stroke-[2]" />
                      </div>
                      <p className="font-bold text-sm text-secondary">No matching refund cases found</p>
                      <p className="text-xs text-gray-550 mt-1">Refine your active search criteria or toggle the filter status pills.</p>
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b._id} className="hover:bg-gray-50/40 transition-colors group">

                      {/* Booking ID */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold text-secondary truncate max-w-[130px] block">
                          #{b.bookingId || b._id?.slice(-8).toUpperCase()}
                        </span>
                      </td>

                      {/* Refund Type — NEW COLUMN */}
                      <td className="px-4 py-3.5">
                        <RefundCaseTypeBadge booking={b} />
                      </td>

                      {/* Service Name — NEW COLUMN */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold text-secondary truncate max-w-[130px] block" title={b.services?.[0]?.service?.title}>
                          {b.services?.[0]?.service?.title || <span className="text-gray-400 italic text-[10px]">—</span>}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-650 flex items-center justify-center font-bold text-[11px] border border-teal-100/50 shrink-0">
                            {b.customer?.name?.charAt(0) || <User size={10} />}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-secondary truncate max-w-[100px]">{b.customer?.name || '—'}</p>
                            <p className="text-[9px] text-gray-400 truncate max-w-[100px]">{b.customer?.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Provider */}
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium text-gray-600 truncate max-w-[110px] block">{b.provider?.name || <span className="text-gray-350 italic text-[10px]">Unassigned</span>}</span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5">
                        <PriceDisplay amount={b.totalAmount} type="bold-secondary" />
                      </td>

                      {/* Payment / Refund Status */}
                      <td className="px-4 py-3.5">
                        <RefundStatusBadge status={b.paymentStatus} />
                      </td>

                      {/* SLA Status Column */}
                      <td className="px-4 py-3.5">
                        {b.complaint?.slaTracking ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            b.complaint.slaTracking.slaStatus === 'breached' 
                              ? 'bg-red-50 text-red-800 border-red-200' 
                              : b.complaint.slaTracking.slaStatus === 'warning'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-green-50 text-green-800 border-green-200'
                          }`}>
                            {b.complaint.slaTracking.slaStatus === 'breached' ? 'Breached' : 'Within SLA'}
                          </span>
                        ) : (
                          <span className="text-gray-350 italic text-[10px]">—</span>
                        )}
                      </td>

                      {/* Recommendation Column */}
                      <td className="px-4 py-3.5">
                        {b.complaint?.recommendation ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                              ['approve_refund', 'refund', 'full_refund', 'partial_refund'].includes(b.complaint.recommendation.action) ? 'bg-green-50 text-green-850 border-green-200' :
                              ['reject_refund', 'reject'].includes(b.complaint.recommendation.action) ? 'bg-red-50 text-red-850 border-red-200' :
                              'bg-blue-50 text-blue-850 border-blue-200'
                            }`}>
                              {b.complaint.recommendation.action.replace('_', ' ')}
                            </span>
                            <span className="text-[9px] text-amber-600 font-semibold">Advisory Only</span>
                          </div>
                        ) : (
                          <span className="text-gray-350 italic text-[10px]">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3.5 text-[10px] text-gray-400 font-semibold whitespace-nowrap">
                        {formatDate(b.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => handleViewDetails(b._id)}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            limit={pagination.limit}
            onPageChange={page => setPagination(p => ({ ...p, page }))}
          />
        </div>
      </div>

      {/* Modal */}
      {selectedBooking && (
        <RefundDetailsModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onAction={fetchRefundBookings}
        />
      )}
    </div>
  );
};

export default RefundPage;

