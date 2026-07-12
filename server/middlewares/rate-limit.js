const rateLimit = require('express-rate-limit');

// Generic friendly message structure
const friendlyMessage = {
  success: false,
  message: 'Too many requests. Please wait a moment and try again.'
};

// Rate limiter for Auth endpoints (Login, Reset Password, OTP, etc.)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: friendlyMessage
});

// Rate limiter for Signup endpoints
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 signup attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many signup attempts. Please try again after an hour.' }
});

// Moderate rate limiter for Booking Creation
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 booking creations per window
  standardHeaders: true,
  legacyHeaders: false,
  message: friendlyMessage
});

// Rate limiter for booking cancellation
const bookingCancelLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 cancellations per window
  standardHeaders: true,
  legacyHeaders: false,
  message: friendlyMessage
});

// Moderate rate limiter for Payment Creation / Verification / Retries
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 payment-related requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: friendlyMessage
});

// Rate limiter for Provider actions (Accept, Reject, Complete Booking, Upload Images)
const providerActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 provider actions per window
  standardHeaders: true,
  legacyHeaders: false,
  message: friendlyMessage
});

// Rate limiter for Admin actions (Login, settings, bulk approval)
const adminActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 admin actions per window
  standardHeaders: true,
  legacyHeaders: false,
  message: friendlyMessage
});

// Moderate rate limiter for Contact Form, Feedback, Reviews, and Complaints
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 feedback submissions per window
  standardHeaders: true,
  legacyHeaders: false,
  message: friendlyMessage
});

const feedbackLimiter = contactLimiter;

// Rate limiter for Chat Message Send
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 chat messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages sent. Please slow down.' }
});

module.exports = {
  authLimiter,
  signupLimiter,
  bookingLimiter,
  bookingCancelLimiter,
  paymentLimiter,
  providerActionLimiter,
  adminActionLimiter,
  contactLimiter,
  feedbackLimiter,
  chatLimiter
};

