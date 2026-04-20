const express = require("express");
const router = express.Router();
const {
  submitComplaint,
  getAllComplaints,
  getMyComplaints,
  getComplaint,
  resolveComplaint,
  updateComplaintStatus,
  reopenComplaint,
  getComplaintDetails,
} = require("../controllers/Complaint-controller");
const { uploadComplaintImage } = require("../middlewares/upload");
const { userAuthMiddleware } = require("../middlewares/User-middleware");
const { providerAuthMiddleware } = require("../middlewares/Provider-middleware");
const adminAuthMiddleware = require("../middlewares/Admin-middleware");
const { roleMiddleware } = require("../middlewares/role-middleware");
const requireCustomerOrProvider = roleMiddleware(['customer', 'provider']);
const requireAdmin = roleMiddleware(['admin']);

// Customer routes
router.post(
  "/",
  userAuthMiddleware,
  uploadComplaintImage.array("images", 5),
  submitComplaint
);

// Shared routes (Available for both Customer and Provider)
router.get("/my-complaints", userAuthMiddleware, requireCustomerOrProvider, providerAuthMiddleware, getMyComplaints);
router.get("/:id", userAuthMiddleware, requireCustomerOrProvider, providerAuthMiddleware, getComplaint);
router.put("/:id/reopen", userAuthMiddleware, requireCustomerOrProvider, providerAuthMiddleware, reopenComplaint);

// Admin routes
router.get("/", adminAuthMiddleware, requireAdmin, getAllComplaints);
router.get("/:id/details", adminAuthMiddleware, requireAdmin, getComplaintDetails);
router.put("/:id/resolve", adminAuthMiddleware, requireAdmin, resolveComplaint);
router.put("/:id/status", adminAuthMiddleware, requireAdmin, updateComplaintStatus);

module.exports = router;
