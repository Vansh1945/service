const express = require('express');
const router = express.Router();
const templateController = require('./template-controller');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');

const { adminActionLimiter } = require('../../shared/middlewares/rate-limit');

// Protect all routes with admin middleware
router.use(adminAuthMiddleware);

router.get('/', templateController.getTemplates);
router.get('/:key', templateController.getTemplateByKey);
router.post('/:key/version', adminActionLimiter, templateController.saveTemplateVersion);
router.post('/:key/version/:versionNumber/publish', adminActionLimiter, templateController.publishTemplateVersion);
router.post('/:key/version/:versionNumber/restore', adminActionLimiter, templateController.restoreTemplateVersion);
router.post('/:key/version/:versionNumber/duplicate', adminActionLimiter, templateController.duplicateTemplateVersion);
router.post('/:key/preview', templateController.previewTemplate);

module.exports = router;
