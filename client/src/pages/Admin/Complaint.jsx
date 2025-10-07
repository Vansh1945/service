// src/pages/admin/ComplaintsPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import axios from 'axios';
import {
  Search,
  Filter,
  Calendar,
  MessageSquare,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  X,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Mail,
  Phone
} from 'lucide-react';

// Stats Cards Component
const StatsCard = ({ title, value, icon: Icon, color, bgColor }) => (
  <div className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm ${bgColor}`}>
    <div className="flex items-center">
      <div className={`p-2 rounded-full ${bgColor}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="ml-3">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-lg font-bold text-secondary">{value}</p>
      </div>
    </div>
  </div>
);

// Status Badge Component
const StatusBadge = ({ status }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'Open':
        return { color: 'text-blue-600 bg-blue-50 border-blue-200', label: 'Open' };
      case 'In-Progress':
        return { color: 'text-yellow-600 bg-yellow-50 border-yellow-200', label: 'In Progress' };
      case 'Solved':
        return { color: 'text-green-600 bg-green-50 border-green-200', label: 'Solved' };
      case 'Reopened':
        return { color: 'text-orange-600 bg-orange-50 border-orange-200', label: 'Reopened' };
      case 'Closed':
        return { color: 'text-gray-600 bg-gray-50 border-gray-200', label: 'Closed' };
      default:
        return { color: 'text-gray-600 bg-gray-50 border-gray-200', label: status };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.label}
    </span>
  );
};



