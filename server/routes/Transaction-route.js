const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/Transaction-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { roleMiddleware } = require('../middlewares/role-middleware');
const { validateBody } = require('../validation/common.validation');
const { createOrderSchema, verifyPaymentSchema } = require('../validation/transaction.validation');

const adminRoleCheck = roleMiddleware(['admin']);

// @desc    Create Razorpay order for booking payment
// @route   POST /api/transaction/create-order
// @access  Private (user)
router.post('/create-order', userAuthMiddleware, validateBody(createOrderSchema), paymentController.createOrder);

// @desc    Verify payment and update records
// @route   POST /api/transaction/verify
// @access  Private (user)
router.post('/verify', userAuthMiddleware, validateBody(verifyPaymentSchema), paymentController.verifyPayment);


// @desc    Razorpay webhook handler
// @route   POST /api/transaction/webhook
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// @desc    Get customer transaction history
// @route   GET /api/transaction/customer/all
// @access  Private (user)
router.get('/customer/all', userAuthMiddleware, roleMiddleware(['customer']), paymentController.getCustomerTransactions);

// Admin Routes

router.get('/admin/all', adminAuthMiddleware, adminRoleCheck, paymentController.getAllTransactions);
router.get('/admin/details/:id', adminAuthMiddleware, adminRoleCheck, paymentController.getTransactionById);

module.exports = router;