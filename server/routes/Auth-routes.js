const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/Auth-controller');
const { validateBody } = require('../validation/common.validation');
const {
  loginSchema,
  forgotPasswordSchema,
  verifyOTPSchema,
  resetPasswordSchema,
  resendOTPSchema
} = require('../validation/auth.validation');
const { throttleFailedLogins, throttleOtpRequests } = require('../middlewares/fraud-middleware');

// ── Rate limiters ─────────────────────────────────────────────────────────
const firebaseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many refresh requests. Slow down.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' }
});

// ── Existing routes ───────────────────────────────────────────────────────
router.post('/login', loginLimiter, throttleFailedLogins, validateBody(loginSchema), authController.Login);
router.post('/forgot-password', throttleOtpRequests, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-otp', validateBody(verifyOTPSchema), authController.verifyResetOTP);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
router.post('/resend-otp', throttleOtpRequests, validateBody(resendOTPSchema), authController.resendOTP);

// ── Firebase / Social login ───────────────────────────────────────────────
// Body: { firebaseToken: string, role: 'customer'|'provider', deviceId?: string }
router.post('/firebase-login', firebaseLimiter, authController.firebaseLogin);

// ── Refresh token rotation ────────────────────────────────────────────────
// Body: { refreshToken: string }
router.post('/refresh-token', refreshLimiter, authController.refreshAccessToken);

// ── Secure logout ─────────────────────────────────────────────────────────
// Body: { refreshToken: string, allDevices?: boolean }
router.post('/logout', authController.logout);

// ── Biometric / WebAuthn ──────────────────────────────────────────────────
// Register: user must be logged-in (sends standard JWT). Stores passkey credential.
const { userAuthMiddleware } = require('../middlewares/User-middleware');
router.post('/biometric/register', userAuthMiddleware, authController.registerBiometric);
// Login: verifies WebAuthn assertion, issues JWT + refresh token
router.post('/biometric/login', authController.biometricLogin);

module.exports = router;
