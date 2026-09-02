const express = require('express');
const router = express.Router();
const surgeController = require('./surge-controller');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const {
  validateBody,
  validateParams,
  idParamSchema,
  createSurgeRuleSchema,
  updateSurgeRuleSchema,
  anyBodySchema
} = require('../../shared/validation/common-validation');
const { adminActionLimiter } = require('../../shared/middlewares/rate-limit');

// Public / customer checkout endpoint to resolve active surcharges
router.get('/resolve', surgeController.resolveActiveSurcharges);

// Admin routes for managing surge rules
router.post('/rules', adminAuthMiddleware, adminActionLimiter, validateBody(createSurgeRuleSchema), surgeController.createSurgeRule);
router.get('/rules', adminAuthMiddleware, surgeController.listSurgeRules);
router.get('/rules/:id', adminAuthMiddleware, validateParams(idParamSchema), surgeController.getSurgeRuleById);
router.patch('/rules/:id/toggle-status', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), validateBody(anyBodySchema), surgeController.toggleSurgeRuleStatus);
router.put('/rules/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), validateBody(updateSurgeRuleSchema), surgeController.updateSurgeRule);
router.delete('/rules/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), surgeController.deleteSurgeRule);

module.exports = router;
