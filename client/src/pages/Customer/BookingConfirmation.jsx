import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import axios from 'axios';
import { toast } from 'react-toastify';

const Payment = () => {
  const { token, user, isAuthenticated, API, showToast } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [bookingDetails, setBookingDetails] = useState(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(true);

  // Get booking details from location state
  useEffect(() => {
    if (!location.state?.booking) {
      showToast('No booking details found', 'error');
      navigate('/book-service');
      return;
    }
    setBookingDetails(location.state.booking);
    setIsLoadingBooking(false);
  }, [location.state]);

  // Load Razorpay script
  useEffect(() => {
    if (paymentMethod === 'online') {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [paymentMethod]);

  const handleCashPayment = async () => {
    try {
      setLoading(true);
      if (!bookingDetails?._id) {
        showToast('Invalid booking details', 'error');
        return;
      }
      
      const response = await axios.put(
        `${API}/booking/${bookingDetails._id}/status`,
        { status: 'accepted', paymentMethod: 'cash' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast('Booking confirmed with cash payment!');
      navigate('/booking-confirmed', { 
        state: { 
          booking: response.data.data,
          paymentMethod: 'cash' 
        } 
      });
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to confirm booking', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOnlinePayment = async () => {
    try {
      setLoading(true);
      
      if (!bookingDetails?._id || !bookingDetails?.totalAmount) {
        showToast('Invalid booking details', 'error');
        return;
      }

      const orderResponse = await axios.post(
        `${API}/transaction/create-order`,
        {
          bookingId: bookingDetails._id,
          amount: bookingDetails.totalAmount,
          paymentMethod: 'online'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { order, key, transactionId } = orderResponse.data.data;

      const options = {
        key: key,
        amount: order.amount,
        currency: order.currency,
        name: 'Your Service App',
        description: `Booking for ${bookingDetails?.services?.[0]?.service?.title || 'service'}`,
        image: '/logo.png',
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

            showToast('Payment successful! Booking confirmed.');
            navigate('/booking-confirmed', { 
              state: { 
                booking: verifyResponse.data.data.booking,
                paymentMethod: 'online',
                transaction: verifyResponse.data.data.transaction
              } 
            });
          } catch (error) {
            showToast('Payment verification failed', 'error');
            console.error('Payment verification error:', error);
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || ''
        },
        notes: {
          bookingId: bookingDetails._id,
          userId: user?._id || ''
        },
        theme: {
          color: '#3399cc'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      
      rzp.on('payment.failed', function (response) {
        showToast('Payment failed. Please try again.', 'error');
        console.error('Payment failed:', response.error);
      });

    } catch (error) {
      showToast(error.response?.data?.message || 'Payment initialization failed', 'error');
      console.error('Payment error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingBooking || !bookingDetails) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Complete Your Booking</h1>
        
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Booking Summary</h2>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Service:</span>
              <span className="font-medium">
                {bookingDetails?.services?.[0]?.service?.title || 'Service not specified'}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">
                {new Date(bookingDetails.date).toLocaleDateString()} at {bookingDetails.time}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Address:</span>
              <span className="font-medium text-right">
                {bookingDetails.address?.street}, {bookingDetails.address?.city}
              </span>
            </div>
            <div className="border-t my-3"></div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">₹{(bookingDetails.subtotal || 0).toFixed(2)}</span>
            </div>
            {(bookingDetails.totalDiscount || 0) > 0 && (
              <div className="flex justify-between mb-2 text-green-600">
                <span>Discount:</span>
                <span>-₹{(bookingDetails.totalDiscount || 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold mt-3">
              <span>Total Amount:</span>
              <span>₹{(bookingDetails.totalAmount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Select Payment Method</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setPaymentMethod('online')}
              className={`p-4 border rounded-lg flex items-center justify-center ${paymentMethod === 'online' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            >
              <div className="mr-3">
                <input
                  type="radio"
                  checked={paymentMethod === 'online'}
                  onChange={() => {}}
                  className="h-5 w-5 text-blue-600"
                />
              </div>
              <div className="text-left">
                <h3 className="font-medium">Online Payment</h3>
                <p className="text-sm text-gray-500">Pay securely with Razorpay</p>
              </div>
            </button>
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`p-4 border rounded-lg flex items-center justify-center ${paymentMethod === 'cash' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
            >
              <div className="mr-3">
                <input
                  type="radio"
                  checked={paymentMethod === 'cash'}
                  onChange={() => {}}
                  className="h-5 w-5 text-blue-600"
                />
              </div>
              <div className="text-left">
                <h3 className="font-medium">Cash on Service</h3>
                <p className="text-sm text-gray-500">Pay after service completion</p>
              </div>
            </button>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={paymentMethod === 'online' ? handleOnlinePayment : handleCashPayment}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 flex justify-center items-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              `Confirm Booking with ${paymentMethod === 'online' ? 'Online Payment' : 'Cash'}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Payment;