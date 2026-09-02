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
            const { SystemConfig } = require('../../features/system-setting/system-setting-model');
            const { sendPushNotification, sendBroadcastNotification } = require('../../features/notification/notification-service');

            let settings = await SystemConfig.findOne();
            if (!settings) {
                settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
                await settings.save();
            }

            if (process.env.DISABLE_CRON === 'true' || process.env.DISABLE_CRON === '1') {
                return;
            }

            // Multi-instance distributed locking guard:
            // Ensures only ONE backend instance executes background tasks per 45s window
            const now = new Date();
            const lockThreshold = new Date(now.getTime() - 45 * 1000);
            const lockAcquired = await SystemConfig.findOneAndUpdate(
                {
                    _id: settings._id,
                    $or: [
                        { lastCronLockAt: { $exists: false } },
                        { lastCronLockAt: null },
                        { lastCronLockAt: { $lt: lockThreshold } }
                    ]
                },
                { $set: { lastCronLockAt: now } },
                { new: true }
            );

            if (!lockAcquired) {
                // Another backend instance already claimed cron execution for this cycle
                return;
            }

            // 1. SLA Checks
            try {
                const BookingService = require('../../features/booking/booking-service');
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
                    status: { $in: ['offered', 'searchingprovider'] },
                    provider: { $ne: null },
                    'metadata.assignedAt': { $lte: timeoutThreshold }
                });

                for (const booking of expiredBookings) {
                    if (booking.metadata?.assignmentInProgress) continue;
                    console.log(`[DispatchEngine] Booking ${booking._id} alert expired for provider ${booking.provider}. Delegating to Retry Manager...`);

                    const ProviderAssignmentService = require('../../features/booking/provider-assignment-service');
                    await ProviderAssignmentService.handleRetry(booking._id, {
                        reason: 'Provider accept timeout',
                        providerId: booking.provider
                    });
                }
            }

            // 2b. Admin Timeout Cleanup (Stuck searchingprovider recovery)
            try {
                const adminTimeoutMin = settings?.bookingSettings?.adminResponseTime || 30;
                const adminThreshold = new Date(Date.now() - adminTimeoutMin * 60 * 1000);
                const stuckAdminBookings = await Booking.find({
                    status: 'searchingprovider',
                    provider: { $in: [null, undefined] },
                    updatedAt: { $lte: adminThreshold }
                });

                for (const b of stuckAdminBookings) {
                    const ProviderAssignmentService = require('../../features/booking/provider-assignment-service');
                    await ProviderAssignmentService.autoCancelBooking(b._id, 'Admin response timeout (recovered by cron)');
                }
            } catch (adminCronErr) {
                console.error('[CronScheduler] Error in Admin timeout cleanup:', adminCronErr);
            }

            // 3. Pending Scheduled Notifications
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
                            const { emitStatsUpdate } = require('../../features/notification/notification-controller');
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

            // 4. Auto-cleanup notifications older than 5 days
            try {
                const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
                const cleanupResult = await Notification.deleteMany({
                    type: { $ne: 'broadcast' },
                    status: { $ne: 'pending' },
                    isScheduled: { $ne: true },
                    createdAt: { $lte: fiveDaysAgo }
                });
                if (cleanupResult.deletedCount > 0) {
                    console.log(`[CronScheduler] Cleaned up ${cleanupResult.deletedCount} old notification(s) older than 5 days.`);
                }
            } catch (cleanupErr) {
                console.error('[CronScheduler] Error cleaning up old notifications:', cleanupErr);
            }

            // 5. Enterprise Auto Withdrawal Scheduler Architecture
            try {
                const PaymentService = require('../../features/payment/payment-service');
                if (PaymentService && typeof PaymentService.processAutoWithdrawalScheduler === 'function') {
                    await PaymentService.processAutoWithdrawalScheduler();
                }
            } catch (autoWdlErr) {
                console.error('[CronScheduler] Error running Auto Withdrawal Scheduler:', autoWdlErr);
            }

            // 6. Abandoned Mixed Payment Checkout Auto-Rollback
            try {
                const Transaction = mongoose.model('Transaction');
                const { rollbackWalletDeduction } = require('../../features/payment/transaction-controller');

                const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
                const abandonedMixedTxns = await Transaction.find({
                    paymentMethod: 'mixed',
                    type: 'payment',
                    paymentStatus: 'pending',
                    createdAt: { $lte: thirtyMinsAgo }
                });

                for (const txn of abandonedMixedTxns) {
                    // Check 1 & 6 & 7: Verify transaction still pending and rollback not already performed
                    if (txn.paymentStatus !== 'pending' || (txn.description && txn.description.includes('Rolled Back'))) {
                        continue;
                    }

                    // Check 2: Verify Razorpay payment not captured
                    if (txn.razorpayPaymentId) {
                        try {
                            const razorpay = require('../../features/payment/razorpay');
                            if (razorpay) {
                                const livePayment = await razorpay.payments.fetch(txn.razorpayPaymentId);
                                if (livePayment && livePayment.status === 'captured') {
                                    console.log(`[CronScheduler] Mixed payment ${txn._id} payment ID ${txn.razorpayPaymentId} is captured at Razorpay. Skipping rollback.`);
                                    continue;
                                }
                            }
                        } catch (rzpErr) {
                            // Proceed cautiously if Razorpay check fails or payment is uncaptured
                        }
                    }

                    // Check 3, 4, 5: Verify booking not paid, not completed, and no successful transaction exists
                    if (txn.booking) {
                        const b = await Booking.findById(txn.booking).lean();
                        if (b && (b.paymentStatus === 'paid' || b.paymentStatus === 'settled' || b.status === 'completed')) {
                            continue;
                        }
                        const existingSuccessTx = await Transaction.findOne({
                            booking: txn.booking,
                            paymentStatus: { $in: ['success', 'completed', 'paid', 'captured'] }
                        }).lean();
                        if (existingSuccessTx) continue;
                    }

                    console.log(`[CronScheduler] Safely rolling back abandoned mixed checkout transaction ${txn._id}`);
                    await rollbackWalletDeduction(txn, null);
                }
            } catch (abandonedErr) {
                console.error('[CronScheduler] Error in abandoned mixed checkout cron rollback:', abandonedErr);
            }
        } catch (error) {
            console.error('[CronScheduler] Error in cron job:', error);
        }
    });
};

module.exports = { startCronJobs };
