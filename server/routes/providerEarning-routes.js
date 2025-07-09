const express = require('express');
const router = express.Router();
const {
  getTopProviders,
  getTopCustomers,
  getEarningsReport,
  generateEarningsReport,
  getEarningsSummary,
  getEarningsStatement,
  downloadStatement
} = require('../controllers/providerEarning-controller');
const {providerAuthMiddleware} = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Admin routes
router.get('/top-providers', adminAuthMiddleware, getTopProviders);
router.get('/top-customers', adminAuthMiddleware, getTopCustomers);
router.get('/report', adminAuthMiddleware, getEarningsReport);
router.get('/generate-report', adminAuthMiddleware, generateEarningsReport);

// Provider routes
router.get('/summary', providerAuthMiddleware, getEarningsSummary);
router.get('/statement', providerAuthMiddleware, getEarningsStatement);
router.get('/download-statement', providerAuthMiddleware, downloadStatement);

module.exports = router;