const express = require('express');
const router = express.Router();
const systemSettingController = require('../controllers/SystemSetting-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// PUBLIC ROUTES
router.get('/system-setting', systemSettingController.getSystemSetting);
router.get('/categories', systemSettingController.getActiveCategories);

// ADMIN ROUTES (protected by adminAuth middleware)
router.use('/admin', adminAuthMiddleware);

router.get('/admin/system-setting', systemSettingController.getSystemSetting);
router.put('/admin/system-setting', systemSettingController.updateSystemSetting);
router.post('/admin/categories', systemSettingController.createCategory);
router.get('/admin/categories', systemSettingController.getAllCategoriesAdmin);
router.put('/admin/categories/:id', systemSettingController.updateCategory);
router.delete('/admin/categories/:id', systemSettingController.deleteCategory);
router.patch('/admin/categories/:id/toggle', systemSettingController.toggleCategoryStatus);

module.exports = router;
