const Admin = require('../models/Admin-model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const Complaint = require('../models/Complaint-model');
const Transaction = require('../models/Transaction-model');
const Coupon = require('../models/Coupon-model');
const ProviderEarning = require('../models/ProviderEarning-model');
const PaymentRecord = require('../models/PaymentRecord-model');
const Feedback = require('../models/Feedback-model');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../services/cloudinary');
const mongoose = require('mongoose');
const { sendNotification } = require('../utils/notificationHelper');
const generateProviderId = require('../utils/generateUniqueId');
const { sendMail } = require('../utils/sendmail');

const { getPrecomputedAnalytics } = require('../services/AnalyticsService');

/**
 * Register a new admin
 */
const registerAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body || {};

        // Validate input
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, email and password'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
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

        let profilePicUrl = '';

        // Try to upload default profile pic to Cloudinary
        try {
            const defaultImagePath = path.join(__dirname, '../assets/Profile.png');
            if (fs.existsSync(defaultImagePath)) {
                const uploadedImage = await cloudinary.uploader.upload(defaultImagePath, {
                    folder: 'admin-profiles',
                    use_filename: true,
                    unique_filename: false
                });
                profilePicUrl = uploadedImage.secure_url;
            }
        } catch (uploadError) {
            console.warn('Could not upload default profile image:', uploadError.message);
            // Continue without profile picture
        }

        // Create new admin
        const admin = await Admin.create({
            name,
            email,
            password,
            profilePicUrl
        });

        // Generate JWT token
        const token = admin.generateJWT();

        res.status(201).json({
            success: true,
            message: 'Admin registered successfully',
            token,
            admin: admin.toJSON()
        });

    } catch (error) {
        console.error('Admin registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get admin profile
 */
const getAdminProfile = async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin._id);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        res.status(200).json({
            success: true,
            admin: admin.toJSON()
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
 * Get all Customers
 */
const getAllCustomers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        const searchFilter = search ? {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ]
        } : {};

        const pipeline = [
            {
                $match: {
                    role: 'customer',
                    ...searchFilter
                }
            },
            {
                $lookup: {
                    from: 'bookings',
                    localField: '_id',
                    foreignField: 'customer',
                    as: 'userBookings'
                }
            },
            {
                $addFields: {
                    totalBookings: { $size: '$userBookings' },
                    totalSpent: { $sum: '$userBookings.totalAmount' }
                }
            },
            {
                $project: {
                    userBookings: 0, // Exclude the bookings array from the final output
                    password: 0,
                    __v: 0
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        const customers = await User.aggregate(pipeline);
        const total = await User.countDocuments({ role: 'customer', ...searchFilter });

        res.status(200).json({
            success: true,
            count: customers.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            users: customers,
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
 * Approve or reject provider account
 */
const approveProvider = async (req, res) => {
    try {
        const queryId = req.params.id;
        const { status, remarks, rejectionReason } = req.body;
        const finalRemarks = remarks || rejectionReason || '';

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "approved" or "rejected"'
            });
        }

        let matchQuery = { providerId: queryId };
        if (mongoose.isValidObjectId(queryId) && queryId.length === 24) {
            matchQuery = { $or: [{ _id: queryId }, { providerId: queryId }] };
        }

        const provider = await Provider.findOne(matchQuery);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        if (status === 'approved') {
            provider.approved = true;
            if (global.logger) global.logger.info(`Provider approved: ${provider._id}`);

            provider.kycStatus = 'approved';
            provider.rejectionReason = '';
            provider.isActive = true;
            if (provider.bankDetails) {
                provider.bankDetails.verified = true;
            }
            if (!provider.providerId) {
                provider.providerId = generateProviderId();
            }

            await provider.save();

            // Send approval push notification
            try {
                sendNotification(
                    provider._id,
                    'provider',
                    'Account Approved 🎓',
                    `Congratulations! Your provider account has been approved. ${finalRemarks ? '\nRemarks: ' + finalRemarks : ''}`,
                    'approved',
                    provider._id
                );
            } catch (fcmError) {
                console.error('Failed to send approval notification:', fcmError);
            }

            // Send approval email
            try {
                await sendMail({
                    to: provider.email,
                    subject: 'Congratulations! Your Provider Account is Approved',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                            <h2 style="color: #2c3e50; text-align: center;">Account Approved!</h2>
                            <p>Dear ${provider.name},</p>
                            <p>We are excited to inform you that your provider account on our platform has been <strong>Approved</strong>.</p>
                            <p>Your Provider ID is: <strong>${provider.providerId}</strong></p>
                            ${finalRemarks ? `<p><strong>Admin Remarks:</strong> ${finalRemarks}</p>` : ''}
                            <p>You can now log in to your dashboard and start accepting bookings.</p>
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="${process.env.FRONTEND_URL}/login" style="background-color: #0D9488; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Dashboard</a>
                            </div>
                            <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">If you have any questions, please contact our support team.</p>
                        </div>
                    `
                });
            } catch (mailError) {
                console.error('Failed to send approval email:', mailError);
            }

            // Invalidate dashboard caches



            return res.status(200).json({
                success: true,
                message: 'Provider approved successfully',
                provider: provider.toJSON()
            });
        }

        if (status === 'rejected') {
            provider.approved = false;
            provider.kycStatus = 'rejected';
            if (global.logger) global.logger.warn(`Provider rejected: ${provider._id}`);

            provider.rejectionReason = finalRemarks || 'No reason provided';
            provider.isActive = false;

            await provider.save();

            // Send rejection push notification
            try {
                sendNotification(
                    provider._id,
                    'provider',
                    'Account Rejected ❌',
                    `Your provider account has been rejected. Reason: ${provider.rejectionReason}`,
                    'rejected',
                    provider._id
                );
            } catch (fcmError) {
                console.error('Failed to send rejection notification:', fcmError);
            }

            // Send rejection email
            try {
                await sendMail({
                    to: provider.email,
                    subject: 'Update Regarding Your Provider Account',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                            <h2 style="color: #c0392b; text-align: center;">Account Update</h2>
                            <p>Dear ${provider.name},</p>
                            <p>We regret to inform you that your provider account application has been <strong>Rejected</strong> at this time.</p>
                            <p><strong>Reason for Rejection:</strong> ${provider.rejectionReason}</p>
                            <p>If you believe this was an error or you have updated your documents, you can update your profile and resubmit for verification.</p>
                            <p style="margin-top: 30px; font-size: 12px; color: #7f8c8d;">For further assistance, please reach out to our support team.</p>
                        </div>
                    `
                });
            } catch (mailError) {
                console.error('Failed to send rejection email:', mailError);
            }

            // Invalidate dashboard caches



            return res.status(200).json({
                success: true,
                message: 'Provider rejected successfully',
                provider: provider.toJSON()
            });
        }

    } catch (error) {
        console.error('Update provider status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating provider status',
            error: error.message
        });
    }
};

/**
 * Get pending providers
 */
const getPendingProviders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        const filter = {
            approved: false,
            isDeleted: false,
            ...(search && {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { providerId: { $regex: search, $options: 'i' } }
                ]
            })
        };

        const providersPipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'services',
                    foreignField: '_id',
                    as: 'serviceCategories'
                }
            },
            {
                $lookup: {
                    from: 'feedbacks',
                    localField: '_id',
                    foreignField: 'providerFeedback.provider',
                    as: 'feedback'
                }
            },
            {
                $addFields: {
                    averageRating: { $ifNull: [{ $avg: '$feedback.providerFeedback.rating' }, 0] },
                    services: {
                        $map: {
                            input: '$serviceCategories',
                            as: 'category',
                            in: '$$category.name'
                        }
                    }
                }
            },
            {
                $project: {
                    password: 0,
                    __v: 0,
                    feedback: 0, // Exclude the feedback array from the final output
                    serviceCategories: 0 // Exclude the populated categories array
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        const providers = await Provider.aggregate(providersPipeline);
        const total = await Provider.countDocuments(filter);

        // Calculate age and performance badge for each provider
        providers.forEach(provider => {
            if (provider.dateOfBirth) {
                const today = new Date();
                const birthDate = new Date(provider.dateOfBirth);
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                provider.age = age;
            }

            // Performance Badge Calculation
            const rating = provider.averageRating || 0;
            const completion = provider.performanceScore?.completionPercentage || 0;
            const onTime = provider.performanceScore?.onTimePercentage || 0;

            let performanceBadge = 'Bronze';
            if (rating >= 4.5 && completion >= 95 && onTime >= 95) {
                performanceBadge = 'Platinum';
            } else if (rating >= 4.0 && completion >= 90 && onTime >= 90) {
                performanceBadge = 'Gold';
            } else if (rating >= 3.5 && completion >= 85 && onTime >= 85) {
                performanceBadge = 'Silver';
            }

            provider.performanceBadge = performanceBadge;
            provider.completionRate = completion;
            provider.onTimeRate = onTime;
        });

        res.status(200).json({
            success: true,
            count: providers.length,
            total,
            page,
            pages: Math.ceil(total / limit),
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

/**
 * Get all providers
 */
const getAllProviders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        const filter = {
            isDeleted: false,
            ...(status === 'approved' && { approved: true }),
            ...(status === 'pending' && { approved: false }),
            ...(status === 'rejected' && { kycStatus: 'rejected' }),
            ...(search && {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { providerId: { $regex: search, $options: 'i' } }
                ]
            })
        };

        const providersPipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'services',
                    foreignField: '_id',
                    as: 'serviceCategories'
                }
            },
            {
                $lookup: {
                    from: 'feedbacks',
                    localField: '_id',
                    foreignField: 'providerFeedback.provider',
                    as: 'feedback'
                }
            },
            {
                $addFields: {
                    averageRating: { $ifNull: [{ $avg: '$feedback.providerFeedback.rating' }, 0] },
                    services: {
                        $map: {
                            input: '$serviceCategories',
                            as: 'category',
                            in: '$$category.name'
                        }
                    }
                }
            },
            {
                $project: {
                    password: 0,
                    __v: 0,
                    feedback: 0, // Exclude the feedback array from the final output
                    serviceCategories: 0 // Exclude the populated categories array
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        const providers = await Provider.aggregate(providersPipeline);
        const total = await Provider.countDocuments(filter);

        // Calculate age and performance badge for each provider
        providers.forEach(provider => {
            if (provider.dateOfBirth) {
                const today = new Date();
                const birthDate = new Date(provider.dateOfBirth);
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                provider.age = age;
            }

            // Performance Badge Calculation
            const rating = provider.averageRating || 0;
            const completion = provider.performanceScore?.completionPercentage || 0;
            const onTime = provider.performanceScore?.onTimePercentage || 0;

            let performanceBadge = 'Bronze';
            if (rating >= 4.5 && completion >= 95 && onTime >= 95) {
                performanceBadge = 'Platinum';
            } else if (rating >= 4.0 && completion >= 90 && onTime >= 90) {
                performanceBadge = 'Gold';
            } else if (rating >= 3.5 && completion >= 85 && onTime >= 85) {
                performanceBadge = 'Silver';
            }

            provider.performanceBadge = performanceBadge;
            provider.completionRate = completion;
            provider.onTimeRate = onTime;
        });

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
 * Get provider details
 */
const getProviderDetails = async (req, res) => {
    try {
        const queryId = req.params.id;

        let matchQuery = { providerId: queryId };
        if (mongoose.isValidObjectId(queryId) && queryId.length === 24) {
            matchQuery = { $or: [{ _id: new mongoose.Types.ObjectId(queryId) }, { providerId: queryId }] };
        }

        const providerPipeline = [
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'services',
                    foreignField: '_id',
                    as: 'serviceCategories'
                }
            },
            {
                $lookup: {
                    from: 'feedbacks',
                    localField: '_id',
                    foreignField: 'providerFeedback.provider',
                    as: 'feedback'
                }
            },
            {
                $addFields: {
                    averageRating: { $ifNull: [{ $avg: '$feedback.providerFeedback.rating' }, 0] },
                    services: {
                        $map: {
                            input: '$serviceCategories',
                            as: 'category',
                            in: '$$category.name'
                        }
                    }
                }
            },
            {
                $project: {
                    password: 0,
                    __v: 0,
                    feedback: 0, // Exclude the feedback array from the final output
                    serviceCategories: 0 // Exclude the populated categories array
                }
            }
        ];

        const providers = await Provider.aggregate(providerPipeline);

        if (!providers || providers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        const provider = providers[0];

        // Calculate age and performance badge dynamically
        if (provider.dateOfBirth) {
            const today = new Date();
            const birthDate = new Date(provider.dateOfBirth);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            provider.age = age;
        }

        // Performance Badge Calculation
        const rating = provider.averageRating || 0;
        const completion = provider.performanceScore?.completionPercentage || 0;
        const onTime = provider.performanceScore?.onTimePercentage || 0;

        let performanceBadge = 'Bronze';
        if (rating >= 4.5 && completion >= 95 && onTime >= 95) {
            performanceBadge = 'Platinum';
        } else if (rating >= 4.0 && completion >= 90 && onTime >= 90) {
            performanceBadge = 'Gold';
        } else if (rating >= 3.5 && completion >= 85 && onTime >= 85) {
            performanceBadge = 'Silver';
        }

        provider.performanceBadge = performanceBadge;
        provider.completionRate = completion;
        provider.onTimeRate = onTime;

        res.status(200).json({
            success: true,
            provider
        });

    } catch (error) {
        console.error('Get provider details error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching provider details'
        });
    }
};

/**
 * Get customer details
 */
const getCustomerById = async (req, res) => {
    try {
        const customerId = req.params.id;
        const customer = await User.findById(customerId).select('-password').lean();

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.status(200).json({
            success: true,
            user: customer
        });

    } catch (error) {
        console.error('Get customer by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching customer details'
        });
    }
};

