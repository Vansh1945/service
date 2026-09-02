const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const chatController = require('./chat-controller');
const {
  validateBody,
  validateParams,
  roomIdParamSchema,
  createRoomSchema,
  sendMessageSchema,
  markSeenSchema,
  typingStatusSchema,
  deleteMessageForMeSchema,
  anyBodySchema
} = require('../../shared/validation/common-validation');

// Middleware imports
const { userAuthMiddleware } = require('../../shared/middlewares/user-middleware');
const { providerAuthMiddleware } = require('../../shared/middlewares/provider-middleware');
const adminAuthMiddleware = require('../../shared/middlewares/admin-middleware');
const { roleMiddleware } = require('../../shared/middlewares/role-middleware');
const { sharedAuthMiddleware } = require('../../shared/middlewares/shared-auth-middleware');

const requireAdmin = roleMiddleware(['admin']);
const requireCustomerOrProviderOrAdmin = roleMiddleware(['customer', 'provider', 'admin']);


// Chat endpoints
router.post('/create-room', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, validateBody(createRoomSchema), chatController.createRoom);
router.post('/send', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, validateBody(sendMessageSchema), chatController.sendMessage);
router.get('/messages/:roomId', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, validateParams(roomIdParamSchema), chatController.getMessages);
router.patch('/mark-seen', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, validateBody(markSeenSchema), chatController.markSeen);
router.post('/typing', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, validateBody(typingStatusSchema), chatController.typingStatus);
router.post('/delete-for-me', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, validateBody(deleteMessageForMeSchema), chatController.deleteMessageForMe);
router.get('/search/:roomId', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, validateParams(roomIdParamSchema), chatController.searchMessages);

const { uploadComplaintImage, handleUploadErrors } = require('../../shared/middlewares/upload');

// Admin-specific endpoints
router.get('/admin-monitor', adminAuthMiddleware, requireAdmin, chatController.adminMonitor);
router.post('/admin-join/:roomId', adminAuthMiddleware, requireAdmin, validateParams(roomIdParamSchema), validateBody(anyBodySchema), chatController.joinAdmin);
router.get('/admin/chat/:roomId', adminAuthMiddleware, requireAdmin, validateParams(roomIdParamSchema), chatController.adminGetMessages);

// Upload endpoint
router.post('/upload', sharedAuthMiddleware, requireCustomerOrProviderOrAdmin, uploadComplaintImage.single('file'), handleUploadErrors, validateBody(anyBodySchema), chatController.uploadChatFile);

module.exports = router;
