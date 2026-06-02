import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';
import { ArrowLeft, CheckCircle, Plus, Minus, Tag, Clock, Shield, Lock, Star, IndianRupee, Truck, RotateCcw, CalendarDays, CreditCard, Wallet, MapPin } from 'lucide-react';
import AddressSelector from '../../components/AddressSelector';
import Loader from '../../components/Loader';
import { getPublicServiceById } from '../../services/ServiceService';
import { getAvailableCoupons, applyCoupon as applyCouponAPI } from '../../services/CouponService';
import { createBooking } from '../../services/BookingService';
import { resolveActiveSurcharges } from '../../services/SurgeService';
import { getSystemSetting } from '../../services/SystemService';
import * as CustomerService from '../../services/CustomerService';
import { formatCurrency, formatTime } from '../../utils/format';

const BookService = () => {
  const { serviceId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefillBooking = location.state?.prefillBooking;

  // State declarations
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isFetchingCoupons, setIsFetchingCoupons] = useState(false);
  const [service, setService] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [bookingPreference, setBookingPreference] = useState('auto'); // 'auto' or 'favorite'
  const [selectedFavoriteProviderId, setSelectedFavoriteProviderId] = useState('');
  const [favoriteProviderAvailability, setFavoriteProviderAvailability] = useState({ checked: false, available: false, message: '' });
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [showPrefillBanner, setShowPrefillBanner] = useState(true);
  const [activeSurcharges, setActiveSurcharges] = useState([]);
  const [systemSettings, setSystemSettings] = useState(null);
  const [detectedZoneId, setDetectedZoneId] = useState(null);
  const [zoneAncestry, setZoneAncestry] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    date: new Date(),
    time: '',
    addressId: '',
    customAddress: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      houseNumber: '',
      road: '',
      landmark: '',
      area: '',
      pincode: '',
      formattedAddress: '',
      lat: null,
      lng: null,
      s2CellId: null,
      s2CellIdPrecise: null
    },
    useCustomAddress: false,
    notes: '',
    quantity: 1,
    couponCode: '',
    appliedCoupon: null,
    paymentMethod: 'online'
  });




  useEffect(() => {
    // Autocomplete disabled for Nominatim. Can type directly.
  }, [formData.useCustomAddress]);

  useEffect(() => {
    const checkAvailability = async () => {
      if (bookingPreference === 'favorite' && selectedFavoriteProviderId) {
        try {
          const categoryId = service?.category?._id || service?.category;
          const res = await CustomerService.checkFavoriteProviderAvailability(selectedFavoriteProviderId, categoryId);
          if (res.data?.success) {
            setFavoriteProviderAvailability({
              checked: true,
              available: res.data.isAvailable,
              message: res.data.message
            });
          }
        } catch (err) {
          setFavoriteProviderAvailability({
            checked: true,
            available: false,
            message: 'Error checking provider availability'
          });
        }
      } else {
        setFavoriteProviderAvailability({ checked: false, available: false, message: '' });
      }
    };
    checkAvailability();
  }, [bookingPreference, selectedFavoriteProviderId, service]);

  // Get next 3 days
  const getNext3Days = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next3Days = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      next3Days.push(date);
    }
    return next3Days;
  };

  const availableDates = getNext3Days();
  const maxDate = availableDates[availableDates.length - 1];

  // Generate time slots
  const generateTimeSlots = () => {
    const slots = [];
    const now = new Date();
    const isToday = formData.date.toDateString() === now.toDateString();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const startHour = isToday ? Math.max(currentHour + 1, 8) : 8;
    const endHour = 20;

    for (let hour = startHour; hour <= endHour; hour++) {
      slots.push({
        display: formatTime(`${hour.toString().padStart(2, '0')}:00`),
        value: `${hour.toString().padStart(2, '0')}:00`
      });
    }

    if (isToday && currentMinute > 45 && slots.length > 0) {
      return slots.slice(1);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();


  // Fetch service details
  const fetchService = async () => {
    try {
      const response = await getPublicServiceById(serviceId);
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to load service');
      }
      return response.data.data;
    } catch (err) {
      console.error('Error fetching service:', err);
      toast.error(err.response?.data?.message || 'Failed to load service details');
      throw err;
    }
  };

  // Fetch user addresses
  const fetchUserAddresses = async () => {
    try {
      const response = await CustomerService.getProfile();
      return response.data.user.address ? [response.data.user.address] : [];
    } catch (err) {
      console.error('Error fetching user addresses:', err);
      return [];
    }
  };

  // Fetch available coupons
  const fetchAvailableCoupons = async () => {
    if (!service?.basePrice) return;

    setIsFetchingCoupons(true);
    try {
      const bookingValue = service.basePrice * (formData.quantity || 1);
      const params = { bookingValue };
      if (detectedZoneId) {
        params.zoneId = detectedZoneId;
      }
      const response = await getAvailableCoupons(params);

      if (response.data.success) {
        setCoupons(response.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching coupons:', err);
      setCoupons([]);
    } finally {
      setIsFetchingCoupons(false);
    }
  };

  // Apply coupon
  const applyCoupon = async () => {
    if (!formData.couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    if (isApplyingCoupon) return;

    setIsApplyingCoupon(true);
    try {
      const addressData = formData.useCustomAddress ? formData.customAddress : addresses[0];
      const response = await applyCouponAPI(
        {
          code: formData.couponCode.trim().toUpperCase(),
          bookingValue: service.basePrice * formData.quantity,
          bookingData: {
            address: addressData,
            zoneId: detectedZoneId
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Invalid coupon');
      }

      const couponData = response.data.data.coupon;
      const discountDetails = response.data.data;

      setFormData(prev => ({
        ...prev,
        appliedCoupon: {
          code: couponData.code,
          discountType: couponData.discountType,
          discountValue: couponData.discountValue,
          discountAmount: discountDetails.discountAmount,
          finalAmount: discountDetails.finalAmount
        },
        couponCode: couponData.code
      }));

      toast.success('Coupon applied successfully!');
    } catch (err) {
      if (err.name === 'CanceledError' || err.message === 'canceled') {
        return; // Silently ignore request cancellations
      }
      toast.error(err.response?.data?.message || err.message || 'Failed to apply coupon');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  // Fetch active surcharges
  useEffect(() => {
    const fetchSurcharges = async () => {
      try {
        let lat = null;
        let lng = null;

        if (formData.useCustomAddress) {
          lat = formData.customAddress.lat;
          lng = formData.customAddress.lng;
        } else if (addresses.length > 0) {
          lat = addresses[0].lat;
          lng = addresses[0].lng;
        }

        const params = {
          time: formData.time || undefined,
          subtotal: service ? service.basePrice * formData.quantity : undefined
        };
        if (lat && lng) {
          params.lat = lat;
          params.lng = lng;
        }

        const response = await resolveActiveSurcharges(params);
        if (response.data?.success) {
          setActiveSurcharges(response.data.data || []);
          setDetectedZoneId(response.data.zoneId || null);
          setZoneAncestry(response.data.zoneAncestry || []);
        }
      } catch (err) {
        console.error("Error fetching active surcharges:", err);
      }
    };

    if (service) {
      fetchSurcharges();
    }
  }, [formData.date, formData.time, formData.customAddress.lat, formData.customAddress.lng, addresses, formData.useCustomAddress, service, formData.quantity]);

  // Calculate surcharges
  const calculateSurcharges = () => {
    let totalSurcharge = 0;
    const breakdowns = [];
    const baseAmount = service ? service.basePrice * (formData.quantity || 1) : 0;

    activeSurcharges.forEach(s => {
      if (s.maxBookingValue && baseAmount > s.maxBookingValue) {
        return;
      }
      let chargeAmount = 0;
      if (s.mode === 'flat') {
        chargeAmount = s.value;
      } else if (s.mode === 'percentage') {
        chargeAmount = (baseAmount * s.value) / 100;
      } else if (s.mode === 'multiplier') {
        chargeAmount = baseAmount * (s.value - 1);
      }
      chargeAmount = parseFloat(chargeAmount.toFixed(2));
      totalSurcharge += chargeAmount;
      breakdowns.push({
        id: s._id,
        name: s.chargeType === 'platform' ? 'Platform Fee' : `${s.chargeType.charAt(0).toUpperCase() + s.chargeType.slice(1)} Charge`,
        amount: chargeAmount,
        mode: s.mode,
        value: s.value
      });
    });

    return { totalSurcharge, breakdowns };
  };

  // Calculate discount
  const calculateDiscount = () => {
    if (!service?.basePrice || !formData.appliedCoupon) return 0;
    const baseAmount = service.basePrice * (formData.quantity || 1);
    if (formData.appliedCoupon.discountType === 'percent') {
      return (baseAmount * formData.appliedCoupon.discountValue) / 100;
    } else {
      return Math.min(formData.appliedCoupon.discountValue, baseAmount);
    }
  };

  const calculateTotal = () => {
    if (!service?.basePrice) return 0;
    const baseAmount = service.basePrice * (formData.quantity || 1);
    const discount = calculateDiscount();
    const { totalSurcharge } = calculateSurcharges();
    return Math.max(0, baseAmount - discount + totalSurcharge);
  };

  const getVisitingAndAdditionalCharges = () => {
    let visiting = 0;
    let additional = 0;
    const { breakdowns } = calculateSurcharges();

    breakdowns.forEach(s => {
      const type = s.name.toLowerCase();
      if (type.includes('visiting') || type.includes('festival') || type.includes('custom')) {
        visiting += s.amount;
      } else {
        additional += s.amount;
      }
    });

    return { visiting, additional };
  };

  const getCustomerPricingBreakdown = () => {
    const { breakdowns } = calculateSurcharges();
    let demand = 0;
    let visiting = 0;
    let additional = 0;
    const additionalBreakdown = [];

    breakdowns.forEach(s => {
      const type = s.name.toLowerCase();
      if (type.includes('demand')) {
        demand += s.amount;
      } else if (type.includes('visiting') || type.includes('festival') || type.includes('custom')) {
        visiting += s.amount;
      } else {
        additional += s.amount;
        additionalBreakdown.push({ name: s.name, amount: s.amount });
      }
    });

    const mergedServicePrice = baseAmount + demand;
    return {
      mergedServicePrice,
      visiting,
      additional,
      additionalBreakdown,
      demand
    };
  };

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        if (!token) {
          toast.error('Please login to book a service');
          navigate('/login');
          return;
        }

        const [serviceData, addressesData, profileData, settingsRes] = await Promise.all([
          fetchService(),
          fetchUserAddresses(),
          CustomerService.getProfile().then(res => res.data?.user).catch(() => null),
          getSystemSetting().catch(() => null)
        ]);

        setService(serviceData);
        setAddresses(addressesData);
        if (profileData?.wallet) {
          setWalletBalance(profileData.wallet.availableBalance || 0);
        }
        if (settingsRes?.data?.success) {
          setSystemSettings(settingsRes.data.data);
        }

        if (prefillBooking) {
          setFormData(prev => ({
            ...prev,
            notes: prefillBooking.notes || '',
            quantity: prefillBooking.quantity || 1,
            useCustomAddress: true,
            customAddress: {
              ...prev.customAddress,
              street: prefillBooking.address?.street || '',
              city: prefillBooking.address?.city || '',
              state: prefillBooking.address?.state || '',
              postalCode: prefillBooking.address?.postalCode || prefillBooking.address?.pincode || '',
              pincode: prefillBooking.address?.pincode || prefillBooking.address?.postalCode || '',
              country: prefillBooking.address?.country || 'India',
              houseNumber: prefillBooking.address?.houseNumber || '',
              road: prefillBooking.address?.road || '',
              landmark: prefillBooking.address?.landmark || '',
              area: prefillBooking.address?.area || '',
              formattedAddress: prefillBooking.address?.formattedAddress || '',
              lat: prefillBooking.address?.lat || null,
              lng: prefillBooking.address?.lng || null,
              s2CellId: prefillBooking.address?.s2CellId || null,
              s2CellIdPrecise: prefillBooking.address?.s2CellIdPrecise || null
            }
          }));
        } else {
          const hasSavedAddresses = addressesData.length > 0;
          setFormData(prev => ({
            ...prev,
            useCustomAddress: !hasSavedAddresses
          }));

          if (!hasSavedAddresses) {
            setIsMapModalOpen(true);
          }
        }
      } catch (err) {
        navigate('/services');
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [serviceId, token]);

  // Fetch coupons when service, quantity, or detectedZoneId changes
  useEffect(() => {
    if (service) {
      fetchAvailableCoupons();
    }
  }, [service, formData.quantity, detectedZoneId]);

  const handleQuantityChange = (action) => {
    setFormData(prev => {
      const newQuantity = action === 'increment'
        ? Math.min(prev.quantity + 1, 10)
        : Math.max(prev.quantity - 1, 1);
      return {
        ...prev,
        quantity: newQuantity,
        appliedCoupon: null,
        couponCode: prev.appliedCoupon ? '' : prev.couponCode
      };
    });
  };



  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      date,
      appliedCoupon: null,
      couponCode: prev.appliedCoupon ? '' : prev.couponCode,
      time: ''
    }));
  };

  const removeCoupon = () => {
    setFormData(prev => ({
      ...prev,
      couponCode: '',
      appliedCoupon: null
    }));
  };

  const validateForm = () => {
    if (!service) {
      toast.error('Service information is not loaded');
      return false;
    }

    if (!formData.time) {
      toast.error('Please select a time');
      return false;
    }

    if (formData.useCustomAddress) {
      const { houseNumber, road, city, state, postalCode, pincode } = formData.customAddress;
      const code = pincode || postalCode;
      if (!houseNumber?.trim() || !road?.trim() || !city?.trim() || !state?.trim() || !code?.trim()) {
        toast.error('Please fill all mandatory address fields (House No, Road/Street, City, State, Pincode)');
        return false;
      }
      if (!/^\d{6}$/.test(code.trim())) {
        toast.error('Please enter a valid 6-digit pincode');
        return false;
      }
    } else if (addresses.length === 0) {
      toast.error('Please add an address to continue');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const toastId = toast.loading('Creating your booking...');

    try {
      let addressData;
      if (formData.useCustomAddress) {
        addressData = formData.customAddress;
      } else {
        if (addresses.length === 0) throw new Error('No address available');
        addressData = addresses[0];
      }

      const formattedDate = formData.date.toISOString().split('T')[0];
      const baseAmount = service.basePrice * formData.quantity;
      const totalAmount = calculateTotal();

      const bookingData = {
        serviceId: service._id,
        date: formattedDate,
        time: formData.time,
        address: {
          street: addressData.street ? addressData.street.trim() : '',
          city: addressData.city ? addressData.city.trim() : '',
          state: addressData.state ? addressData.state.trim() : '',
          postalCode: addressData.postalCode ? addressData.postalCode.trim() : (addressData.pincode ? addressData.pincode.trim() : ''),
          pincode: addressData.pincode ? addressData.pincode.trim() : (addressData.postalCode ? addressData.postalCode.trim() : ''),
          country: addressData.country || 'India',
          houseNumber: addressData.houseNumber ? addressData.houseNumber.trim() : '',
          road: addressData.road ? addressData.road.trim() : '',
          landmark: addressData.landmark ? addressData.landmark.trim() : '',
          area: addressData.area ? addressData.area.trim() : '',
          formattedAddress: addressData.formattedAddress ? addressData.formattedAddress.trim() : '',
          lat: addressData.lat || null,
          lng: addressData.lng || null,
          s2CellId: addressData.s2CellId || null,
          s2CellIdPrecise: addressData.s2CellIdPrecise || null
        },
        notes: formData.notes.trim(),
        quantity: formData.quantity,
        couponCode: formData.appliedCoupon?.code || null,
        paymentMethod: formData.paymentMethod,
        subtotal: baseAmount,
        totalAmount: totalAmount,
        isRebook: !!prefillBooking,
        originalBooking: prefillBooking ? prefillBooking._id : null,
        isFavoriteProviderBooking: bookingPreference === 'favorite' && !!selectedFavoriteProviderId,
        preferredProviderId: (bookingPreference === 'favorite' && selectedFavoriteProviderId) ? selectedFavoriteProviderId : null
      };

      const response = await createBooking(bookingData);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create booking');
      }

      const bookingId = response.data._id || response.data.data?._id || response.data.bookingId;
      if (!bookingId) throw new Error('Booking ID not received');

      toast.update(toastId, {
        render: 'Booking created successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });

      setTimeout(() => {
        navigate(`/customer/booking-confirm/${bookingId}`, {
          state: { booking: response.data.data, service: service, fromBookingPage: true }
        });
      }, 1000);
    } catch (err) {
      console.error('Booking error:', err);
      let errorMessage = 'Failed to process booking';
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please try again.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
        setTimeout(() => navigate('/login'), 2000);
      } else if (err.response?.status === 409) {
        errorMessage = 'This time slot is no longer available.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      toast.update(toastId, { render: errorMessage, type: 'error', isLoading: false, autoClose: 5000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAmount = calculateTotal();
  const baseAmount = service?.basePrice * (formData.quantity || 1) || 0;
  const discountAmount = calculateDiscount();

  if (isLoading || !service) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-2 md:px-4 lg:px-4">
          <div className="flex items-center gap-4 py-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-secondary" />
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-gray-400">Book Service</span> /
              <span className="text-primary font-medium truncate max-w-[200px]">{service.title}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[98%] mx-auto px-2 md:px-4 lg:px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column - Booking Form */}
          <div className="lg:col-span-8 space-y-5">
            {/* Service Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex gap-5">
                <div className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={service.images?.[0] || 'https://placehold.co/400x400?text=No+Image'}
                    alt={service.title}
                    className="w-full h-full object-cover"
                    onError={(e) => e.target.src = 'https://placehold.co/400x400?text=No+Image'}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-lg mb-1">
                        {typeof service.category === 'object' ? service.category.name : service.category}
                      </span>
                      <h2 className="text-lg font-bold text-secondary">{service.title}</h2>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold text-secondary text-sm">{service.averageRating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mt-1 line-clamp-2">{service.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" />{service.duration} hrs</div>
                    <div className="flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-primary" />Free Visit</div>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(getCustomerPricingBreakdown().mergedServicePrice / formData.quantity)}
                      </span>
                      <span className="text-xs text-gray-400">/service</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {prefillBooking && showPrefillBanner && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 bg-emerald-100 rounded-lg text-emerald-700 animate-pulse">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-800">Rebooking Premium Prefill</h4>
                    <p className="text-[11px] text-emerald-600 font-medium">
                      Details prefilled from your previous order. Just pick a new date & time!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPrefillBanner(false)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-800 p-1 hover:bg-emerald-100/50 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Booking Form Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-bold text-secondary mb-4 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                Schedule Service
              </h3>

              <div className="space-y-4">
                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-1.5">Select Date</label>
                    <DatePicker
                      selected={formData.date}
                      onChange={handleDateChange}
                      minDate={new Date()}
                      maxDate={maxDate}
                      dateFormat="dd/MM/yyyy"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-secondary mb-1.5">Select Time</label>
                    <select
                      value={formData.time}
                      onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    >
                      <option value="">Select time</option>
                      {timeSlots.map((time, idx) => (
                        <option key={idx} value={time.value}>{time.display}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold text-secondary mb-1.5">Quantity</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange('decrement')}
                        disabled={formData.quantity <= 1}
                        className="px-3 py-1.5 text-gray-500 hover:text-primary disabled:opacity-50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 py-1.5 font-semibold text-secondary text-sm min-w-[40px] text-center">
                        {formData.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange('increment')}
                        disabled={formData.quantity >= 10}
                        className="px-3 py-1.5 text-gray-500 hover:text-primary disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-xs text-gray-400">Max 10</span>
                  </div>
                </div>

                {/* Booking Assignment Preference */}
                {user?.favoriteProviders?.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <div>
                        <label className="block text-sm font-semibold text-secondary">Assign Professionally</label>
                        <span className="text-[10px] text-gray-400">Match with your favorite or auto-assign instantly</span>
                      </div>
                      <div className="flex bg-gray-100 p-0.5 rounded-lg w-max shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setBookingPreference('auto');
                            setSelectedFavoriteProviderId('');
                          }}
                          className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${bookingPreference === 'auto'
                            ? 'bg-white text-secondary shadow-sm'
                            : 'text-gray-500 hover:text-secondary'
                            }`}
                        >
                          Auto Match
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookingPreference('favorite')}
                          className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${bookingPreference === 'favorite'
                            ? 'bg-white text-secondary shadow-sm'
                            : 'text-gray-500 hover:text-secondary'
                            }`}
                        >
                          My Favorite
                        </button>
                      </div>
                    </div>

                    {bookingPreference === 'favorite' && (
                      <div className="space-y-2.5 animate-fade-in bg-gray-50/50 p-2.5 rounded-xl border border-gray-100">
                        <select
                          value={selectedFavoriteProviderId}
                          onChange={(e) => setSelectedFavoriteProviderId(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold text-secondary"
                        >
                          <option value="">Choose a Favorite Provider</option>
                          {user.favoriteProviders.map((fp) => (
                            <option key={fp.providerId} value={fp.providerId}>
                              {fp.providerName} ({fp.category})
                            </option>
                          ))}
                        </select>

                        {selectedFavoriteProviderId && favoriteProviderAvailability.checked && (
                          <div className="mt-1">
                            {favoriteProviderAvailability.available ? (
                              <div className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                <span>{favoriteProviderAvailability.message}</span>
                              </div>
                            ) : (
                              <div className="p-2.5 bg-red-50 border border-red-100 rounded-lg">
                                <p className="text-[11px] font-bold text-red-700">Provider Unavailable</p>
                                <p className="text-[10px] text-red-600 leading-relaxed mt-0.5">
                                  {favoriteProviderAvailability.message || 'Provider is currently offline or busy.'} We will auto-assign a professional instead.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Service Address Selection */}
                <div className="border-t border-gray-100 pt-4 mt-2">
                  <div className="flex items-center justify-between mb-3.5">
                    <div>
                      <label className="block text-sm font-semibold text-secondary">Service Address</label>
                      <span className="text-[10px] text-gray-400">Where should we deliver the service?</span>
                    </div>
                    {addresses.length > 0 && (
                      <div className="flex bg-gray-100 p-0.5 rounded-lg w-max shrink-0">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, useCustomAddress: false }))}
                          className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${!formData.useCustomAddress
                            ? 'bg-white text-secondary shadow-sm'
                            : 'text-gray-500 hover:text-secondary'
                            }`}
                        >
                          Saved Address
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, useCustomAddress: true }))}
                          className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${formData.useCustomAddress
                            ? 'bg-white text-secondary shadow-sm'
                            : 'text-gray-500 hover:text-secondary'
                            }`}
                        >
                          New Address
                        </button>
                      </div>
                    )}
                  </div>

                  {!formData.useCustomAddress && addresses.length > 0 ? (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-2.5 animate-fade-in">
                      <div className="p-1.5 bg-primary/10 rounded-lg text-primary mt-0.5 flex-shrink-0">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-secondary">Deliver to Saved Address</p>
                        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                          {addresses[0]?.street}, {addresses[0]?.city}, {addresses[0]?.state} - {addresses[0]?.postalCode}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-white border border-gray-100 rounded-xl shadow-sm animate-fade-in space-y-3">
                      <AddressSelector
                        address={formData.customAddress}
                        onChange={(updatedAddress) => setFormData(prev => ({ ...prev, customAddress: updatedAddress }))}
                      />
                    </div>
                  )}
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-sm font-semibold text-secondary mb-1.5">Instructions (Optional)</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows="2"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    placeholder="Any special instructions..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-4">
              {/* Price Detail Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-bold text-secondary text-sm mb-3 flex items-center gap-2">
                  <IndianRupee className="w-3.5 h-3.5 text-primary" />
                  Price Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Service Price ({formData.quantity} item)</span>
                    <span className="text-secondary font-semibold">
                      {formatCurrency(getCustomerPricingBreakdown().mergedServicePrice)}
                    </span>
                  </div>
                  {formData.appliedCoupon && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Discount Applied</span>
                        <span className="text-green-600 font-medium">-{formatCurrency(discountAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-1 border-t border-gray-50">
                        <span className="text-gray-600 font-semibold">Price after Discount</span>
                        <span className="text-secondary font-bold">{formatCurrency(getCustomerPricingBreakdown().mergedServicePrice - discountAmount)}</span>
                      </div>
                    </>
                  )}
                  {getCustomerPricingBreakdown().additional > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Additional Service Charges</span>
                      <span className="text-red-500 font-semibold">
                        +{formatCurrency(getCustomerPricingBreakdown().additional)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Visiting Charges</span>
                    <span className="text-green-600 font-semibold italic">
                      {getCustomerPricingBreakdown().visiting > 0
                        ? `+${formatCurrency(getCustomerPricingBreakdown().visiting)}`
                        : "Free"}
                    </span>
                  </div>
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-secondary text-sm">Total Amount</span>
                      <span className="font-bold text-primary text-base">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-bold text-secondary text-sm mb-3 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                  Payment Method
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

                <div className="grid grid-cols-1 gap-2">
                  {/* Pay Online */}
                  <div
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.paymentMethod === 'online' ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                    onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'online' }))}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.paymentMethod === 'online' ? 'border-primary' : 'border-gray-300'}`}>
                      {formData.paymentMethod === 'online' && <div className="w-2 h-2 bg-primary rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-secondary">Pay Online</p>
                      <p className="text-[10px] text-gray-400">Card, UPI, Netbanking</p>
                    </div>
                    <CreditCard className="w-4 h-4 text-gray-300" />
                  </div>

                  {/* Pay After Service */}
                  <div
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.paymentMethod === 'cash' ? 'border-primary bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}
                    onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'cash' }))}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.paymentMethod === 'cash' ? 'border-primary' : 'border-gray-300'}`}>
                      {formData.paymentMethod === 'cash' && <div className="w-2 h-2 bg-primary rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-secondary">Pay After Service</p>
                      <p className="text-[10px] text-gray-400">Cash or UPI on-site</p>
                    </div>
                    <Truck className="w-4 h-4 text-gray-300" />
                  </div>

                  {/* Wallet Payment */}
                  <div
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${walletBalance >= totalAmount
                      ? formData.paymentMethod === 'wallet'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200'
                      : 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100'
                      }`}
                    onClick={() => {
                      if (walletBalance >= totalAmount) {
                        setFormData(prev => ({ ...prev, paymentMethod: 'wallet' }));
                      } else {
                        toast.info('Insufficient wallet balance for full wallet payment.');
                      }
                    }}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.paymentMethod === 'wallet' ? 'border-primary' : 'border-gray-300'}`}>
                      {formData.paymentMethod === 'wallet' && <div className="w-2 h-2 bg-primary rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-secondary">Wallet Payment</p>
                        {walletBalance < totalAmount && (
                          <span className="text-[9px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">Insufficient</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">Pay 100% from your Raj Wallet</p>
                    </div>
                    <Wallet className="w-4 h-4 text-gray-300" />
                  </div>

                  {/* Wallet + Online Mixed */}
                  <div
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${walletBalance > 0
                      ? formData.paymentMethod === 'mixed'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200'
                      : 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100'
                      }`}
                    onClick={() => {
                      if (walletBalance > 0) {
                        setFormData(prev => ({ ...prev, paymentMethod: 'mixed' }));
                      } else {
                        toast.info('No wallet balance available for mixed payment.');
                      }
                    }}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.paymentMethod === 'mixed' ? 'border-primary' : 'border-gray-300'}`}>
                      {formData.paymentMethod === 'mixed' && <div className="w-2 h-2 bg-primary rounded-full" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-secondary">Wallet + Online Payment</p>
                        {walletBalance <= 0 && (
                          <span className="text-[9px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">₹0 Balance</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {walletBalance > 0 && walletBalance < totalAmount
                          ? `Use ₹${walletBalance} from wallet + pay remaining online`
                          : 'Combine wallet balance with online payment'}
                      </p>
                    </div>
                    <div className="flex gap-0.5 text-gray-300">
                      <Wallet className="w-3.5 h-3.5" />
                      <Plus className="w-2 h-2 mt-1" />
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                {/* Mixed payment deduction details */}
                {formData.paymentMethod === 'mixed' && walletBalance > 0 && (
                  <div className="mt-3 p-3 bg-amber-50/60 border border-amber-100 rounded-xl space-y-1">
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
              </div>

              {/* Coupon Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <h3 className="font-bold text-secondary text-sm mb-2 flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-primary" />
                  Apply Coupon
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code"
                    value={formData.couponCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, couponCode: e.target.value.toUpperCase() }))}
                    className="flex-1 px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase placeholder:normal-case"
                    disabled={!!formData.appliedCoupon}
                  />
                  <button
                    onClick={applyCoupon}
                    disabled={isApplyingCoupon || !!formData.appliedCoupon || !formData.couponCode.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:bg-gray-300 transition-all active:scale-95 flex items-center justify-center min-w-[75px]"
                  >
                    {isApplyingCoupon ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      'Apply'
                    )}
                  </button>
                </div>
                {formData.appliedCoupon && (
                  <div className="mt-2 p-2 bg-green-50 rounded-lg flex justify-between items-center">
                    <span className="text-xs font-medium text-green-700">{formData.appliedCoupon.code}</span>
                    <button onClick={removeCoupon} className="text-xs text-red-500 hover:text-red-600">Remove</button>
                  </div>
                )}
                {coupons.length > 0 && !formData.appliedCoupon && (
                  <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                    {coupons.slice(0, 2).map(coupon => (
                      <div
                        key={coupon._id}
                        className="p-1.5 bg-gray-50 rounded border border-gray-100 cursor-pointer hover:border-primary transition-colors text-xs"
                        onClick={() => setFormData(prev => ({ ...prev, couponCode: coupon.code }))}
                      >
                        <span className="font-medium text-primary">{coupon.code}</span>
                        <span className="text-gray-400 ml-1">{coupon.discountType === 'percent' ? `${coupon.discountValue}% OFF` : `${formatCurrency(coupon.discountValue)} OFF`}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Booking Button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-accent text-white py-3 rounded-xl font-semibold hover:bg-accent/90 transition-all disabled:bg-gray-300 flex items-center justify-center gap-2 text-sm"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    {formData.paymentMethod === 'cash'
                      ? `Confirm Booking • ${formatCurrency(totalAmount)}`
                      : formData.paymentMethod === 'wallet'
                        ? `Pay via Wallet • ${formatCurrency(totalAmount)}`
                        : `Pay ${formatCurrency(totalAmount)}`}
                  </>
                )}
              </button>

              {/* Security & Trust Badges */}
              <div className="flex justify-center gap-4 text-xs text-gray-400 pt-2">
                <div className="flex items-center gap-1"><Lock className="w-3 h-3" /> Secure</div>
                <div className="flex items-center gap-1"><Shield className="w-3 h-3" /> Protected</div>
                <div className="flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Easy Cancel</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default BookService;
