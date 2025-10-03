import React, { useEffect, useState } from 'react';
import { useAuth } from '../../store/auth';
import { useNavigate } from 'react-router-dom';
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
  Search,
  CreditCard,
  Star,
  Package,
  ShoppingCart,
  Timer,
  Wrench,
  Activity,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const CustomerBookingsPage = () => {
  const { token, API, showToast, user } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [bookingToReschedule, setBookingToReschedule] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  // Removed refreshing state and related code

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, timeFilter, searchTerm, currentPage]);

  const fetchBookings = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        status: statusFilter,
        timeFilter: timeFilter,
        searchTerm: searchTerm,
        page: currentPage,
        limit: 10,
      });

      const response = await fetch(`${API}/booking/customer?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bookings: ${response.statusText}`);
      }

      const data = await response.json();
      setBookings(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Fetch bookings error:', error.message);
      showToast(`Error fetching bookings: ${error.message}`, 'error');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingDetails = (bookingId) => {
    const booking = bookings.find(b => b._id === bookingId);
    if (booking) {
      setSelectedBooking(booking);
      setShowModal(true);
    } else {
      showToast('Booking details not found', 'error');
    }
  };

  const handlePayNow = (booking) => {
    if (booking.status === 'pending' && booking.paymentStatus === 'pending') {
      navigate(`/customer/booking-confirm/${booking._id}`, {
        state: {
          booking,
          service: booking.services?.[0]?.serviceDetails,
          coupon: booking.couponApplied,
        },
      });
    } else {
      showToast('Payment can only be made for pending bookings.', 'info');
    }
  };

  const handleAcceptBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to accept this booking?')) return;

    try {
      const response = await fetch(`${API}/booking/bookings/${bookingId}/accept`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to accept booking');
      }

      showToast('Booking accepted successfully', 'success');
      fetchBookings();
    } catch (error) {
      console.error('Accept booking error:', error.message);
      showToast(`Error accepting booking: ${error.message}`, 'error');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      const response = await fetch(`${API}/booking/bookings/${bookingId}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Customer requested cancellation',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to cancel booking');
      }

      showToast('Booking cancelled successfully', 'success');
      fetchBookings();
    } catch (error) {
      console.error('Cancel booking error:', error.message);
      showToast(`Error cancelling booking: ${error.message}`, 'error');
    }
  };

  const handleRescheduleClick = (booking) => {
    setBookingToReschedule(booking);
    setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async ({ date, time }) => {
    if (!bookingToReschedule) return;

    try {
      const response = await fetch(`${API}/booking/bookings/${bookingToReschedule._id}/reschedule`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date, time }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to reschedule booking');
      }

      showToast('Booking rescheduled successfully', 'success');
      setShowRescheduleModal(false);
      setBookingToReschedule(null);
      fetchBookings();
    } catch (error) {
      console.error('Reschedule booking error:', error.message);
      showToast(`Error rescheduling booking: ${error.message}`, 'error');
    }
  };

  const callProvider = (phoneNumber) => {
    if (!phoneNumber) {
      showToast('Provider phone number not available', 'warning');
      return;
    }
    window.location.href = `tel:${phoneNumber}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'accepted':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'in_progress':
      case 'in-progress':
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
      case 'in-progress':
        return <Activity className="w-4 h-4" />;
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
        return 'Finding Provider';
      case 'accepted':
        return 'Confirmed';
      case 'in_progress':
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      case 'payment_pending':
        return 'Payment Due';
      default:
        return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
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

  const formatTime = (timeStr) => {
    if (!timeStr) return 'To be confirmed';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
  };

  const needsPayment = (booking) => {
    return booking.paymentStatus === 'pending' && !booking.confirmedBooking;
  };

  const canCancelBooking = (booking) => {
    return ['pending', 'accepted'].includes(booking.status);
  };

  const canReschedule = (booking) => {
    return booking.status === 'pending';
  };

  const isActiveBooking = (booking) => {
    return ['pending', 'accepted', 'in_progress', 'in-progress', 'payment_pending'].includes(booking.status);
  };

  const filteredBookings = bookings;


  // Timeline Component - Enhanced to use dynamic statusHistory and timestamps
  const BookingTimeline = ({ booking }) => {
    // Helper to get timestamp for a given status from statusHistory
    const getStatusTimestamp = (statusKey) => {
      const entry = booking.statusHistory?.find((h) => h.status === statusKey);
      return entry ? entry.timestamp : null;
    };

    // Define steps dynamically based on booking statusHistory and fields
    const steps = [
      {
        key: 'booked',
        label: 'Booking Placed',
        icon: ShoppingCart,
        completed: true,
        description: 'Your booking has been placed.',
        time: booking.createdAt,
      },
      {
        key: 'payment',
        label: 'Payment',
        icon: booking.paymentMethod === 'cash' ? DollarSign : CreditCard,
        completed: booking.paymentStatus === 'paid',
        active: booking.paymentStatus === 'pending' && !booking.confirmedBooking,
        description:
          booking.paymentStatus === 'paid'
            ? `Payment of ₹${booking.totalAmount} completed via ${booking.paymentMethod}`
            : booking.paymentMethod === 'cash'
            ? 'Pay after service completion'
            : 'Payment is pending',
        time: booking.paymentDate || getStatusTimestamp('payment_pending'),
      },
      {
        key: 'assigned',
        label: 'Provider Assigned',
        icon: User,
        completed: ['accepted', 'in-progress', 'completed'].includes(booking.status),
        active: booking.providerDetails && booking.status === 'pending',
        description: booking.providerDetails
          ? `${booking.providerDetails.name} has been assigned.`
          : 'Waiting for a provider to be assigned.',
        time: getStatusTimestamp('accepted') || getStatusTimestamp('assigned'),
      },
      {
        key: 'in_progress',
        label: 'Work Started',
        icon: Wrench,
        completed: ['in-progress', 'completed'].includes(booking.status),
        active: booking.status === 'in-progress',
        description: booking.status === 'in-progress' ? 'The provider has started the work.' : 'Work will begin soon.',
        time: booking.serviceStartedAt || getStatusTimestamp('in-progress'),
      },
      {
        key: 'completed',
        label: 'Completed',
        icon: CheckCircle,
        completed: booking.status === 'completed',
        description: booking.status === 'completed' ? 'Service has been completed successfully.' : 'Service completion is pending.',
        time: booking.serviceCompletedAt || getStatusTimestamp('completed'),
      },
    ];

    // Add estimated completion time step if available and not completed yet
    if (booking.estimatedCompletionTime && booking.status !== 'completed') {
      steps.push({
        key: 'estimated_completion',
        label: 'Estimated Completion',
        icon: Timer,
        completed: false,
        description: 'Estimated time for service completion',
        time: booking.estimatedCompletionTime,
      });
    }

    return (
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        <div className="flex items-center mb-4">
          <Package className="w-5 h-5 text-primary mr-2" />
          <h4 className="font-semibold text-secondary">Booking Process</h4>
        </div>

        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>

          <div className="space-y-6">
            {steps.map((step) => (
              <div key={step.key} className="relative flex items-start space-x-4">
                <div
                  className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                    step.completed ? 'bg-primary text-white shadow-lg' : step.active ? 'bg-accent text-white animate-pulse' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  <step.icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0 pb-4">
                  <h5
                    className={`text-sm font-semibold ${
                      step.completed ? 'text-primary' : step.active ? 'text-accent' : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </h5>
                  <p className="text-xs text-gray-600 mt-1">{step.description}</p>
                  {step.time && <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full mt-2 inline-block">{formatDateTime(step.time)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };
  
  // Re-add BookingTimeline to BookingModal
  const BookingModal = ({ booking, onClose }) => (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-xl z-10">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-secondary">{booking.services?.[0]?.service?.title || 'Service Booking'}</h2>
                <p className="text-sm text-gray-500">ID: #{booking._id.slice(-8).toUpperCase()}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
                
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6 pt-5 relative z-0">
            <BookingTimeline booking={booking} />

            {/* Service Details */}
            {booking.services && booking.services.length > 0 ? (
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="font-semibold text-secondary mb-3 flex items-center">
                  <Package className="w-4 h-4 text-primary mr-2" />
                  Service Details
                </h4>
                <div className="space-y-3">
                      {booking.services.map((serviceItem, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium text-secondary">
                          {serviceItem.service?.title || 'Service'}
                        </h5>
                        <span className="text-sm font-semibold text-primary">
                          ₹{serviceItem.price || 0}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                        <div>
                          <span className="font-medium">Category:</span> {serviceItem.service?.category || 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Quantity:</span> {serviceItem.quantity || 1}
                        </div>
                        <div>
                          <span className="font-medium">Duration:</span> {serviceItem.service?.duration ? `${serviceItem.service.duration} hrs` : 'N/A'}
                        </div>
                        <div>
                          <span className="font-medium">Discount:</span> ₹{serviceItem.discountAmount || 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">No service details available.</p>
            )}

            {/* Payment Details */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-secondary mb-3 flex items-center">
                <CreditCard className="w-4 h-4 text-primary mr-2" />
                Payment Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium capitalize">{booking.paymentMethod || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Status:</span>
                  <span className={`font-medium ${booking.paymentStatus === 'paid' ? 'text-green-600' : 'text-accent'}`}>
                    {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus === 'pending' ? 'Pending' : booking.paymentStatus || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">₹{booking.subtotal || 0}</span>
                </div>
                {booking.totalDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Discount:</span>
                    <span className="font-medium text-green-600">-₹{booking.totalDiscount}</span>
                  </div>
                )}
                {booking.couponApplied && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Coupon Applied:</span>
                    <span className="font-medium text-blue-600">{booking.couponApplied.code}</span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-2 mt-2">
                  <div className="flex justify-between font-semibold text-secondary">
                    <span>Total Amount:</span>
                    <span>₹{booking.totalAmount || 0}</span>
                  </div>
                </div>
                {booking.transactionId && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <h5 className="font-medium text-secondary mb-2">Transaction Information</h5>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transaction ID:</span>
                        <span className="font-mono">{booking.transactionId}</span>
                      </div>
                      {booking.razorpayPaymentId && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment ID:</span>
                          <span className="font-mono">{booking.razorpayPaymentId}</span>
                        </div>
                      )}
                      {booking.paymentDate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Payment Date:</span>
                          <span>{new Date(booking.paymentDate).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Address */}
              {booking.address && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-secondary mb-3 flex items-center">
                    <MapPin className="w-4 h-4 text-primary mr-2" />
                    Service Address
                  </h4>
                  <p className="text-sm text-gray-700">
                    {[
                      booking.address.street,
                      booking.address.city,
                      booking.address.state,
                      booking.address.postalCode
                    ].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    Phone: {user.phone}
                  </p>
                </div>
              )}

              {/* Provider Details */}
              {booking.providerDetails && ['accepted', 'in_progress', 'in-progress'].includes(booking.status) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-secondary mb-3 flex items-center">
                    <User className="w-4 h-4 text-primary mr-2" />
                    Provider Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">{booking.providerDetails.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium">{booking.providerDetails.phone}</span>
                    </div>
                    {booking.providerDetails.rating && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rating:</span>
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-400 mr-1" />
                          <span className="font-medium">{booking.providerDetails.rating}/5</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-xl">
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Close
              </button>

              {needsPayment(booking) && (
                <button
                  onClick={() => {
                    onClose();
                    handlePayNow(booking);
                  }}
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium flex items-center space-x-1"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pay Now</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Booking Card Component
  const BookingCard = ({ booking }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      {/* Status Banner */}
      <div className={`h-1 ${
        booking.status === 'completed' ? 'bg-primary' :
        booking.status === 'cancelled' ? 'bg-red-500' :
        booking.status === 'in_progress' || booking.status === 'in-progress' ? 'bg-accent' :
        booking.status === 'accepted' ? 'bg-blue-500' :
        'bg-amber-500'
      }`}></div>

      <div className="p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-3">
          <div className="flex items-start space-x-4 flex-1">
            {/* Service Image */}
            <div className="flex-shrink-0">
              {booking.services?.[0]?.service?.images && booking.services[0].service.images.length > 0 ? (
                <img
                  src={booking.services[0].service.images[0]}
                  alt={booking.services[0]?.service?.title || 'Service'}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-gray-100"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div
                className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/20 rounded-xl flex items-center justify-center border-2 border-primary/20"
                style={booking.services?.[0]?.service?.images && booking.services[0].service.images.length > 0 ? { display: 'none' } : {}}
              >
                <Wrench className="w-6 h-6 text-primary" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              {/* Service Title */}
              <h3 className="font-semibold text-lg text-secondary mb-1 truncate">
                {booking.services?.[0]?.service?.title || 'Service Booking'}
              </h3>

              {/* Booking ID */}
              <p className="text-sm text-gray-500 mb-2">
                Booking ID: #{booking?._id?.slice(-8).toUpperCase()}
              </p>

              {/* Date & Time */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 mb-3">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(booking.date)}</span>
                </div>
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(booking.time)}</span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center space-x-1 text-xs font-medium px-3 py-1.5 rounded-full border ${getStatusColor(booking.status)}`}>
                  {getStatusIcon(booking.status)}
                  <span>{getStatusText(booking.status)}</span>
                </span>

                {booking.paymentStatus === 'pending' && (
                  <span className="inline-flex items-center space-x-1 text-xs font-medium px-3 py-1.5 rounded-full bg-accent/10 text-accent border border-accent/30 animate-pulse">
                    <AlertCircle className="w-3 h-3" />
                    <span>Payment Due</span>
                  </span>
                )}
              </div>
              {booking.paymentStatus === 'pending' && (
                <p className="text-xs text-amber-700 mt-2 p-2 bg-amber-50 rounded-md">
                  Please confirm your booking so that a provider can be assigned and your request can be resolved.
                </p>
              )}
            </div>
          </div>

          {/* Price & Actions */}
          <div className="text-right mt-4 sm:mt-0">
            <p className="text-2xl font-bold text-secondary">
              ₹{booking.totalAmount || 0}
            </p>
            <p className={`text-sm font-medium ${
              booking.paymentStatus === 'paid' ? 'text-primary' : 'text-accent'
            }`}>
              ✓ Paid via {booking.paymentMethod}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">

          <button
            onClick={() => fetchBookingDetails(booking._id)}
            className="flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
          >
            <Eye className="w-4 h-4" />
            <span>View in Modal</span>
          </button>

          {needsPayment(booking) && (
            <button
              onClick={() => handlePayNow(booking)}
              className="flex items-center space-x-1 text-sm font-medium text-white bg-accent hover:bg-accent/90 px-4 py-2 rounded-lg transition-all duration-200 shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              <span>Pay Now</span>
            </button>
          )}



          {canReschedule(booking) && (
            <button
              onClick={() => handleRescheduleClick(booking)}
              className="flex items-center space-x-1 text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200"
            >
              <Edit3 className="w-4 h-4" />
              <span>Reschedule</span>
            </button>
          )}

          {booking.status !== 'completed' && booking.status !== 'pending' && booking.status !== 'cancelled' && (booking.providerDetails?.phone || booking.provider?.phone) && (
            <button
              onClick={() => callProvider(booking.providerDetails?.phone || booking.provider?.phone)}
              className="flex items-center space-x-1 text-sm font-medium text-primary hover:text-primary/80 px-3 py-2 rounded-lg hover:bg-primary/5 transition-colors border border-primary/20"
            >
              <Phone className="w-4 h-4" />
              <span>Call Provider</span>
            </button>
          )}

          {canCancelBooking(booking) && (
            <button
              onClick={() => handleCancelBooking(booking._id)}
              className="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors border border-red-200"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Expanded Details */}
        {expandedBooking === booking._id && (
          <div className="mt-6 pt-6 border-t border-gray-100 space-y-6">
            <BookingTimeline booking={booking} />

            {/* Service Details */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-secondary mb-3 flex items-center">
                <Package className="w-4 h-4 text-primary mr-2" />
                Service Details
              </h4>
              <div className="space-y-3">
                {booking.services?.map((serviceItem, index) => (
                  <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="font-medium text-secondary">
                        {serviceItem.serviceDetails?.title || 'Service'}
                      </h5>
                      <span className="text-sm font-semibold text-primary">
                        ₹{serviceItem.price || 0}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                      <div>
                        <span className="font-medium">Category:</span> {serviceItem.serviceDetails?.category || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Quantity:</span> {serviceItem.quantity || 1}
                      </div>
                      <div>
                        <span className="font-medium">Duration:</span> {serviceItem.serviceDetails?.duration ? `${serviceItem.serviceDetails.duration} hrs` : 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Discount:</span> ₹{serviceItem.discountAmount || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-semibold text-secondary mb-3 flex items-center">
                <CreditCard className="w-4 h-4 text-primary mr-2" />
                Payment Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method:</span>
                  <span className="font-medium capitalize">{booking.paymentMethod || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Status:</span>
                  <span className={`font-medium ${booking.paymentStatus === 'paid' ? 'text-green-600' : 'text-accent'}`}>
                    {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus === 'pending' ? 'Pending' : booking.paymentStatus || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">₹{booking.subtotal || 0}</span>
                </div>
                {booking.totalDiscount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Discount:</span>
                    <span className="font-medium text-green-600">-₹{booking.totalDiscount}</span>
                  </div>
                )}
              {booking.couponApplied && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Coupon Applied:</span>
                  <span className="font-medium text-blue-600">{booking.couponApplied.code}</span>
                </div>
              )}
              <div className="border-t border-gray-300 pt-2 mt-2">
                <div className="flex justify-between font-semibold text-secondary">
                  <span>Total Amount:</span>
                  <span>₹{booking.totalAmount || 0}</span>
                </div>
              </div>
              {booking.transactionId && (
                <div className="mt-3 pt-3 border-t border-gray-300">
                  <h5 className="font-medium text-secondary mb-2">Transaction Information</h5>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Transaction ID:</span>
                      <span className="font-mono">{booking.transactionId}</span>
                    </div>
                    {booking.razorpayPaymentId && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment ID:</span>
                        <span className="font-mono">{booking.razorpayPaymentId}</span>
                      </div>
                    )}
                    {booking.paymentDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Date:</span>
                        <span>{new Date(booking.paymentDate).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Address */}
              {booking.address && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-secondary mb-3 flex items-center">
                    <MapPin className="w-4 h-4 text-primary mr-2" />
                    Service Address
                  </h4>
                  <p className="text-sm text-gray-700">
                    {[
                      booking.address.street,
                      booking.address.city,
                      booking.address.state,
                      booking.address.postalCode
                    ].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    Phone: {user.phone}
                  </p>
                </div>
              )}

              {/* Provider Details */}
              {booking.providerDetails && ['accepted', 'in_progress', 'in-progress'].includes(booking.status) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-secondary mb-3 flex items-center">
                    <User className="w-4 h-4 text-primary mr-2" />
                    Provider Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">{booking.providerDetails.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone:</span>
                      <span className="font-medium">{booking.providerDetails.phone}</span>
                    </div>
                    {booking.providerDetails.rating && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rating:</span>
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-400 mr-1" />
                          <span className="font-medium">{booking.providerDetails.rating}/5</span>
                        </div>
                      </div>
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

  // Reschedule Modal
  const RescheduleModal = ({ booking, onClose, onConfirm }) => {
    const [date, setDate] = useState(booking ? new Date(booking.date).toISOString().split('T')[0] : '');
    const [time, setTime] = useState(booking?.time || '');
    const [error, setError] = useState('');

    const handleSubmit = () => {
      const now = new Date();
      const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      const bookingDateTime = new Date(`${date}T${time}`);

      if (bookingDateTime < sixHoursLater) {
        setError('Cannot reschedule within 6 hours of booking time. Please contact support.');
        return;
      }
      setError('');
      onConfirm({ date, time });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-md w-full">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-secondary">Reschedule Booking</h2>
            <p className="text-sm text-gray-500">ID: #{booking._id.slice(-8).toUpperCase()}</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">New Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">New Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-xl">
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button onClick={handleSubmit} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
              Confirm Reschedule
            </button>
          </div>
        </div>
      </div>
    );
  };



  // Loading Component
  if (loading) {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6 font-inter">
      <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
        <div className="flex flex-col sm:flex-row items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-secondary">My Bookings</h1>
            <p className="text-gray-600 mt-1">
              {filteredBookings.length} of {pagination.totalBookings || 0} {pagination.totalBookings === 1 ? 'booking' : 'total bookings'} shown
            </p>
          </div>
        </div>
      </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Filter by Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              >
                <option value="all">All</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="pending_payment">Pending Payment</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Filter by Time</label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              >
                <option value="all">All Time</option>
                <option value="7days">Last 7 Days</option>
                <option value="1month">1 Month</option>
                <option value="6months">6 Months</option>
                <option value="1year">1 Year</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Search Bookings</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by service name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setStatusFilter('all');
                  setTimeFilter('all');
                  setSearchTerm('');
                }}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Bookings List */}
        <div>
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
              <div className="mx-auto h-24 w-24 text-gray-400 mb-6">
                <Calendar className="w-full h-full" />
              </div>
              <h3 className="text-xl font-medium text-secondary mb-2">No bookings found</h3>
              <p className="text-gray-500 mb-6">
                {statusFilter !== 'all' || searchTerm || timeFilter !== 'all'
                  ? 'Try adjusting your filters to see more results'
                  : "You haven't made any bookings yet. Start exploring our services!"}
              </p>
              {statusFilter === 'all' && !searchTerm && (
                <button
                  onClick={() => navigate('/services')}
                  className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors font-medium"
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
      {showRescheduleModal && bookingToReschedule && (
        <RescheduleModal 
            booking={bookingToReschedule}
            onClose={() => setShowRescheduleModal(false)}
            onConfirm={handleRescheduleSubmit}
        />
      )}
    </div>
  );
};

export default CustomerBookingsPage;