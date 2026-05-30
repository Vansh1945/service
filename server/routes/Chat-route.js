const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const chatController = require('../controllers/Chat-controller');

// Middleware imports
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { roleMiddleware } = require('../middlewares/role-middleware');

/**
 * Shared Auth middleware specifically tailored to support Customer, Provider, and Admin roles
 * delegating to their respective authentication middlewares.
 */
const sharedChatAuth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token required' });
  }

  try {
    const jwtToken = token.replace('Bearer ', '').trim();
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);

    if (decoded.role === 'admin') {
      return adminAuthMiddleware(req, res, next);
    } else if (decoded.role === 'provider') {
      return providerAuthMiddleware(req, res, next);
    } else {
      return userAuthMiddleware(req, res, next);
    }
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        tokenExpired: true,
        message: 'Access token expired. Please login again.'
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid or unauthorized token.' });
  }
};

const requireAdmin = roleMiddleware(['admin']);
const requireCustomerOrProviderOrAdmin = roleMiddleware(['customer', 'provider', 'admin']);

// Chat endpoints
router.post('/create-room', sharedChatAuth, requireCustomerOrProviderOrAdmin, chatController.createRoom);
router.post('/send', sharedChatAuth, requireCustomerOrProviderOrAdmin, chatController.sendMessage);
router.get('/messages/:roomId', sharedChatAuth, requireCustomerOrProviderOrAdmin, chatController.getMessages);
router.patch('/mark-seen', sharedChatAuth, requireCustomerOrProviderOrAdmin, chatController.markSeen);
router.post('/typing', sharedChatAuth, requireCustomerOrProviderOrAdmin, chatController.typingStatus);

const { uploadComplaintImage, handleUploadErrors } = require('../middlewares/upload');

// Admin-specific endpoints
router.get('/admin-monitor', adminAuthMiddleware, requireAdmin, chatController.adminMonitor);
router.post('/admin-join/:roomId', adminAuthMiddleware, requireAdmin, chatController.joinAdmin);
router.get('/admin/chat/:roomId', adminAuthMiddleware, requireAdmin, chatController.adminGetMessages);

// Upload endpoint
router.post('/upload', sharedChatAuth, requireCustomerOrProviderOrAdmin, uploadComplaintImage.single('file'), handleUploadErrors, chatController.uploadChatFile);

module.exports = router;
