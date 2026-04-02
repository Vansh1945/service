import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import { ToastContainer, toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import TimePicker from 'react-time-picker';
import 'react-datepicker/dist/react-datepicker.css';
import 'react-time-picker/dist/TimePicker.css';
import 'react-toastify/dist/ReactToastify.css';
import {
  DollarSign, Clock, CheckCircle, BarChart3,
  Eye, Check, X, RefreshCw, ChevronLeft, ChevronRight,
  User, CreditCard, FileText, Calendar
} from 'lucide-react';

const AdminPayout = () => {
  const { user, API } = useAuth();
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [approveForm, setApproveForm] = useState({ utrNo: '', transferDate: '', transferTime: '', adminRemark: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [filters, setFilters] = useState({ status: '', startDate: '', endDate: '', providerSearch: '', sortBy: '' });

  useEffect(() => { fetchWithdrawals(); }, [page, filters]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (filters.status) q.append('status', filters.status);
      if (filters.startDate) q.append('startDate', filters.startDate);
      if (filters.endDate) q.append('endDate', filters.endDate);
      if (filters.providerSearch) q.append('providerSearch', filters.providerSearch);
      if (filters.sortBy) q.append('sortBy', filters.sortBy);

      const res = await fetch(`${API}/payment/admin/withdrawal-requests?${q}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error('Failed to fetch withdrawal requests');
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setWithdrawals(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error(err.message || 'Failed to load withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => { setFilters(p => ({ ...p, [key]: value })); setPage(1); };
  const clearFilters = () => { setFilters({ status: '', startDate: '', endDate: '', providerSearch: '', sortBy: '' }); setPage(1); };

  const handleApprove = (w) => { setSelectedWithdrawal(w); setApproveForm({ utrNo: '', transferDate: '', transferTime: '', adminRemark: '' }); setShowApproveModal(true); };
  const handleReject  = (w) => { setSelectedWithdrawal(w); setRejectReason(''); setShowRejectModal(true); };
  const handleView    = (w) => { setSelectedDetails(w); setShowDetailsModal(true); };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) { toast.error('Please enter a rejection reason'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/payment/admin/withdrawal-request/${selectedWithdrawal._id}/reject`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: rejectReason, adminRemark: 'Rejected via admin dashboard' })
      });
      if (!res.ok) throw new Error('Failed to reject withdrawal');
      toast.success('Withdrawal rejected successfully');
      setShowRejectModal(false); setSelectedWithdrawal(null); fetchWithdrawals();
    } catch (err) { toast.error(err.message || 'Failed to reject withdrawal'); }
    finally { setSubmitting(false); }
  };

  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!approveForm.utrNo || !approveForm.transferDate || !approveForm.transferTime) { toast.error('Please fill all required fields'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/payment/admin/withdrawal-request/${selectedWithdrawal._id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionReference: approveForm.utrNo,
          utrNo: approveForm.utrNo,
          transferDate: approveForm.transferDate,
          transferTime: approveForm.transferTime,
          notes: approveForm.adminRemark
        })
      });
      if (!res.ok) throw new Error('Failed to approve withdrawal');
      toast.success('Withdrawal approved successfully');
      setShowApproveModal(false); setSelectedWithdrawal(null); fetchWithdrawals();
    } catch (err) { toast.error(err.message || 'Failed to approve withdrawal'); }
    finally { setSubmitting(false); }
  };

  const getStatusBadge = (status) => {
    const cfg = {
      requested:    'text-yellow-700 bg-yellow-50 border-yellow-200',
      under_review: 'text-purple-700 bg-purple-50 border-purple-200',
      approved:     'text-teal-700 bg-teal-50 border-teal-200',
      processing:   'text-blue-700 bg-blue-50 border-blue-200',
      completed:    'text-green-700 bg-green-50 border-green-200',
      rejected:     'text-red-600 bg-red-50 border-red-200',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${cfg[status] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
        {status?.replace('_', ' ')}
      </span>
    );
  };

  const formatDate     = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const totalPages = Math.ceil(total / limit);

  const statCards = [
    { label: 'Total Requests', value: total, icon: BarChart3, bg: 'bg-primary bg-opacity-10', color: 'text-primary' },
    { label: 'Pending', value: withdrawals.filter(w => w.status === 'requested').length, icon: Clock, bg: 'bg-yellow-100', color: 'text-yellow-600' },
    { label: 'Completed', value: withdrawals.filter(w => w.status === 'completed').length, icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600' },
    { label: 'This Page', value: withdrawals.length, icon: FileText, bg: 'bg-blue-100', color: 'text-blue-600' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-poppins">Loading withdrawal requests…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-secondary flex items-center gap-3">
                <DollarSign className="text-primary" size={30} />
                Payout Management
              </h1>
              <p className="text-gray-500 mt-1 text-sm">Review and process provider withdrawal requests</p>
            </div>
            <button
              onClick={fetchWithdrawals}
              className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-primary bg-opacity-10 text-primary rounded-lg hover:bg-opacity-20 transition-colors font-medium text-sm"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            {statCards.map(({ label, value, icon: Icon, bg, color }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">{label}</p>
                    <p className="text-2xl font-bold text-secondary mt-1">{value}</p>
                  </div>
                  <div className={`${bg} p-2 rounded-lg`}>
                    <Icon className={color} size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-xl shadow-md p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-secondary">Filters</h2>
            <button onClick={clearFilters} className="text-sm text-primary hover:underline">Clear All</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <select
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-secondary"
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Status</option>
              {['requested','under_review','approved','processing','completed','rejected'].map(s => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <DatePicker
              selected={filters.startDate ? new Date(filters.startDate) : null}
              onChange={date => handleFilterChange('startDate', date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '')}
              dateFormat="yyyy-MM-dd"
              placeholderText="Start Date"
              className="px-3 py-2 w-full bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            <DatePicker
              selected={filters.endDate ? new Date(filters.endDate) : null}
              onChange={date => handleFilterChange('endDate', date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '')}
              dateFormat="yyyy-MM-dd"
              placeholderText="End Date"
              className="px-3 py-2 w-full bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
            />
            <div className="relative">
              <input type="text"
                className="w-full px-3 py-2 pl-8 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                placeholder="Search provider…"
                value={filters.providerSearch}
                onChange={e => handleFilterChange('providerSearch', e.target.value)}
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-secondary"
              value={filters.sortBy}
              onChange={e => handleFilterChange('sortBy', e.target.value)}
            >
              <option value="">Sort: Default</option>
              <option value="amount_desc">Amount ↓</option>
              <option value="amount_asc">Amount ↑</option>
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
            </select>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-secondary">Withdrawal Requests</h2>
            <span className="text-sm text-gray-400">{total} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Provider', 'Amount', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-secondary font-medium">No withdrawal requests found</p>
                      <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : withdrawals.map(w => (
                  <tr key={w._id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-secondary">{w.provider?.name || 'N/A'}</p>
                      {w.provider?.providerId && (
                        <p className="text-xs text-gray-500">[{w.provider.providerId}]</p>
                      )}
                      <p className="text-xs text-gray-400">{w.provider?.email || 'N/A'}</p>
                      <span className="inline-flex items-center gap-1 mt-1 text-xs text-primary font-medium bg-primary bg-opacity-10 px-2 py-0.5 rounded">
                        ₹{(w.provider?.wallet?.availableBalance || 0).toLocaleString('en-IN')} wallet
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-bold text-secondary">₹{w.amount?.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 capitalize mt-0.5">{w.withdrawalType || 'Bank Transfer'}</p>
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(w.status)}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{formatDate(w.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleView(w)}
                          className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                          <Eye size={13} /> View
                        </button>
                        {['requested', 'processing', 'under_review'].includes(w.status) && (
                          <>
                            <button onClick={() => handleApprove(w)}
                              className="flex items-center gap-1 text-xs text-white bg-primary px-2.5 py-1.5 rounded-lg hover:bg-teal-700 transition-colors">
                              <Check size={13} /> Approve
                            </button>
                            <button onClick={() => handleReject(w)}
                              className="flex items-center gap-1 text-xs text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                              <X size={13} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1}
                  className="p-2 text-secondary border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p >= page - 1 && p <= page + 1)
                  .map(p => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 text-sm rounded-lg transition-colors ${p === page ? 'bg-primary text-white' : 'text-secondary hover:bg-gray-100'}`}>
                      {p}
                    </button>
                  ))}
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                  className="p-2 text-secondary border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ APPROVE MODAL ══ */}
      {showApproveModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-secondary">Approve Withdrawal</h2>
                <p className="text-xs text-gray-400 mt-0.5">Enter transaction details below</p>
              </div>
              <button onClick={() => setShowApproveModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Banner */}
            <div className="mx-6 mt-4 p-4 bg-primary bg-opacity-5 rounded-xl border border-primary border-opacity-20 flex items-center gap-3">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-secondary">₹{selectedWithdrawal.amount?.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{selectedWithdrawal.provider?.name}</p>
              </div>
            </div>

            <form onSubmit={handleApproveSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">UTR Number <span className="text-red-400">*</span></label>
                <input type="text" required
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  placeholder="Enter UTR / Transaction reference"
                  value={approveForm.utrNo}
                  onChange={e => setApproveForm(p => ({ ...p, utrNo: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1.5">Transfer Date <span className="text-red-400">*</span></label>
                  <DatePicker
                    selected={approveForm.transferDate ? new Date(approveForm.transferDate) : null}
                    onChange={date => setApproveForm(p => ({ ...p, transferDate: date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' }))}
                    dateFormat="yyyy-MM-dd"
                    placeholderText="Select date"
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1.5">Transfer Time <span className="text-red-400">*</span></label>
                  <TimePicker
                    value={approveForm.transferTime}
                    onChange={time => setApproveForm(p => ({ ...p, transferTime: time }))}
                    format="HH:mm"
                    disableClock={true}
                    required
                    className="w-full h-[42px] px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Admin Remark <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea rows={3} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none"
                  placeholder="Add any notes…" value={approveForm.adminRemark}
                  onChange={e => setApproveForm(p => ({ ...p, adminRemark: e.target.value }))} />
              </div>
              <div className="flex gap-3 pb-2">
                <button type="button" onClick={() => setShowApproveModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-secondary bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-primary hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</> : 'Approve Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ REJECT MODAL ══ */}
      {showRejectModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-secondary">Reject Withdrawal</h2>
                <p className="text-xs text-gray-400 mt-0.5">Provide a reason for the provider</p>
              </div>
              <button onClick={() => setShowRejectModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="mx-6 mt-4 p-4 bg-red-50 rounded-xl border border-red-100 flex items-center gap-3">
              <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                <X className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-secondary">₹{selectedWithdrawal.amount?.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{selectedWithdrawal.provider?.name}</p>
              </div>
            </div>

            <form onSubmit={handleRejectSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1.5">Rejection Reason <span className="text-red-400">*</span></label>
                <textarea required rows={4}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm resize-none"
                  placeholder="Provide a clear reason for rejection…"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)} />
              </div>
              <div className="flex gap-3 pb-2">
                <button type="button" onClick={() => setShowRejectModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-secondary bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</> : 'Reject Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ DETAILS MODAL ══ */}
      {showDetailsModal && selectedDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold text-secondary">Withdrawal Details</h2>
                <p className="text-xs text-gray-400 mt-0.5">Full information about this request</p>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Amount + Status */}
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div>
                  <p className="text-xs text-gray-400">Withdrawal Amount</p>
                  <p className="text-2xl font-bold text-primary mt-0.5">₹{selectedDetails.amount?.toLocaleString()}</p>
                </div>
                {getStatusBadge(selectedDetails.status)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Provider */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <User size={12} className="text-primary" /> Provider
                  </h3>
                  {[
                    ['Name', selectedDetails.provider?.name],
                    ['Provider ID', selectedDetails.provider?.providerId],
                    ['Email', selectedDetails.provider?.email],
                    ['Phone', selectedDetails.provider?.phone],
                    ['Wallet Balance', `₹${(selectedDetails.provider?.wallet?.availableBalance || 0).toLocaleString('en-IN')}`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-gray-400">{label}</span>
                      <span className={`text-xs font-medium ${label === 'Wallet Balance' ? 'text-primary' : 'text-secondary'} text-right max-w-[60%] truncate`}>{val || 'N/A'}</span>
                    </div>
                  ))}
                </div>

                {/* Bank Details */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CreditCard size={12} className="text-primary" /> Bank Details
                  </h3>
                  {[
                    ['Account Holder', selectedDetails.paymentDetails?.accountName],
                    ['Bank Name', selectedDetails.provider?.bankDetails?.bankName],
                    ['Account No', selectedDetails.provider?.bankDetails?.accountNo ? '••••' + selectedDetails.provider.bankDetails.accountNo.slice(-4) : null],
                    ['IFSC Code', selectedDetails.provider?.bankDetails?.ifsc],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-gray-400">{label}</span>
                      <span className="text-xs font-medium text-secondary font-mono">{val || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transaction Info */}
              {(selectedDetails.utrNo || selectedDetails.transferDate || selectedDetails.adminRemark || selectedDetails.rejectionReason) && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <FileText size={12} className="text-primary" /> Transaction Info
                  </h3>
                  <div className="space-y-3">
                    {selectedDetails.utrNo && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-400">UTR Number</span>
                        <span className="text-xs font-mono font-medium text-secondary">{selectedDetails.utrNo}</span>
                      </div>
                    )}
                    {selectedDetails.transferDate && selectedDetails.transferTime && (
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-400">Transfer Date & Time</span>
                        <span className="text-xs font-medium text-secondary">{formatDate(selectedDetails.transferDate)} at {selectedDetails.transferTime}</span>
                      </div>
                    )}
                    {selectedDetails.adminRemark && (
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Admin Remark</p>
                        <p className="text-xs text-secondary bg-white p-2 rounded border border-gray-100">{selectedDetails.adminRemark}</p>
                      </div>
                    )}
                    {selectedDetails.rejectionReason && (
                      <div>
                        <p className="text-xs text-red-400 mb-1">Rejection Reason</p>
                        <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">{selectedDetails.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                <span>Requested: {formatDateTime(selectedDetails.createdAt)}</span>
                <span className="capitalize">{selectedDetails.withdrawalType || 'Bank Transfer'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayout;