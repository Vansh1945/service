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
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  referredBy: {
    type: String,
    trim: true
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
    method: { type: String, enum: ['email', 'google', 'phone', 'refresh'] },
    success: { type: Boolean, default: true },
    suspiciousFlag: { type: Boolean, default: false }
  }],
  lastLoginIp: { type: String },
  lastLoginAt: { type: Date },
  suspiciousScore: { type: Number, default: 0 },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },

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
    country: { type: String, default: 'India' },
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    s2CellId: { type: String, index: true, default: null },
    s2CellIdPrecise: { type: String, index: true, default: null },
    addressLine: String,
    houseNumber: String,
    road: String,
    landmark: String,
    area: String,
    pincode: String,
    formattedAddress: String
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    s2CellId: { type: String, index: true, default: null },
    s2CellIdPrecise: { type: String, index: true, default: null },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  // Zone tracking fields
  currentZone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone', default: null
  },
  zoneUpdatedAt: {
    type: Date,
    default: null
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
  fcmDevices: [{
    token: { type: String, required: true },
    deviceId: { type: String, required: true },
    platform: { type: String },
    lastActive: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    appVersion: { type: String }
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
        source: {
          type: String,
          default: null
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
  suspensionReason: String,
  favoriteProviders: [{
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Provider',
      required: true
    },
    providerName: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    lastBookedAt: {
      type: Date,
      default: null
    }
  }],
  lastSeen: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Additional indexes for commonly queried fields
userSchema.index({ role: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ currentLocation: '2dsphere' });


// Password hash (skip for Firebase users with no password)
userSchema.pre('save', async function (next) {
  // Populate S2 cell fields on creation or coordinate modifications
  if (this.isModified('address.lat') || this.isModified('address.lng') || this.isNew) {
    try {
      const { latLngToS2CellId } = require('../utils/s2Helper');
      if (this.address && typeof this.address.lat === 'number' && typeof this.address.lng === 'number') {
        this.address.s2CellId = latLngToS2CellId(this.address.lat, this.address.lng, 13);
        this.address.s2CellIdPrecise = latLngToS2CellId(this.address.lat, this.address.lng, 20);
      }
    } catch (s2Err) {
      console.error('Error computing user address S2 cells in pre-save:', s2Err);
    }
  }

  if (this.isModified('currentLocation.coordinates')) {
    try {
      const { latLngToS2CellId } = require('../utils/s2Helper');
      if (this.currentLocation && this.currentLocation.coordinates && this.currentLocation.coordinates.length === 2) {
        const lng = this.currentLocation.coordinates[0];
        const lat = this.currentLocation.coordinates[1];
        if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
          this.currentLocation.s2CellId = latLngToS2CellId(lat, lng, 13);
          this.currentLocation.s2CellIdPrecise = latLngToS2CellId(lat, lng, 20);
        }
      }
    } catch (s2Err) {
      console.error('Error computing user currentLocation S2 cells in pre-save:', s2Err);
    }
  }

  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate short-lived access token (dynamic expiry)
userSchema.methods.generateJWT = function (sessionTimeoutHours = 24) {
  return jwt.sign(
    { id: this._id, email: this.email, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: `${sessionTimeoutHours}h` }
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