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
  submitContactSchema,
  replyToContactSchema
} = require('../../shared/validation/common-validation');



// Public routes
const { contactLimiter } = require('../../shared/middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');
router.post('/', contactLimiter, preventDuplicateSubmissions(5), validateBody(submitContactSchema), submitContact);

// Admin only routes
router.get('/admin', AdminMiddleware, getAllContacts);
router.get('/:id', AdminMiddleware, getContactById);
router.post('/:id/reply', AdminMiddleware, validateBody(replyToContactSchema), replyToContact);

module.exports = router;
