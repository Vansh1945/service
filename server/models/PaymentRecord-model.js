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
    enum: ['bank_transfer', 'upi', 'neft', 'rtgs', 'other'],
  },

  // Provider ke model ke bankDetails se sync hoga
  paymentDetails: {
    accountNumber: String,
    accountName: String,
    ifscCode: String,
    upiId: String,
    bankName: String
  },

  transactionReference: {
    type: String // Admin approve karne ke baad fill hoga
  },

  status: {
    type: String,
    enum: ['requested', 'processing', 'completed', 'failed', 'rejected'],
    default: 'requested'
  },

  rejectionReason: String,
  adminRemark: String,

  processedAt: Date,
  completedAt: Date,

  notes: String,

  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date
}, {
  timestamps: true
});

// Indexes
paymentRecordSchema.index({ provider: 1 });
paymentRecordSchema.index({ status: 1 });
paymentRecordSchema.index({ createdAt: 1 });

// Static method: Get provider withdrawal records with pagination
paymentRecordSchema.statics.getProviderRecords = async function(providerId, page = 1, limit = 10) {
  return this.find({ provider: providerId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('admin', 'name email');
};

module.exports = mongoose.model('PaymentRecord', paymentRecordSchema);
