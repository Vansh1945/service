const express = require('express');
const router = express.Router();
const surgeController = require('../controllers/Surge-controller');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');

// Public / customer checkout endpoint to resolve active surcharges
router.get('/resolve', surgeController.resolveActiveSurcharges);

// Admin routes for managing surge rules
router.post('/rules', adminAuthMiddleware, surgeController.createSurgeRule);
router.get('/rules', adminAuthMiddleware, surgeController.listSurgeRules);
router.get('/rules/:id', adminAuthMiddleware, surgeController.getSurgeRuleById);
router.patch('/rules/:id/toggle-status', adminAuthMiddleware, surgeController.toggleSurgeRuleStatus);
router.put('/rules/:id', adminAuthMiddleware, surgeController.updateSurgeRule);
router.delete('/rules/:id', adminAuthMiddleware, surgeController.deleteSurgeRule);

module.exports = router;
