// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Provider routes
router.get('/summary', providerAuthMiddleware, paymentController.getEarningsSummary);
router.post('/withdraw', providerAuthMiddleware, paymentController.requestBulkWithdrawal);
router.get("/earnings-report", providerAuthMiddleware, paymentController.downloadEarningsReport);
router.get("/withdrawal-report", providerAuthMiddleware, paymentController.downloadWithdrawalReport);

// Admin routes
router.get("/admin/withdrawal-requests", adminAuthMiddleware, paymentController.getAllWithdrawalRequests);
router.put("/admin/withdrawal-request/:id/approve", adminAuthMiddleware, paymentController.approveWithdrawalRequest);
router.put("/admin/withdrawal-request/:id/reject", adminAuthMiddleware, paymentController.rejectWithdrawalRequest);
router.get("/admin/withdrawal-report", adminAuthMiddleware, paymentController.generateWithdrawalReport);
router.get('/admin/provider-earnings-report', adminAuthMiddleware, paymentController.generateProviderEarningsReport);
router.get('/admin/commission-report', adminAuthMiddleware, paymentController.getCommissionReport);
router.get('/admin/failed-rejected-report', adminAuthMiddleware, paymentController.failedRejectedWithdrawalsReport);
router.get('/admin/provider-ledger/:providerId', adminAuthMiddleware, paymentController.providerLedgerReport);
router.get('/admin/earnings-summary-report', adminAuthMiddleware, paymentController.earningsSummaryReport);
router.get('/admin/payout-history-report', adminAuthMiddleware, paymentController.payoutHistoryReport);
router.get('/admin/outstanding-balance-report', adminAuthMiddleware, paymentController.outstandingBalanceReport);

module.exports = router;

