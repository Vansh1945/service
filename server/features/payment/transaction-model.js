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
    default: 'pending',
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  },
  currency: {
    type: String,
    default: 'INR'
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'netbanking', 'wallet', 'upi', 'emi', 'cash', 'online', 'mixed', 'bank_transfer', 'system'],
    default: 'online',

  },
  type: {
    type: String,
    enum: [
      'payment', 'refund', 'referralreward', 'penalty', 'commissiondeduction',
      'withdrawal', 'withdrawalrejection', 'refundrecovery', 'wallet_topup',
      'settlement', 'cashback', 'adjustment', 'escrow_hold', 'escrow_release',
      'referral_coupon_subsidy'
    ],
    default: 'payment',
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
  },
  ledgerType: {
    type: String,
    enum: ['payment', 'wallet', 'refund', 'withdrawal', 'commission', 'settlement', 'adjustment', 'referral'],
    default: 'payment'
  },
  entryType: {
    type: String,
    enum: ['debit', 'credit'],
    default: 'credit'
  },
  idempotencyKey: {
    type: String,
    sparse: true
  },
  balanceBefore: {
    type: Number,
    default: null
  },
  balanceAfter: {
    type: Number,
    default: null
  },
  complaint: {
    type: Schema.Types.ObjectId,
    ref: 'Complaint',
    default: null
  },
  approvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  recoveryType: {
    type: String,
    enum: ['wallet', 'heldearnings', 'pendingrelease', 'available', 'platformcreditreserve', 'platformabsorbed'],
    default: null,
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  },
  deductionType: {
    type: String,
    default: null
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpayPayoutId: {
    type: String
  },
  razorpaySignature: String,
  razorpayResponse: Object,
  razorpaySettlementId: String,
  settlementBatchId: String,
  settlementStatus: {
    type: String,
    enum: ['authorized', 'captured', 'queued', 'processing', 'settled', 'failed', 'reversed', 'refunded', 'partial_refund', 'disputed'],
    default: 'settled',
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
  },
  gatewayFee: {
    type: Number,
    default: 0
  },
  gatewayTax: {
    type: Number,
    default: 0
  },
  settlementAmount: {
    type: Number,
    default: 0
  },
  netSettlementAmount: {
    type: Number,
    default: 0
  },
  bankReference: String,
  bankAccountReceived: {
    type: Boolean,
    default: true
  },
  settlementDate: Date,
  reconciledAt: Date,
  description: String,
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'completed'],
    default: 'none',
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
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
      const { SystemConfig } = require('../system-setting/system-setting-model');
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
transactionSchema.index({ razorpayPayoutId: 1 }, { unique: true, sparse: true });
transactionSchema.index({ booking: 1, type: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;