const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/\S+@\S+\.\S+/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: function () { return !this.authProvider || this.authProvider === 'email'; }
  },
  password: {
    type: String,
    required: function () { return !this.authProvider || this.authProvider === 'email'; },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  // Firebase / OAuth fields
  firebaseUid: { type: String, sparse: true, index: true },
  authProvider: {
    type: String,
    enum: ['email', 'google', 'phone'],
    default: 'email'
  },
  // Refresh token sessions (max 5 per user)
  refreshTokens: [{
    tokenHash: { type: String, required: true },
    deviceId: { type: String },
    fingerprint: { type: String },
    ipHash: { type: String },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    isValid: { type: Boolean, default: true }
  }],
  // Known devices
  deviceIds: [{
    deviceId: { type: String },
    fingerprint: { type: String },
    platform: { type: String },
    userAgent: { type: String },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
    isTrusted: { type: Boolean, default: true }
  }],
  // Login history (capped at 20)
  loginHistory: [{
    timestamp: { type: Date, default: Date.now },
    ip: { type: String },
    userAgent: { type: String },
    deviceId: { type: String },
    method: { type: String, enum: ['email', 'google', 'refresh'] },
    success: { type: Boolean, default: true },
    suspiciousFlag: { type: Boolean, default: false }
  }],
  lastLoginIp: { type: String },
  lastLoginAt: { type: Date },
  suspiciousScore: { type: Number, default: 0 },
  biometricEnabled: { type: Boolean, default: false },
  providerAuthStatus: { type: String },
  role: {
    type: String,
    default: 'customer',
    immutable: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
  },
  firstBookingUsed: {
    type: Boolean,
    default: false
  },
  totalBookings: {
    type: Number,
    default: 0
  },
  profilePicUrl: String,
  customDiscount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  fcmTokens: [{
    token: { type: String, required: true },
    deviceId: { type: String, required: true },
    lastActive: { type: Date, default: Date.now }
  }],
  wallet: {
    availableBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRefunded: {
      type: Number,
      default: 0
    },
    walletTransactions: [
      {
        type: {
          type: String,
          enum: ['credit', 'debit'],
          required: true
        },
        amount: {
          type: Number,
          required: true
        },
        reason: {
          type: String,
          required: true
        },
        booking: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Booking',
          default: null
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  metadata: {
    ip: String,
    device: String,
    userAgent: String,
    lastLogin: Date
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: String
}, {
  timestamps: true
});

// Additional indexes for commonly queried fields
userSchema.index({ role: 1 });
userSchema.index({ createdAt: -1 });


// Password hash (skip for Firebase users with no password)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate short-lived access token (15 min)
userSchema.methods.generateJWT = function () {
  return jwt.sign(
    { id: this._id, email: this.email, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

// Alias for clarity
userSchema.methods.generateAccessToken = userSchema.methods.generateJWT;

// Generate & store a hashed refresh token
userSchema.methods.generateRefreshToken = function (deviceInfo = {}) {
  const raw = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Remove expired / invalid tokens and cap at 5 sessions
  this.refreshTokens = (this.refreshTokens || [])
    .filter(t => t.isValid && t.expiresAt > new Date())
    .slice(-4); // keep last 4, we'll push the new one

  this.refreshTokens.push({
    tokenHash,
    deviceId: deviceInfo.deviceId || '',
    fingerprint: deviceInfo.fingerprint || '',
    ipHash: deviceInfo.ipHash || '',
    userAgent: deviceInfo.userAgent || '',
    expiresAt,
    isValid: true
  });

  return { raw, expiresAt };
};

const User = mongoose.model('User', userSchema);
module.exports = User;