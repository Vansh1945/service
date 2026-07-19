const express = require('express');
const router = express.Router();
const systemSettingController = require('../controllers/SystemSetting-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../services/cloudinary');
const { handleUploadErrors } = require('../middlewares/upload');

// Sub-routers
const categoryRoutes = require('./Category-routes');
const bannerRoutes = require('./Banner-routes');
const brandingRoutes = require('./Branding-routes');
const emailTemplateRoutes = require('./EmailTemplate-routes');

// Combined upload for system settings (logo, favicon and ringtone)
const uploadSystemSettings = multer({
  storage: new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
      let folder = 'systemLogo';
      let allowedFormats = ['jpg', 'jpeg', 'png', 'gif'];
      let resourceType = 'image';

      if (file.fieldname === 'favicon') {
        folder = 'systemFavicon';
        allowedFormats = ['jpg', 'jpeg', 'png', 'ico'];
      } else if (file.fieldname === 'providerBookingRingtone') {
        folder = 'systemRingtone';
        allowedFormats = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'mp4'];
        resourceType = 'video';
      }

      return {
        folder: folder,
        resource_type: resourceType,
        allowed_formats: allowedFormats,
        public_id: `${folder}_${Date.now()}_${file.originalname.split('.')[0].replace(/\s/g, '-')}`,
      };
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'favicon', maxCount: 1 },
  { name: 'providerBookingRingtone', maxCount: 1 },
  { name: 'digitalSignature', maxCount: 1 },
  { name: 'companySeal', maxCount: 1 }
]);

// Mount sub-routers on the same router
router.use('/', categoryRoutes);
router.use('/', bannerRoutes);
router.use('/', brandingRoutes);
router.use('/', emailTemplateRoutes);

// CORE PUBLIC ROUTES
router.get('/system-data', systemSettingController.getSystemSetting);
router.get('/validate-ifsc/:code', systemSettingController.validateIfsc);

// CORE ADMIN ROUTES
router.get('/admin/system-setting', adminAuthMiddleware, systemSettingController.getSystemSetting);
router.put('/admin/system-setting', adminAuthMiddleware, uploadSystemSettings, handleUploadErrors, systemSettingController.updateSystemSetting);

module.exports = router;
