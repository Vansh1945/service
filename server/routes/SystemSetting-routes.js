const express = require('express');
const router = express.Router();
const systemSettingController = require('../controllers/SystemSetting-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../services/cloudinary');
const {
  uploadSystemLogo,
  uploadSystemFavicon,
  uploadCategoryIcon,
  uploadBannerImage,
  handleUploadErrors
} = require('../middlewares/upload');

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
  { name: 'providerBookingRingtone', maxCount: 1 }
]);

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

// PUBLIC ROUTES
router.get('/system-data', systemSettingController.getSystemSetting);
router.get('/categories', systemSettingController.getActiveCategories);
router.get('/banners', systemSettingController.getBanners);
router.get('/settings/branding-logo', systemSettingController.getBrandingLogoRedirect);
router.get('/settings/branding-favicon', systemSettingController.getBrandingFaviconRedirect);
router.get('/validate-ifsc/:code', systemSettingController.validateIfsc);

// BRANDING ROUTES (Publicly readable, but updates are admin protected)
router.get('/settings/branding/:role', systemSettingController.getBrandingSettings);
router.get('/settings/branding/:role/manifest', systemSettingController.getBrandingManifest);
router.put('/settings/branding/:role', adminAuthMiddleware, systemSettingController.updateBrandingSettings);
router.post('/settings/branding/:role/upload', adminAuthMiddleware, uploadBrandingSettings, handleUploadErrors, systemSettingController.uploadBrandingAsset);
router.post('/settings/branding/:role/publish', adminAuthMiddleware, systemSettingController.publishBrandingUpdate);

// EMAIL TEMPLATE MANAGEMENT ROUTES (Admin protected)
router.get('/settings/email-templates', adminAuthMiddleware, systemSettingController.getEmailTemplates);
router.put('/settings/email-templates/:type', adminAuthMiddleware, systemSettingController.updateEmailTemplate);
router.post('/settings/email-templates/preview', adminAuthMiddleware, systemSettingController.previewEmailTemplate);
router.post('/settings/email-templates/test', adminAuthMiddleware, systemSettingController.testSendEmailTemplate);
router.post('/settings/email-templates/restore', adminAuthMiddleware, systemSettingController.restoreDefaultTemplate);

// ADMIN ROUTES (protected by adminAuth middleware)
router.use('/admin', adminAuthMiddleware);

router.get('/admin/system-setting', systemSettingController.getSystemSetting);
router.put('/admin/system-setting', uploadSystemSettings, handleUploadErrors, systemSettingController.updateSystemSetting);
router.post('/admin/categories', uploadCategoryIcon.fields([{ name: 'icon', maxCount: 1 }]), handleUploadErrors, systemSettingController.createCategory);
router.get('/admin/categories', systemSettingController.getAllCategoriesAdmin);
router.put('/admin/categories/:id', uploadCategoryIcon.fields([{ name: 'icon', maxCount: 1 }]), handleUploadErrors, systemSettingController.updateCategory);
router.delete('/admin/categories/:id', systemSettingController.deleteCategory);
router.patch('/admin/categories/:id/toggle', systemSettingController.toggleCategoryStatus);
router.post('/admin/banners', uploadBannerImage.fields([{ name: 'image', maxCount: 1 }]), handleUploadErrors, systemSettingController.createBanner);
router.get('/admin/banners', systemSettingController.getAllBannersAdmin);
router.put('/admin/banners/:id', uploadBannerImage.fields([{ name: 'image', maxCount: 1 }]), handleUploadErrors, systemSettingController.updateBanner);
router.delete('/admin/banners/:id', systemSettingController.deleteBanner);

module.exports = router;
