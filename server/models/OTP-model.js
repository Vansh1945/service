/* BACKUP COMMENT: Created new OTP Model to replace process in-memory Map store (otpStore) */
const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true,
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    expires: 0 // TTL Index: documents automatically expire when the current time exceeds expiresAt
  },
  attempts: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OTP', otpSchema);
