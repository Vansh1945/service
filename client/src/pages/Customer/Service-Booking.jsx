import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Eye,
  Filter,
  Search,
  Download,
  ChevronRight,
  ChevronDown,
  Truck,
  Info,
  CreditCard,
  Shield,
  HelpCircle,
  MessageSquare,
  Star,
  MoreVertical
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ServiceBooking = () => {
  const { token, API, showToast } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [expandedBooking, setExpandedBooking] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await fetch(`${API}/booking/user`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBookings(data.data || []);
      } else {
        throw new Error('Failed to fetch bookings');
      }
    } catch (error) {
      showToast('Error fetching bookings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingDetails = async (bookingId) => {
    try {
      const response = await fetch(`${API}/booking/user/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedBooking(data.data);
        setShowModal(true);
      } else {
        throw new Error('Failed to fetch booking details');
      }
    } catch (error) {
      showToast('Error fetching booking details', 'error');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'accepted': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'completed': return 'bg-green-50 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-50 text-red-800 border-red-200';
      default: return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      case 'accepted': return <CheckCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Processing';
      case 'accepted': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const response = await fetch(`${API}/booking/user/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        showToast('Booking cancelled successfully');
        fetchBookings();
        setShowModal(false);
      } else {
        throw new Error('Failed to cancel booking');
      }
    } catch (error) {
      showToast('Error cancelling booking', 'error');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return 'To be confirmed';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const toggleBookingExpand = (bookingId) => {
    if (expandedBooking === bookingId) {
      setExpandedBooking(null);
    } else {
      setExpandedBooking(bookingId);
    }
  };

  const filteredBookings = bookings
    .filter(booking => {
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
      if (searchTerm && !booking.service?.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date) - new Date(a.date);
      } else if (sortBy === 'status') {
        return a.status.localeCompare(b.status);
      }
      return 0;
    });

  const BookingCard = ({ booking }) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
      {/* Booking Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className={`rounded-full p-2 ${getStatusColor(booking.status)}`}>
              {getStatusIcon(booking.status)}
            </div>
            <div>
              <p className="text-sm text-gray-500">Booking ID: {booking._id.slice(-12)}</p>
              <p className="font-medium text-gray-900">{formatDate(booking.date)} • {formatTime(booking.time)}</p>
            </div>
          </div>
          <button 
            onClick={() => toggleBookingExpand(booking._id)}
            className="text-gray-500 hover:text-gray-700"
          >
            {expandedBooking === booking._id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expandedBooking === booking._id && (
        <div className="p-4">
          {/* Service Summary */}
          <div className="flex mb-4">
            <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center mr-4">
              {booking.service?.image ? (
                <img 
                  src={booking.service.image} 
                  alt={booking.service.title} 
                  className="w-full h-full object-cover rounded-md"
                />
              ) : (
                <div className="text-gray-400 text-xs text-center p-2">No Image</div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{booking.service?.title}</h3>
              <p className="text-sm text-gray-500 capitalize">{booking.service?.category}</p>
              <div className="flex items-center mt-2">
                <span className="text-sm font-medium text-gray-900">₹{booking.servicePrice || 0}</span>
                {booking.discountAmount > 0 && (
                  <span className="text-xs text-gray-500 line-through ml-2">
                    ₹{(booking.servicePrice || 0) + booking.discountAmount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Timeline */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Status</span>
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(booking.status)}`}>
                {getStatusText(booking.status)}
              </span>
            </div>
            <div className="relative pt-1">
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    ['pending', 'accepted', 'completed', 'cancelled'].includes(booking.status) ? 
                    'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs mt-1 text-gray-500">Booked</span>
                </div>
                <div className="flex-1 h-1 mx-2 bg-gray-200">
                  <div className={`h-1 ${
                    ['accepted', 'completed', 'cancelled'].includes(booking.status) ? 
                    'bg-green-500' : 'bg-gray-200'
                  }`} style={{ width: '100%' }}></div>
                </div>
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    ['accepted', 'completed', 'cancelled'].includes(booking.status) ? 
                    'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>
                  <span className="text-xs mt-1 text-gray-500">Confirmed</span>
                </div>
                <div className="flex-1 h-1 mx-2 bg-gray-200">
                  <div className={`h-1 ${
                    ['completed'].includes(booking.status) ? 
                    'bg-green-500' : 'bg-gray-200'
                  }`} style={{ width: '100%' }}></div>
                </div>
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    ['completed'].includes(booking.status) ? 
                    'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    <Truck className="w-4 h-4" />
                  </div>
                  <span className="text-xs mt-1 text-gray-500">Service Done</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between border-t border-gray-100 pt-4">
            <div className="flex space-x-2">
              <button
                onClick={() => fetchBookingDetails(booking._id)}
                className="flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                <Eye className="w-4 h-4" />
                <span>View Details</span>
              </button>
              {booking.status === 'completed' && (
                <button className="flex items-center space-x-1 text-sm font-medium text-gray-600 hover:text-gray-800">
                  <Star className="w-4 h-4" />
                  <span>Rate Service</span>
                </button>
              )}
            </div>
            {booking.status === 'pending' && (
              <button
                onClick={() => handleCancelBooking(booking._id)}
                className="text-sm font-medium text-red-600 hover:text-red-800"
              >
                Cancel Booking
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const BookingModal = ({ booking, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Booking Details</h2>
              <p className="text-sm text-gray-500">Booking ID: {booking._id}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* Order Summary */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Info className="w-4 h-4 mr-2 text-blue-500" />
                Order Summary
              </h3>
              <div className="flex mb-3">
                <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center mr-4">
                  {booking.service?.image ? (
                    <img 
                      src={booking.service.image} 
                      alt={booking.service.title} 
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <div className="text-gray-400 text-xs text-center p-2">No Image</div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{booking.service?.title}</h3>
                  <p className="text-sm text-gray-500 capitalize">{booking.service?.category}</p>
                  <div className="flex items-center mt-1">
                    <span className="text-sm font-medium text-gray-900">₹{booking.servicePrice || 0}</span>
                    {booking.discountAmount > 0 && (
                      <span className="text-xs text-gray-500 line-through ml-2">
                        ₹{(booking.servicePrice || 0) + booking.discountAmount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Service Price</span>
                  <span>₹{booking.servicePrice || 0}</span>
                </div>
                {booking.discountAmount > 0 && (
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Discount</span>
                    <span className="text-green-600">-₹{booking.discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium mt-2 pt-2 border-t border-gray-200">
                  <span>Total Amount</span>
                  <span className="text-green-600">
                    ₹{(booking.servicePrice || 0) - (booking.discountAmount || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Truck className="w-4 h-4 mr-2 text-blue-500" />
                Service Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Booking Date</p>
                  <p className="text-sm font-medium">{formatDate(booking.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Service Time</p>
                  <p className="text-sm font-medium">{formatTime(booking.time)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Provider</p>
                  <p className="text-sm font-medium">{booking.provider?.name || 'Not assigned'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Provider Contact</p>
                  <p className="text-sm font-medium">{booking.provider?.phone || 'Not available'}</p>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-blue-500" />
                Service Address
              </h3>
              <div className="text-sm">
                <p className="font-medium">{booking.address?.street}</p>
                <p className="text-gray-600">{booking.address?.city}, {booking.address?.state}</p>
                <p className="text-gray-600">{booking.address?.postalCode}, {booking.address?.country}</p>
              </div>
            </div>

            {/* Payment Information */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <CreditCard className="w-4 h-4 mr-2 text-blue-500" />
                Payment Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <p className="text-sm font-medium capitalize">{booking.paymentMethod || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Status</p>
                  <p className="text-sm font-medium capitalize">{booking.paymentStatus || 'Not specified'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Transaction ID</p>
                  <p className="text-sm font-medium">{booking.transactionId || 'Not available'}</p>
                </div>
              </div>
            </div>

            {/* Need Help? */}
            <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <HelpCircle className="w-4 h-4 mr-2 text-blue-500" />
                Need Help?
              </h3>
              <p className="text-sm text-gray-600 mb-3">Having issues with your booking? Our support team is here to help.</p>
              <button className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center">
                <MessageSquare className="w-4 h-4 mr-1" />
                Contact Support
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            {booking.status === 'pending' && (
              <button
                onClick={() => handleCancelBooking(booking._id)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Cancel Booking
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <div className="flex items-center text-sm text-gray-500 mt-2">
            <span>{bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}</span>
            <span className="mx-2">•</span>
            <span>{bookings.filter(b => b.status === 'completed').length} completed</span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Bookings</option>
                <option value="pending">Processing</option>
                <option value="accepted">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search Bookings</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by service name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="date">Most Recent</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div>
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <div className="mx-auto h-16 w-16 text-gray-400 mb-4">
                <Calendar className="w-full h-full" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No bookings found</h3>
              <p className="text-sm text-gray-500">
                {statusFilter !== 'all' || searchTerm 
                  ? 'Try adjusting your filters' 
                  : 'You haven\'t made any bookings yet'}
              </p>
            </div>
          ) : (
            filteredBookings.map((booking) => (
              <BookingCard key={booking._id} booking={booking} />
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

export default ServiceBooking;