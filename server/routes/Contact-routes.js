const express = require('express');
const router = express.Router();
const {
  submitContact,
  getAllContacts,
  replyToContact,
  getContactById
} = require('../controllers/Contact-controller');
const AdminMiddleware = require('../middlewares/Admin-middleware');
const {
  validateBody,
  submitContactSchema,
  replyToContactSchema
} = require('../validation/common.validation');



// Public routes
const { contactLimiter } = require('../middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../middlewares/fraud-middleware');
router.post('/', contactLimiter, preventDuplicateSubmissions(5), validateBody(submitContactSchema), submitContact);

// Admin only routes
router.get('/admin', AdminMiddleware, getAllContacts);
router.get('/:id', AdminMiddleware, getContactById);
router.post('/:id/reply', AdminMiddleware, validateBody(replyToContactSchema), replyToContact);

module.exports = router;
