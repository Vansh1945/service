const express = require('express');
const router = express.Router();
const providerController = require('../controllers/provider-controller');
const { providerAuthMiddleware, providerTestPassedMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { uploadProfilePic, uploadResume, uploadPassbookImg, upload } = require('../middlewares/upload');

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
router.put('/profile', providerAuthMiddleware, providerController.updateProfile);

// Professional Info Routes (Protected)
router.put('/profile/professional', 
  providerAuthMiddleware, 
  providerTestPassedMiddleware, 
  providerController.updateProfessionalInfo
);

// Address Routes (Protected)
router.put('/profile/address', providerAuthMiddleware, providerController.updateAddress);

// Bank Details Routes (Protected)
router.put('/profile/bank', 
  providerAuthMiddleware, 
  uploadPassbookImg.single('passbookImage'), 
  providerController.updateBankDetails
);

// Profile Picture Routes (Protected)
router.put('/profile/picture', 
  providerAuthMiddleware, 
  uploadProfilePic.single('profilePics'), 
  providerController.updateProfilePicture
);

// Resume Routes (Protected)
router.put('/profile/resume', 
  providerAuthMiddleware, 
  uploadResume.single('resume'), 
  providerController.updateResume
);

// Account Deletion Routes
router.delete('/profile', providerAuthMiddleware, providerController.deleteAccount);
router.delete('/:id/permanent', adminAuthMiddleware, providerController.permanentDeleteAccount);

module.exports = router;