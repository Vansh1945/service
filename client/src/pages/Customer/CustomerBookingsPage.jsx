import React, { useState, useEffect, useMemo } from 'react';
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
  MoreVertical,
  RefreshCw,
  FileText,
  Timer,
  Package,
  MapPin as LocationIcon,
  Edit,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CustomerBookingsPage = () => {
  const { token, API, showToast, user } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentBooking, setSelectedPaymentBooking] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    date: '',
    time: '',
  });
  const [rescheduleProcessing, setRescheduleProcessing] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    providerRating: 0,
    providerComment: '',
    serviceRating: 0,
    serviceComment: '',
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/booking/customer`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bookings: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process bookings and fetch additional details
      const processedBookings = await Promise.all(
        data.data.map(async (booking) => {
          const processedBooking = {
            ...booking,
            status: booking.provider ? booking.status : 'pending',
          };

          // Fetch provider details only if provider exists and status is accepted or later
          if (booking.provider && ['accepted', 'in_progress', 'completed'].includes(booking.status)) {
            try {
              const providerResponse = await fetch(`${API}/booking/providers/${booking.provider}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });
              
              if (providerResponse.ok) {
                const providerData = await providerResponse.json();
                processedBooking.providerDetails = providerData.data;
              }
            } catch (providerError) {
              console.error('Error fetching provider details:', providerError);
            }
          }

          // Fetch service details for each service in the booking
          if (booking.services && booking.services.length > 0) {
            try {
              const servicesWithDetails = await Promise.all(
                booking.services.map(async (serviceItem) => {
                  try {
                    const serviceResponse = await fetch(`${API}/booking/services/${serviceItem.service}`, {
                      headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                    });
                    
                    if (serviceResponse.ok) {
                      const serviceData = await serviceResponse.json();
                      return {
                        ...serviceItem,
                        serviceDetails: serviceData.data
                      };
                    }
                    return serviceItem;
                  } catch (serviceError) {
                    console.error('Error fetching service details:', serviceError);
                    return serviceItem;
                  }
                })
              );
              processedBooking.services = servicesWithDetails;
            } catch (servicesError) {
              console.error('Error processing services:', servicesError);
            }
          }

          return processedBooking;
        })
      );

      setBookings(processedBookings);
    } catch (error) {
      console.error('Fetch bookings error:', error.message);
      showToast(`Error fetching bookings: ${error.message}`, 'error');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingDetails = async (bookingId) => {
    try {
      const response = await fetch(`${API}/booking/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch booking details: ${response.statusText}`);
      }

      const data = await response.json();
      setSelectedBooking({
        ...data.data,
        status: data.data.provider ? data.data.status : 'pending',
      });
      setShowModal(true);
    } catch (error) {
      console.error('Fetch booking details error:', error.message);
      showToast(`Error fetching booking details: ${error.message}`, 'error');
    }
  };

  const handlePayment = async (booking, paymentMethod = 'online') => {
    setPaymentProcessing(true);
    try {
      const response = await fetch(`${API}/booking/confirm`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: booking._id,
          paymentMethod,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Payment failed');
      }

      const data = await response.json();
      showToast('Payment processed successfully', 'success');
      fetchBookings();
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Payment error:', error.message);
      showToast(`Payment error: ${error.message}`, 'error');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const submitFeedback = async () => {
    try {
      const response = await fetch(`${API}/feedback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: selectedBooking._id,
          providerRating: feedbackForm.providerRating,
          providerComment: feedbackForm.providerComment,
          serviceRating: feedbackForm.serviceRating,
          serviceComment: feedbackForm.serviceComment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit feedback');
      }

      showToast('Feedback submitted successfully', 'success');
      setFeedbackForm({
        providerRating: 0,
        providerComment: '',
        serviceRating: 0,
        serviceComment: '',
      });
      setShowFeedbackModal(false);
      fetchBookings();
    } catch (error) {
      console.error('Feedback submission error:', error.message);
      showToast(`Error submitting feedback: ${error.message}`, 'error');
    }
  };

  const handleRescheduleBooking = async () => {
    if (!rescheduleForm.date || !rescheduleForm.time) {
      showToast('Please select both date and time', 'warning');
      return;
    }

    setRescheduleProcessing(true);
    try {
      const response = await fetch(`${API}/booking/user/${selectedBooking._id}/reschedule`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: rescheduleForm.date,
          time: rescheduleForm.time,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reschedule booking');
      }

      showToast('Booking rescheduled successfully', 'success');
      fetchBookings();
      setShowRescheduleModal(false);
      setShowModal(false);
    } catch (error) {
      console.error('Reschedule error:', error.message);
      showToast(`Error rescheduling booking: ${error.message}`, 'error');
    } finally {
      setRescheduleProcessing(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const response = await fetch(`${API}/booking/user/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel booking');
      }

      showToast('Booking cancelled successfully', 'success');
      fetchBookings();
      setShowModal(false);
    } catch (error) {
      console.error('Cancel booking error:', error.message);
      showToast(`Error cancelling booking: ${error.message}`, 'error');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'accepted':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'completed':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-50 text-red-800 border-red-200';
      case 'payment_pending':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Timer className="w-4 h-4" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'in_progress':
        return <RefreshCw className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      case 'payment_pending':
        return <CreditCard className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Waiting for Provider';
      case 'accepted':
        return 'Confirmed';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'payment_pending':
        return 'Payment Pending';
      default:
        return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    }
  };

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'text-green-600';
      case 'pending':
        return 'text-orange-600';
      case 'failed':
        return 'text-red-600';
      case 'refunded':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Not specified';
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleBookingExpand = (bookingId) => {
    setExpandedBooking(expandedBooking === bookingId ? null : bookingId);
  };

  const showPaymentOptions = (booking) => {
    setSelectedPaymentBooking(booking);
    setShowPaymentModal(true);
  };

  const showFeedbackForm = (booking) => {
    setSelectedBooking(booking);
    setShowFeedbackModal(true);
  };

  const showRescheduleForm = (booking) => {
    setSelectedBooking(booking);
    setRescheduleForm({
      date: booking.date.split('T')[0],
      time: booking.time || '',
    });
    setShowRescheduleModal(true);
  };

  const canCancelBooking = (booking) => {
    return ['pending', 'accepted'].includes(booking.status);
  };

  const canRescheduleBooking = (booking) => {
    return booking.status === 'pending' && !booking.provider;
  };

  const needsPayment = (booking) => {
    return (
      booking.paymentStatus === 'pending' && 
      (booking.paymentMethod === 'cash' || booking.paymentMethod === 'online')
    );
  };

  const canGiveFeedback = (booking) => {
    return booking.status === 'completed' && !booking.feedback;
  };

  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) => {
        if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
        if (searchTerm && !booking.services?.[0]?.service?.title?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date') {
          return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date);
        } else if (sortBy === 'status') {
          return a.status.localeCompare(b.status);
        }
        return 0;
      });
  }, [bookings, statusFilter, searchTerm, sortBy]);

  const BookingCard = ({ booking }) => (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden mb-4">
      {/* Booking Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className={`rounded-full p-2 border ${getStatusColor(booking.status)}`}>
              {getStatusIcon(booking.status)}
            </div>
            <div>
              <p className="text-sm text-gray-500">ID: #{booking?._id?.slice(-8).toUpperCase()}</p>
              <p className="font-medium text-gray-900">{formatDate(booking.date)} • {formatTime(booking.time)}</p>
              <div className="flex items-center space-x-3 mt-1">
                <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(booking.status)}`}>
                  {getStatusText(booking.status)}
                </span>
                {needsPayment(booking) && (
                  <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                    Payment Due
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">
                ₹{(booking.servicePrice || 0) - (booking.discountAmount || 0)}
              </p>
              <p className={`text-xs font-medium ${getPaymentStatusColor(booking.paymentStatus)}`}>
                {booking.paymentStatus === 'paid'
                  ? 'Paid'
                  : booking.paymentStatus === 'pending'
                  ? 'Payment Pending'
                  : booking.paymentStatus || 'Not Specified'}
              </p>
            </div>
            <button
              onClick={() => toggleBookingExpand(booking._id)}
              className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              {expandedBooking === booking._id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expandedBooking === booking._id && (
        <div className="p-4">
          {/* Service Summary */}
          <div className="flex mb-4">
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
              {booking.services?.[0]?.service?.image ? (
                <img
                  src={booking.services[0].service.image}
                  alt={booking.services[0]?.service?.title || 'Service'}
                  className="w-full h-full object-cover rounded-lg"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <div
                className="text-gray-400 text-xs text-center p-2"
                style={booking.services?.[0]?.service?.image ? { display: 'none' } : {}}
              >
                <Package className="w-8 h-8 mx-auto mb-1" />
                Service
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {booking.services?.[0]?.service?.title || 'Unknown Service'}
              </h3>
              <p className="text-sm text-gray-500 capitalize mb-2">
                {booking.services?.[0]?.service?.category || 'N/A'}
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Service Price:</span>
                  <span className="text-sm font-medium">₹{booking.subtotal || 0}</span>
                </div>
                {booking.totalDiscount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Discount:</span>
                    <span className="text-sm font-medium text-green-600">-₹{booking.totalDiscount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t pt-1">
                  <span className="text-sm font-medium text-gray-900">Total:</span>
                  <span className="text-sm font-semibold text-green-600">
                    ₹{booking.totalAmount || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Information - Show limited info for pending bookings */}
          <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-500">Booked On</p>
              <p className="text-sm font-medium">{formatDateTime(booking.createdAt)}</p>
            </div>
            {booking.status === 'pending' ? (
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm font-medium text-amber-600">Waiting for provider assignment</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs text-gray-500">Service Provider</p>
                  <p className="text-sm font-medium">{booking.providerDetails?.name || booking.provider?.name || 'Not assigned yet'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Provider Contact</p>
                  <p className="text-sm font-medium">{booking.providerDetails?.phone || booking.provider?.phone || 'Not available'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Payment Method</p>
                  <p className="text-sm font-medium capitalize">{booking.paymentMethod || 'Not specified'}</p>
                </div>
              </>
            )}
          </div>

          {/* Status Timeline */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Booking Progress</h4>
            <div className="relative">
              <div className="flex items-center justify-between">
                {[
                  { key: 'booked', label: 'Booked', icon: CheckCircle, active: true },
                  { key: 'confirmed', label: 'Confirmed', icon: User, active: ['accepted', 'in_progress', 'completed'].includes(booking.status) },
                  { key: 'in_progress', label: 'In Progress', icon: RefreshCw, active: ['in_progress', 'completed'].includes(booking.status) },
                  { key: 'completed', label: 'Completed', icon: Truck, active: ['completed'].includes(booking.status) },
                ].map((step, index, array) => (
                  <React.Fragment key={step.key}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                          step.active ? 'bg-green-500 border-green-500 text-white' : 'bg-gray-200 border-gray-200 text-gray-500'
                        }`}
                      >
                        <step.icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs mt-1 text-gray-500 text-center">{step.label}</span>
                    </div>
                    {index < array.length - 1 && (
                      <div className="flex-1 h-1 mx-2 bg-gray-200">
                        <div
                          className={`h-1 transition-all duration-300 ${step.active ? 'bg-green-500' : 'bg-gray-200'}`}
                          style={{ width: step.active ? '100%' : '0%' }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap justify-between items-center gap-2 border-t border-gray-100 pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fetchBookingDetails(booking._id)}
                className="flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>View Details</span>
              </button>

              {canRescheduleBooking(booking) && (
                <button
                  onClick={() => showRescheduleForm(booking)}
                  className="flex items-center space-x-1 text-sm font-medium text-purple-600 hover:text-purple-800 px-3 py-1 rounded-md hover:bg-purple-50 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Reschedule</span>
                </button>
              )}

              {canGiveFeedback(booking) && (
                <button
                  onClick={() => showFeedbackForm(booking)}
                  className="flex items-center space-x-1 text-sm font-medium text-yellow-600 hover:text-yellow-800 px-3 py-1 rounded-md hover:bg-yellow-50 transition-colors"
                >
                  <Star className="w-4 h-4" />
                  <span>Rate Service</span>
                </button>
              )}

              {booking.invoice && (
                <a
                  href={`${API}/invoice/download/${booking.invoice}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-sm font-medium text-purple-600 hover:text-purple-800 px-3 py-1 rounded-md hover:bg-purple-50 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>View Invoice</span>
                </a>
              )}

              {needsPayment(booking) && (
                <button
                  onClick={() => showPaymentOptions(booking)}
                  className="flex items-center space-x-1 text-sm font-medium text-green-600 hover:text-green-800 px-3 py-1 rounded-md hover:bg-green-50 transition-colors border border-green-200"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pay Now</span>
                </button>
              )}
            </div>

            {canCancelBooking(booking) && (
              <button
                onClick={() => handleCancelBooking(booking._id)}
                className="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-1 rounded-md hover:bg-red-50 transition-colors"
              >
                Cancel Booking
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const PaymentModal = ({ booking, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Complete Payment</h3>
              <p className="text-sm text-gray-500">Booking ID: #{booking._id.slice(-8).toUpperCase()}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
              ×
            </button>
          </div>

          <div className="mb-6">
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-900 mb-2">{booking.service?.title || 'Unknown Service'}</h4>
              <div className="flex justify-between text-sm">
                <span>Service Amount:</span>
                <span>₹{booking.servicePrice || 0}</span>
              </div>
              {booking.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Discount:</span>
                  <span className="text-green-600">-₹{booking.discountAmount}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg border-t pt-2 mt-2">
                <span>Total to Pay:</span>
                <span className="text-green-600">₹{(booking.servicePrice || 0) - (booking.discountAmount || 0)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handlePayment(booking, 'online')}
                disabled={paymentProcessing}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                <span>{paymentProcessing ? 'Processing...' : 'Pay Online'}</span>
              </button>

              <button
                onClick={() => handlePayment(booking, 'cash')}
                disabled={paymentProcessing}
                className="w-full flex items-center justify-center space-x-2 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <DollarSign className="w-5 h-5" />
                <span>{paymentProcessing ? 'Processing...' : 'Pay with Cash'}</span>
              </button>

              <p className="text-center text-xs text-gray-500">Secure payment powered by Razorpay/PayU</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const FeedbackModal = ({ booking, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Rate Your Experience</h3>
              <p className="text-sm text-gray-500">Service: {booking.service?.title || 'Unknown Service'}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
              ×
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Rate the Service Provider</h4>
              <div className="flex items-center space-x-2 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={`provider-${star}`}
                    onClick={() => setFeedbackForm({ ...feedbackForm, providerRating: star })}
                    className={`text-2xl ${star <= feedbackForm.providerRating ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Your comments about the provider (optional)"
                value={feedbackForm.providerComment}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, providerComment: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                rows="2"
              />
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Rate the Service</h4>
              <div className="flex items-center space-x-2 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={`service-${star}`}
                    onClick={() => setFeedbackForm({ ...feedbackForm, serviceRating: star })}
                    className={`text-2xl ${star <= feedbackForm.serviceRating ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Your comments about the service (optional)"
                value={feedbackForm.serviceComment}
                onChange={(e) => setFeedbackForm({ ...feedbackForm, serviceComment: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                rows="2"
              />
            </div>

            <button
              onClick={submitFeedback}
              disabled={!feedbackForm.providerRating || !feedbackForm.serviceRating}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit Feedback
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const RescheduleModal = ({ booking, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Reschedule Booking</h3>
              <p className="text-sm text-gray-500">ID: #{booking._id.slice(-8).toUpperCase()}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
              ×
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
              <input
                type="date"
                value={rescheduleForm.date}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
              <input
                type="time"
                value={rescheduleForm.time}
                onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={handleRescheduleBooking}
                disabled={rescheduleProcessing || !rescheduleForm.date || !rescheduleForm.time}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {rescheduleProcessing ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const BookingModal = ({ booking, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Booking Details</h2>
              <p className="text-sm text-gray-500">ID: #{booking._id.slice(-8).toUpperCase()}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Service Details */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="w-5 h-5 mr-2 text-blue-500" />
              Service Details
            </h3>
            <div className="flex mb-4">
              <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                {booking.service?.image ? (
                  <img
                    src={booking.service.image}
                    alt={booking.service?.title || 'Service'}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Package className="w-10 h-10 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">{booking.service?.title || 'Unknown Service'}</h4>
                <p className="text-sm text-gray-500 capitalize mb-2">{booking.service?.category || 'N/A'}</p>
                <p className="text-sm text-gray-600">{booking.service?.description || 'No description available'}</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Service Price</p>
                  <p className="text-sm font-medium">₹{booking.servicePrice || 0}</p>
                </div>
                {booking.discountAmount > 0 && (
                  <div>
                    <p className="text-xs text-gray-500">Discount Applied</p>
                    <p className="text-sm font-medium text-green-600">-₹{booking.discountAmount}</p>
                  </div>
                )}
                <div className="col-span-2 border-t pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-900">Final Amount</span>
                    <span className="text-lg font-semibold text-green-600">
                      ₹{(booking.servicePrice || 0) - (booking.discountAmount || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Information */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-blue-500" />
              Booking Information
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
                <p className="text-xs text-gray-500">Booked On</p>
                <p className="text-sm font-medium">{formatDateTime(booking.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(booking.status)}`}>
                  {getStatusText(booking.status)}
                </span>
              </div>
            </div>
          </div>

          {/* Provider Information - Show limited info for pending bookings */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-blue-500" />
              Service Provider
            </h3>
            {booking.status === 'pending' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Timer className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-sm font-medium text-amber-800 mb-2">Provider Assignment Pending</p>
                <p className="text-xs text-gray-600">We're finding the best provider for your service. You'll receive provider details once your booking is accepted.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Provider Name</p>
                  <p className="text-sm font-medium">{booking.providerDetails?.name || booking.provider?.name || 'Not assigned yet'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contact Number</p>
                  <p className="text-sm font-medium">{booking.providerDetails?.phone || booking.provider?.phone || 'Not available'}</p>
                </div>
                {(booking.providerDetails?.rating || booking.provider?.rating) && (
                  <div>
                    <p className="text-xs text-gray-500">Provider Rating</p>
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 mr-1" />
                      <span className="text-sm font-medium">{booking.providerDetails?.rating || booking.provider?.rating}/5</span>
                    </div>
                  </div>
                )}
                {booking.providerDetails?.businessName && (
                  <div>
                    <p className="text-xs text-gray-500">Business Name</p>
                    <p className="text-sm font-medium">{booking.providerDetails.businessName}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service Address */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <LocationIcon className="w-5 h-5 mr-2 text-blue-500" />
              Service Address
            </h3>
            <div className="text-sm space-y-1">
              <p className="font-medium">{booking.address?.street || 'Address not provided'}</p>
              <p className="text-gray-600">
                {booking.address?.city && booking.address?.state
                  ? `${booking.address.city}, ${booking.address.state}`
                  : 'N/A'}
              </p>
              <p className="text-gray-600">
                {booking.address?.postalCode && booking.address?.country
                  ? `${booking.address.postalCode}, ${booking.address.country}`
                  : 'N/A'}
              </p>
              {booking.address?.landmark && <p className="text-gray-500">Near: {booking.address.landmark}</p>}
            </div>
          </div>

          {/* Payment Information */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-blue-500" />
              Payment Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Payment Method</p>
                <p className="text-sm font-medium capitalize">{booking.paymentMethod || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Status</p>
                <p className={`text-sm font-medium capitalize ${getPaymentStatusColor(booking.paymentStatus)}`}>
                  {booking.paymentStatus === 'paid'
                    ? 'Paid'
                    : booking.paymentStatus === 'pending'
                    ? 'Payment Pending'
                    : booking.paymentStatus || 'Not Specified'}
                </p>
              </div>
              {booking.transactionId && (
                <div>
                  <p className="text-xs text-gray-500">Transaction ID</p>
                  <p className="text-sm font-medium font-mono">{booking.transactionId}</p>
                </div>
              )}
              {booking.paymentDate && (
                <div>
                  <p className="text-xs text-gray-500">Payment Date</p>
                  <p className="text-sm font-medium">{formatDateTime(booking.paymentDate)}</p>
                </div>
              )}
            </div>

            {needsPayment(booking) && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-900">Payment Required</p>
                    <p className="text-xs text-orange-700">
                      {booking.paymentMethod === 'cash'
                        ? 'Please complete the payment.'
                        : 'Please complete your online payment.'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      showPaymentOptions(booking);
                    }}
                    className="bg-orange-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-orange-700 transition-colors"
                  >
                    Pay Now
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order History */}
          {booking.statusHistory && booking.statusHistory.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-500" />
                Order History
              </h3>
              <div className="space-y-3">
                {booking.statusHistory.map((history, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 capitalize">{getStatusText(history.status)}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(history.timestamp)}</p>
                      {history.note && <p className="text-xs text-gray-600 mt-1">{history.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Support */}
          <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
              <HelpCircle className="w-5 h-5 mr-2 text-blue-500" />
              Need Help?
            </h3>
            <p className="text-sm text-gray-600 mb-3">Having issues with your booking? Our support team is here to help.</p>
            <div className="flex flex-wrap gap-2">
              <button className="flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-800 bg-white px-3 py-2 rounded-md hover:bg-blue-50 transition-colors border border-blue-200">
                <MessageSquare className="w-4 h-4" />
                <span>Chat Support</span>
              </button>
              <button className="flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-800 bg-white px-3 py-2 rounded-md hover:bg-blue-50 transition-colors border border-blue-200">
                <Phone className="w-4 h-4" />
                <span>Call Support</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>

            {canRescheduleBooking(booking) && (
              <button
                onClick={() => {
                  onClose();
                  showRescheduleForm(booking);
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center space-x-1"
              >
                <Edit className="w-4 h-4" />
                <span>Reschedule</span>
              </button>
            )}

            {canGiveFeedback(booking) && (
              <button
                onClick={() => {
                  onClose();
                  showFeedbackForm(booking);
                }}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center space-x-1"
              >
                <Star className="w-4 h-4" />
                <span>Give Feedback</span>
              </button>
            )}

            {needsPayment(booking) && (
              <button
                onClick={() => {
                  onClose();
                  showPaymentOptions(booking);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center space-x-1"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay Now</span>
              </button>
            )}

            {canCancelBooking(booking) && (
              <button
                onClick={() => {
                  onClose();
                  handleCancelBooking(booking._id);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-900">Loading your bookings...</p>
          <p className="text-sm text-gray-500">Please wait while we fetch your booking history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
              <div className="flex items-center text-sm text-gray-500 mt-2">
                <span>{bookings.length} {bookings.length === 1 ? 'booking' : 'total bookings'}</span>
                <span className="mx-2">•</span>
                <span>{bookings.filter((b) => b.status === 'completed').length} completed</span>
                <span className="mx-2">•</span>
                <span>{bookings.filter((b) => needsPayment(b)).length} pending payment</span>
              </div>
            </div>
            <button
              onClick={fetchBookings}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="all">All Bookings</option>
                <option value="pending">Waiting for Provider</option>
                <option value="accepted">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="payment_pending">Payment Pending</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Bookings</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by service name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="date">Most Recent</option>
                <option value="status">Status</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setSearchTerm('');
                  setSortBy('date');
                }}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Bookings', value: bookings.length, color: 'bg-blue-500' },
            { label: 'Completed', value: bookings.filter((b) => b.status === 'completed').length, color: 'bg-green-500' },
            {
              label: 'Active',
              value: bookings.filter((b) => ['pending', 'accepted', 'in_progress'].includes(b.status)).length,
              color: 'bg-yellow-500',
            },
            { label: 'Payment Due', value: bookings.filter((b) => needsPayment(b)).length, color: 'bg-orange-500' },
          ].map((stat, index) => (
            <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${stat.color} mr-3`}></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bookings List */}
        <div>
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
              <div className="mx-auto h-24 w-24 text-gray-400 mb-6">
                <Calendar className="w-full h-full" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">No bookings found</h3>
              <p className="text-gray-500 mb-6">
                {statusFilter !== 'all' || searchTerm
                  ? 'Try adjusting your filters to see more results'
                  : "You haven't made any bookings yet. Start exploring our services!"}
              </p>
              {statusFilter === 'all' && !searchTerm && (
                <button
                  onClick={() => navigate('/services')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Browse Services
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => (
                <BookingCard key={booking._id} booking={booking} />
              ))}
            </div>
          )}
        </div>

        {/* Load More Button (if needed for pagination) */}
        {filteredBookings.length >= 10 && (
          <div className="text-center mt-8">
            <button className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors font-medium">
              Load More Bookings
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && selectedBooking && (
        <BookingModal booking={selectedBooking} onClose={() => setShowModal(false)} />
      )}

      {showPaymentModal && selectedPaymentBooking && (
        <PaymentModal booking={selectedPaymentBooking} onClose={() => setShowPaymentModal(false)} />
      )}

      {showFeedbackModal && selectedBooking && (
        <FeedbackModal booking={selectedBooking} onClose={() => setShowFeedbackModal(false)} />
      )}

      {showRescheduleModal && selectedBooking && (
        <RescheduleModal booking={selectedBooking} onClose={() => setShowRescheduleModal(false)} />
      )}
    </div>
  );
};

export default CustomerBookingsPage;