// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('./payment-controller');
const { providerAuthMiddleware } = require('../../shared/middlewares/provider-middleware');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { validateBody } = require('../../shared/validation/common-validation');
const { requestBulkWithdrawalSchema } = require('./payment-validation');

// Provider routes
const { paymentLimiter, webhookLimiter } = require('../../shared/middlewares/rate-limit');

// Webhook route - must use express.raw() for signature verification
// This route is PUBLIC - no authentication required
router.post('/webhook', webhookLimiter, express.raw({ type: 'application/json' }), paymentController.handleWebhook);
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');

router.get('/summary', providerAuthMiddleware, paymentController.getEarningsSummary);
router.get('/stats/weekly-monthly', providerAuthMiddleware, paymentController.getWeeklyMonthlyStats);
router.post('/withdraw', providerAuthMiddleware, paymentLimiter, preventDuplicateSubmissions(5), validateBody(requestBulkWithdrawalSchema), paymentController.requestBulkWithdrawal);

router.get("/earnings-report", providerAuthMiddleware, paymentController.downloadEarningsReport);
router.get("/withdrawal-report", providerAuthMiddleware, paymentController.downloadWithdrawalReport);

// Admin routes
router.post("/admin/payout/direct", adminAuthMiddleware, paymentController.adminDirectPayout);
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
router.get('/admin/complaint-report', adminAuthMiddleware, paymentController.generateComplaintReport);
router.get('/admin/refund-report', adminAuthMiddleware, paymentController.generateRefundReport);

module.exports = router;