/**
 * Get dashboard stats
 */
const getDashboardStats = async (req, res) => {
    try {
        const cacheKey = 'admin_dashboard_stats';

        // 1. Try In-Memory Precomputed Analytics (Fastest)
        const precomputed = getPrecomputedAnalytics();
        if (precomputed) {
            return res.json({
                success: true,
                data: {
                    overview: {
                        totalUsers: precomputed.totalUsers,
                        totalProviders: precomputed.totalProviders || 0, // Fallback if not in precomputed
                        totalBookings: precomputed.totalBookings,
                        todayBookings: precomputed.todayBookings,
                        monthlyRevenue: precomputed.monthlyRevenue,
                        complaintCounts: precomputed.complaintCounts,
                        lastRefreshed: precomputed.lastRefreshed
                    },
                    isPrecomputed: true
                }
            });
        }



        // 3. Fallback to DB (Optimized)
        const today = moment().startOf('day').toDate();
        const currentWeek = moment().startOf('week').toDate();
        const currentMonth = moment().startOf('month').toDate();

        const [
            totalUsers,
            totalProviders,
            totalBookings,
            totalServices,
            todayBookings,
            weeklyBookings,
            monthlyBookings,
            pendingProviders
        ] = await Promise.all([
            User.countDocuments().lean(),
            Provider.countDocuments({ approved: true }).lean(),
            Booking.countDocuments().lean(),
            Service.countDocuments({ isActive: true }).lean(),
            Booking.countDocuments({ createdAt: { $gte: today } }).lean(),
            Booking.countDocuments({ createdAt: { $gte: currentWeek } }).lean(),
            Booking.countDocuments({ createdAt: { $gte: currentMonth } }).lean(),
            Provider.countDocuments({ approved: false }).lean()
        ]);

        const [revenueStats, paymentMethodStats, withdrawalStats, disputeStats, heldPayoutsStats] = await Promise.all([
            Booking.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
            ]).lean(),
            Transaction.aggregate([
                { $match: { paymentStatus: 'completed' } },
                { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
                { $project: { paymentMethod: '$_id', count: 1, totalAmount: 1, _id: 0 } }
            ]).lean(),
            Transaction.aggregate([
                { $match: { type: 'withdrawal', paymentStatus: 'completed' } },
                { $group: { _id: null, totalWithdrawals: { $sum: '$amount' }, withdrawalCount: { $sum: 1 } } }
            ]).lean(),
            Booking.aggregate([
                { $match: { disputeRaised: true } },
                { $group: { _id: '$disputeStatus', count: { $sum: 1 } } }
            ]).lean(),
            ProviderEarning.aggregate([
                { $match: { status: 'held' } },
                { $group: { _id: null, totalHeld: { $sum: '$netAmount' }, count: { $sum: 1 } } }
            ]).lean()
        ]);

        const totalRevenue = revenueStats[0]?.totalRevenue || 0;
        const totalWithdrawals = withdrawalStats[0]?.totalWithdrawals || 0;
        const withdrawalCount = withdrawalStats[0]?.withdrawalCount || 0;
        const totalDisputes = await Booking.countDocuments({ disputeRaised: true }).lean();
        const totalRefundsCount = await Booking.countDocuments({ paymentStatus: 'refunded' }).lean();

        const dashboardStats = {
            overview: {
                totalUsers,
                totalProviders,
                totalBookings,
                totalServices,
                todayBookings,
                weeklyBookings,
                monthlyBookings,
                pendingProviders,
                totalRevenue,
                totalWithdrawals,
                withdrawalCount,
                totalDisputes,
                totalRefundsCount,
                totalHeldPayouts: heldPayoutsStats[0]?.totalHeld || 0,
                heldPayoutsCount: heldPayoutsStats[0]?.count || 0
            },
            paymentMethods: paymentMethodStats,
            disputes: disputeStats
        };



        res.json({
            success: true,
            data: dashboardStats
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard statistics',
            error: error.message
        });
    }
};

