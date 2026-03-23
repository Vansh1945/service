const express = require('express');
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
} = require('../controllers/Complaint-controller');
const { uploadComplaintImage } = require('../middlewares/upload');
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');


// Customer routes
router.post(
  '/',
  userAuthMiddleware,
  uploadComplaintImage.array('images', 5),
  submitComplaint
);


// Shared routes
router.get('/my-complaints', userAuthMiddleware, getMyComplaints);
router.get('/:id', userAuthMiddleware, getComplaint);
router.put('/:id/reopen', userAuthMiddleware, reopenComplaint);

// Admin routes
router.get('/', adminAuthMiddleware, getAllComplaints);
router.get('/:id/details', adminAuthMiddleware, getComplaintDetails);
router.put('/:id/resolve', adminAuthMiddleware, resolveComplaint);
router.put('/:id/status', adminAuthMiddleware, updateComplaintStatus);

module.exports = router;