const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin-controller');

const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { roleMiddleware } = require('../middlewares/role-middleware');
const { uploadProfilePic } = require('../middlewares/upload');
const { validateBody } = require('../validation/common.validation');
const {
  registerAdminSchema,
  approveProviderSchema,
  adminRefundSchema,
  togglePayoutHoldSchema
} = require('../validation/admin.validation');

// Public routes
router.post('/register', uploadProfilePic.single('profilePic'), validateBody(registerAdminSchema), adminController.registerAdmin);

// Protected routes
const adminRoleCheck = roleMiddleware(['admin']);
const { adminActionLimiter } = require('../middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../middlewares/fraud-middleware');
router.use(adminAuthMiddleware, adminRoleCheck);


// Admin management
router.get('/profile', adminController.getAdminProfile);
router.patch('/profile', uploadProfilePic.single('profilePic'), adminController.updateAdminProfile); // Use uploadProfilePic
router.get('/admins', adminController.getAllAdmins);
router.delete('/admins/:id', adminController.deleteAdmin);

// Customer management
router.get('/customers', adminController.getAllCustomers);
router.get('/customers/:id', adminController.getCustomerById);
router.put('/customers/:id', adminController.updateCustomer);
router.patch('/customers/:id/toggle-block', adminController.toggleBlockCustomer);
router.delete('/customers/:id', adminController.deleteCustomer);

// Provider management
router.get('/providers/pending', adminController.getPendingProviders);
router.put('/providers/:id/status', validateBody(approveProviderSchema), adminController.approveProvider);
router.get('/providers/:id/agreement-pdf', adminController.getProviderAgreementPdf);
router.get('/providers/:id/approval-letter', adminController.getProviderApprovalLetter);
router.get('/providers', adminController.getAllProviders);
router.get('/providers/:id', adminController.getProviderDetails);

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
router.post('/refund/:bookingId/process', validateBody(adminRefundSchema), adminController.processAdminRefund);
router.post('/refund/:bookingId/reject', adminController.rejectAdminRefund);
router.patch('/payout/:bookingId/hold', validateBody(togglePayoutHoldSchema), adminController.togglePayoutHold);
router.patch('/bookings/:bookingId/cancel', adminController.cancelBookingByAdmin);

// Fraud Detection
router.get('/fraud/same-ip', adminController.getSameIPFraud);
router.get('/fraud/device-abuse', adminController.getDeviceAbuse);
router.get('/fraud/cancellation-alerts', adminController.getCancellationAlerts);
router.patch('/fraud/:id/safe', adminController.markFraudLogSafe);
router.post('/fraud/:id/notes', adminController.addFraudLogNote);
router.patch('/fraud/user/:userId/suspend', adminController.suspendUserAccount);
// System Logs
router.get('/system-logs', adminController.getSystemLogs);

// ── Security Monitoring ───────────────────────────────────────────────────
router.get('/security/sessions', adminAuthMiddleware, adminController.getActiveSessions);
router.post('/security/force-logout', adminAuthMiddleware, adminController.forceLogoutUser);

module.exports = router;