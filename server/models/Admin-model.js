const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const adminSchema = new mongoose.Schema({
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
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profilePicUrl: {
    type: String,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: true,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  fcmTokens: [{
    token: { type: String, required: true },
    deviceId: { type: String, required: true },
    lastActive: { type: Date, default: Date.now }
  }],
  refreshTokens: [{
    tokenHash:  { type: String, required: true },
    deviceId:   { type: String },
    ipHash:     { type: String },
    userAgent:  { type: String },
    createdAt:  { type: Date, default: Date.now },
    expiresAt:  { type: Date, required: true },
    isValid:    { type: Boolean, default: true }
  }],
  loginHistory: [{
    timestamp:     { type: Date, default: Date.now },
    ip:            { type: String },
    userAgent:     { type: String },
    deviceId:      { type: String },
    method:        { type: String, enum: ['email', 'refresh'] },
    success:       { type: Boolean, default: true }
  }],
  lastLoginIp:  { type: String },
  lastLoginAt:  { type: Date }
}, {
  timestamps: true
});

// Hash password before saving
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password
adminSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate short-lived access token
adminSchema.methods.generateJWT = function () {
  return jwt.sign(
    { id: this._id, email: this.email, isAdmin: this.isAdmin, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
};

adminSchema.methods.generateAccessToken = adminSchema.methods.generateJWT;

adminSchema.methods.generateRefreshToken = function (deviceInfo = {}) {
  const raw = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  this.refreshTokens = (this.refreshTokens || [])
    .filter(t => t.isValid && t.expiresAt > new Date())
    .slice(-4);

  this.refreshTokens.push({
    tokenHash,
    deviceId:  deviceInfo.deviceId || '',
    ipHash:    deviceInfo.ipHash || '',
    userAgent: deviceInfo.userAgent || '',
    expiresAt,
    isValid: true
  });

  return { raw, expiresAt };
};

// Remove password from JSON output
adminSchema.methods.toJSON = function () {
  const admin = this.toObject();
  delete admin.password;
  delete admin.__v;
  return admin;
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;