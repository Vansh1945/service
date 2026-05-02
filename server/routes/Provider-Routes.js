const express = require('express');
const router = express.Router();
const providerController = require('../controllers/Provider-controller');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { roleMiddleware } = require('../middlewares/Role-Middleware');
const { upload } = require('../middlewares/upload');

const requireProvider = roleMiddleware(['provider']);
const requireAdmin = roleMiddleware(['admin']);

// Registration Routes (Public)
router.post('/register/initiate', providerController.initiateRegistration);
router.post('/register/complete', providerController.completeRegistration);
router.post('/login-for-completion', providerController.loginForCompletion);


// Profile Completion Route (Private)
router.put('/profile/complete',
  providerAuthMiddleware,
  requireProvider,
  upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'passbookImage', maxCount: 1 }
  ]),
  providerController.completeProfile
);

// Profile Routes (Protected)
router.get('/profile', providerAuthMiddleware, requireProvider, providerController.getProfile);

// Unified Profile Update Route (Protected) - handles all profile updates
router.put('/profile',
  providerAuthMiddleware,
  requireProvider,
  upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'passbookImage', maxCount: 1 }
  ]),
  providerController.updateProviderProfile
);

// Document Viewing Route (Protected)
router.get('/document/:type', providerAuthMiddleware, requireProvider, providerController.viewDocument);

// Account Deletion Routes
router.delete('/profile', providerAuthMiddleware, requireProvider, providerController.deleteAccount);
router.delete('/:id/permanent', adminAuthMiddleware, requireAdmin, providerController.permanentDeleteAccount);

// Dashboard Routes
router.get('/dashboard/summary', providerAuthMiddleware, requireProvider, providerController.getDashboardSummary);
router.get('/dashboard/earnings', providerAuthMiddleware, requireProvider, providerController.getEarningsAnalytics);
router.get('/dashboard/bookings', providerAuthMiddleware, requireProvider, providerController.getBookingStatusBreakdown);
router.get('/dashboard/analytics', providerAuthMiddleware, requireProvider, providerController.getDashboardAnalytics);
router.get('/dashboard/wallet', providerAuthMiddleware, requireProvider, providerController.getWalletInfo);
router.get('/dashboard/ratings', providerAuthMiddleware, requireProvider, providerController.getPerformanceRatings);

module.exports = router;
