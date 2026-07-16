import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';
import { ArrowLeft, CheckCircle, Plus, Minus, Tag, Clock, Shield, Lock, Star, IndianRupee, Truck, RotateCcw, CalendarDays, CreditCard, Wallet, MapPin, AlertTriangle } from 'lucide-react';
import AddressSelector from '../../components/AddressSelector';
import Loader from '../../components/ui-skeletons/Loader';
import Processing from '../../components/ui-skeletons/Processing';
import { getPublicServiceById } from '../../services/ServiceService';
import { getAvailableCoupons, applyCoupon as applyCouponAPI } from '../../services/CouponService';
import { createBooking, getBookingEstimate } from '../../services/BookingService';
import { resolveActiveSurcharges } from '../../services/SurgeService';
import { calculateSurchargeAmount, getMergedPrice } from '../../utils/surge';
import * as CustomerService from '../../services/CustomerService';
import { formatCurrency, formatTime } from '../../utils/format';

const BookService = () => {
  const { serviceId } = useParams();
  const { token, user, systemSettings } = useAuth();
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
  const [detectedZoneId, setDetectedZoneId] = useState(null);
  const [zoneAncestry, setZoneAncestry] = useState([]);
  const [outsideServiceArea, setOutsideServiceArea] = useState(false);

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
    paymentMethod: 'online',
    isEmergency: false,
    isInstant: false
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

  // Get next N days based on settings
  const getNext3Days = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDays = [];
    const maxDays = systemSettings?.bookingSettings?.maxBookingDays || 3;
    for (let i = 0; i < maxDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      nextDays.push(date);
    }
    return nextDays;
  };

  const availableDates = getNext3Days();
  const maxDate = availableDates[availableDates.length - 1];

  // Generate time slots based on settings
  const generateTimeSlotsForDate = (targetDate) => {
    const slots = [];
    const now = new Date();
    const isToday = targetDate.toDateString() === now.toDateString();

    const startTimeSetting = systemSettings?.bookingSettings?.startTime || "09:00";
    const endTimeSetting = systemSettings?.bookingSettings?.endTime || "21:00";
    const interval = systemSettings?.bookingSettings?.slotInterval || 30;

    const [startH, startM] = startTimeSetting.split(':').map(Number);
    const [endH, endM] = endTimeSetting.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // For today, slot must be at least 1 hour in the future
    const minAllowedMinutes = isToday ? (now.getHours() * 60 + now.getMinutes() + 60) : 0;

    for (let m = startMinutes; m <= endMinutes; m += interval) {
      if (isToday && m < minAllowedMinutes) continue;
      const hh = Math.floor(m / 60);
      const mm = m % 60;
      const timeStr = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
      slots.push({
        display: formatTime(timeStr),
        value: timeStr
      });
    }

    return slots;
  };

  const generateTimeSlots = () => {
    return generateTimeSlotsForDate(formData.date);
  };

  const timeSlots = generateTimeSlots();

  // Auto-switch to the next day if the currently selected date has no slots
  useEffect(() => {
    if (service && systemSettings) {
      const todaySlots = generateTimeSlotsForDate(formData.date);
      if (todaySlots.length === 0) {
        const dates = getNext3Days();
        for (const d of dates) {
          if (generateTimeSlotsForDate(d).length > 0) {
            setFormData(prev => ({
              ...prev,
              date: d,
              time: ''
            }));
            break;
          }
        }
      }
    }
  }, [service, systemSettings]);


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
      toast.error(err.response?.data?.message || err.message || 'Failed to apply coupon');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const [pricingEstimate, setPricingEstimate] = useState(null);

  // Fetch pricing estimate from backend
  useEffect(() => {
    const fetchEstimate = async () => {
      try {
        let lat = null;
        let lng = null;

        if (formData.useCustomAddress) {
          lat = formData.customAddress.lat;
          lng = formData.customAddress.lng;
        } else if (addresses.length > 0) {
          const selectedAddr = addresses.find(a => a._id === formData.addressId) || addresses[0];
          lat = selectedAddr?.lat;
          lng = selectedAddr?.lng;
        }

        // If custom address but coordinates aren't set yet, do not trigger outside area alert
        if (formData.useCustomAddress && (!lat || !lng)) {
          setOutsideServiceArea(false);
          return;
        }

        const estimatePayload = {
          serviceId,
          quantity: formData.quantity,
          couponCode: formData.appliedCoupon?.code || undefined,
          date: formData.date,
          time: formData.time || undefined,
          lat,
          lng,
          isEmergency: !!formData.isEmergency,
          isInstant: !!formData.isInstant
        };

        const response = await getBookingEstimate(estimatePayload);
        if (response.data?.success) {
          setPricingEstimate(response.data.data || null);
          const zoneId = response.data.data?.detectedZoneId || null;
          setDetectedZoneId(zoneId);
          setOutsideServiceArea(!zoneId);
        } else {
          setOutsideServiceArea(true);
        }
      } catch (err) {
        console.error("Error fetching pricing estimate:", err);
        setOutsideServiceArea(true);
      }
    };

    if (service) {
      fetchEstimate();
    }
  }, [
    formData.date,
    formData.time,
    formData.customAddress.lat,
    formData.customAddress.lng,
    addresses,
    formData.addressId,
    formData.useCustomAddress,
    service,
    formData.quantity,
    formData.appliedCoupon,
    formData.isEmergency,
    formData.isInstant
  ]);

  // Calculate surcharges
  const calculateSurcharges = () => {
    if (!pricingEstimate) return { totalSurcharge: 0, breakdowns: [] };
    const breakdowns = (pricingEstimate.surchargeBreakdown || []).map((s, idx) => ({
      id: s.chargeType || idx,
      name: s.chargeType === 'platform' ? 'Platform Fee' : `${s.chargeType.charAt(0).toUpperCase() + s.chargeType.slice(1)} Surcharge`,
      amount: s.amount,
      mode: s.mode,
      value: s.value
    }));
    return {
      totalSurcharge: pricingEstimate.totalSurcharge || 0,
      breakdowns
    };
  };

  // Calculate discount
  const calculateDiscount = () => {
    return pricingEstimate ? pricingEstimate.totalDiscount : 0;
  };

  const calculateTotal = () => {
    return pricingEstimate ? pricingEstimate.totalAmount : 0;
  };

  const getVisitingAndAdditionalCharges = () => {
    if (!pricingEstimate) return { visiting: 0, additional: 0 };
    return {
      visiting: pricingEstimate.visitingCharge || 0,
      additional: (pricingEstimate.rainCharge || 0) +
        (pricingEstimate.trafficCharge || 0) +
        (pricingEstimate.nightCharge || 0) +
        (pricingEstimate.emergencySurge || 0)
    };
  };

  const getCustomerPricingBreakdown = () => {
    if (!pricingEstimate) return {
      mergedServicePrice: 0,
      visiting: 0,
      platformFee: 0,
      additional: 0,
      additionalBreakdown: [],
      demand: 0
    };

    const localBaseAmount = pricingEstimate.subtotal || 0;
    const demand = pricingEstimate.demandSurge || 0;
    const mergedServicePrice = localBaseAmount + demand;

    const additionalBreakdown = [];
    if (pricingEstimate.rainCharge > 0) additionalBreakdown.push({ name: 'Rain Charge', amount: pricingEstimate.rainCharge });
    if (pricingEstimate.trafficCharge > 0) additionalBreakdown.push({ name: 'Traffic Charge', amount: pricingEstimate.trafficCharge });
    if (pricingEstimate.nightCharge > 0) additionalBreakdown.push({ name: 'Night Charge', amount: pricingEstimate.nightCharge });
    if (pricingEstimate.emergencySurge > 0) additionalBreakdown.push({ name: 'Emergency Surcharge', amount: pricingEstimate.emergencySurge });

    return {
      mergedServicePrice,
      visiting: pricingEstimate.visitingCharge || 0,
      platformFee: pricingEstimate.platformFee || 0,
      additional: (pricingEstimate.rainCharge || 0) +
        (pricingEstimate.trafficCharge || 0) +
        (pricingEstimate.nightCharge || 0) +
        (pricingEstimate.emergencySurge || 0),
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

        const [serviceData, addressesData, profileData] = await Promise.all([
          fetchService(),
          fetchUserAddresses(),
          CustomerService.getProfile().then(res => res.data?.user).catch(() => null)
        ]);

        setService(serviceData);
        setAddresses(addressesData);
        if (profileData?.wallet) {
          setWalletBalance(profileData.wallet.availableBalance || 0);
        }

        // Fetch initial surcharges immediately to avoid rendering delays
        let initialLat = null;
        let initialLng = null;
        if (prefillBooking?.address?.lat && prefillBooking?.address?.lng) {
          initialLat = prefillBooking.address.lat;
          initialLng = prefillBooking.address.lng;
        } else if (addressesData.length > 0) {
          initialLat = addressesData[0].lat;
          initialLng = addressesData[0].lng;
        }

        const params = {
          subtotal: serviceData ? serviceData.basePrice : undefined
        };
        if (initialLat && initialLng) {
          params.lat = initialLat;
          params.lng = initialLng;
        }

        try {
          const surgeRes = await resolveActiveSurcharges(params);
          if (surgeRes.data?.success) {
            setActiveSurcharges(surgeRes.data.data || []);
            setDetectedZoneId(surgeRes.data.zoneId || null);
            setZoneAncestry(surgeRes.data.zoneAncestry || []);
          }
        } catch (surgeErr) {
          console.error("Initial surcharges load failed:", surgeErr);
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
    if (!user?.phone) {
      toast.error('Please update your mobile number in your profile before placing a booking.');
      return false;
    }

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

    if (!detectedZoneId) {
      toast.error('Service is currently unavailable at this address. Please select another location.');
      return false;
    }

    if (formData.paymentMethod === 'wallet' && walletBalance < calculateTotal()) {
      toast.error('Insufficient wallet balance for full wallet payment.');
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
        preferredProviderId: (bookingPreference === 'favorite' && selectedFavoriteProviderId) ? selectedFavoriteProviderId : null,
        bookingType: formData.isEmergency ? 'emergency' : (formData.isInstant ? 'instant' : 'scheduled'),
        isEmergency: !!formData.isEmergency,
        isInstant: !!formData.isInstant,
        trustedProviderOnly: !!formData.isEmergency
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
  const baseAmount = (service?.discountPrice || service?.basePrice) * (formData.quantity || 1) || 0;
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
        {/* Out of Service Zone Alert */}
        {outsideServiceArea && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-800 animate-fade-in mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-700">Outside Service Area</h4>
              <p className="text-[10.5px] text-amber-700/90 leading-relaxed mt-0.5">
                We currently do not operate in this location. Please choose a different service address to continue.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column - Booking Form */}
          <div className="lg:col-span-8 space-y-5">
            {/* Service Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex gap-5">
                <div className="flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden bg-gray-100 relative">
                  <img
                    src={service.images?.[0] || 'https://placehold.co/400x400?text=No+Image'}
                    alt={service.title}
                    className="w-full h-full object-cover"
                    onError={(e) => e.target.src = 'https://placehold.co/400x400?text=No+Image'}
                  />
                  {(service.serviceType && service.serviceType !== 'standard') && (
                    <span className={`absolute bottom-1 left-1 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider text-white ${service.serviceType === 'emergency' ? 'bg-red-500' : 'bg-purple-600'
                      }`}>
                      {service.serviceType}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-lg mb-1">
                        {typeof service.category === 'object' ? service.category.name : service.category}
                      </span>
                      {service.isFeatured && (
                        <span className="ml-1.5 inline-block text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                          ★ Featured
                        </span>
                      )}
                      <h2 className="text-base font-extrabold text-secondary">{service.title}</h2>
                    </div>
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold text-secondary text-sm">{service.averageRating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>

                  {service.shortDescription ? (
                    <p className="text-gray-500 text-xs mt-1 italic">"{service.shortDescription}"</p>
                  ) : (
                    <p className="text-gray-500 text-xs mt-1 line-clamp-2">{service.description}</p>
                  )}

                  {service.warranty?.duration && (
                    <div className="text-[10px] text-indigo-600 font-semibold mt-1">
                      🛡️ {service.warranty.duration} {service.warranty.unit} Warranty
                    </div>
                  )}


                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 font-medium">
                    <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" />{service.duration} hrs</div>
                    {getCustomerPricingBreakdown().visiting > 0 ? (
                      <div className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-primary" />
                        Visiting Fee: {formatCurrency(getCustomerPricingBreakdown().visiting / formData.quantity)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-primary" />
                        Free Visit
                      </div>
                    )}
                  </div>

                  <div className="mt-2">
                    <div className="flex items-baseline gap-1.5">
                      {service.discountPrice ? (
                        <>
                          <span className="text-lg font-black text-green-600">
                            {formatCurrency(getMergedPrice(service.discountPrice, activeSurcharges))}
                          </span>
                          <span className="text-xs line-through text-gray-400 font-normal">
                            {formatCurrency(getMergedPrice(service.basePrice, activeSurcharges))}
                          </span>
                        </>
                      ) : (
                        <span className="text-lg font-black text-primary">
                          {formatCurrency(getMergedPrice(service.basePrice, activeSurcharges))}
                        </span>
                      )}
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
                {/* Booking Type Selector */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                  {/* Scheduled Card */}
                  <div
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        isEmergency: false,
                        isInstant: false
                      }));
                    }}
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between ${
                      (!formData.isEmergency && !formData.isInstant)
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    {(!formData.isEmergency && !formData.isInstant) && (
                      <div className="absolute top-2 right-2 bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📅</span>
                        <h4 className="text-sm font-bold text-secondary">Scheduled Booking</h4>
                      </div>
                      <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">
                        Choose your preferred date and time.
                      </p>
                    </div>
                    <div className="mt-3">
                      <span className="inline-block bg-primary/10 text-primary text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Recommended
                      </span>
                    </div>
                  </div>

                  {/* Instant Card */}
                  <div
                    onClick={() => {
                      const nextDate = new Date();
                      const slots = generateTimeSlotsForDate(nextDate);
                      const nextTime = (slots.length > 0) ? slots[0].value : '';
                      setFormData(prev => ({
                        ...prev,
                        isEmergency: false,
                        isInstant: true,
                        date: nextDate,
                        time: nextTime
                      }));
                    }}
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between ${
                      formData.isInstant
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    {formData.isInstant && (
                      <div className="absolute top-2 right-2 bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">⚡</span>
                        <h4 className="text-sm font-bold text-secondary">Instant Booking</h4>
                      </div>
                      <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">
                        Get connected with the nearest available electrician.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                        60–90 mins
                      </span>
                    </div>
                  </div>

                  {/* Emergency Card */}
                  <div
                    onClick={() => {
                      const nextDate = new Date();
                      const slots = generateTimeSlotsForDate(nextDate);
                      const nextTime = (slots.length > 0) ? slots[0].value : '';
                      setFormData(prev => ({
                        ...prev,
                        isEmergency: true,
                        isInstant: false,
                        date: nextDate,
                        time: nextTime
                      }));
                    }}
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between ${
                      formData.isEmergency
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    {formData.isEmergency && (
                      <div className="absolute top-2 right-2 bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🚨</span>
                        <h4 className="text-sm font-bold text-secondary">Emergency Booking</h4>
                      </div>
                      <p className="text-[11px] text-gray-500 font-semibold leading-relaxed">
                        Priority assistance for urgent electrical issues.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                        30–60 mins
                      </span>
                      <span className="inline-block bg-red-100 text-red-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                        Priority
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dynamic Booking Section */}
                {(!formData.isEmergency && !formData.isInstant) && (
                  <div className="grid grid-cols-2 gap-4 animate-fade-in relative z-20">
                    <div className="relative z-30">
                      <label className="block text-sm font-semibold text-secondary mb-1.5">Select Date</label>
                      <DatePicker
                        selected={formData.date}
                        onChange={handleDateChange}
                        minDate={new Date()}
                        maxDate={maxDate}
                        dateFormat="dd/MM/yyyy"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        popperClassName="!z-[9999]"
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
                )}

                {formData.isInstant && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-sm animate-fade-in space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-250/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <span className="text-xl">⚡</span>
                        <div>
                          <h4 className="text-sm font-bold text-blue-900">Instant Booking</h4>
                          <p className="text-xs text-blue-850/90 leading-relaxed mt-1">
                            We'll connect you with the nearest available electrician as quickly as possible.
                          </p>
                        </div>
                      </div>
                      <div className="bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-right shrink-0">
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700">Estimated Arrival</p>
                        <p className="text-xs font-black">60–90 mins</p>
                      </div>
                    </div>
                    
                    <div className="border-t border-blue-200/60 pt-2">
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-blue-800/90 font-medium">
                        <li className="flex items-center gap-2">
                          <span className="text-blue-500">•</span> Fast service
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-blue-500">•</span> Nearest available verified electrician
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="text-blue-500">•</span> Standard service charges apply
                        </li>
                      </ul>
                    </div>
                  </div>
                )}


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
                  {getCustomerPricingBreakdown().platformFee > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 flex items-center gap-1 group relative cursor-pointer">
                        Platform Fee
                        <span className="text-gray-400 hover:text-gray-600 font-semibold text-[10px]">ⓘ</span>
                        <span className="absolute bottom-full left-0 mb-2 w-48 hidden group-hover:block bg-gray-900 text-white text-[10px] p-2 rounded shadow-lg z-50 text-left font-normal leading-tight">
                          Platform Fee is non-refundable as it covers secure transaction processing and platform operational costs.
                        </span>
                      </span>
                      <span className="text-secondary font-semibold">
                        +{formatCurrency(getCustomerPricingBreakdown().platformFee)}
                      </span>
                    </div>
                  )}
                  {getCustomerPricingBreakdown().additional > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">
                        {formData.isEmergency ? "Emergency Charges" : "Additional Service Charges"}
                      </span>
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
                  {(systemSettings === null || systemSettings?.bookingSettings?.allowCOD !== false) && (
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
                  )}

                  {/* Wallet Payment */}
                  <div
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.paymentMethod === 'wallet'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200'
                      }`}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, paymentMethod: 'wallet' }));
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
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all ${formData.paymentMethod === 'mixed'
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200'
                      }`}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, paymentMethod: 'mixed' }));
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

                {/* Wallet Balance Warning Banners */}
                {formData.paymentMethod === 'wallet' && walletBalance < totalAmount && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 animate-fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red-800">Insufficient Wallet Balance</p>
                      <p className="text-[11px] text-red-600 font-medium leading-relaxed mt-0.5">
                        Your wallet balance is insufficient to cover the total booking amount. You need an additional <span className="font-bold">{formatCurrency(totalAmount - walletBalance)}</span> to complete this payment using your wallet.
                      </p>
                    </div>
                  </div>
                )}

                {formData.paymentMethod === 'mixed' && walletBalance <= 0 && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 animate-fade-in">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red-800">No Wallet Balance Available</p>
                      <p className="text-[11px] text-red-600 font-medium leading-relaxed mt-0.5">
                        Your wallet balance is ₹0. Mixed payment requires a positive wallet balance. Please add funds to your wallet or choose another payment method.
                      </p>
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
                  <Processing
                    type="button"
                    onClick={applyCoupon}
                    disabled={!!formData.appliedCoupon || !formData.couponCode.trim()}
                    loading={isApplyingCoupon}
                    loadingText="Applying..."
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:bg-gray-300 transition-all active:scale-95 flex items-center justify-center min-w-[75px]"
                  >
                    Apply
                  </Processing>
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
              <Processing
                onClick={handleSubmit}
                loading={isSubmitting}
                loadingText="Processing..."
                disabled={!detectedZoneId || isSubmitting}
                className="w-full bg-accent hover:bg-accent/95 text-white py-3.5 rounded-xl font-extrabold shadow-md shadow-accent/10 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs uppercase tracking-wider disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-4 h-4" />
                {formData.paymentMethod === 'cash'
                  ? `Confirm Booking • ${formatCurrency(totalAmount)}`
                  : formData.paymentMethod === 'wallet'
                    ? `Pay via Wallet • ${formatCurrency(totalAmount)}`
                    : `Pay ${formatCurrency(totalAmount)}`}
              </Processing>

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
