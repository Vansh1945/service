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
} = require('./feedback-controller');
const { userAuthMiddleware } = require('../../shared/middlewares/user-middleware');
const { providerAuthMiddleware } = require('../../shared/middlewares/provider-middleware');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { validateBody } = require('../../shared/validation/common-validation');
const { submitFeedbackSchema, editFeedbackSchema } = require('./feedback-validation');



// Customer routes
const { feedbackLimiter } = require('../../shared/middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');

router.post('/', userAuthMiddleware, feedbackLimiter, preventDuplicateSubmissions(5), validateBody(submitFeedbackSchema), submitFeedback);
router.get('/my-feedbacks', userAuthMiddleware, getCustomerFeedbacks);
router.get('/:feedbackId', userAuthMiddleware, getFeedback);
router.put('/edit/:feedbackId', userAuthMiddleware, feedbackLimiter, preventDuplicateSubmissions(5), validateBody(editFeedbackSchema), editFeedback);


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