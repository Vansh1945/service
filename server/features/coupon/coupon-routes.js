const express = require('express');
const router = express.Router();
const couponController = require('./coupon-controller');
const { userAuthMiddleware } = require('../../shared/middlewares/user-middleware');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { validateBody, validateParams, idParamSchema } = require('../../shared/validation/common-validation');
const { adminActionLimiter, feedbackLimiter } = require('../../shared/middlewares/rate-limit');
const {
  createCouponSchema,
  updateCouponSchema,
  applyCouponSchema,
  markCouponUsedSchema
} = require('./coupon-validation');

// ADMIN ROUTES
router.post('/admin/coupons', adminAuthMiddleware, adminActionLimiter, validateBody(createCouponSchema), couponController.createCoupon);
router.get('/admin/coupons', adminAuthMiddleware, couponController.getAllCoupons);
router.put('/admin/coupon/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), validateBody(updateCouponSchema), couponController.updateCoupon);
router.delete('/admin/coupons/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), couponController.deleteCoupon);
router.delete('/admin/coupons/:id/hard', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), couponController.hardDeleteCoupon);

// USER ROUTES
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');

router.post('/coupons/apply', userAuthMiddleware, feedbackLimiter, preventDuplicateSubmissions(5), validateBody(applyCouponSchema), couponController.applyCoupon);
router.post('/coupons/mark-used', userAuthMiddleware, validateBody(markCouponUsedSchema), couponController.markCouponUsed);
router.get('/coupons/available', userAuthMiddleware, couponController.getAvailableCoupons);

module.exports = router;