/**
 * Get all admins
 */
const getAllAdmins = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        const filter = {
            ...(search && {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            })
        };

        const admins = await Admin.find(filter)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .lean();

        const total = await Admin.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: admins.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            admins: admins.map(admin => {
                const { password, __v, ...rest } = admin;
                return rest;
            })
        });

    } catch (error) {
        console.error('Get all admins error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching admins'
        });
    }
};

/**
 * Update admin profile
 */
const updateAdminProfile = async (req, res) => {
    try {
        const { name, email } = req.body;
        const admin = await Admin.findById(req.admin._id);

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        admin.name = name || admin.name;

        if (email && email !== admin.email) {
            const emailExists = await Admin.findOne({ email });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
            admin.email = email;
        }

        if (req.file) {
            try {
                const uploadedImage = await cloudinary.uploader.upload(req.file.path, {
                    folder: 'admin-profiles'
                });
                admin.profilePicUrl = uploadedImage.secure_url;
            } catch (uploadError) {
                console.error('Image upload error:', uploadError);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to upload profile image'
                });
            }
        }

        await admin.save();

        res.status(200).json({
            success: true,
            message: 'Admin profile updated successfully',
            admin: admin.toJSON()
        });

    } catch (error) {
        console.error('Update admin profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating profile'
        });
    }
};

/**
 * Delete admin
 */
const deleteAdmin = async (req, res) => {
    try {
        const adminId = req.params.id;

        // Prevent self-deletion
        if (adminId === req.admin._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const admin = await Admin.findByIdAndDelete(adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Admin deleted successfully'
        });

    } catch (error) {
        console.error('Delete admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting admin'
        });
    }
};

/**
 * Get dashboard summary with KPIs
 */
const getDashboardSummary = async (req, res) => {
    try {
        const { city, serviceCategory } = req.query;
        const today = moment().startOf('day');
        const currentMonth = moment().startOf('month');

        // Build match conditions for bookings
        let bookingMatchConditions = {};
        if (city) {
            bookingMatchConditions['address.city'] = { $regex: city, $options: 'i' };
        }
        if (serviceCategory) {
            // Find service IDs that match the category name
            const serviceIds = await Service.aggregate([
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'category',
                        foreignField: '_id',
                        as: 'cat'
                    }
                },
                {
                    $unwind: '$cat'
                },
                {
                    $match: {
                        'cat.name': { $regex: serviceCategory, $options: 'i' }
                    }
                },
                {
                    $project: {
                        _id: 1
                    }
                }
            ]);
            const ids = serviceIds.map(s => s._id);
            if (ids.length > 0) {
                bookingMatchConditions['services.service'] = { $in: ids };
            } else {
                // No services found, return zeros
                return res.status(200).json({
                    success: true,
                    data: {
                        totalBookings: 0,
                        todayBookings: 0,
                        ongoingBookings: 0,
                        cancelledBookings: 0,
                        totalCustomers: 0,
                        totalProviders: 0,
                        todayRevenue: 0,
                        monthlyRevenue: 0,
                        pendingPayoutAmount: 0
                    }
                });
            }
        }

        // Total bookings
        const totalBookings = await Booking.countDocuments(bookingMatchConditions);

        // Today's bookings
        const todayBookings = await Booking.countDocuments({
            ...bookingMatchConditions,
            createdAt: { $gte: today.toDate() }
        });

        // Ongoing bookings (in-progress or accepted)
        const ongoingBookings = await Booking.countDocuments({
            ...bookingMatchConditions,
            status: { $in: ['in-progress', 'accepted', 'scheduled'] }
        });

        // Cancelled bookings
        const cancelledBookings = await Booking.countDocuments({
            ...bookingMatchConditions,
            status: 'cancelled'
        });

        // Total customers - filter by city if provided (assuming customers have address)
        let customerMatch = { role: 'customer' };
        if (city) {
            customerMatch['address.city'] = { $regex: city, $options: 'i' };
        }
        const totalCustomers = await User.countDocuments(customerMatch);

        // Total providers - filter by city if provided
        let providerMatch = { approved: true };
        if (city) {
            providerMatch['address.city'] = { $regex: city, $options: 'i' };
        }
        const totalProviders = await Provider.countDocuments(providerMatch);

        // Today's revenue
        const todayRevenueResult = await Booking.aggregate([
            {
                $match: {
                    ...bookingMatchConditions,
                    status: 'completed',
                    createdAt: { $gte: today.toDate() }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);
        const todayRevenue = todayRevenueResult[0]?.total || 0;

        // Monthly revenue
        const monthlyRevenueResult = await Booking.aggregate([
            {
                $match: {
                    ...bookingMatchConditions,
                    status: 'completed',
                    createdAt: { $gte: currentMonth.toDate() }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' }
                }
            }
        ]);
        const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;

        // Pending payout amount (from provider earnings) - filter by city if provided
        let payoutMatch = {
            status: { $in: ['pending', 'processing'] }
        };
        if (city) {
            // Assuming provider earnings can be linked to provider's city
            const providerIds = await Provider.find({ 'address.city': { $regex: city, $options: 'i' } }).select('_id');
            payoutMatch.provider = { $in: providerIds.map(p => p._id) };
        }
        const pendingPayoutResult = await ProviderEarning.aggregate([
            {
                $match: payoutMatch
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$netAmount' }
                }
            }
        ]);
        const pendingPayoutAmount = pendingPayoutResult[0]?.total || 0;

        // Total refunded bookings
        const totalRefunded = await Booking.countDocuments({ ...bookingMatchConditions, paymentStatus: 'refunded' });

        // Total held payouts count
        const totalHeldPayouts = await ProviderEarning.countDocuments({ status: 'held' });

        // Duplicate payment attempts (if any failed transaction with same booking exists)
        const duplicateAttempts = await Transaction.countDocuments({ paymentStatus: 'failed', description: /duplicate/i });

        res.status(200).json({
            success: true,
            data: {
                totalBookings,
                todayBookings,
                ongoingBookings,
                cancelledBookings,
                totalCustomers,
                totalProviders,
                todayRevenue,
                monthlyRevenue,
                pendingPayoutAmount,
                totalDisputes,
                totalRefunded,
                totalHeldPayouts,
                duplicateAttempts
            }
        });

    } catch (error) {
        console.error('Get dashboard summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard summary'
        });
    }
};

/**
 * Get dashboard revenue data
 */
const getDashboardRevenue = async (req, res) => {
    try {
        const { period = '30d', city, serviceCategory } = req.query;
        let days, format;

        if (period === '7d') {
            days = 7;
            format = '%Y-%m-%d';
        } else if (period === '30d') {
            days = 30;
            format = '%Y-%m-%d';
        } else if (period === '90d') {
            days = 90;
            format = '%Y-%m-%d';
        } else {
            // Default to 30d
            days = 30;
            format = '%Y-%m-%d';
        }

        const startDate = moment().subtract(days, 'days').startOf('day');

        // Build match conditions
        let matchConditions = {
            status: 'completed',
            createdAt: { $gte: startDate.toDate() }
        };

        if (city) {
            matchConditions['address.city'] = { $regex: city, $options: 'i' };
        }

        if (serviceCategory) {
            // Find service IDs that match the category name
            const serviceIds = await Service.aggregate([
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'category',
                        foreignField: '_id',
                        as: 'cat'
                    }
                },
                {
                    $unwind: '$cat'
                },
                {
                    $match: {
                        'cat.name': { $regex: serviceCategory, $options: 'i' }
                    }
                },
                {
                    $project: {
                        _id: 1
                    }
                }
            ]);

            const ids = serviceIds.map(s => s._id);
            if (ids.length > 0) {
                matchConditions['services.service'] = { $in: ids };
            } else {
                // No services found for this category, return empty data
                return res.status(200).json({
                    success: true,
                    data: []
                });
            }
        }

        const revenueData = await Booking.aggregate([
            {
                $match: matchConditions
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: format,
                            date: '$createdAt'
                        }
                    },
                    revenue: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    revenue: 1,
                    count: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: revenueData
        });

    } catch (error) {
        console.error('Get dashboard revenue error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching revenue data'
        });
    }
};

/**
 * Get dashboard bookings status distribution
 */
