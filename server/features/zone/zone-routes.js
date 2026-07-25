const express = require("express");
const router = express.Router();
const zoneController = require('./zone-controller');
const {
  validateBody,
  createZoneSchema,
  updateZoneSchema,
  resolveZoneByCoordinatesSchema,
  anyBodySchema
} = require('../../shared/validation/common-validation');

router.post("/create", validateBody(createZoneSchema), zoneController.createZone);
router.get("/all", zoneController.getAllZones);
router.get("/:id", zoneController.getZoneById);
router.put("/:id", validateBody(updateZoneSchema), zoneController.updateZone);
router.delete("/:id", zoneController.deleteZone);
router.patch("/toggle/:id", validateBody(anyBodySchema), zoneController.toggleZoneStatus);
router.post("/resolve", validateBody(resolveZoneByCoordinatesSchema), zoneController.resolveZoneByCoordinates);

module.exports = router;
