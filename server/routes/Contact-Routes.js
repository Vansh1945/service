const express = require('express');
const router = express.Router();
const { submitContact, getAllContacts, replyToContact } = require('../controllers/Contact-controller');
const adminMiddleware = require('../middlewares/Admin-middleware');

// Public route - submit contact form
router.post('/contact-submit', submitContact);

// Admin protected routes
router.get('/contacts', adminMiddleware, getAllContacts);
router.post('/contact/:id/reply', adminMiddleware, replyToContact);

module.exports = router;