const getDashboardBookingsStatus = async (req, res) => {
    try {
        const { city, serviceCategory } = req.query;

        // Build match conditions
        let matchConditions = {};
        if (city) {
            matchConditions['address.city'] = { $regex: city, $options: 'i' };
        }
        if (serviceCategory) {
            // Find service IDs that match the category name
            const serviceIds = await Service.aggregate([
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'category',
                        foreignField: '_id',
                        as: 'cat'
                    }
                },
                {
                    $unwind: '$cat'
                },
                {
                    $match: {
                        'cat.name': { $regex: serviceCategory, $options: 'i' }
                    }
                },
                {
                    $project: {
                        _id: 1
                    }
                }
            ]);
            const ids = serviceIds.map(s => s._id);
            if (ids.length > 0) {
                matchConditions['services.service'] = { $in: ids };
            } else {
                // No services found, return empty data
                return res.status(200).json({
                    success: true,
                    data: []
                });
            }
        }

        const statusData = await Booking.aggregate([
            {
                $match: matchConditions
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    status: '$_id',
                    count: 1
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        res.status(200).json({
            success: true,
            data: statusData
        });

    } catch (error) {
        console.error('Get dashboard bookings status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching bookings status'
        });
    }
};

/**
 * Get dashboard top providers
 */
const getDashboardTopProviders = async (req, res) => {
    try {
        const { city, serviceCategory } = req.query;

        // Build match conditions for bookings
        let bookingMatchConditions = {
            status: 'completed',
            provider: { $ne: null }
        };
        if (city) {
            bookingMatchConditions['address.city'] = { $regex: city, $options: 'i' };
        }
        if (serviceCategory) {
            // Find service IDs that match the category name
            const serviceIds = await Service.aggregate([
                {
                    $lookup: {
                        from: 'categories',
                        localField: 'category',
                        foreignField: '_id',
                        as: 'cat'
                    }
                },
                {
                    $unwind: '$cat'
                },
                {
                    $match: {
                        'cat.name': { $regex: serviceCategory, $options: 'i' }
                    }
                },
                {
                    $project: {
                        _id: 1
                    }
                }
            ]);
            const ids = serviceIds.map(s => s._id);
            if (ids.length > 0) {
                bookingMatchConditions['services.service'] = { $in: ids };
            } else {
                // No services found, return empty data
                return res.status(200).json({
                    success: true,
                    data: []
                });
            }
        }

        // Additional filter for providers by city if specified
        let providerFilter = {};
        if (city) {
            providerFilter['address.city'] = { $regex: city, $options: 'i' };
        }

        let pipeline = [
            {
                $match: bookingMatchConditions
            },
            {
                $group: {
                    _id: '$provider',
                    totalEarnings: { $sum: '$providerEarnings' },
                    totalBookings: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'providers',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'providerInfo'
                }
            },
            {
                $unwind: '$providerInfo'
            }
        ];

        if (city) {
            pipeline.push({
                $match: {
                    'providerInfo.address.city': { $regex: city, $options: 'i' }
                }
            });
        }

        pipeline.push(
            {
                $lookup: {
                    from: 'feedbacks',
                    localField: '_id',
                    foreignField: 'providerFeedback.provider',
                    as: 'feedbacks'
                }
            },
            {
                $addFields: {
                    averageRating: {
                        $cond: {
                            if: { $gt: [{ $size: '$feedbacks' }, 0] },
                            then: { $avg: '$feedbacks.providerFeedback.rating' },
                            else: 0
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    providerId: '$providerInfo.providerId',
                    providerName: '$providerInfo.name',
                    providerEmail: '$providerInfo.email',
                    totalEarnings: 1,
                    totalBookings: 1,
                    averageRating: { $round: ['$averageRating', 1] }
                }
            },
            {
                $sort: { totalEarnings: -1 }
            },
            {
                $limit: 10
            }
        );

        const topProviders = await Booking.aggregate(pipeline);

        res.status(200).json({
            success: true,
            data: topProviders
        });

    } catch (error) {
        console.error('Get dashboard top providers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching top providers'
        });
    }
};

/**
 * Get dashboard pending actions
 */
const getDashboardPendingActions = async (req, res) => {
    try {
        // Pending provider verifications
        const pendingVerifications = await Provider.countDocuments({
            approved: false,
            kycStatus: 'pending'
        });

        // Pending withdrawal requests (from PaymentRecord model)
        const pendingWithdrawals = await PaymentRecord.countDocuments({
            status: { $in: ['requested', 'processing'] }
        });

        // Pending disputes (complaints that are unresolved)
        const pendingDisputes = await Complaint.countDocuments({
            status: { $in: ['Open', 'In-Progress'] }
        });

        // Pending refunds (bookings with refund in progress)
        const pendingRefunds = await Booking.countDocuments({
            'cancellationProgress.status': 'processing_refund'
        });

        res.status(200).json({
            success: true,
            data: {
                pendingVerifications,
                pendingWithdrawals,
                pendingDisputes,
                pendingRefunds
            }
        });

    } catch (error) {
        console.error('Get dashboard pending actions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching pending actions'
        });
    }
};

/**
 * Get dashboard live stats
 */
const getDashboardLiveStats = async (req, res) => {
    try {
        // Ongoing bookings (in-progress or accepted)
        const ongoingBookings = await Booking.countDocuments({
            status: { $in: ['in-progress', 'accepted', 'scheduled'] }
        });

        // Active providers (approved and not blocked)
        const activeProviders = await Provider.countDocuments({
            approved: true,
            isActive: true,
            blockedTill: { $lte: new Date() }
        });

        // Delayed bookings (SLA based - bookings that should have been completed but aren't)
        const delayedBookings = await Booking.countDocuments({
            status: { $in: ['scheduled', 'accepted'] },
            date: { $lt: moment().subtract(1, 'hours').toDate() }
        });

        res.status(200).json({
            success: true,
            data: {
                ongoingBookings,
                activeProviders,
                delayedBookings
            }
        });

    } catch (error) {
        console.error('Get dashboard live stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching live stats'
        });
    }
};

/**
 * Get dashboard recent activity
 */
const getDashboardRecentActivity = async (req, res) => {
    try {
        const activities = [];

        // Recent bookings
        const recentBookings = await Booking.find()
            .populate('customer', 'name')
            .populate('provider', 'name')
            .sort({ createdAt: -1 })
            .limit(5)
            .select('status totalAmount createdAt customer provider')
            .lean();

        recentBookings.forEach(booking => {
            activities.push({
                type: 'booking',
                message: `New booking by ${booking.customer?.name || 'Customer'} ${booking.provider ? `assigned to ${booking.provider.name}` : ''}`,
                amount: booking.totalAmount,
                status: booking.status,
                timestamp: booking.createdAt
            });
        });

        // Recent payments
        const recentPayments = await Transaction.find()
            .populate('user', 'name')
            .sort({ createdAt: -1 })
            .limit(5)
            .select('paymentMethod paymentStatus amount createdAt user')
            .lean();

        recentPayments.forEach(payment => {
            const displayAmount = payment.amount;
            activities.push({
                type: 'payment',
                message: `${payment.paymentMethod} of ₹${displayAmount} by ${payment.user?.name || 'User'}`,
                amount: displayAmount,
                status: payment.paymentStatus,
                timestamp: payment.createdAt
            });
        });

        // Recent payouts
        const recentPayouts = await ProviderEarning.find()
            .populate('provider', 'name')
            .sort({ createdAt: -1 })
            .limit(5)
            .select('netAmount createdAt provider')
            .lean();

        recentPayouts.forEach(payout => {
            activities.push({
                type: 'payout',
                message: `Payout of ₹${payout.netAmount} to ${payout.provider?.name || 'Provider'}`,
                amount: payout.netAmount,
                timestamp: payout.createdAt
            });
        });

        // Sort all activities by timestamp and take top 20
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const recentActivities = activities.slice(0, 20);

        res.status(200).json({
            success: true,
            data: recentActivities
        });

    } catch (error) {
        console.error('Get dashboard recent activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching recent activity'
        });
    }
};

/**
 * Get consolidated dashboard analytics
 */
