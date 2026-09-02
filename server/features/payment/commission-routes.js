//commisionRoutes.js
const express = require('express');
const router = express.Router();
const commissionController = require('./commission-controller');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const {
  validateBody,
  validateParams,
  idParamSchema,
  createCommissionRuleSchema,
  updateCommissionRuleSchema,
  anyBodySchema
} = require('../../shared/validation/common-validation');
const { adminActionLimiter } = require('../../shared/middlewares/rate-limit');

router.post('/rules', adminAuthMiddleware, adminActionLimiter, validateBody(createCommissionRuleSchema), commissionController.createCommissionRule);
router.post('/preview', adminAuthMiddleware, adminActionLimiter, commissionController.previewCommissionRule);
router.get('/rules', adminAuthMiddleware, commissionController.listCommissionRules);
router.get('/rules/:id', adminAuthMiddleware, validateParams(idParamSchema), commissionController.getCommissionRuleById);
router.patch('/rules/:id/toggle-status', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), validateBody(anyBodySchema), commissionController.toggleCommissionRuleStatus);
router.put('/rules/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), validateBody(updateCommissionRuleSchema), commissionController.updateCommissionRule);
router.delete('/rules/:id', adminAuthMiddleware, adminActionLimiter, validateParams(idParamSchema), commissionController.deleteCommissionRule);



module.exports = router;