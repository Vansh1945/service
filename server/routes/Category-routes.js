const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/Category-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { uploadCategoryIcon, handleUploadErrors } = require('../middlewares/upload');

// PUBLIC ROUTE
router.get('/categories', categoryController.getActiveCategories);

// ADMIN ROUTES
router.post('/admin/categories', adminAuthMiddleware, uploadCategoryIcon.fields([{ name: 'icon', maxCount: 1 }]), handleUploadErrors, categoryController.createCategory);
router.get('/admin/categories', adminAuthMiddleware, categoryController.getAllCategoriesAdmin);
router.put('/admin/categories/:id', adminAuthMiddleware, uploadCategoryIcon.fields([{ name: 'icon', maxCount: 1 }]), handleUploadErrors, categoryController.updateCategory);
router.delete('/admin/categories/:id', adminAuthMiddleware, categoryController.deleteCategory);
router.patch('/admin/categories/:id/toggle', adminAuthMiddleware, categoryController.toggleCategoryStatus);

module.exports = router;
