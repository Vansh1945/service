const express = require('express');
const router = express.Router();
const paymentController = require('./transaction-controller');
const { userAuthMiddleware } = require('../../shared/middlewares/user-middleware');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { roleMiddleware } = require('../../shared/middlewares/role-middleware');
const { validateBody } = require('../../shared/validation/common-validation');
const { createOrderSchema, verifyPaymentSchema } = require('./transaction-validation');

const adminRoleCheck = roleMiddleware(['admin']);


// @desc    Create Razorpay order for booking payment
// @route   POST /api/transaction/create-order
// @access  Private (user)
const { paymentLimiter } = require('../../shared/middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');

router.post('/create-order', userAuthMiddleware, paymentLimiter, preventDuplicateSubmissions(5), validateBody(createOrderSchema), paymentController.createOrder);

// @desc    Verify payment and update records
// @route   POST /api/transaction/verify
// @access  Private (user)
router.post('/verify', userAuthMiddleware, paymentLimiter, preventDuplicateSubmissions(5), validateBody(verifyPaymentSchema), paymentController.verifyPayment);


// @desc    Razorpay webhook handler
// @route   POST /api/transaction/webhook
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// @desc    Get customer transaction history
// @route   GET /api/transaction/customer/all
// @access  Private (user)
router.get('/customer/all', userAuthMiddleware, roleMiddleware(['customer']), paymentController.getCustomerTransactions);

const { providerAuthMiddleware } = require('../../shared/middlewares/provider-middleware');

// Cash Booking Payment Verification Routes
router.post('/cash-verification/generate-qr', providerAuthMiddleware, paymentLimiter, preventDuplicateSubmissions(5), paymentController.generateBookingQR);
router.post('/cash-verification/confirm-cash', providerAuthMiddleware, paymentLimiter, preventDuplicateSubmissions(5), paymentController.verifyCashReceived);
router.get('/cash-verification/status/:bookingId', providerAuthMiddleware, paymentController.getQRVerificationStatus);
router.post('/admin/cash-verification/override/:bookingId', adminAuthMiddleware, adminRoleCheck, paymentController.adminOverrideCashVerification);

// Admin Routes

router.get('/admin/all', adminAuthMiddleware, adminRoleCheck, paymentController.getAllTransactions);
router.get('/admin/details/:id', adminAuthMiddleware, adminRoleCheck, paymentController.getTransactionById);
router.get('/admin/payment-details/:id', adminAuthMiddleware, adminRoleCheck, paymentController.getAdminPaymentDetails);
router.get('/admin/unified-details/:entityType/:id', adminAuthMiddleware, adminRoleCheck, paymentController.getUnifiedEntityDetails);
router.post('/admin/retry-verify/:id', adminAuthMiddleware, adminRoleCheck, paymentController.adminRetryVerify);
router.post('/admin/mark-paid/:id', adminAuthMiddleware, adminRoleCheck, paymentController.adminMarkPaid);

// Additional Finance Admin Endpoints
router.get('/admin/finance-overview', adminAuthMiddleware, adminRoleCheck, paymentController.getFinanceOverview);
router.get('/admin/chart-trends', adminAuthMiddleware, adminRoleCheck, paymentController.getChartTrends);
router.get('/admin/cash-ledger', adminAuthMiddleware, adminRoleCheck, paymentController.getCashLedger);
router.get('/admin/wallets/customers', adminAuthMiddleware, adminRoleCheck, paymentController.getCustomerWallets);
router.get('/admin/wallets/providers', adminAuthMiddleware, adminRoleCheck, paymentController.getProviderWallets);
router.get('/admin/settlements', adminAuthMiddleware, adminRoleCheck, paymentController.getSettlements);
router.get('/admin/razorpay/logs', adminAuthMiddleware, adminRoleCheck, paymentController.getRazorpayLogs);
router.get('/admin/failed-payments', adminAuthMiddleware, adminRoleCheck, paymentController.getFailedPayments);
router.get('/admin/audit-logs', adminAuthMiddleware, adminRoleCheck, paymentController.getAuditLogs);

// ── Razorpay Synchronization & Reconciliation Admin Routes ────────────────
router.post('/admin/razorpay/sync-all', adminAuthMiddleware, adminRoleCheck, paymentController.syncRazorpayAll);
router.post('/admin/razorpay/sync-payments', adminAuthMiddleware, adminRoleCheck, paymentController.syncRazorpayPayments);
router.post('/admin/razorpay/sync-settlements', adminAuthMiddleware, adminRoleCheck, paymentController.syncRazorpaySettlements);
router.post('/admin/razorpay/sync-refunds', adminAuthMiddleware, adminRoleCheck, paymentController.syncRazorpayRefunds);
router.post('/admin/razorpay/sync-recon', adminAuthMiddleware, adminRoleCheck, paymentController.syncRazorpayRecon);

// ── Master Financial Ledger Routes ────────────────────
router.get('/admin/ledger', adminAuthMiddleware, adminRoleCheck, paymentController.getMasterLedger);
router.get('/admin/ledger-detail/:id', adminAuthMiddleware, adminRoleCheck, paymentController.getLedgerDetail);

module.exports = router;