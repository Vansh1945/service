// src/pages/admin/ComplaintsPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import axios from 'axios';
import {
  Search, MessageSquare, User, Clock, AlertTriangle,
  CheckCircle, RefreshCw, X, Eye, ChevronLeft, ChevronRight,
  Mail, Phone, BarChart3
} from 'lucide-react';

// ── Status Badge ──────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = {
    Open:        'text-blue-700 bg-blue-50 border-blue-200',
    'In-Progress':'text-yellow-700 bg-yellow-50 border-yellow-200',
    Solved:      'text-green-700 bg-green-50 border-green-200',
    Reopened:    'text-orange-700 bg-orange-50 border-orange-200',
    Closed:      'text-gray-600 bg-gray-50 border-gray-200',
  };
  const label = { 'In-Progress': 'In Progress' }[status] || status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg[status] || 'text-gray-600 bg-gray-50 border-gray-200'}`}>
      {label}
    </span>
  );
};

// ── Complaint Details Modal ───────────────────────────────
const ComplaintDetailsModal = ({ complaint, onClose, onUpdateStatus, onResolve }) => {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [statusUpdate, setStatusUpdate] = useState(complaint?.status || '');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const handleStatusUpdate = async () => {
    if (!statusUpdate) { showToast('Please select a status', 'error'); return; }
    try { await onUpdateStatus(complaint._id, statusUpdate); showToast('Status updated successfully', 'success'); }
    catch  { showToast('Failed to update status', 'error'); }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) { showToast('Resolution notes are required', 'error'); return; }
    try { await onResolve(complaint._id, resolutionNotes); setResolutionNotes(''); showToast('Complaint resolved', 'success'); }
    catch { showToast('Failed to resolve complaint', 'error'); }
  };

  if (!complaint) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-semibold text-secondary">Complaint Details</h3>
            <p className="text-xs text-gray-400 mt-0.5">ID: #{complaint.complaintId || complaint._id?.slice(-8)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100">
          <nav className="flex gap-6 px-6">
            {['details', 'timeline', 'actions'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-1 border-b-2 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-secondary'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* ── Details Tab ── */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Complaint Info */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h4 className="font-semibold text-secondary mb-3 flex items-center gap-2">
                    <AlertTriangle className="text-primary" size={16} /> Complaint Info
                  </h4>
                  <div className="space-y-2 text-sm">
                    {[
                      ['Title', complaint.title],
                      ['Category', complaint.category],
                      ['Created', formatDate(complaint.createdAt)],
                      ...(complaint.resolvedAt ? [['Resolved', formatDate(complaint.resolvedAt)]] : []),
                    ].map(([label, val]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-medium text-secondary text-right">{val || 'N/A'}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Status</span>
                      <StatusBadge status={complaint.status} />
                    </div>
                  </div>
                </div>

                {/* Parties */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h4 className="font-semibold text-secondary mb-3 flex items-center gap-2">
                    <User className="text-primary" size={16} /> Parties Involved
                  </h4>
                  <div className="space-y-4">
                    {[
                      { label: 'Customer', data: complaint.customer, color: 'bg-primary' },
                      { label: 'Service Provider', data: complaint.provider, color: 'bg-green-500' },
                    ].map(({ label, data, color }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 ${color} rounded-full flex items-center justify-center shrink-0`}>
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-secondary">{data?.name || 'N/A'}</p>
                            {data?.email && <p className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} />{data.email}</p>}
                            {data?.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{data.phone}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Booking ID</p>
                      <p className="text-sm font-medium text-secondary">#{complaint.booking?.bookingId || complaint.booking?._id?.slice(-8) || (typeof complaint.booking === 'string' ? complaint.booking : 'N/A')}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h4 className="font-semibold text-secondary mb-2">Description</h4>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{complaint.description}</p>
              </div>

              {/* Images */}
              {complaint.images?.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h4 className="font-semibold text-secondary mb-3">Attached Images</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {complaint.images.map((img, i) => (
                      <img key={i} src={img.secure_url} alt={`Evidence ${i + 1}`}
                        className="rounded-lg w-full h-28 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(img.secure_url, '_blank')} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Timeline Tab ── */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-secondary">Status History</h4>
              {(complaint.statusHistory || []).length > 0 ? (
                <div className="space-y-3">
                  {complaint.statusHistory.map((h, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-primary rounded-full mt-1" />
                        {i < complaint.statusHistory.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-1" />}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-secondary text-sm">{h.status}</span>
                          <span className="text-xs text-gray-400">{formatDate(h.updatedAt)}</span>
                        </div>
                        {h.status === 'Solved' && complaint.resolutionNotes && (
                          <div className="mt-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
                            <p className="text-xs text-gray-700"><strong>Resolution:</strong> {complaint.resolutionNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-400 text-sm text-center py-6">No status history available</p>}

              {(complaint.reopenHistory || []).length > 0 && (
                <div className="mt-5">
                  <h5 className="font-semibold text-secondary mb-3 text-sm">Reopen History</h5>
                  <div className="space-y-3">
                    {complaint.reopenHistory.map((h, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 bg-orange-400 rounded-full mt-1" />
                          {i < complaint.reopenHistory.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-1" />}
                        </div>
                        <div className="flex-1 bg-orange-50 rounded-lg p-3 border border-orange-100">
                          <div className="flex justify-between">
                            <span className="font-medium text-secondary text-sm">Reopened</span>
                            <span className="text-xs text-gray-400">{formatDate(h.reopenedAt)}</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{h.reason}</p>
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
            <div className="space-y-5">
              {/* Update Status */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <h4 className="font-semibold text-secondary mb-3">Update Status</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={statusUpdate}
                    onChange={e => setStatusUpdate(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-secondary"
                  >
                    <option value="">Select Status</option>
                    {['Open', 'In-Progress', 'Solved', 'Reopened', 'Closed'].map(s => (
                      <option key={s} value={s}>{s === 'In-Progress' ? 'In Progress' : s}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={!statusUpdate}
                    className="px-5 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Update
                  </button>
                </div>
              </div>

              {/* Resolve */}
              {!['Solved', 'Closed'].includes(complaint.status) && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <h4 className="font-semibold text-secondary mb-3">Resolve Complaint</h4>
                  <textarea
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    placeholder="Enter resolution notes..."
                    rows="3"
                    className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm resize-none mb-3"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleResolve}
                      disabled={!resolutionNotes.trim()}
                      className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Mark as Resolved
                    </button>
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

// ── Main Page ─────────────────────────────────────────────
const ComplaintsPage = () => {
  const { token, API, showToast } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [filters, setFilters] = useState({ status: '', category: '', search: '', startDate: '', endDate: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  const statusOptions = [
    { value: '', label: 'All Status' }, { value: 'Open', label: 'Open' },
    { value: 'In-Progress', label: 'In Progress' }, { value: 'Solved', label: 'Solved' },
    { value: 'Reopened', label: 'Reopened' }, { value: 'Closed', label: 'Closed' },
  ];

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: pagination.page.toString(), limit: pagination.limit.toString() });
      if (filters.status) q.append('status', filters.status);
      if (filters.category) q.append('category', filters.category);
      if (filters.search) q.append('search', filters.search);
      if (filters.startDate) q.append('startDate', filters.startDate);
      if (filters.endDate) q.append('endDate', filters.endDate);

      const res = await axios.get(`${API}/complaint?${q}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.data?.success) {
        setComplaints(res.data.data || []);
        setPagination(p => ({ ...p, total: res.data.total || 0, pages: res.data.pages || 1 }));
      } else showToast('Failed to fetch complaints', 'error');
    } catch { showToast('Error fetching complaints', 'error'); }
    finally { setLoading(false); }
  };

  const fetchComplaintDetails = async (id) => {
    try {
      const res = await axios.get(`${API}/complaint/${id}/details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data?.success) { setSelectedComplaint(res.data.data); setShowModal(true); }
      else showToast('Failed to fetch complaint details', 'error');
    } catch { showToast('Failed to fetch complaint details', 'error'); }
  };

  const updateComplaintStatus = async (id, status) => {
    setUpdating(true);
    try {
      const res = await axios.put(`${API}/complaint/${id}/status`, { status }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data?.success) {
        await fetchComplaints();
        if (selectedComplaint?._id === id) setSelectedComplaint(p => ({ ...p, status }));
        return true;
      }
      showToast('Failed to update status', 'error'); return false;
    } catch { showToast('Failed to update status', 'error'); return false; }
    finally { setUpdating(false); }
  };

  const resolveComplaint = async (id, resolutionNotes) => {
    setUpdating(true);
    try {
      const res = await axios.put(`${API}/complaint/${id}/resolve`, { resolutionNotes }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
    setFilters({ status: '', category: '', search: '', startDate: '', endDate: '' });
    setPagination(p => ({ ...p, page: 1 }));
  };

  useEffect(() => { fetchComplaints(); }, [filters, pagination.page]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

  const stats = [
    { label: 'Total', value: pagination.total, icon: BarChart3, bg: 'bg-primary bg-opacity-10', color: 'text-primary' },
    { label: 'Open', value: complaints.filter(c => c.status === 'Open').length, icon: Clock, bg: 'bg-yellow-100', color: 'text-yellow-600' },
    { label: 'In Progress', value: complaints.filter(c => c.status === 'In-Progress').length, icon: RefreshCw, bg: 'bg-blue-100', color: 'text-blue-600' },
    { label: 'Solved', value: complaints.filter(c => c.status === 'Solved').length, icon: CheckCircle, bg: 'bg-green-100', color: 'text-green-600' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h1 className="text-2xl md:text-3xl font-bold text-secondary flex items-center gap-3">
            <AlertTriangle className="text-primary" size={30} />
            Complaint Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Manage and track customer complaints efficiently</p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
            {stats.map(({ label, value, icon: Icon, bg, color }) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search complaints..."
                value={filters.search}
                onChange={e => handleFilterChange('search', e.target.value)}
                className="pl-9 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            </div>
            {/* Status */}
            <select
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-secondary"
            >
              {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)}
                className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
              <input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)}
                className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
            </div>
            {/* Refresh */}
            <button
              onClick={fetchComplaints}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-secondary">All Complaints</h2>
            <span className="text-sm text-gray-400">{pagination.total} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['ID', 'Title & Description', 'Customer', 'Status', 'Category', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : complaints.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-secondary font-medium">No Complaints Found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        {Object.values(filters).some(f => f) ? 'Try adjusting your filters.' : 'No complaints have been submitted yet.'}
                      </p>
                    </td>
                  </tr>
                ) : complaints.map(c => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-5 py-4 text-sm font-medium text-secondary">#{c.complaintId || (c._id || '').slice(-8)}</td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-secondary">{c.title || 'No Title'}</p>
                      <p className="text-xs text-gray-400 truncate max-w-xs">{c.description || 'No description'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-secondary">{c.customer?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{c.customer?.email || 'N/A'}</p>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-4 text-sm text-secondary">{c.category || 'N/A'}</td>
                    <td className="px-5 py-4 text-sm text-gray-500">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => fetchComplaintDetails(c._id)}
                        className="flex items-center gap-1 text-xs text-primary border border-primary border-opacity-30 px-3 py-1.5 rounded-lg hover:bg-primary hover:bg-opacity-10 transition-colors"
                      >
                        <Eye size={14} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="p-2 text-secondary border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                  .filter(p => p >= pagination.page - 1 && p <= pagination.page + 1)
                  .map(p => (
                    <button key={p} onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                      className={`w-8 h-8 text-sm rounded-lg ${p === pagination.page ? 'bg-primary text-white' : 'text-secondary hover:bg-gray-100'}`}>
                      {p}
                    </button>
                  ))}
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="p-2 text-secondary border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && selectedComplaint && (
        <ComplaintDetailsModal
          complaint={selectedComplaint}
          onClose={() => setShowModal(false)}
          onUpdateStatus={updateComplaintStatus}
          onResolve={resolveComplaint}
        />
      )}
    </div>
  );
};

export default ComplaintsPage;