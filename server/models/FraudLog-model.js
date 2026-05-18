const mongoose = require('mongoose');

const fraudLogSchema = new mongoose.Schema({
  ip: {
    type: String,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'userModel', // Can populate either User or Provider
    index: true
  },
  userModel: {
    type: String,
    enum: ['User', 'Provider', 'Admin']
  },
  role: {
    type: String,
    enum: ['customer', 'provider', 'admin']
  },
  device: {
    type: String, // SHA-256 fingerprint hash
    index: true
  },
  deviceDetails: {
    userAgent: String,
    screenResolution: String,
    timezone: String,
    language: String,
    platform: String,
    hardwareConcurrency: Number,
    deviceMemory: Number
  },
  actionType: {
    type: String,
    enum: ['registration', 'login', 'failed_login', 'otp_request', 'cancellation'],
    required: true,
    index: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    index: true
  },
  fraudScore: {
    type: Number,
    default: 0
  },
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW'
  },
  isFlagged: {
    type: Boolean,
    default: false
  },
  flagReason: String,
  isSafe: {
    type: Boolean,
    default: false
  },
  notes: [{
    note: String,
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['pending_review', 'investigated', 'safe', 'suspended'],
    default: 'pending_review'
  }
}, {
  timestamps: true
});

// Indexes for query optimization
fraudLogSchema.index({ createdAt: -1 });
fraudLogSchema.index({ ip: 1, createdAt: -1 });
fraudLogSchema.index({ device: 1, createdAt: -1 });
fraudLogSchema.index({ actionType: 1, createdAt: -1 });

// TTL Index to cleanup logs older than 90 days automatically (7776000 seconds)
fraudLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const FraudLog = mongoose.model('FraudLog', fraudLogSchema);
module.exports = FraudLog;
