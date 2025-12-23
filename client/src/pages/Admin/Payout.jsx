import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
  const [approveForm, setApproveForm] = useState({
    utrNo: '',
    transferDate: '',
    transferTime: '',
    adminRemark: ''
  });
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    providerSearch: '',
    sortBy: ''
  });

  useEffect(() => {
    fetchWithdrawals();
  }, [page, filters]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });

      if (filters.status) queryParams.append('status', filters.status);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.providerSearch) queryParams.append('providerSearch', filters.providerSearch);
      if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);

      const response = await fetch(`${API}/payment/admin/withdrawal-requests?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch withdrawal requests');
      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      setWithdrawals(data.data || []);
      setTotal(data.total || 0);
    } catch (error) {
      toast.error(error.message || 'Failed to load withdrawal requests');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      startDate: '',
      endDate: '',
      providerSearch: '',
      sortBy: ''
    });
    setPage(1);
  };

  const handleApprove = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setApproveForm({
      utrNo: '',
      transferDate: '',
      transferTime: '',
      adminRemark: ''
    });
    setShowApproveModal(true);
  };

  const handleReject = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleView = (withdrawal) => {
    setSelectedDetails(withdrawal);
    setShowDetailsModal(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API}/payment/admin/withdrawal-request/${selectedWithdrawal._id}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rejectionReason: rejectReason,
          adminRemark: 'Rejected via admin dashboard'
        })
      });

      if (!response.ok) throw new Error('Failed to reject withdrawal');
      toast.success('Withdrawal rejected successfully');
      setShowRejectModal(false);
      setSelectedWithdrawal(null);
      fetchWithdrawals();
    } catch (error) {
      toast.error(error.message || 'Failed to reject withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    if (!approveForm.utrNo || !approveForm.transferDate || !approveForm.transferTime) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API}/payment/admin/withdrawal-request/${selectedWithdrawal._id}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactionReference: approveForm.utrNo,
          utrNo: approveForm.utrNo,
          transferDate: approveForm.transferDate,
          transferTime: approveForm.transferTime,
          notes: approveForm.adminRemark
        })
      });

      if (!response.ok) throw new Error('Failed to approve withdrawal');
      toast.success('Withdrawal approved successfully');
      setShowApproveModal(false);
      setSelectedWithdrawal(null);
      fetchWithdrawals();
    } catch (error) {
      toast.error(error.message || 'Failed to approve withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      requested: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
      processing: 'bg-blue-50 text-blue-700 border border-blue-200',
      completed: 'bg-green-50 text-green-700 border border-green-200',
      rejected: 'bg-red-50 text-red-700 border border-red-200'
    };

    return `px-3 py-1.5 rounded-full text-xs font-medium ${statusConfig[status] || 'bg-gray-100 text-gray-800 border border-gray-200'}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto mb-3"></div>
          <p className="text-gray-600 font-roboto">Loading withdrawal requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-poppins">
      <ToastContainer />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 font-roboto">Payout Management</h1>
        <p className="text-gray-600 font-poppins">Manage provider withdrawal requests and process payments</p>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-6">
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-poppins">Total Withdrawals</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 font-roboto">{total}</p>
              </div>
              <div className="bg-primary/10 p-3 rounded-lg">
                <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-poppins">Pending</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1 font-roboto">
                  {withdrawals.filter(w => w.status === 'requested').length}
                </p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-poppins">Completed</p>
                <p className="text-2xl font-bold text-green-600 mt-1 font-roboto">
                  {withdrawals.filter(w => w.status === 'completed').length}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-poppins">This Page</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 font-roboto">{withdrawals.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900 font-roboto">Filters & Search</h2>
          <button
            onClick={clearFilters}
            className="text-sm text-gray-600 hover:text-primary flex items-center gap-1 font-poppins"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
              Status
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="requested">Requested</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
              Start Date
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
              End Date
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
              Search Provider
            </label>
            <div className="relative">
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 pl-9 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
                placeholder="Name, email, or phone"
                value={filters.providerSearch}
                onChange={(e) => handleFilterChange('providerSearch', e.target.value)}
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
              Sort By
            </label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            >
              <option value="">Default Sorting</option>
              <option value="amount_desc">Amount (High to Low)</option>
              <option value="amount_asc">Amount (Low to High)</option>
              <option value="createdAt_desc">Newest First</option>
              <option value="createdAt_asc">Oldest First</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchWithdrawals}
              className="bg-primary text-white px-5 py-2.5 rounded-md hover:bg-teal-700 transition-colors flex items-center gap-2 font-poppins font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 font-roboto">Withdrawal Requests</h2>
            <p className="text-sm text-gray-600 font-poppins">{total} total requests</p>
          </div>
          <button
            onClick={fetchWithdrawals}
            className="text-primary hover:text-teal-700 flex items-center gap-1 text-sm font-medium font-poppins"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-roboto">
                  Provider Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-roboto">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-roboto">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-roboto">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider font-roboto">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {withdrawals.map((withdrawal) => (
                <tr key={withdrawal._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900 font-roboto">{withdrawal.provider?.name || 'N/A'}</div>
                      <div className="text-sm text-gray-600 font-poppins mt-1">{withdrawal.provider?.email || 'N/A'}</div>
                      <div className="text-xs text-gray-500 font-poppins">{withdrawal.provider?.phone || 'N/A'}</div>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded font-poppins">
                        ID: {withdrawal.provider?._id?.substring(0, 8) || 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-lg text-gray-900 font-roboto">
                      ₹{withdrawal.amount?.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-600 font-poppins capitalize mt-1">
                      {withdrawal.withdrawalType || 'Bank Transfer'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={getStatusBadge(withdrawal.status)}>
                      {withdrawal.status?.charAt(0).toUpperCase() + withdrawal.status?.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-roboto">{formatDate(withdrawal.createdAt)}</div>
                    <div className="text-xs text-gray-500 font-poppins">{formatDateTime(withdrawal.createdAt).split(',')[1]}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleView(withdrawal)}
                        className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition-colors flex items-center gap-1 font-poppins"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      {(withdrawal.status === 'requested' || withdrawal.status === 'processing') && (
                        <>
                          <button
                            onClick={() => handleApprove(withdrawal)}
                            className="text-sm bg-primary text-white px-3 py-1.5 rounded hover:bg-teal-700 transition-colors flex items-center gap-1 font-poppins"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(withdrawal)}
                            className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 transition-colors flex items-center gap-1 font-poppins"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Reject
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

        {withdrawals.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 text-gray-300 mb-4">
              <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 11H5a1 1 0 000 2h14a1 1 0 000-2zM12 2a10 10 0 100 20 10 10 0 000-20z"/>
              </svg>
            </div>
            <p className="text-gray-500 text-base font-medium font-roboto">No withdrawal requests found</p>
            <p className="text-gray-400 text-sm mt-1 font-poppins">Try adjusting your filters or check back later</p>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700 font-poppins">
                Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
                <span className="font-medium">{total}</span> requests
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                  className="px-3 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-poppins"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.ceil(total / limit) }, (_, i) => i + 1)
                    .filter(p => p >= page - 1 && p <= page + 1)
                    .map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-9 h-9 flex items-center justify-center rounded text-sm ${
                          p === page
                            ? 'bg-primary text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        } transition-colors font-poppins`}
                      >
                        {p}
                      </button>
                    ))}
                </div>
                <button
                  onClick={() => setPage(prev => prev + 1)}
                  disabled={page >= Math.ceil(total / limit)}
                  className="px-3 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-poppins"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {showApproveModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 font-roboto">Approve Withdrawal</h2>
                <p className="text-sm text-gray-600 font-poppins">Enter transaction details to approve</p>
              </div>
              <button
                onClick={() => setShowApproveModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 p-4 bg-green-50 rounded border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                    <path d="M16 11h-4a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 00-1-1z"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-green-800 font-roboto">Approving: ₹{selectedWithdrawal.amount?.toLocaleString()}</p>
                  <p className="text-sm text-green-700 font-poppins">Provider: {selectedWithdrawal.provider?.name}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
                  UTR Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
                  value={approveForm.utrNo}
                  onChange={(e) => setApproveForm(prev => ({ ...prev, utrNo: e.target.value }))}
                  placeholder="Enter UTR/Transaction reference"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
                    Transfer Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
                    value={approveForm.transferDate}
                    onChange={(e) => setApproveForm(prev => ({ ...prev, transferDate: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
                    Transfer Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
                    value={approveForm.transferTime}
                    onChange={(e) => setApproveForm(prev => ({ ...prev, transferTime: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
                  Admin Remark (Optional)
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
                  rows="3"
                  value={approveForm.adminRemark}
                  onChange={(e) => setApproveForm(prev => ({ ...prev, adminRemark: e.target.value }))}
                  placeholder="Add any notes or remarks..."
                />
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowApproveModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 px-4 rounded hover:bg-gray-200 transition-colors font-poppins font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-primary text-white py-2.5 px-4 rounded hover:bg-teal-700 transition-colors font-poppins font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    'Approve Payment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 font-roboto">Reject Withdrawal</h2>
                <p className="text-sm text-gray-600 font-poppins">Provide reason for rejection</p>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 p-4 bg-red-50 rounded border border-red-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                    <path d="M15 9l-6 6m0-6l6 6"/>
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-red-800 font-roboto">Rejecting: ₹{selectedWithdrawal.amount?.toLocaleString()}</p>
                  <p className="text-sm text-red-700 font-poppins">Provider will be notified of the rejection</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-poppins text-sm"
                  rows="4"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a clear reason for rejecting this withdrawal request..."
                />
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 px-4 rounded hover:bg-gray-200 transition-colors font-poppins font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-red-600 text-white py-2.5 px-4 rounded hover:bg-red-700 transition-colors font-poppins font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </>
                  ) : (
                    'Reject Withdrawal'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 font-roboto">Withdrawal Details</h2>
                <p className="text-sm text-gray-600 font-poppins">Complete information about this withdrawal request</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Provider Card */}
                <div className="bg-gray-50 rounded p-5 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 font-roboto">Provider Information</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 font-poppins">Full Name</p>
                      <p className="font-medium text-gray-900 font-roboto">{selectedDetails.provider?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-poppins">Email Address</p>
                      <p className="font-medium text-gray-900 font-roboto">{selectedDetails.provider?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-poppins">Phone Number</p>
                      <p className="font-medium text-gray-900 font-roboto">{selectedDetails.provider?.phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Bank Details Card */}
                <div className="bg-gray-50 rounded p-5 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 font-roboto">Bank Details</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 font-poppins">Account Holder</p>
                      <p className="font-medium text-gray-900 font-roboto">{selectedDetails.paymentDetails?.accountName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-poppins">Bank Name</p>
                      <p className="font-medium text-gray-900 font-roboto">{selectedDetails.provider?.bankDetails?.bankName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-poppins">Account Number</p>
                      <p className="font-mono font-medium text-gray-900 font-roboto">
                        {selectedDetails.provider?.bankDetails?.accountNo
                          ? '••••' + selectedDetails.provider.bankDetails.accountNo.slice(-4)
                          : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-poppins">IFSC Code</p>
                      <p className="font-mono font-medium text-gray-900 font-roboto">{selectedDetails.provider?.bankDetails?.ifsc || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Transaction Card */}
                <div className="bg-gray-50 rounded p-5 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 font-roboto">Transaction Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded p-4">
                      <p className="text-sm text-gray-600 font-poppins">Amount</p>
                      <p className="text-2xl font-bold text-primary mt-2 font-roboto">₹{selectedDetails.amount?.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded p-4">
                      <p className="text-sm text-gray-600 font-poppins">Type</p>
                      <p className="text-lg font-semibold text-gray-900 mt-2 font-roboto capitalize">
                        {selectedDetails.withdrawalType || 'Bank Transfer'}
                      </p>
                    </div>
                    <div className="bg-white rounded p-4">
                      <p className="text-sm text-gray-600 font-poppins">Status</p>
                      <span className={`inline-block mt-2 ${getStatusBadge(selectedDetails.status)}`}>
                        {selectedDetails.status?.charAt(0).toUpperCase() + selectedDetails.status?.slice(1)}
                      </span>
                    </div>
                    <div className="bg-white rounded p-4">
                      <p className="text-sm text-gray-600 font-poppins">Requested</p>
                      <p className="text-sm font-medium text-gray-900 mt-2 font-roboto">{formatDateTime(selectedDetails.createdAt)}</p>
                    </div>
                  </div>
                </div>

                {/* Additional Info Card */}
                <div className="bg-gray-50 rounded p-5 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 font-roboto">Additional Information</h3>
                  
                  {selectedDetails.utrNo && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 font-poppins">UTR Number</p>
                      <p className="font-mono font-medium text-gray-900 font-roboto">{selectedDetails.utrNo}</p>
                    </div>
                  )}

                  {selectedDetails.transferDate && selectedDetails.transferTime && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 font-poppins">Transfer Date & Time</p>
                      <p className="font-medium text-gray-900 font-roboto">
                        {formatDate(selectedDetails.transferDate)} at {selectedDetails.transferTime}
                      </p>
                    </div>
                  )}

                  {selectedDetails.adminRemark && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 font-poppins">Admin Remark</p>
                      <p className="text-gray-900 bg-white p-3 rounded mt-1 font-poppins text-sm">{selectedDetails.adminRemark}</p>
                    </div>
                  )}

                  {selectedDetails.rejectionReason && (
                    <div>
                      <p className="text-sm text-gray-600 font-poppins">Rejection Reason</p>
                      <p className="text-red-600 bg-red-50 p-3 rounded mt-1 font-poppins text-sm">{selectedDetails.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayout;