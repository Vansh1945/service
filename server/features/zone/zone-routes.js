const express = require("express");
const router = express.Router();
const zoneController = require('./zone-controller');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { roleMiddleware } = require('../../shared/middlewares/role-middleware');
const {
  validateBody,
  createZoneSchema,
  updateZoneSchema,
  resolveZoneByCoordinatesSchema,
  anyBodySchema
} = require('../../shared/validation/common-validation');

const requireAdmin = roleMiddleware(['admin']);

router.post("/create", adminAuthMiddleware, requireAdmin, validateBody(createZoneSchema), zoneController.createZone);
router.get("/all", zoneController.getAllZones);
router.get("/:id", zoneController.getZoneById);
router.put("/:id", adminAuthMiddleware, requireAdmin, validateBody(updateZoneSchema), zoneController.updateZone);
router.delete("/:id", adminAuthMiddleware, requireAdmin, zoneController.deleteZone);
router.patch("/toggle/:id", adminAuthMiddleware, requireAdmin, validateBody(anyBodySchema), zoneController.toggleZoneStatus);
router.post("/resolve", validateBody(resolveZoneByCoordinatesSchema), zoneController.resolveZoneByCoordinates);

module.exports = router;
