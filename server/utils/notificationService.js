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
        const { SystemConfig } = require('../models/SystemSetting');
        const config = await SystemConfig.findOne();
        if (config && config.notificationSettings && config.notificationSettings.pushEnabled === false) {
            console.log('[NotificationService] Push notifications are globally disabled in settings. Skipping FCM dispatch.');
            return;
        }
    } catch (e) {
        console.error('[NotificationService] Error loading system settings in sendPushNotification:', e);
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
                    sound: payload.sound || 'booking_ringtone',
                    channelId: payload.channelId || 'booking_notifications'
                }
            },
            //  Web push config — pass data so SW notificationclick can read url
            webpush: {
                headers: {
                    urgency: 'high',
                    TTL: '86400' // 1 day TTL to prevent delivery delay  
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
                    const errCode = resp.error?.code || '';
                    const errMsg = resp.error?.message || '';
                    if (
                        errCode === 'messaging/invalid-registration-token' ||
                        errCode === 'messaging/registration-token-not-registered' ||
                        errCode.includes('registration-token-not-registered') ||
                        errCode.includes('invalid-registration-token') ||
                        errMsg.includes('registration-token-not-registered') ||
                        errMsg.includes('invalid-registration-token')
                    ) {
                        failedTokens.push(validTokens[idx]);
                    }
                }
            });

            // Cleanup invalid tokens async from all collections
            if (failedTokens.length > 0) {
                console.log(`[NotificationService] Cleaning up ${failedTokens.length} invalid tokens...`);
                const { SystemConfig } = require('../models/SystemSetting');
                Promise.all([
                    User.updateMany({}, { $pull: { fcmDevices: { token: { $in: failedTokens } } } }),
                    Provider.updateMany({}, { $pull: { fcmDevices: { token: { $in: failedTokens } } } }),
                    Admin.updateMany({}, { $pull: { fcmDevices: { token: { $in: failedTokens } } } }),
                    SystemConfig.updateOne({}, { $inc: { invalidTokenCleanupCount: failedTokens.length } })
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

        if (user && user.fcmDevices && user.fcmDevices.length > 0) {
            // Collect unique active tokens
            const tokens = [...new Set(user.fcmDevices.filter(d => d.isActive !== false && d.token).map(t => t.token))];
            console.log(`[NotificationService] Sending to ${tokens.length} active tokens for user ${userId} (${role})`);
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
            if (a.fcmDevices && a.fcmDevices.length > 0) {
                a.fcmDevices.forEach(t => {
                    if (t.isActive !== false && t.token) {
                        allTokens.push(t.token);
                    }
                });
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
            return currentTime >= startTime || currentTime <= endTime;
        }
    } catch (e) {
        return false;
    }
};

/**
 * Helper to fetch zone and all its descendant zones recursively up to 2 levels
 */
const getZoneAndDescendants = async (targetZoneIds) => {
    if (!targetZoneIds || targetZoneIds.length === 0) return [];

    const mongoose = require('mongoose');
    const Zone = mongoose.model('Zone');

    let matchedZoneIds = new Set(targetZoneIds.map(id => id.toString()));

    // Level 1: Find children of targetZoneIds
    const level1Children = await Zone.find({
        parentZone: { $in: Array.from(matchedZoneIds) }
    }, '_id').lean();

    const level1Ids = level1Children.map(c => c._id.toString());
    level1Ids.forEach(id => matchedZoneIds.add(id));

    if (level1Ids.length > 0) {
        // Level 2: Find children of level 1 children
        const level2Children = await Zone.find({
            parentZone: { $in: level1Ids }
        }, '_id').lean();
        level2Children.map(c => c._id.toString()).forEach(id => matchedZoneIds.add(id));
    }

    return Array.from(matchedZoneIds).map(id => new mongoose.Types.ObjectId(id));
};


const sendBroadcastNotification = async (audience, payload, filters = {}, broadcastId = null) => {
    try {
        const { SystemConfig } = require('../models/SystemSetting');
        const config = await SystemConfig.findOne();

        let allTokens = [];
        let notificationsToSave = [];
        const { city, targetZones = [], category, minBookings = 0 } = filters;

        let users = [];
        const isCustomerAlertsEnabled = !config || !config.notificationSettings || config.notificationSettings.customerAlerts !== false;
        if ((audience === 'all' || audience === 'customer') && isCustomerAlertsEnabled) {
            const userQuery = { role: 'customer' };
            if (city) userQuery['address.city'] = new RegExp(city, 'i');
            if (minBookings > 0) userQuery.totalBookings = { $gte: minBookings };

            if (targetZones && targetZones.length > 0) {
                const eligibleZoneIds = await getZoneAndDescendants(targetZones);
                userQuery.currentZone = { $in: eligibleZoneIds };
            }

            users = await User.find(userQuery, '_id fcmDevices notificationPreferences');
            users.forEach(u => {
                // Filter out users who disabled promotional/broadcast notifications
                if (u.notificationPreferences && u.notificationPreferences.promotional === false) {
                    return;
                }

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
                    broadcast_id: broadcastId,
                    targetZones: targetZones,
                    sentAt: new Date()
                });

                // Send push only if enabled and not during quiet hours
                let pushAllowed = true;
                if (u.notificationPreferences) {
                    if (u.notificationPreferences.pushEnabled === false) {
                        pushAllowed = false;
                    } else if (isInQuietHours(u.notificationPreferences)) {
                        pushAllowed = false;
                    }
                }

                if (pushAllowed && u.fcmDevices && u.fcmDevices.length > 0) {
                    u.fcmDevices.forEach(t => {
                        if (t.isActive !== false && t.token) {
                            allTokens.push(t.token);
                        }
                    });
                }
            });
        }

        let providers = [];
        const isProviderAlertsEnabled = !config || !config.notificationSettings || config.notificationSettings.providerAlerts !== false;
        if ((audience === 'all' || audience === 'provider') && isProviderAlertsEnabled) {
            const providerQuery = { isDeleted: false };
            if (city) providerQuery['address.city'] = new RegExp(city, 'i');
            if (category) providerQuery.services = category; // category ID
            if (minBookings > 0) providerQuery.completedBookings = { $gte: minBookings };

            if (targetZones && targetZones.length > 0) {
                const eligibleZoneIds = await getZoneAndDescendants(targetZones);
                providerQuery.currentZone = { $in: eligibleZoneIds };
            }

            providers = await Provider.find(providerQuery, '_id fcmDevices notificationPreferences');
            providers.forEach(p => {
                // Filter out providers who disabled promotional/broadcast notifications
                if (p.notificationPreferences && p.notificationPreferences.promotional === false) {
                    return;
                }

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
                    broadcast_id: broadcastId,
                    targetZones: targetZones,
                    sentAt: new Date()
                });

                // Send push only if enabled and not during quiet hours
                let pushAllowed = true;
                if (p.notificationPreferences) {
                    if (p.notificationPreferences.pushEnabled === false) {
                        pushAllowed = false;
                    } else if (isInQuietHours(p.notificationPreferences)) {
                        pushAllowed = false;
                    }
                }

                if (pushAllowed && p.fcmDevices && p.fcmDevices.length > 0) {
                    p.fcmDevices.forEach(t => {
                        if (t.isActive !== false && t.token) {
                            allTokens.push(t.token);
                        }
                    });
                }
            });
        }

        let savedNotifs = [];
        if (notificationsToSave.length > 0) {
            savedNotifs = await Notification.insertMany(notificationsToSave);
        }

        // Map userId to savedNotif
        const userNotifMap = new Map();
        savedNotifs.forEach(n => {
            if (n.userId) {
                userNotifMap.set(n.userId.toString(), n);
            }
        });

        // Map token to savedNotif
        const tokenToNotifMap = new Map();
        users.forEach(u => {
            const notif = userNotifMap.get(u._id.toString());
            if (notif && u.fcmDevices) {
                u.fcmDevices.forEach(t => {
                    if (t.token) tokenToNotifMap.set(t.token, notif);
                });
            }
        });
        providers.forEach(p => {
            const notif = userNotifMap.get(p._id.toString());
            if (notif && p.fcmDevices) {
                p.fcmDevices.forEach(t => {
                    if (t.token) tokenToNotifMap.set(t.token, notif);
                });
            }
        });

        const uniqueTokens = [...new Set(allTokens.filter(t => t && t.trim()))];
        console.log(`[NotificationService] Broadcasting to ${uniqueTokens.length} tokens (audience: ${audience})`);

        if (uniqueTokens.length === 0) {
            return { success: false, message: 'No FCM tokens found for audience', sent: 0, failed: 0, total: notificationsToSave.length };
        }

        // FCM has a limit of 500 tokens per multicast — batch if needed
        const BATCH_SIZE = 500;
        let successCount = 0;
        let failureCount = 0;
        const deliveredNotifIds = new Set();
        const failedNotifIds = new Set();

        for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
            const batch = uniqueTokens.slice(i, i + BATCH_SIZE);
            const response = await sendPushNotification(batch, payload);
            if (response && response.responses) {
                successCount += response.successCount || 0;
                failureCount += response.failureCount || 0;

                response.responses.forEach((resp, idx) => {
                    const token = batch[idx];
                    const notif = tokenToNotifMap.get(token);
                    if (notif) {
                        if (resp.success) {
                            deliveredNotifIds.add(notif._id.toString());
                        } else {
                            failedNotifIds.add(notif._id.toString());
                        }
                    }
                });
            }
        }

        // Update database with delivery results
        if (deliveredNotifIds.size > 0) {
            await Notification.updateMany(
                { _id: { $in: Array.from(deliveredNotifIds) } },
                { $set: { status: 'delivered', delivered_at: new Date() } }
            );
        }

        const onlyFailedNotifIds = Array.from(failedNotifIds).filter(id => !deliveredNotifIds.has(id));
        if (onlyFailedNotifIds.length > 0) {
            await Notification.updateMany(
                { _id: { $in: onlyFailedNotifIds } },
                { $set: { status: 'failed' } }
            );
        }

        return { success: true, sent: deliveredNotifIds.size, failed: notificationsToSave.length - deliveredNotifIds.size, total: notificationsToSave.length };
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
            targetZones: payload.targetZones || [],
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
        const mongoose = require('mongoose');
        const Booking = mongoose.model('Booking');
        const { SystemConfig } = require('../models/SystemSetting');

        let settings = await SystemConfig.findOne();
        if (!settings) {
            settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
            await settings.save();
        }

        const enableTimeout = settings?.bookingSettings?.enableProviderAcceptTimeout !== false;
        if (enableTimeout) {
            const timeoutMinutes = settings?.bookingSettings?.providerAcceptTimeoutMinutes || 5;
            const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);
            const expiredBookings = await Booking.find({
                status: 'assigned',
                provider: { $ne: null },
                'metadata.assignedAt': { $lte: timeoutThreshold }
            });

            for (const booking of expiredBookings) {
                console.log(`[DispatchEngine] Booking ${booking._id} alert expired for provider ${booking.provider}. Re-assigning...`);
                
                if (!booking.metadata) booking.metadata = {};
                if (!booking.metadata.ignoredProviders) booking.metadata.ignoredProviders = [];
                booking.metadata.ignoredProviders.push(booking.provider);
                
                booking.provider = null;
                booking.status = 'pending';
                await booking.save();

                const ProviderAssignmentService = require('../services/ProviderAssignmentService');
                ProviderAssignmentService.autoAssignProviderIfEnabled(booking._id);
            }
        }

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
                        targetZones: notif.targetZones || [],
                        category: notif.targetProviderCategory,
                        minBookings: notif.minBookings
                    }, notif._id);
                } else if (notif.userId && notif.role) {
                    // Collect tokens for a single user to trigger sendPushNotification manually,
                    // but we can simply rely on the existing notifyUser if we don't need accurate result counting.
                    // For accuracy, we manually execute finding tokens to log failures identically.
                    let userModel;
                    if (notif.role === 'provider') userModel = Provider;
                    else if (notif.role === 'admin') userModel = Admin;
                    else userModel = User;

                    const user = await userModel.findById(notif.userId);
                    if (user && user.fcmDevices && user.fcmDevices.length > 0) {
                        const tokens = [...new Set(user.fcmDevices.filter(t => t.isActive !== false && t.token).map(t => t.token))];
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

                // Emit stats update if it was a broadcast
                if (notif.audience && ['all', 'customer', 'provider'].includes(notif.audience)) {
                    try {
                        const { emitStatsUpdate } = require('../controllers/notificationController');
                        if (emitStatsUpdate) {
                            emitStatsUpdate(notif._id);
                        }
                    } catch (e) {
                        console.error('Failed to emit stats update from cron:', e);
                    }
                }

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
