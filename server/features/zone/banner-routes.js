const express = require('express');
const router = express.Router();
const bannerController = require('./banner-controller');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { uploadBannerImage, handleUploadErrors } = require('../../shared/middlewares/upload');

const { validateParams, idParamSchema } = require('../../shared/validation/common-validation');
const { adminActionLimiter } = require('../../shared/middlewares/rate-limit');

// PUBLIC ROUTE
router.get('/banners', bannerController.getBanners);

// ADMIN ROUTES
router.post('/admin/banners', adminAuthMiddleware, adminActionLimiter, uploadBannerImage.fields([{ name: 'image', maxCount: 1 }]), handleUploadErrors, bannerController.createBanner);
router.get('/admin/banners', adminAuthMiddleware, bannerController.getAllBannersAdmin);
router.put('/admin/banners/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), uploadBannerImage.fields([{ name: 'image', maxCount: 1 }]), handleUploadErrors, bannerController.updateBanner);
router.delete('/admin/banners/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), bannerController.deleteBanner);

module.exports = router;
