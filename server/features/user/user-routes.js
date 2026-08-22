const express = require('express');
const router = express.Router();
const {
  register,
  getProfile,
  updateProfile,
  uploadProfilePicture,
  getCustomerDashboardStats,
  getWalletHistory,
  toggleFavoriteProvider,
  checkFavoriteProviderAvailability,
  getSavedAddresses,
  createSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
  setDefaultSavedAddress
} = require('./user-controller');
const { userAuthMiddleware } = require('../../shared/middlewares/user-middleware');
const { roleMiddleware } = require('../../shared/middlewares/role-middleware');
const { validateBody } = require('../../shared/validation/common-validation');
const { registerSchema } = require('../auth/auth-validation');

const requireCustomer = roleMiddleware(['customer']);
const { uploadProfilePic } = require('../../shared/middlewares/upload');

// Public routes (no authentication required)
const { signupLimiter } = require('../../shared/middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');
router.post("/register", signupLimiter, preventDuplicateSubmissions(5), validateBody(registerSchema), register);

router.get('/profile', userAuthMiddleware, requireCustomer, getProfile);
router.put('/profile-update', userAuthMiddleware, requireCustomer, updateProfile);

router.post('/profile-picture',
  userAuthMiddleware,
  requireCustomer,
  uploadProfilePic.single('profilePic'),
  uploadProfilePicture
);

router.get('/dashboard', userAuthMiddleware, requireCustomer, getCustomerDashboardStats);
router.get('/wallet/history', userAuthMiddleware, requireCustomer, getWalletHistory);

// Favorite Providers routes
router.post('/favorite-providers/toggle', userAuthMiddleware, requireCustomer, toggleFavoriteProvider);
router.get('/favorite-providers/check/:providerId', userAuthMiddleware, requireCustomer, checkFavoriteProviderAvailability);

// Saved Addresses routes
router.get('/addresses', userAuthMiddleware, requireCustomer, getSavedAddresses);
router.post('/addresses', userAuthMiddleware, requireCustomer, createSavedAddress);
router.put('/addresses/:addressId', userAuthMiddleware, requireCustomer, updateSavedAddress);
router.delete('/addresses/:addressId', userAuthMiddleware, requireCustomer, deleteSavedAddress);
router.patch('/addresses/:addressId/default', userAuthMiddleware, requireCustomer, setDefaultSavedAddress);

module.exports = router;
