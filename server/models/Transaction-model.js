const mongoose = require('mongoose');
const { Schema } = mongoose;
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const transactionSchema = new Schema({
  transactionId: {
    type: String,
    unique: true
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  bookingId: {
    type: String,
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerId: {
    type: String
  },
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider'
  },
  providerId: {
    type: String
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  commission: {
    type: Number,
    default: 0
  },
  providerEarning: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ['pending', 'success', 'failed', 'processing', 'completed', 'refunded'],
    default: 'pending'
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'netbanking', 'wallet', 'upi', 'emi', 'cash', 'online', 'UPI', 'Card', 'Cash', 'mixed'],
    default: 'online'
  },
  type: {
    type: String,
    enum: ['payment', 'refund', 'referral_reward'],
    default: 'payment'
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  razorpayResponse: Object,
  description: String,
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'completed'],
    default: 'none'
  },
  refundReason: String,
  refundedAt: Date,
  isRupees: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate transaction ID
transactionSchema.pre('save', function (next) {
  if (!this.transactionId) {
    const paymentMethodLower = this.paymentMethod?.toLowerCase();
    if (paymentMethodLower === 'wallet') {
      this.transactionId = `TXN-WLT-${Date.now()}`;
    } else if (paymentMethodLower === 'cash') {
      const suffix = this.bookingId ? this.bookingId.slice(-6) : Math.floor(Math.random() * 1000);
      this.transactionId = `CASH-${Date.now()}-${suffix}`;
    } else {
      this.transactionId = `TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
  }
  this.updatedAt = Date.now();
  next();
});

// Create Razorpay order
transactionSchema.statics.createRazorpayOrder = async function (amount, currency, receipt, notes) {
  let finalCurrency = currency;
  if (!finalCurrency) {
    try {
      const { SystemConfig } = require('./SystemSetting');
      const settings = await SystemConfig.findOne();
      finalCurrency = settings?.defaultCurrency || 'INR';
    } catch (e) {
      finalCurrency = 'INR';
    }
  }

  const options = {
    amount: Math.round(amount * 100), // Convert to paise
    currency: finalCurrency,
    receipt: receipt,
    payment_capture: 1,
    notes: notes
  };

  try {
    return await razorpay.orders.create(options);
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    throw new Error(err.error.description || 'Payment processing failed');
  }
};

// Verify Razorpay signature
transactionSchema.statics.verifySignature = function (orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return generatedSignature === signature;
};

// Fetch payment details
transactionSchema.statics.fetchPaymentDetails = async function (paymentId) {
  try {
    return await razorpay.payments.fetch(paymentId);
  } catch (err) {
    console.error('Error fetching payment details:', err);
    throw new Error(err.error.description || 'Failed to fetch payment details');
  }
};

// Indexes for query optimization
transactionSchema.index({ booking: 1 });
transactionSchema.index({ user: 1 });
transactionSchema.index({ provider: 1 });
transactionSchema.index({ provider: 1, createdAt: -1 });
transactionSchema.index({ paymentStatus: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
transactionSchema.index({ razorpayOrderId: 1 }, { unique: true, sparse: true });
transactionSchema.index({ booking: 1, type: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;