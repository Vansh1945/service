const Provider = require('../models/Provider-model');
const ProviderEarning = require('../models/ProviderEarning-model');
const PaymentRecord = require('../models/PaymentRecord-model');
const { sendOTP, verifyOTP, clearOTP } = require('../utils/otpSend');
const { uploadProfilePic, uploadResume, uploadPassbookImg } = require('../middlewares/upload');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../services/cloudinary');
const mongoose = require('mongoose');
const Booking = require('../models/Booking-model');
const Feedback = require('../models/Feedback-model');
const Complaint = require('../models/Complaint-model');
const User = require('../models/User-model');
const Admin = require('../models/Admin-model');
const { latLngToS2CellId } = require('../utils/s2Helper');
const Zone = require('../models/Zone-model');

// Helper to get synchronized payout status
const getPayoutStatus = (earning, booking) => {
    if (!earning) return 'Not Processed';
    if (booking.disputeRaised || booking.disputeStatus === 'under_review') return 'Dispute Hold';

    switch (earning.status) {
        case 'held': return 'Payout On Hold';
        case 'available': return 'Payout Ready';
        case 'paid':
        case 'withdrawn': return 'Payout Released';
        case 'cancelled': return 'Refund Adjusted';
        default: return earning.status;
    }
};

// Helper function to delete file from Cloudinary
const deleteFile = async (publicId) => {
    try {
        if (publicId) {
            await cloudinary.uploader.destroy(publicId);
        }
    } catch (error) {
        console.error('Failed to delete file from Cloudinary:', error);
    }
};

/**
 * @desc    Register provider with email verification (step 1: send OTP)
 * @route   POST /api/providers/register/initiate
 * @access  Public
 */
