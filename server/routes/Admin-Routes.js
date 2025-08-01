const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Public routes
router.post('/register', adminController.registerAdmin);

// Protected route (requires admin authentication)
router.get('/profile', adminAuthMiddleware, adminController.getAdminProfile);

// Admin provider approval routes
router.get('/providers/pending', adminAuthMiddleware, adminController.getPendingProviders);
router.put('/providers/:id/approve', adminAuthMiddleware, adminController.approveProvider);


// admin get Customer routes
router.get('/customers', adminAuthMiddleware, adminController.getAllCustomers);

// admin get Provider routes
router.get('/providers', adminAuthMiddleware, adminController.getAllProviders);
router.get('/providers/:id', adminAuthMiddleware, adminController.getProviderDetails);
router.get('/providers/:id/resume', adminAuthMiddleware, adminController.getProviderResume);

// Admin Dashboard Stats
router.get('/dashboard/stats', adminAuthMiddleware, adminController.getDashboardStats);

module.exports = router;