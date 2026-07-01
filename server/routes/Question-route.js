const express = require('express');
const router = express.Router();
const questionController = require('../controllers/Question-controller');
const {
  validateBody,
  createQuestionSchema,
  updateQuestionSchema,
  createBulkQuestionsSchema,
  anyBodySchema
} = require('../validation/common.validation');

const adminAuthMiddleware = require('../middlewares/Admin-middleware');


// ===================== ADMIN ROUTES ===================== //
router.post('/', adminAuthMiddleware, validateBody(createQuestionSchema), questionController.createQuestion);
router.put('/edit/:id', adminAuthMiddleware, validateBody(updateQuestionSchema), questionController.updateQuestion);
router.put('/disable/:id', adminAuthMiddleware, validateBody(anyBodySchema), questionController.disableQuestion);
router.put('/toggle/:id', adminAuthMiddleware, validateBody(anyBodySchema), questionController.toggleQuestionStatus);
router.delete('/:id', adminAuthMiddleware, questionController.deleteQuestion);
router.get('/get', adminAuthMiddleware, questionController.getAllQuestions);
router.get('/:id', adminAuthMiddleware, questionController.getQuestion);
router.post('/bulk', adminAuthMiddleware, validateBody(createBulkQuestionsSchema), questionController.createBulkQuestions);
router.get('/download/pdf', adminAuthMiddleware, questionController.downloadQuestionsPDF);

module.exports = router;
