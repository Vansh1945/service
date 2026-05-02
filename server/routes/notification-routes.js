const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const jwt = require('jsonwebtoken');

// Flexible auth that works for customer, provider, and admin
const flexAuth = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token || !token.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token.replace('Bearer ', '').trim(), process.env.JWT_SECRET);
        req.userID = decoded.id;
        req.role = decoded.role || 'customer';
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Admin-only guard (must come after flexAuth)
const adminOnly = (req, res, next) => {
    if (req.role !== 'admin' && !req.isAdmin) {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

// GET /api/notifications — get all with unread count
router.get('/', flexAuth, notificationController.getNotifications);

// GET /api/notifications/unread-count
router.get('/unread-count', flexAuth, notificationController.getUnreadCount);

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', flexAuth, notificationController.markAllRead);

// PATCH /api/notifications/read/:id — mark one as read
router.patch('/read/:id', flexAuth, notificationController.markRead);

// POST /api/notifications/save-token
router.post('/save-token', flexAuth, notificationController.saveToken);

// POST /api/notifications/remove-token
router.post('/remove-token', flexAuth, notificationController.removeToken);

// POST /api/notifications/send-broadcast — Admin only
router.post('/send-broadcast', flexAuth, adminOnly, notificationController.sendBroadcast);

// GET /api/notifications/history — Admin only
router.get('/history', flexAuth, adminOnly, notificationController.getBroadcastHistory);

// PATCH /api/notifications/admin/:id — Edit (Admin only)
router.patch('/admin/:id', flexAuth, adminOnly, notificationController.updateNotification);

// DELETE /api/notifications/admin/:id — Delete/Cancel (Admin only)
router.delete('/admin/:id', flexAuth, adminOnly, notificationController.deleteNotification);

// PATCH /api/notifications/admin/cancel/:id — Cancel specifically (Admin only)
router.patch('/admin/cancel/:id', flexAuth, adminOnly, notificationController.cancelNotification);

// POST /api/notifications/admin/resend/:id — Resend (Admin only)
router.post('/admin/resend/:id', flexAuth, adminOnly, notificationController.resendNotification);

module.exports = router;

