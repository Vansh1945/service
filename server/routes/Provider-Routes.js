const express = require('express');
const router = express.Router();
const providerController = require('../controllers/Provider-controller');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { roleMiddleware } = require('../middlewares/role-middleware');
const { upload } = require('../middlewares/upload');
const { validateBody } = require('../validation/common.validation');
const {
  initiateRegistrationSchema,
  completeRegistrationSchema,
  loginForCompletionSchema,
  completeProfileSchema,
  updateProviderProfileSchema
} = require('../validation/provider.validation');

const requireProvider = roleMiddleware(['provider']);
const requireAdmin = roleMiddleware(['admin']);


// Registration Routes (Public)
const { signupLimiter, authLimiter } = require('../middlewares/rate-limit');
const { throttleFailedLogins, preventDuplicateSubmissions } = require('../middlewares/fraud-middleware');

router.post('/register/initiate', signupLimiter, preventDuplicateSubmissions(5), validateBody(initiateRegistrationSchema), providerController.initiateRegistration);
router.post('/register/complete', signupLimiter, preventDuplicateSubmissions(5), validateBody(completeRegistrationSchema), providerController.completeRegistration);
router.post('/login-for-completion', authLimiter, throttleFailedLogins, preventDuplicateSubmissions(5), validateBody(loginForCompletionSchema), providerController.loginForCompletion);


// Profile Completion Route (Private)
router.put('/profile/complete',
  providerAuthMiddleware,
  requireProvider,
  upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'liveSelfie', maxCount: 1 },
    { name: 'passbookImage', maxCount: 1 }
  ]),
  validateBody(completeProfileSchema),
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
    { name: 'aadhaarFront', maxCount: 1 },
    { name: 'aadhaarBack', maxCount: 1 },
    { name: 'panCard', maxCount: 1 },
    { name: 'liveSelfie', maxCount: 1 },
    { name: 'passbookImage', maxCount: 1 }
  ]),
  validateBody(updateProviderProfileSchema),
  providerController.updateProviderProfile
);

// Agreement PDF Route
router.get('/agreement-pdf', providerAuthMiddleware, requireProvider, providerController.getAgreementPdf);


// Document Viewing Route (Protected)
router.get('/document/:type', providerAuthMiddleware, requireProvider, providerController.viewDocument);

// Account Deletion Routes
router.delete('/profile', providerAuthMiddleware, requireProvider, providerController.deleteAccount);
router.delete('/:id/permanent', adminAuthMiddleware, requireAdmin, providerController.permanentDeleteAccount);

// Dashboard Routes
router.get('/dashboard', providerAuthMiddleware, requireProvider, providerController.getDashboardData);

module.exports = router;
