import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import axios from 'axios';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Link } from 'react-router-dom';

const CustomerBookingsPage = () => {
  const { user, token, API, showToast } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'upcoming', 'completed', 'cancelled'

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await axios.get(`${API}/booking/user`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setBookings(response.data);
      } catch (error) {
        showToast(error.response?.data?.message || 'Failed to load bookings', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [API, token, showToast]);

  const filteredBookings = bookings.filter(booking => {
    const now = new Date();
    const bookingDate = new Date(`${booking.bookingDate}T${booking.bookingTime}`);
    
    if (filter === 'upcoming') return bookingDate > now && booking.status !== 'cancelled';
    if (filter === 'completed') return bookingDate < now || booking.status === 'completed';
    if (filter === 'cancelled') return booking.status === 'cancelled';
    return true; // 'all'
  });

  const cancelBooking = async (bookingId) => {
    try {
      setLoading(true);
      await axios.patch(
        `${API}/booking/${bookingId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBookings(bookings.map(b => 
        b._id === bookingId ? { ...b, status: 'cancelled' } : b
      ));
      showToast('Booking cancelled successfully', 'success');
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to cancel booking', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatTime = (timeString) => {
    return timeString?.substring(0, 5); // Format as HH:MM
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">My Bookings</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 rounded-md ${filter === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-4 py-2 rounded-md ${filter === 'completed' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`px-4 py-2 rounded-md ${filter === 'cancelled' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            Cancelled
          </button>
        </div>
      </div>

      {filteredBookings.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-600">
            {filter === 'all' 
              ? "You don't have any bookings yet"
              : `No ${filter} bookings found`}
          </h3>
          {filter !== 'all' && (
            <button 
              onClick={() => setFilter('all')}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              View all bookings
            </button>
          )}
          {filter === 'all' && (
            <Link 
              to="/customer/services"
              className="mt-4 inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Book a Service
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredBookings.map(booking => (
            <div key={booking._id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">{booking.service.name}</h3>
                    <p className="text-gray-600 mt-1">{booking.service.description}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                    booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {booking.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">{formatDate(booking.bookingDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="font-medium">{formatTime(booking.bookingTime)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Amount</p>
                    <p className="font-medium">₹{booking.totalAmount}</p>
                  </div>
                </div>

                <div className="mt-6 flex space-x-4">
                  <Link
                    to={`/customer/book-service/${booking.service._id}`}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
                  >
                    Book Again
                  </Link>
                  {booking.status !== 'cancelled' && new Date(`${booking.bookingDate}T${booking.bookingTime}`) > new Date() && (
                    <button
                      onClick={() => cancelBooking(booking._id)}
                      disabled={loading}
                      className="px-4 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel Booking
                    </button>
                  )}
                  <Link
                    to={`/customer/payments/${booking._id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerBookingsPage;