const express = require('express');
const router = express.Router();
const {
  submitContact,
  getAllContacts,
  replyToContact,
  getContactById
} = require('./contact-controller');
const AdminMiddleware = require('../../shared/middlewares/admin-middleware');
const {
  validateBody,
  validateParams,
  idParamSchema,
  submitContactSchema,
  replyToContactSchema
} = require('../../shared/validation/common-validation');
const { contactLimiter, adminActionLimiter } = require('../../shared/middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');

// Public routes
router.post('/', contactLimiter, preventDuplicateSubmissions(5), validateBody(submitContactSchema), submitContact);

// Admin only routes
router.get('/admin', AdminMiddleware, getAllContacts);
router.get('/:id', AdminMiddleware, validateParams(idParamSchema), getContactById);
router.post('/:id/reply', AdminMiddleware, adminActionLimiter, validateParams(idParamSchema), validateBody(replyToContactSchema), replyToContact);

module.exports = router;
