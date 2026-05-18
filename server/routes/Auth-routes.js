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

// Import throttling middlewares
const { throttleFailedLogins, throttleOtpRequests } = require('../middlewares/fraud-middleware');

router.post('/login', throttleFailedLogins, validateBody(loginSchema), authController.Login);

// Password reset routes
router.post('/forgot-password', throttleOtpRequests, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/verify-otp', validateBody(verifyOTPSchema), authController.verifyResetOTP);
router.post('/reset-password', validateBody(resetPasswordSchema), authController.resetPassword);
router.post('/resend-otp', throttleOtpRequests, validateBody(resendOTPSchema), authController.resendOTP);

module.exports = router;
