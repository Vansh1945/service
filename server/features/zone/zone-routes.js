const express = require("express");
const router = express.Router();
const zoneController = require('./zone-controller');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { roleMiddleware } = require('../../shared/middlewares/role-middleware');
const {
  validateBody,
  validateParams,
  idParamSchema,
  createZoneSchema,
  updateZoneSchema,
  resolveZoneByCoordinatesSchema,
  anyBodySchema
} = require('../../shared/validation/common-validation');
const { adminActionLimiter } = require('../../shared/middlewares/rate-limit');

const requireAdmin = roleMiddleware(['admin']);

router.post("/create", adminAuthMiddleware, requireAdmin, adminActionLimiter, validateBody(createZoneSchema), zoneController.createZone);
router.get("/all", zoneController.getAllZones);
router.get("/:id", validateParams(idParamSchema), zoneController.getZoneById);
router.put("/:id", adminAuthMiddleware, requireAdmin, adminActionLimiter, validateParams(idParamSchema), validateBody(updateZoneSchema), zoneController.updateZone);
router.delete("/:id", adminAuthMiddleware, requireAdmin, adminActionLimiter, validateParams(idParamSchema), zoneController.deleteZone);
router.patch("/toggle/:id", adminAuthMiddleware, requireAdmin, adminActionLimiter, validateParams(idParamSchema), validateBody(anyBodySchema), zoneController.toggleZoneStatus);
router.post("/resolve", validateBody(resolveZoneByCoordinatesSchema), zoneController.resolveZoneByCoordinates);

module.exports = router;