const getDashboardAnalytics = async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        const cacheKey = `dashboard_analytics_${period}`;



        let startDate;
        const now = new Date();

        switch (period) {
            case '1d':
                startDate = moment().startOf('day').toDate();
                break;
            case '24h':
                startDate = moment().subtract(24, 'hours').toDate();
                break;
            case '7d':
                startDate = moment().subtract(7, 'days').startOf('day').toDate();
                break;
            case '30d':
                startDate = moment().subtract(30, 'days').startOf('day').toDate();
                break;
            case '90d':
                startDate = moment().subtract(90, 'days').startOf('day').toDate();
                break;
            case '180d':
                startDate = moment().subtract(180, 'days').startOf('day').toDate();
                break;
            case '365d':
                startDate = moment().subtract(365, 'days').startOf('day').toDate();
                break;
            default:
                startDate = moment().subtract(7, 'days').startOf('day').toDate();
        }

        const matchStage = {
            createdAt: { $gte: startDate }
        };

        // Optimized Aggregations with lean() and Promise.all
        const [bookingStatsAgg, topProvidersAgg, customerStatsAgg, pendingCounts, activityData] = await Promise.all([
            // 1. Booking & Revenue Analytics (Consolidated Facet)
            Booking.aggregate([
                { $match: matchStage },
                {
                    $facet: {
                        statusDistribution: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                        revenueOverview: [
                            { $match: { status: 'completed' } },
                            {
                                $group: {
                                    _id: null,
                                    totalRevenue: { $sum: "$totalAmount" },
                                    totalCommission: { $sum: "$commissionAmount" },
                                    totalPayout: { $sum: "$providerEarnings" },
                                    completedCount: { $sum: 1 }
                                }
                            }
                        ],
                        chartData: [
                            { $match: { status: 'completed' } },
                            {
                                $group: {
                                    _id: {
                                        $cond: {
                                            if: { $in: [period, ['90d', '180d', '365d']] },
                                            then: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                                            else: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
                                        }
                                    },
                                    revenue: { $sum: "$totalAmount" }
                                }
                            },
                            { $sort: { _id: 1 } }
                        ],
                        cancellationReasons: [
                            { $match: { status: 'cancelled' } },
                            {
                                $group: {
                                    _id: { $ifNull: ["$cancellationProgress.reason", "Unknown"] },
                                    count: { $sum: 1 }
                                }
                            },
                            { $project: { reason: "$_id", count: 1, _id: 0 } }
                        ]
                    }
                }
            ]),

            // 2. Top Performing Providers
            Booking.aggregate([
                { $match: { ...matchStage, status: 'completed' } },
                {
                    $group: {
                        _id: "$provider",
                        jobs: { $sum: 1 },
                        earnings: { $sum: "$providerEarnings" }
                    }
                },
                { $sort: { jobs: -1, earnings: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: 'providers',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'providerInfo'
                    }
                },
                { $unwind: "$providerInfo" },
                {
                    $project: {
                        name: "$providerInfo.name",
                        jobs: 1,
                        earnings: 1,
                        id: "$providerInfo.providerId",
                        profilePic: "$providerInfo.profilePicUrl"
                    }
                }
            ]),

            // 3. Customer Stats
            User.aggregate([
                {
                    $facet: {
                        new: [
                            { $match: { role: 'customer', createdAt: { $gte: startDate } } },
                            { $count: "count" }
                        ],
                        total: [
                            { $match: { role: 'customer' } },
                            { $count: "count" }
                        ]
                    }
                }
            ]),

            // 4. Pending Counts
            Promise.all([
                Provider.countDocuments({ approved: false, kycStatus: 'pending' }),
                PaymentRecord.countDocuments({ status: { $in: ['requested', 'processing'] } }),
                Complaint.countDocuments({ status: { $in: ['Open', 'In-Progress'] } })
            ]),

            // 5. Recent Activity
            Promise.all([
                Booking.find().sort({ createdAt: -1 }).limit(10).populate('customer', 'name').populate('provider', 'name').select('customer provider createdAt totalAmount status').lean(),
                Booking.find({ status: 'completed' }).sort({ serviceCompletedAt: -1 }).limit(5).populate('customer', 'name').populate('provider', 'name').select('customer provider serviceCompletedAt createdAt totalAmount').lean(),
                User.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(5).select('name createdAt').lean()
            ])
        ]);

        const stats = bookingStatsAgg[0];
        const [pendingProviders, pendingWithdrawals, pendingDisputes] = pendingCounts;
        const [recentBookings, recentlyCompleted, latestUsers] = activityData;

        // Process Live Activity into flat list
        const liveActivity = [
            ...recentBookings.map(b => ({
                type: 'booking',
                message: `New booking by ${b.customer?.name || 'Customer'}`,
                timestamp: b.createdAt,
                amount: b.totalAmount,
                status: b.status
            })),
            ...recentlyCompleted.map(b => ({
                type: 'completion',
                message: `Job completed by ${b.provider?.name || 'Provider'}`,
                timestamp: b.serviceCompletedAt || b.createdAt,
                amount: b.totalAmount,
                status: 'completed'
            })),
            ...latestUsers.map(u => ({
                type: 'registration',
                message: `New user: ${u.name}`,
                timestamp: u.createdAt,
                status: 'new_user'
            }))
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 15);

        const totalBookings = stats.statusDistribution.reduce((acc, curr) => acc + curr.count, 0);
        const cancelledCount = stats.statusDistribution.find(s => s._id === 'cancelled')?.count || 0;

        const result = {
            bookingStats: {
                total: totalBookings,
                completed: stats.revenueOverview[0]?.completedCount || 0,
                cancelled: cancelledCount,
                inProgress: stats.statusDistribution.find(s => s._id === 'in-progress')?.count || 0,
                pending: stats.statusDistribution.find(s => s._id === 'pending')?.count || 0,
            },
            revenueStats: {
                totalRevenue: stats.revenueOverview[0]?.totalRevenue || 0,
                growth: 0, // Placeholder
                platformCommission: stats.revenueOverview[0]?.totalCommission || 0,
                providerPayout: stats.revenueOverview[0]?.totalPayout || 0,
                chartData: stats.chartData
            },
            customerStats: {
                new: customerStatsAgg[0].new[0]?.count || 0,
                total: customerStatsAgg[0].total[0]?.count || 0
            },
            cancelledStats: {
                rate: totalBookings > 0 ? ((cancelledCount / totalBookings) * 100).toFixed(1) : 0,
                reasons: stats.cancellationReasons
            },
            topProviders: topProvidersAgg,
            liveActivity,
            pendingActions: {
                pendingVerifications: pendingProviders,
                pendingWithdrawals: pendingWithdrawals,
                pendingDisputes: pendingDisputes
            }
        };



        res.status(200).json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('Get dashboard analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard analytics'
        });
    }
};


// Admin - Refund Management

