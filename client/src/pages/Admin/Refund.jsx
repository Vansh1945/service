// src/pages/admin/Refund.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import * as BookingService from '../../services/BookingService';
import {
  FiSearch, FiRefreshCw, FiEye, FiCheckCircle, FiAlertTriangle,
  FiUser, FiTool, FiClock, FiX, FiFilter, FiCalendar, FiInbox,
  FiDollarSign, FiSlash, FiLock, FiUnlock, FiChevronRight, FiChevronLeft
} from 'react-icons/fi';
import Pagination from '../../components/Pagination';
import { formatDate, formatDateTime } from '../../utils/format';

// ── Status Badges ──────────────────────────────────────────────
const RefundStatusBadge = ({ status }) => {
  const cfg = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    processing: 'bg-blue-100 text-blue-700 border-blue-200',
    refunded: 'bg-green-100 text-green-700 border-green-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg[status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {status}
    </span>
  );
};

const DisputeStatusBadge = ({ status }) => {
  const cfg = {
    none: 'bg-gray-100 text-gray-400 border-gray-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    UNDER_REVIEW: 'bg-blue-100 text-blue-700 border-blue-200',
    resolved: 'bg-green-100 text-green-700 border-green-200',
    refunded: 'bg-green-100 text-green-700 border-green-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg[status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
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
      {status === 'Payout On Hold' || status === 'Dispute Hold' ? <FiLock size={10} /> : <FiUnlock size={10} />}
      {status || 'Unknown'}
    </span>
  );
};

