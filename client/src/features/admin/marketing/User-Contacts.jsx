import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/auth';
import * as ContactService from '../../../services/ContactService';
import Pagination from '../../../components/ui/Pagination';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import { formatDate, formatDateTime } from '../../../utils/format';
import StatCard from '../../../components/ui/StatCard';
import { AdminLocalFilterBar } from '../../../components/AdminFilterBar';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import {
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

// Contact Details Modal
const ContactDetailsModal = ({ contact, onClose, onReply }) => {
  const [replyMessage, setReplyMessage] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const { showToast } = useAuth();

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
      console.error(error);
      showToast('Failed to send reply', 'error');
    } finally {
      setIsReplying(false);
    }
  };

  if (!contact) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-neutral-100 flex flex-col animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-neutral-900 font-inter tracking-tight">Contact Details</h3>
                <span className="bg-neutral-100 text-neutral-600 font-mono text-[11px] px-2 py-0.5 rounded-md font-semibold tracking-wider">
                  #{contact._id?.slice(-8).toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-inter mt-0.5">Submitted User Inquiry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-80px)] font-inter">
          {/* Contact Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-neutral-50/80 border border-neutral-200/70 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Name</p>
                <p className="text-xs sm:text-sm font-semibold text-neutral-800 truncate">{contact.name}</p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-50/80 border border-neutral-200/70 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Email</p>
                <p className="text-xs sm:text-sm font-semibold text-neutral-800 truncate">{contact.email}</p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-50/80 border border-neutral-200/70 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Phone</p>
                <p className="text-xs sm:text-sm font-semibold text-neutral-800 truncate">{contact.phone || 'Not provided'}</p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-50/80 border border-neutral-200/70 rounded-xl flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Subject</p>
                <p className="text-xs sm:text-sm font-semibold text-neutral-800 truncate">{contact.subject}</p>
              </div>
            </div>

            <div className="p-3.5 bg-neutral-50/80 border border-neutral-200/70 rounded-xl sm:col-span-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Created At</p>
                  <p className="text-xs font-semibold text-neutral-800">{formatDateTime(contact.createdAt)}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                contact.status === 'REPLIED'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {contact.status === 'REPLIED' ? (
                  <CheckCircle className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 mr-1" />
                )}
                {contact.status}
              </span>
            </div>
          </div>

          {/* Original Message */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Message</h4>
            <div className="bg-neutral-50 border border-neutral-200/80 p-4 rounded-xl text-xs sm:text-sm font-normal text-neutral-800 leading-relaxed whitespace-pre-wrap shadow-inner">
              {contact.message}
            </div>
          </div>

          {/* Admin Reply */}
          {contact.adminReply && (
            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Admin Reply
                </h4>
                <span className="text-[11px] font-medium text-emerald-700">{formatDateTime(contact.adminReply.repliedAt)}</span>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-emerald-100 text-xs sm:text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed shadow-sm">
                {contact.adminReply.message}
              </div>
            </div>
          )}

          {/* Reply Form */}
          {contact.status !== 'REPLIED' && (
            <div className="border-t border-neutral-100 pt-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-700 mb-2.5">Send Reply</h4>
              <div className="space-y-3.5">
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your response here..."
                  rows="4"
                  className="w-full p-3.5 text-xs sm:text-sm font-normal text-neutral-800 placeholder-neutral-400 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-sm"
                />
                <div className="flex justify-end gap-2.5">
                  <button
                    onClick={onClose}
                    className="px-4 py-2.5 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReply}
                    disabled={isReplying || !replyMessage.trim()}
                    className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center gap-2 active:scale-95"
                  >
                    {isReplying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Reply className="w-3.5 h-3.5" />
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
  const { reset, refresh } = useAdminFilter();
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

  const [searchParams] = useSearchParams();
  const searchParamQuery = searchParams.get('search') || '';

  useEffect(() => {
    setFilters(prev => ({ ...prev, search: searchParamQuery }));
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchParamQuery]);

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
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status || undefined,
        search: filters.search || undefined,
        dateRange: filters.dateRange || undefined
      };

      const res = await ContactService.getAllContacts(params);
      const data = res.data;

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
      console.error(error);
      showToast('Error fetching contacts', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch contact details
  const fetchContactDetails = async (contactId) => {
    try {
      const res = await ContactService.getContactById(contactId);
      const data = res.data;

      if (data.success) {
        setSelectedContact(data.data);
        setShowModal(true);
      } else {
        showToast(data.message || 'Failed to fetch contact details', 'error');
      }
    } catch (error) {
      console.error(error);
      showToast('Failed to fetch contact details', 'error');
    }
  };

  // Reply to contact
  const replyToContact = async (contactId, message) => {
    try {
      const res = await ContactService.replyToContact(contactId, { message });
      const data = res.data;

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
    reset(() => {
      setFilters({
        status: '',
        search: '',
        dateRange: 'month'
      });
      setPagination(prev => ({ ...prev, page: 1 }));
    }, () => fetchContacts());
  };

  const handleRefresh = () => {
    refresh(() => fetchContacts(), setRefreshing);
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


  // Stats
  const newCount = contacts.filter(c => c.status === 'NEW').length;
  const repliedCount = contacts.filter(c => c.status === 'REPLIED').length;

  useEffect(() => {
    fetchContacts();
  }, [filters, pagination.page, pagination.limit]);

  return (
    <div className="min-h-screen bg-neutral-50/60 p-4 md:p-6 font-inter">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-neutral-900 tracking-tight">User Contacts</h1>
              <p className="text-xs sm:text-sm text-neutral-500 mt-1">Manage and respond to user inquiries and messages</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard
              title="Total Contacts"
              value={pagination.total}
              icon={MessageSquare}
              trend="up"
              trendValue="12"
            />
            <StatCard
              title="New Messages"
              value={newCount}
              icon={AlertCircle}
              trend="down"
              trendValue="5"
            />
            <StatCard
              title="Replied"
              value={repliedCount}
              icon={CheckCircle}
              trend="up"
              trendValue="18"
            />
          </div>
        </div>

        {/* Filters */}
        <AdminLocalFilterBar
          filters={filters}
          onChange={handleFilterChange}
          onClear={clearFilters}
          fields={[
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: statusOptions
            },
            {
              key: 'dateRange',
              label: 'Time Period',
              type: 'select',
              options: [
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This Week' },
                { value: 'month', label: 'This Month' },
                { value: 'year', label: 'This Year' }
              ]
            }
          ]}
        />

        {/* Table Container */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900">All Contacts</h3>
                <p className="text-xs text-neutral-500">{pagination.total} total messages</p>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-neutral-500 font-medium">Show:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                  className="px-3 py-1.5 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white font-semibold text-neutral-700"
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
              <thead className="bg-neutral-50/70 border-b border-neutral-100">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Subject & Message
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {loading ? (
                  <TableSkeleton rows={8} cols={5} />
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <MessageSquare className="w-12 h-12 text-neutral-300 mb-3" />
                        <h3 className="text-base font-semibold text-neutral-800 mb-1">No Contacts Found</h3>
                        <p className="text-xs text-neutral-500 max-w-md">
                          {Object.values(filters).some(filter => filter && filter !== 'month')
                            ? 'Try adjusting your filters to see more results.'
                            : 'No contact messages have been submitted yet.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact._id} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-neutral-900">{contact.name}</p>
                            <p className="text-xs text-neutral-500 truncate">{contact.email}</p>
                            {contact.phone && (
                              <p className="text-xs text-neutral-400 flex items-center mt-0.5">
                                <Phone className="w-3 h-3 mr-1 text-neutral-400" />
                                {contact.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-md">
                          <p className="font-semibold text-sm text-neutral-800">{contact.subject}</p>
                          <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">
                            {contact.message}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${contact.status === 'REPLIED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                          {contact.status === 'REPLIED' ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <AlertCircle className="w-3 h-3 mr-1" />
                          )}
                          {contact.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-neutral-600">{formatDate(contact.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => fetchContactDetails(contact._id)}
                            className="p-2 text-neutral-500 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {contact.status !== 'REPLIED' && (
                            <button
                              onClick={() => fetchContactDetails(contact._id)}
                              className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all"
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
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            limit={pagination.limit}
            onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
          />
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