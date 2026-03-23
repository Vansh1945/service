const express = require('express');
const router = express.Router();
const {
    register,
    getProfile,
    updateProfile,
    uploadProfilePicture,
    getCustomerDashboardStats
} = require('../controllers/User-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { roleMiddleware } = require('../middlewares/Role-Middleware');

const requireCustomer = roleMiddleware(['customer']);
const requireAdmin = roleMiddleware(['admin']);
const { uploadProfilePic } = require('../middlewares/upload');

// Public routes (no authentication required)
router.post("/register", register);

router.get('/profile', userAuthMiddleware, requireCustomer, getProfile);
router.put('/profile-update', userAuthMiddleware, requireCustomer, updateProfile);
router.post('/profile-picture',
    userAuthMiddleware,
    requireCustomer,
    uploadProfilePic.single('profilePic'),
    uploadProfilePicture
);

router.get('/dashboard', userAuthMiddleware, requireCustomer, getCustomerDashboardStats);

module.exports = router;
