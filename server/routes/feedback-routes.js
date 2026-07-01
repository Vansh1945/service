const express = require('express');
const router = express.Router();
const {
  submitFeedback,
  getCustomerFeedbacks,
  getProviderFeedbacks,
  getProviderAverageRating,
  getAllFeedbacks,
  getFeedback,
  editFeedback,
  deleteFeedback,
  deleteFeedbackAdmin,
  getServiceFeedbacks,
  toggleFeedbackApproval
} = require('../controllers/feedback-controller');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { validateBody } = require('../validation/common.validation');
const { submitFeedbackSchema, editFeedbackSchema } = require('../validation/feedback.validation');

const { feedbackLimiter } = require('../middlewares/rate-limit');

// Customer routes
router.post('/', userAuthMiddleware, feedbackLimiter, validateBody(submitFeedbackSchema), submitFeedback);
router.get('/my-feedbacks', userAuthMiddleware, getCustomerFeedbacks);
router.get('/:feedbackId', userAuthMiddleware, getFeedback);
router.put('/edit/:feedbackId', userAuthMiddleware, validateBody(editFeedbackSchema), editFeedback);


// Public route to get all feedbacks for a specific service
router.get('/service/:serviceId', getServiceFeedbacks);

// Provider routes
router.get('/provider/my-feedbacks', providerAuthMiddleware, getProviderFeedbacks);
router.get('/provider/average-rating', providerAuthMiddleware, getProviderAverageRating);

// Admin routes
router.get('/admin/all-feedbacks', adminAuthMiddleware, getAllFeedbacks);
router.get('/admin/:feedbackId', adminAuthMiddleware, getFeedback);
router.patch('/admin/toggle-approval/:feedbackId', adminAuthMiddleware, toggleFeedbackApproval);
router.delete('/admin/:feedbackId', adminAuthMiddleware, deleteFeedbackAdmin);


module.exports = router;