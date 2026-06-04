const NodeCache = require('node-cache');
const Booking = require('../models/Booking-model');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model');
const Complaint = require('../models/Complaint-model');
const Transaction = require('../models/Transaction-model');
const moment = require('moment');

// Refresh every 5 minutes (300 seconds)
const analyticsCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const refreshAnalytics = async () => {
    try {
        console.log('[AnalyticsService] Refreshing precomputed analytics...');
        
        const today = moment().startOf('day').toDate();
        const startOfMonth = moment().startOf('month').toDate();

        const [
            totalBookings,
            todayBookings,
            pendingProviders,
            totalUsers,
            totalProviders,
            complaintCounts,
            revenueStats,
            adminEarningsStats
        ] = await Promise.all([
            Booking.countDocuments(),
            Booking.countDocuments({ createdAt: { $gte: today } }),
            // PRODUCTION FIX
            Provider.countDocuments({ approved: false, isDeleted: false }),
            User.countDocuments({ role: 'customer' }),
            Provider.countDocuments({ approved: true, isDeleted: false }),
            Complaint.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),
            // Existing revenueStats aggregation
          Booking.aggregate([
            { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, monthlyRevenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$cancellationProgress.refundAmount", 0] }] } } } }
          ]),
          // New admin earnings aggregation (commission + companySurgeShare)
          Booking.aggregate([
            { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, totalAdminEarnings: { $sum: { $add: ["$commissionAmount", { $ifNull: ["$companySurgeShare", 0] }] } } } }
          ])
        ]);

        const analytics = {
            totalBookings,
            todayBookings,
            pendingProviders,
            totalUsers,
            totalProviders,
            complaintCounts: complaintCounts.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {}),
            monthlyRevenue: revenueStats[0]?.monthlyRevenue || 0,
            totalAdminEarnings: adminEarningsStats[0]?.totalAdminEarnings || 0,
            lastRefreshed: new Date()
        };

        analyticsCache.set('dashboard_analytics', analytics);
        console.log('[AnalyticsService] Analytics refreshed successfully');
        return analytics;
    } catch (error) {
        console.error('[AnalyticsService] Error refreshing analytics:', error);
    }
};

const getPrecomputedAnalytics = () => {
    return analyticsCache.get('dashboard_analytics');
};

// Initial refresh delayed to wait for DB connection
const mongoose = require('mongoose');

if (mongoose.connection.readyState === 1) {
    refreshAnalytics();
} else {
    mongoose.connection.once('open', refreshAnalytics);
}

// Set interval for periodic refresh
setInterval(refreshAnalytics, 300000);

module.exports = {
    refreshAnalytics,
    getPrecomputedAnalytics
};
