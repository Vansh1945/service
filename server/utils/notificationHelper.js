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

const renderTemplateString = (str, context = {}) => {
    if (!str) return '';
    return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        const value = trimmedKey.split('.').reduce((acc, curr) => {
            if (acc && acc[curr] !== undefined) return acc[curr];
            return undefined;
        }, context);
        return value !== undefined ? value : match;
    });
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const d = R * c; // in metres
    return d;
};

const triggerEventNotification = async (eventId, context = {}, overrideTargetUserId = null) => {
    try {
        const mongoose = require('mongoose');
        const NotificationTemplate = mongoose.model('NotificationTemplate');

        const template = await NotificationTemplate.findOne({ eventId, isActive: true });
        if (!template) {
            console.warn(`[NotificationHelper] Active template not found for event: ${eventId}`);
            return null;
        }

        const title = renderTemplateString(template.title, context);
        const message = renderTemplateString(template.message, context);
        const type = template.priority === 'high' ? 'system' : 'booking';
        const url = template.ctaUrl || '/';

        const targetAudience = template.targetAudience || {};
        const role = targetAudience.role || 'customer';

        let targetUserIds = [];
        if (overrideTargetUserId) {
            targetUserIds = [overrideTargetUserId];
        } else {
            if (role === 'admin') {
                const Admin = mongoose.model('Admin');
                const admins = await Admin.find({ isActive: true }).select('_id');
                targetUserIds = admins.map(a => a._id);
            } else if (role === 'provider') {
                const Provider = mongoose.model('Provider');
                const providerQuery = { isActive: true, approved: true, isSuspended: { $ne: true } };

                if (targetAudience.providerStatus) {
                    if (targetAudience.providerStatus === 'online') {
                        providerQuery.isOnline = true;
                    } else if (targetAudience.providerStatus === 'available') {
                        providerQuery.isOnline = true;
                        providerQuery.activeBooking = null;
                    }
                }

                if (targetAudience.serviceCategory) {
                    providerQuery.services = targetAudience.serviceCategory;
                }

                if (targetAudience.ratingGte) {
                    providerQuery['performanceScore.rating'] = { $gte: targetAudience.ratingGte };
                }

                if (eventId === 'booking_created' && context.booking) {
                    const booking = context.booking;
                    const bookingServicesCategories = booking.services?.map(item => {
                        const cat = item.service?.category || item.serviceDetails?.category;
                        return cat?._id ? cat._id.toString() : cat?.toString();
                    }).filter(Boolean) || [];

                    if (bookingServicesCategories.length > 0) {
                        providerQuery.services = { $in: bookingServicesCategories };
                    }

                    const lat = parseFloat(booking.address?.lat);
                    const lng = parseFloat(booking.address?.lng);
                    const { SystemConfig } = require('../models/SystemSetting');
                    const settings = await SystemConfig.findOne();
                    const maxDistanceKm = settings?.bookingSettings?.autoAssignRadius || 15;
                    const maxDistanceMeters = maxDistanceKm * 1000;

                    const eligibleProviders = await Provider.find(providerQuery);

                    const providersWithinRadius = eligibleProviders.filter(p => {
                        const pLng = p.currentLocation?.coordinates?.[0];
                        const pLat = p.currentLocation?.coordinates?.[1];
                        if (typeof pLat === 'number' && typeof pLng === 'number' && (pLat !== 0 || pLng !== 0) && !isNaN(lat) && !isNaN(lng)) {
                            const dist = calculateDistance(lat, lng, pLat, pLng);
                            return dist <= maxDistanceMeters;
                        }
                        return false;
                    });
                    targetUserIds = providersWithinRadius.map(p => p._id);
                } else {
                    const matchedProviders = await Provider.find(providerQuery).select('_id');
                    targetUserIds = matchedProviders.map(p => p._id);
                }
            } else if (role === 'customer') {
                const User = mongoose.model('User');
                const userQuery = { role: 'customer' };
                if (targetAudience.subscriptionPlan) {
                    userQuery.subscriptionPlan = targetAudience.subscriptionPlan;
                }
                const matchedCustomers = await User.find(userQuery).select('_id');
                targetUserIds = matchedCustomers.map(u => u._id);
            }
        }

        console.log(`[NotificationEngine] Triggered "${eventId}": matched ${targetUserIds.length} target users of role "${role}"`);

        const results = [];
        for (const userId of targetUserIds) {
            const notif = await sendNotification(
                userId,
                role,
                title,
                message,
                type,
                context.booking?._id || context.bookingId || null,
                url,
                eventId
            );
            if (notif) results.push(notif);
        }

        return results;
    } catch (e) {
        console.error(`[NotificationHelper] Error triggering event "${eventId}":`, e);
        return null;
    }
};

/**
 * Create a notification in DB and emit it via Socket.io and FCM
 */