// Complaint Details Modal Component
const ComplaintDetailsModal = ({ complaint, onClose, onUpdateStatus, onResolve }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [statusUpdate, setStatusUpdate] = useState(complaint?.status || '');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const { token, API, showToast } = useAuth();

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };



  const handleStatusUpdate = async () => {
    if (!statusUpdate) {
      showToast('Please select a status', 'error');
      return;
    }

    try {
      await onUpdateStatus(complaint._id, statusUpdate);
      showToast('Status updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      showToast('Resolution notes are required', 'error');
      return;
    }

    try {
      await onResolve(complaint._id, resolutionNotes);
      setResolutionNotes('');
      showToast('Complaint resolved successfully', 'success');
    } catch (error) {
      showToast('Failed to resolve complaint', 'error');
    }
  };

  if (!complaint) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-xl font-bold text-secondary">Complaint Details</h3>
            <p className="text-sm text-gray-600">ID: #{complaint._id?.slice(-8)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {['details', 'timeline', 'actions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Complaint Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-lg text-secondary mb-4">Complaint Information</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Title:</span>
                      <span className="font-medium text-secondary text-right">{complaint.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <StatusBadge status={complaint.status} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Category:</span>
                      <span className="font-medium text-secondary">{complaint.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Created:</span>
                      <span className="text-sm text-gray-600">{formatDate(complaint.createdAt)}</span>
                    </div>
                    {complaint.resolvedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Resolved:</span>
                        <span className="text-sm text-gray-600">{formatDate(complaint.resolvedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Parties Involved */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-lg text-secondary mb-4">Parties Involved</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Customer</h5>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-secondary">{complaint.customer?.name || 'N/A'}</p>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            <span>{complaint.customer?.email || 'N/A'}</span>
                          </div>
                          {complaint.customer?.phone && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Phone className="w-3 h-3" />
                              <span>{complaint.customer.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Service Provider</h5>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-secondary">{complaint.provider?.name || 'N/A'}</p>
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Mail className="w-3 h-3" />
                            <span>{complaint.provider?.email || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Booking Reference</h5>
                      <p className="text-secondary font-medium">#{complaint.booking?.bookingId || complaint.booking?._id?.slice(-8) || 'N/A'}</p>
                      {complaint.booking?.date && (
                        <p className="text-sm text-gray-600">Date: {formatDate(complaint.booking.date)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-lg text-secondary mb-3">Description</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{complaint.description}</p>
              </div>

              {/* Images */}
              {complaint.images && complaint.images.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-lg text-secondary mb-3">Attached Images</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {complaint.images.map((image, index) => (
                      <img
                        key={index}
                        src={image.secure_url}
                        alt={`Complaint evidence ${index + 1}`}
                        className="rounded-lg w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(image.secure_url, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-lg text-secondary">Status History</h4>
              <div className="space-y-3">
                {(complaint.statusHistory || []).length > 0 ? (
                  complaint.statusHistory.map((history, index) => (
                    <div key={index} className="flex items-start space-x-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-primary rounded-full mt-1"></div>
                        {index < complaint.statusHistory.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-300 mt-1"></div>
                        )}
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-medium text-secondary">{history.status}</span>
                          <span className="text-xs text-gray-500">{formatDate(history.updatedAt)}</span>
                        </div>
                        {history.status === 'Solved' && complaint.resolutionNotes && (
                          <div className="mt-2 p-2 bg-green-50 rounded border-l-4 border-green-400">
                            <p className="text-sm text-gray-700">
                              <strong>Resolution Notes:</strong> {complaint.resolutionNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No status history available</p>
                )}
              </div>

              {/* Reopen History */}
              {(complaint.reopenHistory || []).length > 0 && (
                <div className="mt-6">
                  <h5 className="font-semibold text-secondary mb-3">Reopen History</h5>
                  <div className="space-y-3">
                    {complaint.reopenHistory.map((history, index) => (
                      <div key={index} className="flex items-start space-x-4">
                        <div className="flex flex-col items-center">
                          <div className="w-3 h-3 bg-orange-500 rounded-full mt-1"></div>
                          {index < complaint.reopenHistory.length - 1 && (
                            <div className="w-0.5 h-8 bg-gray-300 mt-1"></div>
                          )}
                        </div>
                        <div className="flex-1 bg-orange-50 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium text-secondary">Reopened</span>
                            <span className="text-xs text-gray-500">{formatDate(history.reopenedAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700">{history.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}



          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              {/* Update Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-lg text-secondary mb-3">Update Status</h4>
                <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
                  <select
                    value={statusUpdate}
                    onChange={(e) => setStatusUpdate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select Status</option>
                    <option value="Open">Open</option>
                    <option value="In-Progress">In Progress</option>
                    <option value="Solved">Solved</option>
                    <option value="Reopened">Reopened</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <button
                    onClick={handleStatusUpdate}
                    disabled={!statusUpdate}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Update Status
                  </button>
                </div>
              </div>

              {/* Resolve Complaint */}
              {complaint.status !== 'Solved' && complaint.status !== 'Closed' && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-lg text-secondary mb-3">Resolve Complaint</h4>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Enter resolution notes..."
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary mb-3"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleResolve}
                      disabled={!resolutionNotes.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

// Main Complaints Page Component
const ComplaintsPage = () => {
  const { token, API, showToast } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [filters, setFilters] = useState({
    status: '',
    category: '',
    search: '',
    startDate: '',
    endDate: ''
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'Open', label: 'Open' },
    { value: 'In-Progress', label: 'In Progress' },
    { value: 'Solved', label: 'Solved' },
    { value: 'Reopened', label: 'Reopened' },
    { value: 'Closed', label: 'Closed' }
  ];



  const categoryOptions = [
    { value: '', label: 'All Categories' },
    { value: 'Service issue', label: 'Service Issue' },
    { value: 'Payment issue', label: 'Payment Issue' },
    { value: 'Delivery issue', label: 'Delivery Issue' },
    { value: 'Suggestion', label: 'Suggestion' },
    { value: 'Other', label: 'Other' }
  ];

  // Fetch complaints using admin route
  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.status) queryParams.append('status', filters.status);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const response = await axios.get(`${API}/complaint?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.success) {
        setComplaints(response.data.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.total || 0,
          pages: response.data.pages || 1
        }));
      } else {
        showToast('Failed to fetch complaints', 'error');
      }
    } catch (error) {
      console.error('Error fetching complaints:', error);
      showToast('Error fetching complaints', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch complaint details using admin route
  const fetchComplaintDetails = async (complaintId) => {
    try {
      const response = await axios.get(`${API}/complaint/${complaintId}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.success) {
        setSelectedComplaint(response.data.data);
        setShowModal(true);
      } else {
        showToast('Failed to fetch complaint details', 'error');
      }
    } catch (error) {
      console.error('Error fetching complaint details:', error);
      showToast('Failed to fetch complaint details', 'error');
    }
  };

  // Update complaint status using admin route
  const updateComplaintStatus = async (complaintId, status) => {
    setUpdating(true);
    try {
      const response = await axios.put(
        `${API}/complaint/${complaintId}/status`,
        { status },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.success) {
        await fetchComplaints();
        if (selectedComplaint && selectedComplaint._id === complaintId) {
          setSelectedComplaint(prev => ({ ...prev, status }));
        }
        return true;
      } else {
        showToast('Failed to update status', 'error');
        return false;
      }
    } catch (error) {
      console.error('Error updating complaint status:', error);
      showToast('Failed to update status', 'error');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  // Resolve complaint using admin route
  const resolveComplaint = async (complaintId, resolutionNotes) => {
    setUpdating(true);
    try {
      const response = await axios.put(
        `${API}/complaint/${complaintId}/resolve`,
        { resolutionNotes },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.success) {
        await fetchComplaints();
        setShowModal(false);
        return true;
      } else {
        showToast('Failed to resolve complaint', 'error');
        return false;
      }
    } catch (error) {
      console.error('Error resolving complaint:', error);
      showToast('Failed to resolve complaint', 'error');
      return false;
    } finally {
      setUpdating(false);
    }
  };



  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      category: '',
      search: '',
      startDate: '',
      endDate: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const goToPage = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const nextPage = () => {
    if (pagination.page < pagination.pages) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const prevPage = () => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const stats = {
    total: pagination.total,
    open: complaints.filter(c => c.status === 'Open').length,
    inProgress: complaints.filter(c => c.status === 'In-Progress').length,
    solved: complaints.filter(c => c.status === 'Solved').length
  };

  useEffect(() => {
    fetchComplaints();
  }, [filters, pagination.page, pagination.limit]);

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-secondary">Complaint Management</h1>
              <p className="text-gray-600 mt-1">Manage and track customer complaints efficiently</p>
            </div>
            <button
              onClick={fetchComplaints}
              disabled={loading}
              className="flex items-center space-x-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Loading...' : 'Refresh'}</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Complaints"
              value={stats.total}
              icon={AlertTriangle}
              color="text-blue-600"
              bgColor="bg-blue-100"
            />
            <StatsCard
              title="Open"
              value={stats.open}
              icon={Clock}
              color="text-yellow-600"
              bgColor="bg-yellow-100"
            />
            <StatsCard
              title="In Progress"
              value={stats.inProgress}
              icon={RefreshCw}
              color="text-blue-600"
              bgColor="bg-blue-100"
            />
            <StatsCard
              title="Solved"
              value={stats.solved}
              icon={CheckCircle}
              color="text-green-600"
              bgColor="bg-green-100"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-secondary">Filters</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-primary hover:text-teal-700 transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Search</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search complaints..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>



            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">From</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">To</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Complaints Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-medium text-secondary">
              All Complaints ({pagination.total})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Complaint ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Title & Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Status
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-32"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 bg-gray-200 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-6 bg-gray-200 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-8 bg-gray-200 rounded w-16"></div>
                      </td>
                    </tr>
                  ))
                ) : complaints.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center">
                        <AlertTriangle className="w-12 h-12 text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-secondary mb-2">No Complaints Found</h3>
                        <p className="text-sm text-gray-500">
                          {Object.values(filters).some(filter => filter !== '') 
                            ? 'Try adjusting your filters to see more results.' 
                            : 'No complaints have been submitted yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  complaints.map((complaint) => (
                    <tr key={complaint._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-secondary">
                          #{(complaint._id || '').slice(-8)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-secondary">
                          {complaint.title || 'No Title'}
                        </div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {complaint.description || 'No description'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-secondary">
                          {complaint.customer?.name || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {complaint.customer?.email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={complaint.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                        {complaint.category || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary">
                        {formatDate(complaint.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => fetchComplaintDetails(complaint._id)}
                          className="text-primary hover:text-teal-700 transition-colors p-1 rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-secondary">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={prevPage}
                    disabled={pagination.page === 1}
                    className="flex items-center px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </button>

                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      const pageNumber = i + 1;
                      return (
                        <button
                          key={pageNumber}
                          onClick={() => goToPage(pageNumber)}
                          className={`px-3 py-1 rounded ${
                            pagination.page === pageNumber
                              ? 'bg-primary text-white'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={nextPage}
                    disabled={pagination.page === pagination.pages}
                    className="flex items-center px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Complaint Details Modal */}
        {showModal && selectedComplaint && (
          <ComplaintDetailsModal
            complaint={selectedComplaint}
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