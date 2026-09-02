const express = require('express');
const router = express.Router();
const systemSettingController = require('./system-setting-controller');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../../shared/config/cloudinary');
const { handleUploadErrors, fileFilterHelper } = require('../../shared/middlewares/upload');

// Sub-routers
const categoryRoutes = require('../catalog/category-routes');
const bannerRoutes = require('../zone/banner-routes');
const brandingRoutes = require('../admin/branding-routes');
const emailTemplateRoutes = require('../template/email-template-routes');

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
  fileFilter: fileFilterHelper(
    ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/x-icon', 'image/vnd.microsoft.icon', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a', 'video/mp4'],
    ['jpg', 'jpeg', 'png', 'gif', 'ico', 'mp3', 'wav', 'ogg', 'aac', 'm4a', 'mp4']
  )
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

const { adminActionLimiter } = require('../../shared/middlewares/rate-limit');

// CORE PUBLIC ROUTES
router.get('/system-data', systemSettingController.getSystemSetting);
router.get('/validate-ifsc/:code', systemSettingController.validateIfsc);

// CORE ADMIN ROUTES
router.get('/admin/system-setting', adminAuthMiddleware, systemSettingController.getSystemSetting);
router.put('/admin/system-setting', adminAuthMiddleware, adminActionLimiter, uploadSystemSettings, handleUploadErrors, systemSettingController.updateSystemSetting);

module.exports = router;