const sendNotification = async (userId, role, title, message, type = 'system', referenceId = null, url = '/', eventId = null) => {
    try {
        const mongoose = require('mongoose');
        const NotificationTemplate = mongoose.model('NotificationTemplate');

        let finalTitle = title;
        let finalMessage = message;
        let finalUrl = url;

        if (typeof message === 'object' && message !== null) {
            const template = await NotificationTemplate.findOne({ eventId: title, isActive: true });
            if (template) {
                finalTitle = renderTemplateString(template.title, message);
                finalMessage = renderTemplateString(template.message, message);
                if (template.ctaUrl) finalUrl = template.ctaUrl;
            } else {
                finalMessage = JSON.stringify(message);
            }
        } else {
            const template = await NotificationTemplate.findOne({ eventId: title, isActive: true });
            if (template) {
                const context = { title, message, role, type, referenceId, url };
                finalTitle = renderTemplateString(template.title, context);
                finalMessage = renderTemplateString(template.message, context);
                if (template.ctaUrl) finalUrl = template.ctaUrl;
            }
        }

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
        const generatedUrl = finalUrl !== '/' ? finalUrl : computeNotificationUrl(role, type, finalTitle, finalMessage);

        if (userId) {
            let Model;
            if (role === 'admin') Model = Admin;
            else if (role === 'provider') Model = Provider;
            else Model = User;

            const recipient = await Model.findById(userId).select('notificationPreferences fcmDevices');
            if (!recipient) {
                console.warn(`[Security Alert] Suppressed notification dispatch: User ${userId} is not a valid ${role}`);
                return null;
            }

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
                title: finalTitle,
                message: finalMessage,
                type,
                referenceId,
                url: generatedUrl
            });

            if (_io) {
                const room = userId.toString();
                const socketsInRoom = await _io.in(room).fetchSockets();
                console.log(`[Socket] Emitting to room "${room}" — ${socketsInRoom.length} socket(s) connected`);
                
                // Construct standard message data
                const socketPayload = {
                    _id: notification._id,
                    title: finalTitle,
                    message: finalMessage,
                    type,
                    referenceId,
                    url: generatedUrl,
                    isRead: false,
                    createdAt: notification.createdAt
                };

                // Detect booking alert to append socket ringtone metadata
                const isBookingAlert = role === 'provider' && (eventId === 'booking_created' || eventId === 'provider_assigned');
                if (isBookingAlert) {
                    const soundUrl = config ? config.providerBookingRingtone : '';
                    socketPayload.isBookingAlert = true;
                    socketPayload.soundUrl = soundUrl || 'https://assets.mixkit.co/active_storage/sfx/2568/2568-84.wav';
                    socketPayload.bookingAlertTone = true;
                    socketPayload.bookingVibration = true;
                    socketPayload.bookingAlertDuration = 60;
                    socketPayload.bookingRepeatAlert = true;
                }

                _io.to(room).emit('new_notification', socketPayload);

                const unreadCount = await Notification.countDocuments({ userId, isRead: false });
                _io.to(room).emit('unread_count_updated', { unreadCount });
            } else {
                console.warn('[Socket] _io not set — socket notification skipped');
            }

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
                    const isBookingAlert = role === 'provider' && (eventId === 'booking_created' || eventId === 'provider_assigned');
                    const soundUrl = isBookingAlert && config ? config.providerBookingRingtone : '';
                    const bookingAlertTone = true;
                    const bookingVibration = true;
                    const bookingAlertDuration = 60;
                    const bookingRepeatAlert = true;

                    await notificationService.notifyUser(userId, role, {
                        title: finalTitle,
                        body: finalMessage,
                        url: generatedUrl,
                        role: role,
                        sound: isBookingAlert && bookingAlertTone ? soundUrl : undefined,
                        data: {
                            bookingId: referenceId ? referenceId.toString() : '',
                            userId: userId.toString(),
                            type: type,
                            url: generatedUrl,
                            role: role,
                            ...(isBookingAlert ? {
                                isBookingAlert: 'true',
                                soundUrl: soundUrl || '',
                                bookingAlertTone: bookingAlertTone ? 'true' : 'false',
                                bookingVibration: bookingVibration ? 'true' : 'false',
                                bookingAlertDuration: String(bookingAlertDuration),
                                bookingRepeatAlert: bookingRepeatAlert ? 'true' : 'false'
                            } : {})
                        }
                    });
                } catch (fcmError) {
                    console.error(`[NotificationHelper] FCM Error:`, fcmError);
                }
            } else {
                console.log(`[NotificationHelper] FCM Push skipped/silenced for user ${userId}`);
            }
        } else if (role && _io) {
            _io.to(`role_${role}`).emit('new_notification', {
                title: finalTitle,
                message: finalMessage,
                type,
                referenceId,
                url: generatedUrl,
                isRead: false,
                createdAt: new Date()
            });

            if (role === 'admin') {
                try {
                    await notificationService.notifyAllAdmins({
                        title: finalTitle,
                        body: finalMessage,
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

module.exports = {
    sendNotification,
    notifyAdmins,
    setIO,
    renderTemplateString,
    triggerEventNotification
};


