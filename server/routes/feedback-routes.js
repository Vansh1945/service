const express = require('express');
const router = express.Router();
const {
  submitFeedback,
  getCustomerFeedbacks,
  getProviderFeedbacks,
  getAllFeedbacks,
  getServiceFeedbacks,
  getFeedback,
  editFeedback
} = require('../controllers/feedback-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Customer routes
router.post('/', userAuthMiddleware, submitFeedback);
router.get('/my-feedbacks', userAuthMiddleware, getCustomerFeedbacks);
router.get('/:feedbackId', userAuthMiddleware, getFeedback);
router.put('/:feedbackId', userAuthMiddleware, editFeedback);

// Provider routes
router.get('/provider/my-feedbacks', providerAuthMiddleware, getProviderFeedbacks);

// Admin routes
router.get('/admin/all-feedbacks', adminAuthMiddleware, getAllFeedbacks);
router.get('/admin/service/:serviceId', adminAuthMiddleware, getServiceFeedbacks);

module.exports = router;