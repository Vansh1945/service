import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ArrowLeft, CheckCircle, Plus, Minus, Tag, Clock, Calendar, Shield, Lock, Star, IndianRupee, Truck, RotateCcw, Check, CalendarDays, CreditCard } from 'lucide-react';
import AddressSelector from '../../components/AddressSelector';
import Loader from '../../components/Loader';
import { getPublicServiceById } from '../../services/ServiceService';
import { getAvailableCoupons } from '../../services/CouponService';
import { createBooking } from '../../services/BookingService';

const BookService = () => {
  const { serviceId } = useParams();
  const { user, token, API } = useAuth();
  const navigate = useNavigate();

  // State declarations
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingCoupons, setIsFetchingCoupons] = useState(false);
  const [service, setService] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [coupons, setCoupons] = useState([]);

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
      country: 'India'
    },
    useCustomAddress: false,
    notes: '',
    quantity: 1,
    couponCode: '',
    appliedCoupon: null,
    paymentMethod: 'online'
  });

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
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour;
      const displayHour12 = displayHour === 0 ? 12 : displayHour;

      slots.push({
        display: `${displayHour12}:00 ${period}`,
        value: `${hour.toString().padStart(2, '0')}:00`
      });
    }

    if (isToday && currentMinute > 45 && slots.length > 0) {
      return slots.slice(1);
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

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
      const response = await axios.get(`${API}/customer/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const response = await getAvailableCoupons({ bookingValue });

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

    try {
      const response = await applyCoupon(
        {
          code: formData.couponCode.trim().toUpperCase(),
          bookingValue: service.basePrice * formData.quantity
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
    }
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
    return Math.max(0, baseAmount - discount);
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

        const [serviceData, addressesData] = await Promise.all([
          fetchService(),
          fetchUserAddresses()
        ]);

        setService(serviceData);
        setAddresses(addressesData);

        setFormData(prev => ({
          ...prev,
          useCustomAddress: addressesData.length === 0
        }));
      } catch (err) {
        navigate('/services');
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [serviceId, token]);

  // Fetch coupons when service or quantity changes
  useEffect(() => {
    if (service) {
      fetchAvailableCoupons();
    }
  }, [service, formData.quantity]);

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

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      customAddress: { ...prev.customAddress, [name]: value }
    }));
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
      const { street, city, state, postalCode } = formData.customAddress;
      if (!street?.trim() || !city?.trim() || !state?.trim() || !postalCode?.trim()) {
        toast.error('Please fill all address fields');
        return false;
      }
      if (!/^\d{6}$/.test(postalCode.trim())) {
        toast.error('Please enter a valid 6-digit postal code');
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
      const discountAmount = calculateDiscount();
      const totalAmount = calculateTotal();

      const bookingData = {
        serviceId: service._id,
        date: formattedDate,
        time: formData.time,
        address: {
          street: addressData.street.trim(),
          city: addressData.city.trim(),
          state: addressData.state.trim(),
          postalCode: addressData.postalCode.trim(),
          country: addressData.country || 'India'
        },
        notes: formData.notes.trim(),
        quantity: formData.quantity,
        couponCode: formData.appliedCoupon?.code || null,
        paymentMethod: formData.paymentMethod,
        subtotal: baseAmount,
        totalAmount: totalAmount
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
                      <IndianRupee className="w-3.5 h-3.5 text-secondary" />
                      <span className="text-xl font-bold text-primary">{service.basePrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

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

                {/* Address Selection */}
                <div>
                  <label className="block text-sm font-semibold text-secondary mb-2">Service Address</label>
                  <div className="space-y-2">
                    {addresses.length > 0 && (
                      <div className="flex items-start gap-2 p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => setFormData(prev => ({ ...prev, useCustomAddress: false }))}>
                        <input
                          type="radio"
                          checked={!formData.useCustomAddress}
                          readOnly
                          className="mt-0.5 w-3.5 h-3.5 text-primary"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-secondary">Saved Address</p>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            {addresses[0]?.street}, {addresses[0]?.city}, {addresses[0]?.state} - {addresses[0]?.postalCode}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start gap-2 p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setFormData(prev => ({ ...prev, useCustomAddress: true }))}>
                      <input
                        type="radio"
                        checked={formData.useCustomAddress}
                        readOnly
                        className="mt-0.5 w-3.5 h-3.5 text-primary"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-secondary">New Address</p>
                        {formData.useCustomAddress && (
                          <div className="mt-4 space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-secondary mb-1.5">
                                Street Address *
                              </label>
                              <input
                                type="text"
                                name="street"
                                placeholder="E.g. House No. 123, Sector 45"
                                value={formData.customAddress.street}
                                onChange={handleAddressChange}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <AddressSelector
                                  selectedState={formData.customAddress.state}
                                  selectedCity={formData.customAddress.city}
                                  onStateChange={(state) => setFormData(prev => ({
                                    ...prev,
                                    customAddress: { ...prev.customAddress, state, city: '' }
                                  }))}
                                  onCityChange={(city) => setFormData(prev => ({
                                    ...prev,
                                    customAddress: { ...prev.customAddress, city }
                                  }))}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-secondary mb-1.5">
                                  Pincode *
                                </label>
                                <input
                                  type="text"
                                  name="postalCode"
                                  placeholder="6-digit Pincode"
                                  value={formData.customAddress.postalCode}
                                  onChange={handleAddressChange}
                                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                                  maxLength="6"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
                    <span className="text-gray-500">Price ({formData.quantity} item)</span>
                    <span className="text-secondary font-medium">₹{baseAmount.toFixed(2)}</span>
                  </div>
                  {formData.appliedCoupon && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Discount</span>
                      <span className="text-green-600 font-medium">-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Visiting Charges</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  <div className="border-t border-gray-100 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-secondary text-sm">Total</span>
                      <span className="font-bold text-primary text-base">₹{totalAmount.toFixed(2)}</span>
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
                <div className="grid grid-cols-1 gap-2">
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
                </div>
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
                    disabled={!!formData.appliedCoupon || !formData.couponCode.trim()}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:bg-gray-300 transition-all active:scale-95"
                  >
                    Apply
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
                        <span className="text-gray-400 ml-1">{coupon.discountType === 'percent' ? `${coupon.discountValue}% OFF` : `₹${coupon.discountValue} OFF`}</span>
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
                    {formData.paymentMethod === 'cash' ? `Confirm Booking • ₹${totalAmount.toFixed(2)}` : `Pay ₹${totalAmount.toFixed(2)}`}
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