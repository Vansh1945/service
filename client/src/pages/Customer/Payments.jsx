import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const TestAllPayments = () => {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('card');
  const testAmount = 1; // ₹1 test payment

  // Use your actual test key here or from environment variables
  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_TEST_KEY';

  useEffect(() => {
    const loadRazorpay = () => {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          console.log('Razorpay already loaded');
          return resolve(true);
        }
        
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        
        script.onload = () => {
          console.log('Razorpay script loaded successfully');
          resolve(true);
        };
        
        script.onerror = () => {
          console.error('Failed to load Razorpay script');
          resolve(false);
        };
        
        document.body.appendChild(script);
      });
    };

    loadRazorpay();
  }, []);

  const testPayment = async () => {
    setLoading(true);
    try {
      if (!window.Razorpay) {
        throw new Error('Payment gateway not loaded. Please refresh the page.');
      }

      const { data } = await axios.post('http://localhost:5000/api/test-payment', {
        amount: testAmount * 100,
        method
      });

      const options = {
        key: razorpayKey, // Use the key directly
        amount: data.amount,
        currency: "INR",
        name: "Payment Tester",
        description: `Test ${method} payment`,
        order_id: data.id,
        handler: function(response) {
          console.log('Payment success:', response);
          verifyPayment(response);
        },
        prefill: {
          name: "Test User",
          email: "test@example.com",
          contact: "9876543210"
        },
        theme: {
          color: "#3399cc"
        }
      };

      // Special handling for UPI
      if (method === 'upi') {
        options.method = 'upi';
      }

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function(response) {
        console.error('Payment failed:', response.error);
        toast.error(`Payment failed: ${response.error.description}`);
      });

      rzp.open();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (response) => {
    try {
      await axios.post('http://localhost:5000/api/verify-payment', response);
      toast.success("Payment verified!");
    } catch (error) {
      toast.error("Payment verification failed");
    }
  };

  const paymentMethods = [
    { id: 'card', name: 'Credit/Debit Card', test: '4111 1111 1111 1111' },
    { id: 'netbanking', name: 'Netbanking', test: 'Select "TEST BANK"' },
    { id: 'upi', name: 'UPI', test: 'success@razorpay' },
    { id: 'wallet', name: 'Wallet', test: 'Select "TEST WALLET"' },
    { id: 'emi', name: 'EMI', test: 'Use test card' }
  ];

  return (
    <div className="payment-tester">
      <h2>Test All Payment Methods (₹{testAmount})</h2>
      
      <div className="method-selector">
        <label>Payment Method:</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          {paymentMethods.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <button onClick={testPayment} disabled={loading}>
        {loading ? 'Processing...' : `Test ${method} Payment`}
      </button>

      <div className="test-info">
        <h3>Test Instructions:</h3>
        <ul>
          {paymentMethods.map(m => (
            <li key={m.id} className={method === m.id ? 'active' : ''}>
              <strong>{m.name}:</strong> {m.test}
            </li>
          ))}
          <li>CVV: 123 | Expiry: Any future date</li>
        </ul>
      </div>
    </div>
  );
};

export default TestAllPayments;