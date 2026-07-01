const express = require('express');
const router = express.Router();
const surgeController = require('../controllers/Surge-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const {
  validateBody,
  createSurgeRuleSchema,
  updateSurgeRuleSchema,
  anyBodySchema
} = require('../validation/common.validation');

// Public / customer checkout endpoint to resolve active surcharges
router.get('/resolve', surgeController.resolveActiveSurcharges);

// Admin routes for managing surge rules
router.post('/rules', adminAuthMiddleware, validateBody(createSurgeRuleSchema), surgeController.createSurgeRule);
router.get('/rules', adminAuthMiddleware, surgeController.listSurgeRules);
router.get('/rules/:id', adminAuthMiddleware, surgeController.getSurgeRuleById);
router.patch('/rules/:id/toggle-status', adminAuthMiddleware, validateBody(anyBodySchema), surgeController.toggleSurgeRuleStatus);
router.put('/rules/:id', adminAuthMiddleware, validateBody(updateSurgeRuleSchema), surgeController.updateSurgeRule);
router.delete('/rules/:id', adminAuthMiddleware, surgeController.deleteSurgeRule);

module.exports = router;
