const Notification = require('../models/Notification');
const notificationService = require('./notificationService');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Admin = require('../models/Admin-model');

let _io = null;

const typeToPreferenceMap = {
    'booking': 'booking',
    'payment': 'payment',
    'complaint': 'complaint',
    'broadcast': 'promotional',
    'approved': 'providerUpdates',
    'rejected': 'providerUpdates',
    'payout': 'wallet',
    'withdrawal': 'wallet',
    'system': 'adminAlerts',
    'reminder': 'reminder'
};

const isInQuietHours = (pref) => {
    if (!pref || !pref.quietHours || !pref.quietHours.enabled) return false;
    try {
        const now = new Date();
        const currentHours = now.getHours();
        const currentMins = now.getMinutes();
        const currentTime = currentHours * 60 + currentMins;

        const [startH, startM] = pref.quietHours.start.split(':').map(Number);
        const [endH, endM] = pref.quietHours.end.split(':').map(Number);
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;

        if (startTime < endTime) {
            return currentTime >= startTime && currentTime <= endTime;
        } else {
            // Quiet hours cross midnight (e.g. 22:00 to 08:00)
            return currentTime >= startTime || currentTime <= endTime;
        }
    } catch (e) {
        console.error('Error calculating quiet hours:', e);
        return false;
    }
};

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
        const { SystemConfig } = require('../models/SystemSetting');
        const config = await SystemConfig.findOne();
        if (config && config.notificationSettings) {
            if (role === 'provider' && config.notificationSettings.providerAlerts === false) {
                console.log(`[NotificationHelper] Suppressing notification for provider: providerAlerts is globally disabled.`);
                return null;
            }
            if (role === 'customer' && config.notificationSettings.customerAlerts === false) {
                console.log(`[NotificationHelper] Suppressing notification for customer: customerAlerts is globally disabled.`);
                return null;
            }
        }

        let notification = null;
        const generatedUrl = url !== '/' ? url : computeNotificationUrl(role, type, title, message);

        // If userId is provided, save to DB and emit to that specific user
        if (userId) {
            // 1. Role Verification to prevent cross-role notification leaks
            let Model;
            if (role === 'admin') Model = Admin;
            else if (role === 'provider') Model = Provider;
            else Model = User;

            const recipient = await Model.findById(userId).select('notificationPreferences fcmDevices');
            if (!recipient) {
                console.warn(`[Security Alert] Suppressed notification dispatch: User ${userId} is not a valid ${role}`);
                return null;
            }

            // 2. Granular Preference Check
            const prefKey = typeToPreferenceMap[type];
            if (recipient.notificationPreferences && prefKey) {
                if (recipient.notificationPreferences[prefKey] === false) {
                    console.log(`[NotificationHelper] Suppressing notification: User ${userId} has disabled ${prefKey} notifications`);
                    return null;
                }
            }

            notification = await Notification.create({
                userId,
                role,
                title,
                message,
                type,
                referenceId,
                url: generatedUrl
            });

            // 3. Emit real-time event via Socket.io
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

                // Send real-time unread count update to guarantee client stays fully in-sync
                const unreadCount = await Notification.countDocuments({ userId, isRead: false });
                _io.to(room).emit('unread_count_updated', { unreadCount });
            } else {
                console.warn('[Socket] _io not set — socket notification skipped');
            }

            // 4. Send FCM Push Notification with granular Silencing (pushEnabled & quiet hours)
            let isPushAllowed = true;
            if (recipient.notificationPreferences) {
                if (recipient.notificationPreferences.pushEnabled === false) {
                    isPushAllowed = false;
                } else if (isInQuietHours(recipient.notificationPreferences)) {
                    isPushAllowed = false;
                    console.log(`[NotificationHelper] Silence push due to Quiet Hours for User ${userId}`);
                }
            }

            if (isPushAllowed) {
                try {
                    console.log(`[NotificationHelper] Calling notifyUser for: ${userId}, role: ${role}`);
                    await notificationService.notifyUser(userId, role, {
                        title,
                        body: message,
                        url: generatedUrl,
                        role: role,
                        data: {
                            bookingId: referenceId ? referenceId.toString() : '',
                            userId: userId.toString(),
                            type: type,
                            url: generatedUrl,
                            role: role
                        }
                    });
                } catch (fcmError) {
                    console.error(`[NotificationHelper] FCM Error:`, fcmError);
                }
            } else {
                console.log(`[NotificationHelper] FCM Push skipped/silenced for user ${userId}`);
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
                        role: 'admin',
                        data: {
                            referenceId: referenceId ? referenceId.toString() : '',
                            type: type,
                            url: generatedUrl,
                            role: 'admin'
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

