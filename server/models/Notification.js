const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: function () { return this.type !== 'broadcast'; }
    },
    role: {
        type: String,
        enum: ['customer', 'provider', 'admin'],
        required: function () { return this.type !== 'broadcast'; }
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['booking', 'payment', 'withdrawal', 'system', 'broadcast'],
        default: 'system'
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    // Tracking fields for broadcast notifications
    audience: {
        type: String,
        enum: ['all', 'customer', 'provider']
    },
    url: {
        type: String
    },
    sentAt: {
        type: Date,
        default: Date.now
    },
    totalSent: {
        type: Number,
        default: 0
    },
    successCount: {
        type: Number,
        default: 0
    },
    failureCount: {
        type: Number,
        default: 0
    },
    // Tracking fields for Scheduled Notifications
    scheduledTime: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'failed'],
        default: 'sent' // Backward compatibility: existing immediate notifications are 'sent'
    },
    retries: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 }); // Fast query for broadcast history
notificationSchema.index({ status: 1, scheduledTime: 1 }); // Fast query for CRON scheduler

module.exports = mongoose.model('Notification', notificationSchema);
