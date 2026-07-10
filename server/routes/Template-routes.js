const express = require('express');
const router = express.Router();
const templateController = require('../controllers/Template-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Protect all routes with admin middleware
router.use(adminAuthMiddleware);

router.get('/', templateController.getTemplates);
router.get('/:key', templateController.getTemplateByKey);
router.post('/:key/version', templateController.saveTemplateVersion);
router.post('/:key/version/:versionNumber/publish', templateController.publishTemplateVersion);
router.post('/:key/version/:versionNumber/restore', templateController.restoreTemplateVersion);
router.post('/:key/version/:versionNumber/duplicate', templateController.duplicateTemplateVersion);
router.post('/:key/preview', templateController.previewTemplate);

module.exports = router;
