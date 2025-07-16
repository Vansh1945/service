import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import { toast } from 'react-toastify';

const BookService = () => {
  const { serviceId } = useParams();
  const { state } = useLocation();
  const { user, token, API, showToast } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [addresses, setAddresses] = useState([]);
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
    couponCode: '',
    paymentMethod: 'cod',
    providerId: state?.providerId || '',
    price: state?.price || 0
  });

  const [couponApplied, setCouponApplied] = useState(null);
  const [finalPrice, setFinalPrice] = useState(state?.price || 0);
  const [couponLoading, setCouponLoading] = useState(false);

  // Time slots for booking
  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00', 
    '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  // Enhanced fetch service details with error handling
  const fetchService = async () => {
    try {
      if (!serviceId) {
        throw new Error('Service ID is missing');
      }
      
      const response = await axios.get(`${API}/service/services/${serviceId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      if (!response.data || !response.data.success) {
        throw new Error('Service data not found');
      }
      
      const serviceData = response.data.data || response.data;
      setService(serviceData);
      return serviceData;
    } catch (err) {
      console.error('Error fetching service:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load service';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Enhanced fetch user profile with error handling
 const fetchUserProfile = async () => {
  try {
    if (!token) {
      throw new Error('Authentication token missing');
    }
    
    const response = await axios.get(`${API}/customer/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.data) {
      throw new Error('User profile data not found');
    }
    
    // Handle different possible response structures
    const userData = response.data.data || response.data;
    
    // Ensure we're getting addresses properly
    const userAddresses = userData.addresses || 
                         userData.user?.addresses || 
                         (userData.user && Array.isArray(userData.user) ? userData.user.addresses : []);
    
    return {
      ...userData,
      addresses: userAddresses
    };
  } catch (err) {
    console.error('Error fetching user profile:', err);
    const errorMessage = err.response?.data?.message || err.message || 'Failed to load user profile';
    setError(errorMessage);
    throw new Error(errorMessage);
  }
};

  // Improved data fetching with proper error handling
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Verify serviceId exists before making requests
        if (!serviceId) {
          throw new Error('Service ID is missing from URL');
        }

        // Check if user is authenticated
        if (!token) {
          showToast('Please login to book a service', 'error');
          navigate('/login');
          return;
        }

        const [serviceData, profileData] = await Promise.all([
          fetchService(),
          fetchUserProfile()
        ]);

        const userAddresses = profileData.user?.addresses || profileData.addresses || [];
        setAddresses(userAddresses);
        
        // Calculate initial price (prioritize state price, then service base price)
        const initialPrice = state?.price || serviceData.basePrice || serviceData.price || 0;
        setFinalPrice(initialPrice);
        
        setFormData(prev => ({
          ...prev,
          price: initialPrice,
          providerId: state?.providerId || serviceData.providerId || serviceData.provider || '',
          addressId: userAddresses.length > 0 ? userAddresses[0]._id : ''
        }));
        
      } catch (err) {
        console.error('Error in fetchData:', err);
        const errorMessage = err.message || 'Failed to load data';
        setError(errorMessage);
        showToast(errorMessage, 'error');
        
        // Don't navigate immediately, let user see the error
        setTimeout(() => {
          navigate('/customer/services');
        }, 3000);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [serviceId, token, API, navigate, showToast, state?.price, state?.providerId]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  // Handle custom address changes
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
    setFormData(prev => ({ ...prev, date }));
  };

  // Apply coupon code with enhanced validation
