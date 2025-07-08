const express = require('express');
const router = express.Router();
const providerController = require('../controllers/Provider-controller');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const { uploadResume, uploadProfilePic } = require('../middlewares/upload');

// Provider Registration Routes
router.post('/register', uploadResume.single('resume'), providerController.register);


// Get profile
router.get('/profile', providerAuthMiddleware, providerController.getProfile);

// Update profile
router.put(
    '/update-profile',
    providerAuthMiddleware,
    uploadProfilePic.single('profilePicUrl'),
    providerController.updateProfile
);

module.exports = router;
