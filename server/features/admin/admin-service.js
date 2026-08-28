const Admin = require('./admin-model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Provider = require('../provider/provider-model');
const User = require('../user/user-model');
const Booking = require('../booking/booking-model');
const Service = require('../catalog/service-model');
const Complaint = require('../complaint/complaint-model');
const Transaction = require('../payment/transaction-model');
const Coupon = require('../coupon/coupon-model');
const ProviderEarning = require('../provider/provider-earning-model');
const PaymentRecord = require('../payment/payment-record-model');
const Feedback = require('../feedback/feedback-model');
const moment = require('moment');
const path = require('path');
const fs = require('fs');
const cloudinary = require('../../shared/config/cloudinary'); // Updated import path for services/
const mongoose = require('mongoose');
const { sendNotification } = require('../notification/notification-helper');
const generateProviderId = require('../../shared/utils/generate-unique-id');
const { sendMail } = require('../../shared/utils/sendmail');
const { getPrecomputedAnalytics, refreshAnalytics } = require('../analytics/analytics-service'); // Updated import path for services/


const deleteFile = async (publicId) => {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Successfully deleted file from Cloudinary: ${publicId}`);
    } catch (err) {
        console.error(`Failed to delete file from Cloudinary: ${publicId}`, err.message);
    }
};

const emitProviderStatusChange = (provider, status) => {
    try {
        const { getIO } = require('../../shared/socket/socket-server');
        const io = getIO();
        if (io) {
            const providerIdStr = (provider && provider._id) ? provider._id.toString() : String(provider);
            const payload = {
                providerId: providerIdStr,
                status,
                timestamp: new Date()
            };
            io.emit('provider:status_change', payload);
            io.emit('provider-status-changed', payload);
            io.to(providerIdStr).emit('provider-status-changed', payload);
            io.to('admin_live_room').emit('provider-status-changed', payload);

            const statusUpdatedPayload = {
                status,
                approved: provider?.approved,
                kycStatus: provider?.kycStatus,
                bankDetails: provider?.bankDetails
            };
            io.to(`provider:${providerIdStr}`).emit('provider:status_updated', statusUpdatedPayload);
            io.to(`provider_${providerIdStr}`).emit('provider:status_updated', statusUpdatedPayload);
            io.to(providerIdStr).emit('provider:status_updated', statusUpdatedPayload);
        }
    } catch (err) {
        console.error('Failed to emit provider status change socket event:', err.message);
    }
};

class AdminService {

    static async cancelBookingByAdmin(req, res) {
        const mongoose = require('mongoose');
        const { sendMail } = require('../../shared/utils/sendmail');
        const { sendNotification } = require('../notification/notification-helper');

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
                    entryType: 'debit',
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
                    const { recalculateProviderPerformance } = require('../booking/booking-controller');
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
    }

    static async registerAdmin(req, res) {
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

            if (password.length < 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 10 characters long'
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
            const { SystemConfig } = require('../system-setting/system-setting-model');
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
    }

    static async getAdminProfile(req, res) {
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
    }

    static async updateAdminProfile(req, res) {
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
    }

    static async deleteAdmin(req, res) {
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
    }

    static async getAllAdmins(req, res) {
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
    }

    static async getAllCustomers(req, res) {
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
    }

    static async getCustomerById(req, res) {
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
    }

    static async updateCustomer(req, res) {
        try {
            const customerId = req.params.id;
            const allowedFields = ['name', 'phone', 'address', 'isSuspended', 'suspensionReason'];
            const safeUpdates = {};

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    if (field === 'isSuspended') {
                        if (typeof req.body.isSuspended === 'boolean') {
                            safeUpdates.isSuspended = req.body.isSuspended;
                        } else if (req.body.isSuspended === 'true') {
                            safeUpdates.isSuspended = true;
                        } else if (req.body.isSuspended === 'false') {
                            safeUpdates.isSuspended = false;
                        }
                    } else {
                        safeUpdates[field] = req.body[field];
                    }
                }
            }

            if (Object.keys(safeUpdates).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No valid editable customer fields provided'
                });
            }

            const customer = await User.findOneAndUpdate(
                { _id: customerId, role: 'customer' },
                { $set: safeUpdates },
                { new: true, runValidators: true }
            ).select('-password');

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Customer details updated successfully',
                user: customer
            });

        } catch (error) {
            console.error('Update customer error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Server error while updating customer details'
            });
        }
    }

    static async toggleBlockCustomer(req, res) {
        try {
            const customerId = req.params.id;
            const { reason } = req.body;

            const customer = await User.findOne({ _id: customerId, role: 'customer' });
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            customer.isSuspended = !customer.isSuspended;
            if (customer.isSuspended) {
                customer.suspensionReason = reason || 'Suspended by admin';
            } else {
                customer.suspensionReason = undefined;
            }

            await customer.save();

            res.status(200).json({
                success: true,
                message: `Customer account ${customer.isSuspended ? 'blocked' : 'unblocked'} successfully`,
                user: customer
            });

        } catch (error) {
            console.error('Toggle block customer error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Server error while toggling customer block status'
            });
        }
    }

    static async deleteCustomer(req, res) {
        try {
            const customerId = req.params.id;

            const customer = await User.findOneAndDelete({ _id: customerId, role: 'customer' });
            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Customer not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Customer deleted successfully'
            });

        } catch (error) {
            console.error('Delete customer error:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Server error while deleting customer'
            });
        }
    }

    static async approveProvider(req, res) {
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

                provider.bankDetails = provider.bankDetails || {};
                provider.bankDetails.verified = true;
                provider.bankDetails.bankVerificationStatus = 'verified';
                provider.bankDetails.payoutEnabled = true;
                provider.bankDetails.bankVerifiedAt = new Date();
                provider.bankDetails.bankVerifiedBy = req.admin?._id || null;
                provider.bankDetails.bankRejectReason = null;

                const approvedHistory = Array.isArray(provider.bankDetails.verificationHistory)
                    ? provider.bankDetails.verificationHistory
                    : [];
                provider.bankDetails.verificationHistory = [
                    ...approvedHistory,
                    {
                        status: 'verified',
                        timestamp: new Date(),
                        updatedBy: 'admin',
                        verifiedBy: req.admin?._id || null,
                        reason: finalRemarks || 'Bank verified by Admin'
                    }
                ];

                provider.rejectionReason = ''; // Clear backup/rejection details
                await provider.save();

                // Send notification
                try {
                    sendNotification(
                        provider._id,
                        'provider',
                        'Bank Details Verified',
                        `Your bank details have been verified and approved. Payouts are now enabled. ${finalRemarks ? '\nRemarks: ' + finalRemarks : ''}`,
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
                        verified: true,
                        bankVerificationStatus: 'verified',
                        payoutEnabled: true
                    };
                } else {
                    provider.bankDetails = provider.bankDetails || {};
                    provider.bankDetails.verified = false;
                    provider.bankDetails.bankVerificationStatus = 'rejected';
                    provider.bankDetails.payoutEnabled = false;
                    provider.bankDetails.bankRejectReason = finalRemarks || 'Bank details rejected by Admin';
                }

                const rejectedHistory = Array.isArray(provider.bankDetails?.verificationHistory)
                    ? provider.bankDetails.verificationHistory
                    : [];
                provider.bankDetails.verificationHistory = [
                    ...rejectedHistory,
                    {
                        status: 'rejected',
                        timestamp: new Date(),
                        updatedBy: 'admin',
                        verifiedBy: req.admin?._id || null,
                        reason: finalRemarks || 'Bank details rejected by Admin'
                    }
                ];

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
                provider.rejectionReason = '';
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
                    const { triggerEventNotification } = require('../notification/notification-helper');
                    await triggerEventNotification('provider_verification_approved', {
                        remarks: finalRemarks || '',
                        provider
                    }, provider._id);
                } catch (fcmError) {
                    console.error('Failed to send activation notification:', fcmError);
                }

                try {
                    // Generate and upload Approval Letter PDF
                    const { generateApprovalLetter, generateAgreement, uploadPdfBuffer } = require('../booking/agreement-generator');
                    const approvalPdfBuffer = await generateApprovalLetter(provider, finalRemarks);
                    if (provider.approvalLetterPublicId) {
                        await deleteFile(provider.approvalLetterPublicId);
                    }
                    const approvalPdfUpload = await uploadPdfBuffer(approvalPdfBuffer, 'provider_approval_letters', `approval_${provider._id}`);
                    provider.approvalLetterUrl = approvalPdfUpload.secure_url;
                    provider.approvalLetterPublicId = approvalPdfUpload.public_id;

                    // Generate and upload Agreement PDF
                    const agreementPdfBuffer = await generateAgreement(provider);
                    if (provider.agreementPdfPublicId) {
                        await deleteFile(provider.agreementPdfPublicId);
                    }
                    const agreementPdfUpload = await uploadPdfBuffer(agreementPdfBuffer, 'provider_agreements', `agreement_${provider._id}`);
                    provider.agreementPdfUrl = agreementPdfUpload.secure_url;
                    provider.agreementPdfPublicId = agreementPdfUpload.public_id;

                    await provider.save();

                    await sendMail({
                        to: provider.email,
                        templateType: 'providerApproval',
                        variables: {
                            name: provider.name,
                            providerName: provider.providerId,
                            reason: finalRemarks,
                            email: `${process.env.FRONTEND_URL}/login`,
                            agreementPdfUrl: provider.agreementPdfUrl,
                            approvalLetterUrl: provider.approvalLetterUrl
                        },
                        attachments: [
                            {
                                content: approvalPdfBuffer.toString('base64'),
                                name: `Approval_Letter_${provider.providerId || provider._id}.pdf`
                            },
                            {
                                content: agreementPdfBuffer.toString('base64'),
                                name: `Service_Agreement_${provider.providerId || provider._id}.pdf`
                            }
                        ]
                    });
                } catch (mailError) {
                    console.error('Failed to send approval email/PDF:', mailError);
                }

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
                    const { triggerEventNotification } = require('../notification/notification-helper');
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
                if (!finalRemarks) {
                    return res.status(400).json({ success: false, message: 'Remarks/Reason is required to restrict the provider account.' });
                }
                if (!provider.performanceScore) {
                    provider.performanceScore = {};
                }
                provider.performanceScore.restrictionsActive = true;
                provider.performanceScore.restrictionReason = finalRemarks;
                provider.performanceScore.restrictedUntil = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : null;

                if (global.logger) global.logger.warn(`Provider manually restricted by Admin: ${provider._id}. Duration: ${durationDays || 'Indefinite'} days.`);

                await provider.save();

                try {
                    sendNotification(
                        provider._id,
                        'provider',
                        'Account Restricted ⚠️',
                        `Your provider account has been restricted. Reason: ${provider.performanceScore.restrictionReason}`,
                        'system',
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
                if (!finalRemarks) {
                    return res.status(400).json({ success: false, message: 'Remarks/Reason is required to suspend the provider account.' });
                }
                provider.isSuspended = true;
                provider.suspensionReason = finalRemarks;

                if (global.logger) global.logger.warn(`Provider manually suspended by Admin: ${provider._id}`);

                await provider.save();

                try {
                    sendNotification(
                        provider._id,
                        'provider',
                        'Account Suspended 🚫',
                        `Your account has been suspended. Reason: ${provider.suspensionReason}`,
                        'system',
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
                if (!finalRemarks) {
                    return res.status(400).json({ success: false, message: 'Remarks/Reason is required to block the provider account.' });
                }
                provider.blockedTill = durationDays ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000);
                provider.isActive = false;
                provider.rejectionReason = finalRemarks;

                if (global.logger) global.logger.warn(`Provider manually blocked by Admin: ${provider._id}. Duration: ${durationDays || 'Permanent'}`);

                await provider.save();

                try {
                    sendNotification(
                        provider._id,
                        'provider',
                        'Account Blocked ❌',
                        `Your account has been blocked by the administrator. Reason: ${finalRemarks}`,
                        'system',
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
    }

    static async getPendingProviders(req, res) {
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

            const statsFilter = {
                isDeleted: false,
                $or: [
                    { approved: false },
                    { approved: true, 'bankDetails.verified': false, 'bankDetails.accountNo': { $exists: true, $ne: '' } }
                ]
            };
            if (search) {
                statsFilter.$and = [
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
                statsFilter.createdAt = dateFilter;
            }

            const [providers, total, statsProviders] = await Promise.all([
                Provider.aggregate(providersPipeline),
                Provider.countDocuments(filter),
                Provider.find(statsFilter, {
                    approved: 1,
                    kycStatus: 1,
                    createdAt: 1,
                    registrationDate: 1,
                    approvalDate: 1,
                    aadhaarFront: 1,
                    aadhaarBack: 1,
                    panCard: 1,
                    liveSelfie: 1,
                    profileComplete: 1,
                    testPassed: 1,
                    'bankDetails.verified': 1,
                    'bankDetails.accountNo': 1
                }).lean()
            ]);

            // Compute stats
            const totalPendingAndBankPending = statsProviders.length;
            const pendingCount = statsProviders.filter(p => !p.approved).length;
            const bankPendingCount = statsProviders.filter(p => p.approved && p.bankDetails?.accountNo && !p.bankDetails?.verified).length;

            const today = new Date().toISOString().split('T')[0];
            const todayRegistered = statsProviders.filter(p => {
                const regDate = new Date(p.registrationDate || p.createdAt).toISOString().split('T')[0];
                return regDate === today;
            }).length;

            const todayApproved = statsProviders.filter(p => {
                if (p.approved && p.approvalDate) {
                    const approvalDate = new Date(p.approvalDate).toISOString().split('T')[0];
                    return approvalDate === today;
                }
                return false;
            }).length;

            const withResume = statsProviders.filter(p => p.aadhaarFront && p.aadhaarBack && p.panCard && p.liveSelfie).length;
            const withBankDetails = statsProviders.filter(p => p.bankDetails?.accountNo).length;
            const profileComplete = statsProviders.filter(p => p.profileComplete).length;
            const testPassed = statsProviders.filter(p => p.testPassed).length;

            // Avg days pending
            let totalDays = 0;
            statsProviders.forEach(p => {
                const created = new Date(p.createdAt);
                const now = new Date();
                const diffTime = Math.abs(now - created);
                totalDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            });
            const avgDaysPending = totalPendingAndBankPending > 0 ? Math.round(totalDays / totalPendingAndBankPending) : 0;

            const stats = {
                totalProviders: totalPendingAndBankPending,
                pendingApproval: pendingCount,
                todayRegistered,
                todayApproved,
                withResume,
                withBankDetails,
                profileComplete,
                testPassed,
                avgDaysPending
            };

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

                provider.performanceBadge = provider.performanceScore?.badge || 'bronze';
                provider.completionRate = provider.performanceScore?.completionPercentage || 0;
                provider.onTimeRate = provider.performanceScore?.onTimePercentage || 0;
            });

            res.status(200).json({
                success: true,
                count: providers.length,
                total,
                page,
                pages: Math.ceil(total / limit),
                pendingCount,
                bankPendingCount,
                stats,
                providers
            });
        } catch (error) {
            console.error('Get pending providers error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error while fetching pending providers'
            });
        }
    }

    static async getAllProviders(req, res) {
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

                provider.performanceBadge = provider.performanceScore?.badge || 'bronze';
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
    }

    static async getProviderDetails(req, res) {
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

            // Populate bank verified by admins for audit log
            await Provider.populate(provider, [
                { path: 'bankDetails.bankVerifiedBy', select: 'name email' },
                { path: 'bankDetails.verificationHistory.verifiedBy', select: 'name email' }
            ]);

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

            provider.performanceBadge = provider.performanceScore?.badge || 'bronze';
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
    }

    static async getDashboardStats(req, res) {
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
                            totalProviders: precomputed.totalProviders || 0,
                            totalBookings: precomputed.totalBookings,
                            todayBookings: precomputed.todayBookings,
                            pendingProviders: precomputed.pendingProviders || 0,
                            grossRevenue: precomputed.grossRevenue || 0,
                            monthlyRevenue: precomputed.monthlyRevenue || 0,
                            totalRevenue: precomputed.totalRevenue || 0,
                            netRevenue: precomputed.netRevenue || 0,
                            netEarnings: precomputed.netEarnings || 0,
                            platformFeeRevenue: precomputed.platformFeeRevenue || 0,
                            providerEarnings: precomputed.providerEarnings || 0,
                            refundAmount: precomputed.refundAmount || 0,
                            surgeRevenue: precomputed.surgeRevenue || 0,
                            surgeBreakdown: precomputed.surgeBreakdown || {},
                            surgeSplits: precomputed.surgeSplits || {},
                            totalWithdrawals: precomputed.totalWithdrawals || 0,
                            withdrawalCount: precomputed.withdrawalCount || 0,
                            totalHeldPayouts: precomputed.totalHeldPayouts || 0,
                            heldPayoutsCount: precomputed.heldPayoutsCount || 0,
                            totalAdminEarnings: precomputed.totalAdminEarnings || 0,
                            complaintCounts: precomputed.complaintCounts || {},
                            lastRefreshed: precomputed.lastRefreshed
                        },
                        paymentMethods: precomputed.paymentMethods || [],
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
                    { $match: { paymentStatus: { $in: ['completed', 'paid', 'success'] } } },
                    { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
                    { $project: { paymentMethod: '$_id', count: 1, totalAmount: 1, _id: 0 } }
                ]),
                Transaction.aggregate([
                    { $match: { type: 'withdrawal', paymentStatus: { $in: ['completed', 'paid', 'success'] } } },
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
                    { $match: { type: 'refund', paymentMethod: 'wallet', paymentStatus: { $in: ['completed', 'paid', 'success'] } } },
                    { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
                ]),
                Booking.countDocuments({ $or: [{ paymentStatus: 'refunded' }, { refundProcessed: true }] }),
                Booking.countDocuments({ disputeStatus: 'underreview' }),
                Booking.countDocuments({ disputeStatus: 'resolved' }),
                Booking.countDocuments({ disputeStatus: 'refundapproved' })
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

            const surgeRevenue = visitingRevenue + rainRevenue + trafficRevenue + nightRevenue + demandRevenue + customRevenue;

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
    }

    static async getDashboardSummary(req, res) {
        try {
            const { city, serviceCategory, zoneIds } = req.query;
            const today = moment().startOf('day');
            const currentMonth = moment().startOf('month');

            // Build match conditions for bookings
            let bookingMatchConditions = {};
            if (city) {
                bookingMatchConditions['address.city'] = { $regex: city, $options: 'i' };
            }
            if (zoneIds) {
                const zoneIdArray = zoneIds.split(',').filter(Boolean);
                if (zoneIdArray.length > 0) {
                    bookingMatchConditions.zoneId = { $in: zoneIdArray.map(id => new mongoose.Types.ObjectId(id)) };
                }
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
                                $cond: [{ $in: ["$status", ["accepted", "ontheway", "arrived", "workstarted"]] }, 1, 0]
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
    }

    static async getDashboardRevenue(req, res) {
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
    }

    static async getDashboardBookingsStatus(req, res) {
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
    }

    static async getDashboardTopProviders(req, res) {
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
    }

    static async getDashboardPendingActions(req, res) {
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
                Booking.countDocuments({ 'cancellationProgress.status': 'processingrefund' })
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
    }

    static async getDashboardLiveStats(req, res) {
        try {
            const [
                ongoingBookings,
                activeProviders,
                delayedBookings
            ] = await Promise.all([
                Booking.countDocuments({ status: { $in: ['accepted', 'ontheway', 'arrived', 'workstarted'] } }),
                Provider.countDocuments({ approved: true, isActive: true, blockedTill: { $lte: new Date() } }),
                Booking.countDocuments({ status: 'accepted', date: { $lt: moment().subtract(1, 'hours').toDate() } })
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
    }

    static async getDashboardRecentActivity(req, res) {
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
    }

    static async getDashboardAnalytics(req, res) {
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
                    const parsedStart = new Date(req.query.startDate);
                    if (!isNaN(parsedStart.getTime())) {
                        matchStage.createdAt.$gte = parsedStart;
                    }
                }
                if (req.query.endDate) {
                    const parsedEnd = new Date(req.query.endDate);
                    if (!isNaN(parsedEnd.getTime())) {
                        parsedEnd.setHours(23, 59, 59, 999);
                        matchStage.createdAt.$lte = parsedEnd;
                    }
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
                                { $match: { status: { $in: ['completed', 'Completed'] } } },
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
                                { $match: { status: { $in: ['completed', 'Completed'] } } },
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
                                { $match: { status: { $in: ['cancelled', 'Cancelled'] } } },
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
                    { $match: { ...matchStage, status: { $in: ['completed', 'Completed'] } } },
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
                                { $match: { role: 'customer', createdAt: matchStage.createdAt || { $gte: startDate } } },
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
                (() => {
                    const { Referral } = require('../referral/referral-model');
                    return Promise.all([
                        Booking.find().sort({ createdAt: -1 }).limit(10).populate('customer', 'name').populate('provider', 'name').select('customer provider createdAt totalAmount status').lean(),
                        Booking.find({ status: 'completed' }).sort({ serviceCompletedAt: -1 }).limit(5).populate('customer', 'name').populate('provider', 'name').select('customer provider serviceCompletedAt createdAt totalAmount').lean(),
                        User.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(5).select('name createdAt').lean(),
                        Referral.find().sort({ createdAt: -1 }).limit(5).populate('referrer', 'name').populate('referredUser', 'name').lean()
                    ]);
                })()
            ]);

            const stats = bookingStatsAgg[0];
            const [pendingProviders, pendingWithdrawals, pendingDisputes, activeProvidersCount] = pendingCounts;
            const [recentBookings, recentlyCompleted, latestUsers, recentReferrals] = activityData;

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
                })),
                ...recentReferrals.map(r => ({
                    type: 'referral',
                    message: `${r.referrer?.name || 'User'} referred ${r.referredUser?.name || 'Friend'}`,
                    timestamp: r.createdAt,
                    status: r.status
                }))
            ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 15);

            const totalBookings = stats?.statusDistribution ? stats.statusDistribution.reduce((acc, curr) => acc + curr.count, 0) : 0;
            const completedCount = stats?.statusDistribution ? stats.statusDistribution.filter(s => ['completed'].includes((s._id || '').toLowerCase())).reduce((acc, curr) => acc + curr.count, 0) : (stats?.revenueOverview?.[0]?.completedCount || 0);
            const cancelledCount = stats?.statusDistribution ? stats.statusDistribution.filter(s => ['cancelled'].includes((s._id || '').toLowerCase())).reduce((acc, curr) => acc + curr.count, 0) : 0;
            const inProgressCount = stats?.statusDistribution ? stats.statusDistribution.filter(s => ['accepted', 'ontheway', 'arrived', 'workstarted'].includes((s._id || '').toLowerCase())).reduce((acc, curr) => acc + curr.count, 0) : 0;
            const pendingCount = stats?.statusDistribution ? stats.statusDistribution.filter(s => ['pending', 'searchingprovider', 'offered'].includes((s._id || '').toLowerCase())).reduce((acc, curr) => acc + curr.count, 0) : 0;

            // Rebook and Favorite Provider Analytics
            const [totalRebooks, topRepeatedServices, mostFavoritedProviders, repeatCustomerCount, totalFavBookings, unassignedBookingsByZone] = await Promise.all([
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
                Booking.countDocuments({ isFavoriteProviderBooking: true }),
                Booking.aggregate([
                    { $match: { provider: null, status: { $in: ['Pending', 'pending', 'SearchingProvider', 'Offered', 'Assigned'] } } },
                    {
                        $group: {
                            _id: "$zoneId",
                            count: { $sum: 1 }
                        }
                    },
                    {
                        $lookup: {
                            from: 'zones',
                            localField: '_id',
                            foreignField: '_id',
                            as: 'zoneInfo'
                        }
                    },
                    { $unwind: { path: "$zoneInfo", preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            zoneName: { $ifNull: ["$zoneInfo.name", "Unknown Zone"] },
                            count: 1
                        }
                    }
                ])
            ]);

            const repeatBookingRate = totalBookings > 0 ? ((totalRebooks / totalBookings) * 100).toFixed(1) : 0;
            const providerRetentionScore = totalBookings > 0 ? ((totalFavBookings / totalBookings) * 100).toFixed(1) : 0;
            const finalRepeatCustomerCount = repeatCustomerCount[0]?.count || 0;

            const result = {
                bookingStats: {
                    total: totalBookings,
                    completed: completedCount,
                    cancelled: cancelledCount,
                    inProgress: inProgressCount,
                    pending: pendingCount,
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
                },
                unassignedBookingsByZone: unassignedBookingsByZone || []
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
    }

    static async processAdminRefund(req, res) {
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
                const allowedStatuses = ['held', 'underreview', 'pendingrelease', 'available', 'paid', 'withdrawn', 'cancelled'];
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

            // Commit preliminary checks and invoke Centralized Refund Engine
            await safeCommit(session);
            safeEnd(session);

            const RefundEngineService = require('../payment/refund-engine-service');
            const refundResult = await RefundEngineService.processRefundRequest({
                bookingId: booking._id,
                refundSource: 'admin_cancellation',
                refundAmount: refundAmount,
                refundReason: reason || `Admin approved ${type} refund`,
                cancellationReason: reason,
                requestedBy: req.admin?._id,
                approvedBy: req.admin?._id,
                complaintId: booking.complaint?._id || booking.complaint || null,
            });

            return res.status(200).json({
                success: true,
                message: `Refund of ₹${refundAmount} processed successfully. Ledger updated.`,
                data: refundResult.refund,
            });

        } catch (error) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
            console.error('Process refund error:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    }

    static async getAllRefunds(req, res) {
        try {
            const { status, source, destination, refundType, paymentMethod, fromDate, toDate, search, page = 1, limit = 20 } = req.query;
            const Refund = require('../payment/refund-model');
            const User = require('../user/user-model');

            const filter = {};
            if (status && status !== 'all') filter.refundStatus = status;
            if (source && source !== 'all') filter.refundSource = source;
            if (destination && destination !== 'all') filter.refundDestination = destination;
            if (refundType && refundType !== 'all') filter.refundType = refundType;
            if (paymentMethod && paymentMethod !== 'all') filter.originalPaymentMethod = paymentMethod;

            if (fromDate || toDate) {
                filter.createdAt = {};
                if (fromDate) filter.createdAt.$gte = new Date(fromDate);
                if (toDate) filter.createdAt.$lte = new Date(toDate);
            }

            if (search && search.trim()) {
                const searchRegex = new RegExp(search.trim(), 'i');
                const matchingUsers = await User.find({
                    $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }]
                }).select('_id');
                const userIds = matchingUsers.map(u => u._id);

                filter.$or = [
                    { refundId: searchRegex },
                    { gatewayRefundId: searchRegex },
                    { walletTransactionId: searchRegex },
                    { refundReason: searchRegex },
                    { cancellationReason: searchRegex },
                    { customerId: { $in: userIds } },
                    { providerId: { $in: userIds } }
                ];
            }

            const skip = (Number(page) - 1) * Number(limit);

            const [refunds, total, kpiStats] = await Promise.all([
                Refund.find(filter)
                    .populate('customerId', 'name email phone avatar')
                    .populate('providerId', 'name email phone avatar')
                    .populate({
                        path: 'bookingId',
                        select: 'bookingId status totalAmount paymentMethod walletUsed onlinePaid customer provider cancellationProgress'
                    })
                    .populate('approvedBy', 'name email')
                    .populate('requestedBy', 'name email')
                    .populate('processedBy', 'name email')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(Number(limit)),
                Refund.countDocuments(filter),
                Refund.aggregate([
                    {
                        $group: {
                            _id: null,
                            totalRefundAmount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'completed'] }, '$refundAmount', 0] } },
                            pendingAmount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'pending'] }, '$refundAmount', 0] } },
                            gatewayRefundAmount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'completed'] }, '$gatewayRefundAmount', 0] } },
                            walletRefundAmount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'completed'] }, '$walletRefundAmount', 0] } },
                            pendingCount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'pending'] }, 1, 0] } },
                            approvedCount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'approved'] }, 1, 0] } },
                            completedCount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'completed'] }, 1, 0] } },
                            failedCount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'failed'] }, 1, 0] } },
                            rejectedCount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'rejected'] }, 1, 0] } },
                            autoCount: { $sum: { $cond: [{ $eq: ['$refundType', 'auto'] }, 1, 0] } },
                            manualCount: { $sum: { $cond: [{ $eq: ['$refundType', 'manual'] }, 1, 0] } }
                        }
                    }
                ])
            ]);

            const stats = kpiStats.length > 0 ? kpiStats[0] : {
                totalRefundAmount: 0,
                pendingAmount: 0,
                gatewayRefundAmount: 0,
                walletRefundAmount: 0,
                pendingCount: 0,
                approvedCount: 0,
                completedCount: 0,
                failedCount: 0,
                rejectedCount: 0,
                autoCount: 0,
                manualCount: 0
            };

            return res.status(200).json({
                success: true,
                data: refunds,
                stats,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit)),
                },
            });
        } catch (error) {
            console.error('[AdminService.getAllRefunds] Error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    static async getRefundById(req, res) {
        try {
            const { id } = req.params;
            const Refund = require('../payment/refund-model');

            const refund = await Refund.findById(id)
                .populate('customerId', 'name email phone avatar wallet')
                .populate('providerId', 'name email phone avatar')
                .populate('bookingId')
                .populate('approvedBy', 'name email')
                .populate('requestedBy', 'name email')
                .populate('processedBy', 'name email')
                .populate('transactionId')
                .populate('complaintId')
                .populate('paymentRecordId');

            if (!refund) {
                return res.status(404).json({ success: false, message: 'Refund record not found' });
            }

            return res.status(200).json({ success: true, data: refund });
        } catch (error) {
            console.error('[AdminService.getRefundById] Error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    static async createManualRefund(req, res) {
        try {
            const { bookingId, amount, reason, refundType = 'manual', refundSource = 'manual_refund', refundDestination = 'wallet', customerChoice, notes } = req.body;
            const Booking = require('../booking/booking-model');
            const RefundEngineService = require('../payment/refund-engine-service');

            if (!bookingId) {
                return res.status(400).json({ success: false, message: 'Booking ID is required for manual refund creation.' });
            }

            const booking = await Booking.findById(bookingId).populate('customer provider');
            if (!booking) {
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }

            const adminId = req.user?._id || req.admin?._id;

            const refundResult = await RefundEngineService.processRefundRequest({
                bookingId: booking._id,
                refundSource,
                refundDestination,
                customerChoice: customerChoice || (refundDestination === 'original_payment' ? 'original_payment' : 'wallet'),
                refundAmount: amount ? Number(amount) : undefined,
                cancellationReason: reason || notes || 'Manual Admin Refund Action',
                refundReason: reason || notes || 'Manual Admin Refund Action',
                requestedBy: adminId,
                approvedBy: adminId,
                isAutoTrigger: false,
                ip: req.ip || '',
            });

            return res.status(200).json({
                success: true,
                message: refundResult.message || 'Manual refund request created successfully.',
                data: refundResult.refund,
            });
        } catch (error) {
            console.error('[AdminService.createManualRefund] Error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    static async approveRefundById(req, res) {
        try {
            const { id } = req.params;
            const Refund = require('../payment/refund-model');
            const Booking = require('../booking/booking-model');
            const RefundEngineService = require('../payment/refund-engine-service');

            const adminId = req.user?._id || req.admin?._id;
            const isAdmin = req.user?.role === 'admin' || req.admin?.role === 'admin';
            if (!adminId || !isAdmin) {
                return res.status(403).json({ success: false, message: 'Unauthorized. Admin authentication required.' });
            }

            // Atomic pending -> approved transition (eliminates concurrent double-approval on same refund record)
            const refund = await Refund.findOneAndUpdate(
                { _id: id, refundStatus: 'pending' },
                {
                    $set: {
                        refundStatus: 'approved',
                        approvedBy: adminId,
                        approvedAt: new Date(),
                    },
                    $push: {
                        timeline: {
                            status: 'approved',
                            actor: 'Admin',
                            notes: 'Refund manually approved by admin',
                            timestamp: new Date(),
                        },
                        auditLogs: {
                            action: 'REFUND_APPROVED',
                            performedBy: adminId,
                            userRole: 'admin',
                            details: { refundId: id },
                            ip: req.ip || '',
                            timestamp: new Date(),
                        },
                    },
                },
                { new: true }
            );

            if (!refund) {
                const existingRefund = await Refund.findById(id);
                if (!existingRefund) {
                    return res.status(404).json({ success: false, message: 'Refund record not found.' });
                }

                if (existingRefund.refundStatus === 'completed') {
                    return res.status(200).json({ success: true, alreadyCompleted: true, message: 'Refund is already completed.', data: existingRefund });
                }

                if (existingRefund.refundStatus === 'rejected') {
                    return res.status(400).json({ success: false, message: 'Rejected refunds cannot be approved.' });
                }

                if (existingRefund.refundStatus === 'processing') {
                    const booking = await Booking.findById(existingRefund.bookingId);
                    const settings = await RefundEngineService.getRefundSettings();
                    const result = await RefundEngineService.executeRefundPayout(existingRefund, booking, settings, req.ip || '');
                    return res.status(200).json({
                        success: result.success,
                        message: result.message || 'Refund processing recovery checked.',
                        data: result.refund,
                    });
                }

                if (existingRefund.refundStatus === 'approved') {
                    const booking = await Booking.findById(existingRefund.bookingId);
                    const settings = await RefundEngineService.getRefundSettings();
                    const result = await RefundEngineService.executeRefundPayout(existingRefund, booking, settings, req.ip || '');
                    return res.status(200).json({
                        success: result.success,
                        message: result.message || 'Refund payout executed.',
                        data: result.refund,
                    });
                }

                return res.status(400).json({ success: false, message: `Refund cannot be approved from status '${existingRefund.refundStatus}'.` });
            }

            const booking = await Booking.findById(refund.bookingId);
            if (!booking) {
                return res.status(404).json({ success: false, message: 'Associated booking not found.' });
            }

            const settings = await RefundEngineService.getRefundSettings();
            const result = await RefundEngineService.executeRefundPayout(refund, booking, settings, req.ip || '');

            return res.status(200).json({
                success: result.success,
                message: result.message || (result.success ? 'Refund approved and executed successfully.' : 'Refund approved but payout execution failed.'),
                data: result.refund,
            });
        } catch (error) {
            console.error('[AdminService.approveRefundById] Error:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    static async rejectRefundById(req, res) {
        let session = null;
        let useTransaction = false;
        try {
            if (mongoose.connection?.client?.topology?.description?.type !== 'Single' && mongoose.connection?.replicaSet) {
                session = await mongoose.startSession();
                session.startTransaction();
                useTransaction = true;
            }
        } catch (sErr) {
            session = null;
            useTransaction = false;
        }

        try {
            const idParam = req.params.id || req.params.bookingId;
            const { reason = 'Rejected by Admin' } = req.body;
            const Refund = require('../payment/refund-model');
            const Booking = require('../booking/booking-model');
            const Complaint = require('../complaint/complaint-model');
            const ProviderEarning = require('../provider/provider-earning-model');

            const sessOpt = useTransaction && session ? { session } : {};

            let refundDoc = useTransaction && session ? await Refund.findById(idParam).session(session) : await Refund.findById(idParam);
            let bookingId = null;

            if (refundDoc) {
                if (refundDoc.refundStatus === 'completed') {
                    if (useTransaction && session) await session.abortTransaction();
                    if (session) session.endSession();
                    return res.status(400).json({ success: false, message: 'Completed refunds cannot be rejected.' });
                }

                const adminId = req.user?._id || req.admin?._id;
                refundDoc.refundStatus = 'rejected';
                refundDoc.failureReason = reason;
                refundDoc.addTimelineStep('rejected', 'Admin', reason);
                refundDoc.addAuditLog('REFUND_REJECTED', adminId, 'admin', { reason }, req.ip || '');
                await refundDoc.save(sessOpt);
                bookingId = refundDoc.bookingId;
            } else {
                bookingId = idParam;
                const pendingRefund = useTransaction && session
                    ? await Refund.findOne({ bookingId, refundStatus: { $in: ['pending', 'approved', 'draft'] } }).session(session)
                    : await Refund.findOne({ bookingId, refundStatus: { $in: ['pending', 'approved', 'draft'] } });

                if (pendingRefund) {
                    const adminId = req.user?._id || req.admin?._id;
                    pendingRefund.refundStatus = 'rejected';
                    pendingRefund.failureReason = reason;
                    pendingRefund.addTimelineStep('rejected', 'Admin', reason);
                    pendingRefund.addAuditLog('REFUND_REJECTED', adminId, 'admin', { reason }, req.ip || '');
                    await pendingRefund.save(sessOpt);
                    refundDoc = pendingRefund;
                }
            }

            const booking = useTransaction && session ? await Booking.findById(bookingId).session(session) : await Booking.findById(bookingId);
            if (!booking) {
                if (useTransaction && session) await session.abortTransaction();
                if (session) session.endSession();
                return res.status(404).json({ success: false, message: 'Booking not found.' });
            }

            // ── 1. BOOKING UPDATE ──
            booking.status = 'completed';
            booking.disputeStatus = 'resolved';
            booking.adminRefundDecision = 'rejected';
            booking.adminRemark = reason || 'Admin resolved without refund';
            if (booking.cancellationProgress) {
                booking.cancellationProgress.refundStatus = 'rejected';
            }

            if (!booking.complaintProofs) booking.complaintProofs = [];
            booking.complaintProofs.push({
                uploadedBy: 'admin',
                message: `Dispute resolved without refund. Admin Comment: ${reason}`,
                createdAt: new Date()
            });

            if (!booking.statusHistory) booking.statusHistory = [];
            booking.statusHistory.push({
                status: 'completed',
                note: `Dispute resolved without refund. Admin Comment: ${reason}`,
                updatedBy: 'admin',
                timestamp: new Date()
            });

            await booking.save(sessOpt);

            // ── 2. COMPLAINT UPDATE ──
            let complaintObj = null;
            if (booking.complaint) {
                complaintObj = useTransaction && session
                    ? await Complaint.findById(booking.complaint._id || booking.complaint).session(session)
                    : await Complaint.findById(booking.complaint._id || booking.complaint);
            } else {
                complaintObj = useTransaction && session
                    ? await Complaint.findOne({ booking: booking._id }).session(session)
                    : await Complaint.findOne({ booking: booking._id });
            }

            if (complaintObj) {
                complaintObj.status = 'resolved';
                complaintObj.resolvedAt = new Date();
                complaintObj.resolutionNotes = reason || 'Dispute resolved without refund';
                complaintObj.resolvedBy = req.user?._id || req.admin?._id;
                if (!complaintObj.statusHistory) complaintObj.statusHistory = [];
                complaintObj.statusHistory.push({ status: 'resolved', updatedAt: new Date() });
                await complaintObj.save(sessOpt);
            }

            // ── 3. EARNINGS RELEASE ──
            if (ProviderEarning) {
                const earning = useTransaction && session
                    ? await ProviderEarning.findOne({ booking: booking._id }).session(session)
                    : await ProviderEarning.findOne({ booking: booking._id });

                if (earning && (earning.status === 'held' || earning.status === 'underreview')) {
                    earning.status = 'available';
                    await earning.save(sessOpt);
                }
            }

            if (useTransaction && session) {
                await session.commitTransaction();
                session.endSession();
            } else if (session) {
                session.endSession();
            }

            return res.status(200).json({
                success: true,
                message: 'Refund request rejected and dispute resolved without refund.',
                data: refundDoc || { bookingId: booking._id },
            });
        } catch (error) {
            if (useTransaction && session && session.inTransaction()) {
                await session.abortTransaction();
            }
            if (session) session.endSession();
            console.error('Reject refund error:', error);
            return res.status(400).json({ success: false, message: error.message });
        }
    }

    static async rejectAdminRefund(req, res) {
        return this.rejectRefundById(req, res);
    }

    static async togglePayoutHold(req, res) {
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
    }

    static async getSameIPFraud(req, res) {
        try {
            const FraudLog = require('../fraud/fraud-log-model');
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

    static async getDeviceAbuse(req, res) {
        try {
            const FraudLog = require('../fraud/fraud-log-model');
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

    static async getCancellationAlerts(req, res) {
        try {
            const FraudLog = require('../fraud/fraud-log-model');
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

    static async markFraudLogSafe(req, res) {
        try {
            const FraudLog = require('../fraud/fraud-log-model');
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

    static async addFraudLogNote(req, res) {
        try {
            const FraudLog = require('../fraud/fraud-log-model');
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

    static async suspendUserAccount(req, res) {
        try {
            const FraudLog = require('../fraud/fraud-log-model');
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

    static async getSystemLogs(req, res) {
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.resolve(__dirname, '../../logs/combined.log');
            const fallbackPath = path.resolve(process.cwd(), 'logs/combined.log');
            const targetPath = fs.existsSync(logPath) ? logPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);
            if (!targetPath) return res.json({ success: true, logs: [], total: 0 });

            const { level, page = 1, limit = 50 } = req.query;
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 50;
            const targetLevel = level && level !== 'ALL' ? level.toUpperCase() : null;

            const fileHandle = await fs.promises.open(targetPath, 'r');
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
    }

    static async getActiveSessions(req, res) {
        try {
            const { role = 'customer', page = 1, limit = 20 } = req.query;
            const Model = role === 'provider' ? require('../provider/provider-model') : require('../user/user-model');

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
    }

    static async forceLogoutUser(req, res) {
        try {
            const { userId, role, deviceId } = req.body;
            if (!userId || !role) {
                return res.status(400).json({ success: false, message: 'User ID and role are required' });
            }

            const Model = role === 'provider' ? require('../provider/provider-model') : require('../user/user-model');
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
    }

    static async getProviderAgreementPdf(req, res) {
        try {
            const provider = await Provider.findById(req.params.id);
            if (!provider) {
                return res.status(404).json({ success: false, message: 'Provider not found' });
            }

            if (!provider.legalAcceptance || !provider.legalAcceptance.agreementAccepted) {
                return res.status(400).json({ success: false, message: 'Agreement PDF not generated yet' });
            }

            const { generateAgreement } = require('../booking/agreement-generator');
            const pdfBuffer = await generateAgreement(provider);

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="agreement_${provider._id}.pdf"`,
                'Content-Length': pdfBuffer.length
            });
            return res.send(pdfBuffer);
        } catch (error) {
            console.error('Admin get agreement PDF error:', error);
            res.status(500).json({ success: false, message: 'Server error while fetching agreement PDF' });
        }
    }

    static async getProviderApprovalLetter(req, res) {
        try {
            const provider = await Provider.findById(req.params.id);
            if (!provider) {
                return res.status(404).json({ success: false, message: 'Provider not found' });
            }

            if (!provider.approved) {
                return res.status(400).json({ success: false, message: 'Approval letter PDF not generated yet (provider not approved)' });
            }

            const { generateApprovalLetter } = require('../booking/agreement-generator');
            const pdfBuffer = await generateApprovalLetter(provider, provider.rejectionReason || '');

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="approval_letter_${provider._id}.pdf"`,
                'Content-Length': pdfBuffer.length
            });
            return res.send(pdfBuffer);
        } catch (error) {
            console.error('Admin get approval letter PDF error:', error);
            res.status(500).json({ success: false, message: 'Server error while fetching approval letter PDF' });
        }
    }

}

module.exports = AdminService;

