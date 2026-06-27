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

const { getPrecomputedAnalytics, refreshAnalytics } = require('../services/AnalyticsService');

const deleteFile = async (publicId) => {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Successfully deleted file from Cloudinary: ${publicId}`);
    } catch (err) {
        console.error(`Failed to delete file from Cloudinary: ${publicId}`, err.message);
    }
};

/**
 * Register a new admin
 */
const registerAdmin = async (req, res) => {
    try {
        const { name, email, password, signupSecret } = req.body || {};

        // Validate secret
        if (!process.env.ADMIN_REGISTRATION_SECRET) {
            return res.status(500).json({
                success: false,
                message: 'Admin registration secret is not configured on the server.'
            });
        }

        if (signupSecret !== process.env.ADMIN_REGISTRATION_SECRET) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden. Invalid admin registration secret.'
            });
        }

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
        const { SystemConfig } = require('../models/SystemSetting');
        const settings = await SystemConfig.findOne();
        const sessionTimeoutHours = settings?.securitySettings?.sessionTimeoutHours || 24;
        const token = admin.generateJWT(sessionTimeoutHours);

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

        const [customers, total] = await Promise.all([
            User.aggregate(pipeline),
            User.countDocuments({ role: 'customer', ...searchFilter })
        ]);

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

const emitProviderStatusChange = (provider, status) => {
    try {
        const { getIO } = require('../socket/socketServer');
        const io = getIO();
        if (io) {
            const payload = { providerId: provider._id.toString(), status: provider.approved ? 'approved' : status, provider };
            io.to(provider._id.toString()).emit('provider-status-changed', payload);
            io.to('admin_live_room').emit('provider-status-changed', payload);
        }
    } catch (e) {
        console.error("Failed to emit provider status change event:", e);
    }
};

/**
 * Approve or reject provider account
 */
const approveProvider = async (req, res) => {
    try {
        const queryId = req.params.id;
        const { status, remarks, rejectionReason, durationDays } = req.body;
        const finalRemarks = remarks || rejectionReason || '';

        if (!['approved', 'rejected', 'active', 'restricted', 'suspended', 'blocked', 'pending_review', 'bank_approved', 'bank_rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be one of: approved, rejected, active, restricted, suspended, blocked, pending_review, bank_approved, bank_rejected'
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

        if (status === 'bank_approved') {
            // Delete old passbook image if it's replaced
            const backupStr = provider.rejectionReason;
            if (backupStr && backupStr.startsWith('{') && backupStr.endsWith('}')) {
                try {
                    const parsed = JSON.parse(backupStr);
                    if (parsed.passbookImagePublicId &&
                        parsed.passbookImagePublicId !== provider.bankDetails.passbookImagePublicId) {
                        await deleteFile(parsed.passbookImagePublicId);
                    }
                } catch (err) {
                    console.error("Failed to delete old passbook image on bank approval:", err);
                }
            }

            provider.bankDetails.verified = true;
            provider.rejectionReason = ''; // Clear backup/rejection details
            await provider.save();

            // Send notification
            try {
                sendNotification(
                    provider._id,
                    'provider',
                    'Bank Details Approved 💳',
                    `Your bank details have been verified and approved. ${finalRemarks ? '\nRemarks: ' + finalRemarks : ''}`,
                    'approved',
                    provider._id
                );
            } catch (fcmError) {
                console.error('Failed to send bank approval notification:', fcmError);
            }

            // Send email
            try {
                await sendMail({
                    to: provider.email,
                    templateType: 'providerApproval',
                    variables: {
                        name: provider.name,
                        providerName: provider.providerId,
                        reason: finalRemarks || 'Your updated bank details have been verified and approved.',
                        email: `${process.env.FRONTEND_URL}/login`
                    }
                });
            } catch (mailError) {
                console.error('Failed to send bank approval email:', mailError);
            }

            emitProviderStatusChange(provider, status);
            return res.status(200).json({
                success: true,
                message: 'Bank details approved successfully',
                provider: provider.toJSON()
            });
        }

        if (status === 'bank_rejected') {
            const oldReason = provider.rejectionReason;
            let parsedBankDetails = null;
            if (oldReason && oldReason.startsWith('{') && oldReason.endsWith('}')) {
                try {
                    parsedBankDetails = JSON.parse(oldReason);
                } catch (e) {
                    console.error("Failed to parse backed up bank details:", e);
                }
            }

            if (parsedBankDetails) {
                // Delete the new (rejected) passbook image if it's different from the old one
                if (provider.bankDetails?.passbookImagePublicId &&
                    provider.bankDetails.passbookImagePublicId !== parsedBankDetails.passbookImagePublicId) {
                    try {
                        await deleteFile(provider.bankDetails.passbookImagePublicId);
                    } catch (deleteError) {
                        console.error("Failed to delete rejected passbook image:", deleteError);
                    }
                }
                provider.bankDetails = {
                    ...parsedBankDetails,
                    verified: true
                };
            }

            // Clear backup
            provider.rejectionReason = ''; // Clear it since the provider is still approved and active
            await provider.save();

            // Send notification
            try {
                sendNotification(
                    provider._id,
                    'provider',
                    'Bank Details Update Rejected ❌',
                    `Your bank details update request has been rejected. Reason: ${finalRemarks || 'No reason provided'}`,
                    'rejected',
                    provider._id
                );
            } catch (fcmError) {
                console.error('Failed to send bank rejection notification:', fcmError);
            }

            // Send email
            try {
                await sendMail({
                    to: provider.email,
                    templateType: 'providerRejection',
                    variables: {
                        name: provider.name,
                        reason: finalRemarks || 'The requested bank account update was rejected by the administrator.'
                    }
                });
            } catch (mailError) {
                console.error('Failed to send bank rejection email:', mailError);
            }

            emitProviderStatusChange(provider, status);
            return res.status(200).json({
                success: true,
                message: 'Bank details update rejected successfully',
                provider: provider.toJSON()
            });
        }

        const oldStatus = provider.approved ? 'approved' : 'pending';

        // 1. Apply manual admin state changes
        if (status === 'approved' || status === 'active') {
            provider.approved = true;
            provider.kycStatus = 'approved';
            provider.isActive = true;
            provider.isSuspended = false;
            provider.suspensionReason = '';
            provider.blockedTill = null;
            if (provider.performanceScore) {
                provider.performanceScore.restrictionsActive = false;
                provider.performanceScore.restrictedUntil = null;
                provider.performanceScore.restrictionReason = '';
            }
            if (provider.bankDetails) {
                provider.bankDetails.verified = true;
            }
            if (!provider.providerId) {
                provider.providerId = generateProviderId();
            }

            if (global.logger) global.logger.info(`Provider manual activation/approval by Admin: ${provider._id}`);

            await provider.save();

            // Send notification
            try {
                sendNotification(
                    provider._id,
                    'provider',
                    'Account Approved & Active 🎓',
                    `Congratulations! Your provider account is now fully active. ${finalRemarks ? '\nRemarks: ' + finalRemarks : ''}`,
                    'approved',
                    provider._id
                );
                const { triggerEventNotification } = require('../utils/notificationHelper');
                await triggerEventNotification('provider_verification_approved', {
                    remarks: finalRemarks || '',
                    provider
                }, provider._id);
            } catch (fcmError) {
                console.error('Failed to send activation notification:', fcmError);
            }

            try {
                await sendMail({
                    to: provider.email,
                    templateType: 'providerApproval',
                    variables: {
                        name: provider.name,
                        providerName: provider.providerId,
                        reason: finalRemarks,
                        email: `${process.env.FRONTEND_URL}/login`
                    }
                });
            } catch (mailError) { }

            emitProviderStatusChange(provider, status);
            return res.status(200).json({
                success: true,
                message: 'Provider manual activation/approval successful',
                provider: provider.toJSON()
            });
        }

        if (status === 'rejected') {
            provider.approved = false;
            provider.kycStatus = 'rejected';
            provider.isActive = false;
            provider.rejectionReason = finalRemarks || 'No reason provided';

            if (global.logger) global.logger.warn(`Provider manually rejected by Admin: ${provider._id}`);

            await provider.save();

            try {
                sendNotification(
                    provider._id,
                    'provider',
                    'Account Rejected ❌',
                    `Your provider account has been rejected. Reason: ${provider.rejectionReason}`,
                    'rejected',
                    provider._id
                );
                const { triggerEventNotification } = require('../utils/notificationHelper');
                await triggerEventNotification('provider_verification_rejected', {
                    reason: provider.rejectionReason,
                    provider
                }, provider._id);
            } catch (fcmError) { }

            try {
                await sendMail({
                    to: provider.email,
                    templateType: 'providerRejection',
                    variables: {
                        name: provider.name,
                        reason: provider.rejectionReason
                    }
                });
            } catch (mailError) { }

            emitProviderStatusChange(provider, status);
            return res.status(200).json({
                success: true,
                message: 'Provider rejected successfully',
                provider: provider.toJSON()
            });
        }

        if (status === 'restricted') {
            if (!provider.performanceScore) {
                provider.performanceScore = {};
            }
            provider.performanceScore.restrictionsActive = true;
            provider.performanceScore.restrictionReason = finalRemarks || 'Manual restriction by administrator';
            provider.performanceScore.restrictedUntil = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : null;

            if (global.logger) global.logger.warn(`Provider manually restricted by Admin: ${provider._id}. Duration: ${durationDays || 'Indefinite'} days.`);

            await provider.save();

            try {
                sendNotification(
                    provider._id,
                    'provider',
                    'Account Restricted ⚠️',
                    `Your provider account has been restricted. Reason: ${provider.performanceScore.restrictionReason}`,
                    'restriction',
                    provider._id
                );
            } catch (fcmError) { }

            emitProviderStatusChange(provider, status);
            return res.status(200).json({
                success: true,
                message: 'Provider restricted successfully',
                provider: provider.toJSON()
            });
        }

        if (status === 'suspended') {
            provider.isSuspended = true;
            provider.suspensionReason = finalRemarks || 'Manual suspension by administrator';

            if (global.logger) global.logger.warn(`Provider manually suspended by Admin: ${provider._id}`);

            await provider.save();

            try {
                sendNotification(
                    provider._id,
                    'provider',
                    'Account Suspended 🚫',
                    `Your account has been suspended. Reason: ${provider.suspensionReason}`,
                    'suspension',
                    provider._id
                );
            } catch (fcmError) { }

            emitProviderStatusChange(provider, status);
            return res.status(200).json({
                success: true,
                message: 'Provider suspended successfully',
                provider: provider.toJSON()
            });
        }

        if (status === 'blocked') {
            provider.blockedTill = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
            provider.isActive = false;

            if (global.logger) global.logger.warn(`Provider manually blocked by Admin: ${provider._id}. Duration: ${durationDays || 'Permanent'}`);

            await provider.save();

            try {
                sendNotification(
                    provider._id,
                    'provider',
                    'Account Blocked ❌',
                    `Your account has been blocked by the administrator.`,
                    'blocked',
                    provider._id
                );
            } catch (fcmError) { }

            emitProviderStatusChange(provider, status);
            return res.status(200).json({
                success: true,
                message: 'Provider blocked successfully',
                provider: provider.toJSON()
            });
        }

        if (status === 'pending_review') {
            provider.approved = false;
            provider.kycStatus = 'pending';
            provider.isActive = false;

            if (global.logger) global.logger.info(`Provider placed in pending review by Admin: ${provider._id}`);

            await provider.save();

            emitProviderStatusChange(provider, status);
            return res.status(200).json({
                success: true,
                message: 'Provider placed in pending review successfully',
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
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const { startDate, endDate, tab } = req.query;

        let matchCriteria;
        if (tab === 'pending') {
            matchCriteria = { approved: false };
        } else if (tab === 'bank_pending') {
            matchCriteria = { approved: true, 'bankDetails.verified': false, 'bankDetails.accountNo': { $exists: true, $ne: '' } };
        } else {
            matchCriteria = {
                $or: [
                    { approved: false },
                    { approved: true, 'bankDetails.verified': false, 'bankDetails.accountNo': { $exists: true, $ne: '' } }
                ]
            };
        }

        const filter = {
            isDeleted: false,
            ...matchCriteria
        };

        if (search) {
            filter.$and = [
                {
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } },
                        { phone: { $regex: search, $options: 'i' } },
                        { providerId: { $regex: search, $options: 'i' } }
                    ]
                }
            ];
        }

        if (startDate || endDate) {
            const dateFilter = {};
            if (startDate) dateFilter.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateFilter.$lte = end;
            }
            filter.createdAt = dateFilter;
        }

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

        const [providers, total] = await Promise.all([
            Provider.aggregate(providersPipeline),
            Provider.countDocuments(filter)
        ]);

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

            provider.performanceBadge = provider.performanceScore?.badge || 'Bronze';
            provider.completionRate = provider.performanceScore?.completionPercentage || 0;
            provider.onTimeRate = provider.performanceScore?.onTimePercentage || 0;
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

        const [providers, total] = await Promise.all([
            Provider.aggregate(providersPipeline),
            Provider.countDocuments(filter)
        ]);

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

            provider.performanceBadge = provider.performanceScore?.badge || 'Bronze';
            provider.completionRate = provider.performanceScore?.completionPercentage || 0;
            provider.onTimeRate = provider.performanceScore?.onTimePercentage || 0;
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

        provider.performanceBadge = provider.performanceScore?.badge || 'Bronze';
        provider.completionRate = provider.performanceScore?.completionPercentage || 0;
        provider.onTimeRate = provider.performanceScore?.onTimePercentage || 0;

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
                        totalAdminEarnings: precomputed.totalAdminEarnings || 0,
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
            User.countDocuments(),
            Provider.countDocuments({ approved: true, isDeleted: false }),
            Booking.countDocuments(),
            Service.countDocuments({ isActive: true }),
            Booking.countDocuments({ createdAt: { $gte: today } }),
            Booking.countDocuments({ createdAt: { $gte: currentWeek } }),
            Booking.countDocuments({ createdAt: { $gte: currentMonth } }),
            Provider.countDocuments({ approved: false, isDeleted: false })
        ]);

        const [
            revenueStats,
            paymentMethodStats,
            withdrawalStats,
            disputeStats,
            heldPayoutsStats,
            totalDisputes,
            totalRefundsCount,
            walletRefundStats,
            refundedBookingsCount,
            pendingDisputesCount,
            resolvedDisputesCount,
            refundedDisputesCount
        ] = await Promise.all([
            Booking.aggregate([
                { $match: { status: 'completed' } },
                {
                    $group: {
                        _id: null,
                        grossRevenue: { $sum: "$totalAmount" },
                        totalRevenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$cancellationProgress.refundAmount", 0] }] } },
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
            Transaction.aggregate([
                { $match: { paymentStatus: 'completed' } },
                { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
                { $project: { paymentMethod: '$_id', count: 1, totalAmount: 1, _id: 0 } }
            ]),
            Transaction.aggregate([
                { $match: { type: 'withdrawal', paymentStatus: 'completed' } },
                { $group: { _id: null, totalWithdrawals: { $sum: '$amount' }, withdrawalCount: { $sum: 1 } } }
            ]),
            Booking.aggregate([
                { $match: { disputeRaised: true } },
                { $group: { _id: '$disputeStatus', count: { $sum: 1 } } }
            ]),
            ProviderEarning.aggregate([
                { $match: { status: 'held' } },
                { $group: { _id: null, totalHeld: { $sum: '$netAmount' }, count: { $sum: 1 } } }
            ]),
            Booking.countDocuments({ disputeRaised: true }),
            Booking.countDocuments({ adminRefundDecision: { $in: ['approved', 'partial'] } }),
            Transaction.aggregate([
                { $match: { type: 'refund', paymentMethod: 'wallet', paymentStatus: 'completed' } },
                { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
            ]),
            Booking.countDocuments({ $or: [{ paymentStatus: 'refunded' }, { refundProcessed: true }] }),
            Booking.countDocuments({ disputeStatus: 'under_review' }),
            Booking.countDocuments({ disputeStatus: 'resolved' }),
            Booking.countDocuments({ disputeStatus: 'refund_approved' })
        ]);

        const rStats = revenueStats[0] || {};
        const totalRevenue = rStats.totalRevenue || 0;
        const grossRevenue = rStats.grossRevenue || 0;
        const netRevenue = rStats.netRevenue || 0;
        const netEarnings = rStats.netEarnings || 0;
        const platformFeeRevenue = rStats.platformFeeRevenue || 0;
        const providerEarningsSum = rStats.providerEarnings || 0;
        const refundAmountSum = rStats.refundAmount || 0;
        const visitingRevenue = rStats.visitingRevenue || 0;
        const rainRevenue = rStats.rainRevenue || 0;
        const trafficRevenue = rStats.trafficRevenue || 0;
        const nightRevenue = rStats.nightRevenue || 0;
        const demandRevenue = rStats.demandRevenue || 0;
        const customRevenue = rStats.customRevenue || 0;
        const providerSurgeShare = rStats.providerSurgeShare || 0;
        const companySurgeShare = rStats.companySurgeShare || 0;

        const surgeRevenue = visitingRevenue + rainRevenue + trafficRevenue + nightRevenue + demandRevenue + customRevenue + platformFeeRevenue;

        const totalWithdrawals = withdrawalStats[0]?.totalWithdrawals || 0;
        const withdrawalCount = withdrawalStats[0]?.withdrawalCount || 0;

        const walletRefundAmount = walletRefundStats[0]?.totalAmount || 0;

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
                grossRevenue,
                totalRevenue,
                netRevenue,
                netEarnings,
                platformFeeRevenue,
                providerEarnings: providerEarningsSum,
                refundAmount: refundAmountSum,
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
                    providerSurgeShare,
                    companySurgeShare
                },
                totalRefunds: totalRefundsCount,
                walletRefundAmount,
                refundedBookingsCount,
                pendingDisputes: pendingDisputesCount,
                resolvedDisputes: resolvedDisputesCount,
                refundedDisputes: refundedDisputesCount,
                totalWithdrawals,
                withdrawalCount,
                totalDisputes,
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
            // Find category IDs that match the category name
            const Category = mongoose.model('Category');
            const categories = await Category.find({
                name: { $regex: serviceCategory, $options: 'i' }
            }).select('_id').lean();

            const categoryIds = categories.map(c => c._id);

            // Find service IDs that match the category IDs
            const services = await Service.find({
                category: { $in: categoryIds }
            }).select('_id').lean();

            const ids = services.map(s => s._id);
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

        // Combined Booking stats query
        const bookingStatsResult = await Booking.aggregate([
            { $match: bookingMatchConditions },
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    todayBookings: {
                        $sum: {
                            $cond: [{ $gte: ["$createdAt", today.toDate()] }, 1, 0]
                        }
                    },
                    ongoingBookings: {
                        $sum: {
                            $cond: [{ $in: ["$status", ["in-progress", "accepted", "scheduled"]] }, 1, 0]
                        }
                    },
                    cancelledBookings: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0]
                        }
                    },
                    totalRefunded: {
                        $sum: {
                            $cond: [{ $eq: ["$paymentStatus", "refunded"] }, 1, 0]
                        }
                    },
                    totalDisputes: {
                        $sum: {
                            $cond: [{ $eq: ["$disputeRaised", true] }, 1, 0]
                        }
                    }
                }
            }
        ]).lean();

        const bookingStats = bookingStatsResult[0] || {
            totalBookings: 0,
            todayBookings: 0,
            ongoingBookings: 0,
            cancelledBookings: 0,
            totalRefunded: 0,
            totalDisputes: 0
        };

        const {
            totalBookings,
            todayBookings,
            ongoingBookings,
            cancelledBookings,
            totalRefunded,
            totalDisputes
        } = bookingStats;

        // Total customers - filter by city if provided
        let customerMatch = { role: 'customer' };
        if (city) {
            customerMatch['address.city'] = { $regex: city, $options: 'i' };
        }

        // Total providers - filter by city if provided
        let providerMatch = { approved: true };
        if (city) {
            providerMatch['address.city'] = { $regex: city, $options: 'i' };
        }

        // Pending payout amount (from provider earnings) & held payouts count - filter by city if provided
        let providerIds = [];
        if (city) {
            const providersWithCity = await Provider.find({ 'address.city': { $regex: city, $options: 'i' } }).select('_id').lean();
            providerIds = providersWithCity.map(p => p._id);
        }

        let payoutMatch = {
            status: { $in: ['pending', 'processing', 'held'] }
        };
        if (city) {
            payoutMatch.provider = { $in: providerIds };
        }

        const [
            totalCustomers,
            totalProviders,
            revenueStats,
            payoutStatsResult,
            duplicateAttempts
        ] = await Promise.all([
            User.countDocuments(customerMatch),
            Provider.countDocuments(providerMatch),
            Booking.aggregate([
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
                        monthlyRevenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$cancellationProgress.refundAmount", 0] }] } },
                        todayRevenue: {
                            $sum: {
                                $cond: [{ $gte: ["$createdAt", today.toDate()] }, { $subtract: ["$totalAmount", { $ifNull: ["$cancellationProgress.refundAmount", 0] }] }, 0]
                            }
                        }
                    }
                }
            ]).lean(),
            ProviderEarning.aggregate([
                { $match: payoutMatch },
                {
                    $group: {
                        _id: null,
                        pendingPayoutAmount: {
                            $sum: {
                                $cond: [{ $in: ["$status", ["pending", "processing"]] }, '$netAmount', 0]
                            }
                        },
                        totalHeldPayouts: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "held"] }, 1, 0]
                            }
                        }
                    }
                }
            ]).lean(),
            Transaction.countDocuments({ paymentStatus: 'failed', description: /duplicate/i })
        ]);

        const todayRevenue = revenueStats[0]?.todayRevenue || 0;
        const monthlyRevenue = revenueStats[0]?.monthlyRevenue || 0;
        const pendingPayoutAmount = payoutStatsResult[0]?.pendingPayoutAmount || 0;
        const totalHeldPayouts = payoutStatsResult[0]?.totalHeldPayouts || 0;

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
            // Find category IDs that match the category name
            const Category = mongoose.model('Category');
            const categories = await Category.find({
                name: { $regex: serviceCategory, $options: 'i' }
            }).select('_id').lean();

            const categoryIds = categories.map(c => c._id);

            // Find service IDs that match the category IDs
            const services = await Service.find({
                category: { $in: categoryIds }
            }).select('_id').lean();

            const ids = services.map(s => s._id);
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
            // Find category IDs that match the category name
            const Category = mongoose.model('Category');
            const categories = await Category.find({
                name: { $regex: serviceCategory, $options: 'i' }
            }).select('_id').lean();

            const categoryIds = categories.map(c => c._id);

            // Find service IDs that match the category IDs
            const services = await Service.find({
                category: { $in: categoryIds }
            }).select('_id').lean();

            const ids = services.map(s => s._id);
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
            // Find category IDs that match the category name
            const Category = mongoose.model('Category');
            const categories = await Category.find({
                name: { $regex: serviceCategory, $options: 'i' }
            }).select('_id').lean();

            const categoryIds = categories.map(c => c._id);

            // Find service IDs that match the category IDs
            const services = await Service.find({
                category: { $in: categoryIds }
            }).select('_id').lean();

            const ids = services.map(s => s._id);
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
        const [
            pendingVerifications,
            pendingWithdrawals,
            pendingDisputes,
            pendingRefunds
        ] = await Promise.all([
            Provider.countDocuments({ approved: false, kycStatus: 'pending' }),
            PaymentRecord.countDocuments({ status: { $in: ['requested', 'processing'] } }),
            Complaint.countDocuments({ status: { $in: ['Open', 'In-Progress'] } }),
            Booking.countDocuments({ 'cancellationProgress.status': 'processing_refund' })
        ]);

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
        const [
            ongoingBookings,
            activeProviders,
            delayedBookings
        ] = await Promise.all([
            Booking.countDocuments({ status: { $in: ['in-progress', 'accepted', 'scheduled'] } }),
            Provider.countDocuments({ approved: true, isActive: true, blockedTill: { $lte: new Date() } }),
            Booking.countDocuments({ status: { $in: ['scheduled', 'accepted'] }, date: { $lt: moment().subtract(1, 'hours').toDate() } })
        ]);

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

        const [recentBookings, recentPayments, recentPayouts] = await Promise.all([
            Booking.find()
                .populate('customer', 'name')
                .populate('provider', 'name')
                .sort({ createdAt: -1 })
                .limit(5)
                .select('status totalAmount createdAt customer provider')
                .lean(),
            Transaction.find()
                .populate('user', 'name')
                .sort({ createdAt: -1 })
                .limit(5)
                .select('paymentMethod paymentStatus amount createdAt user')
                .lean(),
            ProviderEarning.find()
                .populate('provider', 'name')
                .sort({ createdAt: -1 })
                .limit(5)
                .select('netAmount createdAt provider')
                .lean()
        ]);

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

        const matchStage = {};
        if (req.query.startDate || req.query.endDate) {
            matchStage.createdAt = {};
            if (req.query.startDate) {
                matchStage.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                matchStage.createdAt.$lte = new Date(req.query.endDate);
            }
        } else {
            matchStage.createdAt = { $gte: startDate };
        }

        if (req.query.zoneIds) {
            const mongoose = require('mongoose');
            const zoneIdsArray = req.query.zoneIds.split(',').map(id => {
                try {
                    return new mongoose.Types.ObjectId(id);
                } catch (e) {
                    return id;
                }
            });
            matchStage.zoneId = { $in: zoneIdsArray };
        }

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
                                    totalRevenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$cancellationProgress.refundAmount", 0] }] } },
                                    totalCommission: { $sum: "$commissionAmount" },
                                    totalPayout: { $sum: "$providerEarnings" },
                                    completedCount: { $sum: 1 },
                                    surgeRevenue: { $sum: "$companySurgeShare" },
                                    platformFeeRevenue: { $sum: "$platformFee" },
                                    netEarnings: { $sum: "$commissionAmount" },
                                    visitingRevenue: { $sum: "$visitingCharge" },
                                    rainRevenue: { $sum: "$rainCharge" },
                                    trafficRevenue: { $sum: "$trafficCharge" },
                                    nightRevenue: { $sum: "$nightCharge" },
                                    demandRevenue: { $sum: "$demandSurge" },
                                    customRevenue: { $sum: "$customCharges" },
                                    providerSurgeShare: { $sum: "$providerSurgeShare" },
                                    companySurgeShare: { $sum: "$companySurgeShare" }
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
                                    revenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$cancellationProgress.refundAmount", 0] }] } }
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

            // 4. Pending Counts & Active Providers
            Promise.all([
                Provider.countDocuments({ approved: false, kycStatus: 'pending' }),
                PaymentRecord.countDocuments({ status: { $in: ['requested', 'processing'] } }),
                Complaint.countDocuments({ status: { $in: ['Open', 'In-Progress'] } }),
                Provider.countDocuments({ approved: true, isActive: true })
            ]),

            // 5. Recent Activity
            Promise.all([
                Booking.find().sort({ createdAt: -1 }).limit(10).populate('customer', 'name').populate('provider', 'name').select('customer provider createdAt totalAmount status').lean(),
                Booking.find({ status: 'completed' }).sort({ serviceCompletedAt: -1 }).limit(5).populate('customer', 'name').populate('provider', 'name').select('customer provider serviceCompletedAt createdAt totalAmount').lean(),
                User.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(5).select('name createdAt').lean()
            ])
        ]);

        const stats = bookingStatsAgg[0];
        const [pendingProviders, pendingWithdrawals, pendingDisputes, activeProvidersCount] = pendingCounts;
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

        // Rebook and Favorite Provider Analytics
        const [totalRebooks, topRepeatedServices, mostFavoritedProviders, repeatCustomerCount, totalFavBookings] = await Promise.all([
            Booking.countDocuments({ isRebook: true }),
            Booking.aggregate([
                { $match: { isRebook: true } },
                { $unwind: "$services" },
                { $group: { _id: "$services.service", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 3 },
                { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'serviceInfo' } },
                { $unwind: "$serviceInfo" },
                { $project: { serviceName: "$serviceInfo.title", count: 1 } }
            ]),
            User.aggregate([
                { $unwind: "$favoriteProviders" },
                {
                    $group: {
                        _id: "$favoriteProviders.providerId",
                        name: { $first: "$favoriteProviders.providerName" },
                        category: { $first: "$favoriteProviders.category" },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 3 }
            ]),
            Booking.aggregate([
                { $group: { _id: "$customer", count: { $sum: 1 } } },
                { $match: { count: { $gt: 1 } } },
                { $count: "count" }
            ]),
            Booking.countDocuments({ isFavoriteProviderBooking: true })
        ]);

        const repeatBookingRate = totalBookings > 0 ? ((totalRebooks / totalBookings) * 100).toFixed(1) : 0;
        const providerRetentionScore = totalBookings > 0 ? ((totalFavBookings / totalBookings) * 100).toFixed(1) : 0;
        const finalRepeatCustomerCount = repeatCustomerCount[0]?.count || 0;

        const result = {
            bookingStats: {
                total: totalBookings,
                completed: stats.revenueOverview[0]?.completedCount || 0,
                cancelled: cancelledCount,
                inProgress: stats.statusDistribution.find(s => s._id === 'in-progress')?.count || 0,
                pending: stats.statusDistribution.find(s => s._id === 'pending')?.count || 0,
            },
            providerStats: {
                active: activeProvidersCount || 0
            },
            revenueStats: {
                totalRevenue: stats.revenueOverview[0]?.totalRevenue || 0,
                growth: 0, // Placeholder
                platformCommission: stats.revenueOverview[0]?.totalCommission || 0,
                providerPayout: stats.revenueOverview[0]?.totalPayout || 0,
                chartData: stats.chartData,
                surgeRevenue: stats.revenueOverview[0]?.surgeRevenue || 0,
                platformFeeRevenue: stats.revenueOverview[0]?.platformFeeRevenue || 0,
                netEarnings: stats.revenueOverview[0]?.netEarnings || 0,
                surgeBreakdown: {
                    visitingRevenue: stats.revenueOverview[0]?.visitingRevenue || 0,
                    rainRevenue: stats.revenueOverview[0]?.rainRevenue || 0,
                    trafficRevenue: stats.revenueOverview[0]?.trafficRevenue || 0,
                    nightRevenue: stats.revenueOverview[0]?.nightRevenue || 0,
                    demandRevenue: stats.revenueOverview[0]?.demandRevenue || 0,
                    platformFeeRevenue: stats.revenueOverview[0]?.platformFeeRevenue || 0,
                    customRevenue: stats.revenueOverview[0]?.customRevenue || 0
                },
                surgeSplits: {
                    providerSurgeShare: stats.revenueOverview[0]?.providerSurgeShare || 0,
                    companySurgeShare: stats.revenueOverview[0]?.companySurgeShare || 0
                }
            },
            totalAdminEarnings: (stats.revenueOverview[0]?.netEarnings || 0) + (stats.revenueOverview[0]?.companySurgeShare || 0),
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
            },
            rebookStats: {
                totalRebooks,
                repeatBookingRate,
                topRepeatedServices
            },
            favoriteProviderStats: {
                mostFavoritedProviders,
                providerRetentionScore,
                repeatCustomerCount: finalRepeatCustomerCount
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
        const { amount, reason, type, absorption = 'shared' } = req.body; // type: 'full' or 'partial'

        const booking = await Booking.findById(bookingId).populate('complaint').session(session);
        if (!booking) {
            throw new Error('Booking not found');
        }

        // --- STRICT BLOCK FOR COD/CASH REFUNDS ---
        if (booking.paymentMethod === 'cod' || booking.paymentMethod === 'cash') {
            throw new Error('Pay after Service (COD/Cash) bookings are strictly ineligible for wallet refunds to prevent refund fraud.');
        }

        // --- DOUBLE-REFUND PROTECTION SCAN ---
        if (booking.refundProcessed && booking.adminRefundDecision === 'approved') {
            throw new Error('Double-refund protection: A full refund has already been completed.');
        }

        const completedRefunds = await Transaction.aggregate([
            { $match: { booking: booking._id, type: 'refund', paymentStatus: 'completed' } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]).session(session);

        const totalRefundedAmt = completedRefunds.length > 0 ? completedRefunds[0].total : 0;
        if (totalRefundedAmt >= booking.totalAmount) {
            throw new Error('Double-refund protection: Cumulative refunds already cover the total booking amount.');
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

        const newTotalRefunded = previouslyRefunded + refundAmount;
        const isFullyRefunded = newTotalRefunded >= booking.totalAmount || type === 'full';

        // ── STEP 1: BOOKING UPDATE ──
        booking.paymentStatus = isFullyRefunded ? 'refunded' : booking.paymentStatus;
        booking.disputeStatus = isFullyRefunded ? 'refund_approved' : 'under_review';
        booking.adminRefundDecision = isFullyRefunded ? 'approved' : 'partial';
        booking.cancellationProgress.status = 'refund_completed';
        booking.cancellationProgress.refundAmount = newTotalRefunded;
        booking.cancellationProgress.refundCompletedAt = new Date();
        booking.adminRemark = reason || `Admin approved ${type} refund`;

        // Update refund fields
        booking.refundStatus = 'completed';
        booking.refundMode = 'wallet';
        booking.refundProcessed = true;

        // Admin Comment Sync - Timeline: Push to booking.complaintProofs so it appears on complaint timeline
        booking.complaintProofs.push({
            uploadedBy: 'admin',
            message: `Refund Approved: ₹${refundAmount} (${type} refund). Reason/Comment: ${reason || 'Not specified'}`,
            createdAt: new Date()
        });

        // Admin Comment Sync - Booking History: Push to statusHistory
        booking.statusHistory.push({
            status: booking.status,
            note: `Refund Approved: ₹${refundAmount} (${type} refund). Reason/Comment: ${reason || 'Not specified'}`,
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

        await booking.save({ session });

        // ── STEP 2: COMPLAINT UPDATE ──
        let complaintObj = null;
        if (booking.complaint) {
            complaintObj = await Complaint.findById(booking.complaint._id).session(session);
        } else {
            complaintObj = await Complaint.findOne({ booking: booking._id }).session(session);
        }

        if (complaintObj) {
            complaintObj.status = 'refunded';
            complaintObj.resolution = 'refund_processed';
            complaintObj.resolvedAt = new Date();
            complaintObj.resolutionNotes = reason || `Admin approved ${type} refund`;
            complaintObj.resolvedBy = req.admin?._id;
            complaintObj.statusHistory.push({ status: 'refunded', updatedAt: new Date() });
            await complaintObj.save({ session });
        }

        // ── STEP 3: WALLET CREDIT ──
        user.wallet.availableBalance += refundAmount;
        user.wallet.totalRefunded += refundAmount;
        user.wallet.walletTransactions.push({
            type: 'credit',
            amount: refundAmount,
            reason: 'Booking Refund',
            source: 'booking_refund',
            status: 'success',
            booking: booking._id
        });
        user.wallet.lastUpdated = new Date();
        await user.save({ session });

        // Create Transaction record for audit (Admin Comment Sync - Refund Audit Trail)
        const refundTransaction = new Transaction({
            booking: booking._id,
            bookingId: booking.bookingId || booking._id,
            user: booking.customer,
            amount: refundAmount,
            paymentStatus: 'completed',
            paymentMethod: 'wallet',
            type: 'refund',
            description: `Admin approved ${type} refund for booking #${booking.bookingId || booking._id}. Reason/Comment: ${reason || 'Not specified'}`,
            refundReason: reason || `Admin approved ${type} refund`
        });
        await refundTransaction.save({ session });

        // ── STEP 4: EARNINGS RECALCULATION ──
        let recoveryStatus = 'not_required';
        let recoveredAmount = 0;
        let totalToRecover = 0;
        let providerEarningsReversal = 0;
        let adminRevenueReversal = 0;

        if (earning) {
            if (absorption === 'platform') {
                // Platform absorbs 100% of the refund loss, provider suffers 0% loss
                providerEarningsReversal = 0;
                adminRevenueReversal = refundAmount;
            } else if (absorption === 'provider') {
                // Provider absorbs 100% of the loss (up to their earnings), platform absorbs the remaining if any
                providerEarningsReversal = Math.min(booking.providerEarnings || 0, refundAmount);
                adminRevenueReversal = Math.max(0, refundAmount - providerEarningsReversal);
            } else {
                // Shared: Standard proportional ratio split
                let commissionRate = 10; // default 10%
                if (earning.commissionRate > 0) {
                    commissionRate = earning.commissionRate;
                } else if (booking.totalAmount > 0) {
                    commissionRate = ((booking.commissionAmount || 0) / booking.totalAmount) * 100;
                }

                const originalCommissionAmount = booking.totalAmount * (commissionRate / 100);
                const originalProviderEarnings = booking.totalAmount - originalCommissionAmount;

                const ratio = refundAmount / (booking.totalAmount || 1);
                providerEarningsReversal = originalProviderEarnings * ratio;
                adminRevenueReversal = originalCommissionAmount * ratio;
            }

            totalToRecover = providerEarningsReversal;

            // Reduce earning netAmount, commissionAmount, grossAmount proportionally
            earning.netAmount = Math.max(0, earning.netAmount - providerEarningsReversal);
            earning.commissionAmount = Math.max(0, earning.commissionAmount - adminRevenueReversal);
            earning.grossAmount = Math.max(0, earning.grossAmount - refundAmount);

            if (earning.netAmount <= 0) {
                earning.status = 'cancelled';
            }

            if (['held', 'available', 'under_review', 'pending_release'].includes(earning.status)) {
                // CASE 1: Payout not yet transferred
                recoveryStatus = 'cancelled_held';
                recoveredAmount = providerEarningsReversal;
                await earning.save({ session });
            } else if (['paid', 'withdrawn'].includes(earning.status)) {
                // CASE 2: Payout already transferred -> Recover from provider wallet available balance (allowing negative balance/debt)
                await earning.save({ session });

                const provider = await Provider.findById(booking.provider).session(session);
                if (provider && provider.wallet) {
                    if (provider.wallet.availableBalance === undefined) {
                        provider.wallet.availableBalance = 0;
                    }
                    provider.wallet.availableBalance -= totalToRecover;
                    provider.wallet.lastUpdated = new Date();
                    await provider.save({ session });

                    recoveredAmount = totalToRecover;
                    recoveryStatus = 'fully_recovered';
                }
            }

            // Perform proportional earnings reduction on booking as well
            booking.providerEarnings = Math.max(0, booking.providerEarnings - providerEarningsReversal);
            booking.commissionAmount = Math.max(0, booking.commissionAmount - adminRevenueReversal);
        }

        // Save final financial recovery log in booking adminRemark
        booking.adminRemark = (booking.adminRemark || '') +
            ` | Recovery: ${recoveryStatus} (₹${recoveredAmount.toFixed(2)}/₹${totalToRecover.toFixed(2)} recovered from provider)`;
        await booking.save({ session });

        // Finalize transaction record
        transaction.refundStatus = isFullyRefunded ? 'completed' : 'partial';
        transaction.refundReason = reason || `Admin ${type} refund`;
        transaction.refundedAt = new Date();
        if (isFullyRefunded) transaction.paymentStatus = 'refunded';
        transaction.refundedAmount = newTotalRefunded;
        await transaction.save({ session });

        // Commit transaction atomically
        await session.commitTransaction();
        session.endSession();

        // ── STEP 5: DASHBOARD METRICS REFRESH ──
        try {
            await refreshAnalytics();
        } catch (analyticsErr) {
            console.error('Failed to refresh dashboard analytics:', analyticsErr);
        }

        // ── STEP 6: NOTIFICATION DISPATCH ──
        // Notify Customer
        try {
            sendNotification(
                booking.customer,
                'customer',
                'Refund Credited 💰',
                `A refund of ₹${refundAmount} has been credited to your wallet.`,
                'refund_processed',
                booking._id
            );
        } catch (err) { }

        // Notify Provider
        if (booking.provider) {
            try {
                const message = recoveryStatus === 'cancelled_held'
                    ? `A refund of ₹${refundAmount} was approved. Your held earning has been adjusted by ₹${providerEarningsReversal.toFixed(2)}.`
                    : `A refund of ₹${refundAmount} was approved. ₹${recoveredAmount.toFixed(2)} has been adjusted from your wallet balance.`;

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

        // Notify Admin (System Audit)
        try {
            sendNotification(
                null,
                'admin',
                'Refund Completed Successfully ✅',
                `Refund of ₹${refundAmount} for booking #${booking.bookingId || booking._id} processed successfully by Admin.`,
                'admin_refund_success',
                booking._id
            );
        } catch (err) { }

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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { bookingId } = req.params;
        const { reason } = req.body;

        const booking = await Booking.findById(bookingId).session(session);
        if (!booking) {
            throw new Error('Booking not found');
        }

        // ── STEP 1: BOOKING UPDATE ──
        booking.status = 'completed';
        booking.disputeStatus = 'resolved';
        booking.adminRefundDecision = 'rejected';
        booking.adminRemark = reason || 'Admin resolved without refund';

        // Admin Comment Sync - Timeline: Push to booking.complaintProofs so it appears on complaint timeline
        booking.complaintProofs.push({
            uploadedBy: 'admin',
            message: `Dispute resolved without refund. Admin Comment: ${reason || 'No comment provided'}`,
            createdAt: new Date()
        });

        // Admin Comment Sync - Booking History: Push to statusHistory
        booking.statusHistory.push({
            status: 'completed',
            note: `Dispute resolved without refund. Admin Comment: ${reason || 'No comment provided'}`,
            updatedBy: 'admin',
            timestamp: new Date()
        });

        await booking.save({ session });

        // ── STEP 2: COMPLAINT UPDATE ──
        let complaintObj = null;
        if (booking.complaint) {
            complaintObj = await Complaint.findById(booking.complaint._id).session(session);
        } else {
            complaintObj = await Complaint.findOne({ booking: booking._id }).session(session);
        }

        if (complaintObj) {
            complaintObj.status = 'resolved';
            complaintObj.resolvedAt = new Date();
            complaintObj.resolutionNotes = reason || 'Dispute resolved without refund';
            complaintObj.resolvedBy = req.admin?._id;
            complaintObj.statusHistory.push({ status: 'resolved', updatedAt: new Date() });
            await complaintObj.save({ session });
        }

        // ── STEP 3: WALLET CREDIT ──
        // Not applicable (no wallet credit occurs)

        // ── STEP 4: EARNINGS RECALCULATION ──
        // Since the dispute is rejected (resolved without refund), the provider's earnings are released (status becomes available)
        const earning = await ProviderEarning.findOne({ booking: booking._id }).session(session);
        if (earning && earning.status === 'held') {
            earning.status = 'available';
            await earning.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        // ── STEP 5: DASHBOARD METRICS REFRESH ──
        try {
            await refreshAnalytics();
        } catch (analyticsErr) {
            console.error('Failed to refresh dashboard analytics:', analyticsErr);
        }

        // ── STEP 6: NOTIFICATION DISPATCH ──
        // Notify Customer
        try {
            sendNotification(
                booking.customer,
                'customer',
                'Dispute Resolved',
                `Your dispute for booking ${booking.bookingId || booking._id} was resolved. Reason: ${booking.adminRemark}`,
                'dispute_resolved',
                booking._id
            );
        } catch (err) { }

        // Notify Provider
        if (booking.provider) {
            try {
                sendNotification(
                    booking.provider,
                    'provider',
                    'Dispute Resolved ✅',
                    `The dispute for booking #${booking.bookingId || booking._id} has been resolved in your favor. Your payout is now available.`,
                    'dispute_resolved_provider',
                    booking._id
                );
            } catch (err) { }
        }

        res.json({
            success: true,
            message: 'Refund request rejected. Dispute resolved without refund.',
            data: { bookingId: booking._id }
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error('Reject refund error:', error);
        res.status(400).json({ success: false, message: error.message });
    }
};




// 4. Toggle Payout Hold
const togglePayoutHold = async (req, res) => {
    let session = null;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (err) {
        console.warn("[Transaction Fallback] Session start failed. Standalone MongoDB detected. Running sequential fallback.", err.message);
        session = null;
    }

    try {
        const { bookingId } = req.params;
        const { status, reason } = req.body; // 'held' or 'available'

        const ProviderEarning = mongoose.model('ProviderEarning');
        const earning = await ProviderEarning.findOne({ booking: bookingId }).session(session);

        if (!earning) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(404).json({ success: false, message: 'Earning record not found' });
        }

        const oldStatus = earning.status;
        if (oldStatus === status) {
            if (session) {
                await session.abortTransaction();
                session.endSession();
            }
            return res.status(400).json({ success: false, message: `Earning status is already ${status}` });
        }

        // Apply changes
        earning.status = status;
        earning.isHeldByAdmin = status === 'held';
        earning.holdReason = status === 'held' ? (reason || 'Held by administrator') : null;
        await earning.save({ session });

        // If releasing payout: credit provider's wallet and create a transaction ledger entry
        if (oldStatus === 'held' && status === 'available') {
            const provider = await Provider.findById(earning.provider).session(session);
            if (provider) {
                if (!provider.wallet) {
                    provider.wallet = { availableBalance: 0, totalWithdrawn: 0, lastUpdated: new Date() };
                }
                provider.wallet.availableBalance += earning.netAmount;
                provider.wallet.lastUpdated = new Date();
                await provider.save({ session });

                const releaseTransaction = new Transaction({
                    booking: earning.booking,
                    user: provider._id, // Ledger associated with provider user ref
                    amount: earning.netAmount,
                    paymentStatus: 'completed',
                    paymentMethod: 'wallet',
                    type: 'payout',
                    description: `Escrow payout released by administrator for booking #${bookingId}. Reason: ${reason || 'Hold released'}`
                });
                await releaseTransaction.save({ session });
            }
        } else if (oldStatus === 'available' && status === 'held') {
            // Reversing the payout: deduct from provider's wallet availableBalance
            const provider = await Provider.findById(earning.provider).session(session);
            if (provider && provider.wallet) {
                provider.wallet.availableBalance = Math.max(0, provider.wallet.availableBalance - earning.netAmount);
                provider.wallet.lastUpdated = new Date();
                await provider.save({ session });

                const holdTransaction = new Transaction({
                    booking: earning.booking,
                    user: provider._id,
                    amount: earning.netAmount,
                    paymentStatus: 'completed',
                    paymentMethod: 'wallet',
                    type: 'adjustment',
                    description: `Escrow payout held by administrator for booking #${bookingId}. Reason: ${reason || 'Held by admin'}`
                });
                await holdTransaction.save({ session });
            }
        }

        if (session) {
            await session.commitTransaction();
            session.endSession();
        }

        res.json({
            success: true,
            message: `Payout status updated to ${status}`,
            data: earning
        });
    } catch (error) {
        if (session) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
        }
        console.error('Toggle payout hold error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const cancelBookingByAdmin = async (req, res) => {
    const mongoose = require('mongoose');
    const { sendMail } = require('../utils/sendmail');
    const { sendNotification } = require('../utils/notificationHelper');

    let session = null;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
    } catch (err) {
        console.warn("[Transaction Fallback] Session start failed. Standalone MongoDB detected. Running sequential fallback.", err.message);
        session = null;
    }

    try {
        const { bookingId } = req.params;
        const { reasonType, reasonText, complaintId, adminNotes } = req.body;

        if (!reasonType || !reasonText) {
            throw new Error('Cancellation reason type and text are required');
        }

        const booking = await Booking.findById(bookingId).populate('customer').populate('provider').session(session);
        if (!booking) {
            throw new Error('Booking not found');
        }

        // Safety rules validation
        if (booking.status === 'completed') {
            throw new Error('Cannot cancel completed booking.');
        }
        if (booking.status === 'cancelled' || booking.paymentStatus === 'refunded') {
            throw new Error('Booking is already cancelled or refunded.');
        }
        if (booking.disputeStatus === 'resolved' || booking.status === 'dispute_closed') {
            throw new Error('Cannot cancel booking with resolved dispute.');
        }

        const customer = booking.customer;
        if (!customer) {
            throw new Error('Customer details not found on booking');
        }

        const platformFeeRetained = booking.platformFee || 0;
        const nonRefundableAmount = platformFeeRetained;
        const refundableAmount = ['cash', 'cod'].includes(booking.paymentMethod) ? 0 : Math.max(0, booking.totalAmount - platformFeeRetained);

        // Update booking cancellation details
        booking.status = 'cancelled';
        booking.cancelledBy = 'admin';
        booking.cancellationReason = `${reasonType}: ${reasonText}`;
        booking.cancelledAt = new Date();
        booking.refundDestination = refundableAmount > 0 ? 'wallet' : 'none';
        booking.refundAmount = refundableAmount;
        booking.nonRefundableAmount = nonRefundableAmount;
        booking.platformFeeRetained = platformFeeRetained;
        booking.refundStatus = refundableAmount > 0 ? 'completed' : 'none';
        booking.refundProcessedAt = refundableAmount > 0 ? new Date() : null;
        booking.refundReference = refundableAmount > 0 ? `REF-${Date.now()}` : null;
        booking.paymentStatus = refundableAmount > 0 ? 'refunded' : booking.paymentStatus;

        booking.statusHistory.push({
            status: 'cancelled',
            note: `Booking Cancelled By Admin. Reason: ${reasonType} - ${reasonText}${complaintId ? ' (Complaint Linked: ' + complaintId + ')' : ''}`,
            updatedBy: 'admin',
            timestamp: new Date()
        });

        // Wallet Update (if refund is required)
        if (refundableAmount > 0) {
            if (!customer.wallet) {
                customer.wallet = { availableBalance: 0, totalRefunded: 0, lastUpdated: new Date(), walletTransactions: [] };
            }
            customer.wallet.availableBalance += refundableAmount;
            customer.wallet.totalRefunded += refundableAmount;
            customer.wallet.walletTransactions.push({
                type: 'credit',
                amount: refundableAmount,
                reason: `Booking Refund (Admin Cancellation): ${reasonText}`,
                source: 'booking_refund',
                status: 'success',
                booking: booking._id
            });
            customer.wallet.lastUpdated = new Date();
            await customer.save({ session });

            // Create Transaction record for the refund
            const refundTransaction = new Transaction({
                booking: booking._id,
                bookingId: booking.bookingId || booking._id.toString(),
                user: customer._id,
                amount: refundableAmount,
                paymentStatus: 'completed',
                paymentMethod: 'wallet',
                type: 'refund',
                description: `Admin cancelled booking - Refund to wallet. Reason: ${reasonText}`,
                refundReason: reasonText
            });
            await refundTransaction.save({ session });
        }

        // Create Transaction record for the Platform Fee Retained
        if (platformFeeRetained > 0) {
            const platformFeeTransaction = new Transaction({
                booking: booking._id,
                bookingId: booking.bookingId || booking._id.toString(),
                user: customer._id,
                amount: platformFeeRetained,
                paymentStatus: 'success',
                paymentMethod: 'wallet',
                type: 'payment',
                description: `Platform fee retained for cancelled booking #${booking.bookingId || booking._id}`
            });
            await platformFeeTransaction.save({ session });
        }

        // Update provider earnings & performance stats if provider assigned
        if (booking.provider) {
            await Provider.findByIdAndUpdate(booking.provider._id, {
                $inc: { canceledBookings: 1 },
                $set: { activeBooking: null }
            }, { session });

            // Reverse provider earning document
            let earning = await ProviderEarning.findOne({ booking: booking._id }).session(session);
            if (earning) {
                earning.netAmount = 0;
                earning.commissionAmount = 0;
                earning.grossAmount = 0;
                earning.status = 'cancelled';
                await earning.save({ session });
            }
        }

        // Resolve Complaint if linked
        let complaintObj = null;
        if (complaintId) {
            complaintObj = await Complaint.findOne({ $or: [{ _id: mongoose.Types.ObjectId.isValid(complaintId) ? complaintId : undefined }, { complaintId: complaintId }] }).session(session);
            if (complaintObj) {
                complaintObj.bookingCancelled = true;
                complaintObj.bookingCancelledAt = new Date();
                complaintObj.bookingId = booking._id;
                complaintObj.resolution = "Booking Cancelled";
                complaintObj.status = "resolved";
                complaintObj.resolutionNotes = adminNotes || reasonText;
                complaintObj.resolvedAt = new Date();
                complaintObj.resolvedBy = req.admin?._id;
                complaintObj.statusHistory.push({ status: 'resolved', updatedAt: new Date() });
                await complaintObj.save({ session });

                // Link complaint ID to booking
                booking.complaintId = complaintObj._id;
            }
        }

        await booking.save({ session });

        if (session) {
            await session.commitTransaction();
            session.endSession();
        }

        // Recalculate provider performance dynamically after transaction commits successfully to avoid write conflicts
        if (booking.provider) {
            try {
                const { recalculateProviderPerformance } = require('./Booking-controller');
                if (recalculateProviderPerformance) {
                    await recalculateProviderPerformance(booking.provider._id);
                }
            } catch (err) {
                console.error("Error recalculating provider performance after admin cancellation commit:", err);
            }
        }

        // Dispatch notifications
        try {
            sendNotification(
                customer._id,
                'customer',
                'Booking Cancelled By Support Team',
                `Your booking has been cancelled by Support Team. Reason: ${reasonText}`,
                'booking',
                booking._id
            );

            if (booking.provider) {
                sendNotification(
                    booking.provider._id,
                    'provider',
                    'Booking Cancelled',
                    `Booking cancelled by Admin. Reason: ${reasonText}`,
                    'booking',
                    booking._id
                );
            }
        } catch (notifErr) {
            console.error('Notification dispatch error:', notifErr);
        }

        // Dispatch emails
        try {
            const serviceName = booking.services?.[0]?.service?.title || 'Service';
            const complaintRef = complaintObj ? (complaintObj.complaintId || complaintObj._id.toString()) : 'N/A';

            await sendMail({
                to: customer.email,
                templateType: 'adminBookingCancelledCustomer',
                variables: {
                    name: customer.name,
                    bookingId: booking.bookingId || booking._id.toString(),
                    serviceName,
                    cancellationReason: reasonText,
                    complaintId: complaintRef,
                    refundAmount: refundableAmount,
                    platformFeeRetained,
                    refundDestination: refundableAmount > 0 ? 'Customer Wallet' : 'None',
                    expectedRefundTimeline: 'Instant'
                }
            });

            if (booking.provider) {
                await sendMail({
                    to: booking.provider.email,
                    templateType: 'adminBookingCancelledProvider',
                    variables: {
                        name: booking.provider.name,
                        bookingId: booking.bookingId || booking._id.toString(),
                        customerName: customer.name,
                        cancellationReason: reasonText,
                        complaintId: complaintRef
                    }
                });
            }
        } catch (mailErr) {
            console.error('Email dispatch error:', mailErr);
        }

        res.status(200).json({
            success: true,
            message: 'Booking successfully cancelled by admin and refund processed to wallet.',
            data: booking
        });

    } catch (error) {
        if (session && session.inTransaction()) {
            await session.abortTransaction();
        }
        if (session) {
            session.endSession();
        }
        console.error('Error in admin cancellation:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to cancel booking' });
    }
};


module.exports = {
    cancelBookingByAdmin,
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
        await Promise.all(items.map(async (item) => {
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
        }));

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
        await Promise.all(items.map(async (item) => {
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
        }));

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
        await Promise.all(items.map(async (item) => {
            const promises = [];
            if (item.userId) {
                const model = item.userModel === 'Provider' ? Provider : User;
                promises.push(
                    model.findById(item.userId).select('name email phone role isSuspended')
                        .then(user => { item.user = user; })
                );
            }
            if (item.bookingId) {
                promises.push(
                    Booking.findById(item.bookingId)
                        .select('bookingId services status totalAmount createdAt')
                        .populate('provider', 'name email phone')
                        .then(booking => { item.booking = booking; })
                );
            }
            await Promise.all(promises);
        }));

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

// System Logs API (Optimized to read only required records backwards asynchronously to prevent server slowdowns)
const getSystemLogs = async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, '../logs/combined.log');
        if (!fs.existsSync(logPath)) return res.json({ success: true, logs: [], total: 0 });

        const { level, page = 1, limit = 50 } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const targetLevel = level && level !== 'ALL' ? level.toUpperCase() : null;

        const fileHandle = await fs.promises.open(logPath, 'r');
        const stat = await fileHandle.stat();
        let fileOffset = stat.size;
        const bufferSize = 64 * 1024; // 64KB chunk size
        const buffer = Buffer.alloc(bufferSize);

        let linesCollected = [];
        let leftover = '';
        const targetCount = pageNum * limitNum;

        while (fileOffset > 0 && linesCollected.length < targetCount) {
            const bytesToRead = Math.min(bufferSize, fileOffset);
            fileOffset -= bytesToRead;

            const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, fileOffset);
            const chunk = buffer.toString('utf8', 0, bytesRead) + leftover;
            const chunkLines = chunk.split('\n');

            leftover = chunkLines[0];

            for (let i = chunkLines.length - 1; i >= 1; i--) {
                const line = chunkLines[i]?.trim();
                if (!line) continue;

                if (targetLevel) {
                    if (!line.includes(`[${targetLevel}]:`)) {
                        continue;
                    }
                }

                const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(.+?)\]: (.*)$/);
                if (match) {
                    linesCollected.push({ timestamp: match[1], level: match[2], message: match[3] });
                } else {
                    linesCollected.push({ message: line });
                }

                if (linesCollected.length >= targetCount) break;
            }
        }

        if (leftover && linesCollected.length < targetCount) {
            const line = leftover.trim();
            if (line) {
                if (!targetLevel || line.includes(`[${targetLevel}]:`)) {
                    const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(.+?)\]: (.*)$/);
                    if (match) {
                        linesCollected.push({ timestamp: match[1], level: match[2], message: match[3] });
                    } else {
                        linesCollected.push({ message: line });
                    }
                }
            }
        }

        await fileHandle.close();

        const hasMore = linesCollected.length >= targetCount;
        const startIndex = (pageNum - 1) * limitNum;
        const paginatedLogs = linesCollected.slice(startIndex, startIndex + limitNum);

        // Calculate/estimate total logs based on file size if level is ALL, else based on targetCount
        const total = targetLevel
            ? (hasMore ? targetCount + limitNum : linesCollected.length)
            : Math.max(linesCollected.length, Math.round(stat.size / 90));

        res.json({
            success: true,
            logs: paginatedLogs,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        console.error('Log API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to read logs' });
    }
};

module.exports.getSystemLogs = getSystemLogs;
module.exports.getActiveSessions = getActiveSessions;
module.exports.forceLogoutUser = forceLogoutUser;
