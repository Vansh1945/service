const express = require("express");
const router = express.Router();
const zoneController = require("../controllers/zone.controller");

router.post("/create", zoneController.createZone);
router.get("/all", zoneController.getAllZones);
router.get("/:id", zoneController.getZoneById);
router.put("/:id", zoneController.updateZone);
router.delete("/:id", zoneController.deleteZone);
router.patch("/toggle/:id", zoneController.toggleZoneStatus);
router.post("/resolve", zoneController.resolveZoneByCoordinates);

module.exports = router;
