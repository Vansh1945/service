import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ServiceBooking = () => {
  const [services, setServices] = useState([]);
  const [cart, setCart] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingDetails, setBookingDetails] = useState({
    date: '',
    time: '',
    address: {
      street: '',
      city: '',
      postalCode: '',
      state: '',
      country: 'India'
    },
    notes: ''
  });
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState(null);
  const [activeTab, setActiveTab] = useState('services');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Fetch services on component mount
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('http://localhost:5000/api/service/');
        // Ensure the response data is an array
        if (Array.isArray(response.data)) {
          setServices(response.data);
        } else {
          setServices([]);
          setError('Services data is not in expected format');
        }
      } catch (err) {
        setError('Failed to fetch services');
        setServices([]); // Ensure services is always an array
      } finally {
        setIsLoading(false);
      }
    };

    fetchServices();
    fetchUserBookings();
  }, []);

  // Fetch user bookings
  const fetchUserBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/booking/user', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Ensure bookings is always an array
      setBookings(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (err) {
      setError('Failed to fetch bookings');
      setBookings([]); // Ensure bookings is always an array
    }
  };

  // Add service to cart
  const addToCart = (service) => {
    setCart([...cart, { ...service, quantity: 1 }]);
    setSuccess(`${service.title} added to cart`);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Remove service from cart
  const removeFromCart = (serviceId) => {
    setCart(cart.filter(item => item._id !== serviceId));
  };

  // Apply coupon
  const applyCoupon = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/couponsvalidate', {
        couponCode,
        amount: cart.reduce((total, item) => total + (item.basePrice * item.quantity), 0)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCouponApplied(response.data);
      setSuccess('Coupon applied successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid coupon');
    }
  };

  // Calculate total
  const calculateTotal = () => {
    const subtotal = cart.reduce((total, item) => total + (item.basePrice * item.quantity), 0);
    const discount = couponApplied?.discount || 0;
    return {
      subtotal,
      discount,
      total: subtotal - discount
    };
  };

  // Handle input change for booking details
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('address.')) {
      const addressField = name.split('.')[1];
      setBookingDetails({
        ...bookingDetails,
        address: {
          ...bookingDetails.address,
          [addressField]: value
        }
      });
    } else {
      setBookingDetails({
        ...bookingDetails,
        [name]: value
      });
    }
  };

  // Create booking
  const createBooking = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Create booking for each service in cart
      const bookingPromises = cart.map(service => 
        axios.post('http://localhost:5000/api/booking', {
          serviceId: service._id,
          date: bookingDetails.date,
          time: bookingDetails.time,
          address: bookingDetails.address,
          couponCode: couponApplied?.code,
          notes: bookingDetails.notes
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      );

      await Promise.all(bookingPromises);
      setCart([]);
      setBookingDetails({
        date: '',
        time: '',
        address: {
          street: '',
          city: '',
          postalCode: '',
          state: '',
          country: 'India'
        },
        notes: ''
      });
      setCouponApplied(null);
      setCouponCode('');
      setSuccess('Booking created successfully!');
      fetchUserBookings();
      setActiveTab('bookings');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create booking');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel booking
  const cancelBooking = async (bookingId) => {
    try {
      if (!window.confirm('Are you sure you want to cancel this booking?')) return;
      
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:5000/api/booking/user/${bookingId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Booking cancelled successfully');
      fetchUserBookings();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel booking');
    }
  };

  // Reschedule booking
  const rescheduleBooking = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:5000/api/booking/user/${selectedBooking._id}/reschedule`, {
        date: bookingDetails.date,
        time: bookingDetails.time
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Booking rescheduled successfully');
      setSelectedBooking(null);
      fetchUserBookings();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reschedule booking');
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch {
      return dateString; // Return raw string if date parsing fails
    }
  };

  // Get booking status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'accepted': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Service Booking</h1>
      
      {/* Navigation Tabs */}
      <div className="flex border-b mb-6">
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'services' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('services')}
        >
          Services
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'cart' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('cart')}
          disabled={cart.length === 0}
        >
          Cart ({cart.length})
        </button>
        <button
          className={`py-2 px-4 font-medium ${activeTab === 'bookings' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('bookings')}
        >
          My Bookings
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button className="float-right font-bold" onClick={() => setError('')}>×</button>
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
          <button className="float-right font-bold" onClick={() => setSuccess('')}>×</button>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Available Services</h2>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.length > 0 ? (
                services.map(service => (
                  <div key={service._id} className="border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow">
                    <img 
                      src={service.image || 'https://via.placeholder.com/300x200'} 
                      alt={service.title} 
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
                      <p className="text-gray-600 mb-2">{service.category}</p>
                      <p className="text-gray-700 mb-4">{service.description}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">₹{service.basePrice}</span>
                        <button 
                          onClick={() => addToCart(service)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8">
                  <p className="text-gray-500">No services available</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cart Tab */}
      {activeTab === 'cart' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Your Cart</h2>
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Your cart is empty</p>
              <button 
                onClick={() => setActiveTab('services')}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Browse Services
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {cart.map(item => (
                        <tr key={item._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <img className="h-10 w-10 rounded-full" src={item.image} alt={item.title} />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{item.title}</div>
                                <div className="text-sm text-gray-500">{item.category}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₹{item.basePrice}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button 
                              onClick={() => removeFromCart(item._id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Coupon Section */}
                <div className="mt-6 bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-2">Apply Coupon</h3>
                  <div className="flex">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 border rounded-l px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={applyCoupon}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r"
                    >
                      Apply
                    </button>
                  </div>
                  {couponApplied && (
                    <div className="mt-2 text-green-600">
                      Coupon applied: {couponApplied.code} (-₹{couponApplied.discount})
                    </div>
                  )}
                </div>

                {/* Booking Details Form */}
                <div className="mt-6 bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-medium mb-4">Booking Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        name="date"
                        value={bookingDetails.date}
                        onChange={handleInputChange}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <input
                        type="time"
                        name="time"
                        value={bookingDetails.time}
                        onChange={handleInputChange}
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                    <input
                      type="text"
                      name="address.street"
                      value={bookingDetails.address.street}
                      onChange={handleInputChange}
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input
                        type="text"
                        name="address.city"
                        value={bookingDetails.address.city}
                        onChange={handleInputChange}
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        name="address.state"
                        value={bookingDetails.address.state}
                        onChange={handleInputChange}
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
                      <input
                        type="text"
                        name="address.postalCode"
                        value={bookingDetails.address.postalCode}
                        onChange={handleInputChange}
                        pattern="[0-9]{6}"
                        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                    <textarea
                      name="notes"
                      value={bookingDetails.notes}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div>
                <div className="bg-white p-4 rounded-lg shadow sticky top-4">
                  <h3 className="text-lg font-medium mb-4">Order Summary</h3>
                  <div className="space-y-2">
                    {cart.map(item => (
                      <div key={item._id} className="flex justify-between">
                        <span>{item.title}</span>
                        <span>₹{item.basePrice}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t my-3"></div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>₹{calculateTotal().subtotal}</span>
                    </div>
                    {couponApplied && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({couponApplied.code})</span>
                        <span>-₹{calculateTotal().discount}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg mt-2">
                      <span>Total</span>
                      <span>₹{calculateTotal().total}</span>
                    </div>
                  </div>
                  <button
                    onClick={createBooking}
                    disabled={isLoading || !bookingDetails.date || !bookingDetails.time || !bookingDetails.address.street || !bookingDetails.address.city || !bookingDetails.address.state || !bookingDetails.address.postalCode}
                    className={`w-full mt-6 py-2 px-4 rounded font-medium ${isLoading || !bookingDetails.date || !bookingDetails.time || !bookingDetails.address.street || !bookingDetails.address.city || !bookingDetails.address.state || !bookingDetails.address.postalCode ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                  >
                    {isLoading ? 'Processing...' : 'Confirm Booking'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">My Bookings</h2>
          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">You don't have any bookings yet</p>
              <button 
                onClick={() => setActiveTab('services')}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Book a Service
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map(booking => (
                <div key={booking._id} className="border rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium">{booking.service?.title}</h3>
                      <p className="text-gray-600">{booking.service?.category}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Date & Time</p>
                      <p>{formatDate(booking.date)} {booking.time && `at ${booking.time}`}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p>{booking.address.street}, {booking.address.city}, {booking.address.state} - {booking.address.postalCode}</p>
                    </div>
                  </div>
                  {booking.notes && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">Notes</p>
                      <p>{booking.notes}</p>
                    </div>
                  )}
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setBookingDetails({
                          date: booking.date.split('T')[0],
                          time: booking.time || '',
                          address: booking.address,
                          notes: booking.notes || ''
                        });
                      }}
                      disabled={booking.status !== 'pending' && booking.status !== 'accepted'}
                      className={`px-3 py-1 text-sm rounded ${booking.status !== 'pending' && booking.status !== 'accepted' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => cancelBooking(booking._id)}
                      disabled={booking.status === 'completed' || booking.status === 'cancelled'}
                      className={`px-3 py-1 text-sm rounded ${booking.status === 'completed' || booking.status === 'cancelled' ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reschedule Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4">Reschedule Booking</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                <input
                  type="date"
                  name="date"
                  value={bookingDetails.date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
                <input
                  type="time"
                  name="time"
                  value={bookingDetails.time}
                  onChange={handleInputChange}
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={rescheduleBooking}
                  disabled={!bookingDetails.date || !bookingDetails.time}
                  className={`px-4 py-2 rounded text-white ${!bookingDetails.date || !bookingDetails.time ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceBooking;