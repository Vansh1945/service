const express = require('express');
const router = express.Router();
const bannerController = require('../controllers/bannerController');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { uploadBannerImage, handleUploadErrors } = require('../middlewares/upload');

/**
 * ADMIN ROUTES
 */
router.post('/admin/banners',
    adminAuthMiddleware,
    uploadBannerImage.single('image'),
    handleUploadErrors,
    bannerController.createBanner
);

router.put('/admin/banners/:id',
    adminAuthMiddleware,
    uploadBannerImage.single('image'),
    handleUploadErrors,
    bannerController.updateBanner
);

router.delete('/admin/banners/:id',
    adminAuthMiddleware,
    bannerController.deleteBanner
);

router.delete('/admin/banners/:id/permanent',
    adminAuthMiddleware,
    bannerController.deleteBannerPermanently
);

router.get('/admin/banners',
    adminAuthMiddleware,
    bannerController.getAllBanners
);

router.get('/admin/banners/:id',
    adminAuthMiddleware,
    bannerController.getBannerById
);

/**
 * PUBLIC ROUTES
 */
router.get('/banners', bannerController.getActiveBanners);

module.exports = router;
