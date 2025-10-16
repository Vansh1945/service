import React, { useState, useEffect } from 'react';
import {
  Eye,
  Mail,
  Phone,
  MessageSquare,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  User,
  Calendar,
  Reply,
  X
} from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../store/auth';

const AdminContact = () => {
  const { token, API } = useAuth();

  // State management
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    replied: 0,
    resolved: 0
  });

  // Reply form state
  const [replyMessage, setReplyMessage] = useState('');

  // Check admin access and fetch contacts
  useEffect(() => {
    fetchContacts();
  }, []);

  // Filter and search contacts
  useEffect(() => {
    let filtered = [...contacts];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(contact =>
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.message?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(contact => contact.status === statusFilter);
    }

    setFilteredContacts(filtered);
  }, [contacts, searchTerm, statusFilter]);

  // Calculate stats whenever contacts change
  useEffect(() => {
    const newStats = {
      total: contacts.length,
      pending: contacts.filter(c => c.status === 'pending').length,
      replied: contacts.filter(c => c.status === 'replied').length,
      resolved: contacts.filter(c => c.status === 'resolved').length
    };
    setStats(newStats);
  }, [contacts]);

  // Fetch all contacts
  const fetchContacts = async () => {
    try {
      const toastId = toast.loading('Fetching contacts...');
      const response = await fetch(`${API}/contact/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.clear();
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to fetch contacts');
      }

      const data = await response.json();
      setContacts(data.data || []);
      toast.update(toastId, {
        render: 'Contacts loaded successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });
    } catch (error) {
      console.error('Fetch contacts error:', error);
      toast.error(error.message || 'Failed to fetch contacts');
    }
  };

  // Handle view contact
  const handleViewContact = (contact) => {
    setSelectedContact(contact);
    setShowViewModal(true);
  };

  // Handle reply to contact
  const handleReplyContact = (contact) => {
    setSelectedContact(contact);
    setReplyMessage(contact.replyMessage || '');
    setShowReplyModal(true);
  };

  // Submit reply
  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) {
      toast.error('Reply message is required');
      return;
    }

    try {
      const toastId = toast.loading('Sending reply...');
      const response = await fetch(`${API}/contact/contact/${selectedContact._id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ replyMessage: replyMessage.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send reply');
      }

      const data = await response.json();

      // Update contact in state
      setContacts(prev => prev.map(c =>
        c._id === selectedContact._id
          ? { ...c, status: 'replied', repliedAt: new Date(), replyMessage: replyMessage.trim() }
          : c
      ));

      toast.update(toastId, {
        render: data.message || 'Reply sent successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });

      setShowReplyModal(false);
      setReplyMessage('');
    } catch (error) {
      console.error('Reply error:', error);
      toast.error(error.message || 'Failed to send reply');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status color and icon
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'pending':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: Clock,
          text: 'Pending'
        };
      case 'replied':
        return {
          color: 'bg-blue-100 text-blue-800',
          icon: Reply,
          text: 'Replied'
        };
      case 'resolved':
        return {
          color: 'bg-green-100 text-green-800',
          icon: CheckCircle,
          text: 'Resolved'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-800',
          icon: AlertCircle,
          text: 'Unknown'
        };
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentContacts = filteredContacts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-secondary">Contact Management</h1>
            <p className="text-gray-600 mt-1">Manage customer inquiries and responses</p>
          </div>
          <button
            onClick={fetchContacts}
            className="flex items-center bg-primary hover:bg-teal-800 text-white px-3 py-2 md:px-4 md:py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 text-sm"
          >
            <RefreshCw className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Contacts</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.total}</p>
              </div>
              <div className="p-2 md:p-3 bg-teal-100 rounded-full">
                <MessageSquare className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.pending}</p>
              </div>
              <div className="p-2 md:p-3 bg-yellow-100 rounded-full">
                <Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Replied</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.replied}</p>
              </div>
              <div className="p-2 md:p-3 bg-blue-100 rounded-full">
                <Reply className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-4 md:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolved</p>
                <p className="text-2xl md:text-3xl font-bold text-secondary">{stats.resolved}</p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-full">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <Filter className="text-gray-400 w-4 h-4 md:w-5 md:h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 md:px-4 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="replied">Replied</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Contacts Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {currentContacts.length === 0 ? (
            <div className="text-center py-12 md:py-16">
              <MessageSquare className="w-12 h-12 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 md:mb-4" />
              <p className="text-gray-600 text-md md:text-lg">No contacts found</p>
              <p className="text-gray-400 text-sm mt-1 md:mt-2">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'No contact inquiries yet'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentContacts.map((contact) => {
                      const statusInfo = getStatusDisplay(contact.status);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <tr key={contact._id} className="hover:bg-gray-50 transition-colors duration-200">
                          <td className="px-4 md:px-6 py-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 md:h-12 md:w-12">
                                <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center">
                                  <User className="w-5 h-5 md:w-6 md:h-6 text-teal-600" />
                                </div>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-secondary">{contact.name}</div>
                                <div className="text-xs text-gray-500 flex items-center">
                                  <Mail className="w-3 h-3 mr-1" />
                                  {contact.email}
                                </div>
                                {contact.phone && (
                                  <div className="text-xs text-gray-500 flex items-center">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {contact.phone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4">
                            <div className="text-sm text-gray-600 truncate max-w-xs">
                              {contact.subject || 'No Subject'}
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4">
                            <div className="text-sm text-gray-600 truncate max-w-xs">
                              {contact.message.substring(0, 80)}...
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusInfo.text}
                            </span>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4 text-gray-400 mr-1" />
                              <span className="text-sm text-gray-600">
                                {formatDate(contact.createdAt)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewContact(contact)}
                                className="text-primary hover:text-teal-800 p-1 rounded transition-colors duration-200"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleReplyContact(contact)}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors duration-200"
                                title="Reply to Contact"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-4 md:px-6 py-4 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between bg-gray-50 gap-3">
                  <div className="text-sm text-gray-600">
                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredContacts.length)} of {filteredContacts.length} results
                  </div>
                  <div className="flex items-center space-x-1 md:space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 md:px-3 md:py-2 text-sm text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-2 py-1 md:px-3 md:py-2 text-sm rounded-lg ${currentPage === page
                            ? 'bg-primary text-white'
                            : 'text-gray-600 hover:text-primary hover:bg-gray-100'
                            }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 md:px-3 md:py-2 text-sm text-gray-600 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* View Contact Modal */}
        {showViewModal && selectedContact && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title="Contact Details"
            size="large"
          >
            <div className="space-y-6">
              {/* Contact Header */}
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center">
                    <User className="w-8 h-8 text-teal-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                    <h3 className="text-2xl md:text-3xl font-bold text-secondary">{selectedContact.name}</h3>
                    {(() => {
                      const statusInfo = getStatusDisplay(selectedContact.status);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-4 h-4 mr-1" />
                          {statusInfo.text}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center text-gray-600">
                      <Mail className="w-4 h-4 mr-2 text-teal-600" />
                      <span className="text-sm">{selectedContact.email}</span>
                    </div>
                    {selectedContact.phone && (
                      <div className="flex items-center text-gray-600">
                        <Phone className="w-4 h-4 mr-2 text-teal-600" />
                        <span className="text-sm">{selectedContact.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center text-gray-600">
                      <Calendar className="w-4 h-4 mr-2 text-teal-600" />
                      <span className="text-sm">Submitted: {formatDate(selectedContact.createdAt)}</span>
                    </div>
                    {selectedContact.repliedAt && (
                      <div className="flex items-center text-gray-600">
                        <Reply className="w-4 h-4 mr-2 text-blue-600" />
                        <span className="text-sm">Replied: {formatDate(selectedContact.repliedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Message */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                <h4 className="text-lg font-semibold text-secondary mb-4 flex items-center">
                  <MessageSquare className="w-5 h-5 mr-2 text-teal-600" />
                  Message
                </h4>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedContact.message}</p>
                </div>
              </div>

              {/* Reply Message */}
              {selectedContact.replyMessage && (
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                  <h4 className="text-lg font-semibold text-secondary mb-4 flex items-center">
                    <Reply className="w-5 h-5 mr-2 text-blue-600" />
                    Your Reply
                  </h4>
                  <div className="bg-white p-4 rounded-lg border border-blue-200">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedContact.replyMessage}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleReplyContact(selectedContact);
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {selectedContact.replyMessage ? 'Update Reply' : 'Reply'}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Reply Modal */}
        {showReplyModal && selectedContact && (
          <Modal
            isOpen={showReplyModal}
            onClose={() => setShowReplyModal(false)}
            title={`Reply to ${selectedContact.name}`}
            size="large"
          >
            <form onSubmit={handleSubmitReply} className="space-y-6">
              {/* Original Message */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Original Message:</h4>
                <div className="bg-white p-3 rounded border border-gray-200">
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{selectedContact.message}</p>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  From: {selectedContact.name} ({selectedContact.email})
                  {selectedContact.phone && ` • Phone: ${selectedContact.phone}`}
                </div>
              </div>

              {/* Reply Message */}
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Your Reply *
                </label>
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  required
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-vertical"
                  placeholder="Type your reply message here..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  This reply will be sent to the customer's email address.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowReplyModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-800 transition-colors duration-200 flex items-center"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Reply
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
};

// Reusable Modal Component
const Modal = ({ isOpen, onClose, title, children, size = 'medium' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    medium: 'sm:max-w-lg',
    large: 'sm:max-w-2xl',
    xlarge: 'sm:max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className={`inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle ${sizeClasses[size]} sm:w-full`}>
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-secondary">{title}</h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminContact;
