const Notification = require('../models/Notification');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Admin = require('../models/Admin-model');


/**
 * GET /api/notifications
 * Get notifications for logged-in user with unread count
 */
const getNotifications = async (req, res) => {
    try {
        const userId = req.userID || req.query.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments({ userId }),
            Notification.countDocuments({ userId, isRead: false })
        ]);

        return res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('getNotifications error:', error);
        return res.status(500).json({ success: false, message: 'Failed to get notifications' });
    }
};

/**
 * PATCH /api/notifications/read/:id
 * Mark a single notification as read
 */
const markRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userID || req.body.userId;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId },
            { $set: { isRead: true } },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        return res.status(200).json({ success: true, data: notification });
    } catch (error) {
        console.error('markRead error:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
    }
};

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for the current user
 */
const markAllRead = async (req, res) => {
    try {
        const userId = req.userID || req.body.userId;

        await Notification.updateMany(
            { userId, isRead: false },
            { $set: { isRead: true } }
        );

        return res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('markAllRead error:', error);
        return res.status(500).json({ success: false, message: 'Failed to mark all as read' });
    }
};

/**
 * GET /api/notifications/unread-count
 * Get unread notification count
 */
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.userID || req.query.userId;
        const count = await Notification.countDocuments({ userId, isRead: false });
        return res.status(200).json({ success: true, count });
    } catch (error) {
        console.error('getUnreadCount error:', error);
        return res.status(500).json({ success: false, message: 'Failed to get count' });
    }
};

/**
 * POST /api/notifications/save-token
 */
const saveToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.userID;
        const role = req.role;
        const deviceId = req.headers['user-agent'] || 'unknown_device';

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        let Model;
        if (role === 'admin') Model = Admin;
        else if (role === 'provider') Model = Provider;
        else Model = User;

        const user = await Model.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 1. Check if this exact token already exists for this user
        const existingTokenIndex = user.fcmTokens.findIndex(t => t.token === token);

        if (existingTokenIndex !== -1) {
            // Already exists -> Update lastActive and deviceId (just in case)
            user.fcmTokens[existingTokenIndex].lastActive = new Date();
            user.fcmTokens[existingTokenIndex].deviceId = deviceId;
        } else {
            // New token -> 1. Remove any old token for this same deviceId
            user.fcmTokens = user.fcmTokens.filter(t => t.deviceId !== deviceId);

            // 2. Add new token
            user.fcmTokens.push({
                token,
                deviceId,
                lastActive: new Date()
            });

            // 3. Keep only most recent 3 devices (Optional Best Practice)
            if (user.fcmTokens.length > 3) {
                user.fcmTokens.sort((a, b) => b.lastActive - a.lastActive);
                user.fcmTokens = user.fcmTokens.slice(0, 3);
            }
        }

        await user.save();
        return res.status(200).json({ success: true, message: 'Token saved' });
    } catch (error) {
        console.error('saveToken error:', error);
        return res.status(500).json({ success: false, message: 'Failed to save token' });
    }
};

/**
 * POST /api/notifications/remove-token
 */
const removeToken = async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.userID;
        const role = req.role;

        let Model;
        if (role === 'admin') Model = Admin;
        else if (role === 'provider') Model = Provider;
        else Model = User;

        await Model.findByIdAndUpdate(userId, {
            $pull: { fcmTokens: { token: token } }
        });

        return res.status(200).json({ success: true, message: 'Token removed' });
    } catch (error) {
        console.error('removeToken error:', error);
        return res.status(500).json({ success: false, message: 'Failed to remove token' });
    }
};

module.exports = { 
    getNotifications, 
    markRead, 
    markAllRead, 
    getUnreadCount,
    saveToken,
    removeToken
};

