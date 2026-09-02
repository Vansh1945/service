const express = require('express');
const router = express.Router();
const adminController = require('./admin-controller');

const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { roleMiddleware } = require('../../shared/middlewares/role-middleware');
const { uploadProfilePic } = require('../../shared/middlewares/upload');
const { validateBody, validateParams, idParamSchema, bookingIdParamSchema, userIdParamSchema } = require('../../shared/validation/common-validation');
const {
  registerAdminSchema,
  approveProviderSchema,
  adminRefundSchema,
  togglePayoutHoldSchema
} = require('./admin-validation');

const { adminActionLimiter, adminRegisterLimiter } = require('../../shared/middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');

// Public routes
router.post('/register', adminRegisterLimiter, uploadProfilePic.single('profilePic'), validateBody(registerAdminSchema), adminController.registerAdmin);

// Protected routes
const adminRoleCheck = roleMiddleware(['admin']);
router.use(adminAuthMiddleware, adminRoleCheck);

// Universal Admin Search & Filter API
router.post('/search', adminActionLimiter, adminController.searchUniversal);

// Global Cross-Module Search API
router.post('/search/global', adminActionLimiter, adminController.searchGlobal);

// Admin management
router.get('/profile', adminController.getAdminProfile);
router.patch('/profile', adminActionLimiter, uploadProfilePic.single('profilePic'), adminController.updateAdminProfile); // Use uploadProfilePic
router.get('/admins', adminController.getAllAdmins);
router.delete('/admins/:id', adminActionLimiter, validateParams(idParamSchema), adminController.deleteAdmin);

// Customer management
router.get('/customers', adminController.getAllCustomers);
router.get('/customers/:id', validateParams(idParamSchema), adminController.getCustomerById);
router.put('/customers/:id', adminActionLimiter, validateParams(idParamSchema), adminController.updateCustomer);
router.patch('/customers/:id/toggle-block', adminActionLimiter, validateParams(idParamSchema), adminController.toggleBlockCustomer);
router.delete('/customers/:id', adminActionLimiter, validateParams(idParamSchema), adminController.deleteCustomer);

// Provider management
router.get('/providers/pending', adminController.getPendingProviders);
router.put('/providers/:id/status', adminActionLimiter, validateParams(idParamSchema), validateBody(approveProviderSchema), adminController.approveProvider);
router.get('/providers/:id/agreement-pdf', validateParams(idParamSchema), adminController.getProviderAgreementPdf);
router.get('/providers/:id/approval-letter', validateParams(idParamSchema), adminController.getProviderApprovalLetter);
router.get('/providers', adminController.getAllProviders);
router.get('/providers/:id', validateParams(idParamSchema), adminController.getProviderDetails);

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/dashboard/summary', adminController.getDashboardSummary);
router.get('/dashboard/revenue', adminController.getDashboardRevenue);
router.get('/dashboard/bookings-status', adminController.getDashboardBookingsStatus);
router.get('/dashboard/top-providers', adminController.getDashboardTopProviders);
router.get('/dashboard/pending-actions', adminController.getDashboardPendingActions);
router.get('/dashboard/live-stats', adminController.getDashboardLiveStats);
router.get('/dashboard/recent-activity', adminController.getDashboardRecentActivity);
router.get('/dashboard/analytics', adminController.getDashboardAnalytics);
// Refund management
router.get('/refunds', adminController.getAllRefunds);
router.post('/refunds/manual', adminActionLimiter, preventDuplicateSubmissions(5), adminController.createManualRefund);
router.get('/refunds/:id', validateParams(idParamSchema), adminController.getRefundById);
router.post('/refunds/:id/approve', adminActionLimiter, validateParams(idParamSchema), adminController.approveRefundById);
router.post('/refunds/:id/reject', adminActionLimiter, validateParams(idParamSchema), adminController.rejectRefundById);
router.post('/refunds/:id/retry', adminActionLimiter, validateParams(idParamSchema), adminController.retryRefund);
router.post('/refund/:bookingId/process', adminActionLimiter, validateParams(bookingIdParamSchema), validateBody(adminRefundSchema), adminController.processAdminRefund);
router.post('/refund/:bookingId/reject', adminActionLimiter, validateParams(bookingIdParamSchema), adminController.rejectAdminRefund);
router.patch('/payout/:bookingId/hold', adminActionLimiter, validateParams(bookingIdParamSchema), validateBody(togglePayoutHoldSchema), adminController.togglePayoutHold);
router.patch('/bookings/:bookingId/cancel', adminActionLimiter, validateParams(bookingIdParamSchema), adminController.cancelBookingByAdmin);

// Fraud Detection
router.get('/fraud/same-ip', adminController.getSameIPFraud);
router.get('/fraud/device-abuse', adminController.getDeviceAbuse);
router.get('/fraud/cancellation-alerts', adminController.getCancellationAlerts);
router.patch('/fraud/:id/safe', adminActionLimiter, validateParams(idParamSchema), adminController.markFraudLogSafe);
router.post('/fraud/:id/notes', adminActionLimiter, validateParams(idParamSchema), adminController.addFraudLogNote);
router.patch('/fraud/user/:userId/suspend', adminActionLimiter, validateParams(userIdParamSchema), adminController.suspendUserAccount);
// System Logs
router.get('/system-logs', adminController.getSystemLogs);

// ── Security Monitoring ───────────────────────────────────────────────────
router.get('/security/sessions', adminAuthMiddleware, adminController.getActiveSessions);
router.post('/security/force-logout', adminAuthMiddleware, adminActionLimiter, adminController.forceLogoutUser);

module.exports = router;