// ── Refund Details Modal ───────────────────────────────────────
const RefundDetailsModal = ({ booking, onClose, onAction }) => {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('images');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState(booking?.totalAmount || 0);
  const [decisionType, setDecisionType] = useState('');
  const [updating, setUpdating] = useState(false);

  if (!booking) return null;

  const previouslyRefunded = booking?.cancellationProgress?.refundAmount || 0;
  const isFullyRefunded = booking?.paymentStatus === 'refunded' || booking?.adminRefundDecision === 'approved' || previouslyRefunded >= booking?.totalAmount;

  const handleAction = async (action, type) => {
    setUpdating(true);
    try {
      let res;
      if (action === 'refund') {
        res = await AdminService.processRefund(booking._id, {
          type,
          amount: type === 'partial' ? refundAmount : undefined,
          reason: resolutionNotes
        });
      } else if (action === 'reject') {
        res = await AdminService.rejectRefund(booking._id, { reason: resolutionNotes });
      } else if (action === 'hold') {
        res = await AdminService.togglePayoutHold(booking._id, { status: type });
      }

      if (res?.data?.success) {
        showToast(res.data.message || 'Action completed', 'success');
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col animate-scale-up" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <FiDollarSign size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-secondary">{booking.services?.[0]?.service?.title || 'Dispute Details'}</h3>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">Booking ID: {booking.bookingId || `#${booking._id?.slice(-8).toUpperCase()}`}</p>
                <button 
                  onClick={() => window.open(`/admin/bookings?search=${booking.bookingId || booking._id}`, '_blank')}
                  className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-100 font-bold"
                >
                  View in Bookings
                </button>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <FiX className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Details & Images */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Customer</p>
                  <p className="text-sm font-bold text-secondary">{booking.customer?.name}</p>
                  <p className="text-xs text-gray-400">{booking.customer?.email}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Provider</p>
                  <p className="text-sm font-bold text-secondary">{booking.provider?.name || 'N/A'}</p>
                  <p className="text-xs text-gray-400">{booking.provider?.email || ''}</p>
                </div>
              </div>

              {/* Amount Info */}
              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase mb-1">Total Booking Amount</p>
                  <p className="text-2xl font-black text-primary">₹{booking.totalAmount}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Payment Method</p>
                  <p className="text-sm font-bold text-secondary uppercase tracking-wider">{booking.paymentMethod}</p>
                </div>
              </div>

              {/* Tabs for Images/Timeline/Financials */}
              <div className="flex gap-4 border-b border-gray-100">
                {['images', 'timeline', 'financials'].map(t => (
                  <button 
                    key={t} onClick={() => setActiveTab(t)}
                    className={`pb-3 text-sm font-bold capitalize transition-all border-b-2 ${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-gray-400'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {activeTab === 'images' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Before Images */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Before Service Proof
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {booking.providerWorkProof?.beforeImages?.map((img, i) => (
                        <img 
                          key={i} src={img.url} alt="Before" 
                          className="w-full h-24 object-cover rounded-xl cursor-pointer hover:scale-105 transition-all shadow-sm"
                          onClick={() => window.open(img.url, '_blank')}
                        />
                      )) || <p className="text-xs text-gray-300 italic">No before images uploaded</p>}
                    </div>
                  </div>

                  {/* After Images */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> After Service Proof
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {booking.providerWorkProof?.afterImages?.map((img, i) => (
                        <img 
                          key={i} src={img.url} alt="After" 
                          className="w-full h-24 object-cover rounded-xl cursor-pointer hover:scale-105 transition-all shadow-sm"
                          onClick={() => window.open(img.url, '_blank')}
                        />
                      )) || <p className="text-xs text-gray-300 italic">No after images uploaded</p>}
                    </div>
                  </div>

                  {/* Complaint Proofs */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Complaint Evidence
                    </h4>
                    <div className="space-y-4">
                      {booking.complaintProofs?.filter(p => p.uploadedBy === 'customer').map((proof, i) => (
                        <div key={i} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <p className="text-[10px] font-bold text-secondary mb-2 flex justify-between">
                            <span>Uploaded by {proof.uploadedBy}</span>
                            <span className="text-gray-400 font-normal">{formatDateTime(proof.createdAt)}</span>
                          </p>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {proof.images?.map((img, j) => (
                              <img key={j} src={img.url} alt="Proof" className="w-full h-20 object-cover rounded-lg cursor-pointer hover:scale-105 transition-all shadow-sm" onClick={() => window.open(img.url, '_blank')} />
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 italic">"{proof.message}"</p>
                        </div>
                      ))}
                      {(!booking.complaintProofs || booking.complaintProofs.filter(p => p.uploadedBy === 'customer').length === 0) && (
                        <p className="text-xs text-gray-300 italic">No complaint proofs available</p>
                      )}
                    </div>
                  </div>

                  {/* Provider Responses */}
                  <div className="pt-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Provider Response
                    </h4>
                    <div className="space-y-4">
                      {booking.complaintProofs?.filter(p => p.uploadedBy === 'provider').map((proof, i) => (
                        <div key={i} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                          <p className="text-[10px] font-bold text-secondary mb-2 flex justify-between">
                            <span>Provider Response</span>
                            <span className="text-gray-400 font-normal">{formatDateTime(proof.createdAt)}</span>
                          </p>
                          <div className="grid grid-cols-3 gap-2 mb-2">
                            {proof.images?.map((img, j) => (
                              <img key={j} src={img.url} alt="Proof" className="w-full h-20 object-cover rounded-lg cursor-pointer hover:scale-105 transition-all shadow-sm" onClick={() => window.open(img.url, '_blank')} />
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 italic">"{proof.message}"</p>
                        </div>
                      ))}
                      {(!booking.complaintProofs || booking.complaintProofs.filter(p => p.uploadedBy === 'provider').length === 0) && (
                        <p className="text-xs text-gray-300 italic">No provider response</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-6 animate-fade-in pl-4 border-l-2 border-gray-100 ml-2 py-2">
                  {[
                    { label: 'Booking Created', date: booking.createdAt, icon: FiClock, color: 'text-gray-400' },
                    { label: 'Service Started', date: booking.serviceStartedAt || booking.startedAt, icon: FiTool, color: 'text-blue-500' },
                    { label: 'Service Completed', date: booking.serviceCompletedAt || booking.completedAt, icon: FiCheckCircle, color: 'text-green-500' },
                    { label: 'Complaint Raised', date: booking.complaintProofs?.find(p => p.uploadedBy === 'customer')?.createdAt || booking.complaint?.createdAt, icon: FiAlertTriangle, color: 'text-red-500' },
                    { label: 'Provider Response', date: booking.complaintProofs?.find(p => p.uploadedBy === 'provider')?.createdAt, icon: FiUser, color: 'text-purple-500' },
                    { label: 'Admin Decision', date: booking.cancellationProgress?.refundCompletedAt, icon: FiDollarSign, color: 'text-primary' },
                    { label: 'Payout Released', date: (booking.fullData?.earningHoldStatus === 'available' || booking.fullData?.earningHoldStatus === 'paid' || booking.fullData?.earningHoldStatus === 'withdrawn') ? (booking.fullData?.payoutHoldUntil || booking.updatedAt) : null, icon: FiUnlock, color: 'text-green-600' },
                  ].filter(t => t.date).map((item, i) => (
                    <div key={i} className="relative flex items-center gap-4">
                      <div className={`absolute -left-[25px] w-4 h-4 rounded-full bg-white border-2 border-current ${item.color}`} />
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 ${item.color}`}>
                        <item.icon size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-secondary">{item.label}</p>
                        <p className="text-[10px] text-gray-400">{formatDateTime(item.date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'financials' && booking.fullData && (
                <div className="space-y-6 animate-fade-in py-2">
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <FiLock className="text-amber-500" /> Provider Payout Status
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm font-bold text-secondary">
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Earning Status</p>
                        <p>{booking.fullData.earningHoldStatus}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase">Payout Hold Until</p>
                        <p>{booking.fullData.payoutHoldUntil ? formatDateTime(booking.fullData.payoutHoldUntil) : 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <FiDollarSign className="text-green-500" /> Transaction History
                    </h4>
                    {booking.fullData.transactions?.length > 0 ? (
                      <div className="space-y-3">
                        {booking.fullData.transactions.map((tx, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-secondary">{tx.transactionId || 'No TX ID'}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tx.paymentStatus === 'refunded' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {tx.paymentStatus}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-gray-400">
                              <span>{tx.paymentMethod}</span>
                              <span>₹{tx.amount}</span>
                            </div>
                            {tx.refundStatus && tx.refundStatus !== 'none' && (
                              <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-500">
                                <span>Refund: <span className="font-bold">{tx.refundStatus}</span></span>
                                {tx.refundedAmount > 0 && <span>₹{tx.refundedAmount}</span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">No transactions found</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Actions */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                <h4 className="text-sm font-bold text-secondary flex items-center gap-2">
                  <FiAlertTriangle className="text-amber-500" /> Admin Resolution
                </h4>

                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Resolution Note / Reason</p>
                  <textarea 
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    disabled={isFullyRefunded}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary resize-none h-24 disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="Describe the reason for your decision..."
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Decision Type</p>
                  <select
                    value={decisionType}
                    onChange={e => setDecisionType(e.target.value)}
                    disabled={isFullyRefunded}
                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Select Action</option>
                    <option value="refund_full">Approve Full Refund</option>
                    <option value="refund_partial">Approve Partial Refund</option>
                    <option value="reject">Reject Refund Request</option>
                  </select>
                </div>

                {decisionType === 'refund_partial' && (
                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Refund Amount</p>
                    <div className="flex gap-2">
                      <input 
                        type="number" value={refundAmount}
                        onChange={e => setRefundAmount(e.target.value)}
                        disabled={isFullyRefunded}
                        className="flex-1 p-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="Amount"
                      />
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    if (decisionType === 'refund_full') handleAction('refund', 'full');
                    else if (decisionType === 'refund_partial') handleAction('refund', 'partial');
                    else if (decisionType === 'reject') handleAction('reject');
                  }}
                  disabled={updating || !decisionType || isFullyRefunded}
                  className="w-full py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {updating ? 'Processing...' : (isFullyRefunded ? 'Refund Already Completed' : 'Submit Decision')}
                </button>

                <div className="pt-4 border-t border-gray-200 space-y-3">
                  <p className="text-[10px] font-bold text-orange-600 uppercase">Payout Control</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleAction('hold', 'held')}
                      disabled={updating || booking.earningHoldStatus === 'held'}
                      className="py-2 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-xl hover:bg-orange-200"
                    >
                      Hold Payout
                    </button>
                    <button 
                      onClick={() => handleAction('hold', 'available')}
                      disabled={updating || booking.earningHoldStatus === 'available'}
                      className="py-2 bg-green-100 text-green-700 text-[10px] font-bold rounded-xl hover:bg-green-200"
                    >
                      Release
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Summary */}
              <div className="bg-secondary p-5 rounded-2xl text-white space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Current Case Status</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span>Payment:</span>
                    <RefundStatusBadge status={booking.paymentStatus} />
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span>Dispute:</span>
                    <DisputeStatusBadge status={booking.disputeStatus} />
                  </div>
                  {booking.complaint && (
                    <div className="flex justify-between items-center text-xs">
                      <span>Complaint:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${booking.complaint.status === 'Closed' ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                        {booking.complaint.status === 'Closed' ? 'Complaint Closed' : booking.complaint.status}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-xs">
                    <span>Earning:</span>
                    <PayoutStatusBadge status={booking.payoutStatus} />
                  </div>
                  {booking.adminRemark && (
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[10px] text-gray-400 uppercase mb-1">Financial Log</p>
                      <p className="text-[10px] leading-relaxed opacity-80 bg-white/5 p-2 rounded-lg italic">
                        {booking.adminRemark}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────
const RefundPage = () => {
  const { showToast } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  const fetchRefundBookings = async () => {
    setLoading(true);
    try {
      // Fetch bookings that have either disputeRaised: true or paymentStatus: 'refunded'
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
      };
      
      const res = await BookingService.getAllBookings(params);
      if (res.data?.success) {
        // Filter for refund-related bookings on frontend
        const filtered = res.data.data.filter(b => 
          b.disputeRaised || 
          b.paymentStatus === 'refunded' || 
          b.disputeStatus !== 'none'
        );
        
        // Apply filterStatus
        const finalData = filtered.filter(b => {
          if (filterStatus === 'all') return true;
          if (filterStatus === 'pending') return ['paid', 'escrow_hold'].includes(b.paymentStatus) && b.disputeRaised;
          if (filterStatus === 'completed') return b.paymentStatus === 'refunded' || b.adminRefundDecision === 'approved';
          if (filterStatus === 'rejected') return b.adminRefundDecision === 'rejected';
          if (filterStatus === 'disputed') return b.disputeStatus === 'UNDER_REVIEW' || b.disputeStatus === 'pending';
          if (filterStatus === 'held') return b.earningHoldStatus === 'held' || b.payoutHoldUntil;
          return true;
        });

        setBookings(finalData);
        setPagination(p => ({ ...p, total: finalData.length, pages: res.data.pages }));
      }
    } catch (err) {
      showToast('Failed to fetch refund cases', 'error');
    } finally {
      setLoading(false);
    }
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
      showToast('Error loading details', 'error');
    }
  };

  useEffect(() => {
    fetchRefundBookings();
  }, [pagination.page, searchTerm, filterStatus]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-inter">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-black text-secondary font-poppins flex items-center gap-3">
              <span className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <FiDollarSign size={24} />
              </span>
              Refund & Dispute Management
            </h1>
            <p className="text-sm text-gray-400 mt-1">Process customer refunds, handle disputes and manage payout holds</p>
          </div>
          <button 
            onClick={fetchRefundBookings}
            className="flex items-center gap-2 px-4 py-2 bg-white text-secondary border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all font-bold text-sm"
          >
            <FiRefreshCw size={14} /> Refresh Data
          </button>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center text-green-600">
              <FiDollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400">Total Refunds</p>
              <p className="text-2xl font-black text-secondary">
                {bookings.filter(b => b.paymentStatus === 'refunded' || b.adminRefundDecision === 'approved').length}
              </p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
              <FiLock size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400">Held Payouts</p>
              <p className="text-2xl font-black text-secondary">
                {bookings.filter(b => b.earningHoldStatus === 'held' || b.payoutHoldUntil).length}
              </p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
              <FiAlertTriangle size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400">Disputes Count</p>
              <p className="text-2xl font-black text-secondary">
                {bookings.filter(b => b.disputeRaised || b.disputeStatus !== 'none').length}
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50 flex flex-col md:flex-row gap-4 animate-fade-in delay-100">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by Booking ID, Customer or Provider..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            {[
              { id: 'all', label: 'All Cases', icon: FiInbox },
              { id: 'pending', label: 'Refund Pending', icon: FiClock },
              { id: 'disputed', label: 'Disputed', icon: FiAlertTriangle },
              { id: 'completed', label: 'Approved', icon: FiCheckCircle },
              { id: 'rejected', label: 'Rejected', icon: FiSlash },
              { id: 'held', label: 'Payout Held', icon: FiLock },
            ].map(f => (
              <button
                key={f.id} onClick={() => setFilterStatus(f.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${filterStatus === f.id ? 'bg-secondary text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
              >
                <f.icon size={14} /> {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-50 overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50/50">
                <tr>
                  {[
                    'Booking ID', 'Customer', 'Provider', 'Amount', 
                    'Refund', 'Dispute', 'Payout', 'Created Date', 'Action'
                  ].map(h => (
                    <th key={h} className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                   Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-6 py-5">
                          <div className="h-4 bg-gray-100 rounded-full w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : bookings.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-20 text-center text-gray-400">
                      <FiInbox size={48} className="mx-auto mb-4 opacity-10" />
                      <p className="font-bold">No refund cases found</p>
                      <p className="text-xs">Adjust your search or filters to see more results</p>
                    </td>
                  </tr>
                ) : (
                  bookings.map((b, i) => (
                    <tr key={b._id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-5">
                        <span className="text-xs font-mono font-bold text-gray-400">#{b.bookingId || b._id?.slice(-8)}</span>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-[10px]">
                            {b.customer?.name?.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-secondary truncate max-w-[120px]">{b.customer?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-medium text-gray-500">{b.provider?.name || 'Unassigned'}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm font-black text-secondary">₹{b.totalAmount}</span>
                      </td>
                      <td className="px-6 py-5">
                        <RefundStatusBadge status={b.paymentStatus} />
                      </td>
                      <td className="px-6 py-5">
                        <DisputeStatusBadge status={b.disputeStatus} />
                      </td>
                      <td className="px-6 py-5">
                        <PayoutStatusBadge status={b.payoutStatus} />
                      </td>
                      <td className="px-6 py-5 text-xs text-gray-400">
                        {formatDate(b.createdAt)}
                      </td>
                      <td className="px-6 py-5">
                        <button 
                          onClick={() => handleViewDetails(b._id)}
                          className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all shadow-sm hover:shadow-primary/30"
                        >
                          <FiEye size={16} />
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
