const Notification = require('../models/Notification');
const notificationService = require('./notificationService');

let _io = null;

/**
 * Set the Socket.io instance (called from socketServer after init)
 */
const setIO = (io) => {
    _io = io;
};

/**
 * Create a notification in DB and emit it via Socket.io and FCM
 */
const sendNotification = async (userId, role, title, message, type = 'system', referenceId = null) => {
    try {
        let notification = null;

        // If userId is provided, save to DB and emit to that specific user
        if (userId) {
            notification = await Notification.create({
                userId,
                role,
                title,
                message,
                type,
                referenceId
            });

            // 1. Emit real-time event via Socket.io
            if (_io) {
                _io.to(userId.toString()).emit('new_notification', {
                    _id: notification._id,
                    title,
                    message,
                    type,
                    referenceId,
                    isRead: false,
                    createdAt: notification.createdAt
                });
            }

            // 2. Send Push Notification via FCM
            try {
                await notificationService.notifyUser(userId, role, {
                    title,
                    body: message,
                    data: {
                        bookingId: referenceId ? referenceId.toString() : '',
                        userId: userId.toString(),
                        type: type
                    }
                });
            } catch (fcmError) {
                console.error('FCM Error in notificationHelper:', fcmError);
            }
        } else if (role && _io) {
            // If no userId but role is provided, broadcast to the role room (real-time only)
            _io.to(`role_${role}`).emit('new_notification', {
                title,
                message,
                type,
                referenceId,
                isRead: false,
                createdAt: new Date()
            });

            // Optional: Broadcast to all tokens of users with this role if needed
            // For now, requirement 4 says Admin gets all major activities
            if (role === 'admin') {
                try {
                    await notificationService.notifyAllAdmins({
                        title,
                        body: message,
                        data: {
                            referenceId: referenceId ? referenceId.toString() : '',
                            type: type
                        }
                    });
                } catch (fcmError) {
                    console.error('FCM Admin Error in notificationHelper:', fcmError);
                }
            }
        }

        return notification;
    } catch (error) {
        console.error('Error sending notification:', error);
        return null;
    }
};

/**
 * Broadcast notification DB entries to all admins
 */
const notifyAdmins = async (title, message, type = 'system', referenceId = null) => {
    try {
        // This will now trigger FCM via sendNotification -> notifyUser(admin)
        const Admin = require('../models/Admin-model');
        const admins = await Admin.find({ isActive: true });

        for (const admin of admins) {
            await sendNotification(admin._id, 'admin', title, message, type, referenceId);
        }
    } catch (error) {
        console.error('Error notifying admins:', error);
    }
};

module.exports = { sendNotification, notifyAdmins, setIO };
