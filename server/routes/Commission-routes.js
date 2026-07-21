//commisionRoutes.js
const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/Commission-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const {
  validateBody,
  createCommissionRuleSchema,
  updateCommissionRuleSchema,
  anyBodySchema
} = require('../validation/common.validation');


router.post('/rules', adminAuthMiddleware, validateBody(createCommissionRuleSchema), commissionController.createCommissionRule);
router.get('/rules', adminAuthMiddleware, commissionController.listCommissionRules);
router.get('/rules/:id', adminAuthMiddleware, commissionController.getCommissionRuleById);
router.patch('/rules/:id/toggle-status', adminAuthMiddleware, validateBody(anyBodySchema), commissionController.toggleCommissionRuleStatus);
router.put('/rules/:id', adminAuthMiddleware, validateBody(updateCommissionRuleSchema), commissionController.updateCommissionRule);
router.delete('/rules/:id', adminAuthMiddleware, commissionController.deleteCommissionRule);



module.exports = router;