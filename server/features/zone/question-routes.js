const express = require('express');
const router = express.Router();
const questionController = require('./question-controller');
const {
  validateBody,
  validateParams,
  idParamSchema,
  createQuestionSchema,
  updateQuestionSchema,
  createBulkQuestionsSchema,
  anyBodySchema
} = require('../../shared/validation/common-validation');

const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { adminActionLimiter } = require('../../shared/middlewares/rate-limit');


// ===================== ADMIN ROUTES ===================== //
router.post('/', adminAuthMiddleware, adminActionLimiter, validateBody(createQuestionSchema), questionController.createQuestion);
router.put('/edit/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), validateBody(updateQuestionSchema), questionController.updateQuestion);
router.put('/disable/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), validateBody(anyBodySchema), questionController.disableQuestion);
router.put('/toggle/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), validateBody(anyBodySchema), questionController.toggleQuestionStatus);
router.delete('/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), questionController.deleteQuestion);
router.get('/get', adminAuthMiddleware, questionController.getAllQuestions);
router.get('/:id', adminAuthMiddleware, validateParams(idParamSchema), questionController.getQuestion);
router.post('/bulk', adminAuthMiddleware, adminActionLimiter, validateBody(createBulkQuestionsSchema), questionController.createBulkQuestions);
router.get('/download/pdf', adminAuthMiddleware, questionController.downloadQuestionsPDF);

module.exports = router;
