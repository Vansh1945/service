const rateLimit = require('express-rate-limit');

// Moderate rate limiter for Booking Creation
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 booking creations per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many booking attempts. Please try again after 15 minutes.' }
});

// Moderate rate limiter for Payment Creation / Verification / Retries
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 payment-related requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment requests. Please try again after 15 minutes.' }
});

// Moderate rate limiter for Provider Application
const providerApplyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 application attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many application attempts. Please try again after an hour.' }
});

// Moderate rate limiter for Contact Form Submission
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 contact submissions per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many contact requests. Please try again after 15 minutes.' }
});

// Moderate rate limiter for Feedback Submission
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 feedback submissions per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many feedback submissions. Please try again after 15 minutes.' }
});

// Moderate rate limiter for Chat Message Send
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 chat messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages sent. Please slow down.' }
});

module.exports = {
  bookingLimiter,
  paymentLimiter,
  providerApplyLimiter,
  contactLimiter,
  feedbackLimiter,
  chatLimiter
};
