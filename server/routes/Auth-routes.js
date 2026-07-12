const express = require('express');
const router = express.Router();
const authController = require('../controllers/Auth-controller');
const { validateBody } = require('../validation/common.validation');
const {
  loginSchema,
  forgotPasswordSchema,
  verifyOTPSchema,
  resetPasswordSchema,
  resendOTPSchema,
  firebaseLoginSchema
} = require('../validation/auth.validation');
const { throttleFailedLogins, throttleOtpRequests, preventDuplicateSubmissions } = require('../middlewares/fraud-middleware');
const { authLimiter } = require('../middlewares/rate-limit');

// ── Existing routes ───────────────────────────────────────────────────────
router.post('/login', authLimiter, preventDuplicateSubmissions(5), throttleFailedLogins, validateBody(loginSchema), authController.Login);
router.post('/forgot-password', authLimiter, preventDuplicateSubmissions(5), throttleOtpRequests, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-otp', authLimiter, preventDuplicateSubmissions(5), validateBody(verifyOTPSchema), authController.verifyResetOTP);
router.post('/reset-password', authLimiter, preventDuplicateSubmissions(5), validateBody(resetPasswordSchema), authController.resetPassword);
router.post('/resend-otp', authLimiter, preventDuplicateSubmissions(5), throttleOtpRequests, validateBody(resendOTPSchema), authController.resendOTP);

// ── Firebase / Social login ───────────────────────────────────────────────
// Body: { firebaseToken: string, role: 'customer'|'provider', deviceId?: string }
router.post('/firebase-login', authLimiter, preventDuplicateSubmissions(5), validateBody(firebaseLoginSchema), authController.firebaseLogin);

// ── Refresh token rotation ────────────────────────────────────────────────
// Body: { refreshToken: string }
router.post('/refresh-token', authLimiter, authController.refreshAccessToken);

// ── Secure logout ─────────────────────────────────────────────────────────
// Body: { refreshToken: string, allDevices?: boolean }
router.post('/logout', authController.logout);

module.exports = router;
