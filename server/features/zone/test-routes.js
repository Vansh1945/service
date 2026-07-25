const express = require('express');
const router = express.Router();
const testController = require('./test-controller');
const { providerAuthMiddleware } = require('../../shared/middlewares/provider-middleware');
const { roleMiddleware } = require('../../shared/middlewares/role-middleware');
const { validateBody } = require('../../shared/validation/common-validation');
const { startTestSchema, submitTestSchema } = require('./test-validation');

const requireProvider = roleMiddleware(['provider']);

router.use(providerAuthMiddleware, requireProvider);

router.get('/categories', testController.getTestCategories);
router.post('/start', validateBody(startTestSchema), testController.startTest);
router.get('/active', testController.getActiveTest);
router.get('/details/:testId', testController.getTestDetails);
router.post('/submit', validateBody(submitTestSchema), testController.submitTest);
router.get('/results', testController.getTestResults);

module.exports = router;
