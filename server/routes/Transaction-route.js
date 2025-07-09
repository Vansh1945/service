const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/Transation-controller');
const {
    adminAuthMiddleware
} = require('../middlewares/Admin-middleware');
const {
    userAuthMiddleware,
} = require('../middlewares/User-middleware');
const {
    providerAuthMiddleware,
} = require('../middlewares/Provider-middleware');

// User routes
router.post('/payment',
    userAuthMiddleware,
    transactionController.createPaymentOrder);

router.post('/verify',
    userAuthMiddleware,
    transactionController.verifyPayment);

router.post('/wallet/topup',
    userAuthMiddleware,
    transactionController.topUpWallet);

router.post('/wallet/pay',
    userAuthMiddleware,
    transactionController.payFromWallet);

router.get('/user',
    userAuthMiddleware,
    transactionController.getUserTransactions);

// Provider routes
router.post('/withdraw',
    providerAuthMiddleware,
    transactionController.initiateWithdrawal);

router.get('/provider',
    providerAuthMiddleware,
    transactionController.getProviderTransactions);

// Admin routes
router.post('/process-withdrawals',
    adminAuthMiddleware,
    transactionController.processAutoWithdrawals);

module.exports = router;