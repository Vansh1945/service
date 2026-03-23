const express = require('express');
const router = express.Router();
const couponController = require('../controllers/Coupon-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// ADMIN ROUTES
router.post('/admin/coupons', adminAuthMiddleware, couponController.createCoupon);
router.get('/admin/coupons', adminAuthMiddleware, couponController.getAllCoupons);
router.put('/admin/coupon/:id', adminAuthMiddleware, couponController.updateCoupon);
router.delete('/admin/coupons/:id', adminAuthMiddleware, couponController.deleteCoupon);
router.delete('/admin/coupons/:id/hard', adminAuthMiddleware, couponController.hardDeleteCoupon);

// USER ROUTES
router.post('/coupons/apply', userAuthMiddleware, couponController.applyCoupon);
router.post('/coupons/mark-used', userAuthMiddleware, couponController.markCouponUsed);
router.get('/coupons/available', userAuthMiddleware, couponController.getAvailableCoupons);

module.exports = router;