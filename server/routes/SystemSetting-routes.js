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

// Combined upload for system settings (logo and favicon)
const uploadSystemSettings = multer({
  storage: new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
      let folder = 'systemLogo';
      let allowedFormats = ['jpg', 'jpeg', 'png'];
      let fileSizeLimit = 3 * 1024 * 1024; // 3MB

      if (file.fieldname === 'favicon') {
        folder = 'systemFavicon';
        allowedFormats = ['jpg', 'jpeg', 'png', 'ico'];
        fileSizeLimit = 1 * 1024 * 1024; // 1MB
      }

      return {
        folder: folder,
        resource_type: 'image',
        allowed_formats: allowedFormats,
        public_id: `${folder}_${Date.now()}_${file.originalname.split('.')[0].replace(/\s/g, '-')}`,
      };
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 }, // General limit, will be checked per field
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'favicon', maxCount: 1 }
]);

// PUBLIC ROUTES
router.get('/system-setting', systemSettingController.getSystemSetting);
router.get('/categories', systemSettingController.getActiveCategories);
router.get('/banners', systemSettingController.getBanners);

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
