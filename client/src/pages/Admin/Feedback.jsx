import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import {
  Search, Star, User, MessageSquare, Eye, X,
  ChevronLeft, ChevronRight, Calendar, BarChart3
} from 'lucide-react';

const AdminFeedback = () => {
  const { token, API, showToast } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, averageRating: 0, providerFeedback: 0, serviceFeedback: 0 });
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({ rating: '', type: '', search: '', startDate: '', endDate: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  const ratingOptions = [
    { value: '', label: 'All Ratings' },
    { value: '5', label: '5 Stars' },
    { value: '4', label: '4 Stars' },
    { value: '3', label: '3 Stars' },
    { value: '2', label: '2 Stars' },
    { value: '1', label: '1 Star' },
  ];

  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'provider', label: 'Provider Feedback' },
    { value: 'service', label: 'Service Feedback' },
  ];

  const fetchFeedbacks = async () => {
    try {
      setLoading(true);
      const q = new URLSearchParams({ page: pagination.page.toString(), limit: pagination.limit.toString() });
      if (filters.rating) q.append('rating', filters.rating);
      if (filters.type) q.append('type', filters.type);
      if (filters.search) q.append('search', filters.search);
      if (filters.startDate) q.append('startDate', filters.startDate);
      if (filters.endDate) q.append('endDate', filters.endDate);

      const res = await fetch(`${API}/feedback/admin/all-feedbacks?${q}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.data || [];
        setFeedbacks(list);
        setPagination(p => ({ ...p, total: data.total || 0, pages: data.pages || 1 }));
        calculateStats(list);
      } else throw new Error('Failed to fetch feedbacks');
    } catch (err) {
      showToast('Failed to fetch feedbacks', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (list) => {
    let totalRating = 0, ratingCount = 0, providerFeedback = 0, serviceFeedback = 0;
    list.forEach(fb => {
      if (fb.providerFeedback?.rating) { totalRating += fb.providerFeedback.rating; ratingCount++; providerFeedback++; }
      if (fb.serviceFeedback?.rating) { totalRating += fb.serviceFeedback.rating; ratingCount++; serviceFeedback++; }
    });
    setStats({ total: list.length, averageRating: ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 0, providerFeedback, serviceFeedback });
  };

  const fetchFeedbackDetails = async (id) => {
    try {
      const res = await fetch(`${API}/feedback/admin/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { const data = await res.json(); setSelectedFeedback(data.data); setShowModal(true); }
      else throw new Error();
    } catch { showToast('Failed to fetch feedback details', 'error'); }
  };

  const handleFilterChange = (key, value) => {
    setFilters(p => ({ ...p, [key]: value }));
    setPagination(p => ({ ...p, page: 1 }));
  };
  const clearFilters = () => {
    setFilters({ rating: '', type: '', search: '', startDate: '', endDate: '' });
    setPagination(p => ({ ...p, page: 1 }));
  };

  useEffect(() => { fetchFeedbacks(); }, [filters, pagination.page]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

  const renderStars = (rating) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`w-3 h-3 ${s <= rating ? 'fill-current text-yellow-500' : 'text-gray-300'}`} />
      ))}
    </div>
  );

  const getRatingColor = (rating) => {
    if (rating >= 4) return 'text-green-700 bg-green-50 border-green-200';
    if (rating >= 3) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    if (rating >= 2) return 'text-orange-700 bg-orange-50 border-orange-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const statCards = [
    { label: 'Total Feedback', value: stats.total, icon: MessageSquare, bg: 'bg-primary bg-opacity-10', color: 'text-primary' },
    { label: 'Avg Rating', value: `${stats.averageRating}/5`, icon: Star, bg: 'bg-yellow-100', color: 'text-yellow-600' },
    { label: 'Provider Reviews', value: stats.providerFeedback, icon: User, bg: 'bg-green-100', color: 'text-green-600' },
    { label: 'Service Reviews', value: stats.serviceFeedback, icon: BarChart3, bg: 'bg-purple-100', color: 'text-purple-600' },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h1 className="text-2xl md:text-3xl font-bold text-secondary flex items-center gap-3">
            <MessageSquare className="text-primary" size={30} />
            Feedback Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Monitor and review customer feedback across all bookings</p>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search feedback..."
                value={filters.search}
                onChange={e => handleFilterChange('search', e.target.value)}
                className="pl-9 w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            </div>
            {/* Rating */}
            <select
              value={filters.rating}
              onChange={e => handleFilterChange('rating', e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-secondary"
            >
              {ratingOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {/* Type */}
            <select
              value={filters.type}
              onChange={e => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm text-secondary"
            >
              {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)}
                className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
              <input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)}
                className="w-full px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm" />
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-secondary">All Feedback</h2>
            <span className="text-sm text-gray-400">{pagination.total} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  {['Customer', 'Provider', 'Service', 'Provider Rating', 'Service Rating', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                      ))}
                    </tr>
                  ))
                ) : feedbacks.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-secondary font-medium">No Feedback Found</p>
                      <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                    </td>
                  </tr>
                ) : feedbacks.map(fb => (
                  <tr key={fb._id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-secondary">{fb.customer?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{fb.customer?.email || 'N/A'}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-secondary">{fb.providerFeedback?.provider?.name || 'N/A'}</td>
                    <td className="px-5 py-4 text-sm text-secondary">{fb.serviceFeedback?.service?.title || 'N/A'}</td>
                    <td className="px-5 py-4">
                      {fb.providerFeedback?.rating ? (
                        <div className="flex items-center gap-2">
                          {renderStars(fb.providerFeedback.rating)}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getRatingColor(fb.providerFeedback.rating)}`}>
                            {fb.providerFeedback.rating}
                          </span>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      {fb.serviceFeedback?.rating ? (
                        <div className="flex items-center gap-2">
                          {renderStars(fb.serviceFeedback.rating)}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getRatingColor(fb.serviceFeedback.rating)}`}>
                            {fb.serviceFeedback.rating}
                          </span>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">{formatDate(fb.createdAt)}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => fetchFeedbackDetails(fb._id)}
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
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-secondary bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                  .filter(p => p >= pagination.page - 1 && p <= pagination.page + 1)
                  .map(p => (
                    <button
                      key={p}
                      onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                      className={`w-8 h-8 text-sm rounded-lg ${p === pagination.page ? 'bg-primary text-white' : 'text-secondary hover:bg-gray-100'}`}
                    >{p}</button>
                  ))}
                <button
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-secondary bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Details Modal ── */}
      {showModal && selectedFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-secondary">Feedback Details</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <h4 className="font-semibold text-secondary mb-3 flex items-center gap-2">
                  <User className="text-primary" size={16} /> Customer
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[['Name', selectedFeedback.customer?.name], ['Email', selectedFeedback.customer?.email]].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="font-medium text-secondary">{val || 'N/A'}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs text-gray-400">Booking ID</p>
                    <p className="font-medium text-primary">
                      {selectedFeedback.booking?.bookingId || selectedFeedback.booking?._id || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Provider Feedback */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <h4 className="font-semibold text-secondary mb-3 flex items-center gap-2">
                  <User className="text-primary" size={16} /> Provider Feedback
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Provider</span>
                    <span className="font-medium text-secondary">{selectedFeedback.providerFeedback?.provider?.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Rating</span>
                    <div className="flex items-center gap-2">
                      {renderStars(selectedFeedback.providerFeedback?.rating || 0)}
                      <span className="font-medium text-secondary">{selectedFeedback.providerFeedback?.rating || 'N/A'}/5</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Comment</span>
                    <p className="mt-1 p-3 bg-white rounded border border-gray-100 text-secondary text-sm">
                      {selectedFeedback.providerFeedback?.comment || 'No comment provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Service Feedback */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <h4 className="font-semibold text-secondary mb-3 flex items-center gap-2">
                  <MessageSquare className="text-primary" size={16} /> Service Feedback
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Service</span>
                    <span className="font-medium text-secondary">{selectedFeedback.serviceFeedback?.service?.title || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Rating</span>
                    <div className="flex items-center gap-2">
                      {renderStars(selectedFeedback.serviceFeedback?.rating || 0)}
                      <span className="font-medium text-secondary">{selectedFeedback.serviceFeedback?.rating || 'N/A'}/5</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Comment</span>
                    <p className="mt-1 p-3 bg-white rounded border border-gray-100 text-secondary text-sm">
                      {selectedFeedback.serviceFeedback?.comment || 'No comment provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Submission */}
              <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
                <span>Submitted: {formatDate(selectedFeedback.createdAt)}</span>
                <span>Updated: {formatDate(selectedFeedback.updatedAt)}</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-secondary bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeedback;