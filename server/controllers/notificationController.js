const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Admin = require('../models/Admin-model');
const { sendBroadcastNotification, scheduleNotification } = require('../utils/notificationService');

/**
 * Helper to fetch zone and all its ancestors recursively
 */
const getZoneAncestorsAndSelf = async (zoneId) => {
    if (!zoneId) return [];
    const zones = [];
    let currentId = zoneId;
    for (let i = 0; i < 10; i++) {
        const zone = await mongoose.model('Zone').findById(currentId).lean();
        if (!zone) break;
        zones.push(zone._id.toString());
        if (zone.parentZone) {
            currentId = zone.parentZone;
        } else {
            break;
        }
    }
    return zones;
};


/**
 * Emit real-time broadcast stats update to all admins via Socket.io
 */
const emitStatsUpdate = async (broadcastId) => {
    try {
        const { getIO } = require('../socket/socketServer');
        let io;
        try {
            io = getIO();
        } catch {
            return;
        }

        if (!io) return;

        const stats = await Notification.aggregate([
            { $match: { broadcast_id: new mongoose.Types.ObjectId(broadcastId) } },
            {
                $group: {
                    _id: null,
                    totalSent: { $sum: 1 },
                    deliveredCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
                    },
                    readCount: {
                        $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
                    },
                    clickedCount: {
                        $sum: { $cond: [{ $ne: [{ $ifNull: ['$clicked_at', null] }, null] }, 1, 0] }
                    }
                }
            }
        ]);

        const result = stats[0] || { totalSent: 0, deliveredCount: 0, readCount: 0, clickedCount: 0 };

        io.to('role_admin').emit('broadcast_stats_updated', {
            broadcastId: broadcastId.toString(),
            totalSent: result.totalSent,
            deliveredCount: result.deliveredCount,
            readCount: result.readCount,
            clickedCount: result.clickedCount
        });
    } catch (err) {
        console.error('Error emitting stats update:', err);
    }
};

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

        const query = { userId };

        // Fetch user/provider currentZone
        let recipient;
        if (req.role === 'provider') {
            recipient = await Provider.findById(userId).select('currentZone');
        } else {
            recipient = await User.findById(userId).select('currentZone');
        }

        if (recipient) {
            const ancestorZoneIds = await getZoneAncestorsAndSelf(recipient.currentZone);
            query.$or = [
                { targetZones: { $exists: false } },
                { targetZones: { $size: 0 } },
                { targetZones: { $in: ancestorZoneIds } }
            ];
        }

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(query),
            Notification.countDocuments({ ...query, isRead: false })
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

        const existing = await Notification.findOne({ _id: id, userId });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        let updated = false;
        if (!existing.isRead) {
            existing.isRead = true;
            existing.read_at = new Date();
            await existing.save();
            updated = true;
        }

        if (updated && existing.type === 'broadcast' && existing.broadcast_id) {
            await Notification.updateOne(
                { _id: existing.broadcast_id },
                { $inc: { readCount: 1 } }
            );
            emitStatsUpdate(existing.broadcast_id);
        }

        return res.status(200).json({ success: true, data: existing });
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

        const query = { userId, isRead: false };

        let recipient;
        if (req.role === 'provider') {
            recipient = await Provider.findById(userId).select('currentZone');
        } else {
            recipient = await User.findById(userId).select('currentZone');
        }

        if (recipient) {
            const ancestorZoneIds = await getZoneAncestorsAndSelf(recipient.currentZone);
            query.$or = [
                { targetZones: { $exists: false } },
                { targetZones: { $size: 0 } },
                { targetZones: { $in: ancestorZoneIds } }
            ];
        }

        const unreadNotifications = await Notification.find(query);
        if (unreadNotifications.length > 0) {
            const ids = unreadNotifications.map(n => n._id);
            await Notification.updateMany(
                { _id: { $in: ids } },
                { $set: { isRead: true, read_at: new Date() } }
            );

            // Group by broadcast_id to update counts and emit updates
            const broadcastIdsToUpdate = new Set();
            for (const notif of unreadNotifications) {
                if (notif.type === 'broadcast' && notif.broadcast_id) {
                    broadcastIdsToUpdate.add(notif.broadcast_id.toString());
                }
            }

            for (const bId of broadcastIdsToUpdate) {
                const countReadForThisBroadcast = unreadNotifications.filter(n => n.broadcast_id && n.broadcast_id.toString() === bId).length;
                await Notification.updateOne(
                    { _id: bId },
                    { $inc: { readCount: countReadForThisBroadcast } }
                );
                emitStatsUpdate(bId);
            }
        }

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
        
        const query = { userId, isRead: false };

        let recipient;
        if (req.role === 'provider') {
            recipient = await Provider.findById(userId).select('currentZone');
        } else {
            recipient = await User.findById(userId).select('currentZone');
        }

        if (recipient) {
            const ancestorZoneIds = await getZoneAncestorsAndSelf(recipient.currentZone);
            query.$or = [
                { targetZones: { $exists: false } },
                { targetZones: { $size: 0 } },
                { targetZones: { $in: ancestorZoneIds } }
            ];
        }

        const count = await Notification.countDocuments(query);
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
        const { token, deviceId: bodyDeviceId, platform, appVersion } = req.body;
        const userId = req.userID;
        const role = req.role;

        // Input Sanitization and Token Format/Length Validation
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ success: false, message: 'Invalid or missing FCM token' });
        }

        const cleanToken = token.trim();
        const fcmTokenRegex = /^[a-zA-Z0-9_\-:]+$/;
        if (cleanToken.length < 100 || cleanToken.length > 500 || !fcmTokenRegex.test(cleanToken)) {
            return res.status(400).json({ success: false, message: 'Malformed FCM token rejected' });
        }

        // Sanitize deviceId
        let rawDeviceId = bodyDeviceId || req.headers['x-device-id'] || req.headers['user-agent'] || 'unknown_device';
        if (typeof rawDeviceId !== 'string') {
            rawDeviceId = String(rawDeviceId);
        }
        const cleanDeviceId = rawDeviceId.replace(/[^\w\-\s.:()\[\]\/]/g, '').trim().slice(0, 300);

        if (!cleanDeviceId || cleanDeviceId.length < 5) {
            return res.status(400).json({ success: false, message: 'Invalid or malformed deviceId rejected' });
        }

        const deviceId = cleanDeviceId;

        let Model;
        if (role === 'admin') Model = Admin;
        else if (role === 'provider') Model = Provider;
        else Model = User;

        // 1. Pull this token from all other users in all collections to avoid duplicate registration
        await Promise.all([
            User.updateMany({ _id: { $ne: userId } }, { $pull: { fcmDevices: { token: cleanToken } } }),
            Provider.updateMany({ _id: { $ne: userId } }, { $pull: { fcmDevices: { token: cleanToken } } }),
            Admin.updateMany({ _id: { $ne: userId } }, { $pull: { fcmDevices: { token: cleanToken } } })
        ]);

        // Find the user document
        const user = await Model.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user.fcmDevices) {
            user.fcmDevices = [];
        }

        const deviceIndex = user.fcmDevices.findIndex(d => d.deviceId === deviceId);

        if (deviceIndex > -1) {
            const existing = user.fcmDevices[deviceIndex];
            if (existing.token === cleanToken) {
                // CASE 1: Same deviceId + same token
                existing.lastActive = new Date();
                existing.isActive = true;
                if (platform) existing.platform = platform;
                if (appVersion) existing.appVersion = appVersion;
            } else {
                // CASE 2: Same deviceId + different token
                existing.token = cleanToken;
                existing.lastActive = new Date();
                existing.isActive = true;
                if (platform) existing.platform = platform;
                if (appVersion) existing.appVersion = appVersion;
            }
        } else {
            // CASE 3: New device
            // Remove any other entry in user's list that has the same token to prevent duplicates
            const tokenIndex = user.fcmDevices.findIndex(d => d.token === cleanToken);
            if (tokenIndex > -1) {
                user.fcmDevices.splice(tokenIndex, 1);
            }
            
            user.fcmDevices.push({
                token: cleanToken,
                deviceId,
                platform: platform || 'Web',
                appVersion: appVersion || '1.0.0',
                lastActive: new Date(),
                isActive: true
            });
        }

        // Cap array to last 10 entries (increased from 3 to support multi-device)
        if (user.fcmDevices.length > 10) {
            user.fcmDevices = user.fcmDevices.slice(-10);
        }

        await user.save();

        return res.status(200).json({ success: true, message: 'Token saved successfully' });
    } catch (error) {
        if (global.logger) {
            global.logger.error('saveToken error:', error);
        } else {
            console.error('saveToken error:', error);
        }
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to save token', 
            error: error.message
        });
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

        await Model.updateOne(
            { _id: userId },
            { $pull: { fcmDevices: { token } } }
        );

        return res.status(200).json({ success: true, message: 'Token removed' });
    } catch (error) {
        if (global.logger) {
            global.logger.error('removeToken error:', error);
        } else {
            console.error('removeToken error:', error);
        }
        return res.status(500).json({ success: false, message: 'Failed to remove token', error: error.message });
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
                targetZones: req.body.targetZones || [],
                targetProviderCategory: finalCategory,
                minBookings
            });

            return res.status(schedResult.success ? 200 : 500).json({
                success: schedResult.success,
                message: schedResult.message,
                data: schedResult.notification
            });
        }

        // Create parent broadcast record
        const parentBroadcast = await Notification.create({
            title,
            message: finalBody,
            type: 'broadcast',
            audience: finalAudience,
            url,
            totalSent: 0,
            successCount: 0,
            deliveredCount: 0,
            failureCount: 0,
            targetCity: finalCity,
            targetZones: req.body.targetZones || [],
            targetProviderCategory: finalCategory,
            minBookings,
            status: 'sent',
            sentAt: new Date()
        });

        // Immediate Send
        const filters = {
            city: finalCity,
            targetZones: req.body.targetZones || [],
            category: finalCategory,
            minBookings
        };

        const result = await sendBroadcastNotification(finalAudience, {
            title,
            body: finalBody,
            url,
            data: { type, url }
        }, filters, parentBroadcast._id);

        if (!result.success && result.sent === 0 && result.total === 0) {
            await Notification.findByIdAndDelete(parentBroadcast._id);
            return res.status(200).json({
                success: false,
                message: result.message || 'No matching users/devices found',
                data: result
            });
        }

        // Update parent with the actual result counts
        parentBroadcast.totalSent = result.total || 0;
        parentBroadcast.successCount = result.sent || 0;
        parentBroadcast.deliveredCount = result.sent || 0;
        parentBroadcast.failureCount = result.failed || 0;
        await parentBroadcast.save();

        // Emit real-time stats update via socket
        emitStatsUpdate(parentBroadcast._id);

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

        const total = await Notification.countDocuments(query);

        const notifications = await Notification.aggregate([
            { $match: query },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'notifications',
                    localField: '_id',
                    foreignField: 'broadcast_id',
                    as: 'children'
                }
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    message: 1,
                    type: 1,
                    audience: 1,
                    url: 1,
                    status: 1,
                    sentAt: 1,
                    scheduledFor: 1,
                    isScheduled: 1,
                    targetCity: 1,
                    targetZones: 1,
                    targetProviderCategory: 1,
                    minBookings: 1,
                    isDeletedByAdmin: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    totalSent: { $size: '$children' },
                    deliveredCount: {
                        $size: {
                            $filter: {
                                input: '$children',
                                as: 'c',
                                cond: { $eq: ['$$c.status', 'delivered'] }
                            }
                        }
                    },
                    readCount: {
                        $size: {
                            $filter: {
                                input: '$children',
                                as: 'c',
                                cond: { $eq: ['$$c.isRead', true] }
                            }
                        }
                    },
                    clickedCount: {
                        $size: {
                            $filter: {
                                input: '$children',
                                as: 'c',
                                cond: { $ne: [{ $ifNull: ['$$c.clicked_at', null] }, null] }
                            }
                        }
                    }
                }
            }
        ]);

        await Notification.populate(notifications, {
            path: 'targetZones',
            populate: {
                path: 'parentZone',
                populate: {
                    path: 'parentZone'
                }
            }
        });

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
        const { title, message, url, scheduledTime, targetZones } = req.body;

        const notification = await Notification.findById(id);
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        if (notification.status === 'sent') {
            notification.title = title || notification.title;
            notification.message = message || notification.message;
            if (targetZones !== undefined) notification.targetZones = targetZones;
        } else if (notification.status === 'pending') {
            notification.title = title || notification.title;
            notification.message = message || notification.message;
            notification.url = url || notification.url;
            if (targetZones !== undefined) notification.targetZones = targetZones;
            if (scheduledTime) {
                notification.scheduledFor = new Date(scheduledTime);
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

        const newParent = await Notification.create({
            title: notification.title,
            message: notification.message,
            type: 'broadcast',
            audience: notification.audience,
            url: notification.url,
            totalSent: 0,
            successCount: 0,
            deliveredCount: 0,
            failureCount: 0,
            targetZones: notification.targetZones || [],
            status: 'sent',
            sentAt: new Date()
        });

        const result = await sendBroadcastNotification(notification.audience || 'all', {
            title: notification.title,
            body: notification.message,
            url: notification.url,
            data: { type: notification.type, url: notification.url }
        }, {
            targetZones: notification.targetZones || []
        }, newParent._id);

        newParent.totalSent = result.total || 0;
        newParent.successCount = result.sent || 0;
        newParent.deliveredCount = result.sent || 0;
        newParent.failureCount = result.failed || 0;
        await newParent.save();

        emitStatsUpdate(newParent._id);

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
        const { token, deviceId } = req.body;

        const notification = await Notification.findOne({ _id: id, userId });
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        let updated = false;
        if (!notification.clicked_at) {
            notification.clicked_at = new Date();
            await notification.save();
            updated = true;
        }

        if (updated && notification.type === 'broadcast' && notification.broadcast_id) {
            await Notification.updateOne(
                { _id: notification.broadcast_id },
                { $inc: { clickedCount: 1 } }
            );
            emitStatsUpdate(notification.broadcast_id);
        }

        // Update device activity tracking (lastActive) on notification interaction
        if (userId && req.role) {
            let Model;
            if (req.role === 'admin') Model = Admin;
            else if (req.role === 'provider') Model = Provider;
            else Model = User;

            if (token) {
                await Model.updateOne(
                    { _id: userId, 'fcmDevices.token': token },
                    { $set: { 'fcmDevices.$.lastActive': new Date() } }
                );
            } else if (deviceId) {
                await Model.updateOne(
                    { _id: userId, 'fcmDevices.deviceId': deviceId },
                    { $set: { 'fcmDevices.$.lastActive': new Date() } }
                );
            }
        }

        return res.status(200).json({ success: true, message: 'Click tracked' });
    } catch (error) {
        console.error('markClicked error:', error);
        return res.status(500).json({ success: false, message: 'Failed to track click' });
    }
};

/**
 * GET /api/notifications/admin/dashboard-stats
 * Admin-only: Get comprehensive FCM notification statistics
 */
const getAdminDashboardStats = async (req, res) => {
    try {
        const User = require('../models/User-model');
        const Provider = require('../models/Provider-model');
        const Admin = require('../models/Admin-model');
        const { SystemConfig } = require('../models/SystemSetting');

        // Query active devices count in fcmDevices (where isActive is true)
        const customerDevices = await User.aggregate([
            { $unwind: '$fcmDevices' },
            { $match: { 'fcmDevices.isActive': true } },
            { $count: 'count' }
        ]);

        const providerDevices = await Provider.aggregate([
            { $unwind: '$fcmDevices' },
            { $match: { 'fcmDevices.isActive': true } },
            { $count: 'count' }
        ]);

        const adminDevices = await Admin.aggregate([
            { $unwind: '$fcmDevices' },
            { $match: { 'fcmDevices.isActive': true } },
            { $count: 'count' }
        ]);

        const customerCount = customerDevices[0]?.count || 0;
        const providerCount = providerDevices[0]?.count || 0;
        const adminCount = adminDevices[0]?.count || 0;
        const totalCount = customerCount + providerCount + adminCount;

        // Cleanup Count from SystemConfig
        const config = await SystemConfig.findOne();
        const cleanupCount = config?.invalidTokenCleanupCount || 0;

        // Last Notification Delivery Success
        // Find the latest broadcast or notification that was sent (status: 'sent' or 'delivered')
        const latestNotif = await Notification.findOne({
            status: { $in: ['sent', 'delivered'] }
        }).sort({ createdAt: -1 });

        let lastDeliverySuccess = 'N/A';
        if (latestNotif) {
            const total = latestNotif.totalSent || 0;
            const success = latestNotif.successCount || latestNotif.deliveredCount || 0;
            if (total > 0) {
                lastDeliverySuccess = `${success}/${total} (${((success / total) * 100).toFixed(1)}%)`;
            } else {
                lastDeliverySuccess = latestNotif.status === 'delivered' ? 'Success' : 'Sent';
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                totalActiveDevices: totalCount,
                customerDevices: customerCount,
                providerDevices: providerCount,
                adminDevices: adminCount,
                invalidTokenCleanupCount: cleanupCount,
                lastNotificationDeliverySuccess: lastDeliverySuccess
            }
        });
    } catch (error) {
        console.error('getAdminDashboardStats error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats' });
    }
};

