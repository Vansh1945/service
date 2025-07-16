const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createTestOrder = async (req, res) => {
  try {
    console.log('Creating test order for method:', req.body.method);
    
    const options = {
      amount: req.body.amount, // amount in paise
      currency: "INR",
      receipt: `test_${Date.now()}`,
      payment_capture: 1,
      notes: {
        test: true,
        method: req.body.method
      }
    };

    // For UPI payments, add UPI-specific options
    if (req.body.method === 'upi') {
      options.method = 'upi';
    }

    const order = await razorpay.orders.create(options);
    console.log('Order created:', order.id);
    
    res.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ 
      message: "Order creation failed",
      error: error.error ? error.error.description : error.message 
    });
  }
};

exports.verifyTestPayment = async (req, res) => {
  try {
    console.log('Verifying payment:', req.body);
    
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Generate signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('Invalid signature');
      return res.status(400).json({ valid: false, message: "Invalid signature" });
    }

    console.log('Payment verified successfully');
    res.json({ 
      valid: true,
      message: "Payment verified successfully" 
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      valid: false,
      message: "Verification failed",
      error: error.message 
    });
  }
};