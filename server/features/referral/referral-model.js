const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'referrerModel'
  },
  referrerModel: {
    type: String,
    required: true,
    enum: ['User', 'Provider']
  },
  referrerType: {
    type: String,
    required: true,
    enum: ['customer', 'provider']
  },
  referredUser: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'referredUserModel'
  },
  referredUserModel: {
    type: String,
    required: true,
    enum: ['User', 'Provider']
  },
  referredUserType: {
    type: String,
    required: true,
    enum: ['customer', 'provider']
  },
  referralCodeUsed: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'qualified', 'approved', 'released', 'rejected', 'fraudflagged', 'expired'],
    default: 'pending',
    set: function (v) {
      if (!v) return v;
      const clean = v.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rMap = {
        'fraud_flagged': 'fraudflagged'
      };
      return rMap[clean] || clean;
    }
  },
  customerRewardReleased: {
    type: Boolean,
    default: false
  },
  providerRewardMilestonesReleased: [{
    type: Number
  }],
  abuseFlags: [{
    type: String,
    enum: ['selfreferral', 'sameemail', 'samephone', 'samebankaccount', 'sameupi', 'samedevice', 'sameip'],
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  }],
  deviceInfo: {
    ip: String,
    deviceId: String,
    userAgent: String
  },
  fraudScore: {
    type: Number,
    default: 0
  },
  programVersion: {
    type: Number
  },
  source: {
    type: String,
    enum: ['link', 'manual', 'qr', 'whatsapp', 'other'],
    default: 'manual'
  },
  unlockSnapshot: {
    type: mongoose.Schema.Types.Mixed
  },
  rulesSnapshot: {
    type: mongoose.Schema.Types.Mixed
  },
  expiryDate: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
}, {
  timestamps: true
});

const referralRewardLogSchema = new mongoose.Schema({
  referral: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral',
    required: true
  },
  rewardType: {
    type: String,
    enum: ['customerreferral', 'providermilestone'],
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientModel'
  },
  recipientModel: {
    type: String,
    enum: ['User', 'Provider'],
    required: true
  },
  recipientType: {
    type: String,
    enum: ['customer', 'provider'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  details: {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    milestoneBookingsCount: Number
  },
  status: {
    type: String,
    enum: ['released', 'held'],
    default: 'released'
  },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null }
}, {
  timestamps: true
});

// Indexes for fast querying
referralSchema.index({ referrer: 1, referrerType: 1 });
referralSchema.index({ referrer: 1, referrerType: 1, status: 1, createdAt: -1 });
referralSchema.index({ referredUser: 1, referredUserType: 1 }, { unique: true });
referralSchema.index({ referralCodeUsed: 1 });
referralSchema.index({ status: 1 });

referralRewardLogSchema.index({ recipient: 1, recipientType: 1 });
referralRewardLogSchema.index({ recipient: 1, recipientType: 1, status: 1, createdAt: -1 });
referralRewardLogSchema.index({ status: 1 });
referralRewardLogSchema.index({ createdAt: -1 });

const Referral = mongoose.model('Referral', referralSchema);
const ReferralRewardLog = mongoose.model('ReferralRewardLog', referralRewardLogSchema);

module.exports = {
  Referral,
  ReferralRewardLog
};
