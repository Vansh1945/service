const express = require('express');
const router = express.Router();
const questionController = require('../controllers/Question-controller');

const adminAuthMiddleware = require('../middlewares/Admin-middleware');


// ===================== ADMIN ROUTES ===================== //
router.post('/', adminAuthMiddleware, questionController.createQuestion);
router.put('/edit/:id', adminAuthMiddleware, questionController.updateQuestion);
router.put('/disable/:id', adminAuthMiddleware, questionController.disableQuestion);
router.put('/toggle/:id', adminAuthMiddleware, questionController.toggleQuestionStatus);
router.delete('/:id', adminAuthMiddleware, questionController.deleteQuestion);
router.get('/get', adminAuthMiddleware, questionController.getAllQuestions);
router.get('/:id', adminAuthMiddleware, questionController.getQuestion);
router.post('/bulk', adminAuthMiddleware, questionController.createBulkQuestions);
router.get('/download/pdf', adminAuthMiddleware, questionController.downloadQuestionsPDF);

module.exports = router;
