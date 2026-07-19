const express = require('express');
const router = express.Router();
const testController = require('../controllers/Test-controller');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const { roleMiddleware } = require('../middlewares/role-middleware');
const { validateBody } = require('../validation/common.validation');
const { startTestSchema, submitTestSchema } = require('../validation/test.validation');

const requireProvider = roleMiddleware(['provider']);

router.use(providerAuthMiddleware, requireProvider);

router.get('/categories', testController.getTestCategories);
router.post('/start', validateBody(startTestSchema), testController.startTest);
router.get('/active', testController.getActiveTest);
router.get('/details/:testId', testController.getTestDetails);
router.post('/submit', validateBody(submitTestSchema), testController.submitTest);
router.get('/results', testController.getTestResults);

module.exports = router;
