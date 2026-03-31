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
 * Generate smart routing links for automatic system notifications
 */
const computeNotificationUrl = (role, type, title, message) => {
    const textContext = `${title} ${message}`.toLowerCase();
    
    if (role === 'admin') {
        if (type === 'booking') return '/admin/bookings';
        if (textContext.includes('payout') || textContext.includes('withdraw') || type === 'withdrawal') return '/admin/payout';
        if (textContext.includes('provider') || textContext.includes('approved')) return '/admin/approve-providers';
        if (textContext.includes('complaint')) return '/admin/complaints';
        return '/admin/dashboard';
    } 
    
    if (role === 'provider') {
        if (textContext.includes('payout') || textContext.includes('withdraw')) return '/provider/dashboard'; // Route to provider payout if available
        if (textContext.includes('review') || textContext.includes('feedback')) return '/provider/dashboard';
        return '/provider/dashboard'; // Main dashboard hosts booking tables
    } 
    
    if (role === 'customer') {
        if (type === 'booking' || textContext.includes('booking')) return '/customer/bookings';
        if (type === 'payment') return '/customer/bookings'; // Customer payments relate to bookings
        return '/customer/dashboard';
    }
    
    return '/'; // Fallback
};

/**
 * Create a notification in DB and emit it via Socket.io and FCM
 */
const sendNotification = async (userId, role, title, message, type = 'system', referenceId = null, url = '/') => {
    try {
        let notification = null;
        const generatedUrl = url !== '/' ? url : computeNotificationUrl(role, type, title, message);

        // If userId is provided, save to DB and emit to that specific user
        if (userId) {
            notification = await Notification.create({
                userId,
                role,
                title,
                message,
                type,
                referenceId,
                url: generatedUrl
            });

            // 1. Emit real-time event via Socket.io
            if (_io) {
                const room = userId.toString();
                const socketsInRoom = await _io.in(room).fetchSockets();
                console.log(`[Socket] Emitting to room "${room}" — ${socketsInRoom.length} socket(s) connected`);
                _io.to(room).emit('new_notification', {
                    _id: notification._id,
                    title,
                    message,
                    type,
                    referenceId,
                    url: generatedUrl,
                    isRead: false,
                    createdAt: notification.createdAt
                });
            } else {
                console.warn('[Socket] _io not set — socket notification skipped');
            }

            try {
                console.log(`[NotificationHelper] Calling notifyUser for: ${userId}, role: ${role}`);
                await notificationService.notifyUser(userId, role, {
                    title,
                    body: message,
                    url: generatedUrl,
                    data: {
                        bookingId: referenceId ? referenceId.toString() : '',
                        userId: userId.toString(),
                        type: type,
                        url: generatedUrl
                    }
                });
            } catch (fcmError) {
                console.error(`[NotificationHelper] FCM Error:`, fcmError);
            }
        } else if (role && _io) {
            // If no userId but role is provided, broadcast to the role room (real-time only)
            _io.to(`role_${role}`).emit('new_notification', {
                title,
                message,
                type,
                referenceId,
                url: generatedUrl,
                isRead: false,
                createdAt: new Date()
            });

            // Optional: Broadcast to all tokens of users with this role if needed
            if (role === 'admin') {
                try {
                    await notificationService.notifyAllAdmins({
                        title,
                        body: message,
                        url: generatedUrl,
                        data: {
                            referenceId: referenceId ? referenceId.toString() : '',
                            type: type,
                            url: generatedUrl
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
const notifyAdmins = async (title, message, type = 'system', referenceId = null, url = '/') => {
    try {
        const Admin = require('../models/Admin-model');
        const admins = await Admin.find({ isActive: true });

        for (const admin of admins) {
            let generatedUrl = url !== '/' ? url : computeNotificationUrl('admin', type, title, message);
            await sendNotification(admin._id, 'admin', title, message, type, referenceId, generatedUrl);
        }
    } catch (error) {
        console.error('Error notifying admins:', error);
    }
};

module.exports = { sendNotification, notifyAdmins, setIO };

