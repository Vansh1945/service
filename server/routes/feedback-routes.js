const express = require('express');
const router = express.Router();
const {
  submitFeedback,
  getCustomerFeedbacks,
  getFeedbackDetail,
  updateFeedback,
  getProviderFeedbacks,
  getServiceFeedbacks
} = require('../controllers/feedback-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const {providerAuthMiddleware} = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Customer routes
router.post('/', userAuthMiddleware, submitFeedback);
router.get('/my-feedbacks', userAuthMiddleware, getCustomerFeedbacks);
router.get('/:id', userAuthMiddleware, getFeedbackDetail);
router.put('/:id', userAuthMiddleware, updateFeedback);

// Provider routes
router.get('/provider/feedbacks', providerAuthMiddleware, getProviderFeedbacks);

// Admin routes
router.get('/service/:serviceId', adminAuthMiddleware, getServiceFeedbacks);

module.exports = router;