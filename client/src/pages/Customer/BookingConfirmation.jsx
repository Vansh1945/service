import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import axios from 'axios';
import {
  FaArrowLeft,
  FaCreditCard,
  FaMoneyBillWave,
  FaCheckCircle,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaClock,
  FaTag,
  FaExclamationTriangle,
  FaSpinner,
  FaShieldAlt,
  FaLock
} from 'react-icons/fa';
import { motion } from 'framer-motion';
import { FiChevronRight } from 'react-icons/fi';

const BookingConfirmation = () => {
  const { bookingId } = useParams();
  const { token, user, isAuthenticated, API, showToast } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [bookingDetails, setBookingDetails] = useState(null);
  const [serviceDetails, setServiceDetails] = useState(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(true);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    const loadRazorpay = () => {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          setRazorpayLoaded(true);
          resolve(true);
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.onload = () => {
          setRazorpayLoaded(true);
          resolve(true);
        };
        script.onerror = () => {
          console.error('Failed to load Razorpay script');
          resolve(false);
        };
        document.body.appendChild(script);
      });
    };

    if (paymentMethod === 'online') {
      loadRazorpay();
    }

    return () => {
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript && document.body.contains(existingScript)) {
        try {
          document.body.removeChild(existingScript);
        } catch (error) {
          console.warn('Script removal failed:', error);
        }
      }
    };
  }, [paymentMethod]);

  const fetchBookingDetails = async () => {
    try {
      setIsLoadingBooking(true);

      if (!token) {
        throw new Error('Authentication token is missing');
      }

      const response = await axios.get(`${API}/booking/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to fetch booking details');
      }

      const booking = response.data.data;
      if (!booking) {
        throw new Error('Booking data not found in response');
      }

      // Set default payment method based on booking data
      if (booking.paymentMethod) {
        setPaymentMethod(booking.paymentMethod);
      }

      setBookingDetails(booking);

      if (location.state?.service) {
        setServiceDetails(location.state.service);
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);

      let errorMessage = 'Failed to load booking details';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your connection.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
        setTimeout(() => navigate('/login'), 2000);
      } else if (error.response?.status === 404) {
        errorMessage = 'Booking not found. It may have been cancelled or doesn\'t exist.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      showToast(errorMessage, 'error');

      if (error.response?.status !== 401) {
        setTimeout(() => navigate('/customer/bookings'), 2000);
      }
    } finally {
      setIsLoadingBooking(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !token) {
      showToast('Please login to view booking details', 'error');
      navigate('/login');
      return;
    }

    if (!bookingId || bookingId === 'undefined' || bookingId === 'null') {
      console.error('Invalid booking ID:', bookingId);
      showToast('Invalid booking ID. Please try booking again.', 'error');
      navigate('/customer/services');
      return;
    }

    if (location.state?.booking) {
      setBookingDetails(location.state.booking);
      setServiceDetails(location.state.service);
      setIsLoadingBooking(false);
    } else {
      fetchBookingDetails();
    }
  }, [bookingId, isAuthenticated, token]);

  const validateBookingDetails = () => {
    if (!bookingDetails) {
      showToast('Booking details are missing', 'error');
      return false;
    }

    if (!bookingDetails._id) {
      showToast('Invalid booking ID', 'error');
      return false;
    }

    if (!bookingDetails.totalAmount || bookingDetails.totalAmount <= 0) {
      showToast('Invalid booking amount', 'error');
      return false;
    }

    return true;
  };

  const handleCashPayment = async () => {
    if (!validateBookingDetails()) return;

    try {
      setLoading(true);

      const response = await axios.post(
        `${API}/booking/${bookingDetails._id}/payment`,
        {
          paymentMethod: 'cash',
          paymentStatus: 'pending'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to update payment details');
      }

      showToast('Booking confirmed! You can pay cash after service completion.', 'success');

      navigate('/customer/bookings', {
        state: {
          message: 'Booking confirmed successfully!',
          bookingId: bookingDetails._id
        }
      });
    } catch (error) {
      console.error('Cash payment error:', error);

      let errorMessage = 'Failed to confirm booking';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOnlinePayment = async () => {
    if (!validateBookingDetails()) return;

    if (!razorpayLoaded) {
      showToast('Payment gateway is loading. Please wait...', 'info');
      return;
    }

    try {
      setLoading(true);

      if (!user?.email || !user?.phone) {
        showToast('Please update your profile with email and phone number', 'error');
        return;
      }

      const orderResponse = await axios.post(
        `${API}/transaction/create-order`,
        {
          bookingId: bookingDetails._id,
          amount: Math.round(bookingDetails.totalAmount * 100),
          currency: 'INR',
          paymentMethod: 'online',
          notes: {
            bookingId: bookingDetails._id,
            userId: user._id,
            serviceType: serviceDetails?.title || 'Service'
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (!orderResponse.data?.success) {
        throw new Error(orderResponse.data?.message || 'Failed to create payment order');
      }

      const { order, key, transactionId } = orderResponse.data.data;

      if (!order?.id || !key) {
        throw new Error('Invalid payment order data received');
      }

      const options = {
        key: key,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Raj Electrical Services',
        description: `Booking for ${serviceDetails?.title || bookingDetails?.services?.[0]?.serviceDetails?.title || 'service'}`,
        image: '/logo.png',
        order_id: order.id,
        handler: async function (response) {
          console.log('Payment successful:', response);

          try {
            setLoading(true);

            const verifyResponse = await axios.post(
              `${API}/transaction/verify`,
              {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                bookingId: bookingDetails._id,
                transactionId: transactionId
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                timeout: 15000
              }
            );

            if (!verifyResponse.data?.success) {
              throw new Error(verifyResponse.data?.message || 'Payment verification failed');
            }

            showToast('Payment successful! Booking confirmed.', 'success');

            navigate('/customer/bookings', {
              state: {
                message: 'Payment successful! Booking confirmed.',
                bookingId: bookingDetails._id,
                paymentId: response.razorpay_payment_id,
                transactionId: transactionId
              }
            });
          } catch (verificationError) {
            console.error('Payment verification error:', verificationError);
            showToast('Payment verification failed. Please contact support with payment ID: ' + response.razorpay_payment_id, 'error');
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        notes: {
          bookingId: bookingDetails._id,
          userId: user?._id || '',
          serviceType: serviceDetails?.title || 'Service'
        },
        theme: {
          color: '#2563eb'
        },
        modal: {
          ondismiss: function () {
            console.log('Payment modal dismissed');
            setLoading(false);
          }
        },
        retry: {
          enabled: true,
          max_count: 3
        }
      };

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', function (response) {
        console.error('Payment failed:', response.error);
        setLoading(false);

        let errorMessage = 'Payment failed. Please try again.';
        if (response.error?.description) {
          errorMessage = `Payment failed: ${response.error.description}`;
        }

        showToast(errorMessage, 'error');
      });

      rzp.open();

    } catch (error) {
      console.error('Payment initialization error:', error);

      let errorMessage = 'Payment initialization failed';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your connection and try again.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
        setTimeout(() => navigate('/login'), 2000);
      } else if (error.response?.status === 400) {
        errorMessage = error.response.data?.message || 'Invalid payment request. Please try again.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingBooking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6"
          />
          <motion.p 
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ repeat: Infinity, repeatType: "reverse", duration: 1 }}
            className="text-lg text-blue-800"
          >
            Loading your booking details...
          </motion.p>
        </div>
      </div>
    );
  }

  if (!bookingDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center"
        >
          <div className="text-red-500 text-6xl mb-6">
            <FaExclamationTriangle />
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Booking Not Found</h2>
          <p className="text-gray-600 mb-6">The booking details could not be loaded.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/customer/bookings')}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg"
            >
              View All Bookings
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/customer/services')}
              className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-all shadow-lg"
            >
              Book New Service
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <motion.button
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(-1)}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors mb-6"
          >
            <FaArrowLeft className="mr-2" />
            Back
          </motion.button>
          
          <div className="relative">
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl font-bold text-gray-900 mb-2"
            >
              Complete Your Booking
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-gray-600"
            >
              Review your booking details and complete payment
            </motion.p>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
            />
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Booking Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 transform transition-all hover:shadow-2xl"
            >
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                  <span className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3">
                    <FiChevronRight className="w-5 h-5" />
                  </span>
                  Booking Summary
                </h2>

                {/* Service Details */}
                <div className="flex items-start mb-6 pb-6 border-b border-gray-200">
                  <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-blue-100 to-indigo-100 shadow-inner">
                    <img
                      src={serviceDetails?.image || '/placeholder-service.jpg'}
                      alt={serviceDetails?.title || 'Service'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = '/placeholder-service.jpg';
                      }}
                    />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {serviceDetails?.title || bookingDetails?.services?.[0]?.serviceDetails?.title || 'Service'}
                    </h3>
                    <p className="text-sm text-gray-500 capitalize">
                      {serviceDetails?.category || bookingDetails?.services?.[0]?.serviceDetails?.category || 'Service Category'}
                    </p>
                    {(serviceDetails?.duration || bookingDetails?.services?.[0]?.serviceDetails?.duration) && (
                      <p className="text-sm text-gray-500 mt-2">
                        Duration: {serviceDetails?.duration || bookingDetails?.services?.[0]?.serviceDetails?.duration} hours
                      </p>
                    )}
                  </div>
                </div>

                {/* Booking Details */}
                <div className="space-y-5">
                  <motion.div 
                    whileHover={{ x: 5 }}
                    className="flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="bg-blue-100 p-3 rounded-lg text-blue-600 mr-4">
                      <FaCalendarAlt className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Date & Time</p>
                      <p className="font-medium">
                        {new Date(bookingDetails.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                        {bookingDetails.time && ` at ${bookingDetails.time}`}
                      </p>
                    </div>
                  </motion.div>

                  {bookingDetails.address && (
                    <motion.div 
                      whileHover={{ x: 5 }}
                      className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="bg-blue-100 p-3 rounded-lg text-blue-600 mr-4">
                        <FaMapMarkerAlt className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Service Address</p>
                        <p className="font-medium">
                          {[
                            bookingDetails.address.street,
                            bookingDetails.address.city,
                            bookingDetails.address.state,
                            bookingDetails.address.postalCode
                          ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {bookingDetails.notes && (
                    <motion.div 
                      whileHover={{ x: 5 }}
                      className="flex items-start p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="bg-blue-100 p-3 rounded-lg text-blue-600 mr-4">
                        <FaClock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Special Instructions</p>
                        <p className="font-medium">{bookingDetails.notes}</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Booking Status */}
                <motion.div 
                  whileHover={{ scale: 1.01 }}
                  className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Booking Status</p>
                      <p className={`text-sm font-semibold ${
                        bookingDetails.status === 'pending' ? 'text-amber-600' :
                        bookingDetails.status === 'accepted' ? 'text-blue-600' :
                        bookingDetails.status === 'completed' ? 'text-green-600' :
                        bookingDetails.status === 'cancelled' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {bookingDetails.status === 'pending' ? 'Pending Provider Acceptance' :
                         bookingDetails.status === 'accepted' ? 'Accepted by Provider' :
                         bookingDetails.status === 'completed' ? 'Completed' :
                         bookingDetails.status === 'cancelled' ? 'Cancelled' : bookingDetails.status}
                      </p>
                    </div>
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse"></div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Payment Method Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
            >
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
                  <span className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3">
                    <FiChevronRight className="w-5 h-5" />
                  </span>
                  Select Payment Method
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <motion.button
                    whileHover={{ y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setPaymentMethod('online')}
                    disabled={bookingDetails.status !== 'pending'}
                    className={`p-5 border-2 rounded-xl flex items-center transition-all ${
                      paymentMethod === 'online'
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${bookingDetails.status !== 'pending' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="bg-blue-100 p-3 rounded-lg text-blue-600 mr-4">
                      <FaCreditCard className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">Online Payment</h3>
                      <p className="text-sm text-gray-500">Pay securely with Razorpay</p>
                      {!razorpayLoaded && paymentMethod === 'online' && (
                        <p className="text-xs text-yellow-600 mt-1">Loading payment gateway...</p>
                      )}
                      {bookingDetails.status !== 'pending' && (
                        <p className="text-xs text-gray-500 mt-1">Payment method cannot be changed</p>
                      )}
                    </div>
                    <div className="ml-auto">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === 'online' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {paymentMethod === 'online' && (
                          <FaCheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setPaymentMethod('cash')}
                    disabled={bookingDetails.status !== 'pending'}
                    className={`p-5 border-2 rounded-xl flex items-center transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${bookingDetails.status !== 'pending' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="bg-green-100 p-3 rounded-lg text-green-600 mr-4">
                      <FaMoneyBillWave className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">Cash on Service</h3>
                      <p className="text-sm text-gray-500">Pay after service completion</p>
                      {bookingDetails.status !== 'pending' && (
                        <p className="text-xs text-gray-500 mt-1">Payment method cannot be changed</p>
                      )}
                    </div>
                    <div className="ml-auto">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === 'cash' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                        {paymentMethod === 'cash' && (
                          <FaCheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                  </motion.button>
                </div>

                {bookingDetails.status === 'pending' ? (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={paymentMethod === 'online' ? handleOnlinePayment : handleCashPayment}
                      disabled={loading || (paymentMethod === 'online' && !razorpayLoaded)}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"
                          />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FaCheckCircle className="mr-2" />
                          {paymentMethod === 'online' ? 'Pay Now' : 'Confirm Booking'}
                        </>
                      )}
                    </motion.button>

                    {paymentMethod === 'online' && !razorpayLoaded && (
                      <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center text-sm text-yellow-600 mt-3"
                      >
                        Payment gateway is loading. Please wait...
                      </motion.p>
                    )}
                  </>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl text-center border border-blue-100"
                  >
                    <p className="text-gray-600">
                      {bookingDetails.status === 'accepted' ?
                        'Your booking has been accepted by the provider.' :
                        bookingDetails.status === 'completed' ?
                          'This booking has been completed.' :
                          'This booking has been cancelled.'}
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Price Summary */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 sticky top-6"
            >
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <span className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3">
                    <FiChevronRight className="w-5 h-5" />
                  </span>
                  Price Summary
                </h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Service Price:</span>
                    <span className="font-medium">
                      ₹{(bookingDetails.subtotal || bookingDetails.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>

                  {bookingDetails.services?.[0]?.quantity > 1 && (
                    <div className="flex justify-between text-sm p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500">
                        Quantity: {bookingDetails.services[0].quantity}
                      </span>
                      <span className="text-gray-500">
                        ₹{((bookingDetails.services[0].price || 0)).toFixed(2)} each
                      </span>
                    </div>
                  )}

                  {bookingDetails.couponApplied && bookingDetails.totalDiscount > 0 && (
                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100"
                    >
                      <div className="flex items-center">
                        <FaTag className="w-4 h-4 mr-2 text-green-600" />
                        <span className="text-green-600">Discount ({bookingDetails.couponApplied.code}):</span>
                      </div>
                      <span className="font-medium text-green-600">-₹{(bookingDetails.totalDiscount || 0).toFixed(2)}</span>
                    </motion.div>
                  )}

                  <div className="border-t border-gray-200 pt-4 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total Amount:</span>
                      <span className="text-2xl font-bold text-blue-600">₹{(bookingDetails.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment Status */}
                  <motion.div 
                    whileHover={{ scale: 1.01 }}
                    className="border-t border-gray-200 pt-4 mt-4 p-3 bg-blue-50 rounded-lg"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Payment Status:</span>
                      <span className={`font-medium ${
                        bookingDetails.paymentStatus === 'paid' ? 'text-green-600' : 'text-amber-600'
                      }`}>
                        {bookingDetails.paymentMethod === 'online' && bookingDetails.paymentStatus === 'paid'
                          ? 'Paid Online'
                          : bookingDetails.paymentMethod === 'cash'
                            ? 'Pending (Pay on Service)'
                            : bookingDetails.paymentStatus === 'pending'
                              ? 'Pending'
                              : bookingDetails.paymentStatus}
                      </span>
                    </div>
                  </motion.div>

                  {/* Payment Security Info */}
                  <motion.div 
                    whileHover={{ scale: 1.01 }}
                    className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100"
                  >
                    <div className="flex items-center mb-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-600 mr-3">
                        <FaLock className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">Secure Payment</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      Your payment information is encrypted and secure. We use industry-standard security measures to protect your data.
                    </p>
                    <div className="flex items-center mt-3 space-x-2">
                      <div className="bg-white p-1 rounded shadow-xs">
                        <FaShieldAlt className="w-4 h-4 text-green-500" />
                      </div>
                      <span className="text-xs text-gray-500">SSL Secured</span>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;