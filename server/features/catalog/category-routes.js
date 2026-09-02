const express = require('express');
const router = express.Router();
const categoryController = require('./category-controller');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { uploadCategoryIcon, handleUploadErrors } = require('../../shared/middlewares/upload');

const { validateParams, idParamSchema } = require('../../shared/validation/common-validation');
const { adminActionLimiter } = require('../../shared/middlewares/rate-limit');

// PUBLIC ROUTE
router.get('/categories', categoryController.getActiveCategories);

// ADMIN ROUTES
router.post('/admin/categories', adminAuthMiddleware, adminActionLimiter, uploadCategoryIcon.fields([{ name: 'icon', maxCount: 1 }]), handleUploadErrors, categoryController.createCategory);
router.get('/admin/categories', adminAuthMiddleware, categoryController.getAllCategoriesAdmin);
router.put('/admin/categories/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), uploadCategoryIcon.fields([{ name: 'icon', maxCount: 1 }]), handleUploadErrors, categoryController.updateCategory);
router.delete('/admin/categories/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), categoryController.deleteCategory);
router.patch('/admin/categories/:id/toggle', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), categoryController.toggleCategoryStatus);

module.exports = router;
