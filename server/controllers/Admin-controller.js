const mongoose = require('mongoose');
const Admin = require('../models/Admin-model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Provider = require('../models/Provider-model');
const User = require('../models/User-model');
const sendEmail = require('../utils/sendEmail');
const Booking = require('../models/Booking-model');
const Service = require('../models/Service-model');
const Complaint = require('../models/Complaint-model');
const Transaction = require('../models/Transaction-model');
const Coupon = require('../models/Coupon-model');
const ProviderEarning = require('../models/ProviderEarning-model');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../services/cloudinary');
const ExcelJS = require('exceljs');

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
        const providerId = req.params.id;
        const { status, remarks } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "approved" or "rejected"'
            });
        }

        const provider = await Provider.findById(providerId);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        if (status === 'approved') {
            provider.approved = true;
            provider.kycStatus = 'approved';
            provider.rejectionReason = '';
            provider.isActive = true;
            if (provider.bankDetails) {
                provider.bankDetails.verified = true;
            }

            await provider.save();

            // Send approval email
            try {
                const emailTemplate = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2563eb;">Account Approved</h2>
                        <p>Dear ${provider.name},</p>
                        <p>Congratulations! Your provider account has been approved.</p>
                        ${remarks ? `<p><strong>Admin Remarks:</strong> ${remarks}</p>` : ''}
                        <p>You can now login and start accepting service requests.</p>
                    </div>
                `;

                await sendEmail({
                    to: provider.email,
                    subject: 'Your Provider Account Has Been Approved',
                    html: emailTemplate
                });
            } catch (emailError) {
                console.error('Failed to send approval email:', emailError);
            }

            return res.status(200).json({
                success: true,
                message: 'Provider approved successfully',
                provider: provider.toJSON()
            });
        }

        if (status === 'rejected') {
            provider.approved = false;
            provider.kycStatus = 'rejected';
            provider.rejectionReason = remarks || 'No reason provided';
            provider.isActive = false;

            await provider.save();

            // Send rejection email
            try {
                const emailTemplate = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #dc2626;">Account Rejected</h2>
                        <p>Dear ${provider.name},</p>
                        <p>We regret to inform you that your provider account has been rejected.</p>
                        <p><strong>Reason:</strong> ${provider.rejectionReason}</p>
                    </div>
                `;

                await sendEmail({
                    to: provider.email,
                    subject: 'Your Provider Account Has Been Rejected',
                    html: emailTemplate
                });
            } catch (emailError) {
                console.error('Failed to send rejection email:', emailError);
            }

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

        const query = {
            approved: false,
            isDeleted: false,
            ...(search && {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            })
        };

        const providers = await Provider.find(query)
            .select('-password -__v')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const total = await Provider.countDocuments(query);

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
                    { email: { $regex: search, $options: 'i' } }
                ]
            })
        };

        const providersPipeline = [
            { $match: filter },
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
                    averageRating: { $ifNull: [{ $avg: '$feedback.providerFeedback.rating' }, 0] }
                }
            },
            {
                $project: {
                    password: 0,
                    __v: 0,
                    feedback: 0 // Exclude the feedback array from the final output
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ];

        const providers = await Provider.aggregate(providersPipeline);
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
 * Get provider details
 */
const getProviderDetails = async (req, res) => {
    try {
        const providerId = req.params.id;
        const provider = await Provider.findById(providerId).select('-password -__v');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

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

const getCustomerById = async (req, res) => {
    try {
        const customerId = req.params.id;
        const customer = await User.findById(customerId).select('-password');

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
        const today = moment().startOf('day');
        const currentWeek = moment().startOf('week');
        const currentMonth = moment().startOf('month');

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
            User.countDocuments(),
            Provider.countDocuments({ approved: true }),
            Booking.countDocuments(),
            Service.countDocuments({ isActive: true }),
            Booking.countDocuments({ createdAt: { $gte: today.toDate() } }),
            Booking.countDocuments({ createdAt: { $gte: currentWeek.toDate() } }),
            Booking.countDocuments({ createdAt: { $gte: currentMonth.toDate() } }),
            Provider.countDocuments({ approved: false })
        ]);

        // Calculate revenue from completed bookings
        const revenueStats = await Booking.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
        ]);

        const totalRevenue = revenueStats[0]?.totalRevenue || 0;

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
                totalRevenue
            }
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
            .sort({ createdAt: -1 });

        const total = await Admin.countDocuments(filter);

        res.status(200).json({
            success: true,
            count: admins.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            admins: admins.map(admin => admin.toJSON())
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
 * Get all transactions with filtering
 */
const getAllTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const filter = req.query.filter || 'lifetime';
        const search = req.query.search || '';

        // Calculate date ranges based on filter
        let dateFilter = {};
        const now = moment();

        switch (filter) {
            case '1month':
                dateFilter = { createdAt: { $gte: now.subtract(1, 'months').toDate() } };
                break;
            case '3months':
                dateFilter = { createdAt: { $gte: now.subtract(3, 'months').toDate() } };
                break;
            case '6months':
                dateFilter = { createdAt: { $gte: now.subtract(6, 'months').toDate() } };
                break;
            case 'current_fy':
                // Current FY: April 1st to March 31st
                const currentYear = now.year();
                const fyStart = moment(`${currentYear}-04-01`, 'YYYY-MM-DD');
                const fyEnd = moment(`${currentYear + 1}-03-31`, 'YYYY-MM-DD');
                if (now.isBefore(fyStart)) {
                    // If current date is before April, use previous FY
                    fyStart.subtract(1, 'year');
                    fyEnd.subtract(1, 'year');
                }
                dateFilter = { createdAt: { $gte: fyStart.toDate(), $lte: fyEnd.toDate() } };
                break;
            case 'previous_fy':
                // Previous FY: April 1st to March 31st of previous year
                const prevYear = now.year() - 1;
                const prevFyStart = moment(`${prevYear}-04-01`, 'YYYY-MM-DD');
                const prevFyEnd = moment(`${prevYear + 1}-03-31`, 'YYYY-MM-DD');
                dateFilter = { createdAt: { $gte: prevFyStart.toDate(), $lte: prevFyEnd.toDate() } };
                break;
            case 'lifetime':
            default:
                // No date filter for lifetime
                break;
        }

        const pipeline = [
            { $match: dateFilter },
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'booking',
                    foreignField: '_id',
                    as: 'booking'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $lookup: {
                    from: 'services',
                    localField: 'booking.services.service',
                    foreignField: '_id',
                    as: 'services'
                }
            },
            {
                $addFields: {
                    booking: { $arrayElemAt: ['$booking', 0] },
                    user: { $arrayElemAt: ['$user', 0] },
                    service: { $arrayElemAt: ['$services', 0] }
                }
            },
            {
                $project: {
                    razorpayResponse: 0,
                    razorpaySignature: 0,
                    __v: 0,
                    'user.password': 0,
                    'user.__v': 0
                }
            }
        ];

        // Add search filter if provided
        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { transactionId: { $regex: search, $options: 'i' } },
                        { 'user.name': { $regex: search, $options: 'i' } },
                        { 'user.email': { $regex: search, $options: 'i' } },
                        { 'booking._id': { $regex: search, $options: 'i' } },
                        { 'service.title': { $regex: search, $options: 'i' } }
                    ]
                }
            });
        }

        // Create count pipeline (without sort, skip, limit)
        const countPipeline = [...pipeline, { $count: "total" }];
        const countResult = await Transaction.aggregate(countPipeline);
        const total = countResult[0]?.total || 0;

        // Add pagination to main pipeline
        pipeline.push(
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        );

        const transactions = await Transaction.aggregate(pipeline);

        res.status(200).json({
            success: true,
            count: transactions.length,
            total,
            page,
            pages: Math.ceil(total / limit),
            filter,
            search,
            transactions
        });

    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching transactions'
        });
    }
};

