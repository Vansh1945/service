import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { toast } from 'react-toastify';
import {
  ArrowLeft, CreditCard, Wallet, CheckCircle, Calendar, MapPin,
  Clock, Tag, AlertTriangle, Shield, Lock, Wrench, Star, IndianRupee,
  Truck, Phone, Mail, ChevronRight, MessageCircle, AlertCircle
} from 'lucide-react';
import { getPublicServiceById } from '../../services/ServiceService';
import { getBooking, updateBookingPayment, payBooking } from '../../services/BookingService';
import axiosInstance from '../../api/axiosInstance';
import * as TransactionService from '../../services/TransactionService';
import * as CustomerService from '../../services/CustomerService';
import * as SystemService from '../../services/SystemService';
import Loader from '../../components/Loader';
import { formatDate, formatTime, formatCurrency } from '../../utils/format';

const BookingConfirmation = () => {
  const { bookingId } = useParams();
  const { token, user, isAuthenticated, API, showToast } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [allowCOD, setAllowCOD] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [bookingDetails, setBookingDetails] = useState(null);
  const [serviceDetails, setServiceDetails] = useState(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [showCashModal, setShowCashModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentProgressMessage, setPaymentProgressMessage] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('INR');

  // Load Razorpay script
  useEffect(() => {
    if (window.Razorpay) {
      setRazorpayLoaded(true);
    } else {
      // Fallback: check every 100ms for up to 3 seconds if script is loaded from index.html
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.Razorpay) {
          setRazorpayLoaded(true);
          clearInterval(interval);
        } else if (attempts >= 30) {
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  const fetchServiceDetails = async (serviceId) => {
    try {
      const response = await getPublicServiceById(serviceId);
      if (response.data?.success) return response.data.data;
      return null;
    } catch (error) {
      console.error('Error fetching service details:', error);
      return null;
    }
  };

  const fetchBookingDetails = async () => {
    try {
      const response = await getBooking(bookingId);

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to fetch booking details');
      }

      const booking = response.data.data;
      // If cash booking not yet paid (Pay Now flow), default to online
      if (booking.paymentMethod === 'cash' && !['paid', 'escrow_hold'].includes(booking.paymentStatus)) {
        setPaymentMethod('online');
      } else if (booking.paymentMethod) {
        setPaymentMethod(booking.paymentMethod);
      }
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
        const profileRes = await CustomerService.getProfile().catch(() => null);
        if (profileRes?.data?.user?.wallet) {
          setWalletBalance(profileRes.data.user.wallet.availableBalance || 0);
        }

        const settingsRes = await SystemService.getSystemSetting().catch(() => null);
        if (settingsRes?.data?.success) {
          setAllowCOD(settingsRes.data.data?.bookingSettings?.allowCOD !== false);
          setDefaultCurrency(settingsRes.data.data?.defaultCurrency || 'INR');
        }

        if (location.state?.booking) {
          const b = location.state.booking;
          setBookingDetails(b);
          setServiceDetails(location.state.service);
          // If it's a cash booking not yet paid (Pay Now flow), default to online so
          // the customer can choose how to pay — 'cash' is not a valid createOrder method
          if (b.paymentMethod === 'cash' && !['paid', 'escrow_hold'].includes(b.paymentStatus)) {
            setPaymentMethod('online');
          } else if (b.paymentMethod) {
            setPaymentMethod(b.paymentMethod);
          }
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

    const isPaid = ['paid', 'escrow_hold'].includes(bookingDetails.paymentStatus);

    switch (bookingDetails.status) {
      case 'pending':
        return {
          message: 'Pending Provider Acceptance',
          color: 'text-accent',
          canPay: !isPaid,
          description: 'Complete payment to secure your booking.'
        };
      case 'accepted':
        return {
          message: 'Accepted by Provider',
          color: 'text-primary',
          canPay: !isPaid,
          description: 'Provider has accepted your booking!'
        };
      case 'confirmed':
        return {
          message: 'Booking Confirmed',
          color: 'text-primary',
          canPay: !isPaid,
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
      case 'scheduled':
        return {
          message: 'Booking Scheduled (Pay after Service)',
          color: 'text-yellow-600',
          canPay: !isPaid,
          description: 'You can pay now online, or pay cash when the provider arrives.'
        };
      case 'cancelled':
        return { message: 'Booking Cancelled', color: 'text-red-500', canPay: false, description: 'This booking has been cancelled.' };
      default:
        return {
          message: bookingDetails.status || 'Unknown',
          color: 'text-gray-500',
          canPay: !isPaid && !['cancelled', 'completed', 'in-progress'].includes(bookingDetails.status),
          description: ''
        };
    }
  };

  const handleWalletPayment = async () => {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    setPaymentProgressMessage('Processing Wallet Payment...');
    const toastId = toast.loading('Processing wallet payment...');
    try {
      const response = await payBooking(bookingDetails._id, {
        paymentDetails: { paymentMethod: 'wallet' }
      });

      if (!response.data?.success) throw new Error(response.data?.message || 'Payment failed');

      toast.update(toastId, {
        render: 'Payment successful! Booking confirmed.',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });
      axiosInstance.post('/chat/create-room', { bookingId: bookingDetails._id }).catch(err => console.error(err));
      setTimeout(() => navigate('/customer/bookings'), 2000);
    } catch (error) {
      console.error('Wallet payment error:', error);
      toast.update(toastId, {
        render: error.response?.data?.message || error.message || 'Wallet payment failed',
        type: 'error',
        isLoading: false,
        autoClose: 5000
      });
    } finally {
      setIsProcessingPayment(false);
      setPaymentProgressMessage('');
    }
  };

  const handleOnlineOrMixedPayment = async (selectedMethod) => {
    if (isProcessingPayment) return;

    // Safety guard: only 'online' and 'mixed' are valid for Razorpay createOrder
    if (!['online', 'mixed'].includes(selectedMethod)) {
      showToast('Please select a payment method.', 'error');
      return;
    }

    if (!razorpayLoaded) {
      showToast('Payment gateway is loading...', 'info');
      return;
    }

    if (!user?.email || !user?.phone) {
      showToast('Please update profile with email and phone', 'error');
      setTimeout(() => navigate('/customer/profile'), 2000);
      return;
    }

    setIsProcessingPayment(true);
    setPaymentProgressMessage('Creating Secure Order...');

    try {
      const isMixed = selectedMethod === 'mixed';
      const walletDeduction = isMixed ? Math.min(walletBalance, bookingDetails.totalAmount) : 0;
      const remainingAmount = bookingDetails.totalAmount - walletDeduction;

      // EDGE CASE: If remaining amount is 0 (wallet balance covers full amount)
      if (remainingAmount <= 0) {
        setPaymentProgressMessage('Processing Wallet Payment...');
        const response = await payBooking(bookingDetails._id, {
          paymentDetails: { paymentMethod: 'wallet' }
        });
        if (!response.data?.success) throw new Error(response.data?.message || 'Payment failed');
        showToast('Payment successful! Booking confirmed.', 'success');
        axiosInstance.post('/chat/create-room', { bookingId: bookingDetails._id }).catch(err => console.error(err));
        setTimeout(() => navigate('/customer/bookings'), 2000);
        return;
      }

      const orderResponse = await TransactionService.createOrder({
        bookingId: bookingDetails._id,
        amount: Math.round(remainingAmount * 100),
        currency: defaultCurrency,
        paymentMethod: selectedMethod
      });

      if (!orderResponse.data?.success) throw new Error('Failed to create payment order');

      setPaymentProgressMessage('Opening Razorpay...');

      const { order, key, transactionId } = orderResponse.data.data;

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY || key,
        amount: order.amount,
        currency: order.currency || defaultCurrency,
        name: 'Raj Electrical Services',
        description: isMixed
          ? `Mixed Payment: Wallet (₹${walletDeduction}) + Razorpay`
          : `Payment for ${getServiceInfo().title}`,
        order_id: order.id,
        handler: async function (response) {
          setPaymentProgressMessage('Processing Payment...');
          showToast('Verifying payment, please wait...', 'info');
          try {
            const verifyResponse = await TransactionService.verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              bookingId: bookingDetails._id,
              transactionId: transactionId
            });

            if (!verifyResponse.data?.success) throw new Error('Payment verification failed');

            showToast('Payment successful! Booking confirmed.', 'success');
            axiosInstance.post('/chat/create-room', { bookingId: bookingDetails._id }).catch(err => console.error(err));
            setTimeout(() => navigate('/customer/bookings'), 2000);
          } catch (verificationError) {
            setIsProcessingPayment(false);
            setPaymentProgressMessage('');
            showToast('Payment verification failed. Please contact support.', 'error');
          }
        },
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        theme: { color: '#0D9488' },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
            setPaymentProgressMessage('');
            showToast('Payment cancelled', 'info');
          }
        }
      };

      // DESTROY OLD INSTANCE to prevent repeated popup crash/error
      if (window.currentRazorpay) {
        try {
          window.currentRazorpay.close();
        } catch (e) {
          console.warn('Error closing previous Razorpay popup:', e);
        }
      }

      const rzp = new window.Razorpay(options);
      window.currentRazorpay = rzp;

      rzp.on('payment.failed', function (response) {
        setIsProcessingPayment(false);
        setPaymentProgressMessage('');
      });
      rzp.open();
    } catch (error) {
      setIsProcessingPayment(false);
      setPaymentProgressMessage('');
      showToast(error.response?.data?.message || 'Failed to initialize payment', 'error');
    }
  };

  const handleCashPayment = async () => {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    setPaymentProgressMessage('Confirming Cash Payment...');
    try {
      setShowCashModal(false);
      showToast('Confirming booking...', 'info');
      await updateBookingPayment(bookingDetails._id, {
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        bookingStatus: 'confirmed',
      });
      showToast('Booking Confirmed! Pay after service completion.', 'success');
      axiosInstance.post('/chat/create-room', { bookingId: bookingDetails._id }).catch(err => console.error(err));
      setTimeout(() => navigate('/customer/bookings'), 2000);
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to confirm booking', 'error');
    } finally {
      setIsProcessingPayment(false);
      setPaymentProgressMessage('');
    }
  };

  if (isLoading) {
    return <Loader />;
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
                      <span className="text-xl font-bold text-primary">{formatCurrency((serviceInfo.basePrice || 0) + (bookingDetails.demandSurge || 0))}</span>
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
                    <p className="text-sm font-medium text-secondary">{formatDate(bookingDetails.date)} {bookingDetails.time && `at ${formatTime(bookingDetails.time)}`}</p>
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
                    <span className="text-secondary font-medium">{formatCurrency(subtotal + (bookingDetails.demandSurge || 0))}</span>
                  </div>

                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Discount Applied</span>
                        <span className="text-green-600 font-medium">-{formatCurrency(discount)}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t border-gray-50">
                        <span className="text-gray-600 font-semibold">Price after Discount</span>
                        <span className="text-secondary font-bold">{formatCurrency(subtotal + (bookingDetails.demandSurge || 0) - discount)}</span>
                      </div>
                    </>
                  )}

                  {((bookingDetails.rainCharge || 0) +
                    (bookingDetails.trafficCharge || 0) +
                    (bookingDetails.nightCharge || 0) +
                    (bookingDetails.platformFee || 0) +
                    (bookingDetails.customCharges || 0)) > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Additional Service Charges</span>
                        <span className="text-red-500 font-medium">+{formatCurrency(
                          (bookingDetails.rainCharge || 0) +
                          (bookingDetails.trafficCharge || 0) +
                          (bookingDetails.nightCharge || 0) +
                          (bookingDetails.platformFee || 0) +
                          (bookingDetails.customCharges || 0)
                        )}</span>
                      </div>
                    )}

                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Visiting Charges</span>
                    <span className="text-green-600 font-semibold italic">{(Number(bookingDetails.visitingCharge) > 0 ? formatCurrency(bookingDetails.visitingCharge) : "Free")}</span>
                  </div>

                  <div className="border-t border-gray-100 pt-3 mt-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-secondary text-base">Total Amount</span>
                      <span className="font-bold text-primary text-xl">{formatCurrency(totalAmount)}</span>
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

                  {/* Wallet Balance Indicator */}
                  <div className="mb-4 p-3 bg-teal-50/50 border border-teal-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-teal-600" />
                      <div>
                        <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider">Available Wallet Balance</p>
                        <p className="text-sm font-black text-teal-900">{formatCurrency(walletBalance)}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">Secure</span>
                  </div>

                  {/* Payment Selector */}
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {/* Pay Online */}
                    <div
                      className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'online' ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                      onClick={() => setPaymentMethod('online')}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'online' ? 'border-primary' : 'border-gray-300'}`}>
                        {paymentMethod === 'online' && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-secondary">Pay Online</p>
                        <p className="text-[9px] text-gray-400">Card, UPI, Netbanking</p>
                      </div>
                      <CreditCard className="w-3.5 h-3.5 text-gray-300" />
                    </div>

                    {/* Wallet Payment */}
                    <div
                      className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-all ${walletBalance >= totalAmount
                        ? paymentMethod === 'wallet'
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200'
                        : 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100'
                        }`}
                      onClick={() => {
                        if (walletBalance >= totalAmount) {
                          setPaymentMethod('wallet');
                        } else {
                          toast.info('Insufficient wallet balance for full wallet payment.');
                        }
                      }}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'wallet' ? 'border-primary' : 'border-gray-300'}`}>
                        {paymentMethod === 'wallet' && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-secondary">Wallet Payment</p>
                          {walletBalance < totalAmount && (
                            <span className="text-[8px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Insufficient</span>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-400">Pay 100% from your Wallet</p>
                      </div>
                      <Wallet className="w-3.5 h-3.5 text-gray-300" />
                    </div>

                    {/* Wallet + Online Mixed */}
                    <div
                      className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-all ${walletBalance > 0
                        ? paymentMethod === 'mixed'
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-gray-100 hover:border-gray-200'
                        : 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100'
                        }`}
                      onClick={() => {
                        if (walletBalance > 0) {
                          setPaymentMethod('mixed');
                        } else {
                          toast.info('No wallet balance available for mixed payment.');
                        }
                      }}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'mixed' ? 'border-primary' : 'border-gray-300'}`}>
                        {paymentMethod === 'mixed' && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-secondary">Wallet + Online Mixed</p>
                          {walletBalance <= 0 && (
                            <span className="text-[8px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">₹0 Balance</span>
                          )}
                        </div>
                        <p className="text-[9px] text-gray-400">
                          {walletBalance > 0 && walletBalance < totalAmount
                            ? `Use ₹${walletBalance} from wallet + pay remaining online`
                            : 'Combine wallet balance with online payment'}
                        </p>
                      </div>
                      <div className="flex gap-0.5 text-gray-300">
                        <Wallet className="w-3 h-3" />
                        <span className="text-[8px] mt-0.5">+</span>
                        <CreditCard className="w-3 h-3" />
                      </div>
                    </div>

                    {/* Pay After Service (COD) */}
                    {allowCOD && (
                      <div
                        className={`flex items-center gap-3 p-2.5 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'cash' ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                        onClick={() => setPaymentMethod('cash')}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cash' ? 'border-primary' : 'border-gray-300'}`}>
                          {paymentMethod === 'cash' && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-secondary">Pay After Service (COD)</p>
                          <p className="text-[9px] text-gray-400">Pay cash or via UPI directly to the provider</p>
                        </div>
                        <Wallet className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Mixed payment deduction details */}
                  {paymentMethod === 'mixed' && walletBalance > 0 && (
                    <div className="mb-4 p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-1">
                      <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Mixed Payment Breakdown</p>
                      <div className="flex justify-between text-xs font-medium text-amber-900">
                        <span>Deducted from Wallet:</span>
                        <span>{formatCurrency(Math.min(walletBalance, totalAmount))}</span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-amber-950 pt-1 border-t border-amber-100/50">
                        <span>Remaining Pay Online:</span>
                        <span>{formatCurrency(Math.max(0, totalAmount - walletBalance))}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        if (paymentMethod === 'wallet') {
                          handleWalletPayment();
                        } else if (paymentMethod === 'cash') {
                          setShowCashModal(true);
                        } else {
                          handleOnlineOrMixedPayment(paymentMethod);
                        }
                      }}
                      disabled={isProcessingPayment}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isProcessingPayment ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {paymentProgressMessage || 'Processing...'}
                        </>
                      ) : (
                        <>
                          {paymentMethod === 'cash' ? (
                            <Wallet className="w-4 h-4" />
                          ) : (
                            <CreditCard className="w-4 h-4" />
                          )}
                          {paymentMethod === 'wallet'
                            ? `Pay via Wallet • ${formatCurrency(totalAmount)}`
                            : paymentMethod === 'mixed'
                              ? `Pay Remaining • ${formatCurrency(Math.max(0, totalAmount - walletBalance))}`
                              : paymentMethod === 'cash'
                                ? `Confirm Cash Booking • ${formatCurrency(totalAmount)}`
                                : `Pay Online • ${formatCurrency(totalAmount)}`}
                        </>
                      )}
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
                    <span className="font-medium text-secondary">{formatCurrency(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Discount</span>
                        <span className="font-medium text-green-600">-{formatCurrency(discount)}</span>
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t border-gray-50">
                        <span className="text-gray-500 font-semibold">Price after Discount</span>
                        <span className="font-medium text-secondary">{formatCurrency(subtotal - discount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Visiting Charges</span>
                    <span className="font-medium text-green-600">{(Number(bookingDetails.visitingCharge) > 0 ? formatCurrency(bookingDetails.visitingCharge) : "Free")}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-50">
                    <span className="font-bold text-secondary">Total to Pay</span>
                    <span className="font-bold text-primary text-lg">{formatCurrency(totalAmount)}</span>
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
