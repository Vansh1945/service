const Notification = require('../models/Notification');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Admin = require('../models/Admin-model');
const { sendBroadcastNotification, scheduleNotification } = require('../utils/notificationService');



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

        // If this is a broadcast notification (indicated by notificationId in metadata or similar, 
        // but here we just check if it has referenceId or type broadcast in the actual broadcast doc)
        // Actually, broadcast notifications are saved per-user. 
        // We should increment readCount in the PARENT broadcast record if possible, 
        // but the current structure doesn't easily link per-user broadcast to parent.
        // HOWEVER, the requirement is "Track when user opens notification".
        // If we can't link, we'll just increment it on the user's copy if it was broadcast.
        if (notification.type === 'broadcast') {
            // Find the parent broadcast record by title and message? 
            // Better: just increment readCount on the record itself.
            // Wait, per-user records ARE the broadcast notifications. 
            // The "history" shows the count.
            // Let's increment readCount on the document with the same title/message/audience/type='broadcast' AND userId=null (the history record)
            await Notification.updateOne(
                { 
                    title: notification.title, 
                    message: notification.message, 
                    type: 'broadcast', 
                    userId: null,
                    status: 'sent'
                },
                { $inc: { readCount: 1 } }
            );
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

/**
 * POST /api/notifications/send-broadcast
 * Admin-only: Send FCM broadcast to selected audience
 */
const sendBroadcast = async (req, res) => {
    try {
        const {
            audience = 'all',
            targetRole,
            title,
            body,
            message,
            url = '/',
            type = 'broadcast',
            scheduledFor,
            scheduledTime,
            sendNow = true,
            city,
            targetCity,
            providerCategory,
            targetProviderCategory,
            minBookings = 0
        } = req.body;

        const finalAudience = targetRole || audience;
        const finalBody = message || body;
        const finalScheduledTime = scheduledFor || scheduledTime;
        const finalCity = city || targetCity;
        const finalCategory = providerCategory || targetProviderCategory;

        if (!title || !finalBody) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        const validAudiences = ['all', 'customer', 'provider'];
        if (!validAudiences.includes(finalAudience)) {
            return res.status(400).json({ success: false, message: 'audience must be all, customer, or provider' });
        }

        // Handle Scheduling
        if (sendNow === false || finalScheduledTime) {
            if (finalScheduledTime && new Date(finalScheduledTime) < new Date()) {
                return res.status(400).json({ success: false, message: 'Scheduled time must be in the future' });
            }

            const schedResult = await scheduleNotification({
                audience: finalAudience,
                title,
                body: finalBody,
                url,
                type,
                scheduledTime: finalScheduledTime,
                targetCity: finalCity,
                targetProviderCategory: finalCategory,
                minBookings
            });

            return res.status(schedResult.success ? 200 : 500).json({
                success: schedResult.success,
                message: schedResult.message,
                data: schedResult.notification
            });
        }

        // Immediate Send
        const filters = {
            city: finalCity,
            category: finalCategory,
            minBookings
        };

        const result = await sendBroadcastNotification(finalAudience, {
            title,
            body: finalBody,
            url,
            data: { type, url }
        }, filters);

        if (!result.success && result.sent === 0 && result.total === 0) {
            return res.status(200).json({
                success: false,
                message: result.message || 'No matching users/devices found',
                data: result
            });
        }

        // Save History
        try {
            await Notification.create({
                title,
                message: finalBody,
                type: 'broadcast',
                audience: finalAudience,
                url,
                totalSent: result.total || 0,
                successCount: result.sent || 0,
                deliveredCount: result.sent || 0,
                failureCount: result.failed || 0,
                targetCity: finalCity,
                targetProviderCategory: finalCategory,
                minBookings,
                status: 'sent',
                sentAt: new Date()
            });
        } catch (err) {
            console.error('[NotificationController] Error saving broadcast history:', err);
        }

        return res.status(200).json({
            success: true,
            message: `Broadcast sent to ${result.sent} device(s) out of ${result.total}`,
            data: result
        });
    } catch (error) {
        console.error('sendBroadcast error:', error);
        return res.status(500).json({ success: false, message: 'Failed to send broadcast notification' });
    }
};

/**
 * GET /api/notifications/admin
 * Admin-only: Get notification history with filters
 */
const getAdminNotifications = async (req, res) => {
    try {
        const { type, audience, status, startDate, endDate, page = 1, limit = 20 } = req.query;
        const query = { isDeletedByAdmin: false, userId: null };

        if (type) query.type = type;
        if (audience) query.audience = audience;
        if (status) query.status = status;

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [notifications, total] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Notification.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            data: notifications,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('getAdminNotifications error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch admin notifications' });
    }
};

/**
 * PATCH /api/notifications/admin/:id
 * Admin-only: Edit notification
 */
const updateNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, message, url, scheduledTime } = req.body;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        // Rules:
        // If notification is already sent -> only allow minor edits (title/message for history)
        // If scheduled -> allow full edit

        if (notification.status === 'sent') {
            notification.title = title || notification.title;
            notification.message = message || notification.message;
        } else if (notification.status === 'pending') {
            notification.title = title || notification.title;
            notification.message = message || notification.message;
            notification.url = url || notification.url;
            if (scheduledTime || scheduledFor) {
                notification.scheduledFor = new Date(scheduledTime || scheduledFor);
            }
        } else {
            return res.status(400).json({ success: false, message: 'Cannot edit notification in current status' });
        }

        await notification.save();
        return res.status(200).json({ success: true, data: notification });
    } catch (error) {
        console.error('updateNotification error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update notification' });
    }
};

/**
 * DELETE /api/notifications/admin/:id
 * Admin-only: Delete notification (soft delete for history, cancel if pending)
 */
const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        if (notification.status === 'pending') {
            notification.status = 'cancelled';
        }

        notification.isDeletedByAdmin = true;
        await notification.save();

        return res.status(200).json({ success: true, message: 'Notification deleted/cancelled' });
    } catch (error) {
        console.error('deleteNotification error:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete notification' });
    }
};

/**
 * PATCH /api/notifications/admin/cancel/:id
 * Admin-only: Cancel scheduled notification
 */
const cancelNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findOneAndUpdate(
            { _id: id, status: 'pending' },
            { $set: { status: 'cancelled' } },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found or already sent' });
        }

        return res.status(200).json({ success: true, message: 'Notification cancelled', data: notification });
    } catch (error) {
        console.error('cancelNotification error:', error);
        return res.status(500).json({ success: false, message: 'Failed to cancel notification' });
    }
};

/**
 * POST /api/notifications/admin/resend/:id
 * Admin-only: Resend a broadcast notification
 */
const resendNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        // Use existing sendBroadcastNotification function
        const result = await sendBroadcastNotification(notification.audience || 'all', {
            title: notification.title,
            body: notification.message,
            url: notification.url,
            data: { type: notification.type, url: notification.url }
        });

        // Update existing record or create new history? 
        // Typically resending should probably create a new record for tracking success/failure of the new attempt.
        // But for simplicity and to match the "extension" request, let's create a new one.
        
        await Notification.create({
            title: notification.title,
            message: notification.message,
            type: 'broadcast',
            audience: notification.audience,
            url: notification.url,
            totalSent: result.total || 0,
            successCount: result.sent || 0,
            failureCount: result.failed || 0,
            status: 'sent'
        });

        return res.status(200).json({
            success: true,
            message: `Resent successfully to ${result.sent} devices`,
            data: result
        });
    } catch (error) {
        console.error('resendNotification error:', error);
        return res.status(500).json({ success: false, message: 'Failed to resend notification' });
    }
};

/**
 * PATCH /api/notifications/clicked/:id
 * Track notification click
 */
const markClicked = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userID || req.body.userId;

        const notification = await Notification.findOne({ _id: id, userId });
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        if (notification.type === 'broadcast') {
            await Notification.updateOne(
                {
                    title: notification.title,
                    message: notification.message,
                    type: 'broadcast',
                    userId: null,
                    status: 'sent'
                },
                { $inc: { clickedCount: 1 } }
            );
        }

        return res.status(200).json({ success: true, message: 'Click tracked' });
    } catch (error) {
        console.error('markClicked error:', error);
        return res.status(500).json({ success: false, message: 'Failed to track click' });
    }
};

/**
 * GET /api/notifications/admin/analytics/:id
 * Admin-only: Get analytics for a broadcast notification
 */
const getAdminAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        const totalSent = notification.totalSent || 0;
        const delivered = notification.deliveredCount || notification.successCount || 0;
        const read = notification.readCount || 0;
        const clicked = notification.clickedCount || 0;

        const readRate = totalSent > 0 ? ((read / totalSent) * 100).toFixed(2) : 0;
        const clickRate = totalSent > 0 ? ((clicked / totalSent) * 100).toFixed(2) : 0;

        return res.status(200).json({
            success: true,
            data: {
                totalSent,
                delivered,
                read,
                clicked,
                readRate: parseFloat(readRate),
                clickRate: parseFloat(clickRate)
            }
        });
    } catch (error) {
        console.error('getAdminAnalytics error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
};

module.exports = {
    getNotifications,
    markRead,
    markAllRead,
    getUnreadCount,
    saveToken,
    removeToken,
    sendBroadcast,
    getBroadcastHistory: getAdminNotifications,
    updateNotification,
    deleteNotification,
    cancelNotification,
    resendNotification,
    markClicked,
    getAdminAnalytics
};
