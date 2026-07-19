const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/Banner-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { uploadBannerImage, handleUploadErrors } = require('../middlewares/upload');

// PUBLIC ROUTE
router.get('/banners', bannerController.getBanners);

// ADMIN ROUTES
router.post('/admin/banners', adminAuthMiddleware, uploadBannerImage.fields([{ name: 'image', maxCount: 1 }]), handleUploadErrors, bannerController.createBanner);
router.get('/admin/banners', adminAuthMiddleware, bannerController.getAllBannersAdmin);
router.put('/admin/banners/:id', adminAuthMiddleware, uploadBannerImage.fields([{ name: 'image', maxCount: 1 }]), handleUploadErrors, bannerController.updateBanner);
router.delete('/admin/banners/:id', adminAuthMiddleware, bannerController.deleteBanner);

module.exports = router;