/**
 * Get transaction by ID with populated details
 */
const getTransactionById = async (req, res) => {
    try {
        const transactionId = req.params.id;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(transactionId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid transaction ID'
            });
        }

        const pipeline = [
            { $match: { _id: new mongoose.Types.ObjectId(transactionId) } },
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'booking',
                    foreignField: '_id',
                    as: 'booking'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $lookup: {
                    from: 'services',
                    localField: 'booking.services.service',
                    foreignField: '_id',
                    as: 'services'
                }
            },
            {
                $addFields: {
                    booking: { $arrayElemAt: ['$booking', 0] },
                    user: { $arrayElemAt: ['$user', 0] },
                    service: { $arrayElemAt: ['$services', 0] }
                }
            },
            {
                $project: {
                    razorpayResponse: 0,
                    razorpaySignature: 0,
                    __v: 0,
                    'user.password': 0,
                    'user.__v': 0
                }
            }
        ];

        const transaction = await Transaction.aggregate(pipeline);

        if (!transaction || transaction.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        res.status(200).json({
            success: true,
            transaction: transaction[0]
        });

    } catch (error) {
        console.error('Get transaction by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching transaction details'
        });
    }
};

/**
 * Export transactions to CSV
 */
const exportTransactionsCSV = async (req, res) => {
    try {
        const filter = req.query.filter || 'lifetime';
        const search = req.query.search || '';

        // Calculate date ranges based on filter (same logic as getAllTransactions)
        let dateFilter = {};
        const now = moment();

        switch (filter) {
            case '1month':
                dateFilter = { createdAt: { $gte: now.subtract(1, 'months').toDate() } };
                break;
            case '3months':
                dateFilter = { createdAt: { $gte: now.subtract(3, 'months').toDate() } };
                break;
            case '6months':
                dateFilter = { createdAt: { $gte: now.subtract(6, 'months').toDate() } };
                break;
            case 'current_fy':
                const currentYear = now.year();
                const fyStart = moment(`${currentYear}-04-01`, 'YYYY-MM-DD');
                const fyEnd = moment(`${currentYear + 1}-03-31`, 'YYYY-MM-DD');
                if (now.isBefore(fyStart)) {
                    fyStart.subtract(1, 'year');
                    fyEnd.subtract(1, 'year');
                }
                dateFilter = { createdAt: { $gte: fyStart.toDate(), $lte: fyEnd.toDate() } };
                break;
            case 'previous_fy':
                const prevYear = now.year() - 1;
                const prevFyStart = moment(`${prevYear}-04-01`, 'YYYY-MM-DD');
                const prevFyEnd = moment(`${prevYear + 1}-03-31`, 'YYYY-MM-DD');
                dateFilter = { createdAt: { $gte: prevFyStart.toDate(), $lte: prevFyEnd.toDate() } };
                break;
            case 'lifetime':
            default:
                break;
        }

        const pipeline = [
            { $match: dateFilter },
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'booking',
                    foreignField: '_id',
                    as: 'booking'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $lookup: {
                    from: 'services',
                    localField: 'booking.services.service',
                    foreignField: '_id',
                    as: 'services'
                }
            },
            {
                $addFields: {
                    booking: { $arrayElemAt: ['$booking', 0] },
                    user: { $arrayElemAt: ['$user', 0] },
                    service: { $arrayElemAt: ['$services', 0] }
                }
            },
            {
                $project: {
                    razorpayResponse: 0,
                    razorpaySignature: 0,
                    __v: 0,
                    'user.password': 0,
                    'user.__v': 0
                }
            }
        ];

        // Add search filter if provided
        if (search) {
            pipeline.push({
                $match: {
                    $or: [
                        { transactionId: { $regex: search, $options: 'i' } },
                        { 'user.name': { $regex: search, $options: 'i' } },
                        { 'user.email': { $regex: search, $options: 'i' } },
                        { 'booking._id': { $regex: search, $options: 'i' } },
                        { 'service.title': { $regex: search, $options: 'i' } }
                    ]
                }
            });
        }

        pipeline.push({ $sort: { createdAt: -1 } });

        const transactions = await Transaction.aggregate(pipeline);

        // Prepare CSV data
        const csvData = transactions.map(transaction => ({
            'Transaction ID': transaction.transactionId,
            'Amount': transaction.paymentMethod === 'online' ? transaction.amount / 100 : transaction.amount,
            'Currency': transaction.currency,
            'Payment Status': transaction.paymentStatus,
            'Payment Method': transaction.paymentMethod,
            'Customer Name': transaction.user?.name || 'N/A',
            'Customer Email': transaction.user?.email || 'N/A',
            'Customer Phone': transaction.user?.phone || 'N/A',
            'Service Name': transaction.service?.title || 'N/A',
            'Booking ID': transaction.booking?._id || 'N/A',
            'Booking Status': transaction.booking?.status || 'N/A',
            'Razorpay Order ID': transaction.razorpayOrderId || 'N/A',
            'Razorpay Payment ID': transaction.razorpayPaymentId || 'N/A',
            'Transaction Date': moment(transaction.createdAt).format('YYYY-MM-DD HH:mm:ss'),
            'Updated Date': moment(transaction.updatedAt).format('YYYY-MM-DD HH:mm:ss')
        }));

        // Convert to CSV string
        const csvHeaders = Object.keys(csvData[0] || {}).join(',') + '\n';
        const csvRows = csvData.map(row =>
            Object.values(row).map(value =>
                typeof value === 'string' && value.includes(',') ? `"${value}"` : value
            ).join(',')
        ).join('\n');
        const csvContent = csvHeaders + csvRows;

        // Set response headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=transactions_${filter}_${moment().format('YYYY-MM-DD')}.csv`);
        res.status(200).send(csvContent);

    } catch (error) {
        console.error('Export transactions CSV error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while exporting transactions'
        });
    }
};

module.exports = {
    registerAdmin,
    getAdminProfile,
    updateAdminProfile,
    deleteAdmin,
    getAllAdmins,
    getAllCustomers,
    getCustomerById, // Add this line
    approveProvider,
    getPendingProviders,
    getAllProviders,
    getProviderDetails,
    getDashboardStats,
    getAllTransactions,
    getTransactionById,
    exportTransactionsCSV
};
