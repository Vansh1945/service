//commisionRoutes.js
const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/Commission-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Admin routes for managing commission rules
router.post('/create-rules', adminAuthMiddleware, commissionController.createCommissionRule);
router.get('/rules', adminAuthMiddleware, commissionController.listCommissionRules);
router.get('/rules/:id', adminAuthMiddleware, commissionController.getCommissionRuleById);
router.patch('/rules/:id/toggle-status', adminAuthMiddleware, commissionController.toggleCommissionRuleStatus);
router.put('/rules/:id', adminAuthMiddleware, commissionController.updateCommissionRule);
router.delete('/rules/:id', adminAuthMiddleware, commissionController.deleteCommissionRule);



module.exports = router;