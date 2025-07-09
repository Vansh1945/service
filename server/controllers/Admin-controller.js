const Admin = require('../models/Admin-model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model')
const sendEmail = require('../utils/sendEmail');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const Complaint = require('../models/Complaint-model');
const ProviderEarning = require('../models/ProviderEarning-model');
const moment = require('moment');

/**
 * Register a new admin
 */
const registerAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email and password'
            });
        }

        // Check if admin exists
        const adminExists = await Admin.findOne({ email });
        if (adminExists) {
            return res.status(400).json({
                success: false,
                message: 'Admin already exists with this email'
            });
        }

        // Create new admin
        const admin = await Admin.create({
            name,
            email,
            password
        });

        // Generate JWT token
        const token = admin.generateJWT();

        // Prepare response data (excluding password)
        const adminData = {
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            isAdmin: admin.isAdmin,
            createdAt: admin.createdAt
        };

        res.status(201).json({
            success: true,
            message: 'Admin registered successfully',
            token,
            admin: adminData
        });

    } catch (error) {
        console.error('Admin registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
};



/**
 * Get admin profile (protected route)
 */
const getAdminProfile = async (req, res) => {
    try {
        // Admin data is already attached to req by the auth middleware
        const admin = req.admin;

        // Prepare response data
        const adminData = {
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            isAdmin: admin.isAdmin,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt
        };

        res.status(200).json({
            success: true,
            admin: adminData
        });

    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching profile'
        });
    }
};

/**
 * @desc    Approve provider account
 * @route   PUT /api/admin/providers/:id/approve
 * @access  Private (Admin)
 */
