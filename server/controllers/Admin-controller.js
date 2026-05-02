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
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../services/cloudinary');
const mongoose = require('mongoose');
const { sendNotification } = require('../utils/notificationHelper');
const generateProviderId = require('../utils/generateUniqueId');
const { sendMail } = require('../utils/sendmail');

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

            return res.status(200).json({
                success: true,
                message: 'Provider approved successfully',
                provider: provider.toJSON()
            });
        }

        if (status === 'rejected') {
            provider.approved = false;
            provider.kycStatus = 'rejected';
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

        // Get payment method statistics
        const paymentMethodStats = await Transaction.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            },
            {
                $project: {
                    paymentMethod: '$_id',
                    count: 1,
                    totalAmount: 1,
                    _id: 0
                }
            }
        ]);

        // Get withdrawal statistics
        const withdrawalStats = await Transaction.aggregate([
            { $match: { type: 'withdrawal', status: 'completed' } },
            {
                $group: {
                    _id: null,
                    totalWithdrawals: { $sum: '$amount' },
                    withdrawalCount: { $sum: 1 }
                }
            }
        ]);

        const totalWithdrawals = withdrawalStats[0]?.totalWithdrawals || 0;
        const withdrawalCount = withdrawalStats[0]?.withdrawalCount || 0;

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
                withdrawalCount
            },
            paymentMethods: paymentMethodStats
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
                pendingPayoutAmount
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

        // 1. Booking & Revenue Analytics
        const bookingStatsAgg = await Booking.aggregate([
            { $match: matchStage },
            {
                $facet: {
                    statusDistribution: [
                        { $group: { _id: "$status", count: { $sum: 1 } } }
                    ],
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
        ]);

        const stats = bookingStatsAgg[0];

        // 2. Top Performing Providers
        const topProvidersAgg = await Booking.aggregate([
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
        ]);

        // 3. Customer Stats
        const customerStatsAgg = await User.aggregate([
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
        ]);

        // 4. Pending Actions & Live Activity
        const [pendingProviders, pendingWithdrawals, pendingDisputes] = await Promise.all([
            Provider.countDocuments({ approved: false, kycStatus: 'pending' }),
            PaymentRecord.countDocuments({ status: { $in: ['requested', 'processing'] } }),
            Complaint.countDocuments({ status: { $in: ['Open', 'In-Progress'] } })
        ]);

        const [recentBookings, recentlyCompleted, latestUsers] = await Promise.all([
            Booking.find().sort({ createdAt: -1 }).limit(10).populate('customer', 'name').populate('provider', 'name').lean(),
            Booking.find({ status: 'completed' }).sort({ serviceCompletedAt: -1 }).limit(5).populate('customer', 'name').populate('provider', 'name').lean(),
            User.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(5).lean()
        ]);

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
    getDashboardAnalytics
};

