const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
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

// Unified Auth for Customer and Provider
const sharedAuth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ success: false, message: "Authorization required" });

  try {
    const jwtToken = token.replace("Bearer ", "").trim();
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);

    if (decoded.role === 'provider') {
      return providerAuthMiddleware(req, res, next);
    } else {
      return userAuthMiddleware(req, res, next);
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid session" });
  }
};

const requireCustomerOrProvider = roleMiddleware(['customer', 'provider']);
const requireAdmin = roleMiddleware(['admin']);

// Customer & Provider routes
router.post(
  "/",
  sharedAuth,
  uploadComplaintImage.array("images", 5),
  submitComplaint
);

// Shared routes ( Customer and Provider )
router.get("/my-complaints", sharedAuth, getMyComplaints);
router.get("/:id", sharedAuth, getComplaint);
router.put("/:id/reopen", sharedAuth, reopenComplaint);

// Admin routes
router.get("/", adminAuthMiddleware, requireAdmin, getAllComplaints);
router.get("/:id/details", adminAuthMiddleware, requireAdmin, getComplaintDetails);
router.put("/:id/resolve", adminAuthMiddleware, requireAdmin, resolveComplaint);
router.put("/:id/status", adminAuthMiddleware, requireAdmin, updateComplaintStatus);

module.exports = router;
