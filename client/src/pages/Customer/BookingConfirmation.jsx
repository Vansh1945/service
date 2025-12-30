import React, { useEffect, useState } from 'react';
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
  FaShieldAlt,
  FaLock,
  FaTools,
  FaInfoCircle,
  FaStar,
  FaRupeeSign,
  FaTruck,
  FaPhone,
  FaEnvelope
} from 'react-icons/fa';

const BookingConfirmation = () => {
  const { bookingId } = useParams();
  const { token, user, isAuthenticated, API, showToast } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [bookingDetails, setBookingDetails] = useState(null);
  const [serviceDetails, setServiceDetails] = useState(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Load Razorpay script
  useEffect(() => {
    const loadRazorpay = () => {
      if (window.Razorpay) {
        setRazorpayLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        console.log('Razorpay script loaded successfully');
        setRazorpayLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load Razorpay script');
        setRazorpayLoaded(false);
      };
      document.body.appendChild(script);
    };

    loadRazorpay();

    return () => {
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  const fetchServiceDetails = async (serviceId) => {
    try {
      console.log('Fetching service details for ID:', serviceId);
      const response = await axios.get(`${API}/service/services/${serviceId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.data?.success) {
        console.log('Service details fetched successfully:', response.data.data);
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching service details:', error);
      return null;
    }
  };

  const fetchBookingDetails = async () => {
    try {
      console.log('Fetching booking details for ID:', bookingId);

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

      console.log('Booking details fetched successfully:', booking);

      // Set payment method based on booking data
      if (booking.paymentMethod) {
        setPaymentMethod(booking.paymentMethod);
      }

      setBookingDetails(booking);

      // Fetch service details if not in location state
      if (!location.state?.service) {
        const serviceId =
          booking.serviceId ||
          (booking.services && booking.services[0]?.serviceId) ||
          (booking.service && booking.service._id);

        if (serviceId) {
          const service = await fetchServiceDetails(serviceId);
          if (service) {
            setServiceDetails(service);
          }
        }
      } else if (location.state?.service) {
        console.log('Using service details from location state:', location.state.service);
        setServiceDetails(location.state.service);
      }

      setError(null);
    } catch (error) {
      console.error('Error fetching booking details:', error);
      let errorMessage = 'Failed to load booking details';

      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your connection.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
        setError(errorMessage);
        setTimeout(() => navigate('/login'), 3000);
        return;
      } else if (error.response?.status === 404) {
        errorMessage = 'Booking not found. It may have been cancelled or doesn\'t exist.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      setError(errorMessage);
      showToast(errorMessage, 'error');

      // Only redirect after showing error for non-auth errors
      if (error.response?.status !== 401) {
        setTimeout(() => navigate('/customer/bookings'), 5000);
      }
    }
  };

  // Initialize component
  useEffect(() => {
    console.log('BookingConfirmation component initializing...');
    console.log('BookingId:', bookingId);
    console.log('IsAuthenticated:', isAuthenticated);
    console.log('Token exists:', !!token);
    console.log('Location state:', location.state);

    const initializeComponent = async () => {
      setIsLoading(true);
      setError(null);

      // Check authentication
      if (!isAuthenticated || !token) {
        console.log('User not authenticated, redirecting to login');
        showToast('Please login to view booking details', 'error');
        navigate('/login');
        return;
      }

      // Validate booking ID
      if (!bookingId || bookingId === 'undefined' || bookingId === 'null') {
        console.error('Invalid booking ID:', bookingId);
        setError('Invalid booking ID. Please try booking again.');
        showToast('Invalid booking ID. Please try booking again.', 'error');
        setTimeout(() => navigate('/customer/services'), 3000);
        return;
      }

      try {
        // Use data from location state if available (from booking creation)
        if (location.state?.booking) {
          console.log('Using booking details from location state');
          setBookingDetails(location.state.booking);
          setServiceDetails(location.state.service);

          if (location.state.booking.paymentMethod) {
            setPaymentMethod(location.state.booking.paymentMethod);
          }
        } else {
          console.log('Fetching booking details from API');
          await fetchBookingDetails();
        }
      } catch (error) {
        console.error('Error during initialization:', error);
        setError('Failed to initialize booking confirmation');
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      initializeComponent();
    }
  }, [bookingId, isAuthenticated, token, location.state, isInitialized]);

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

    const serviceInfo = getServiceInfo();

    // Show confirmation dialog for cash payment
    const confirmCashPayment = window.confirm(
      `Confirm Cash Payment?\n\n` +
      `Service: ${serviceInfo.title}\n` +
      `Amount: ₹${bookingDetails.totalAmount.toFixed(2)}\n` +
      `Date: ${formatDate(bookingDetails.date)}\n\n` +
      `You will pay cash after service completion.\n` +
      `Do you want to confirm this booking?`
    );

    if (!confirmCashPayment) {
      return;
    }

    try {
      // Show processing toast
      showToast('Confirming your booking...', 'info');

      // For cash payments, we only update the booking payment method and status
      // NO transaction record should be created for cash payments
      const response = await axios.post(
        `${API}/booking/${bookingDetails._id}/payment`,
        {
          paymentMethod: 'cash',
          paymentStatus: 'pending', // Cash payments remain pending until service completion
          bookingStatus: 'pending',
          notes: 'Customer selected cash payment option'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to update payment details');
      }

      // Update booking details
      try {
        await fetchBookingDetails();
      } catch (fetchError) {
        console.warn('Failed to fetch updated booking details:', fetchError);
        // Don't fail the entire process if fetching fails
      }

      // Success message with more details
      showToast('✅ Booking confirmed! You can pay cash after service completion.', 'success');

      // Navigate with enhanced state
      setTimeout(() => {
        navigate('/customer/bookings', {
          state: {
            message: 'Booking confirmed successfully! Payment will be collected after service completion.',
            bookingId: bookingDetails._id,
            paymentMethod: 'cash',
            showCashPaymentInfo: true
          }
        });
      }, 2000);

    } catch (error) {
      console.error('Cash payment error:', error);

      let errorMessage = 'Failed to confirm booking. ';

      if (error.code === 'ECONNABORTED') {
        errorMessage += 'Request timeout. Please check your connection and try again.';
      } else if (error.response?.status === 401) {
        errorMessage += 'Session expired. Please login again.';
        setTimeout(() => navigate('/login'), 2000);
      } else if (error.response?.status === 400) {
        errorMessage += error.response.data?.message || 'Invalid booking data. Please try again.';
      } else if (error.response?.status === 409) {
        errorMessage += 'Booking conflict. Please refresh and try again.';
      } else if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else {
        errorMessage += 'Please try again or contact support.';
      }

      showToast(errorMessage, 'error');
    }
  };

  const handleOnlinePayment = async () => {
    if (!validateBookingDetails()) return;

    if (!razorpayLoaded) {
      showToast('Payment gateway is loading. Please wait...', 'info');
      return;
    }

    try {
      // Enhanced user validation
      if (!user?.email || !user?.phone) {
        showToast('Please update your profile with email and phone number before making payment', 'error');
        setTimeout(() => navigate('/customer/profile'), 2000);
        return;
      }

      // Show payment processing toast
      const processingToast = showToast('Initializing secure payment...', 'info');

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
            serviceType: serviceDetails?.title || bookingDetails?.services?.[0]?.serviceDetails?.title || 'Service',
            customerName: user.name,
            customerEmail: user.email
          }
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 20000 // Increased timeout
        }
      );

      if (!orderResponse.data?.success) {
        throw new Error(orderResponse.data?.message || 'Failed to create payment order');
      }

      const { order, key, transactionId } = orderResponse.data.data;

      if (!order?.id || !key) {
        throw new Error('Invalid payment order data received');
      }

      // Update toast
      showToast('Opening secure payment gateway...', 'info');

      const options = {
        key: key,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'SAFEVOLT SOLUTIONS',
        description: `Payment for ${serviceDetails?.title || bookingDetails?.services?.[0]?.serviceDetails?.title || 'service'}`,
        image: '/logo.png',
        order_id: order.id,
        handler: async function (response) {
          try {
            showToast('Verifying payment...', 'info');

            const verifyResponse = await axios.post(
              `${API}/transaction/verify`,
              {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                bookingId: bookingDetails._id,
                transactionId: transactionId,
                bookingStatus: 'pending',
                paymentMethod: 'online'
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                timeout: 20000
              }
            );

            if (!verifyResponse.data?.success) {
              throw new Error(verifyResponse.data?.message || 'Payment verification failed');
            }

            // Update booking details
            try {
              await fetchBookingDetails();
            } catch (fetchError) {
              console.warn('Failed to fetch updated booking details:', fetchError);
            }

            // Success animation and redirect
            showToast('🎉 Payment successful! Booking confirmed.', 'success');

            setTimeout(() => {
              navigate('/customer/bookings', {
                state: {
                  message: 'Payment successful! Your booking has been confirmed.',
                  bookingId: bookingDetails._id,
                  paymentId: response.razorpay_payment_id,
                  transactionId: transactionId,
                  showSuccessAnimation: true
                }
              });
            }, 2000);

          } catch (verificationError) {
            console.error('Payment verification error:', verificationError);

            let errorMsg = 'Payment verification failed. ';
            if (verificationError.response?.status === 401) {
              errorMsg += 'Please login again and contact support.';
            } else if (verificationError.response?.status === 404) {
              errorMsg += 'Booking not found. Please contact support.';
            } else {
              errorMsg += `Please contact support with payment ID: ${response.razorpay_payment_id}`;
            }

            showToast(errorMsg, 'error');
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
          serviceType: serviceDetails?.title || 'Service',
          customerName: user?.name || '',
          bookingDate: bookingDetails?.date || ''
        },
        theme: {
          color: '#0D9488',
          backdrop_color: 'rgba(0, 0, 0, 0.7)'
        },
        modal: {
          ondismiss: function () {
            console.log('Payment modal dismissed by user');
            showToast('Payment cancelled. You can try again anytime.', 'info');
          },
          confirm_close: true,
          escape: true,
          animation: true
        },
        retry: {
          enabled: true,
          max_count: 3
        },
        timeout: 300, // 5 minutes timeout
        remember_customer: false
      };

      const rzp = new window.Razorpay(options);

      // Enhanced error handling
      rzp.on('payment.failed', function (response) {
        console.error('Payment failed:', response.error);

        let errorMessage = 'Payment failed. ';

        if (response.error?.code === 'BAD_REQUEST_ERROR') {
          errorMessage += 'Invalid payment details. Please try again.';
        } else if (response.error?.code === 'GATEWAY_ERROR') {
          errorMessage += 'Payment gateway error. Please try a different payment method.';
        } else if (response.error?.code === 'NETWORK_ERROR') {
          errorMessage += 'Network error. Please check your connection and try again.';
        } else if (response.error?.description) {
          errorMessage += response.error.description;
        } else {
          errorMessage += 'Please try again or contact support.';
        }

        showToast(errorMessage, 'error');
      });

      // Open payment modal
      rzp.open();

    } catch (error) {
      console.error('Payment initialization error:', error);

      let errorMessage = 'Failed to initialize payment. ';

      if (error.code === 'ECONNABORTED') {
        errorMessage += 'Request timeout. Please check your internet connection and try again.';
      } else if (error.response?.status === 401) {
        errorMessage += 'Session expired. Please login again.';
        setTimeout(() => navigate('/login'), 2000);
      } else if (error.response?.status === 400) {
        errorMessage += error.response.data?.message || 'Invalid payment request. Please check your booking details.';
      } else if (error.response?.status === 500) {
        errorMessage += 'Server error. Please try again in a few minutes.';
      } else if (error.response?.data?.message) {
        errorMessage += error.response.data.message;
      } else {
        errorMessage += 'Please try again or contact support.';
      }

      showToast(errorMessage, 'error');
    }
  };

  // Helper function to format date safely
  const formatDate = (dateString) => {
    if (!dateString) return 'Date not set';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Date formatting error';
    }
  };

  // Get service details with proper fallbacks
  const getServiceInfo = () => {
    if (serviceDetails) {
      return {
        title: serviceDetails.title,
        category: serviceDetails.category,
        duration: serviceDetails.duration,
        image: serviceDetails.images && serviceDetails.images.length > 0 ? serviceDetails.images[0] : null,
        basePrice: serviceDetails.basePrice,
        averageRating: serviceDetails.averageRating || 0,
        ratingCount: serviceDetails.ratingCount || 0
      };
    }

    if (bookingDetails?.services?.[0]?.serviceDetails) {
      return {
        title: bookingDetails.services[0].serviceDetails.title,
        category: bookingDetails.services[0].serviceDetails.category,
        duration: bookingDetails.services[0].serviceDetails.duration,
        image: bookingDetails.services[0].serviceDetails.images && bookingDetails.services[0].serviceDetails.images.length > 0 ? bookingDetails.services[0].serviceDetails.images[0] : null,
        basePrice: bookingDetails.services[0].serviceDetails.basePrice,
        averageRating: bookingDetails.services[0].serviceDetails.averageRating || 0,
        ratingCount: bookingDetails.services[0].serviceDetails.ratingCount || 0
      };
    }

    if (bookingDetails?.service) {
      return {
        title: bookingDetails.service.title || bookingDetails.service.name,
        category: bookingDetails.service.category,
        duration: bookingDetails.service.duration,
        image: bookingDetails.service.images && bookingDetails.service.images.length > 0 ? bookingDetails.service.images[0] : null,
        basePrice: bookingDetails.service.basePrice,
        averageRating: bookingDetails.service.averageRating || 0,
        ratingCount: bookingDetails.service.ratingCount || 0
      };
    }

    return {
      title: 'Service',
      category: 'General Service',
      duration: null,
      image: null,
      basePrice: 0,
      averageRating: 0,
      ratingCount: 0
    };
  };

  // Get booking status display info
  const getBookingStatusInfo = () => {
    if (!bookingDetails) return { message: 'Loading...', color: 'text-gray-500', canPay: false };

    switch (bookingDetails.status) {
      case 'pending':
        if (bookingDetails.paymentStatus === 'paid') {
          return {
            message: 'Payment Complete - Awaiting Provider',
            color: 'text-primary',
            canPay: false,
            description: 'Your payment has been processed successfully. We are now finding a provider to accept your booking.'
          };
        } else {
          return {
            message: 'Pending Provider Acceptance',
            color: 'text-accent',
            canPay: true,
            description: 'Your booking is waiting for a provider to accept it. Complete payment to secure your booking.'
          };
        }
      case 'accepted':
        return {
          message: 'Accepted by Provider',
          color: 'text-primary',
          canPay: bookingDetails.paymentStatus !== 'paid',
          description: bookingDetails.paymentStatus === 'paid'
            ? 'Great! A provider has accepted your booking and payment is complete.'
            : 'A provider has accepted your booking! Please complete payment to finalize.'
        };
      case 'confirmed':
        return {
          message: 'Booking Confirmed',
          color: 'text-primary',
          canPay: bookingDetails.paymentStatus !== 'paid',
          description: 'Your booking is confirmed. Payment is required to secure your slot.'
        };
      case 'in-progress':
        return {
          message: 'Service In Progress',
          color: 'text-primary',
          canPay: bookingDetails.paymentStatus !== 'paid' && bookingDetails.paymentMethod === 'cash',
          description: 'The service is currently being performed. Cash payment can be made upon completion.'
        };
      case 'completed':
        return {
          message: 'Service Completed',
          color: 'text-primary',
          canPay: bookingDetails.paymentStatus !== 'paid' && bookingDetails.paymentMethod === 'cash',
          description: bookingDetails.paymentStatus !== 'paid'
            ? 'Service completed successfully. Please complete your cash payment.'
            : 'The service has been completed successfully. Thank you!'
        };
      case 'cancelled':
        return {
          message: 'Booking Cancelled',
          color: 'text-red-600',
          canPay: false,
          description: 'This booking has been cancelled and cannot be reactivated.'
        };
      case 'no-show':
        return {
          message: 'Customer No-Show',
          color: 'text-red-500',
          canPay: false,
          description: 'This booking was marked as no-show. Please contact support if this was an error.'
        };
      default:
        const statusDisplay = bookingDetails.status
          ? bookingDetails.status.charAt(0).toUpperCase() + bookingDetails.status.slice(1).replace(/[-_]/g, ' ')
          : 'Unknown Status';

        return {
          message: statusDisplay,
          color: 'text-gray-500',
          canPay: ['pending', 'accepted', 'confirmed'].includes(bookingDetails.status) && bookingDetails.paymentStatus !== 'paid',
          description: `Booking status: ${statusDisplay}.`
        };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-red-200">
            <FaExclamationTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Something went wrong</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">{error}</p>
          <div className="space-y-4">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-4 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/customer/bookings')}
              className="w-full px-6 py-4 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all duration-200"
            >
              Go to My Bookings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No booking details state
  if (!bookingDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-primary/20">
            <FaInfoCircle className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Booking Not Found</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">We couldn't find the booking details you're looking for.</p>
          <button
            onClick={() => navigate('/customer/services')}
            className="px-8 py-4 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            Book a New Service
          </button>
        </div>
      </div>
    );
  }

  const serviceInfo = getServiceInfo();
  const statusInfo = getBookingStatusInfo();

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 font-inter">
      <div className="max-w-7xl mx-auto">
        {/* Header with Breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
            <span>Home</span>
            <span>/</span>
            <span>Services</span>
            <span>/</span>
            <span className="text-primary font-medium">Booking Confirmation</span>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-primary transition-all duration-300 bg-white px-4 py-2 rounded-xl border border-gray-200 hover:border-primary shadow-sm hover:shadow-md"
            >
              <FaArrowLeft className="mr-2 w-4 h-4" />
              Back
            </button>

            <h1 className="text-xl lg:text-2xl font-poppins font-bold text-gray-800 ml-4">
              Complete Your Booking
            </h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Card */}
            <div className="relative z-20 bg-white rounded-2xl shadow-lg border border-gray-300 p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-shrink-0 w-full sm:w-32 h-32 rounded-xl overflow-hidden bg-gray-100 shadow-inner">
                  {serviceInfo.image ? (
                    <img
                      src={serviceInfo.image}
                      alt={serviceInfo.title}
                      className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <FaTools className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-lg font-poppins font-bold text-gray-900 mb-2">{serviceInfo.title}</h2>
                    <div className="flex items-center space-x-3 mb-3">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold tracking-wide">
                        {serviceInfo.category?.name}
                      </span>
                      <div className="flex items-center text-yellow-500 space-x-1">
                        <FaStar className="w-3 h-3 fill-current" />
                        <span className="text-xs font-semibold text-gray-700">
                          {serviceInfo.averageRating?.toFixed(1) || '0.0'}
                          {serviceInfo.ratingCount > 0 && (
                            <span className="text-gray-500 ml-1">({serviceInfo.ratingCount})</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900 flex items-center justify-end space-x-1">
                      <FaRupeeSign className="w-3 h-3 mt-1" />
                      <span>{serviceInfo.basePrice?.toFixed(2) || bookingDetails.totalAmount?.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-gray-500 tracking-wide">per service</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs text-gray-700">
                    <div className="flex items-center space-x-2">
                      <FaClock className="w-3 h-3 text-primary" />
                      <span>{serviceInfo.duration || 'Flexible'} hours service</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FaTruck className="w-3 h-3 text-primary" />
                      <span>Free Visiting</span>
                    </div>
                  </div>

                  {/* Service Features */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm">Service Includes:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                      <div className="flex items-center space-x-2">
                        <FaCheckCircle className="w-3 h-3 text-green-600" />
                        <span>Professional service provider</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FaCheckCircle className="w-3 h-3 text-green-600" />
                        <span>Quality assured</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FaCheckCircle className="w-3 h-3 text-green-600" />
                        <span>On-time service</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FaCheckCircle className="w-3 h-3 text-green-600" />
                        <span>Customer support</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FaCheckCircle className="w-3 h-3 text-green-600" />
                        <span>Free visiting charges</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Details Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-300 p-4 hover:shadow-xl transition-shadow duration-300">
              <h2 className="text-base font-poppins font-semibold text-gray-900 mb-3 flex items-center">
                <FaCalendarAlt className="w-3 h-3 text-primary mr-2" />
                Booking Details
              </h2>

              <div className="space-y-4">
                {/* Date & Time Card */}
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                  <div className="flex items-center">
                    <div className="p-2 bg-primary/10 rounded-lg mr-3">
                      <FaCalendarAlt className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 mb-1 tracking-wide">Date & Time</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDate(bookingDetails.date)}
                        {bookingDetails.time && (
                          <span className="text-primary font-medium ml-2">at {bookingDetails.time}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Service Address Card */}
                {bookingDetails.address && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                    <div className="flex items-start">
                      <div className="p-2 bg-green-100 rounded-lg mr-3">
                        <FaMapMarkerAlt className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1 tracking-wide">Service Address</p>
                        <p className="text-sm font-semibold text-gray-900 leading-relaxed">
                          {[
                            bookingDetails.address.street,
                            bookingDetails.address.city,
                            bookingDetails.address.state,
                            bookingDetails.address.postalCode
                          ].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Special Instructions Card */}
                {bookingDetails.notes && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                    <div className="flex items-start">
                      <div className="p-2 bg-purple-100 rounded-lg mr-3">
                        <FaInfoCircle className="w-4 h-4 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-500 mb-1 tracking-wide">Special Instructions</p>
                        <p className="text-sm font-semibold text-gray-900 leading-relaxed">{bookingDetails.notes}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Booking Status */}
              <div className="mt-4 p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-500 mb-1 tracking-wide">Booking Status</p>
                    <p className={`text-base font-bold mb-1 ${statusInfo.color}`}>
                      {statusInfo.message}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {statusInfo.description}
                    </p>
                  </div>
                  <div className="bg-white p-1 rounded-lg shadow-lg border border-gray-200 ml-3">
                    <div className={`w-3 h-3 rounded-full ${bookingDetails.status === 'pending' ? 'bg-yellow-400 animate-pulse' :
                      bookingDetails.status === 'accepted' ? 'bg-blue-500 animate-pulse' :
                        bookingDetails.status === 'confirmed' ? 'bg-blue-500 animate-pulse' :
                          bookingDetails.status === 'in-progress' ? 'bg-blue-500 animate-bounce' :
                            bookingDetails.status === 'completed' ? 'bg-blue-500' :
                              bookingDetails.status === 'cancelled' ? 'bg-red-400' :
                                bookingDetails.status === 'no-show' ? 'bg-red-500' : 'bg-gray-400'
                      }`}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Action Card */}
            {statusInfo.canPay && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-300 p-6 hover:shadow-xl transition-shadow duration-300">
                <h2 className="text-lg font-poppins font-semibold text-gray-900 mb-4 flex items-center">
                  <FaCreditCard className="w-4 h-4 text-primary mr-2" />
                  Complete Payment
                </h2>

                <div className="space-y-8">
                  {/* Trust & Benefits Section */}
                  <div className="p-6 bg-gradient-to-r from-green-50 to-primary/5 rounded-xl border border-primary/20">
                    <div className="text-center mb-4">
                      <h3 className="text-lg font-poppins font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
                        <FaShieldAlt className="w-5 h-5 text-green-600" />
                        Why Choose Online Payment?
                      </h3>
                      <p className="text-sm text-gray-600">Secure, instant, and hassle-free booking experience</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-green-200">
                        <div className="p-2 bg-green-100 rounded-xl">
                          <FaCheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">Instant Confirmation</p>
                          <p className="text-xs text-gray-600">Booking confirmed immediately</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200">
                        <div className="p-2 bg-blue-100 rounded-xl">
                          <FaLock className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">100% Secure</p>
                          <p className="text-xs text-gray-600">Bank-grade encryption</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200">
                        <div className="p-2 bg-purple-100 rounded-xl">
                          <FaStar className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">Trusted Platform</p>
                          <p className="text-xs text-gray-600">Verified by 10,000+ customers</p>
                        </div>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-sm text-gray-700 font-medium">
                        💳 Pay securely with Card, UPI, Net Banking & get instant booking confirmation!
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                    {/* Online Payment Button */}
                    <button
                      onClick={handleOnlinePayment}
                      disabled={!razorpayLoaded}
                      className="w-full bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <div className="p-1 bg-white/20 rounded-xl">
                        <FaCreditCard className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-base">Pay Online Now</div>
                        <div className="text-xs opacity-90">Instant & Secure</div>
                      </div>
                    </button>

                    {/* Cash Payment Button */}
                    <button
                      onClick={handleCashPayment}
                      className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <div className="p-1 bg-white/20 rounded-xl">
                        <FaMoneyBillWave className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-base">Pay Cash Later</div>
                        <div className="text-xs opacity-90">After Service</div>
                      </div>
                    </button>
                  </div>

                  {/* Payment Methods Info */}
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors duration-200 flex items-center gap-3 text-sm">
                      <div className="p-2 bg-green-100 rounded-xl">
                        <FaCreditCard className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Online Payment</p>
                        <p className="text-xs text-gray-600">Card, UPI, Net Banking</p>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors duration-200 flex items-center gap-3 text-sm">
                      <div className="p-2 bg-blue-100 rounded-xl">
                        <FaMoneyBillWave className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">Cash Payment</p>
                        <p className="text-xs text-gray-600">Pay after service completion</p>
                      </div>
                    </div>
                  </div>

                  {/* Security Assurance */}
                  <div className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/20 text-sm">
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-green-100 rounded-xl">
                          <FaLock className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="font-semibold text-gray-900">256-bit SSL Encryption</span>
                      </div>
                      <div className="w-px h-5 bg-gray-300"></div>
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-blue-100 rounded-xl">
                          <FaShieldAlt className="w-4 h-4 text-blue-600" />
                        </div>
                        <span className="font-semibold text-gray-900">Bank-grade Security</span>
                      </div>
                    </div>
                    <p className="text-center text-xs text-gray-600 mt-3 leading-relaxed">
                      Your payment information is fully protected and secure
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Price Summary Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-300 p-8 hover:shadow-xl transition-shadow duration-300 sticky top-6 z-20">
              <h3 className="text-lg font-poppins font-bold text-gray-900 mb-6">Price Summary</h3>

              <div className="space-y-3">
                {(() => {
                  const quantity = bookingDetails.services?.[0]?.quantity || 1;
                  const originalPrice = serviceInfo.basePrice || 0;
                  const discount = (bookingDetails.totalDiscount || 0) / quantity;
                  const visitingCharges = 0; // Free visiting
                  const priceAfterDiscount = originalPrice - discount;
                  const totalAmount = priceAfterDiscount * quantity + visitingCharges;

                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Service Price</span>
                        <span className="font-semibold text-gray-800">
                          ₹{originalPrice.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">
                          Quantity: {quantity}
                        </span>
                        <span className="text-gray-500">
                          {quantity}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Visiting Charges</span>
                        <span className="font-semibold text-green-600">
                          Free Visiting
                        </span>
                      </div>

                      {bookingDetails.couponApplied && discount > 0 && (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <FaTag className="w-4 h-4 mr-2 text-green-600" />
                              <span className="text-green-700 font-medium text-sm">
                                Discount Applied
                              </span>
                            </div>
                            <span className="font-semibold text-green-700">
                              -₹{discount.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-green-600 space-y-1">
                            {bookingDetails.couponApplied && typeof bookingDetails.couponApplied.code === 'string' && bookingDetails.couponApplied.code && (
                              <div>Coupon: <span className="font-medium">{bookingDetails.couponApplied.code}</span>
                                {bookingDetails.couponApplied.discountType && bookingDetails.couponApplied.discountValue && (
                                  <div>Discount: <span className="font-medium">
                                    {bookingDetails.couponApplied.discountType === 'percent'
                                      ? `${bookingDetails.couponApplied.discountValue}%`
                                      : `₹${bookingDetails.couponApplied.discountValue}`}
                                  </span></div>
                                )}
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Service Price after discount</span>
                        <span className="font-semibold text-gray-800">
                          ₹{priceAfterDiscount.toFixed(2)}
                        </span>
                      </div>

                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-gray-800">Total Amount</span>
                          <span className="text-xl font-bold text-primary">₹{totalAmount.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Savings Message */}
                      {(() => {
                        const totalDiscount = bookingDetails.totalDiscount || 0;
                        if (totalDiscount > 0) {
                          return (
                            <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                              <p className="text-sm text-green-700 font-medium text-center">
                                🎉 You saved ₹{totalDiscount.toFixed(2)} on this booking!
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Payment Status */}
                      <div className="border-t border-gray-200 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600 text-sm">Payment Status</span>
                          <span className={`font-semibold text-sm ${bookingDetails.paymentStatus === 'paid' ? 'text-primary' : 'text-accent'}`}>
                            {bookingDetails.paymentMethod === 'online' && bookingDetails.paymentStatus === 'paid'
                              ? 'Paid Online'
                              : bookingDetails.paymentMethod === 'cash'
                                ? 'Pending (Cash)'
                                : bookingDetails.paymentStatus === 'pending'
                                  ? 'Pending'
                                  : bookingDetails.paymentStatus}
                          </span>
                        </div>
                      </div>

                      {/* Need Help Contact Section */}
                      <div className="border-t border-gray-200 pt-4 mt-4 flex flex-col items-center">
                        <h4 className="text-sm font-poppins font-semibold text-gray-900 mb-3">Need Help? Contact Us</h4>
                        <div className="space-y-2 text-primary text-sm font-medium">
                          <div className="flex items-center justify-center space-x-2">
                            <FaPhone className="w-4 h-4" />
                            <span>+91 12345 67890</span>
                          </div>
                          <div className="flex items-center justify-center space-x-2">
                            <FaEnvelope className="w-4 h-4" />
                            <span>support@safevolt.com</span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;
