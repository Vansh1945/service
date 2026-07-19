const express = require('express');
const router = express.Router();
const emailTemplateController = require('../controllers/EmailTemplate-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { adminActionLimiter } = require('../middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../middlewares/fraud-middleware');

// EMAIL TEMPLATE MANAGEMENT ROUTES (Admin protected)
router.get('/settings/email-templates', adminAuthMiddleware, emailTemplateController.getEmailTemplates);
router.put('/settings/email-templates/:type', adminAuthMiddleware, adminActionLimiter, preventDuplicateSubmissions(3), emailTemplateController.updateEmailTemplate);
router.post('/settings/email-templates/preview', adminAuthMiddleware, adminActionLimiter, preventDuplicateSubmissions(3), emailTemplateController.previewEmailTemplate);
router.post('/settings/email-templates/test', adminAuthMiddleware, adminActionLimiter, preventDuplicateSubmissions(3), emailTemplateController.testSendEmailTemplate);
router.post('/settings/email-templates/restore', adminAuthMiddleware, adminActionLimiter, preventDuplicateSubmissions(3), emailTemplateController.restoreDefaultTemplate);

module.exports = router;
