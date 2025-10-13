import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import { ArrowLeft, CheckCircle, Plus, Minus, Tag, Clock, Calendar, Shield, Lock, Star, IndianRupee, Truck, RotateCcw, Check, CalendarDays } from 'lucide-react';

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

  // Form state with proper initial values
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
    appliedCoupon: null
  });

  // Get next 3 days from today for date picker
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

  // Generate time slots in 12-hour format
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
      
      const timeString = `${displayHour12}:00 ${period}`;
      const backendTime = `${hour.toString().padStart(2, '0')}:00`;
      
      slots.push({
        display: timeString,
        value: backendTime,
        hour: hour
      });
    }

    if (isToday && currentMinute > 45 && slots.length > 0) {
      return slots.slice(1);
    }

    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
  };

  // Fetch service details
  const fetchService = async () => {
    try {
      const response = await axios.get(`${API}/service/services/${serviceId}`);
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
      toast.error('Failed to load your saved address');
      return [];
    }
  };

  // Fetch available coupons from backend
  const fetchAvailableCoupons = async () => {
    if (!service?.basePrice) return;

    setIsFetchingCoupons(true);
    try {
      const bookingValue = service.basePrice * (formData.quantity || 1);
      const response = await axios.get(`${API}/coupon/coupons/available?bookingValue=${bookingValue}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setCoupons(response.data.data || []);
      } else {
        throw new Error(response.data.message || 'Failed to load coupons');
      }
    } catch (err) {
      console.error('Error fetching coupons:', err);
      setCoupons([]);
    } finally {
      setIsFetchingCoupons(false);
    }
  };

  // Apply coupon function
  const applyCoupon = async () => {
    if (!formData.couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    if (!service?.basePrice) {
      toast.error('Service price not loaded yet');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/coupon/coupons/apply`,
        {
          code: formData.couponCode.trim().toUpperCase(),
          bookingValue: service.basePrice * formData.quantity
        },
        {
          headers: { Authorization: `Bearer ${token}` }
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
      console.error('Coupon error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to apply coupon');
    }
  };

  // Mark coupon as used after successful booking
  const markCouponUsed = async (couponCode, bookingValue) => {
    if (!formData.appliedCoupon) return;

    try {
      await axios.post(
        `${API}/coupon/coupons/mark-used`,
        {
          code: couponCode,
          bookingValue: bookingValue
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch (err) {
      console.error('Error marking coupon as used:', err);
    }
  };

  // Calculate discount amount based on applied coupon
  const calculateDiscount = () => {
    if (!service?.basePrice || !formData.appliedCoupon) return 0;

    const baseAmount = service.basePrice * (formData.quantity || 1);

    if (formData.appliedCoupon.discountType === 'percent') {
      return (baseAmount * formData.appliedCoupon.discountValue) / 100;
    } else {
      return Math.min(formData.appliedCoupon.discountValue, baseAmount);
    }
  };

  // Calculate total amount
  const calculateTotal = () => {
    if (!service?.basePrice) return 0;

    const baseAmount = service.basePrice * (formData.quantity || 1);
    const discount = calculateDiscount();

    return Math.max(0, baseAmount - discount);
  };

  // Format time for display (convert 24h to 12h format)
  const formatTimeForDisplay = (time24h) => {
    if (!time24h) return '';
    
    const [hours, minutes] = time24h.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
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
        console.error('Initialization error:', err);
        navigate('/services');
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [serviceId, token, API, navigate]);

  // Fetch coupons when service is loaded or quantity changes
  useEffect(() => {
    if (service) {
      fetchAvailableCoupons();
    }
  }, [service, formData.quantity]);

  // Handle form changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle quantity changes
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

  // Handle address changes
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      customAddress: {
        ...prev.customAddress,
        [name]: value
      }
    }));
  };

  // Handle date change
  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      date,
      appliedCoupon: null,
      couponCode: prev.appliedCoupon ? '' : prev.couponCode,
      time: ''
    }));
  };

  // Remove coupon
  const removeCoupon = () => {
    setFormData(prev => ({
      ...prev,
      couponCode: '',
      appliedCoupon: null
    }));
  };

  // Validate form
  const validateForm = () => {
    if (!service) {
      toast.error('Service information is not loaded');
      return false;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(formData.date);
    selectedDate.setHours(0, 0, 0, 0);

    if (!formData.date || selectedDate < today || selectedDate > maxDate) {
      toast.error('Please select a valid date within the next 3 days');
      return false;
    }

    if (!formData.time) {
      toast.error('Please select a time');
      return false;
    }

    if (!formData.useCustomAddress && addresses.length === 0) {
      toast.error('Please add an address to continue');
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
    }

    return true;
  };

  // Handle form submission
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
        if (addresses.length === 0) {
          throw new Error('No address available');
        }
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
        paymentMethod: 'online',
        subtotal: baseAmount,
        totalAmount: totalAmount
      };

      Object.keys(bookingData).forEach(key => {
        if (bookingData[key] === null || bookingData[key] === undefined) {
          delete bookingData[key];
        }
      });

      const response = await axios.post(
        `${API}/booking`,
        bookingData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create booking');
      }

      const bookingId = response.data.bookingId || response.data.data?._id;

      if (!bookingId) {
        throw new Error('Booking ID not received from server');
      }

      if (formData.appliedCoupon) {
        await markCouponUsed(formData.appliedCoupon.code, baseAmount);
      }

      toast.update(toastId, {
        render: 'Booking created successfully! Redirecting to payment...',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });

      const navigationBookingData = {
        ...response.data.data,
        _id: bookingId,
        service: service,
        couponApplied: formData.appliedCoupon,
        subtotal: baseAmount,
        totalDiscount: discountAmount,
        totalAmount: totalAmount,
        paymentStatus: 'pending',
        status: 'pending',
        date: formattedDate,
        time: formData.time,
        address: formData.useCustomAddress ? formData.customAddress : addresses[0],
        notes: formData.notes.trim(),
        quantity: formData.quantity,
        paymentMethod: 'online'
      };

      setTimeout(() => {
        navigate(`/customer/booking-confirm/${bookingId}`, {
          state: {
            booking: navigationBookingData,
            service: service,
            fromBookingPage: true,
            timestamp: Date.now()
          }
        });
      }, 1000);

    } catch (err) {
      console.error('Booking error:', err);
      
      let errorMessage = 'Failed to process booking';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout. Please check your connection and try again.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Session expired. Please login again.';
        setTimeout(() => navigate('/login'), 2000);
      } else if (err.response?.status === 400) {
        errorMessage = err.response.data?.message || 'Invalid booking data. Please check your details.';
      } else if (err.response?.status === 409) {
        errorMessage = 'This time slot is no longer available. Please select a different time.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast.update(toastId, {
        render: errorMessage,
        type: 'error',
        isLoading: false,
        autoClose: 5000
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalAmount = calculateTotal();
  const baseAmount = service?.basePrice * (formData.quantity || 1) || 0;
  const discountAmount = calculateDiscount();

  // Loading state
  if (isLoading || !service) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-secondary/70">Loading service details...</p>
        </div>
      </div>
    );
  }

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
            <span className="text-primary font-medium">Book Service</span>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-primary transition-all duration-300 bg-white px-4 py-2 rounded-xl border border-gray-200 hover:border-primary shadow-sm hover:shadow-md"
            >
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back
            </button>

            <h1 className="text-xl lg:text-2xl font-poppins font-bold text-gray-800 ml-4">
              Book {service.title}
            </h1>
          </div>
        </div>



        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Service Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-300 p-8 hover:shadow-xl transition-shadow duration-300">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex-shrink-0 w-full sm:w-48 h-48 rounded-xl overflow-hidden bg-gray-100 shadow-inner">
                  <img
                    src={service.images?.[0] || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                    alt={service.title}
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                    }}
                  />
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-xl font-poppins font-bold text-gray-900 mb-3">{service.title}</h2>
                    <div className="flex items-center space-x-4 mb-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-semibold tracking-wide">
                        {service.category}
                      </span>
                      <div className="flex items-center text-yellow-500 space-x-1">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-semibold text-gray-700">
                          {service.averageRating?.toFixed(1) || '0.0'}
                        </span>
                        {service.ratingCount > 0 && (
                          <span className="text-xs text-gray-600 ml-1">
                            ({service.ratingCount})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900 flex items-center justify-end space-x-1">
                      <IndianRupee className="w-4 h-4 mt-1" />
                      <span>{service.basePrice.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-gray-500 tracking-wide">per service</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6 text-sm text-gray-700">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span>{service.duration} hours service</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Truck className="w-4 h-4 text-primary" />
                      <span>Free Visiting</span>
                    </div>
                  </div>

                  {/* Service Features */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-3 text-base">Service Includes:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                      <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Professional service provider</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Quality assured</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>On-time service</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>Customer support</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Booking Form */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-300 p-6 hover:shadow-xl transition-shadow duration-300">
              <h2 className="text-xl font-poppins font-bold text-gray-900 mb-6 flex items-center">
                <CalendarDays className="mr-3 text-primary w-5 h-5" />
                Booking Details
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Date and Time */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Date *
                    </label>
                    <DatePicker
                      selected={formData.date}
                      onChange={handleDateChange}
                      minDate={new Date()}
                      maxDate={maxDate}
                      dateFormat="dd/MM/yyyy"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                      placeholderText="Select a date"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Time Slot *
                    </label>
                    {timeSlots.length === 0 ? (
                      <div className="w-full px-4 py-3 border border-orange-300 rounded-lg bg-orange-50 text-orange-800 text-sm font-medium">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          No time slots available. Please choose a different service date.
                        </div>
                      </div>
                    ) : (
                      <select
                        value={formData.time}
                        onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                      >
                        <option value="">Select a time</option>
                        {timeSlots.map((time, index) => (
                          <option key={index} value={time.value}>
                            {time.display}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Quantity
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-0 bg-gray-50 rounded-xl border border-gray-200">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange('decrement')}
                        className="px-4 py-3 text-gray-600 hover:text-primary hover:bg-white rounded-l-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={formData.quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="px-4 py-3 min-w-12 text-center font-semibold text-gray-800 border-l border-r border-gray-200">
                        {formData.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange('increment')}
                        className="px-4 py-3 text-gray-600 hover:text-primary hover:bg-white rounded-r-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={formData.quantity >= 10}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-sm text-gray-500">
                      Maximum 10 services per booking
                    </span>
                  </div>
                </div>

                {/* Address Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">
                    Delivery Address
                  </label>

                  <div className="space-y-4">
                    {addresses.length > 0 && (
                      <div className="flex items-start space-x-3 p-4 rounded-xl border-2 border-gray-200 hover:border-primary/50 transition-colors duration-200">
                        <input
                          type="radio"
                          id="savedAddress"
                          checked={!formData.useCustomAddress}
                          onChange={() => setFormData(prev => ({ ...prev, useCustomAddress: false }))}
                          className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                        />
                        <div className="flex-1">
                          <label htmlFor="savedAddress" className="block text-sm font-medium text-gray-800 mb-1">
                            Saved Address
                          </label>
                          <p className="text-sm text-gray-600">
                            {addresses[0].street}, {addresses[0].city}, {addresses[0].state} - {addresses[0].postalCode}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start space-x-3 p-4 rounded-xl border-2 border-gray-200 hover:border-primary/50 transition-colors duration-200">
                      <input
                        type="radio"
                        id="customAddress"
                        checked={formData.useCustomAddress}
                        onChange={() => setFormData(prev => ({ ...prev, useCustomAddress: true }))}
                        className="mt-1 h-4 w-4 text-primary focus:ring-primary"
                      />
                      <div className="flex-1">
                        <label htmlFor="customAddress" className="block text-sm font-medium text-gray-800 mb-3">
                          New Address
                        </label>
                        
                        {formData.useCustomAddress && (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Street Address *</label>
                              <input
                                type="text"
                                name="street"
                                value={formData.customAddress.street}
                                onChange={handleAddressChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                                placeholder="House no., Building, Street"
                                required
                              />
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                                <input
                                  type="text"
                                  name="city"
                                  value={formData.customAddress.city}
                                  onChange={handleAddressChange}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                                  placeholder="City"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                                <input
                                  type="text"
                                  name="state"
                                  value={formData.customAddress.state}
                                  onChange={handleAddressChange}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                                  placeholder="State"
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code *</label>
                                <input
                                  type="text"
                                  name="postalCode"
                                  value={formData.customAddress.postalCode}
                                  onChange={handleAddressChange}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                                  placeholder="6-digit postal code"
                                  pattern="\d{6}"
                                  maxLength="6"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                                <input
                                  type="text"
                                  name="country"
                                  value={formData.customAddress.country}
                                  onChange={handleAddressChange}
                                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200"
                                  disabled
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Additional Instructions (Optional)
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 resize-none"
                    rows="3"
                    placeholder="Any special instructions for the service provider..."
                  />
                </div>
              </form>
            </div>
          </div>

          {/* Right Column - Price Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg border border-gray-300 sticky top-6 hover:shadow-xl transition-shadow duration-300">
              {/* Price Summary */}
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-poppins font-bold text-gray-900 mb-4 flex items-center">
                  <IndianRupee className="mr-2 text-primary w-5 h-5" />
                  Price Details
                </h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Price ({formData.quantity} item{formData.quantity > 1 ? 's' : ''})</span>
                    <span className="text-gray-800">₹{baseAmount.toFixed(2)}</span>
                  </div>
                  
                  {formData.appliedCoupon && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="text-green-600 font-medium">-₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Visiting Charges</span>
                    <span className="text-gray-800">FREE</span>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-3">
                    <div className="flex justify-between text-base font-bold">
                      <span className="text-gray-800">Total Amount</span>
                      <span className="text-gray-800">₹{totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Coupon Section */}
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-poppins font-bold text-gray-900 mb-4 flex items-center">
                  <Tag className="mr-2 text-primary w-5 h-5" />
                  Apply Coupon
                </h3>
                
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={formData.couponCode}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        couponCode: e.target.value.toUpperCase() 
                      }))}
                      className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 uppercase text-sm"
                      disabled={!!formData.appliedCoupon || isFetchingCoupons}
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={!!formData.appliedCoupon || isFetchingCoupons || !formData.couponCode.trim()}
                      className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
                    >
                      {isFetchingCoupons ? '...' : 'Apply'}
                    </button>
                  </div>

                  {formData.appliedCoupon && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-green-800 text-sm">
                          {formData.appliedCoupon.code} Applied
                        </span>
                        <button
                          onClick={removeCoupon}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-1 text-xs text-green-600">
                        {formData.appliedCoupon.discountType === 'percent' ? (
                          <span>{formData.appliedCoupon.discountValue}% OFF</span>
                        ) : (
                          <span>₹{formData.appliedCoupon.discountValue} OFF</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Available Coupons */}
                  {coupons.length > 0 && !formData.appliedCoupon && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">Available coupons:</p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {coupons.map(coupon => (
                          <div
                            key={coupon._id}
                            className="p-2 bg-gray-50 rounded border border-gray-200 cursor-pointer hover:border-primary transition-colors duration-200"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                couponCode: coupon.code
                              }));
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-primary text-sm">{coupon.code}</span>
                              <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded">
                                {coupon.discountType === 'percent'
                                  ? `${coupon.discountValue}% OFF`
                                  : `₹${coupon.discountValue} OFF`}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              <div>Expiry: {formatDate(coupon.expiryDate)}</div>
                              <div>Min Booking: ₹{coupon.minBookingValue}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Security & Payment */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary/50 transition-colors duration-200">
                    <Lock className="w-4 h-4 text-primary mr-2" />
                    <span className="text-sm font-semibold text-gray-800">SSL Secure</span>
                  </div>
                  <div className="flex items-center justify-center p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary/50 transition-colors duration-200">
                    <Shield className="w-4 h-4 text-primary mr-2" />
                    <span className="text-sm font-semibold text-gray-800">Protected</span>
                  </div>
                </div>

                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="w-full flex justify-center items-center px-6 py-4 rounded-lg shadow-lg text-base font-bold text-white bg-accent hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent transition-all duration-300 disabled:bg-gray-400 disabled:cursor-not-allowed hover:shadow-xl"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 w-5 h-5" />
                      Pay ₹{totalAmount.toFixed(2)}
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center mt-2">
                  You will be redirected to secure payment page
                </p>
              </div>

              {/* Trust Badges */}
              <div className="p-6 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="flex flex-col items-center p-3 rounded-lg bg-gray-50 hover:bg-primary/5 transition-colors duration-200">
                    <Shield className="w-6 h-6 text-primary mb-2" />
                    <span className="text-sm font-semibold text-gray-800">100% Secure</span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg bg-gray-50 hover:bg-primary/5 transition-colors duration-200">
                    <RotateCcw className="w-6 h-6 text-primary mb-2" />
                    <span className="text-sm font-semibold text-gray-800">Easy Cancellation</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookService;