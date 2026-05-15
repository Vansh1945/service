const admin = require('../config/firebaseAdmin');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Admin = require('../models/Admin-model');
const Notification = require('../models/Notification'); // Ensure Notification model is imported
const cron = require('node-cron');

/**
 * Send a push notification to a list of registration tokens
 */
const sendPushNotification = async (tokens, payload) => {
    if (!tokens || tokens.length === 0) return;

    // Filter out empty or null tokens
    const validTokens = tokens.filter(token => token && token.trim() !== '');
    if (validTokens.length === 0) {
        console.log('[NotificationService] No valid FCM tokens to send to');
        return;
    }

    try {
        // FCM requires ALL data values to be strings
        const dataPayload = {};
        if (payload.data) {
            Object.entries(payload.data).forEach(([key, value]) => {
                dataPayload[key] = value !== null && value !== undefined ? String(value) : '';
            });
        }

        // Include deep-link url in data payload for SW click handler
        if (payload.url) {
            dataPayload.url = String(payload.url);
        }
        if (payload.route) {
            dataPayload.route = String(payload.route);
        }
        if (payload.role) {
            dataPayload.role = String(payload.role);
        }

        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: dataPayload,
            tokens: validTokens,
            // Android specific config for better delivery
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'booking_notifications'
                }
            },
            // Web push config — pass data so SW notificationclick can read url
            webpush: {
                headers: {
                    Urgency: 'high'
                },
                notification: {
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    requireInteraction: false,
                    data: dataPayload
                }
            }
        };

        console.log(`[NotificationService] Sending FCM to ${validTokens.length} token(s) — "${payload.title}"`);
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[NotificationService] FCM Result: ${response.successCount} success, ${response.failureCount} failure`);

        if (response.failureCount > 0) {
            const failedTokens = [];

            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`[NotificationService] Token[${idx}] failed:`, resp.error?.code, resp.error?.message);
                    if (
                        resp.error?.code === 'messaging/invalid-registration-token' ||
                        resp.error?.code === 'messaging/registration-token-not-registered'
                    ) {
                        failedTokens.push(validTokens[idx]);
                    }
                }
            });

            // Cleanup invalid tokens async from all collections
            if (failedTokens.length > 0) {
                console.log(`[NotificationService] Cleaning up ${failedTokens.length} invalid tokens...`);
                Promise.all([
                    User.updateMany({}, { $pull: { fcmTokens: { token: { $in: failedTokens } } } }),
                    Provider.updateMany({}, { $pull: { fcmTokens: { token: { $in: failedTokens } } } }),
                    Admin.updateMany({}, { $pull: { fcmTokens: { token: { $in: failedTokens } } } })
                ]).catch(err => console.error('[NotificationService] Clean up error:', err));
            }
        }

        return response;
    } catch (error) {
        console.error('[NotificationService] Error sending FCM:', error);
    }
};

/**
 * Send notification to a specific user by their ID and role
 */
const notifyUser = async (userId, role, payload) => {
    try {
        let user;
        if (role === 'provider') {
            user = await Provider.findById(userId);
        } else if (role === 'admin') {
            user = await Admin.findById(userId);
        } else {
            user = await User.findById(userId);
        }

        if (user && user.fcmTokens && user.fcmTokens.length > 0) {
            // Collect unique tokens
            const tokens = [...new Set(user.fcmTokens.map(t => t.token))];
            console.log(`[NotificationService] Sending to ${tokens.length} tokens for user ${userId} (${role})`);
            await sendPushNotification(tokens, payload);
        } else {
            console.log(`[NotificationService] User ${userId} (${role}) has NO active FCM tokens`);
        }
    } catch (error) {
        console.error(`Error notifying user ${userId}:`, error);
    }
};

/**
 * Send notification to all admins
 */
const notifyAllAdmins = async (payload) => {
    try {
        const admins = await Admin.find({ isActive: true });

        let allTokens = [];
        admins.forEach(a => {
            if (a.fcmTokens && a.fcmTokens.length > 0) {
                a.fcmTokens.forEach(t => allTokens.push(t.token));
            }
        });

        const uniqueTokens = [...new Set(allTokens)];

        if (uniqueTokens.length > 0) {
            await sendPushNotification(uniqueTokens, payload);
        }
    } catch (error) {
        console.error('Error notifying all admins:', error);
    }
};

/**
 * Send broadcast notification to all users of a specific audience
 * @param {string} audience - 'all' | 'customer' | 'provider'
 * @param {object} payload  - { title, body, url, data }
 * @param {object} filters  - { city, category, minBookings }
 * @returns {{ success, sent, failed, total }}
 */
const sendBroadcastNotification = async (audience, payload, filters = {}) => {
    try {
        let allTokens = [];
        let notificationsToSave = [];
        const { city, category, minBookings = 0 } = filters;

        if (audience === 'all' || audience === 'customer') {
            const userQuery = { role: 'customer' };
            if (city) userQuery['address.city'] = new RegExp(city, 'i');
            if (minBookings > 0) userQuery.totalBookings = { $gte: minBookings };

            const users = await User.find(userQuery, '_id fcmTokens');
            users.forEach(u => {
                notificationsToSave.push({
                    userId: u._id,
                    role: 'customer',
                    title: payload.title,
                    message: payload.body,
                    type: payload.data?.type || 'broadcast',
                    referenceId: payload.data?.referenceId || null,
                    url: payload.url || '/',
                    isRead: false,
                    isScheduled: payload.isScheduled || false,
                    sentAt: new Date()
                });
                if (u.fcmTokens && u.fcmTokens.length > 0) {
                    u.fcmTokens.forEach(t => allTokens.push(t.token));
                }
            });
        }

        if (audience === 'all' || audience === 'provider') {
            const providerQuery = { isDeleted: false };
            if (city) providerQuery['address.city'] = new RegExp(city, 'i');
            if (category) providerQuery.services = category; // category ID
            if (minBookings > 0) providerQuery.completedBookings = { $gte: minBookings };

            const providers = await Provider.find(providerQuery, '_id fcmTokens');
            providers.forEach(p => {
                notificationsToSave.push({
                    userId: p._id,
                    role: 'provider',
                    title: payload.title,
                    message: payload.body,
                    type: payload.data?.type || 'broadcast',
                    referenceId: payload.data?.referenceId || null,
                    url: payload.url || '/',
                    isRead: false,
                    isScheduled: payload.isScheduled || false,
                    sentAt: new Date()
                });
                if (p.fcmTokens && p.fcmTokens.length > 0) {
                    p.fcmTokens.forEach(t => allTokens.push(t.token));
                }
            });
        }

        if (notificationsToSave.length > 0) {
            await Notification.insertMany(notificationsToSave);
        }

        const uniqueTokens = [...new Set(allTokens.filter(t => t && t.trim()))];
        console.log(`[NotificationService] Broadcasting to ${uniqueTokens.length} tokens (audience: ${audience})`);

        if (uniqueTokens.length === 0) {
            return { success: false, message: 'No FCM tokens found for audience', sent: 0, failed: 0, total: 0 };
        }

        // FCM has a limit of 500 tokens per multicast — batch if needed
        const BATCH_SIZE = 500;
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
            const batch = uniqueTokens.slice(i, i + BATCH_SIZE);
            const response = await sendPushNotification(batch, payload);
            if (response) {
                successCount += response.successCount || 0;
                failureCount += response.failureCount || 0;
            }
        }

        return { success: true, sent: successCount, failed: failureCount, total: uniqueTokens.length };
    } catch (error) {
        console.error('[NotificationService] Broadcast error:', error);
        throw error;
    }
};

/**
 * Schedule a notification for a specific user, role, or broadcast audience
 * @param {object} payload - { userId, role, audience, title, body, url, type, scheduledTime }
 */
const scheduleNotification = async (payload) => {
    try {
        const { userId, role, audience, title, body, url = '/', type = 'system', scheduledTime } = payload;

        if (!scheduledTime) {
            throw new Error('scheduledTime is required to schedule a notification');
        }

        // Store in DB as 'pending'
        const newNotif = await Notification.create({
            userId: userId || null,
            role: role || null,
            audience: audience || null,
            title,
            message: body,
            url,
            type: audience ? 'broadcast' : type,
            scheduledFor: new Date(scheduledTime),
            isScheduled: true,
            targetCity: payload.targetCity || null,
            targetProviderCategory: payload.targetProviderCategory || null,
            minBookings: payload.minBookings || 0,
            status: 'pending',
            totalSent: 0,
            successCount: 0,
            failureCount: 0,
            deliveredCount: 0,
            readCount: 0,
            clickedCount: 0,
            retries: 0
        });

        console.log(`[NotificationService] Notification scheduled for ${newNotif.scheduledFor} (ID: ${newNotif._id})`);
        return { success: true, message: 'Notification scheduled successfully', notification: newNotif };
    } catch (error) {
        console.error('[NotificationService] Error scheduling notification:', error);
        return { success: false, message: 'Failed to schedule notification', error: error.message };
    }
};

/**
 * CRON JOB: Runs every minute to check and send pending scheduled notifications
 */
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();
        // Find pending notifications where scheduledFor has passed, up to 3 retries max
        const pendingNotifications = await Notification.find({
            status: 'pending',
            scheduledFor: { $lte: now },
            retries: { $lt: 3 }
        });

        if (pendingNotifications.length > 0) {
            console.log(`[NotificationService] Found ${pendingNotifications.length} scheduled notification(s) to process.`);
        }

        for (const notif of pendingNotifications) {
            try {
                let result;
                // Dispatch logic based on whether it is a broadcast or user-specific notification
                if (notif.audience && ['all', 'customer', 'provider'].includes(notif.audience)) {
                    result = await sendBroadcastNotification(notif.audience, {
                        title: notif.title,
                        body: notif.message,
                        url: notif.url,
                        isScheduled: true,
                        data: { type: notif.type, url: notif.url, route: notif.url, role: notif.audience === 'all' ? null : notif.audience, notificationId: notif._id }
                    }, {
                        city: notif.targetCity,
                        category: notif.targetProviderCategory,
                        minBookings: notif.minBookings
                    });
                } else if (notif.userId && notif.role) {
                    // Collect tokens for a single user to trigger sendPushNotification manually,
                    // but we can simply rely on the existing notifyUser if we don't need accurate result counting.
                    // For accuracy, we manually execute finding tokens to log failures identically.
                    let userModel;
                    if (notif.role === 'provider') userModel = Provider;
                    else if (notif.role === 'admin') userModel = Admin;
                    else userModel = User;

                    const user = await userModel.findById(notif.userId);
                    if (user && user.fcmTokens && user.fcmTokens.length > 0) {
                        const tokens = [...new Set(user.fcmTokens.map(t => t.token))];
                        result = await sendPushNotification(tokens, {
                            title: notif.title,
                            body: notif.message,
                            url: notif.url,
                            data: { type: notif.type, url: notif.url, route: notif.url, role: notif.role, notificationId: notif._id }
                        });
                        if (result) {
                            result = { success: true, sent: result.successCount, failed: result.failureCount, total: tokens.length };
                        } else {
                            result = { success: false, sent: 0, failed: 0, total: tokens.length };
                        }
                    } else {
                        // User exists but has no Firebase tokens
                        result = { success: false, sent: 0, failed: 0, total: 0, message: 'No registered devices' };
                    }
                }

                // Update DB status to 'sent'
                notif.status = 'sent';
                notif.sentAt = new Date();
                notif.totalSent = result?.total || 0;
                notif.successCount = result?.sent || 0;
                notif.deliveredCount = result?.sent || 0;
                notif.failureCount = result?.failed || 0;
                await notif.save();
                console.log(`[NotificationService] Scheduled notification (ID: ${notif._id}) SENT successfully.`);

            } catch (err) {
                console.error(`[NotificationService] Failed matching scheduled notification (ID: ${notif._id}):`, err);

                // Retry Logic
                notif.retries += 1;
                if (notif.retries >= 3) {
                    notif.status = 'failed';
                }
                await notif.save();
            }
        }
    } catch (error) {
        console.error('[NotificationService] Cron job error:', error);
    }
});

module.exports = {
    sendPushNotification,
    notifyUser,
    notifyAllAdmins,
    sendBroadcastNotification,
    scheduleNotification
};