const applyCoupon = async () => {
  if (!formData.couponCode.trim()) {
    showToast('Please enter a coupon code', 'error');
    return;
  }

  try {
    setCouponLoading(true);
    
    // Ensure we have the necessary data
    if (!serviceId || !formData.price) {
      throw new Error('Service information is incomplete');
    }

    const requestData = { 
      couponCode: formData.couponCode.trim(), 
      serviceId, 
      amount: formData.price 
    };

    const response = await axios.post(
      `${API}/coupon/coupons/available`,
      requestData,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Handle different response structures
    const responseData = response.data.data || response.data;
    
    if (!responseData || responseData.success === false) {
      throw new Error(responseData?.message || 'Invalid coupon code');
    }

    if (typeof responseData.finalAmount === 'undefined') {
      throw new Error('Invalid coupon response - missing final amount');
    }

    setCouponApplied(responseData);
    setFinalPrice(responseData.finalAmount);
    showToast('Coupon applied successfully!', 'success');
  } catch (err) {
    console.error('Coupon application error:', err);
    const errorMessage = err.response?.data?.message || err.message || 'Invalid coupon code';
    showToast(errorMessage, 'error');
    
    // Reset coupon state on error
    setCouponApplied(null);
    setFinalPrice(formData.price);
  } finally {
    setCouponLoading(false);
  }
};

  // Remove coupon
  const removeCoupon = () => {
    setCouponApplied(null);
    setFinalPrice(formData.price);
    setFormData(prev => ({ ...prev, couponCode: '' }));
    showToast('Coupon removed', 'info');
  };

  // Validate form before submission
  const validateForm = () => {
    if (!formData.date) {
      showToast('Please select a date', 'error');
      return false;
    }

    if (!formData.time) {
      showToast('Please select a time', 'error');
      return false;
    }

    if (!formData.useCustomAddress && !formData.addressId) {
      showToast('Please select an address', 'error');
      return false;
    }

    if (formData.useCustomAddress) {
      const { street, city, state, postalCode } = formData.customAddress;
      if (!street.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
        showToast('Please fill all address fields', 'error');
        return false;
      }
    }

    if (!formData.paymentMethod) {
      showToast('Please select a payment method', 'error');
      return false;
    }

    return true;
  };

  // Handle form submission with validation
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      
      // Prepare booking data
      const bookingData = {
        serviceId,
        providerId: formData.providerId,
        date: formData.date.toISOString().split('T')[0],
        time: formData.time,
        notes: formData.notes.trim() || undefined,
        paymentMethod: formData.paymentMethod,
        price: finalPrice
      };

      // Add coupon if applied
      if (couponApplied && formData.couponCode) {
        bookingData.couponCode = formData.couponCode.trim();
      }

      // Add address
      if (formData.useCustomAddress) {
        bookingData.address = {
          street: formData.customAddress.street.trim(),
          city: formData.customAddress.city.trim(),
          state: formData.customAddress.state.trim(),
          postalCode: formData.customAddress.postalCode.trim(),
          country: formData.customAddress.country.trim()
        };
      } else {
        const selectedAddress = addresses.find(addr => addr._id === formData.addressId);
        if (selectedAddress) {
          bookingData.address = selectedAddress;
        }
      }

      // Make API call
      const response = await axios.post(
        `${API}/booking`,
        bookingData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.data || (!response.data._id && !response.data.data?._id)) {
        throw new Error('Invalid booking response');
      }

      const bookingId = response.data._id || response.data.data._id;
      showToast('Booking created successfully!', 'success');
      navigate(`/customer/booking-confirmation/${bookingId}`);
    } catch (err) {
      console.error('Booking submission error:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create booking';
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading service details...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 text-xl mb-4">{error}</div>
        <button 
          onClick={() => navigate('/customer/services')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
        >
          Back to Services
        </button>
      </div>
    );
  }

  // Service not found state
  if (!service) {
    return (
      <div className="text-center py-8">
        <div className="text-xl mb-4">Service not found</div>
        <button 
          onClick={() => navigate('/customer/services')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
        >
          Browse Available Services
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="text-blue-500 hover:text-blue-700 mb-2"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold">Book {service.title}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Service Summary */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <img
              src={service.image || service.imageUrl || '/placeholder-service.jpg'}
              alt={service.title}
              className="w-20 h-20 object-cover rounded-md mr-4"
              onError={(e) => {
                e.target.src = '/placeholder-service.jpg';
              }}
            />
            <div>
              <h2 className="text-xl font-semibold">{service.title}</h2>
              <p className="text-gray-600">{service.category}</p>
              {service.description && (
                <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                  {service.description}
                </p>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between mb-2">
              <span>Base Price:</span>
              <span className="font-medium">₹{(service.basePrice || service.price || 0).toFixed(2)}</span>
            </div>

            {couponApplied && (
              <div className="flex justify-between mb-2 text-green-600">
                <span>Discount ({couponApplied.couponCode}):</span>
                <span>-₹{(formData.price - finalPrice).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-lg mt-4 pt-2 border-t">
              <span>Total:</span>
              <span className="text-blue-600">₹{finalPrice.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Booking Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Booking Details</h2>

          {/* Date Picker */}
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Select Date *</label>
            <DatePicker
              selected={formData.date}
              onChange={handleDateChange}
              minDate={new Date()}
              maxDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)} // 30 days from now
              className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              dateFormat="MMMM d, yyyy"
              required
              placeholderText="Select a date"
            />
          </div>

          {/* Time Picker */}
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Select Time *</label>
            <select
              name="time"
              value={formData.time}
              onChange={handleChange}
              className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select a time slot</option>
              {timeSlots.map(time => (
                <option key={time} value={time}>
                  {time} ({new Date(`1970-01-01T${time}:00`).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })})
                </option>
              ))}
            </select>
          </div>

          {/* Address Selection */}
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Service Address *</label>

            <div className="mb-3">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={!formData.useCustomAddress}
                  onChange={() => setFormData({ ...formData, useCustomAddress: false })}
                  className="mr-2"
                />
                <span>Use saved address</span>
              </label>
            </div>

            {!formData.useCustomAddress && (
              <select
                name="addressId"
                value={formData.addressId}
                onChange={handleChange}
                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required={!formData.useCustomAddress}
              >
                <option value="">Select an address</option>
                {addresses.map(address => (
                  <option key={address._id} value={address._id}>
                    {address.street}, {address.city}, {address.state} - {address.postalCode}
                  </option>
                ))}
              </select>
            )}

            {addresses.length === 0 && !formData.useCustomAddress && (
              <p className="text-amber-600 text-sm mt-1">
                No saved addresses found. Please add an address or use custom address.
              </p>
            )}

            <div className="mt-3">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={formData.useCustomAddress}
                  onChange={() => setFormData({ ...formData, useCustomAddress: true })}
                  className="mr-2"
                />
                <span>Use custom address</span>
              </label>
            </div>

            {formData.useCustomAddress && (
              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  name="street"
                  placeholder="Street Address *"
                  value={formData.customAddress.street}
                  onChange={handleAddressChange}
                  className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    name="city"
                    placeholder="City *"
                    value={formData.customAddress.city}
                    onChange={handleAddressChange}
                    className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="text"
                    name="state"
                    placeholder="State *"
                    value={formData.customAddress.state}
                    onChange={handleAddressChange}
                    className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    name="postalCode"
                    placeholder="Postal Code *"
                    value={formData.customAddress.postalCode}
                    onChange={handleAddressChange}
                    className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="text"
                    name="country"
                    placeholder="Country"
                    value={formData.customAddress.country}
                    onChange={handleAddressChange}
                    className="w-full p-3 border rounded-md bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled
                  />
                </div>
              </div>
            )}
          </div>

          {/* Coupon Code */}
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Coupon Code (Optional)</label>
            <div className="flex">
              <input
                type="text"
                name="couponCode"
                value={formData.couponCode}
                onChange={handleChange}
                className="flex-1 p-3 border rounded-l-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!!couponApplied}
                placeholder="Enter coupon code"
              />
              {couponApplied ? (
                <button
                  type="button"
                  onClick={removeCoupon}
                  className="bg-red-500 text-white px-4 py-3 rounded-r-md hover:bg-red-600 transition"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponLoading || !formData.couponCode.trim()}
                  className="bg-blue-500 text-white px-4 py-3 rounded-r-md hover:bg-blue-600 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {couponLoading ? 'Applying...' : 'Apply'}
                </button>
              )}
            </div>
            {couponApplied && (
              <p className="text-green-600 text-sm mt-1">
                {couponApplied.discountType === 'percentage'
                  ? `${couponApplied.discountValue}% off`
                  : `₹${couponApplied.discountValue} off`} applied successfully!
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="mb-4">
            <label className="block text-gray-700 font-medium mb-2">Payment Method *</label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border rounded-md hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={formData.paymentMethod === 'cod'}
                  onChange={handleChange}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium">Cash on Delivery (COD)</span>
                  <p className="text-sm text-gray-600">Pay when the service is completed</p>
                </div>
              </label>
              <label className="flex items-center p-3 border rounded-md hover:bg-gray-50">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="online"
                  checked={formData.paymentMethod === 'online'}
                  onChange={handleChange}
                  className="mr-3"
                />
                <div>
                  <span className="font-medium">Online Payment</span>
                  <p className="text-sm text-gray-600">Pay now using UPI/Card/Wallet</p>
                </div>
              </label>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="mb-6">
            <label className="block text-gray-700 font-medium mb-2">Additional Notes (Optional)</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="3"
              placeholder="Any special instructions for the service provider..."
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition text-lg font-medium"
          >
            {submitting ? 'Processing...' : `Confirm Booking (₹${finalPrice.toFixed(2)})`}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BookService;