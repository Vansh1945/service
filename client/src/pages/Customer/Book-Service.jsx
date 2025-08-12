import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaCheckCircle, FaPlus, FaMinus, FaMapMarkerAlt, FaTag } from 'react-icons/fa';

const BookService = () => {
  const { serviceId } = useParams();
  const { user, token, API } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [service, setService] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [coupons, setCoupons] = useState([]);
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingCoupons, setIsFetchingCoupons] = useState(false);

  // Generate time slots from 8 AM to 8 PM
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour;
      const timeString = `${displayHour.toString().padStart(2, '0')}:00 ${period}`;
      slots.push({
        display: timeString,
        value: `${hour.toString().padStart(2, '0')}:00`
      });
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

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

  // Fetch available coupons
  const fetchAvailableCoupons = async () => {
    setIsFetchingCoupons(true);
    try {
      const response = await axios.get(`${API}/coupon/coupons/available`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCoupons(response.data.data || []);
    } catch (err) {
      console.error('Error fetching coupons:', err);
      toast.error('Failed to load available coupons');
      setCoupons([]);
    } finally {
      setIsFetchingCoupons(false);
    }
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

        // Set default to custom address if no saved addresses exist
        setFormData(prev => ({
          ...prev,
          useCustomAddress: addressesData.length === 0
        }));

      } catch (err) {
        console.error('Initialization error:', err);
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
        appliedCoupon: null // Reset coupon when quantity changes
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
    setFormData(prev => ({ ...prev, date, appliedCoupon: null }));
  };

  // Apply coupon
  const applyCoupon = async () => {
    if (!formData.couponCode.trim() || !service) {
      toast.error('Please enter a coupon code');
      return;
    }

    try {
      const response = await axios.post(
        `${API}/coupon/coupons/apply`,
        {
          code: formData.couponCode,
          bookingValue: service.basePrice * formData.quantity
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Invalid coupon');
      }

      setFormData(prev => ({
        ...prev,
        appliedCoupon: response.data.data
      }));

      toast.success('Coupon applied successfully!');
    } catch (err) {
      console.error('Coupon error:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to apply coupon');
    }
  };

  // Remove coupon
  const removeCoupon = () => {
    setFormData(prev => ({
      ...prev,
      couponCode: '',
      appliedCoupon: null
    }));
  };

  // Calculate total amount
  const calculateTotal = () => {
    if (!service?.basePrice) return 0;

    const baseAmount = service.basePrice * formData.quantity;

    if (formData.appliedCoupon) {
      if (formData.appliedCoupon.discountType === 'percent') {
        return baseAmount - (baseAmount * formData.appliedCoupon.discountValue / 100);
      } else {
        return Math.max(baseAmount - formData.appliedCoupon.discountValue, 0);
      }
    }

    return baseAmount;
  };

  // Validate form
  const validateForm = () => {
    if (!service) {
      toast.error('Service information is not loaded');
      return false;
    }

    if (!formData.date) {
      toast.error('Please select a date');
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
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    const toastId = toast.loading('Processing your booking...');

    try {
      // Prepare address data
      let addressData;
      if (formData.useCustomAddress) {
        addressData = formData.customAddress;
      } else {
        if (addresses.length === 0) {
          throw new Error('No address available');
        }
        addressData = addresses[0];
      }

      // Format the date correctly (YYYY-MM-DD)
      const formattedDate = formData.date.toISOString().split('T')[0];
      const totalAmount = calculateTotal();

      const bookingData = {
        serviceId: service._id,
        date: formattedDate,
        time: formData.time,
        address: {
          street: addressData.street,
          city: addressData.city,
          state: addressData.state,
          postalCode: addressData.postalCode,
          country: addressData.country || 'India'
        },
        notes: formData.notes.trim(),
        quantity: formData.quantity,
        couponCode: formData.appliedCoupon?.code || undefined
      };

      // Create booking
      const response = await axios.post(
        `${API}/booking`,
        bookingData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create booking');
      }

      toast.update(toastId, {
        render: 'Booking created successfully!',
        type: 'success',
        isLoading: false,
        autoClose: 3000,
        closeButton: true
      });

      navigate(`/customer/booking-confirm/${response.data.data._id}`);
    } catch (err) {
      console.error('Booking error:', err);
      toast.update(toastId, {
        render: err.response?.data?.message || err.message || 'Failed to process booking',
        type: 'error',
        isLoading: false,
        autoClose: 3000,
        closeButton: true
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading || !service) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading service details...</p>
        </div>
      </div>
    );
  }

  const totalAmount = calculateTotal();
  const baseAmount = service.basePrice * formData.quantity;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors mb-6"
          >
            <FaArrowLeft className="mr-2" />
            Back to services
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Book {service.title}</h1>
          <p className="text-gray-500 mt-2">Complete your booking details below</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Service Summary Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
              <div className="flex items-start mb-6">
                <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={service.image || '/placeholder-service.jpg'}
                    alt={service.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = '/placeholder-service.jpg';
                    }}
                  />
                </div>
                <div className="ml-4">
                  <h2 className="text-lg font-semibold text-gray-900">{service.title}</h2>
                  <p className="text-sm text-gray-500 capitalize">{service.category.toLowerCase()}</p>
                  <p className="text-sm text-gray-500 mt-1">{service.duration} hours</p>
                </div>
              </div>

              <div className="space-y-4 border-t border-gray-200 pt-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Service Price:</span>
                  <span className="font-medium">₹{service.basePrice?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-medium">{formData.quantity}</span>
                </div>

                {formData.appliedCoupon && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Discount Applied:</span>
                      <span className="font-medium text-green-600">
                        {formData.appliedCoupon.discountType === 'percent'
                          ? `${formData.appliedCoupon.discountValue}%`
                          : `-₹${formData.appliedCoupon.discountValue?.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Coupon: {formData.appliedCoupon.code}</span>
                      <button
                        onClick={removeCoupon}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}

                <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                  <span className="text-gray-900">Total Amount:</span>
                  <div className="flex flex-col items-end">
                    {formData.appliedCoupon && (
                      <span className="text-sm text-gray-500 line-through">₹{baseAmount?.toFixed(2)}</span>
                    )}
                    <span className="text-blue-600 text-lg">₹{totalAmount?.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Coupon Section */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <FaTag className="mr-2 text-blue-500" />
                  Apply Coupon
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={formData.couponCode}
                    onChange={(e) => setFormData({ ...formData, couponCode: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    disabled={!!formData.appliedCoupon || isFetchingCoupons}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={!!formData.appliedCoupon || isFetchingCoupons || !formData.couponCode.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {isFetchingCoupons ? 'Checking...' : 'Apply'}
                  </button>
                </div>

                {coupons.length > 0 && !formData.appliedCoupon && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-1">Available coupons:</p>
                    <div className="space-y-2">
                      {coupons.map(coupon => (
                        <div
                          key={coupon._id}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              couponCode: coupon.code
                            }));
                          }}
                        >
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-blue-600">{coupon.code}</span>
                            <span className="text-sm font-semibold bg-green-100 text-green-800 px-2 py-1 rounded">
                              {coupon.discountType === 'percent'
                                ? `${coupon.discountValue}% OFF`
                                : `₹${coupon.discountValue} OFF`}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {coupon.description && (
                              <p className="mb-1">{coupon.description}</p>
                            )}
                            {coupon.minBookingValue > 0 && (
                              <p>Min. order: ₹{coupon.minBookingValue}</p>
                            )}
                            {coupon.expiryDate && (
                              <p>Valid until: {new Date(coupon.expiryDate).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Booking Details</h2>

              <div className="space-y-6">
                {/* Date and Time */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Booking Date *</label>
                    <DatePicker
                      selected={formData.date}
                      onChange={handleDateChange}
                      minDate={new Date()}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      dateFormat="MMMM d, yyyy"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Time Slot *</label>
                    <select
                      name="time"
                      value={formData.time}
                      onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select a time slot</option>
                      {timeSlots.map((time, index) => (
                        <option key={`time-${index}`} value={time.value}>{time.display}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange('decrement')}
                      className="px-3 py-1.5 border border-gray-300 rounded-l-lg bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={formData.quantity <= 1}
                    >
                      <FaMinus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      name="quantity"
                      min="1"
                      max="10"
                      value={formData.quantity}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value)) {
                          const clampedValue = Math.min(Math.max(value, 1), 10);
                          setFormData(prev => ({
                            ...prev,
                            quantity: clampedValue,
                            appliedCoupon: null
                          }));
                        }
                      }}
                      className="w-16 px-2 py-1.5 border-t border-b border-gray-300 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange('increment')}
                      className="px-3 py-1.5 border border-gray-300 rounded-r-lg bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={formData.quantity >= 10}
                    >
                      <FaPlus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Address Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Service Address *</label>

                  <div className="space-y-4">
                    {addresses.length > 0 && (
                      <>
                        <div className="flex items-center">
                          <input
                            type="radio"
                            id="savedAddress"
                            checked={!formData.useCustomAddress}
                            onChange={() => setFormData(prev => ({ ...prev, useCustomAddress: false }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                          <label htmlFor="savedAddress" className="ml-2 block text-sm text-gray-700">
                            Use saved address
                          </label>
                        </div>

                        {!formData.useCustomAddress && (
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex items-start">
                              <div className="flex-shrink-0 mt-1">
                                <FaMapMarkerAlt className="h-5 w-5 text-gray-400" />
                              </div>
                              <div className="ml-3">
                                <p className="text-sm text-gray-700">
                                  {addresses[0].street}, {addresses[0].city}, {addresses[0].state} - {addresses[0].postalCode}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex items-center">
                      <input
                        type="radio"
                        id="customAddress"
                        checked={formData.useCustomAddress}
                        onChange={() => setFormData(prev => ({ ...prev, useCustomAddress: true }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <label htmlFor="customAddress" className="ml-2 block text-sm text-gray-700">
                        Use custom address
                      </label>
                    </div>

                    {formData.useCustomAddress && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                          <input
                            type="text"
                            id="street"
                            name="street"
                            placeholder="House no., Building, Street"
                            value={formData.customAddress.street}
                            onChange={handleAddressChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                            <input
                              type="text"
                              id="city"
                              name="city"
                              placeholder="City"
                              value={formData.customAddress.city}
                              onChange={handleAddressChange}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                            <input
                              type="text"
                              id="state"
                              name="state"
                              placeholder="State"
                              value={formData.customAddress.state}
                              onChange={handleAddressChange}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
                            <input
                              type="text"
                              id="postalCode"
                              name="postalCode"
                              placeholder="6-digit postal code"
                              value={formData.customAddress.postalCode}
                              onChange={handleAddressChange}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              pattern="\d{6}"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                            <input
                              type="text"
                              id="country"
                              name="country"
                              value={formData.customAddress.country}
                              onChange={handleAddressChange}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              disabled
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Additional Notes (Optional)</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Any special instructions for the service provider..."
                  />
                </div>

                {/* Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full flex justify-center items-center px-6 py-3.5 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <FaCheckCircle className="mr-2" />
                        Confirm Booking
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookService;