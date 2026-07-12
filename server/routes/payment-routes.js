// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { validateBody } = require('../validation/common.validation');
const { requestBulkWithdrawalSchema } = require('../validation/payment.validation');

// Webhook route - must use express.raw() for signature verification
// This route is PUBLIC - no authentication required
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Provider routes
const { paymentLimiter } = require('../middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../middlewares/fraud-middleware');

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
