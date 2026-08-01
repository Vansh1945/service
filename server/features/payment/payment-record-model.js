// models/PaymentRecord-model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const paymentRecordSchema = new Schema({
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: true
  },
  admin: {
    type: Schema.Types.ObjectId,
    ref: 'Admin'
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking'
  },
  // Withdraw amount
  amount: {
    type: Number,
    required: true,
    min: 0
  },

  // Net amount = same as amount (no commission)
  netAmount: {
    type: Number,
    required: true,
    min: 0
  },

  // Payment method selected for withdrawal
  paymentMethod: {
    type: String,
    enum: ['banktransfer', 'upi', 'neft', 'rtgs', 'other'],
    set: function (v) {
      if (!v) return v;
      const clean = v.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (clean === 'banktransfer') return 'banktransfer';
      return clean;
    }
  },

  // Provider ke model ke bankDetails se sync hoga
  paymentDetails: {
    accountNumber: String,
    accountName: String,
    ifscCode: String,
    upiId: String,
    bankName: String
  },



  // New fields for withdrawal types and admin approval details
  utrNo: {
    type: String
  },
  transferDate: {
    type: Date
  },
  transferTime: {
    type: String
  },
  withdrawalType: {
    type: String,
    enum: ['manualbulk', 'manual_bulk', 'razorpayx'],
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
  },


  status: {
    type: String,
    enum: ['requested', 'underreview', 'approved', 'transferred', 'completed', 'failed', 'processing', 'rejected'],
    default: 'requested',
    set: function (v) {
      if (!v) return v;
      const clean = v.toLowerCase().replace(/[^a-z0-9]/g, '');
      const wMap = {
        'under_review': 'underreview'
      };
      return wMap[clean] || clean;
    }
  },

  rejectionReason: String,
  adminRemark: String,

  processedAt: Date,
  completedAt: Date,

  transactionReference: {
    type: String,
    unique: true,
    sparse: true
  },

  // Future RazorpayX Integration Fields
  razorpayPayoutId: {
    type: String,
    sparse: true,
    index: true
  },
  razorpayStatus: {
    type: String,
    default: null
  },
  razorpayResponse: {
    type: Schema.Types.Mixed,
    default: null
  },
  payoutMode: {
    type: String,
    enum: ['IMPS', 'NEFT', 'RTGS', 'UPI', 'CARD', ''],
    default: ''
  },

  notes: String,

  // Enterprise operational fields
  retryCount: {
    type: Number,
    default: 0
  },
  lastError: {
    type: String,
    default: null
  },
  isHeld: {
    type: Boolean,
    default: false
  },
  holdReason: {
    type: String,
    default: null
  },

  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date
}, {
  timestamps: true
});

// Indexes
paymentRecordSchema.index({ provider: 1, status: 1 });
paymentRecordSchema.index({ createdAt: -1 });

// Static method: Get provider withdrawal records with pagination
paymentRecordSchema.statics.getProviderRecords = async function (providerId, page = 1, limit = 10) {
  return this.find({ provider: providerId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('admin', 'name email');
};

module.exports = mongoose.model('PaymentRecord', paymentRecordSchema);
