const admin = require('../config/firebaseAdmin');
const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Admin = require('../models/Admin-model');

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
 * @returns {{ success, sent, failed, total }}
 */
const sendBroadcastNotification = async (audience, payload) => {
    try {
        let allTokens = [];

        if (audience === 'all' || audience === 'customer') {
            const users = await User.find({}, 'fcmTokens');
            users.forEach(u => {
                if (u.fcmTokens && u.fcmTokens.length > 0) {
                    u.fcmTokens.forEach(t => allTokens.push(t.token));
                }
            });
        }

        if (audience === 'all' || audience === 'provider') {
            const providers = await Provider.find({ isDeleted: false }, 'fcmTokens');
            providers.forEach(p => {
                if (p.fcmTokens && p.fcmTokens.length > 0) {
                    p.fcmTokens.forEach(t => allTokens.push(t.token));
                }
            });
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

module.exports = {
    sendPushNotification,
    notifyUser,
    notifyAllAdmins,
    sendBroadcastNotification
};
