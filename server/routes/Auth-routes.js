const express = require('express');
const router = express.Router();
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

// ── Existing routes ───────────────────────────────────────────────────────
router.post('/login', throttleFailedLogins, validateBody(loginSchema), authController.Login);
router.post('/forgot-password', throttleOtpRequests, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-otp', validateBody(verifyOTPSchema), authController.verifyResetOTP);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
router.post('/resend-otp', throttleOtpRequests, validateBody(resendOTPSchema), authController.resendOTP);

// ── Firebase / Social login ───────────────────────────────────────────────
// Body: { firebaseToken: string, role: 'customer'|'provider', deviceId?: string }
router.post('/firebase-login', authController.firebaseLogin);

// ── Refresh token rotation ────────────────────────────────────────────────
// Body: { refreshToken: string }
router.post('/refresh-token', authController.refreshAccessToken);

// ── Secure logout ─────────────────────────────────────────────────────────
// Body: { refreshToken: string, allDevices?: boolean }
router.post('/logout', authController.logout);

module.exports = router;
