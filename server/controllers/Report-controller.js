const Booking = require('../models/Booking-model');
const Complaint = require('../models/Complaint-model');
const Transaction = require('../models/Transaction-model ');
const ProviderEarning = require('../models/ProviderEarning-model');
const moment = require('moment');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

/**
 * Generate earnings report (CSV/PDF)
 */
const generateEarningsReport = async (req, res) => {
    try {
        const format = req.query.format || 'csv'; // csv or pdf
        const period = req.query.period || 'all'; // all, month, week

        let dateFilter = {};
        if (period === 'month') {
            dateFilter = { createdAt: { $gte: moment().startOf('month').toDate() } };
        } else if (period === 'week') {
            dateFilter = { createdAt: { $gte: moment().startOf('week').toDate() } };
        }

        // Fetch earnings data similar to getEarningsData
        const totalEarnings = await Booking.aggregate([
            { $match: { status: 'completed', ...dateFilter } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        const totalPlatformEarnings = totalEarnings[0]?.total || 0;

        const adminCommissionRate = 0.10; // 10% default
        const totalAdminCommission = totalPlatformEarnings * adminCommissionRate;

        // Earnings trends
        const earningsTrends = await Booking.aggregate([
            { $match: { status: 'completed', createdAt: { $gte: moment().subtract(30, 'days').toDate() }, ...dateFilter } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$totalAmount' } } },
            { $sort: { '_id': 1 } }
        ]);

        // Top providers
        const topProviders = await Booking.aggregate([
            { $match: { status: 'completed', ...dateFilter } },
            { $lookup: { from: 'providers', localField: 'provider', foreignField: '_id', as: 'provider' } },
            { $unwind: '$provider' },
            { $group: { _id: '$provider._id', name: { $first: '$provider.name' }, totalEarnings: { $sum: '$totalAmount' }, completedBookings: { $sum: 1 } } },
            { $sort: { totalEarnings: -1 } },
            { $limit: 10 },
            { $project: { _id: 1, name: 1, totalEarnings: 1, completedBookings: 1 } }
        ]);

        const reportData = {
            summary: {
                totalPlatformEarnings,
                totalAdminCommission,
                period
            },
            trends: earningsTrends,
            topProviders
        };

        if (format === 'csv') {
            // Flatten data for CSV
            const csvData = [];

            // Summary
            csvData.push({ section: 'Summary', key: 'Total Platform Earnings', value: totalPlatformEarnings });
            csvData.push({ section: 'Summary', key: 'Total Admin Commission', value: totalAdminCommission });
            csvData.push({ section: 'Summary', key: 'Period', value: period });

            // Trends
            earningsTrends.forEach(trend => {
                csvData.push({ section: 'Trends', date: trend._id, total: trend.total });
            });

            // Top Providers
            topProviders.forEach(provider => {
                csvData.push({ section: 'Top Providers', name: provider.name, totalEarnings: provider.totalEarnings, completedBookings: provider.completedBookings });
            });

            const csvParser = new Parser();
            const csv = csvParser.parse(csvData);

            res.header('Content-Type', 'text/csv');
            res.attachment(`earnings-report-${period}-${moment().format('YYYY-MM-DD')}.csv`);
            res.send(csv);
        } else if (format === 'pdf') {
