const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/Transaction-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');

// User payment routes
router.post('/create-order', userAuthMiddleware, paymentController.createRazorpayOrder);
router.post('/verify', userAuthMiddleware, paymentController.verifyPayment);

// Razorpay webhook (no auth needed)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;