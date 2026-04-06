import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ArrowLeft, CreditCard, Wallet, CheckCircle, Calendar, MapPin,
  Clock, Tag, AlertTriangle, Shield, Lock, Wrench, Star, IndianRupee,
  Truck, Phone, Mail, ChevronRight, MessageCircle, AlertCircle
} from 'lucide-react';

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
  const [showCashModal, setShowCashModal] = useState(false);

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
      script.onload = () => setRazorpayLoaded(true);
      script.onerror = () => setRazorpayLoaded(false);
      document.body.appendChild(script);
    };
    loadRazorpay();
  }, []);

  const fetchServiceDetails = async (serviceId) => {
    try {
      const response = await axios.get(`${API}/service/services/${serviceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data?.success) return response.data.data;
      return null;
    } catch (error) {
      console.error('Error fetching service details:', error);
      return null;
    }
  };

  const fetchBookingDetails = async () => {
    try {
      const response = await axios.get(`${API}/booking/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to fetch booking details');
      }

      const booking = response.data.data;
      if (booking.paymentMethod) setPaymentMethod(booking.paymentMethod);
      setBookingDetails(booking);

      if (!location.state?.service) {
        const serviceId = booking.serviceId || (booking.services?.[0]?.serviceId);
        if (serviceId) {
          const service = await fetchServiceDetails(serviceId);
          if (service) setServiceDetails(service);
        }
      } else if (location.state?.service) {
        setServiceDetails(location.state.service);
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
      let errorMessage = 'Failed to load booking details';
      if (error.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
        setTimeout(() => navigate('/login'), 3000);
      } else if (error.response?.status === 404) {
        errorMessage = 'Booking not found.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      setError(errorMessage);
      showToast(errorMessage, 'error');
    }
  };

  useEffect(() => {
    const initializeComponent = async () => {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !token) {
        showToast('Please login to view booking details', 'error');
        navigate('/login');
        return;
      }

      if (!bookingId || bookingId === 'undefined' || bookingId === 'null') {
        setError('Invalid booking ID');
        setTimeout(() => navigate('/customer/services'), 3000);
        return;
      }

      try {
        if (location.state?.booking) {
          setBookingDetails(location.state.booking);
          setServiceDetails(location.state.service);
          if (location.state.booking.paymentMethod) setPaymentMethod(location.state.booking.paymentMethod);
        } else {
          await fetchBookingDetails();
        }
      } catch (error) {
        setError('Failed to initialize booking confirmation');
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    if (!isInitialized) initializeComponent();
  }, [bookingId, isAuthenticated, token, location.state, isInitialized]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Date not set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch {
      return 'Date formatting error';
    }
  };

  const getServiceInfo = () => {
    if (serviceDetails) {
      return {
        title: serviceDetails.title,
        category: serviceDetails.category,
        duration: serviceDetails.duration,
        image: serviceDetails.images?.[0],
        basePrice: serviceDetails.basePrice,
        averageRating: serviceDetails.averageRating || 0,
        ratingCount: serviceDetails.ratingCount || 0
      };
    }
    const firstService = bookingDetails?.services?.[0];
    const source = firstService?.service || firstService?.serviceDetails;
    if (source) {
      return {
        title: source.title || source.name || 'Service',
        category: source.category || 'General Service',
        duration: source.duration,
        image: source.images?.[0],
        basePrice: source.basePrice || firstService?.price || 0,
        averageRating: source.averageRating || 0,
        ratingCount: source.ratingCount || 0
      };
    }
    return {
      title: 'Service', category: 'General Service', duration: null,
      image: null, basePrice: 0, averageRating: 0, ratingCount: 0
    };
  };

  const getBookingStatusInfo = () => {
    if (!bookingDetails) return { message: 'Loading...', color: 'text-gray-500', canPay: false };

    switch (bookingDetails.status) {
      case 'pending':
        return {
          message: 'Pending Provider Acceptance',
          color: 'text-accent',
          canPay: bookingDetails.paymentStatus !== 'paid',
          description: 'Complete payment to secure your booking.'
        };
      case 'accepted':
        return {
          message: 'Accepted by Provider',
          color: 'text-primary',
          canPay: bookingDetails.paymentStatus !== 'paid',
          description: 'Provider has accepted your booking!'
        };
      case 'confirmed':
        return {
          message: 'Booking Confirmed',
          color: 'text-primary',
          canPay: bookingDetails.paymentStatus !== 'paid',
          description: 'Your booking is confirmed.'
        };
      case 'in-progress':
        return {
          message: 'Service In Progress',
          color: 'text-primary',
          canPay: false,
          description: 'Service is currently being performed.'
        };
      case 'completed':
        return {
          message: 'Service Completed',
          color: 'text-primary',
          canPay: false,
          description: 'Service completed successfully!'
        };
      case 'cancelled':
        return { message: 'Booking Cancelled', color: 'text-red-500', canPay: false, description: 'This booking has been cancelled.' };
      default:
        return { message: bookingDetails.status || 'Unknown', color: 'text-gray-500', canPay: false, description: '' };
    }
  };

  const handleOnlinePayment = async () => {
    if (!razorpayLoaded) {
      showToast('Payment gateway is loading...', 'info');
      return;
    }

    if (!user?.email || !user?.phone) {
      showToast('Please update profile with email and phone', 'error');
      setTimeout(() => navigate('/customer/profile'), 2000);
      return;
    }

    try {
      const orderResponse = await axios.post(
        `${API}/transaction/create-order`,
        {
          bookingId: bookingDetails._id,
          amount: Math.round(bookingDetails.totalAmount * 100),
          currency: 'INR',
          paymentMethod: 'online'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!orderResponse.data?.success) throw new Error('Failed to create payment order');

      const { order, key, transactionId } = orderResponse.data.data;

      const options = {
        key: key,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'SAFEVOLT SOLUTIONS',
        description: `Payment for ${getServiceInfo().title}`,
        order_id: order.id,
        handler: async function (response) {
          try {
            const verifyResponse = await axios.post(
              `${API}/transaction/verify`,
              {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                bookingId: bookingDetails._id,
                transactionId: transactionId
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!verifyResponse.data?.success) throw new Error('Payment verification failed');

            showToast('Payment successful! Booking confirmed.', 'success');
            setTimeout(() => navigate('/customer/bookings'), 2000);
          } catch (verificationError) {
            showToast('Payment verification failed. Please contact support.', 'error');
          }
        },
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        theme: { color: '#0D9488' },
        modal: { ondismiss: () => showToast('Payment cancelled', 'info') }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      showToast('Failed to initialize payment', 'error');
    }
  };

  const handleCashPayment = async () => {
    try {
      setShowCashModal(false);
      showToast('Confirming booking...', 'info');
      await axios.post(
        `${API}/booking/${bookingDetails._id}/payment`,
        { 
          paymentMethod: 'cash', 
          paymentStatus: 'pending', 
          bookingStatus: 'confirmed',
          paymentType: 'pay_after_service'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast('Booking Confirmed! Pay after service completion.', 'success');
      setTimeout(() => navigate('/customer/bookings'), 2000);
    } catch (error) {
      showToast('Failed to confirm booking', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-secondary">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error || !bookingDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-secondary mb-2">Something went wrong</h2>
          <p className="text-gray-500 mb-6">{error || 'Booking not found'}</p>
          <button onClick={() => navigate('/customer/services')} className="px-6 py-3 bg-primary text-white rounded-xl font-medium">
            Browse Services
          </button>
        </div>
      </div>
    );
  }

  const serviceInfo = getServiceInfo();
  const statusInfo = getBookingStatusInfo();
  const quantity = bookingDetails.services?.[0]?.quantity || 1;
  const subtotal = bookingDetails.subtotal || serviceInfo.basePrice * quantity;
  const discount = bookingDetails.totalDiscount || 0;
  const totalAmount = bookingDetails.totalAmount || subtotal - discount;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-[98%] mx-auto px-4">
          <div className="flex items-center gap-4 py-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-secondary" />
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-gray-400">Booking Confirmation</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-primary font-medium truncate max-w-[200px]">{serviceInfo.title}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[98%] mx-auto px-4 pt-4 pb-2">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Service Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex gap-5">
                <div className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={serviceInfo.image || 'https://placehold.co/400x400?text=No+Image'}
                    alt={serviceInfo.title}
                    className="w-full h-full object-cover"
                    onError={(e) => e.target.src = 'https://placehold.co/400x400?text=No+Image'}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-lg mb-1">
                        {typeof serviceInfo.category === 'object' ? serviceInfo.category?.name : serviceInfo.category || 'Service'}
                      </span>
                      <h2 className="text-lg font-bold text-secondary">{serviceInfo.title}</h2>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold text-secondary text-sm">{serviceInfo.averageRating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-1 line-clamp-2">{serviceInfo.title} service</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" />{serviceInfo.duration || 'Flexible'} hrs</div>
                    <div className="flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-primary" />Free Visit</div>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-baseline gap-1">
                      <IndianRupee className="w-3.5 h-3.5 text-secondary" />
                      <span className="text-xl font-bold text-primary">{serviceInfo.basePrice?.toFixed(2) || 0}</span>
                      <span className="text-xs text-gray-400">/service</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Details */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-bold text-secondary mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Booking Details
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Date & Time</p>
                    <p className="text-sm font-medium text-secondary">{formatDate(bookingDetails.date)} {bookingDetails.time && `at ${bookingDetails.time}`}</p>
                  </div>
                </div>
                {bookingDetails.address && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <MapPin className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Service Address</p>
                      <p className="text-sm font-medium text-secondary">
                        {[bookingDetails.address.street, bookingDetails.address.city, bookingDetails.address.state, bookingDetails.address.postalCode].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                )}
                {bookingDetails.notes && (
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Special Instructions</p>
                      <p className="text-sm font-medium text-secondary">{bookingDetails.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Status Card */}
            <div className={`bg-white rounded-xl shadow-sm border p-5 ${statusInfo.color === 'text-accent' ? 'border-accent/20' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Booking Status</p>
                  <p className={`text-base font-bold ${statusInfo.color}`}>{statusInfo.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{statusInfo.description}</p>
                </div>
                <div className={`w-3 h-3 rounded-full ${bookingDetails.status === 'pending' ? 'bg-accent animate-pulse' : 'bg-primary'}`} />
              </div>
            </div>

            {/* Provider Card */}
            {bookingDetails.provider && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-base font-bold text-secondary mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-primary" />
                  Service Provider
                </h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Wrench className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary">{bookingDetails.provider.name}</p>
                    <p className="text-xs text-gray-500">Provider ID: {bookingDetails.provider.providerId || 'N/A'}</p>
                  </div>
                </div>
                {bookingDetails.provider.phone && (
                  <a href={`tel:${bookingDetails.provider.phone}`} className="flex items-center justify-center gap-2 w-full py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                    <Phone className="w-3.5 h-3.5" />
                    Call Provider
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              {/* Price Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-bold text-secondary text-sm mb-3 flex items-center gap-2">
                  <IndianRupee className="w-3.5 h-3.5 text-primary" />
                  Price Details
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Service Price ({quantity} item)</span>
                    <span className="text-secondary font-medium">₹{subtotal.toFixed(2)}</span>
                  </div>

                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Discount Applied</span>
                        <span className="text-green-600 font-medium">-₹{discount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t border-gray-50">
                        <span className="text-gray-600 font-semibold">Price after Discount</span>
                        <span className="text-secondary font-bold">₹{(subtotal - discount).toFixed(2)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Visiting Charges</span>
                    <span className="text-green-600 font-semibold italic">Free</span>
                  </div>

                  <div className="border-t border-gray-100 pt-3 mt-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-secondary text-base">Total Amount</span>
                      <span className="font-bold text-primary text-xl">₹{totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Actions */}
              {statusInfo.canPay && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h3 className="font-bold text-secondary text-sm mb-3 flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    Complete Payment
                  </h3>
                  <div className="space-y-3">
                    <button
                      onClick={handleOnlinePayment}
                      disabled={!razorpayLoaded}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:bg-gray-300"
                    >
                      <CreditCard className="w-4 h-4" />
                      Pay Online ₹{totalAmount.toFixed(2)}
                    </button>
                    <button
                      onClick={() => setShowCashModal(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
                    >
                      <Wallet className="w-4 h-4" />
                      Pay Cash Later
                    </button>
                  </div>
                  <div className="mt-3 flex justify-center gap-3 text-xs text-gray-400">
                    <div className="flex items-center gap-1"><Lock className="w-3 h-3" />Secure</div>
                    <div className="flex items-center gap-1"><Shield className="w-3 h-3" />Protected</div>
                  </div>
                </div>
              )}

              {/* Help Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                <p className="text-xs text-gray-500 mb-2 font-bold uppercase tracking-widest opacity-60">Need help?</p>
                <div className="flex justify-center gap-6 text-primary text-xs font-bold">
                  <Link to="/contact" className="flex items-center gap-1.5 hover:text-primary/70 transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" /> Support Center
                  </Link>
                  <Link to="/customer/complaints" className="flex items-center gap-1.5 hover:text-primary/70 transition-colors">
                    <AlertCircle className="w-3.5 h-3.5" /> Raise Complaint
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cash Confirmation Modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-secondary/40 backdrop-blur-sm" onClick={() => setShowCashModal(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Wallet className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-lg font-bold text-secondary">Confirm Cash Payment</h3>
              </div>

              <div className="space-y-4 mb-8">
                <p className="text-sm text-gray-500">Please review your bill before confirming. You'll pay this amount to the pro after service.</p>

                <div className="space-y-2 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Service Price</span>
                    <span className="font-medium text-secondary">₹{subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Discount</span>
                        <span className="font-medium text-green-600">-₹{discount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t border-gray-50">
                        <span className="text-gray-500 font-semibold">Price after Discount</span>
                        <span className="font-medium text-secondary">₹{(subtotal - discount).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Visiting Charges</span>
                    <span className="font-medium text-green-600">Free</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-50">
                    <span className="font-bold text-secondary">Total to Pay</span>
                    <span className="font-bold text-primary text-lg">₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCashModal(false)}
                  className="flex-1 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCashPayment}
                  className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                >
                  Confirm Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingConfirmation;