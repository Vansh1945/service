import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import {
  Search,
  MessageSquare,
  Eye,
  Reply,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Mail,
  Filter,
  Calendar,
  Phone,
  RefreshCw
} from 'lucide-react';

// Status Badge Component
const StatusBadge = ({ status }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'NEW':
        return { 
          color: 'bg-blue-50 text-blue-700 border-blue-200', 
          icon: AlertCircle,
          iconColor: 'text-blue-600'
        };
      case 'REPLIED':
        return { 
          color: 'bg-green-50 text-green-700 border-green-200', 
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      default:
        return { 
          color: 'bg-gray-50 text-gray-700 border-gray-200', 
          icon: MessageSquare,
          iconColor: 'text-gray-600'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${config.color}`}>
      <Icon className={`w-4 h-4 mr-2 ${config.iconColor}`} />
      {status === 'NEW' ? 'New' : status === 'REPLIED' ? 'Replied' : status}
    </span>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, icon: Icon, trend, trendValue }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
        <p className="text-2xl font-bold text-secondary">{value}</p>
      </div>
      <div className="p-3 rounded-lg bg-primary/10">
        <Icon className="w-6 h-6 text-primary" />
      </div>
    </div>
  </div>
);

// Contact Details Modal
const ContactDetailsModal = ({ contact, onClose, onReply }) => {
  const [replyMessage, setReplyMessage] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const { showToast } = useAuth();

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

  const handleReply = async () => {
    if (!replyMessage.trim()) {
      showToast('Please enter a reply message', 'error');
      return;
    }

    setIsReplying(true);
    try {
      await onReply(contact._id, replyMessage);
      setReplyMessage('');
      showToast('Reply sent successfully', 'success');
      onClose();
    } catch (error) {
      showToast('Failed to send reply', 'error');
    } finally {
      setIsReplying(false);
    }
  };

  if (!contact) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-secondary">Contact Details</h3>
              <p className="text-sm text-gray-600">ID: #{contact._id?.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Contact Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium text-secondary">{contact.name}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-secondary">{contact.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium text-secondary">{contact.phone || 'Not provided'}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <MessageSquare className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-gray-600">Subject</p>
                  <p className="font-medium text-secondary">{contact.subject}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="font-medium text-secondary">{formatDate(contact.createdAt)}</p>
                  </div>
                </div>
                <StatusBadge status={contact.status} />
              </div>
            </div>
          </div>

          {/* Original Message */}
          <div>
            <h4 className="text-lg font-semibold text-secondary mb-3">Message</h4>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{contact.message}</p>
            </div>
          </div>

          {/* Admin Reply */}
          {contact.adminReply && (
            <div className="bg-green-50 border-l-4 border-green-500 rounded-r-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-lg font-semibold text-secondary">Admin Reply</h4>
                <span className="text-sm text-gray-600">{formatDate(contact.adminReply.repliedAt)}</span>
              </div>
              <div className="bg-white p-4 rounded-lg border border-green-100">
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{contact.adminReply.message}</p>
              </div>
            </div>
          )}

          {/* Reply Form */}
          {contact.status !== 'REPLIED' && (
            <div className="border-t pt-6">
              <h4 className="text-lg font-semibold text-secondary mb-4">Send Reply</h4>
              <div className="space-y-4">
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your response here..."
                  rows="4"
                  className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
                />
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReply}
                    disabled={isReplying || !replyMessage.trim()}
                    className="px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center"
                  >
                    {isReplying ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Reply className="w-4 h-4 mr-2" />
                        Send Reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Component
const UserContacts = () => {
  const { token, API, showToast } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filters, setFilters] = useState({
    status: '',
    search: '',
    dateRange: 'month'
  });

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrev: false
  });

  const statusOptions = [
    { value: '', label: 'All Status', icon: Filter },
    { value: 'NEW', label: 'New', icon: AlertCircle },
    { value: 'REPLIED', label: 'Replied', icon: CheckCircle }
  ];

  // Fetch contacts
  const fetchContacts = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.status) queryParams.append('status', filters.status);
      if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);

      const response = await fetch(`${API}/contact/admin?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch contacts');

      const data = await response.json();

      if (data.success) {
        setContacts(data.data || []);
        setPagination(prev => ({
          ...prev,
          total: data.pagination?.totalContacts || 0,
          pages: data.pagination?.totalPages || 1,
          hasNext: data.pagination?.hasNext || false,
          hasPrev: data.pagination?.hasPrev || false
        }));
      } else {
        showToast(data.message || 'Failed to fetch contacts', 'error');
      }
    } catch (error) {
      showToast('Error fetching contacts', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch contact details
  const fetchContactDetails = async (contactId) => {
    try {
      const response = await fetch(`${API}/contact/${contactId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch contact details');

      const data = await response.json();

      if (data.success) {
        setSelectedContact(data.data);
        setShowModal(true);
      } else {
        showToast(data.message || 'Failed to fetch contact details', 'error');
      }
    } catch (error) {
      showToast('Failed to fetch contact details', 'error');
    }
  };

  // Reply to contact
  const replyToContact = async (contactId, message) => {
    try {
      const response = await fetch(`${API}/contact/${contactId}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      if (!response.ok) throw new Error('Failed to send reply');

      const data = await response.json();

      if (data.success) {
        await fetchContacts();
        return true;
      } else {
        throw new Error(data.message || 'Failed to send reply');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      search: '',
      dateRange: 'month'
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchContacts();
  };

  const nextPage = () => {
    if (pagination.hasNext) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const prevPage = () => {
    if (pagination.hasPrev) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Stats
  const newCount = contacts.filter(c => c.status === 'NEW').length;
  const repliedCount = contacts.filter(c => c.status === 'REPLIED').length;

  useEffect(() => {
    fetchContacts();
  }, [filters, pagination.page, pagination.limit]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-secondary">User Contacts</h1>
              <p className="text-gray-600 mt-2">Manage and respond to user inquiries and messages</p>
            </div>

          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatsCard
              title="Total Contacts"
              value={pagination.total}
              icon={MessageSquare}
              trend="up"
              trendValue="12"
            />
            <StatsCard
              title="New Messages"
              value={newCount}
              icon={AlertCircle}
              trend="down"
              trendValue="5"
            />
            <StatsCard
              title="Replied"
              value={repliedCount}
              icon={CheckCircle}
              trend="up"
              trendValue="18"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <h3 className="text-lg font-bold text-secondary">Filters</h3>
            <div className="flex items-center space-x-3">
              <button
                onClick={clearFilters}
                className="text-sm text-primary hover:text-teal-700 font-medium"
              >
                Clear All
              </button>
              <select
                value={filters.dateRange}
                onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or subject..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map(option => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleFilterChange('status', option.value)}
                    className={`px-4 py-2.5 rounded-lg border transition-colors flex items-center ${
                      filters.status === option.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-secondary">All Contacts</h3>
                <p className="text-sm text-gray-600">{pagination.total} total messages</p>
              </div>
              <div className="flex items-center space-x-3 text-sm">
                <span className="text-gray-600">Show:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {[5, 10, 25, 50].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                    Subject & Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-32"></div>
                            <div className="h-3 bg-gray-200 rounded w-24"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-40"></div>
                          <div className="h-3 bg-gray-200 rounded w-32"></div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-6 bg-gray-200 rounded w-20"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-8 bg-gray-200 rounded w-24"></div>
                      </td>
                    </tr>
                  ))
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-secondary mb-2">No Contacts Found</h3>
                        <p className="text-gray-600 max-w-md">
                          {Object.values(filters).some(filter => filter && filter !== 'month')
                            ? 'Try adjusting your filters to see more results.'
                            : 'No contact messages have been submitted yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact._id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-secondary">{contact.name}</p>
                            <p className="text-sm text-gray-600">{contact.email}</p>
                            {contact.phone && (
                              <p className="text-xs text-gray-500 flex items-center">
                                <Phone className="w-3 h-3 mr-1" />
                                {contact.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-secondary">{contact.subject}</p>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {contact.message.substring(0, 80)}...
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={contact.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-secondary">{formatDate(contact.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => fetchContactDetails(contact._id)}
                            className="p-2 text-gray-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {contact.status !== 'REPLIED' && (
                            <button
                              onClick={() => fetchContactDetails(contact._id)}
                              className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span> results
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={prevPage}
                    disabled={!pagination.hasPrev}
                    className="px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </button>
                  
                  <div className="hidden sm:flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNumber;
                      if (pagination.pages <= 5) {
                        pageNumber = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNumber = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNumber = pagination.pages - 4 + i;
                      } else {
                        pageNumber = pagination.page - 2 + i;
                      }

                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setPagination(prev => ({ ...prev, page: pageNumber }))}
                          className={`w-8 h-8 text-sm rounded ${
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
                    disabled={!pagination.hasNext}
                    className="px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contact Details Modal */}
        {showModal && selectedContact && (
          <ContactDetailsModal
            contact={selectedContact}
            onClose={() => setShowModal(false)}
            onReply={replyToContact}
          />
        )}
      </div>
    </div>
  );
};

export default UserContacts;