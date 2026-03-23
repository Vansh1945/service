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
    if (validTokens.length === 0) return;

    try {
        const message = {
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: payload.data || {},
            tokens: validTokens,
        };

        console.log(`[NotificationService] Sending FCM to ${validTokens.length} tokens for title: ${payload.title}`);
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`[NotificationService] FCM Result: ${response.successCount} success, ${response.failureCount} failure`);
        
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    console.error(`[NotificationService] Token failure [${idx}]:`, resp.error);
                }
            });
        }

        return response;
    } catch (error) {
        console.error('[NotificationService] Error sending multicast FCM notification:', error);
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
            console.log(`[NotificationService] User ${userId} (${role}) has ${user.fcmTokens.length} FCM tokens`);
            await sendPushNotification(user.fcmTokens, payload);
        } else {
            console.log(`[NotificationService] User ${userId} (${role}) has NO FCM tokens`);
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
        const allTokens = admins.reduce((tokens, admin) => {
            if (admin.fcmTokens) {
                return tokens.concat(admin.fcmTokens);
            }
            return tokens;
        }, []);

        if (allTokens.length > 0) {
            await sendPushNotification(allTokens, payload);
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
