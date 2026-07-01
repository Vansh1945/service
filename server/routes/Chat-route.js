const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const chatController = require('../controllers/Chat-controller');

// Middleware imports
const { userAuthMiddleware } = require('../middlewares/User-middleware');
const { providerAuthMiddleware } = require('../middlewares/Provider-middleware');
const adminAuthMiddleware = require('../middlewares/Admin-middleware');
const { roleMiddleware } = require('../middlewares/role-middleware');
const { sharedAuthMiddleware } = require('../middlewares/sharedAuth-middleware');

const requireAdmin = roleMiddleware(['admin']);
const requireCustomerOrProviderOrAdmin = roleMiddleware(['customer', 'provider', 'admin']);

// Chat endpoints
router.post('/create-room', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, chatController.createRoom);
router.post('/send', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, chatController.sendMessage);
router.get('/messages/:roomId', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, chatController.getMessages);
router.patch('/mark-seen', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, chatController.markSeen);
router.post('/typing', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, chatController.typingStatus);
router.post('/delete-for-me', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, chatController.deleteMessageForMe);
router.get('/search/:roomId', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, chatController.searchMessages);

const { uploadComplaintImage, handleUploadErrors } = require('../middlewares/upload');

// Admin-specific endpoints
router.get('/admin-monitor', adminAuthMiddleware, requireAdmin, chatController.adminMonitor);
router.post('/admin-join/:roomId', adminAuthMiddleware, requireAdmin, chatController.joinAdmin);
router.get('/admin/chat/:roomId', adminAuthMiddleware, requireAdmin, chatController.adminGetMessages);

// Upload endpoint
router.post('/upload', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, uploadComplaintImage.single('file'), handleUploadErrors, chatController.uploadChatFile);

module.exports = router;