exports.initiateRegistration = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Validate email format
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Check if provider already exists (any status, not deleted)
        const [existingProvider, emailExistsInUser, emailExistsInAdmin] = await Promise.all([
            Provider.findOne({
                email: { $regex: new RegExp(`^${email}$`, 'i') },
                isDeleted: false
            }),
            User.findOne({
                email: email.trim().toLowerCase()
            }),
            Admin.findOne({
                email: email.trim().toLowerCase()
            })
        ]);

        if (existingProvider || emailExistsInUser || emailExistsInAdmin) {
            if (existingProvider) {
                if (!existingProvider.profileComplete) {
                    // CASE A: Profile incomplete
                    return res.status(200).json({
                        success: true,
                        message: 'Incomplete profile found. Please complete your profile.',

                        profileComplete: true // For backward compatibility with existing frontend
                    });
                } else if (existingProvider.profileComplete && existingProvider.kycStatus === 'rejected' && !existingProvider.approved) {
                    // CASE B: KYC REJECTED
                    return res.status(200).json({
                        success: true,
                        message: 'Your KYC was rejected. Please update your profile and resubmit.',

                        isRejected: true,
                        profileComplete: true // To trigger the same OTP skip behavior
                    });
                } else if (existingProvider.profileComplete && existingProvider.approved) {
                    // CASE C: APPROVED PROVIDER
                    return res.status(400).json({
                        success: false,
                        message: 'Provider with this email already exists'
                    });
                } else {
                    // CASE D: PENDING APPROVAL (profileComplete=true, approved=false)
                    return res.status(400).json({
                        success: false,
                        message: 'Provider registration with this email is pending approval'
                    });
                }
            } else {
                // Email exists in user or admin collections
                return res.status(400).json({
                    success: false,
                    message: 'Email is already registered. Please use a different email address.'
                });
            }
        }


        // Send OTP to email
        await sendOTP(email, null, 'providerRegistrationOtp');

        res.status(200).json({
            success: true,
            message: 'OTP sent to email'
        });
    } catch (error) {
        console.error('Initiate registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initiate registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Verify OTP and complete registration (step 2: verify OTP and create basic account)
 * @route   POST /api/providers/register/complete
 * @access  Public
 */
exports.completeRegistration = async (req, res) => {
    try {
        const { email, otp, password, name, phone, dateOfBirth } = req.body;

        // Validate required fields for registration only
        if (!email || !otp || !password || !name || !phone || !dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: 'Email, OTP, password, name, phone and date of birth are required'
            });
        }

        // Validate email format
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Validate phone number format (10 digits)
        const phoneRegex = /^\d{10}$/;
        const cleanedPhone = phone.replace(/\D/g, '');
        if (!phoneRegex.test(cleanedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 10-digit phone number'
            });
        }

        // Verify OTP
        try {
            /* BACKUP COMMENT: Original was: verifyOTP(email, otp); */
            await verifyOTP(email, otp);
        } catch (otpError) {
            return res.status(400).json({
                success: false,
                message: otpError.message
            });
        }

        // Clear OTP after successful verification
        /* BACKUP COMMENT: Original was: clearOTP(email); */
        await clearOTP(email);

        // Check if provider already exists and profile is complete
        const existingCompleteProvider = await Provider.findOne({
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            isDeleted: false,
            profileComplete: true
        });
        if (existingCompleteProvider) {
            return res.status(400).json({
                success: false,
                message: 'Provider with this email already exists'
            });
        }

        // Calculate age from date of birth
        const dob = new Date(dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
        }

        // Minimum age requirement (18 years)
        if (age < 18) {
            return res.status(400).json({
                success: false,
                message: 'You must be at least 18 years old to register'
            });
        }

        // Check if provider exists but profile is incomplete (update instead of create)
        const existingIncompleteProvider = await Provider.findOne({
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            isDeleted: false,
            profileComplete: false
        });

        let provider;

        if (existingIncompleteProvider) {
            // Update existing incomplete provider
            existingIncompleteProvider.password = password;
            existingIncompleteProvider.name = name;
            existingIncompleteProvider.phone = cleanedPhone;
            existingIncompleteProvider.dateOfBirth = dob;
            provider = await existingIncompleteProvider.save();
        } else {
            // Create new provider with basic info only
            provider = new Provider({
                email,
                password,
                name,
                phone: cleanedPhone,
                dateOfBirth: dob,
                profileComplete: false // Mark as incomplete
            });
            await provider.save();
        }

        // Capture IP & Device in provider metadata
        provider.metadata = {
            ip: req.clientIp || req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            device: req.deviceFingerprint || '',
            userAgent: req.headers['user-agent'],
            lastLogin: new Date()
        };
        await provider.save();

        // Track registration event with threshold check (>3 accounts in 24h)
        const FraudLog = require('../models/FraudLog-model');
        const recentRegistrations = await FraudLog.countDocuments({
            ip: req.clientIp,
            actionType: 'registration',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        const isSuspicious = recentRegistrations >= 3;
        const flagReason = isSuspicious ? 'More than 3 accounts registered from same IP in 24 hours' : 'Normal registration';

        const { trackEvent } = require('../middlewares/fraud-middleware');
        await trackEvent({
            req,
            actionType: 'registration',
            userId: provider._id,
            userModel: 'Provider',
            role: 'provider',
            fraudScore: isSuspicious ? 60 : 0,
            riskLevel: isSuspicious ? 'HIGH' : 'LOW',
            flagReason
        });

        // Generate JWT token
        const { SystemConfig } = require('../models/SystemSetting');
        const settings = await SystemConfig.findOne();
        const sessionTimeoutHours = settings?.securitySettings?.sessionTimeoutHours || 24;
        const token = provider.generateJWT(sessionTimeoutHours);

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please complete your profile.',
            token,
            provider: {
                id: provider._id,
                name: provider.name,
                email: provider.email,
                phone: provider.phone,
                profileComplete: provider.profileComplete
            }
        });
    } catch (error) {
        console.error('Complete registration error:', error);

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: messages[0] || 'Validation failed'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to complete registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Login for profile completion (step 3)
 * @route   POST /api/providers/login-for-completion
 * @access  Public
 */
exports.loginForCompletion = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password'
            });
        }

        // Find provider (case insensitive email search)
        const provider = await Provider.findOne({
            email: { $regex: new RegExp(`^${email}$`, 'i') }
        }).select('+password +profileComplete');

        if (!provider) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if profile is already complete
        if (provider.profileComplete) {
            return res.status(400).json({
                success: false,
                message: 'Profile is already completed'
            });
        }

        // Verify password
        const isMatch = await provider.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const { SystemConfig } = require('../models/SystemSetting');
        const settings = await SystemConfig.findOne();
        const sessionTimeoutHours = settings?.securitySettings?.sessionTimeoutHours || 24;
        const token = provider.generateJWT(sessionTimeoutHours);

        res.status(200).json({
            success: true,
            message: 'Login successful. Please complete your profile.',
            token,
            provider: {
                id: provider._id,
                name: provider.name,
                email: provider.email,
                profileComplete: provider.profileComplete
            }
        });
    } catch (error) {
        console.error('Login for completion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Complete provider profile (step 4: after login)
 * @route   PUT /api/providers/profile/complete
 * @access  Private (requires authentication)
 */
exports.completeProfile = async (req, res) => {
    console.log('req.files:', req.files);
    try {
        const providerId = req.providerId;
        const {
            services,
            experience,
            serviceArea,
            street,
            city,
            state,
            postalCode,
            country,
            accountNo,
            ifsc,
            lat,
            lng,
            houseNumber,
            road,
            landmark,
            area,
            pincode,
            formattedAddress,
            addressLine
        } = req.body;

        // Validate required fields
        if (!services || !experience || !serviceArea || !street || !city ||
            !state || !postalCode || !accountNo || !ifsc) {
            return res.status(400).json({
                success: false,
                message: 'All professional and bank details are required'
            });
        }

        // Validate IFSC format
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!ifscRegex.test(ifsc)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid IFSC code'
            });
        }

        // Validate account number
        const accountNoRegex = /^[0-9]{9,18}$/;
        if (!accountNoRegex.test(accountNo)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid account number (9-18 digits)'
            });
        }

        // Get provider
        const provider = await Provider.findById(providerId);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        // Check if profile is already complete
        if (provider.profileComplete) {
            return res.status(400).json({
                success: false,
                message: 'Profile is already completed'
            });
        }

        // Update professional info
        // Parse and validate categories - convert category names or ObjectIds to ObjectIds
        let categoryObjectIds = [];

        if (services) {
            // Ensure services is an array, parse if it's stringified JSON
            let servicesArray;
            if (typeof services === 'string' && services.startsWith('[')) {
                try {
                    servicesArray = JSON.parse(services);
                } catch (e) {
                    servicesArray = [services];
                }
            } else {
                servicesArray = Array.isArray(services) ? services : [services];
            }

            const { Category } = require('../models/SystemSetting');
            const allCategories = await Category.find({ isActive: true });
            const categoryMap = new Map();
            allCategories.forEach(c => {
                categoryMap.set(c.name.toLowerCase(), c);
                categoryMap.set(c._id.toString(), c);
            });

            for (const service of servicesArray) {
                let categoryId = null;

                if (typeof service === 'string') {
                    // Check if it's already a valid ObjectId
                    const trimmed = service.trim();
                    if (mongoose.Types.ObjectId.isValid(trimmed)) {
                        categoryId = new mongoose.Types.ObjectId(trimmed);
                    } else {
                        // Try to find category by name from pre-loaded map
                        const foundCategory = categoryMap.get(trimmed.toLowerCase()) || categoryMap.get(trimmed);
                        if (foundCategory) {
                            categoryId = foundCategory._id;
                        } else {
                            return res.status(400).json({
                                success: false,
                                message: `Invalid service: "${service}". Service not found or inactive.`
                            });
                        }
                    }
                } else if (service instanceof mongoose.Types.ObjectId) {
                    categoryId = service;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid service format. Services must be ObjectIds or valid service names.'
                    });
                }

                // Check for duplicates
                if (categoryObjectIds.some(id => id.equals(categoryId))) {
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate service detected: "${service}"`
                    });
                }

                categoryObjectIds.push(categoryId);
            }
        }

        // Ensure at least one category is provided
        if (categoryObjectIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one valid service must be provided'
            });
        }

        provider.services = categoryObjectIds;
        provider.experience = experience;
        provider.serviceArea = serviceArea;

        // Update address with explicit S2 cell computation (pre-save hooks handle .save() but
        // we also set them here for correctness during the save cycle)
        const addrLat = lat ? parseFloat(lat) : null;
        const addrLng = lng ? parseFloat(lng) : null;
        const addrS2CellId = (addrLat && addrLng) ? latLngToS2CellId(addrLat, addrLng, 13) : null;
        const addrS2CellIdPrecise = (addrLat && addrLng) ? latLngToS2CellId(addrLat, addrLng, 20) : null;

        provider.address = {
            street,
            city,
            state,
            postalCode,
            country: country || 'India',
            lat: addrLat,
            lng: addrLng,
            s2CellId: addrS2CellId,
            s2CellIdPrecise: addrS2CellIdPrecise,
            houseNumber: houseNumber || undefined,
            road: road || undefined,
            landmark: landmark || undefined,
            area: area || undefined,
            pincode: pincode || undefined,
            formattedAddress: formattedAddress || undefined,
            addressLine: addressLine || undefined
        };

        if (addrLat && addrLng) {
            provider.currentLocation = {
                type: 'Point',
                coordinates: [addrLng, addrLat],
                s2CellId: addrS2CellId,
                s2CellIdPrecise: addrS2CellIdPrecise
            };
            provider.s2CellId = addrS2CellId;
            provider.s2CellIdPrecise = addrS2CellIdPrecise;
            // Auto-detect zone from provider address coordinates
            try {
                const detectedZone = await Zone.findZoneByCoordinates(addrLat, addrLng);
                provider.currentZone = detectedZone ? detectedZone._id : null;
            } catch (zoneErr) {
                console.error('Zone detection error during provider profile completion:', zoneErr);
                provider.currentZone = null;
            }
            provider.zoneUpdatedAt = new Date();
        }

        // Update bank details
        provider.bankDetails = {
            accountNo,
            ifsc,
            passbookImage: req.files && req.files['passbookImage'] ? req.files['passbookImage'][0].path : undefined,
            passbookImagePublicId: req.files && req.files['passbookImage'] ? req.files['passbookImage'][0].filename : undefined,
            verified: false
        };

        // Update profile picture if uploaded
        if (req.files && req.files['profilePic']) {
            provider.profilePicUrl = req.files['profilePic'][0].path;
            provider.profilePicPublicId = req.files['profilePic'][0].filename;
        }

        // Update resume if uploaded
        if (req.files && req.files['resume']) {
            provider.resume = req.files['resume'][0].path;
            provider.resumePublicId = req.files['resume'][0].filename;
        }

        // Mark profile as complete
        provider.profileComplete = true;
        provider.registrationDate = new Date();
        await provider.save();

        res.status(200).json({
            success: true,
            message: 'Profile completed successfully. Your account is pending approval. Please contact support for assistance.',
            provider: {
                id: provider._id,
                name: provider.name,
                email: provider.email,
                profileComplete: provider.profileComplete,
                kycStatus: provider.kycStatus,
                approved: provider.approved
            }
        });
    } catch (error) {
        console.error('Complete profile error:', error);

        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = {};
            const errorMessages = [];

            // Extract specific field errors
            for (let field in error.errors) {
                const fieldError = error.errors[field];
                validationErrors[field] = fieldError.message;
                errorMessages.push(fieldError.message);
            }

            return res.status(400).json({
                success: false,
                message: errorMessages.length === 1 ? errorMessages[0] : 'Please fix the following errors',
                errors: validationErrors,
                fieldErrors: errorMessages
            });
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to complete profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get provider profile without earnings data
 * @route   GET /api/providers/profile
 * @access  Private (Provider)
 */
exports.getProfile = async (req, res) => {
    try {

        const provider = await Provider.findById(req.providerId)
            .select('-password -__v')
            .populate({
                path: 'feedbacks',
                select: 'providerFeedback',
                options: { limit: 10, sort: { createdAt: -1 } }
            })
            .lean();

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }


        // Calculate average rating from populated feedbacks
        let averageRating = 0;
        let ratingCount = 0;

        if (provider.feedbacks && provider.feedbacks.length > 0) {
            const validRatings = provider.feedbacks
                .filter(feedback => feedback.providerFeedback && feedback.providerFeedback.rating)
                .map(feedback => feedback.providerFeedback.rating);

            if (validRatings.length > 0) {
                const sum = validRatings.reduce((acc, rating) => acc + rating, 0);
                averageRating = parseFloat((sum / validRatings.length).toFixed(1));
                ratingCount = validRatings.length;
            }
        }


        // Calculate age manually if dateOfBirth exists (since lean() disables virtuals)
        let age = undefined;
        if (provider.dateOfBirth) {
            const today = new Date();
            const birthDate = new Date(provider.dateOfBirth);
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        // Add computed fields (without earnings)
        const responseData = {
            ...provider,
            age: age,
            averageRating: averageRating,
            ratingCount: ratingCount,
            hasResume: !!provider.resume,
            hasPassbookImage: !!provider.bankDetails?.passbookImage,
            hasProfilePic: !!provider.profilePicUrl && provider.profilePicUrl !== 'default-provider.jpg'
        };


        res.status(200).json({
            success: true,
            provider: responseData
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Unified function to update provider profile (all sections)
 * @route   PUT /api/providers/profile
 * @access  Private (Provider)
 */
exports.updateProviderProfile = async (req, res) => {
    console.log('req.files:', req.files);
    try {
        console.log('Unified profile update request:', {
            body: req.body,
            providerID: req.providerId,
            files: req.files
        });

        const {
            // Basic info
            name, phone, dateOfBirth, isOnline,
            // Professional info
            services, experience, serviceArea,
            // Address info
            street, city, state, postalCode, country, lat, lng,
            houseNumber, road, landmark, area, pincode, formattedAddress, addressLine,
            // Bank details
            accountNo, ifsc, bankName, accountName,
            // Update type to determine which section to update
            updateType
        } = req.body;

        const updates = {};
        let successMessage = 'Profile updated successfully';

        // Get current provider
        const currentProvider = await Provider.findById(req.providerId);
        if (!currentProvider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        // Handle different update types or update all if no type specified
        if (req.body.notificationPreferences) {
            let prefs = req.body.notificationPreferences;
            if (typeof prefs === 'string') {
                try {
                    prefs = JSON.parse(prefs);
                } catch (e) {
                    console.error('Failed to parse notificationPreferences string:', e);
                }
            }
            if (typeof prefs === 'object' && prefs !== null) {
                updates.notificationPreferences = {
                    ...currentProvider.notificationPreferences,
                    ...prefs
                };
            }
        }

        if (!updateType || updateType === 'basic') {
            // Basic Information Updates
            if (isOnline !== undefined) {
                updates.isOnline = isOnline === 'true' || isOnline === true;
            }

            if (name && typeof name === 'string') {
                updates.name = name.trim();
            }

            if (phone && typeof phone === 'string') {
                const cleanedPhone = phone.replace(/\D/g, '');
                if (!/^\d{10}$/.test(cleanedPhone)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please enter a valid 10-digit phone number'
                    });
                }
                updates.phone = cleanedPhone;
            }

            if (dateOfBirth) {
                const dob = new Date(dateOfBirth);
                if (isNaN(dob.getTime())) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid date format for date of birth'
                    });
                }

                // Age validation (minimum 18 years)
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const monthDiff = today.getMonth() - dob.getMonth();

                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                    age--;
                }

                if (age < 18) {
                    return res.status(400).json({
                        success: false,
                        message: 'You must be at least 18 years old'
                    });
                }

                updates.dateOfBirth = dob;
            }
        }

        if (!updateType || updateType === 'professional') {
            // Professional Information Updates
            if (services) {
                // Parse and validate categories - convert category names or ObjectIds to ObjectIds
                let categoryObjectIds = [];

                if (services) {
                    // Ensure services is an array, parse if it's stringified JSON
                    let servicesArray;
                    if (typeof services === 'string' && services.startsWith('[')) {
                        try {
                            servicesArray = JSON.parse(services);
                        } catch (e) {
                            servicesArray = [services];
                        }
                    } else {
                        servicesArray = Array.isArray(services) ? services : [services];
                    }

                    const { Category } = require('../models/SystemSetting');
                    const allCategories = await Category.find({ isActive: true });
                    const categoryMap = new Map();
                    allCategories.forEach(c => {
                        categoryMap.set(c.name.toLowerCase(), c);
                        categoryMap.set(c._id.toString(), c);
                    });

                    for (const service of servicesArray) {
                        let categoryId = null;

                        if (typeof service === 'string') {
                            // Check if it's already a valid ObjectId
                            const trimmed = service.trim();
                            if (mongoose.Types.ObjectId.isValid(trimmed)) {
                                categoryId = new mongoose.Types.ObjectId(trimmed);
                            } else {
                                // Try to find category by name from pre-loaded map
                                const foundCategory = categoryMap.get(trimmed.toLowerCase()) || categoryMap.get(trimmed);
                                if (foundCategory) {
                                    categoryId = foundCategory._id;
                                } else {
                                    return res.status(400).json({
                                        success: false,
                                        message: `Invalid service: "${service}". Service not found or inactive.`
                                    });
                                }
                            }
                        } else if (service instanceof mongoose.Types.ObjectId) {
                            categoryId = service;
                        } else {
                            return res.status(400).json({
                                success: false,
                                message: 'Invalid service format. Services must be ObjectIds or valid service names.'
                            });
                        }

                        // Check for duplicates
                        if (categoryObjectIds.some(id => id.equals(categoryId))) {
                            return res.status(400).json({
                                success: false,
                                message: `Duplicate service detected: "${service}"`
                            });
                        }

                        categoryObjectIds.push(categoryId);
                    }
                }

                // Ensure at least one category is provided
                if (categoryObjectIds.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'At least one valid service must be provided'
                    });
                }

                updates.services = categoryObjectIds;
            }
            if (experience !== undefined) updates.experience = experience;
            if (serviceArea) updates.serviceArea = serviceArea;
        }

        if (!updateType || updateType === 'address') {
            // Address Updates
            if (street || city || state || postalCode || country || lat || lng || houseNumber || road || landmark || area || pincode || formattedAddress || addressLine) {
                const currentAddr = currentProvider.address || {};
                const newLat = lat !== undefined ? (lat ? parseFloat(lat) : null) : currentAddr.lat;
                const newLng = lng !== undefined ? (lng ? parseFloat(lng) : null) : currentAddr.lng;

                // Compute S2 explicitly — findByIdAndUpdate bypasses pre-save hooks
                const newS2CellId = (newLat && newLng) ? latLngToS2CellId(newLat, newLng, 13) : currentAddr.s2CellId || null;
                const newS2CellIdPrecise = (newLat && newLng) ? latLngToS2CellId(newLat, newLng, 20) : currentAddr.s2CellIdPrecise || null;

                updates.address = {
                    ...currentAddr,
                    ...(street && { street }),
                    ...(city && { city }),
                    ...(state && { state }),
                    ...(postalCode && { postalCode }),
                    ...(country && { country }),
                    lat: newLat,
                    lng: newLng,
                    s2CellId: newS2CellId,
                    s2CellIdPrecise: newS2CellIdPrecise,
                    houseNumber: houseNumber !== undefined ? houseNumber : currentAddr.houseNumber,
                    road: road !== undefined ? road : currentAddr.road,
                    landmark: landmark !== undefined ? landmark : currentAddr.landmark,
                    area: area !== undefined ? area : currentAddr.area,
                    pincode: pincode !== undefined ? pincode : currentAddr.pincode,
                    formattedAddress: formattedAddress !== undefined ? formattedAddress : currentAddr.formattedAddress,
                    addressLine: addressLine !== undefined ? addressLine : currentAddr.addressLine
                };
                if (newLat && newLng) {
                    updates.currentLocation = {
                        type: 'Point',
                        coordinates: [newLng, newLat],
                        s2CellId: newS2CellId,
                        s2CellIdPrecise: newS2CellIdPrecise
                    };
                    updates.s2CellId = newS2CellId;
                    updates.s2CellIdPrecise = newS2CellIdPrecise;
                    // Resolve zone based on new coordinates
                    if (newLat && newLng) {
                        const zone = await Zone.findZoneByCoordinates(newLat, newLng);
                        if (zone) {
                            updates.currentZone = zone._id;
                            updates.zoneUpdatedAt = new Date();
                        }
                    }
                }
            }
        }

        // Determine if bank update is requested
        const isBankUpdateRequested = (
            (!updateType || updateType === 'bank') &&
            (accountNo || ifsc || bankName || accountName ||
                (req.files && req.files['passbookImage']) ||
                (req.file && req.file.fieldname === 'passbookImage'))
        );

        if (isBankUpdateRequested && currentProvider.approved && currentProvider.bankDetails?.verified) {
            // Backup the existing approved and verified bank details to rejectionReason
            const backupDetails = {
                accountNo: currentProvider.bankDetails.accountNo || '',
                ifsc: currentProvider.bankDetails.ifsc || '',
                bankName: currentProvider.bankDetails.bankName || '',
                accountName: currentProvider.bankDetails.accountName || '',
                passbookImage: currentProvider.bankDetails.passbookImage || '',
                passbookImagePublicId: currentProvider.bankDetails.passbookImagePublicId || ''
            };
            updates.rejectionReason = JSON.stringify(backupDetails);
        }

        if (!updateType || updateType === 'bank') {
            // Bank Details Updates
            if (accountNo || ifsc || bankName || accountName) {
                // Validate IFSC if provided
                if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please enter a valid IFSC code'
                    });
                }

                // Validate account number if provided
                if (accountNo && !/^[0-9]{9,18}$/.test(accountNo)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Please enter a valid account number (9-18 digits)'
                    });
                }

                updates.bankDetails = {
                    ...currentProvider.bankDetails,
                    ...(accountNo && { accountNo }),
                    ...(ifsc && { ifsc }),
                    ...(bankName && { bankName }),
                    ...(accountName && { accountName }),
                    verified: false // Reset verification when details change
                };
            }
        }

        // Handle file uploads
        if (req.files) {
            // Profile Picture Upload
            if (req.files['profilePic']) {
                const profilePic = req.files['profilePic'][0];

                // Delete old profile picture
                if (currentProvider.profilePicPublicId) {
                    await deleteFile(currentProvider.profilePicPublicId);
                }

                updates.profilePicUrl = profilePic.path;
                updates.profilePicPublicId = profilePic.filename;
                successMessage = 'Profile picture updated successfully';
            }

            // Resume Upload
            if (req.files['resume']) {
                const resumeFile = req.files['resume'][0];

                // Delete old resume
                if (currentProvider.resumePublicId) {
                    await deleteFile(currentProvider.resumePublicId);
                }

                updates.resume = resumeFile.path;
                updates.resumePublicId = resumeFile.filename;
                successMessage = 'Resume updated successfully';
            }

            // Passbook Image Upload
            if (req.files['passbookImage']) {
                const passbookImage = req.files['passbookImage'][0];

                // Delete old passbook image only if NOT verified / approved
                if (!currentProvider.bankDetails?.verified && currentProvider.bankDetails?.passbookImagePublicId) {
                    await deleteFile(currentProvider.bankDetails.passbookImagePublicId);
                }

                updates.bankDetails = {
                    ...currentProvider.bankDetails,
                    ...updates.bankDetails,
                    passbookImage: passbookImage.path,
                    passbookImagePublicId: passbookImage.filename,
                    verified: false
                };
                successMessage = 'Bank details updated successfully';
            }
        }

        // Handle single file uploads (for backward compatibility)
        if (req.file) {
            const fieldName = req.file.fieldname;

            if (fieldName === 'profilePic') {
                if (currentProvider.profilePicPublicId) {
                    await deleteFile(currentProvider.profilePicPublicId);
                }
                updates.profilePicUrl = req.file.path;
                updates.profilePicPublicId = req.file.filename;
                successMessage = 'Profile picture updated successfully';
            } else if (fieldName === 'resume') {
                if (currentProvider.resumePublicId) {
                    await deleteFile(currentProvider.resumePublicId);
                }
                updates.resume = req.file.path;
                updates.resumePublicId = req.file.filename;
                successMessage = 'Resume updated successfully';
            } else if (fieldName === 'passbookImage') {
                if (!currentProvider.bankDetails?.verified && currentProvider.bankDetails?.passbookImagePublicId) {
                    await deleteFile(currentProvider.bankDetails.passbookImagePublicId);
                }
                updates.bankDetails = {
                    ...currentProvider.bankDetails,
                    ...updates.bankDetails,
                    passbookImage: req.file.path,
                    passbookImagePublicId: req.file.filename,
                    verified: false
                };
                successMessage = 'Bank details updated successfully';
            }
        }

        // Perform the update
        const updatedProvider = await Provider.findByIdAndUpdate(
            req.providerId,
            updates,
            {
                new: true,
                runValidators: true,
                select: '-password -__v'
            }
        );

        if (!updatedProvider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        res.status(200).json({
            success: true,
            message: successMessage,
            provider: updatedProvider
        });

    } catch (error) {
        console.error('Unified profile update error:', error);

        // Clean up uploaded files if error occurred
        if (req.files) {
            Object.values(req.files).forEach(fileArray => {
                fileArray.forEach(file => deleteFile(file.filename));
            });
        }
        if (req.file) {
            deleteFile(req.file.filename);
        }

        // Handle specific error types
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: messages
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    View document (resume, passbook image, profile picture)
 * @route   GET /api/providers/document/:type
 * @access  Private (Provider)
 */
exports.viewDocument = async (req, res) => {
    try {
        const { type } = req.params;
        const provider = await Provider.findById(req.providerId);

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        let fileUrl;
        let fileName;
        let publicId;

        switch (type) {
            case 'resume':
                fileUrl = provider.resume;
                publicId = provider.resumePublicId;
                fileName = 'resume';
                break;
            case 'passbook':
                fileUrl = provider.bankDetails?.passbookImage;
                publicId = provider.bankDetails?.passbookImagePublicId;
                fileName = 'passbook';
                break;
            case 'profile':
                fileUrl = provider.profilePicUrl;
                publicId = provider.profilePicPublicId;
                fileName = 'profile-picture';
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid document type. Use: resume, passbook, or profile'
                });
        }

        if (!fileUrl || !publicId) {
            return res.status(404).json({
                success: false,
                message: `${fileName.charAt(0).toUpperCase() + fileName.slice(1)} not found`
            });
        }

        // Generate a signed URL for the private resource
        const signedUrl = cloudinary.url(publicId, {
            secure: true,
            private_cdn: false,
            sign_url: true,
            resource_type: 'image',
            expires_at: Math.floor(Date.now() / 1000) + 3600
        });

        return res.status(200).json({
            success: true,
            message: `${fileName} document URL generated successfully`,
            fileUrl: signedUrl
        });

    } catch (error) {
        console.error('View document error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to view document',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Delete provider account (soft delete)
 * @route   DELETE /api/providers/profile
 * @access  Private (Provider)
 */
exports.deleteAccount = async (req, res) => {
    try {
        const provider = await Provider.findById(req.providerId);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        // Mark as deleted
        provider.isDeleted = true;
        provider.isActive = false;
        await provider.save();

        res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};



/**
 * @desc    Permanently delete provider account (admin only)
 * @route   DELETE /api/providers/:id/permanent
 * @access  Private (Admin)
 */
exports.permanentDeleteAccount = async (req, res) => {
    try {
        // Check if user is admin (you would implement your own admin check)
        if (req.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Admin access required'
            });
        }

        const provider = await Provider.findById(req.params.id);
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        // Delete files from Cloudinary
        if (provider.profilePicPublicId) {
            await deleteFile(provider.profilePicPublicId);
        }
        if (provider.resumePublicId) {
            await deleteFile(provider.resumePublicId);
        }
        if (provider.bankDetails?.passbookImagePublicId) {
            await deleteFile(provider.bankDetails.passbookImagePublicId);
        }

        // Permanent delete
        await Provider.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Account permanently deleted'
        });
    } catch (error) {
        console.error('Permanent delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to permanently delete account',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get provider dashboard summary
 * @route   GET /api/provider/dashboard/summary
 * @access  Private (Provider)
 *//**
 * @desc    Get all unified provider dashboard data
 * @route   GET /api/provider/dashboard
 * @access  Private (Provider)
 */
exports.getDashboardData = async (req, res) => {
    try {
        const providerId = req.providerId;
        const { startDate, endDate, period = 'daily' } = req.query;

        // Default range for analytics (like last 7 days if not provided)
        const end = endDate ? new Date(endDate) : new Date();
        if (endDate) {
            end.setHours(23, 59, 59, 999);
        }
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (startDate) {
            start.setHours(0, 0, 0, 0);
        }

        // Date ranges for today's earnings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const lifetimeBookingMatchStage = { provider: new mongoose.Types.ObjectId(providerId) };
        const lifetimeEarningMatchStage = { provider: new mongoose.Types.ObjectId(providerId), status: { $ne: 'cancelled' } };

        const bookingMatchStage = { provider: new mongoose.Types.ObjectId(providerId) };
        const earningMatchStage = { provider: new mongoose.Types.ObjectId(providerId), status: { $ne: 'cancelled' } };

        if (startDate && endDate) {
            bookingMatchStage.createdAt = { $gte: start, $lte: end };
            earningMatchStage.createdAt = { $gte: start, $lte: end };
        }

        // Parallel aggregation queries for better performance
        const [
            bookingStats,
            combinedEarnings,
            ratingStats,
            totalComplaintsCount,
            earningsData,
            monthlyData,
            todayJobs,
            upcomingJobs,
            provider,
            pendingPayouts,
            lastPayout
        ] = await Promise.all([
            // 1. Booking Stats
            Booking.aggregate([
                { $match: lifetimeBookingMatchStage },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // 2. Combined Earnings (today and lifetime/selected range)
            ProviderEarning.aggregate([
                { $match: lifetimeEarningMatchStage },
                {
                    $group: {
                        _id: null,
                        totalEarnings: { $sum: '$netAmount' },
                        todaysEarnings: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $gte: ['$createdAt', today] },
                                            { $lt: ['$createdAt', tomorrow] }
                                        ]
                                    },
                                    '$netAmount',
                                    0
                                ]
                            }
                        }
                    }
                }
            ]),

            // 3. Average Rating
            Feedback.aggregate([
                { $match: { 'providerFeedback.provider': new mongoose.Types.ObjectId(providerId) } },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$providerFeedback.rating' },
                        totalReviews: { $sum: 1 }
                    }
                }
            ]),

            // 4. Complaints Count
            Complaint.countDocuments({ provider: providerId }),

            // 5. Earnings chart data
            ProviderEarning.aggregate([
                {
                    $match: {
                        provider: new mongoose.Types.ObjectId(providerId),
                        createdAt: { $gte: start, $lte: end },
                        status: { $ne: 'cancelled' }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: period === 'weekly' ? '%Y-%U' : '%Y-%m-%d',
                                date: '$createdAt'
                            }
                        },
                        earnings: { $sum: '$netAmount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id': 1 } },
                {
                    $project: {
                        date: '$_id',
                        earnings: 1,
                        count: 1,
                        _id: 0
                    }
                }
            ]),

            // 6. Monthly completed jobs
            Booking.aggregate([
                {
                    $match: {
                        provider: new mongoose.Types.ObjectId(providerId),
                        status: 'completed',
                        updatedAt: { $gte: start, $lte: end }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: '%Y-%m',
                                date: '$updatedAt'
                            }
                        },
                        completedJobs: { $sum: 1 }
                    }
                },
                { $sort: { '_id': 1 } },
                {
                    $project: {
                        month: '$_id',
                        completedJobs: 1,
                        _id: 0
                    }
                }
            ]),

            // 7. Today's jobs
            Booking.find({
                provider: providerId,
                date: { $gte: today, $lt: tomorrow },
                status: { $in: ['pending', 'accepted', 'in-progress', 'scheduled'] }
            })
                .populate('customer', 'name phone')
                .populate('services.service', 'title')
                .sort({ date: 1, time: 1 })
                .limit(10)
                .lean(),

            // 8. Upcoming jobs
            Booking.find({
                provider: providerId,
                date: { $gte: tomorrow, $lt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
                status: { $in: ['pending', 'accepted', 'scheduled'] }
            })
                .populate('customer', 'name phone')
                .populate('services.service', 'title')
                .sort({ date: 1, time: 1 })
                .limit(10)
                .lean(),

            // 9. Provider info
            Provider.findById(providerId).select('bankDetails wallet performanceScore name providerId approved testPassed').lean(),

            // 10. Pending Payouts
            PaymentRecord.aggregate([
                {
                    $match: {
                        provider: new mongoose.Types.ObjectId(providerId),
                        status: { $in: ['pending', 'processing', 'requested'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalPending: { $sum: '$amount' }
                    }
                }
            ]),

            // 11. Last completed payout
            PaymentRecord.findOne({
                provider: providerId,
                status: 'completed'
            }).sort({ updatedAt: -1 }).lean()
        ]);

        // Process summary and booking breakdown
        const summaryStats = {
            totalBookings: 0,
            pendingBookings: 0,
            completedJobs: 0,
            cancelledJobs: 0
        };

        const statusBreakdown = {};
        const pieChartData = [];
        const statusLabels = {
            completed: 'Completed',
            cancelled: 'Cancelled',
            'in-progress': 'In Progress',
            pending: 'Pending',
            accepted: 'Accepted',
            'no-show': 'No Show'
        };

        bookingStats.forEach(stat => {
            summaryStats.totalBookings += stat.count;
            switch (stat._id) {
                case 'pending':
                    summaryStats.pendingBookings = stat.count;
                    break;
                case 'completed':
                    summaryStats.completedJobs = stat.count;
                    break;
                case 'cancelled':
                    summaryStats.cancelledJobs = stat.count;
                    break;
            }

            const label = statusLabels[stat._id] || stat._id.charAt(0).toUpperCase() + stat._id.slice(1);
            statusBreakdown[stat._id] = stat.count;
            pieChartData.push({
                name: label,
                value: stat.count,
                status: stat._id
            });
        });

        const earnings = combinedEarnings[0] || { totalEarnings: 0, todaysEarnings: 0 };
        const averageRating = ratingStats.length > 0 ? parseFloat(ratingStats[0].averageRating.toFixed(1)) : 0;

        // Process jobs with payout status helper
        const jobsWithPayoutStatus = async (jobs) => {
            return Promise.all(jobs.map(async job => {
                const earning = await ProviderEarning.findOne({ booking: job._id }).lean();
                return {
                    _id: job._id,
                    customer: job.customer,
                    services: job.services,
                    date: job.date,
                    time: job.time,
                    location: job.address,
                    status: job.status,
                    totalAmount: job.totalAmount,
                    payoutStatus: getPayoutStatus(earning, job),
                    disputeRaised: job.disputeRaised,
                    disputeStatus: job.disputeStatus,
                    payoutHoldUntil: job.payoutHoldUntil
                };
            }));
        };

        const todayJobsList = await jobsWithPayoutStatus(todayJobs);
        const upcomingJobsList = await jobsWithPayoutStatus(upcomingJobs);

        // Process wallet info
        const availableBalance = provider?.wallet?.availableBalance || 0;
        
        // Calculate held balance
        const heldEarningStats = await ProviderEarning.aggregate([
            { $match: { provider: new mongoose.Types.ObjectId(providerId), status: "held" } },
            { $group: { _id: null, totalHeld: { $sum: "$netAmount" } } }
        ]);
        const heldBalance = heldEarningStats[0]?.totalHeld || 0;

        const releasedPayouts = provider?.wallet?.releasedPayouts || 0;
        const refundedDeductions = provider?.wallet?.refundedDeductions || 0;

        // Calculate performance rating values
        const completedJobs = await Booking.find({ provider: providerId, status: 'completed' }).select('completedAt date time').lean();
        let onTimeCompleted = 0;
        completedJobs.forEach(job => {
            if (job.completedAt && job.date && job.time) {
                const scheduledDate = new Date(job.date);
                const [hours, minutes] = job.time.split(':').map(Number);
                scheduledDate.setHours(hours, minutes, 0, 0);
                const maxCompletionTime = new Date(scheduledDate.getTime() + 6 * 60 * 60 * 1000);
                if (job.completedAt <= maxCompletionTime) {
                    onTimeCompleted++;
                }
            }
        });

        let totalRelevant = 0;
        bookingStats.forEach(stat => {
            if (['accepted', 'in-progress', 'completed', 'cancelled', 'scheduled'].includes(stat._id)) {
                totalRelevant += stat.count;
            }
        });

        const completionRate = totalRelevant > 0 ? parseFloat(((completedJobs.length / totalRelevant) * 100).toFixed(1)) : 0;
        const onTimeRate = completedJobs.length > 0 ? parseFloat(((onTimeCompleted / completedJobs.length) * 100).toFixed(1)) : 0;

        const performance = provider?.performanceScore || {};

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalBookings: summaryStats.totalBookings,
                    pendingBookings: summaryStats.pendingBookings,
                    completedJobs: summaryStats.completedJobs,
                    cancelledJobs: summaryStats.cancelledJobs,
                    todaysEarnings: earnings.todaysEarnings,
                    totalEarnings: earnings.totalEarnings,
                    averageRating,
                    totalComplaints: totalComplaintsCount || 0
                },
                earnings: {
                    chartData: earningsData,
                    monthlyData,
                    dateRange: {
                        start: start.toISOString().split('T')[0],
                        end: end.toISOString().split('T')[0]
                    }
                },
                bookings: {
                    statusBreakdown,
                    pieChartData
                },
                analytics: {
                    todayJobs: todayJobsList,
                    upcomingJobs: upcomingJobsList
                },
                wallet: {
                    currentBalance: availableBalance,
                    heldBalance: heldBalance,
                    pendingPayout: pendingPayouts.length > 0 ? pendingPayouts[0].totalPending : 0,
                    lastPayoutDate: lastPayout ? lastPayout.updatedAt : null,
                    refundedDeductions,
                    releasedPayouts
                },
                ratings: {
                    averageRating,
                    totalReviews: ratingStats[0]?.totalReviews || 0,
                    completionRate: performance.completionPercentage !== undefined ? performance.completionPercentage : completionRate,
                    onTimeRate: performance.onTimePercentage !== undefined ? performance.onTimePercentage : onTimeRate,
                    performanceBadge: performance.badge || 'Bronze',
                    restrictionsActive: performance.restrictionsActive || false,
                    restrictedUntil: performance.restrictedUntil || null,
                    restrictionReason: performance.restrictionReason || null
                },
                profile: {
                    name: provider?.name,
                    providerId: provider?.providerId,
                    approved: provider?.approved,
                    testPassed: provider?.testPassed
                }
            }
        });

    } catch (error) {
        console.error('Unified dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unified dashboard data',
        });
    }
};


