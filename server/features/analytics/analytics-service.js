const analyticsCache = require('../../shared/utils/cache');
const Booking = require('../booking/booking-model');
const Provider = require('../provider/provider-model');
const ProviderEarning = require('../provider/provider-earning-model');
const User = require('../user/user-model');
const Complaint = require('../complaint/complaint-model');
const Transaction = require('../payment/transaction-model');
const moment = require('moment');

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
            adminEarningsStats,
            paymentMethodStats,
            withdrawalStats,
            heldPayoutsStats
        ] = await Promise.all([
            Booking.countDocuments(),
            Booking.countDocuments({ createdAt: { $gte: today } }),
            Provider.countDocuments({ approved: false, isDeleted: false }),
            User.countDocuments({ role: 'customer' }),
            Provider.countDocuments({ approved: true, isDeleted: false }),
            Complaint.aggregate([
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),
            Booking.aggregate([
                { $match: { status: 'completed' } },
                {
                    $group: {
                        _id: null,
                        grossRevenue: { $sum: "$totalAmount" },
                        monthlyRevenue: { $sum: { $cond: [{ $gte: ["$createdAt", startOfMonth] }, { $subtract: ["$totalAmount", { $ifNull: ["$cancellationProgress.refundAmount", 0] }] }, 0] } },
                        netRevenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$cancellationProgress.refundAmount", 0] }] } },
                        netEarnings: { $sum: "$commissionAmount" },
                        platformFeeRevenue: { $sum: { $ifNull: ["$platformFee", 0] } },
                        providerEarnings: { $sum: { $ifNull: ["$providerEarnings", 0] } },
                        refundAmount: { $sum: { $ifNull: ["$cancellationProgress.refundAmount", 0] } },
                        visitingRevenue: { $sum: { $ifNull: ["$visitingCharge", 0] } },
                        rainRevenue: { $sum: { $ifNull: ["$rainCharge", 0] } },
                        trafficRevenue: { $sum: { $ifNull: ["$trafficCharge", 0] } },
                        nightRevenue: { $sum: { $ifNull: ["$nightCharge", 0] } },
                        demandRevenue: { $sum: { $ifNull: ["$demandSurge", 0] } },
                        customRevenue: { $sum: { $ifNull: ["$customCharges", 0] } },
                        providerSurgeShare: { $sum: { $ifNull: ["$providerSurgeShare", 0] } },
                        companySurgeShare: { $sum: { $ifNull: ["$companySurgeShare", 0] } }
                    }
                }
            ]),
            Booking.aggregate([
                { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
                { $group: { _id: null, totalAdminEarnings: { $sum: { $add: [{ $ifNull: ["$commissionAmount", 0] }, { $ifNull: ["$companySurgeShare", 0] }] } } } }
            ]),
            Transaction.aggregate([
                { $match: { type: 'payment', paymentStatus: { $in: ['completed', 'paid', 'success'] } } },
                { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
                { $project: { paymentMethod: '$_id', count: 1, totalAmount: 1, _id: 0 } }
            ]),
            Transaction.aggregate([
                { $match: { type: 'withdrawal', paymentStatus: { $in: ['completed', 'paid', 'success'] } } },
                { $group: { _id: null, totalWithdrawals: { $sum: '$amount' }, withdrawalCount: { $sum: 1 } } }
            ]),
            ProviderEarning.aggregate([
                { $match: { status: 'held' } },
                { $group: { _id: null, totalHeld: { $sum: '$netAmount' }, count: { $sum: 1 } } }
            ])
        ]);

        const rStats = revenueStats[0] || {};
        const visitingRevenue = rStats.visitingRevenue || 0;
        const rainRevenue = rStats.rainRevenue || 0;
        const trafficRevenue = rStats.trafficRevenue || 0;
        const nightRevenue = rStats.nightRevenue || 0;
        const demandRevenue = rStats.demandRevenue || 0;
        const customRevenue = rStats.customRevenue || 0;
        const platformFeeRevenue = rStats.platformFeeRevenue || 0;

        const surgeRevenue = visitingRevenue + rainRevenue + trafficRevenue + nightRevenue + demandRevenue + customRevenue;

        const analytics = {
            totalBookings,
            todayBookings,
            pendingProviders,
            totalUsers,
            totalProviders,
            grossRevenue: rStats.grossRevenue || 0,
            monthlyRevenue: rStats.monthlyRevenue || 0,
            totalRevenue: rStats.netRevenue || 0,
            netRevenue: rStats.netRevenue || 0,
            netEarnings: rStats.netEarnings || 0,
            platformFeeRevenue,
            providerEarnings: rStats.providerEarnings || 0,
            refundAmount: rStats.refundAmount || 0,
            surgeRevenue,
            surgeBreakdown: {
                visitingRevenue,
                rainRevenue,
                trafficRevenue,
                nightRevenue,
                demandRevenue,
                customRevenue,
                platformFeeRevenue
            },
            surgeSplits: {
                providerSurgeShare: rStats.providerSurgeShare || 0,
                companySurgeShare: rStats.companySurgeShare || 0
            },
            totalWithdrawals: withdrawalStats[0]?.totalWithdrawals || 0,
            withdrawalCount: withdrawalStats[0]?.withdrawalCount || 0,
            totalHeldPayouts: heldPayoutsStats[0]?.totalHeld || 0,
            heldPayoutsCount: heldPayoutsStats[0]?.count || 0,
            paymentMethods: paymentMethodStats,
            complaintCounts: complaintCounts.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {}),
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
