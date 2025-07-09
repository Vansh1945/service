require('dotenv').config();
console.log('Key:', process.env.RAZORPAY_KEY_ID);
console.log('Secret:', process.env.RAZORPAY_KEY_SECRET ? '***loaded***' : 'missing');

const Razorpay = require('razorpay');
const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
console.log('Razorpay initialized successfully!');