const cron = require('node-cron');
const mongoose = require('mongoose');

const startCronJobs = () => {
    console.log('[CronScheduler] Initializing background tasks...');

    cron.schedule('* * * * *', async () => {
        try {
            if (mongoose.connection.readyState !== 1) {
                console.log('[CronScheduler] Database not connected. Skipping cron job execution.');
                return;
            }

            const Booking = mongoose.model('Booking');
            const Notification = mongoose.model('Notification');
            const User = mongoose.model('User');
            const Provider = mongoose.model('Provider');
            const Admin = mongoose.model('Admin');
            const { SystemConfig } = require('../models/SystemSetting-model');
            const { sendPushNotification, sendBroadcastNotification } = require('../utils/notificationService');

            let settings = await SystemConfig.findOne();
            if (!settings) {
                settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
                await settings.save();
            }

            // 1. SLA Checks
            try {
                const BookingService = require('../services/BookingService');
                if (BookingService && typeof BookingService.monitorActiveBookingsSLA === 'function') {
                    await BookingService.monitorActiveBookingsSLA();
                }
            } catch (slaErr) {
                console.error('[SLA Engine] Error during SLA checks:', slaErr);
            }

            // 2. Provider Accept Timeout
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

            // 3. Pending Scheduled Notifications
            const now = new Date();
            const pendingNotifications = await Notification.find({
                status: 'pending',
                scheduledFor: { $lte: now },
                retries: { $lt: 3 }
            });

            if (pendingNotifications.length > 0) {
                console.log(`[CronScheduler] Found ${pendingNotifications.length} scheduled notification(s) to process.`);
            }

            for (const notif of pendingNotifications) {
                try {
                    let result;
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
                            result = { success: false, sent: 0, failed: 0, total: 0, message: 'No registered devices' };
                        }
                    }

                    notif.status = 'sent';
                    notif.sentAt = new Date();
                    notif.totalSent = result?.total || 0;
                    notif.successCount = result?.sent || 0;
                    notif.deliveredCount = result?.sent || 0;
                    notif.failureCount = result?.failed || 0;
                    await notif.save();
                    console.log(`[CronScheduler] Scheduled notification (ID: ${notif._id}) SENT successfully.`);

                    if (notif.audience && ['all', 'customer', 'provider'].includes(notif.audience)) {
                        try {
                            const { emitStatsUpdate } = require('../controllers/Notification-controller');
                            if (emitStatsUpdate) {
                                emitStatsUpdate(notif._id);
                            }
                        } catch (e) {
                            console.error('Failed to emit stats update from cron:', e);
                        }
                    }
                } catch (err) {
                    console.error(`[CronScheduler] Failed scheduled notification (ID: ${notif._id}):`, err);
                    notif.retries += 1;
                    if (notif.retries >= 3) {
                        notif.status = 'failed';
                    }
                    await notif.save();
                }
            }
        } catch (error) {
            console.error('[CronScheduler] Error in cron job:', error);
        }
    });
};

module.exports = { startCronJobs };
