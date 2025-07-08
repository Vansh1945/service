const express = require('express');
const router = express.Router();
const { 
    register,
    login,
    getProfile,
    updateProfile
} = require('../controllers/User-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');

// Public routes (no authentication required)
router.post("/register", register);

// Protected routes (require authentication)
router.get('/profile', 
    userAuthMiddleware, providerAuthMiddleware ,
    getProfile
);

router.put('/profile-update',
    userAuthMiddleware,
    updateProfile
);

module.exports = router;