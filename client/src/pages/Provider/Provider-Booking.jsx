import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import {
  Calendar,
  Clock,
  RefreshCw,
  MapPin,
  User,
  Phone,
  Mail,
  DollarSign,
  Eye,
  Check,
  CheckCircle,
  X,
  Loader,
  AlertCircle,
  Percent,
  Wallet,
  Tag,
  FileText,
  ChevronDown,
  ChevronUp,
  Filter,
  List,
  ClipboardList,
  Scissors,
  Clock4,
  Home,
  Sparkles,
  Zap,
  Plug,
  Wrench
} from 'lucide-react';

const ProviderBookingDashboard = () => {
  const { token, API, showToast, user } = useAuth();
  const [bookings, setBookings] = useState({
    pending: [],
    accepted: [],
    completed: [],
    cancelled: []
  });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState({
    pending: false,
    accepted: false,
    completed: false,
    cancelled: false,
    details: false,
    action: false
  });
  const [error, setError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    booking: true,
    customer: true,
    service: true,
    payment: true,
    address: true
  });
  const [activeTab, setActiveTab] = useState('pending');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    pending: { page: 1, limit: 10, total: 0 },
    accepted: { page: 1, limit: 10, total: 0 },
    completed: { page: 1, limit: 10, total: 0 },
    cancelled: { page: 1, limit: 10, total: 0 }
  });

  // Calculate subtotal from services
  const calculateSubtotal = (booking) => {
    if (!booking?.services) return 0;
    return booking.services.reduce((sum, item) => {
      return sum + (item.price * item.quantity) - (item.discountAmount || 0);
    }, 0).toFixed(2);
  };

  // Calculate net amount after commission
  const calculateNetAmount = (booking) => {
    if (!booking) return 0;
    const totalAmount = booking.totalAmount || calculateSubtotal(booking);
    const commissionAmount = booking.commission?.amount || 0;
    return (totalAmount - commissionAmount).toFixed(2);
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Fetch bookings based on status
  const fetchBookings = async (status) => {
    try {
      setLoading(prev => ({ ...prev, [status]: true }));
      setError(null);

      const { page, limit } = pagination[status];
      const response = await fetch(`${API}/booking/provider/status/${status}?page=${page}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch ${status} bookings`);
      }

      const data = await response.json();
      setBookings(prev => ({
        ...prev,
        [status]: data.data || []
      }));

      setPagination(prev => ({
        ...prev,
        [status]: {
          ...prev[status],
          total: data.total || 0
        }
      }));
    } catch (err) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [status]: false }));
    }
  };

  // Handle pagination change
  const handlePageChange = (status, newPage) => {
    setPagination(prev => ({
      ...prev,
      [status]: {
        ...prev[status],
        page: newPage
      }
    }));
    fetchBookings(status);
  };

  useEffect(() => {
    if (token) {
      fetchBookings('pending');
      fetchBookings('accepted');
      fetchBookings('completed');
      fetchBookings('cancelled');
    }
  }, [token]);

  // Handle booking action (accept/complete)
  const handleBookingAction = async (bookingId, action) => {
    try {
      setLoading(prev => ({ ...prev, action: true }));

      let endpoint, method;
      if (action === 'accept') {
        endpoint = `${API}/booking/provider/${bookingId}/accept`;
        method = 'PATCH';
      } else if (action === 'complete') {
        endpoint = `${API}/booking/provider/${bookingId}/complete`;
        method = 'PATCH';
      } else {
        throw new Error('Invalid action');
      }

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: action === 'accept' && selectedBooking?.time ? JSON.stringify({ time: selectedBooking.time }) : undefined
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} booking`);
      }

      const result = await response.json();
      showToast(result.message || `Booking ${action}ed successfully`, 'success');

      // Update local state
      const updatedBookings = { ...bookings };
      if (action === 'accept') {
        const bookingIndex = updatedBookings.pending.findIndex(b => b._id === bookingId);
        if (bookingIndex !== -1) {
          const [booking] = updatedBookings.pending.splice(bookingIndex, 1);
          updatedBookings.accepted.unshift({
            ...booking,
            status: 'accepted',
            provider: user._id
          });
        }
      } else if (action === 'complete') {
        const bookingIndex = updatedBookings.accepted.findIndex(b => b._id === bookingId);
        if (bookingIndex !== -1) {
          const [booking] = updatedBookings.accepted.splice(bookingIndex, 1);
          updatedBookings.completed.unshift({
            ...booking,
            status: 'completed'
          });
        }
      }

      setBookings(updatedBookings);
      setShowModal(false);
      setSelectedBooking(null);
    } catch (err) {
      console.error(`Error ${action}ing booking:`, err);
      showToast(err.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  };

  // Get booking details
  const getBookingDetails = async (bookingId) => {
    try {
      setLoading(prev => ({ ...prev, details: true }));
      const response = await fetch(`${API}/booking/provider-booking/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch booking details');
      }

      const data = await response.json();
      setSelectedBooking(data.data || null);
      setShowModal(true);
    } catch (err) {
      showToast(err.message, 'error');
      setShowModal(false);
    } finally {
      setLoading(prev => ({ ...prev, details: false }));
    }
  };

  // Format address object to string
  const formatAddress = (address) => {
    if (!address) return 'Address not specified';
    if (typeof address === 'string') return address;

    const parts = [
      address.street,
      address.city,
      address.state,
      address.postalCode,
      address.country
    ].filter(Boolean);

    return parts.join(', ') || 'Address not specified';
  };

  // Status styling
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'accepted': return <Check className="w-4 h-4" />;
      case 'confirmed': return <Check className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <X className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Get service icon based on category
  const getServiceIcon = (category) => {
    switch (category?.toLowerCase()) {
      case 'salon':
      case 'beauty':
        return <Scissors className="w-5 h-5 text-pink-500" />;
      case 'cleaning':
        return <Sparkles className="w-5 h-5 text-blue-500" />;
      case 'electrical':
        return <Zap className="w-5 h-5 text-yellow-500" />;
      case 'ac':
        return <Plug className="w-5 h-5 text-blue-400" />;
      case 'appliance repair':
      case 'repair':
      case 'maintenance':
        return <Wrench className="w-5 h-5 text-orange-500" />;
      case 'home':
        return <Home className="w-5 h-5 text-green-500" />;
      default:
        return <Clock4 className="w-5 h-5 text-gray-500" />;
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';

      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  // Format time
  const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    return timeString;
  };

  // Format duration
  const formatDuration = (hours) => {
    if (!hours) return 'N/A';
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours > 0 ? `${wholeHours} hr` : ''} ${minutes > 0 ? `${minutes} min` : ''}`.trim();
  };

  // Filter bookings based on search and filter
  const getFilteredBookings = () => {
    let filtered = bookings[activeTab] || [];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(booking =>
        (booking.customer?.name?.toLowerCase().includes(query)) ||
        (booking.services?.some(service =>
          service.service?.title?.toLowerCase().includes(query))) ||
        (booking._id?.toLowerCase().includes(query)));
    }

    if (filter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(booking => 
        new Date(booking.date).toISOString().split('T')[0] === today);
    } else if (filter === 'upcoming') {
      const today = new Date();
      filtered = filtered.filter(booking => new Date(booking.date) >= today);
    } else if (filter === 'past') {
      const today = new Date();
      filtered = filtered.filter(booking => new Date(booking.date) < today);
    }

    return filtered;
  };

  const currentBookings = getFilteredBookings();
  const currentPagination = pagination[activeTab];

  const isLoading = loading.pending && loading.accepted && loading.completed && loading.cancelled && currentBookings.length === 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="animate-spin w-8 h-8 text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Error loading bookings</h3>
          <p className="text-gray-600 mt-2">{error}</p>
          <button
            onClick={() => {
              fetchBookings('pending');
              fetchBookings('accepted');
              fetchBookings('completed');
              fetchBookings('cancelled');
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Service Provider Dashboard</h1>
              <p className="text-gray-600">Manage your service bookings</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search bookings..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                  <ClipboardList className="w-5 h-5" />
                </div>
              </div>
              <button
                onClick={() => {
                  fetchBookings('pending');
                  fetchBookings('accepted');
                  fetchBookings('completed');
                  fetchBookings('cancelled');
                }}
                className="flex items-center text-blue-600 hover:text-blue-800 p-2 rounded-full hover:bg-blue-50"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex space-x-1 overflow-x-auto pb-2 md:pb-0">
              {['pending', 'accepted', 'completed', 'cancelled'].map(status => (
                <button
                  key={status}
                  onClick={() => setActiveTab(status)}
                  className={`px-4 py-2 text-sm font-medium rounded-md flex items-center ${activeTab === status ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  {getStatusIcon(status)}
                  <span className="ml-2 capitalize">{status}</span>
                  {bookings[status].length > 0 && (
                    <span className="ml-2 bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {bookings[status].length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="all">All Bookings</option>
                  <option value="today">Today</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
                <div className="absolute right-2 top-2.5 text-gray-400 pointer-events-none">
                  <Filter className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div className="space-y-4">
          {loading[activeTab] && currentBookings.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Loader className="animate-spin w-8 h-8 text-blue-500 mx-auto mb-4" />
              <p className="text-gray-500">Loading {activeTab} bookings...</p>
            </div>
          ) : currentBookings.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="text-gray-400 mb-4">
                <List className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No {activeTab} bookings
              </h3>
              <p className="text-gray-500">
                {activeTab === 'pending'
                  ? "You don't have any pending bookings at the moment."
                  : activeTab === 'accepted'
                    ? "You don't have any accepted bookings at the moment."
                    : activeTab === 'completed'
                      ? "You haven't completed any bookings yet."
                      : "You don't have any cancelled bookings."}
              </p>
            </div>
          ) : (
            <>
              {currentBookings.map((booking) => (
                <div
                  key={booking._id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md"
                >
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                            {getStatusIcon(booking.status)}
                            <span className="ml-1 capitalize">{booking.status || 'unknown'}</span>
                          </span>
                          <span className="text-sm font-medium text-gray-500">
                            Booking ID: {booking._id}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="flex items-center text-gray-600">
                            <User className="w-4 h-4 mr-2" />
                            <span>{booking.customer?.name || 'Customer'}</span>
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Calendar className="w-4 h-4 mr-2" />
                            <span>{formatDate(booking.date)} at {formatTime(booking.time)}</span>
                          </div>
                          <div className="flex items-center text-gray-600">
                            {getServiceIcon(booking.services?.[0]?.service?.category)}
                            <span className="ml-2">
                              {booking.services?.map(s => s.service?.title).join(', ') || 'Service'}
                            </span>
                          </div>
                          <div className="flex items-center text-gray-600">
                            <MapPin className="w-4 h-4 mr-2" />
                            <span>{formatAddress(booking.address)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col space-y-2 min-w-[150px]">
                        <button
                          onClick={() => getBookingDetails(booking._id)}
                          disabled={loading.details}
                          className="inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {loading.details ? (
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </>
                          )}
                        </button>

                        {booking.status === 'pending' && (
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowModal(true);
                            }}
                            disabled={loading.action}
                            className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            {loading.action ? (
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Accept Booking
                              </>
                            )}
                          </button>
                        )}

                        {booking.status === 'accepted' && (
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setShowModal(true);
                            }}
                            disabled={loading.action}
                            className="inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                          >
                            {loading.action ? (
                              <Loader className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Complete
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial summary */}
                  <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-500">
                        {booking.status === 'completed' ? (
                          <span className="text-green-600">
                            {booking.paymentStatus === 'paid'
                              ? 'Payment Processed to your account'
                              : 'Payment Processing'}
                          </span>
                        ) : booking.status === 'cancelled' ? (
                          <span className="text-red-600">Payment not applicable</span>
                        ) : (
                          <span>Commission will be deducted from the total Service amount</span>
                        )}
                      </div>
                      <div className="flex items-center text-green-600 font-medium">
                        <Wallet className="w-4 h-4 mr-2" />
                        <span>
                          {booking.status === 'completed' ? 'Earned: ' : 'Estimated: '}
                          ₹{calculateNetAmount(booking)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <div className="flex justify-between items-center bg-white rounded-lg shadow-sm p-4">
                <div className="text-sm text-gray-600">
                  Showing {(currentPagination.page - 1) * currentPagination.limit + 1} to{' '}
                  {Math.min(currentPagination.page * currentPagination.limit, currentPagination.total)} of{' '}
                  {currentPagination.total} bookings
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(activeTab, currentPagination.page - 1)}
                    disabled={currentPagination.page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(activeTab, currentPagination.page + 1)}
                    disabled={currentPagination.page * currentPagination.limit >= currentPagination.total}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Booking Details Modal */}
        {showModal && selectedBooking && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2 shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Booking Details</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={loading.action || loading.details}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {loading.details ? (
                <div className="flex justify-center py-8">
                  <Loader className="animate-spin w-8 h-8 text-blue-500" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Booking Information Section */}
                  <div className="border-b border-gray-200 pb-6">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleSection('booking')}
                    >
                      <h4 className="text-md font-semibold text-gray-900 mb-4">Booking Information</h4>
                      {expandedSections.booking ? <ChevronUp /> : <ChevronDown />}
                    </div>

                    {expandedSections.booking && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Booking ID</p>
                            <p className="font-mono text-sm bg-gray-100 p-2 rounded break-all">{selectedBooking._id}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <p className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedBooking.status)}`}>
                              {getStatusIcon(selectedBooking.status)}
                              <span className="ml-1 capitalize">{selectedBooking.status || 'N/A'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Created At</p>
                            <p className="font-medium">{formatDate(selectedBooking.createdAt)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Updated At</p>
                            <p className="font-medium">{formatDate(selectedBooking.updatedAt)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Customer Information Section */}
                  <div className="border-b border-gray-200 pb-6">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleSection('customer')}
                    >
                      <h4 className="text-md font-semibold text-gray-900 mb-4">Customer Information</h4>
                      {expandedSections.customer ? <ChevronUp /> : <ChevronDown />}
                    </div>

                    {expandedSections.customer && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center">
                          <User className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <p className="text-sm text-gray-500">Name</p>
                            <p className="font-medium">{selectedBooking.customer?.name || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <Phone className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <p className="text-sm text-gray-500">Phone</p>
                            <p className="font-medium">{selectedBooking.customer?.phone || 'N/A'}</p>
                          </div>
                        </div>
                        <div className="flex items-center md:col-span-2">
                          <Mail className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <p className="text-sm text-gray-500">Email</p>
                            <p className="font-medium">{selectedBooking.customer?.email || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Service Information Section */}
                  <div className="border-b border-gray-200 pb-6">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleSection('service')}
                    >
                      <h4 className="text-md font-semibold text-gray-900 mb-4">Service Information</h4>
                      {expandedSections.service ? <ChevronUp /> : <ChevronDown />}
                    </div>

                    {expandedSections.service && (
                      <div className="space-y-4">
                        {selectedBooking.services?.map((serviceItem, index) => (
                          <div key={index} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-start">
                              {getServiceIcon(serviceItem.service?.category)}
                              <div className="ml-3 flex-1">
                                <h5 className="font-medium text-gray-900">{serviceItem.service?.title || 'Service'}</h5>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                    {serviceItem.service?.category || 'General'}
                                  </span>
                                  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                                    Duration: {formatDuration(serviceItem.service?.duration)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-500 mt-2">{serviceItem.service?.description}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">₹{serviceItem.price?.toFixed(2) || '0.00'}</p>
                                <p className="text-sm text-gray-500">Qty: {serviceItem.quantity || 1}</p>
                                {serviceItem.discountAmount > 0 && (
                                  <p className="text-sm text-green-600">
                                    Discount: -₹{serviceItem.discountAmount.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <p className="text-sm text-gray-500">Scheduled Date</p>
                            <p className="font-medium">{formatDate(selectedBooking.date)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Scheduled Time</p>
                            <p className="font-medium">{formatTime(selectedBooking.time)}</p>
                          </div>
                        </div>

                        {selectedBooking.notes && (
                          <div>
                            <p className="text-sm text-gray-500">Customer Notes</p>
                            <p className="font-medium">{selectedBooking.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Address Information Section */}
                  <div className="border-b border-gray-200 pb-6">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleSection('address')}
                    >
                      <h4 className="text-md font-semibold text-gray-900 mb-4">Address Information</h4>
                      {expandedSections.address ? <ChevronUp /> : <ChevronDown />}
                    </div>

                    {expandedSections.address && (
                      <div>
                        <p className="text-sm text-gray-500">Full Address</p>
                        <p className="font-medium">
                          {formatAddress(selectedBooking.address)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payment Details Section */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div
                      className="flex items-center justify-between cursor-pointer mb-4"
                      onClick={() => toggleSection('payment')}
                    >
                      <h4 className="text-md font-semibold text-gray-900 flex items-center">
                        <DollarSign className="w-5 h-5 mr-2 text-blue-500" />
                        Payment Details
                      </h4>
                      {expandedSections.payment ? <ChevronUp /> : <ChevronDown />}
                    </div>

                    {expandedSections.payment && (
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600 flex items-center">
                            <FileText className="w-4 h-4 mr-1" />
                            Subtotal
                          </span>
                          <span className="font-medium">₹{calculateSubtotal(selectedBooking)}</span>
                        </div>

                        {selectedBooking.totalDiscount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span className="flex items-center">
                              <Tag className="w-4 h-4 mr-1" />
                              Discount
                            </span>
                            <span>-₹{selectedBooking.totalDiscount?.toFixed(2) || '0.00'}</span>
                          </div>
                        )}

                        <div className="border-t border-gray-200 pt-2">
                          <div className="flex justify-between font-semibold">
                            <span>Total Amount</span>
                            <span>₹{selectedBooking.totalAmount?.toFixed(2) || calculateSubtotal(selectedBooking)}</span>
                          </div>
                        </div>

                        {selectedBooking.commission?.amount > 0 && (
                          <div className="border-t border-gray-200 pt-2">
                            <div className="flex justify-between text-red-600">
                              <span className="flex items-center">
                                <Percent className="w-4 h-4 mr-1" />
                                Platform Commission ({selectedBooking.providerCommissionRate || 0}%)
                              </span>
                              <span>-₹{selectedBooking.commission?.amount?.toFixed(2) || '0.00'}</span>
                            </div>
                          </div>
                        )}

                        <div className="border-t border-gray-200 pt-3">
                          <div className="flex justify-between text-lg font-bold text-green-600">
                            <span className="flex items-center">
                              <Wallet className="w-5 h-5 mr-2" />
                              Your Estimated Earnings
                            </span>
                            <span>
                              ₹{calculateNetAmount(selectedBooking)}
                            </span>
                          </div>
                        </div>

                        {selectedBooking.paymentMethod && (
                          <div className="text-sm text-gray-500 mt-2">
                            Payment Method: {selectedBooking.paymentMethod}
                            {selectedBooking.paymentStatus && (
                              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${selectedBooking.paymentStatus === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {selectedBooking.paymentStatus}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 pt-6">
                    <button
                      onClick={() => setShowModal(false)}
                      disabled={loading.action}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Close
                    </button>

                    {selectedBooking.status === 'pending' && (
                      <button
                        onClick={() => handleBookingAction(selectedBooking._id, 'accept')}
                        disabled={loading.action}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {loading.action ? (
                          <Loader className="w-4 h-4 mx-auto animate-spin" />
                        ) : (
                          'Accept Booking'
                        )}
                      </button>
                    )}

                    {selectedBooking.status === 'accepted' && (
                      <button
                        onClick={() => handleBookingAction(selectedBooking._id, 'complete')}
                        disabled={loading.action}
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        {loading.action ? (
                          <Loader className="w-4 h-4 mx-auto animate-spin" />
                        ) : (
                          'Mark as Completed'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderBookingDashboard;