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
        // ✅ FCM requires ALL data values to be strings
        const dataPayload = {};
        if (payload.data) {
            Object.entries(payload.data).forEach(([key, value]) => {
                dataPayload[key] = value !== null && value !== undefined ? String(value) : '';
            });
        }

        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: dataPayload,
            tokens: validTokens,
            // ✅ Android specific config for better delivery
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'booking_notifications'
                }
            },
            // ✅ Web push config
            webpush: {
                headers: {
                    Urgency: 'high'
                },
                notification: {
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    requireInteraction: false
                }
            }
        };

        console.log(`[NotificationService] Sending FCM to ${validTokens.length} token(s) — "${payload.title}"`);
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[NotificationService] FCM Result: ${response.successCount} success, ${response.failureCount} failure`);

        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`[NotificationService] Token[${idx}] failed:`, resp.error?.code, resp.error?.message);
                }
            });
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
        admins.forEach(admin => {
            if (admin.fcmTokens && admin.fcmTokens.length > 0) {
                admin.fcmTokens.forEach(t => allTokens.push(t.token));
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

module.exports = {
    sendPushNotification,
    notifyUser,
    notifyAllAdmins
};
