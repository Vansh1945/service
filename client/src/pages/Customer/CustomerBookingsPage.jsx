import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Link, useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaMoneyBillWave, FaInfoCircle, FaTimes, FaCheck } from 'react-icons/fa';
import { RiRefundLine } from 'react-icons/ri';
import { BsCalendar2Event } from 'react-icons/bs';

const CustomerBookingsPage = () => {
  const { user, token, API } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [rescheduleData, setRescheduleData] = useState({
    bookingId: null,
    date: new Date(),
    time: '12:00'
  });
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [reschedulingId, setReschedulingId] = useState(null);

  // Fetch bookings
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API}/booking/user`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data?.success) {
          const bookingsData = Array.isArray(response.data.data) ? response.data.data : [];
          setBookings(bookingsData);
        } else {
          setBookings([]);
          toast.info(response.data?.message || 'No bookings found');
        }
      } catch (error) {
        console.error('Error fetching bookings:', error);
        toast.error(error.response?.data?.message || 'Failed to load bookings');
        setBookings([]);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchBookings();
    } else {
      navigate('/login');
    }
  }, [API, token, navigate]);

  // Filter bookings based on selected filter
  const filteredBookings = bookings.filter(booking => {
    if (!booking || !booking._id) return false;
    
    const now = new Date();
    const bookingDate = booking.date ? new Date(booking.date) : new Date(0);
    const bookingTime = booking.time ? booking.time.split(':') : [0, 0];
    bookingDate.setHours(parseInt(bookingTime[0]) || 0, parseInt(bookingTime[1]) || 0);
    
    if (filter === 'upcoming') return bookingDate > now && booking.status !== 'cancelled' && booking.status !== 'completed';
    if (filter === 'completed') return booking.status === 'completed';
    if (filter === 'cancelled') return booking.status === 'cancelled';
    if (filter === 'past') return bookingDate < now && booking.status !== 'cancelled';
    return true;
  });

  // Cancel a booking
  const cancelBooking = async (bookingId) => {
    try {
      setCancellingId(bookingId);
      const response = await axios.patch(
        `${API}/booking/user/${bookingId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Update local state
        setBookings(bookings.map(booking => 
          booking._id === bookingId ? { ...booking, status: 'cancelled' } : booking
        ));
        
        toast.success('Booking cancelled successfully');
        
        // Show refund info if applicable
        if (response.data.data?.refund) {
          toast.info(
            <div>
              <p>Refund initiated: ₹{response.data.data.refund.amount.toFixed(2)}</p>
              <p>Status: {response.data.data.refund.status}</p>
              {response.data.data.refund.status === 'pending' && (
                <p className="text-sm mt-1">Please allow 5-7 business days for processing</p>
              )}
            </div>,
            { autoClose: 8000 }
          );
        }
      } else {
        toast.error(response.data.message || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      const errorMsg = error.response?.data?.message || 
        (error.response?.status === 403 
          ? 'Cannot cancel booking within 6 hours of service time. Please contact support.'
          : 'Failed to cancel booking');
      toast.error(errorMsg);
    } finally {
      setCancellingId(null);
    }
  };

  // Open reschedule modal
  const openRescheduleModal = (booking) => {
    setRescheduleData({
      bookingId: booking._id,
      date: new Date(booking.date),
      time: booking.time || '12:00'
    });
    setShowRescheduleModal(true);
  };

  // Handle reschedule form submit
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    try {
      setReschedulingId(rescheduleData.bookingId);
      
      const response = await axios.patch(
        `${API}/booking/user/${rescheduleData.bookingId}/reschedule`,
        {
          date: rescheduleData.date.toISOString().split('T')[0],
          time: rescheduleData.time
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        // Update local state
        setBookings(bookings.map(booking => 
          booking._id === rescheduleData.bookingId 
            ? { 
                ...booking, 
                date: rescheduleData.date.toISOString().split('T')[0],
                time: rescheduleData.time
              } 
            : booking
        ));
        
        toast.success('Booking rescheduled successfully');
        setShowRescheduleModal(false);
      } else {
        toast.error(response.data.message || 'Failed to reschedule booking');
      }
    } catch (error) {
      console.error('Error rescheduling booking:', error);
      const errorMsg = error.response?.data?.message || 
        (error.response?.status === 403 
          ? 'Cannot reschedule booking within 6 hours of service time. Please contact support.'
          : 'Failed to reschedule booking');
      toast.error(errorMsg);
    } finally {
      setReschedulingId(null);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format time for display
  const formatTime = (timeString) => {
    if (!timeString) return 'Not specified';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    return `${hour > 12 ? hour - 12 : hour}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  // Get status badge styling
  const getStatusBadge = (status) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Loading state
  if (loading && bookings.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-800">Reschedule Booking</h3>
              <button 
                onClick={() => setShowRescheduleModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={20} />
              </button>
            </div>
            
            <form onSubmit={handleRescheduleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Date
                </label>
                <DatePicker
                  selected={rescheduleData.date}
                  onChange={(date) => setRescheduleData({...rescheduleData, date})}
                  minDate={new Date()}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Time
                </label>
                <TimePicker
                  onChange={(time) => setRescheduleData({...rescheduleData, time})}
                  value={rescheduleData.time}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  disableClock
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reschedulingId === rescheduleData.bookingId}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
                >
                  {reschedulingId === rescheduleData.bookingId ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : 'Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">My Bookings</h1>
          <p className="text-gray-600 mt-1">
            {filteredBookings.length} {filter === 'all' ? 'total' : filter} booking{filteredBookings.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setFilter('all')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('upcoming')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Upcoming
          </button>
          <button 
            onClick={() => setFilter('completed')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Completed
          </button>
          <button 
            onClick={() => setFilter('cancelled')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'cancelled' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Cancelled
          </button>
          <button 
            onClick={() => setFilter('past')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${filter === 'past' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Past
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredBookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <BsCalendar2Event className="text-gray-400 text-3xl" />
          </div>
          <h3 className="text-lg font-medium text-gray-700">
            {filter === 'all' 
              ? "You don't have any bookings yet"
              : `No ${filter} bookings found`}
          </h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            {filter === 'all'
              ? "Get started by booking a service that matches your needs."
              : filter === 'upcoming'
              ? "You don't have any upcoming bookings. Check out our services to book one."
              : filter === 'completed'
              ? "Your completed bookings will appear here."
              : filter === 'cancelled'
              ? "You haven't cancelled any bookings yet."
              : "Your past bookings will appear here."}
          </p>
          
          <div className="mt-6">
            {filter !== 'all' ? (
              <button 
                onClick={() => setFilter('all')}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                View all bookings
              </button>
            ) : (
              <Link 
                to="/services"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-block"
              >
                Book a Service
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredBookings.map((booking) => {
            const mainService = booking.services?.[0]?.serviceDetails || {};
            const isUpcoming = new Date(booking.date) > new Date() && booking.status !== 'cancelled' && booking.status !== 'completed';
            const isCancellable = isUpcoming && booking.paymentStatus === 'paid';
            const isReschedulable = isUpcoming && booking.paymentStatus === 'paid';
            const hasRefund = booking.status === 'cancelled' && booking.refund;
            
            return (
              <div key={booking._id} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-6">
                  {/* Booking header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        {mainService.title || 'Service not available'}
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(booking.status)}`}>
                          {booking.status ? (booking.status.charAt(0).toUpperCase() + booking.status.slice(1)) : 'Unknown'}
                        </span>
                      </h3>
                      <p className="text-gray-600 mt-1 text-sm">
                        Booking ID: {booking._id}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="font-bold text-lg">₹{(booking.totalAmount || 0).toFixed(2)}</p>
                      {booking.paymentStatus === 'paid' && (
                        <p className="text-xs text-green-600 mt-1">Paid</p>
                      )}
                    </div>
                  </div>

                  {/* Booking details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-blue-600">
                        <FaCalendarAlt />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Date</p>
                        <p className="font-medium">{formatDate(booking.date)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-blue-600">
                        <FaClock />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Time</p>
                        <p className="font-medium">{formatTime(booking.time)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-blue-600">
                        <FaMapMarkerAlt />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Location</p>
                        <p className="font-medium">
                          {booking.address?.city || 'Not specified'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="mt-1 text-blue-600">
                        <FaInfoCircle />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Service Type</p>
                        <p className="font-medium capitalize">
                          {mainService.category || 'Not specified'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Address details */}
                  {booking.address && (
                    <div className="mt-4 bg-gray-50 p-3 rounded-md">
                      <p className="text-sm text-gray-500 mb-1">Service Address</p>
                      <p className="font-medium">
                        {booking.address.street}, {booking.address.city}, {booking.address.state} - {booking.address.postalCode}
                      </p>
                    </div>
                  )}

                  {/* Refund info */}
                  {hasRefund && (
                    <div className="mt-4 bg-yellow-50 p-3 rounded-md border border-yellow-100 flex items-start gap-3">
                      <RiRefundLine className="text-yellow-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Refund Information</p>
                        <p className="text-sm text-yellow-700">
                          ₹{booking.refund.amount.toFixed(2)} will be refunded via {booking.paymentMethod}.
                          Status: <span className="capitalize">{booking.refund.status}</span>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      to={`/bookings/${booking._id}`}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <FaInfoCircle /> View Details
                    </Link>
                    
                    {mainService._id && (
                      <Link
                        to={`/services/${mainService._id}`}
                        className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-2"
                      >
                        <FaCheck /> Book Again
                      </Link>
                    )}
                    
                    {isCancellable && (
                      <button
                        onClick={() => cancelBooking(booking._id)}
                        disabled={cancellingId === booking._id}
                        className="px-4 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {cancellingId === booking._id ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Cancelling...
                          </>
                        ) : (
                          <>
                            <FaTimes /> Cancel
                          </>
                        )}
                      </button>
                    )}
                    
                    {isReschedulable && (
                      <button
                        onClick={() => openRescheduleModal(booking)}
                        disabled={reschedulingId === booking._id}
                        className="px-4 py-2 border border-green-600 text-green-600 rounded-md hover:bg-green-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <BsCalendar2Event /> Reschedule
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerBookingsPage;