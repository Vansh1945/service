const express = require('express');
const router = express.Router();
const {
    register,
    getProfile,
    updateProfile,
    uploadProfilePicture,
    getCustomerDashboardStats,
    getWalletHistory
} = require('../controllers/User-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const { roleMiddleware } = require('../middlewares/Role-Middleware');
const { validateBody } = require('../validation/common.validation');
const { registerSchema } = require('../validation/auth.validation');

const requireCustomer = roleMiddleware(['customer']);
const { uploadProfilePic } = require('../middlewares/upload');

// Public routes (no authentication required)
router.post("/register", validateBody(registerSchema), register);

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

module.exports = router;