/**
 * GET /api/notifications/admin/analytics/:id
 * Admin-only: Get analytics for a broadcast notification
 */
const getAdminAnalytics = async (req, res) => {
    try {
        const { id } = req.params;
        const parent = await Notification.findById(id);

        if (!parent) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        const stats = await Notification.aggregate([
            { $match: { broadcast_id: new mongoose.Types.ObjectId(id) } },
            {
                $group: {
                    _id: null,
                    totalSent: { $sum: 1 },
                    deliveredCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
                    },
                    readCount: {
                        $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
                    },
                    clickedCount: {
                        $sum: { $cond: [{ $ne: [{ $ifNull: ['$clicked_at', null] }, null] }, 1, 0] }
                    }
                }
            }
        ]);

        const result = stats[0] || { totalSent: 0, deliveredCount: 0, readCount: 0, clickedCount: 0 };

        const totalSent = result.totalSent;
        const delivered = result.deliveredCount;
        const read = result.readCount;
        const clicked = result.clickedCount;

        const readRate = delivered > 0 ? ((read / delivered) * 100).toFixed(2) : 0;
        const clickRate = delivered > 0 ? ((clicked / delivered) * 100).toFixed(2) : 0;

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
    getAdminAnalytics,
    emitStatsUpdate,
    getAdminDashboardStats
};
