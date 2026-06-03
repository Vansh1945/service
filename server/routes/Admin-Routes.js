const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin-controller');
const rateLimit = require('express-rate-limit');

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // max 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many analytics requests. Please try again after a minute.' }
});
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
router.use(adminAuthMiddleware, adminRoleCheck);


// Admin management
router.get('/profile', adminController.getAdminProfile);
router.patch('/profile', uploadProfilePic.single('profilePic'), adminController.updateAdminProfile); // Use uploadProfilePic
router.get('/admins', adminController.getAllAdmins);
router.delete('/admins/:id', adminController.deleteAdmin);

// Customer management
router.get('/customers', adminController.getAllCustomers);
router.get('/customers/:id', adminController.getCustomerById);

// Provider management
router.get('/providers/pending', adminController.getPendingProviders);
router.put('/providers/:id/status', validateBody(approveProviderSchema), adminController.approveProvider);
router.get('/providers', adminController.getAllProviders);
router.get('/providers/:id', adminController.getProviderDetails);

// Dashboard
router.get('/dashboard/stats', analyticsLimiter, adminController.getDashboardStats);
router.get('/dashboard/summary', analyticsLimiter, adminController.getDashboardSummary);
router.get('/dashboard/revenue', analyticsLimiter, adminController.getDashboardRevenue);
router.get('/dashboard/bookings-status', analyticsLimiter, adminController.getDashboardBookingsStatus);
router.get('/dashboard/top-providers', analyticsLimiter, adminController.getDashboardTopProviders);
router.get('/dashboard/pending-actions', analyticsLimiter, adminController.getDashboardPendingActions);
router.get('/dashboard/live-stats', analyticsLimiter, adminController.getDashboardLiveStats);
router.get('/dashboard/recent-activity', analyticsLimiter, adminController.getDashboardRecentActivity);
router.get('/dashboard/analytics', analyticsLimiter, adminController.getDashboardAnalytics);
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