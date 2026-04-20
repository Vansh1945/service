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
const jwt = require("jsonwebtoken");
const User = require("../models/User-model");
const Provider = require("../models/Provider-model");

// Unified Auth Middleware for both Customers and Providers
const combinedAuthMiddleware = async (req, res, next) => {
  const token = req.header("Authorization");
  if (!token || !token.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const jwtToken = token.replace("Bearer ", "").trim();
  try {
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
    if (decoded.role === "customer") {
      const user = await User.findById(decoded.id).select("-password");
      if (!user) return res.status(401).json({ success: false, message: "User not found" });
      req.user = user;
      req.role = "customer";
    } else if (decoded.role === "provider") {
      const provider = await Provider.findById(decoded.id).select("-password");
      if (!provider) return res.status(401).json({ success: false, message: "Provider not found" });
      req.user = provider; // Set as req.user for controller compatibility
      req.role = "provider";
    } else {
      return res.status(403).json({ success: false, message: "Invalid role access" });
    }
    next();
  } catch (error) {
    console.error("Combined Auth Error:", error);
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

const requireAdmin = roleMiddleware(['admin']);

// Customer routes
router.post(
  "/",
  combinedAuthMiddleware,
  uploadComplaintImage.array("images", 5),
  submitComplaint
);

// Shared routes (Available for both Customer and Provider)
router.get("/my-complaints", combinedAuthMiddleware, getMyComplaints);
router.get("/:id", combinedAuthMiddleware, getComplaint);
router.put("/:id/reopen", combinedAuthMiddleware, reopenComplaint);

// Admin routes
router.get("/", adminAuthMiddleware, requireAdmin, getAllComplaints);
router.get("/:id/details", adminAuthMiddleware, requireAdmin, getComplaintDetails);
router.put("/:id/resolve", adminAuthMiddleware, requireAdmin, resolveComplaint);
router.put("/:id/status", adminAuthMiddleware, requireAdmin, updateComplaintStatus);

module.exports = router;
