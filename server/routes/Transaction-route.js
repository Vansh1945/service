const express = require('express');
const router = express.Router();
const {
  payForBooking,
  verifyPayment,
  topUpWallet,
  initiateWithdrawal,

  getTransactionHistory,
  getProviderEarnings
} = require('../controllers/Transaction-controller');
const {userAuthMiddleware} = require('../middlewares/User-middleware');
const { providerAuthMiddleware, providerTestPassedMiddleware } = require('../middlewares/Provider-middleware');

// Customer routes
router.post('/pay', userAuthMiddleware, payForBooking);
router.post('/verify', userAuthMiddleware, verifyPayment);
router.post('/wallet/topup', userAuthMiddleware, topUpWallet);

// Provider routes
router.post('/withdraw', providerAuthMiddleware, providerTestPassedMiddleware, initiateWithdrawal);
router.get('/earnings', providerAuthMiddleware, providerTestPassedMiddleware, getProviderEarnings);


// Shared routes (Customer and Provider)
router.get('/transactions', [userAuthMiddleware, providerAuthMiddleware], getTransactionHistory);

module.exports = router;