const express = require('express');
const router = express.Router();
const adminController = require('../controllers/Admin-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { uploadProfilePic } = require('../middlewares/upload'); // Import the specific upload instance

// Public routes
router.post('/register', uploadProfilePic.single('profilePic'), adminController.registerAdmin);

// Protected routes
router.use(adminAuthMiddleware);

// Admin management
router.get('/profile', adminController.getAdminProfile);
router.put('/profile', uploadProfilePic.single('profilePic'), adminController.updateAdminProfile); // Use uploadProfilePic
router.get('/admins', adminController.getAllAdmins);
router.delete('/admins/:id', adminController.deleteAdmin);

// Customer management
router.get('/customers', adminController.getAllCustomers);
router.get('/customers/:id', adminController.getCustomerById);

// Provider management
router.get('/providers/pending', adminController.getPendingProviders);
router.put('/providers/:id/status', adminController.approveProvider);
router.get('/providers', adminController.getAllProviders);
router.get('/providers/:id', adminController.getProviderDetails);

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);
module.exports = router;