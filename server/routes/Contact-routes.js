const express = require('express');
const router = express.Router();
const {
  submitContact,
  getAllContacts,
  replyToContact,
  getContactById
} = require('../controllers/Contact-controller');
const AdminMiddleware = require('../middlewares/Admin-middleware');

// Public routes
router.post('/', submitContact);

// Admin only routes
router.get('/admin', AdminMiddleware, getAllContacts);
router.get('/:id', AdminMiddleware, getContactById);
router.post('/:id/reply', AdminMiddleware, replyToContact);

module.exports = router;
