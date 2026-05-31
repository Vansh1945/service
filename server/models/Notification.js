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
        enum: ['booking', 'payment', 'withdrawal', 'system', 'broadcast', 'approved', 'rejected', 'payout', 'complaint', 'earning_released'],
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
    broadcast_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Notification',
        default: null
    },
    delivered_at: {
        type: Date,
        default: null
    },
    read_at: {
        type: Date,
        default: null
    },
    clicked_at: {
        type: Date,
        default: null
    },
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
    scheduledFor: {
        type: Date,
        default: null
    },
    isScheduled: {
        type: Boolean,
        default: false
    },
    // Target Audience Filters
    targetCity: {
        type: String,
        default: null
    },
    targetZones: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Zone',
        default: []
    }],
    targetProviderCategory: {
        type: String,
        default: null
    },
    minBookings: {
        type: Number,
        default: 0
    },
    // Analytics tracking
    deliveredCount: {
        type: Number,
        default: 0
    },
    readCount: {
        type: Number,
        default: 0
    },
    clickedCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'failed', 'cancelled'],
        default: 'sent' // Backward compatibility: existing immediate notifications are 'sent'
    },
    retries: {
        type: Number,
        default: 0
    },
    isDeletedByAdmin: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 }); // Fast query for broadcast history
notificationSchema.index({ status: 1, scheduledFor: 1 }); // Fast query for CRON scheduler

module.exports = mongoose.model('Notification', notificationSchema);
