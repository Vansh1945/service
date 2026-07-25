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
  replyToComplaint
} = require('./complaint-controller');
const { uploadComplaintImage } = require('../../shared/middlewares/upload');
const { userAuthMiddleware } = require('../../shared/middlewares/user-middleware');
const { providerAuthMiddleware } = require('../../shared/middlewares/provider-middleware');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { roleMiddleware } = require('../../shared/middlewares/role-middleware');
const { validateBody } = require('../../shared/validation/common-validation');
const {
  submitComplaintSchema,
  resolveComplaintSchema,
  updateComplaintStatusSchema,
  reopenComplaintSchema,
  replyToComplaintSchema
} = require('./complaint-validation');

const { sharedAuthMiddleware } = require('../../shared/middlewares/shared-auth-middleware');

const requireCustomerOrProvider = roleMiddleware(['customer', 'provider']);
const requireAdmin = roleMiddleware(['admin']);

// Customer & Provider routes
const { feedbackLimiter } = require('../../shared/middlewares/rate-limit');
const { preventDuplicateSubmissions } = require('../../shared/middlewares/fraud-middleware');

router.post(
  "/",
  sharedAuthMiddleware,
  feedbackLimiter,
  preventDuplicateSubmissions(5),
  uploadComplaintImage.array("images", 5),
  validateBody(submitComplaintSchema),
  submitComplaint
);

// Shared routes ( Customer and Provider )
router.get("/my-complaints", sharedAuthMiddleware, getMyComplaints);
router.get("/:id", sharedAuthMiddleware, getComplaint);
router.put("/:id/reopen", sharedAuthMiddleware, feedbackLimiter, preventDuplicateSubmissions(5), validateBody(reopenComplaintSchema), reopenComplaint);

// Reply route (Admin and Provider)
router.post(
  "/:id/reply",
  sharedAuthMiddleware,
  feedbackLimiter,
  preventDuplicateSubmissions(5),
  uploadComplaintImage.array("images", 5),
  validateBody(replyToComplaintSchema),
  replyToComplaint
);

// Admin routes
router.get("/", adminAuthMiddleware, requireAdmin, getAllComplaints);
router.get("/:id/details", adminAuthMiddleware, requireAdmin, getComplaintDetails);
router.put("/:id/resolve", adminAuthMiddleware, requireAdmin, validateBody(resolveComplaintSchema), resolveComplaint);
router.put("/:id/status", adminAuthMiddleware, requireAdmin, validateBody(updateComplaintStatusSchema), updateComplaintStatus);

module.exports = router;