// 1. Process Refund (Full or Partial)
const processAdminRefund = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { bookingId } = req.params;
        const { amount, reason, type } = req.body; // type: 'full' or 'partial'

        const booking = await Booking.findById(bookingId).populate('complaint').session(session);
        if (!booking) {
            throw new Error('Booking not found');
        }

        // --- STRICT BLOCK FOR COD REFUNDS ---
        if (booking.paymentMethod === 'cod') {
            throw new Error('Cash on Delivery (COD) bookings are strictly ineligible for wallet refunds to prevent refund fraud.');
        }

        // --- DOUBLE-REFUND PROTECTION SCAN ---
        const existingRefundTx = await Transaction.findOne({
            booking: booking._id,
            type: 'refund',
            paymentStatus: 'completed'
        }).session(session);

        if (existingRefundTx) {
            throw new Error('Double-refund protection: A completed refund transaction already exists for this booking.');
        }

        // --- CRITICAL CHECKS ---
        if (booking.paymentStatus === 'refunded') {
            throw new Error('Booking already fully refunded');
        }

        if (booking.adminRefundDecision === 'approved') {
            throw new Error('Refund already approved for this booking');
        }

        if (booking.complaint && booking.complaint.status === 'Closed') {
            throw new Error('Complaint is already closed');
        }

        // --- NEW STRICT EARNING STATUS CHECKS ---
        let earning = await ProviderEarning.findOne({ booking: booking._id }).session(session);
        if (earning) {
            const allowedStatuses = ['held', 'under_review', 'pending_release', 'available', 'paid', 'withdrawn', 'cancelled'];
            if (!allowedStatuses.includes(earning.status)) {
                throw new Error(`Refund is not allowed for current earning status: ${earning.status}`);
            }
        }

        const previouslyRefunded = booking.cancellationProgress?.refundAmount || 0;
        const remainingRefundable = booking.totalAmount - previouslyRefunded;

        const refundAmount = type === 'full' ? remainingRefundable : amount;

        if (!refundAmount || refundAmount <= 0) {
            throw new Error('Invalid refund amount or no remaining amount to refund.');
        }

        if (refundAmount > remainingRefundable) {
            throw new Error(`Refund amount exceeds remaining refundable amount (₹${remainingRefundable})`);
        }

        // Lock transaction to prevent double refund
        const transaction = await Transaction.findOneAndUpdate(
            { booking: booking._id, paymentStatus: { $in: ['completed', 'paid', 'success'] }, refundStatus: { $ne: 'completed' } },
            { refundStatus: 'processing' },
            { session, new: true }
        );

        if (!transaction) {
            console.warn(`[Refund Engine] Duplicate or invalid refund attempt for transaction of booking ${booking._id}`);
            throw new Error('Transaction already refunded or not found.');
        }

        // Update User wallet
        const user = await User.findById(booking.customer).session(session);
        if (!user.wallet) {
            user.wallet = { availableBalance: 0, totalRefunded: 0, lastUpdated: new Date() };
        }

        // Create Transaction record for audit
        const refundTransaction = new Transaction({
            booking: booking._id,
            bookingId: booking.bookingId || booking._id,
            user: booking.customer,
            amount: refundAmount,
            paymentStatus: 'completed',
            paymentMethod: 'wallet',
            type: 'refund',
            description: `Admin approved ${type} refund for booking #${booking.bookingId || booking._id}. Reason: ${reason || 'Not specified'}`,
            refundReason: reason || `Admin approved ${type} refund`
        });
        await refundTransaction.save({ session });

        // Update Wallet
        user.wallet.availableBalance += refundAmount;
        user.wallet.totalRefunded += refundAmount;
        user.wallet.walletTransactions.push({
            type: 'credit',
            amount: refundAmount,
            reason: 'Booking Refund',
            booking: booking._id
        });
        user.wallet.lastUpdated = new Date();
        await user.save({ session });

        // --- SYNCHRONIZED UPDATES ---
        const newTotalRefunded = previouslyRefunded + refundAmount;
        const isFullyRefunded = newTotalRefunded >= booking.totalAmount || type === 'full';

        // 1. Update Booking
        booking.paymentStatus = isFullyRefunded ? 'refunded' : booking.paymentStatus;
        booking.disputeStatus = isFullyRefunded ? 'refund_approved' : 'under_review'; // Sync with new enum
        booking.adminRefundDecision = isFullyRefunded ? 'approved' : 'partial';
        booking.cancellationProgress.status = 'refund_completed';
        booking.cancellationProgress.refundAmount = newTotalRefunded;
        booking.cancellationProgress.refundCompletedAt = new Date();
        booking.adminRemark = reason || `Admin approved ${type} refund`;

        // 2. Update Status History
        booking.statusHistory.push({
            status: booking.status,
            note: `Refund Approved: ₹${refundAmount} (${type} refund). Reason: ${reason || 'Not specified'}`,
            updatedBy: 'admin',
            timestamp: new Date()
        });

        if (isFullyRefunded) {
            booking.statusHistory.push({
                status: booking.status,
                note: `Refund Lock: Booking fully refunded and synchronized.`,
                updatedBy: 'system',
                timestamp: new Date()
            });
        }

        // 3. Auto-Close Linked Complaint
        if (booking.complaint) {
            const Complaint = mongoose.model('Complaint');
            await Complaint.findByIdAndUpdate(booking.complaint._id, {
                status: 'Closed',
                resolutionNotes: `Refund processed successfully. Amount: ₹${refundAmount}. Note: ${reason || 'Admin Approved'}`,
                resolvedAt: new Date(),
                $push: {
                    statusHistory: [
                        { status: 'Solved', updatedAt: new Date() },
                        { status: 'Closed', updatedAt: new Date() }
                    ]
                }
            }, { session });
        }

        await booking.save({ session });

        // 4. Finalize Transaction
        transaction.refundStatus = isFullyRefunded ? 'completed' : 'partial';
        transaction.refundReason = reason || `Admin ${type} refund`;
        transaction.refundedAt = new Date();
        if (isFullyRefunded) transaction.paymentStatus = 'refunded';
        transaction.refundedAmount = newTotalRefunded;
        await transaction.save({ session });

        // 5. Proper Financial Recovery (Synchronized)
        earning = await ProviderEarning.findOne({ booking: booking._id }).session(session);
        let recoveryStatus = 'not_required';
        let recoveredAmount = 0;
        let totalToRecover = 0;

        if (earning) {
            totalToRecover = earning.netAmount;

            if (['held', 'available', 'under_review', 'pending_release'].includes(earning.status)) {
                // CASE 1: Earning not yet paid out
                earning.status = 'cancelled';
                recoveryStatus = 'cancelled_held';
                recoveredAmount = earning.netAmount;
                await earning.save({ session });
            } else if (['paid', 'withdrawn'].includes(earning.status)) {
                // CASE 2: Payout already transferred
                const provider = await Provider.findById(booking.provider).session(session);
                if (provider && provider.wallet) {
                    // Proper deduction from provider wallet
                    const available = provider.wallet.availableBalance || 0;
                    // Deduct up to available balance (avoid negative as requested)
                    const canDeduct = Math.min(available, totalToRecover);

                    if (canDeduct > 0) {
                        provider.wallet.availableBalance -= canDeduct;
                        provider.wallet.lastUpdated = new Date();
                        await provider.save({ session });

                        recoveredAmount = canDeduct;
                        recoveryStatus = recoveredAmount >= totalToRecover ? 'fully_recovered' : 'partially_recovered';
                    } else {
                        recoveryStatus = 'pending_recovery';
                    }

                    // Mark earning as cancelled and record recovery details
                    earning.status = 'cancelled';
                    await earning.save({ session });
                }
            }
        }

        // Save financial recovery logs in booking
        booking.adminRemark = (booking.adminRemark || '') +
            ` | Recovery: ${recoveryStatus} (₹${recoveredAmount}/₹${totalToRecover} recovered from provider)`;

        await booking.save({ session });

        await session.commitTransaction();
        session.endSession();

        // --- NOTIFICATIONS ---
        // Notify Customer
        try {
            sendNotification(
                booking.customer,
                'customer',
                'Refund Credited 💰',
                `A refund of ₹${refundAmount} has been credited to your wallet for booking #${booking.bookingId || booking._id}.`,
                'refund_processed',
                booking._id
            );
        } catch (err) { }

        // Notify Provider
        if (booking.provider) {
            try {
                const message = recoveryStatus === 'cancelled_held'
                    ? `A refund of ₹${refundAmount} was approved. Your held earning of ₹${totalToRecover} has been cancelled.`
                    : `A refund was approved. ₹${recoveredAmount} has been adjusted from your wallet balance.`;

                sendNotification(
                    booking.provider,
                    'provider',
                    'Refund Deduction Notice 📉',
                    message,
                    'refund_deducted',
                    booking._id
                );
            } catch (err) { }
        }

        // Notify Admin (System Audit/Log)
        try {
            sendNotification(
                null, // System or all admins
                'admin',
                'Refund Completed Successfully ✅',
                `Refund for booking #${booking.bookingId || booking._id} was successfully processed by Admin.`,
                'admin_refund_success',
                booking._id
            );
        } catch (err) { }

        // Invalidate dashboard caches



        res.json({
            success: true,
            message: `Refund of ₹${refundAmount} processed successfully. Booking and Complaint synchronized.`,
            data: { refundAmount, bookingId: booking._id }
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error('Process refund error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};

// 2. Reject Refund Request
const rejectAdminRefund = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        booking.disputeStatus = 'refund_rejected';
        booking.adminRefundDecision = 'rejected';
        booking.adminRemark = reason || 'Admin rejected refund request';

        // Add to status history
        booking.statusHistory.push({
            status: 'rejected',
            note: `Admin rejected refund request. Reason: ${reason || 'Not specified'}`,
            updatedBy: 'admin',
            timestamp: new Date()
        });

        // Notify customer
        try {
            sendNotification(
                booking.customer,
                'customer',
                'Refund Rejected',
                `Your refund request for booking ${booking.bookingId || booking._id} was rejected. Reason: ${booking.adminRemark}`,
                'refund_rejected',
                booking._id
            );
        } catch (err) { }

        // Notify provider
        if (booking.provider) {
            try {
                sendNotification(
                    booking.provider,
                    'provider',
                    'Dispute Rejected ✅',
                    `The dispute for booking #${booking.bookingId || booking._id} has been rejected. Your payout status will be updated soon.`,
                    'dispute_rejected',
                    booking._id
                );
            } catch (err) { }
        }

        res.json({
            success: true,
            message: 'Refund request rejected.',
            data: { bookingId: booking._id }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};




// 4. Toggle Payout Hold
const togglePayoutHold = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status, reason } = req.body; // 'held' or 'available'

        const ProviderEarning = mongoose.model('ProviderEarning');
        const earning = await ProviderEarning.findOneAndUpdate(
            { booking: bookingId },
            {
                status: status,
                isHeldByAdmin: status === 'held',
                holdReason: status === 'held' ? (reason || 'Held by administrator') : null
            },
            { new: true }
        );

        if (!earning) {
            return res.status(404).json({ success: false, message: 'Earning record not found' });
        }

        res.json({
            success: true,
            message: `Payout status updated to ${status}`,
            data: earning
        });
    } catch (error) {
        console.error('Toggle payout hold error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


module.exports = {
    registerAdmin,
    getAdminProfile,
    updateAdminProfile,
    deleteAdmin,
    getAllAdmins,
    getAllCustomers,
    getCustomerById,
    approveProvider,
    getPendingProviders,
    getAllProviders,
    getProviderDetails,
    getDashboardStats,
    getDashboardSummary,
    getDashboardRevenue,
    getDashboardBookingsStatus,
    getDashboardTopProviders,
    getDashboardPendingActions,
    getDashboardLiveStats,
    getDashboardRecentActivity,
    getDashboardAnalytics,
    processAdminRefund,
    rejectAdminRefund,
    togglePayoutHold,
    getSameIPFraud,
    getDeviceAbuse,
    getCancellationAlerts,
    markFraudLogSafe,
    addFraudLogNote,
    suspendUserAccount,
};

/**
 * 1️⃣ SAME IP DETECTION
 */
async function getSameIPFraud(req, res) {
    try {
        const FraudLog = require('../models/FraudLog-model');
        const { page = 1, limit = 20, risk, date } = req.query;
        const skip = (page - 1) * limit;

        let match = { ip: { $exists: true, $ne: '0.0.0.0' } };
        if (risk) match.riskLevel = risk;
        if (date) {
            const now = new Date();
            if (date === '24h') match.createdAt = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
            if (date === '7d') match.createdAt = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
            if (date === '30d') match.createdAt = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
        }

        const pipeline = [
            { $match: match },
            {
                $group: {
                    _id: "$ip",
                    logsCount: { $sum: 1 },
                    maxFraudScore: { $max: "$fraudScore" },
                    riskLevel: { $first: "$riskLevel" },
                    userIds: { $addToSet: "$userId" },
                    failedLogins: { $sum: { $cond: [{ $eq: ["$actionType", "failed_login"] }, 1, 0] } },
                    registrations: { $sum: { $cond: [{ $eq: ["$actionType", "registration"] }, 1, 0] } },
                    logins: { $sum: { $cond: [{ $eq: ["$actionType", "login"] }, 1, 0] } },
                    lastActive: { $max: "$createdAt" },
                    isFlagged: { $first: "$isFlagged" },
                    isSafe: { $first: "$isSafe" },
                    recentLogs: {
                        $push: {
                            _id: "$_id",
                            actionType: "$actionType",
                            flagReason: "$flagReason",
                            fraudScore: "$fraudScore",
                            riskLevel: "$riskLevel",
                            createdAt: "$createdAt",
                            bookingId: "$bookingId"
                        }
                    }
                }
            },
            // Filter out IPs with only 1 log and low activity
            { $match: { $or: [{ "userIds.1": { $exists: true } }, { logsCount: { $gt: 2 } }] } },
            { $sort: { maxFraudScore: -1, lastActive: -1 } },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: Number(skip) }, { $limit: Number(limit) }]
                }
            }
        ];

        const result = await FraudLog.aggregate(pipeline);
        const total = result[0]?.metadata[0]?.total || 0;
        let items = result[0]?.data || [];

        // Manually populate users and providers & calculate real-time dynamic scores
        for (let item of items) {
            const validUserIds = item.userIds.filter(Boolean);
            const [users, providers] = await Promise.all([
                User.find({ _id: { $in: validUserIds } }).select('name email phone role metadata.device isSuspended'),
                Provider.find({ _id: { $in: validUserIds } }).select('name email phone role metadata.device isSuspended')
            ]);
            item.users = [...users, ...providers];

            // DYNAMIC RISK ENGINE FOR IP GROUPS
            if (item.isSafe) {
                item.maxFraudScore = 0;
                item.riskLevel = 'LOW';
            } else {
                let dynamicScore = 0;
                const uniqueAccounts = item.users.length;
                const hasCustomer = item.users.some(u => u.role === 'customer');
                const hasProvider = item.users.some(u => u.role === 'provider');
                
                // Account links
                if (uniqueAccounts > 1) {
                    dynamicScore += uniqueAccounts * 15; // 15 points per linked account
                }
                // Role overlap (customer + provider)
                if (hasCustomer && hasProvider) {
                    dynamicScore += 35;
                }
                // Failed logins
                dynamicScore += (item.failedLogins || 0) * 10;
                // Registration spam
                if ((item.registrations || 0) > 2) {
                    dynamicScore += (item.registrations || 0) * 15;
                }
                
                item.maxFraudScore = Math.min(Math.round(dynamicScore), 100);
                if (item.maxFraudScore >= 75) {
                    item.riskLevel = 'CRITICAL';
                } else if (item.maxFraudScore >= 50) {
                    item.riskLevel = 'HIGH';
                } else if (item.maxFraudScore >= 25) {
                    item.riskLevel = 'MEDIUM';
                } else {
                    item.riskLevel = 'LOW';
                }
            }
        }

        res.status(200).json({
            success: true,
            data: items,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Same IP Detection Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

/**
 * 2️⃣ SAME DEVICE DETECTION
 */
async function getDeviceAbuse(req, res) {
    try {
        const FraudLog = require('../models/FraudLog-model');
        const { page = 1, limit = 20, risk, date } = req.query;
        const skip = (page - 1) * limit;

        let match = { device: { $exists: true, $ne: 'N/A' } };
        if (risk) match.riskLevel = risk;
        if (date) {
            const now = new Date();
            if (date === '24h') match.createdAt = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
            if (date === '7d') match.createdAt = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
            if (date === '30d') match.createdAt = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
        }

        const pipeline = [
            { $match: match },
            {
                $group: {
                    _id: "$device",
                    deviceDetails: { $first: "$deviceDetails" },
                    logsCount: { $sum: 1 },
                    maxFraudScore: { $max: "$fraudScore" },
                    riskLevel: { $first: "$riskLevel" },
                    userIds: { $addToSet: "$userId" },
                    otpRequests: { $sum: { $cond: [{ $eq: ["$actionType", "otp_request"] }, 1, 0] } },
                    cancellations: { $sum: { $cond: [{ $eq: ["$actionType", "cancellation"] }, 1, 0] } },
                    lastActive: { $max: "$createdAt" },
                    isFlagged: { $first: "$isFlagged" },
                    isSafe: { $first: "$isSafe" },
                    recentLogs: {
                        $push: {
                            _id: "$_id",
                            actionType: "$actionType",
                            flagReason: "$flagReason",
                            fraudScore: "$fraudScore",
                            riskLevel: "$riskLevel",
                            createdAt: "$createdAt",
                            bookingId: "$bookingId"
                        }
                    }
                }
            },
            // Filter suspicious device: multiple accounts, otp request spam, or cancellation abuse
            { $match: { $or: [{ "userIds.1": { $exists: true } }, { logsCount: { $gt: 2 } }] } },
            { $sort: { maxFraudScore: -1, lastActive: -1 } },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: Number(skip) }, { $limit: Number(limit) }]
                }
            }
        ];

        const result = await FraudLog.aggregate(pipeline);
        const total = result[0]?.metadata[0]?.total || 0;
        let items = result[0]?.data || [];

        // Manually populate users and providers & calculate real-time dynamic scores
        for (let item of items) {
            const validUserIds = item.userIds.filter(Boolean);
            const [users, providers] = await Promise.all([
                User.find({ _id: { $in: validUserIds } }).select('name email phone role metadata.ip isSuspended'),
                Provider.find({ _id: { $in: validUserIds } }).select('name email phone role metadata.ip isSuspended')
            ]);
            item.users = [...users, ...providers];

            // DYNAMIC RISK ENGINE FOR DEVICE GROUPS
            if (item.isSafe) {
                item.maxFraudScore = 0;
                item.riskLevel = 'LOW';
            } else {
                let dynamicScore = 0;
                const uniqueAccounts = item.users.length;
                const otpSpam = item.otpRequests || 0;
                const cancellations = item.cancellations || 0;
                
                // Account links
                if (uniqueAccounts > 1) {
                    dynamicScore += uniqueAccounts * 20; // 20 points per linked account on same device
                }
                // OTP requests
                if (otpSpam > 3) {
                    dynamicScore += otpSpam * 8;
                }
                // Cancellations
                if (cancellations > 0) {
                    dynamicScore += cancellations * 25;
                }
                
                item.maxFraudScore = Math.min(Math.round(dynamicScore), 100);
                if (item.maxFraudScore >= 75) {
                    item.riskLevel = 'CRITICAL';
                } else if (item.maxFraudScore >= 50) {
                    item.riskLevel = 'HIGH';
                } else if (item.maxFraudScore >= 25) {
                    item.riskLevel = 'MEDIUM';
                } else {
                    item.riskLevel = 'LOW';
                }
            }
        }

        res.status(200).json({
            success: true,
            data: items,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Device Abuse Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

/**
 * 3️⃣ HIGH CANCELLATION ALERT
 */
async function getCancellationAlerts(req, res) {
    try {
        const FraudLog = require('../models/FraudLog-model');
        const { page = 1, limit = 20, risk, date } = req.query;
        const skip = (page - 1) * limit;

        let match = { actionType: 'cancellation' };
        if (risk) match.riskLevel = risk;
        if (date) {
            const now = new Date();
            if (date === '24h') match.createdAt = { $gte: new Date(now - 24 * 60 * 60 * 1000) };
            if (date === '7d') match.createdAt = { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) };
            if (date === '30d') match.createdAt = { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) };
        }

        const pipeline = [
            { $match: match },
            { $sort: { createdAt: -1 } },
            {
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [{ $skip: Number(skip) }, { $limit: Number(limit) }]
                }
            }
        ];

        const result = await FraudLog.aggregate(pipeline);
        const total = result[0]?.metadata[0]?.total || 0;
        let items = result[0]?.data || [];

        // Manually populate customer, provider, and booking details
        for (let item of items) {
            if (item.userId) {
                const model = item.userModel === 'Provider' ? Provider : User;
                item.user = await model.findById(item.userId).select('name email phone role isSuspended');
            }
            if (item.bookingId) {
                item.booking = await Booking.findById(item.bookingId)
                    .select('bookingId services status totalAmount createdAt')
                    .populate('provider', 'name email phone');
            }
        }

        res.status(200).json({
            success: true,
            data: items,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Cancellation Alert Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

/**
 * 4️⃣ MANUAL FRAUD RISK OVERRIDE
 */
async function markFraudLogSafe(req, res) {
    try {
        const FraudLog = require('../models/FraudLog-model');
        const { id } = req.params;
        const { isSafe } = req.body;

        const log = await FraudLog.findById(id);
        if (!log) {
            return res.status(404).json({ success: false, message: 'Fraud log not found' });
        }

        log.isSafe = isSafe;
        log.status = isSafe ? 'safe' : 'pending_review';
        if (isSafe) {
            log.riskLevel = 'LOW';
            log.fraudScore = 0;
        }
        await log.save();

        // Propagate override status to all other matching IP/Device logs for systemic consistency
        if (log.ip && log.ip !== '0.0.0.0') {
            await FraudLog.updateMany(
                { ip: log.ip },
                { isSafe, status: log.status, riskLevel: log.riskLevel, fraudScore: log.fraudScore }
            );
        }
        if (log.device && log.device !== 'N/A') {
            await FraudLog.updateMany(
                { device: log.device },
                { isSafe, status: log.status, riskLevel: log.riskLevel, fraudScore: log.fraudScore }
            );
        }

        res.status(200).json({
            success: true,
            message: `Identified threat successfully marked as ${isSafe ? 'safe' : 'under investigation'}.`,
            data: log
        });
    } catch (error) {
        console.error('markFraudLogSafe Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

/**
 * 5️⃣ ADD INVESTIGATION NOTES
 */
async function addFraudLogNote(req, res) {
    try {
        const FraudLog = require('../models/FraudLog-model');
        const { id } = req.params;
        const { note } = req.body;

        const log = await FraudLog.findById(id);
        if (!log) {
            return res.status(404).json({ success: false, message: 'Fraud log not found' });
        }

        log.notes.push({
            note,
            admin: req.admin?._id || null, // from adminAuthMiddleware
            createdAt: new Date()
        });
        log.status = 'investigated';
        await log.save();

        res.status(200).json({
            success: true,
            message: 'Investigation note added successfully',
            data: log
        });
    } catch (error) {
        console.error('addFraudLogNote Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

/**
 * 6️⃣ TEMPORARY/PERMANENT SUSPENSION
 */
async function suspendUserAccount(req, res) {
    try {
        const FraudLog = require('../models/FraudLog-model');
        const { userId } = req.params;
        const { suspend, reason } = req.body;

        let user = await User.findById(userId);
        let role = 'customer';

        if (!user) {
            user = await Provider.findById(userId);
            role = 'provider';
        }

        if (!user) {
            return res.status(404).json({ success: false, message: 'User or Provider not found' });
        }

        user.isSuspended = suspend;
        user.suspensionReason = suspend ? reason : undefined;
        await user.save();

        // Update status of all logs associated with this user
        await FraudLog.updateMany(
            { userId },
            { status: suspend ? 'suspended' : 'investigated' }
        );

        res.status(200).json({
            success: true,
            message: `Account has been successfully ${suspend ? 'suspended' : 'reactivated'}.`,
            data: { userId, isSuspended: suspend, role }
        });
    } catch (err) {
      console.error('Error suspending user account:', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }

// ─────────────────────────────────────────────────────────────────────────────
// Security Monitoring: Active Sessions & Device Analytics
// GET /api/admin/security/sessions
// ─────────────────────────────────────────────────────────────────────────────
const getActiveSessions = async (req, res) => {
  try {
    const { role = 'customer', page = 1, limit = 20 } = req.query;
    const Model = role === 'provider' ? require('../models/Provider-model') : require('../models/User-model');
    
    const users = await Model.find({ 'refreshTokens.isValid': true })
      .select('name email phone role refreshTokens deviceIds loginHistory lastLoginIp suspiciousScore')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Model.countDocuments({ 'refreshTokens.isValid': true });

    // Format the response for the admin panel
    const sessions = users.map(user => {
      const activeTokens = user.refreshTokens?.filter(t => t.isValid && new Date(t.expiresAt) > new Date()) || [];
      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role || role,
        suspiciousScore: user.suspiciousScore || 0,
        lastLoginIp: user.lastLoginIp,
        activeSessions: activeTokens.length,
        devices: user.deviceIds || [],
        tokens: activeTokens.map(t => ({
          deviceId: t.deviceId,
          ipHash: t.ipHash,
          userAgent: t.userAgent,
          createdAt: t.createdAt,
          expiresAt: t.expiresAt
        })),
        recentLogins: (user.loginHistory || []).slice(-5)
      };
    }).filter(u => u.activeSessions > 0);

    res.status(200).json({
      success: true,
      data: sessions,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching active sessions:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Security Monitoring: Force Logout
// POST /api/admin/security/force-logout
// Body: { userId, role, deviceId (optional, if omitted logs out from all) }
// ─────────────────────────────────────────────────────────────────────────────
const forceLogoutUser = async (req, res) => {
  try {
    const { userId, role, deviceId } = req.body;
    if (!userId || !role) {
      return res.status(400).json({ success: false, message: 'User ID and role are required' });
    }

    const Model = role === 'provider' ? require('../models/Provider-model') : require('../models/User-model');
    const user = await Model.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let revokedCount = 0;
    if (user.refreshTokens && user.refreshTokens.length > 0) {
      user.refreshTokens.forEach(t => {
        if (t.isValid && (!deviceId || t.deviceId === deviceId)) {
          t.isValid = false;
          revokedCount++;
        }
      });
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: `Successfully revoked ${revokedCount} session(s) for user ${user.name}`
    });
  } catch (err) {
    console.error('Error forcing logout:', err);
    res.status(500).json({ success: false, message: 'Failed to force logout' });
  }
};

// System Logs API
const getSystemLogs = async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, '../logs/combined.log');
        if (!fs.existsSync(logPath)) return res.json({ success: true, logs: [], total: 0 });

        const { level, page = 1, limit = 50 } = req.query;
        const logs = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map(line => {
            const trimmedLine = line.trim();
            const match = trimmedLine.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(.+?)\]: (.*)$/);
            if (match) return { timestamp: match[1], level: match[2], message: match[3] };
            return { message: trimmedLine };
        }).reverse();

        let filteredLogs = logs;
        if (level && level !== 'ALL') {
            filteredLogs = logs.filter(l => l.level === level.toUpperCase());
        }

        const startIndex = (page - 1) * limit;
        const paginatedLogs = filteredLogs.slice(startIndex, startIndex + Number(limit));

        res.json({ success: true, logs: paginatedLogs, total: filteredLogs.length, page: Number(page), pages: Math.ceil(filteredLogs.length / limit) });
    } catch (error) {
        console.error('Log API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to read logs' });
    }
};

module.exports.getSystemLogs = getSystemLogs;
module.exports.getActiveSessions = getActiveSessions;
module.exports.forceLogoutUser = forceLogoutUser;