const approveProvider = async (req, res) => {
    try {
        const providerId = req.params.id;

        // Find and update provider
        const provider = await Provider.findByIdAndUpdate(
            providerId,
            {
                approved: true,
                approvedAt: new Date()
            },
            { new: true }
        ).select('-password');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        // Send approval email
        try {
            const emailResponse = await sendEmail({
                to: provider.email,
                subject: 'Your Provider Account Has Been Approved - Raj Electrical Service',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Account Approved</h2>
            <p>Dear ${provider.name},</p>
            <p>Your provider account with Raj Electrical Service has been approved by the admin.</p>
            <p>You can now login and start using your account.</p>
            <p style="margin-top: 30px;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/provider/login" 
                 style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
                Login to Your Account
              </a>
            </p>
            <p style="color: #6b7280; font-size: 0.9em; margin-top: 30px;">
              If you didn't request this, please contact our support team.
            </p>
          </div>
        `
            });

            console.log('Email sent successfully:', emailResponse);

        } catch (emailError) {
            console.error('Failed to send approval email:', emailError);
            // Continue even if email fails
            return res.status(200).json({
                success: true,
                message: 'Provider approved but failed to send email',
                provider
            });
        }

        res.status(200).json({
            success: true,
            message: 'Provider approved successfully. Notification email sent.',
            provider
        });

    } catch (error) {
        console.error('Approve provider error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while approving provider'
        });
    }
};

/**
 * @desc    Get pending providers
 * @route   GET /api/admin/providers/pending
 * @access  Private (Admin)
 */
const getPendingProviders = async (req, res) => {
    try {
        const providers = await Provider.find({
            approved: false,
            isDeleted: false
        }).select('-password');

        res.status(200).json({
            success: true,
            count: providers.length,
            providers
        });
    } catch (error) {
        console.error('Get pending providers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching pending providers'
        });
    }
};

const getAllCustomers = async (req, res) => {
    try {
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Search and filter
        const search = req.query.search || '';
        const filter = {
            role: 'customer',
            ...(search && {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } }
                ]
            })
        };

        const customers = await User.find(filter)
            .select('-password -__v')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: customers.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            customers
        });

    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching customers'
        });
    }
};

/**
 * @desc    Get all providers
 * @route   GET /api/admin/providers
 * @access  Private (Admin)
 */
const getAllProviders = async (req, res) => {
    try {
        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Search and filter
        const search = req.query.search || '';
        const status = req.query.status || 'all'; // all, approved, pending
        const filter = {
            role: 'provider',
            ...(status === 'approved' && { approved: true }),
            ...(status === 'pending' && { approved: false }),
            ...(search && {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                    { serviceArea: { $regex: search, $options: 'i' } }
                ]
            })
        };

        const providers = await Provider.find(filter)
            .select('-password -__v')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Provider.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: providers.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            providers
        });

    } catch (error) {
        console.error('Get providers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching providers'
        });
    }
};

/**
 * @desc    dashboard
 * @route   GET /api/admin/dashboard/stats
 * @access  Private (Admin)
 */
const getDashboardStats = async (req, res) => {
    try {
        // Set date ranges
        const today = moment().startOf('day');
        const currentWeek = moment().startOf('week');
        const currentMonth = moment().startOf('month');
        const currentYear = moment().startOf('year');

        // Parallelize all database queries for better performance
        const [
            totalBookings,
            todayBookings,
            weeklyBookings,
            monthlyBookings,
            yearlyBookings,
            bookingStatusStats,
            revenueStats,
            userStats,
            providerStats,
            serviceStats,
            complaintStats,
            recentBookings,
            topServices,
            topProviders
        ] = await Promise.all([
            // Booking counts
            Booking.countDocuments(),
            Booking.countDocuments({ createdAt: { $gte: today.toDate() } }),
            Booking.countDocuments({ createdAt: { $gte: currentWeek.toDate() } }),
            Booking.countDocuments({ createdAt: { $gte: currentMonth.toDate() } }),
            Booking.countDocuments({ createdAt: { $gte: currentYear.toDate() } }),

            // Booking status distribution
            Booking.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),

            // Revenue calculations
            Booking.aggregate([
                { $match: { status: 'completed' } },
                { 
                    $group: { 
                        _id: null,
                        totalRevenue: { $sum: '$totalAmount' },
                        todayRevenue: { 
                            $sum: { 
                                $cond: [
                                    { $gte: ['$createdAt', today.toDate()] },
                                    '$totalAmount',
                                    0
                                ]
                            }
                        },
                        weeklyRevenue: { 
                            $sum: { 
                                $cond: [
                                    { $gte: ['$createdAt', currentWeek.toDate()] },
                                    '$totalAmount',
                                    0
                                ]
                            }
                        },
                        monthlyRevenue: { 
                            $sum: { 
                                $cond: [
                                    { $gte: ['$createdAt', currentMonth.toDate()] },
                                    '$totalAmount',
                                    0
                                ]
                            }
                        }
                    } 
                }
            ]),

            // User statistics
            Promise.all([
                User.countDocuments(),
                User.countDocuments({ createdAt: { $gte: currentMonth.toDate() } }),
                User.aggregate([
                    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
                    { $sort: { _id: -1 } },
                    { $limit: 7 }
                ])
            ]),

            // Provider statistics
            Promise.all([
                Provider.countDocuments(),
                Provider.countDocuments({ approved: true }),
                Provider.countDocuments({ approved: false }),
                Provider.countDocuments({ testPassed: true }),
                Provider.countDocuments({ createdAt: { $gte: currentMonth.toDate() } })
            ]),

            // Service statistics
            Promise.all([
                Service.countDocuments(),
                Service.countDocuments({ isActive: true }),
                Service.countDocuments({ isActive: false })
            ]),

            // Complaint statistics
            Complaint.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),

            // Recent bookings (last 5)
            Booking.find()
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('customer', 'name')
                .populate('provider', 'name')
                .populate('service', 'title'),

            // Top 5 services by bookings
            Booking.aggregate([
                { $group: { _id: '$service', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'service' } },
                { $unwind: '$service' },
                { $project: { _id: 0, service: '$service.title', count: 1 } }
            ]),

            // Top 5 providers by earnings
            ProviderEarning.aggregate([
                { $group: { _id: '$provider', totalEarnings: { $sum: '$amount' } } },
                { $sort: { totalEarnings: -1 } },
                { $limit: 5 },
                { $lookup: { from: 'providers', localField: '_id', foreignField: '_id', as: 'provider' } },
                { $unwind: '$provider' },
                { $project: { _id: 0, provider: '$provider.name', totalEarnings: 1 } }
            ])
        ]);

        // Process the results
        const revenue = revenueStats[0] || {
            totalRevenue: 0,
            todayRevenue: 0,
            weeklyRevenue: 0,
            monthlyRevenue: 0
        };

        const bookingStatusCounts = bookingStatusStats.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});

        const complaintStatusCounts = complaintStats.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});

        // Prepare the response
        const dashboardStats = {
            overview: {
                totalBookings,
                todayBookings,
                weeklyBookings,
                monthlyBookings,
                yearlyBookings,
                bookingStatus: bookingStatusCounts,
                totalRevenue: revenue.totalRevenue,
                todayRevenue: revenue.todayRevenue,
                weeklyRevenue: revenue.weeklyRevenue,
                monthlyRevenue: revenue.monthlyRevenue
            },
            users: {
                total: userStats[0],
                newThisMonth: userStats[1],
                dailySignups: userStats[2]
            },
            providers: {
                total: providerStats[0],
                approved: providerStats[1],
                pendingApproval: providerStats[2],
                testPassed: providerStats[3],
                newThisMonth: providerStats[4]
            },
            services: {
                total: serviceStats[0],
                active: serviceStats[1],
                inactive: serviceStats[2]
            },
            complaints: {
                ...complaintStatusCounts
            },
            recentBookings,
            topServices,
            topProviders
        };

        res.json({
            success: true,
            data: dashboardStats
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics'
        });
    }
};


module.exports = {
    registerAdmin,
    getAdminProfile,
    approveProvider,
    getPendingProviders,
    getAllCustomers,
    getAllProviders,
    getDashboardStats
};