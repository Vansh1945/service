const express = require('express');
const router = express.Router();
const providerController = require('../controllers/Provider-controller');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { upload } = require('../middlewares/upload');

// Registration Routes (Public)
router.post('/register/initiate', providerController.initiateRegistration);
router.post('/register/complete', providerController.completeRegistration);
router.post('/login-for-completion', providerController.loginForCompletion);


// Profile Completion Route (Private)
router.put('/profile/complete', 
  providerAuthMiddleware, 
  upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'passbookImage', maxCount: 1 }
  ]),
  providerController.completeProfile
);

// Profile Routes (Protected)
router.get('/profile', providerAuthMiddleware, providerController.getProfile);

// Unified Profile Update Route (Protected) - handles all profile updates
router.put('/profile', 
  providerAuthMiddleware, 
  upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'resume', maxCount: 1 },
    { name: 'passbookImage', maxCount: 1 }
  ]),
  providerController.updateProviderProfile
);

// Document Viewing Route (Protected)
router.get('/document/:type', providerAuthMiddleware, providerController.viewDocument);

// Account Deletion Routes
router.delete('/profile', providerAuthMiddleware, providerController.deleteAccount);
router.delete('/:id/permanent', adminAuthMiddleware, providerController.permanentDeleteAccount);

// Dashboard Routes
router.get('/dashboard/summary', providerAuthMiddleware, providerController.getDashboardSummary);
router.get('/dashboard/earnings', providerAuthMiddleware, providerController.getEarningsAnalytics);
router.get('/dashboard/bookings', providerAuthMiddleware, providerController.getBookingStatusBreakdown);
router.get('/dashboard/analytics', providerAuthMiddleware, providerController.getDashboardAnalytics);
router.get('/dashboard/wallet', providerAuthMiddleware, providerController.getWalletInfo);
router.get('/dashboard/ratings', providerAuthMiddleware, providerController.getPerformanceRatings);

module.exports = router;
