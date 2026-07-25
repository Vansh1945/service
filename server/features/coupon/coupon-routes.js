const express = require('express');
const router = express.Router();
const couponController = require('./coupon-controller');
const { userAuthMiddleware } = require('../../shared/middlewares/user-middleware');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { validateBody } = require('../../shared/validation/common-validation');
const {
  createCouponSchema,
  updateCouponSchema,
  applyCouponSchema,
  markCouponUsedSchema
} = require('./coupon-validation');

// ADMIN ROUTES
router.post('/admin/coupons', adminAuthMiddleware, validateBody(createCouponSchema), couponController.createCoupon);
router.get('/admin/coupons', adminAuthMiddleware, couponController.getAllCoupons);
router.put('/admin/coupon/:id', adminAuthMiddleware, validateBody(updateCouponSchema), couponController.updateCoupon);
router.delete('/admin/coupons/:id', adminAuthMiddleware, couponController.deleteCoupon);
router.delete('/admin/coupons/:id/hard', adminAuthMiddleware, couponController.hardDeleteCoupon);

// USER ROUTES
const { feedbackLimiter } = require('../../shared/middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');

router.post('/coupons/apply', userAuthMiddleware, feedbackLimiter, preventDuplicateSubmissions(5), validateBody(applyCouponSchema), couponController.applyCoupon);
router.post('/coupons/mark-used', userAuthMiddleware, validateBody(markCouponUsedSchema), couponController.markCouponUsed);
router.get('/coupons/available', userAuthMiddleware, couponController.getAvailableCoupons);

module.exports = router;