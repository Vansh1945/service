const express = require('express');
const router = express.Router();
const brandingController = require('../controllers/Branding-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../services/cloudinary');
const { handleUploadErrors } = require('../middlewares/upload');
const { adminActionLimiter } = require('../middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../middlewares/fraud-middleware');

// Combined upload for branding assets (logo, icon, splashScreen, favicon)
const uploadBrandingSettings = multer({
  storage: new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
      let folder = 'brandingAssets';
      let allowedFormats = ['jpg', 'jpeg', 'png', 'ico', 'svg', 'gif'];
      return {
        folder: folder,
        resource_type: 'image',
        allowed_formats: allowedFormats,
        public_id: `branding_${req.params.role || 'role'}_${file.fieldname}_${Date.now()}`,
      };
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'icon', maxCount: 1 },
  { name: 'splashScreen', maxCount: 1 },
  { name: 'favicon', maxCount: 1 }
]);

// PUBLIC BRANDING ROUTES
router.get('/settings/branding-logo', brandingController.getBrandingLogoRedirect);
router.get('/settings/branding-favicon', brandingController.getBrandingFaviconRedirect);
router.get('/settings/branding/:role', brandingController.getBrandingSettings);
router.get('/settings/branding/:role/manifest', brandingController.getBrandingManifest);

// ADMIN BRANDING ROUTES (Protected)
router.put('/settings/branding/:role', adminAuthMiddleware, adminActionLimiter, preventDuplicateSubmissions(3), brandingController.updateBrandingSettings);
router.post('/settings/branding/:role/upload', adminAuthMiddleware, uploadBrandingSettings, handleUploadErrors, adminActionLimiter, preventDuplicateSubmissions(3), brandingController.uploadBrandingAsset);
router.post('/settings/branding/:role/publish', adminAuthMiddleware, adminActionLimiter, preventDuplicateSubmissions(3), brandingController.publishBrandingUpdate);

module.exports = router;
