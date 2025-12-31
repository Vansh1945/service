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
const Service = require('../models/Service-model');
const mongoose = require('mongoose');
const Booking = require('../models/Booking-model');
const Feedback = require('../models/Feedback-model');
const User = require('../models/User-model');
const Admin = require('../models/Admin-model');

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
        const existingProvider = await Provider.findOne({
            email: { $regex: new RegExp(`^${email}$`, 'i') },
            isDeleted: false
        });

        // Check if email is already registered with user or admin
        const emailExistsInUser = await User.findOne({
            email: email.trim().toLowerCase()
        });

        const emailExistsInAdmin = await Admin.findOne({
            email: email.trim().toLowerCase()
        });

        if (existingProvider || emailExistsInUser || emailExistsInAdmin) {
            if (existingProvider) {
                if (existingProvider.approved && existingProvider.profileComplete) {
                    // Fully registered & approved
                    return res.status(400).json({
                        success: false,
                        message: 'Provider with this email already exists'
                    });
                } else if (!existingProvider.approved) {
                    // Pending approval
                    return res.status(400).json({
                        success: false,
                        message: 'Provider registration with this email is pending approval'
                    });
                } else if (!existingProvider.profileComplete) {
                    // Profile incomplete
                    return res.status(400).json({
                        success: false,
                        message: 'Provider profile is incomplete. Please login complete it to continue.'
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
        await sendOTP(email);

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
            verifyOTP(email, otp);
        } catch (otpError) {
            return res.status(400).json({
                success: false,
                message: otpError.message
            });
        }

        // Clear OTP after successful verification
        clearOTP(email);

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

        // Generate JWT token
        const token = provider.generateJWT();

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
        const token = provider.generateJWT();

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
            ifsc
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
        provider.services = services;
        provider.experience = experience;
        provider.serviceArea = serviceArea;

        // Update address
        provider.address = {
            street,
            city,
            state,
            postalCode,
            country: country || 'India'
        };

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
            message: 'Profile completed successfully. Your account is pending approval.',
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
            });

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


        // Add computed fields (without earnings)
        const responseData = {
            ...provider.toJSON(),
            age: provider.age, // Virtual field
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
            name, phone, dateOfBirth,
            // Professional info
            services, experience, serviceArea,
            // Address info
            street, city, state, postalCode, country,
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
        if (!updateType || updateType === 'basic') {
            // Basic Information Updates
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
                let parsedServices = services;
                if (typeof services === 'string') {
                    try {
                        parsedServices = JSON.parse(services);
                    } catch (e) {
                        console.error('Error parsing services:', e);
                        return res.status(400).json({
                            success: false,
                            message: 'Invalid services format'
                        });
                    }
                }
                updates.services = parsedServices;
            }
            if (experience !== undefined) updates.experience = experience;
            if (serviceArea) updates.serviceArea = serviceArea;
        }

        if (!updateType || updateType === 'address') {
            // Address Updates
            if (street || city || state || postalCode || country) {
                updates.address = {
                    ...currentProvider.address,
                    ...(street && { street }),
                    ...(city && { city }),
                    ...(state && { state }),
                    ...(postalCode && { postalCode }),
                    ...(country && { country })
                };
            }
        }

        if (!updateType || updateType === 'bank') {
            // Bank Details Updates
            if (accountNo || ifsc) {
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

                // Delete old passbook image
                if (currentProvider.bankDetails?.passbookImagePublicId) {
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
                if (currentProvider.bankDetails?.passbookImagePublicId) {
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
 */
exports.getDashboardSummary = async (req, res) => {
    try {
        const providerId = req.providerId;

        // Get current date for today's earnings
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Parallel aggregation queries for better performance
        const [
            bookingStats,
            todayEarnings,
            ratingStats
        ] = await Promise.all([
            // Booking statistics
            Booking.aggregate([
                { $match: { provider: new mongoose.Types.ObjectId(providerId) } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Today's earnings
            ProviderEarning.aggregate([
                {
                    $match: {
                        provider: new mongoose.Types.ObjectId(providerId),
                        createdAt: { $gte: today, $lt: tomorrow }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalEarnings: { $sum: '$netAmount' }
                    }
                }
            ]),

            // Average rating
            Feedback.aggregate([
                { $match: { 'providerFeedback.provider': new mongoose.Types.ObjectId(providerId) } },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$providerFeedback.rating' },
                        totalReviews: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Process booking stats
        const stats = {
            totalBookings: 0,
            pendingBookings: 0,
            completedJobs: 0,
            cancelledJobs: 0
        };

        bookingStats.forEach(stat => {
            stats.totalBookings += stat.count;
            switch (stat._id) {
                case 'pending':
                    stats.pendingBookings = stat.count;
                    break;
                case 'completed':
                    stats.completedJobs = stat.count;
                    break;
                case 'cancelled':
                    stats.cancelledJobs = stat.count;
                    break;
            }
        });

        // Process today's earnings
        const todaysEarnings = todayEarnings.length > 0 ? todayEarnings[0].totalEarnings : 0;

        // Process rating stats
        const averageRating = ratingStats.length > 0 ? parseFloat(ratingStats[0].averageRating.toFixed(1)) : 0;

        res.status(200).json({
            success: true,
            data: {
                totalBookings: stats.totalBookings,
                pendingBookings: stats.pendingBookings,
                completedJobs: stats.completedJobs,
                cancelledJobs: stats.cancelledJobs,
                todaysEarnings,
                averageRating
            }
        });

    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard summary',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get provider earnings analytics
 * @route   GET /api/providers/dashboard/earnings
 * @access  Private (Provider)
 */
exports.getEarningsAnalytics = async (req, res) => {
    try {
        const providerId = req.providerId;
        const { startDate, endDate, period = 'daily' } = req.query;

        // Default to last 30 days if no dates provided
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Ensure dates are valid
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        const [
            earningsData,
            monthlyData
        ] = await Promise.all([
            // Earnings chart data (daily/weekly)
            ProviderEarning.aggregate([
                {
                    $match: {
                        provider: new mongoose.Types.ObjectId(providerId),
                        createdAt: { $gte: start, $lte: end }
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
                {
                    $sort: { '_id': 1 }
                },
                {
                    $project: {
                        date: '$_id',
                        earnings: 1,
                        count: 1,
                        _id: 0
                    }
                }
            ]),

            // Monthly completed jobs data
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
                {
                    $sort: { '_id': 1 }
                },
                {
                    $project: {
                        month: '$_id',
                        completedJobs: 1,
                        _id: 0
                    }
                }
            ])
        ]);

        res.status(200).json({
            success: true,
            data: {
                chartData: earningsData,
                monthlyData,
                dateRange: {
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0]
                }
            }
        });

    } catch (error) {
        console.error('Earnings analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch earnings analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get booking status breakdown
 * @route   GET /api/providers/dashboard/bookings
 * @access  Private (Provider)
 */
exports.getBookingStatusBreakdown = async (req, res) => {
    try {
        const providerId = req.providerId;

        const bookingStats = await Booking.aggregate([
            { $match: { provider: new mongoose.Types.ObjectId(providerId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Process data for pie chart
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
            const label = statusLabels[stat._id] || stat._id.charAt(0).toUpperCase() + stat._id.slice(1);
            statusBreakdown[stat._id] = stat.count;
            pieChartData.push({
                name: label,
                value: stat.count,
                status: stat._id
            });
        });

        res.status(200).json({
            success: true,
            data: {
                statusBreakdown,
                pieChartData
            }
        });

    } catch (error) {
        console.error('Booking status breakdown error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch booking status breakdown',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get today and upcoming jobs
 * @route   GET /api/providers/dashboard/analytics
 * @access  Private (Provider)
 */
exports.getDashboardAnalytics = async (req, res) => {
    try {
        const providerId = req.providerId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [
            todayJobs,
            upcomingJobs
        ] = await Promise.all([
            // Today's jobs
            Booking.find({
                provider: providerId,
                date: { $gte: today, $lt: tomorrow },
                status: { $in: ['accepted', 'in-progress', 'scheduled'] }
            })
            .populate('customer', 'name phone')
            .populate('services.service', 'title')
            .sort({ date: 1, time: 1 })
            .limit(10),

            // Upcoming jobs (next 7 days)
            Booking.find({
                provider: providerId,
                date: { $gte: tomorrow, $lt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
                status: { $in: ['accepted', 'scheduled'] }
            })
            .populate('customer', 'name phone')
            .populate('services.service', 'title')
            .sort({ date: 1, time: 1 })
            .limit(10)
        ]);

        res.status(200).json({
            success: true,
            data: {
                todayJobs: todayJobs.map(job => ({
                    _id: job._id,
                    customer: job.customer,
                    services: job.services,
                    date: job.date,
                    time: job.time,
                    location: job.address,
                    status: job.status,
                    totalAmount: job.totalAmount
                })),
                upcomingJobs: upcomingJobs.map(job => ({
                    _id: job._id,
                    customer: job.customer,
                    services: job.services,
                    date: job.date,
                    time: job.time,
                    location: job.address,
                    status: job.status,
                    totalAmount: job.totalAmount
                }))
            }
        });

    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard analytics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get wallet and payout information
 * @route   GET /api/providers/dashboard/wallet
 * @access  Private (Provider)
 */
exports.getWalletInfo = async (req, res) => {
    try {
        const providerId = req.providerId;

        // Get provider with wallet information
        const provider = await Provider.findById(providerId).select('bankDetails wallet');
        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        // Get available balance from provider wallet
        const availableBalance = provider.wallet?.availableBalance || 0;

        // Get pending payouts (if any payment records exist)
        const PaymentRecord = mongoose.model('PaymentRecord');
        const pendingPayouts = await PaymentRecord.aggregate([
            {
                $match: {
                    provider: new mongoose.Types.ObjectId(providerId),
                    status: { $in: ['pending', 'processing'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalPending: { $sum: '$amount' }
                }
            }
        ]);

        // Get last payout date
        const lastPayout = await PaymentRecord.findOne({
            provider: providerId,
            status: 'completed'
        }).sort({ updatedAt: -1 });

        // Check if provider can withdraw (has valid bank details and minimum balance)
        const canWithdraw = provider?.bankDetails?.verified &&
                           availableBalance >= 500 && // Minimum withdrawal amount
                           provider?.bankDetails?.accountNo &&
                           provider?.bankDetails?.ifsc;

        res.status(200).json({
            success: true,
            data: {
                currentBalance: availableBalance,
                pendingPayout: pendingPayouts.length > 0 ? pendingPayouts[0].totalPending : 0,
                lastPayoutDate: lastPayout ? lastPayout.updatedAt : null,
                canWithdraw
            }
        });

    } catch (error) {
        console.error('Wallet info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch wallet information',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get performance and ratings information
 * @route   GET /api/providers/dashboard/ratings
 * @access  Private (Provider)
 */
exports.getPerformanceRatings = async (req, res) => {
    try {
        const providerId = req.providerId;

        const [
            ratingStats,
            completionStats
        ] = await Promise.all([
            // Rating statistics
            Feedback.aggregate([
                { $match: { 'providerFeedback.provider': new mongoose.Types.ObjectId(providerId) } },
                {
                    $group: {
                        _id: null,
                        averageRating: { $avg: '$providerFeedback.rating' },
                        totalReviews: { $sum: 1 },
                        ratingDistribution: {
                            $push: '$providerFeedback.rating'
                        }
                    }
                }
            ]),

            // Completion rate
            Booking.aggregate([
                { $match: { provider: new mongoose.Types.ObjectId(providerId) } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        // Process rating stats
        const ratingData = ratingStats.length > 0 ? ratingStats[0] : { averageRating: 0, totalReviews: 0 };
        const averageRating = ratingData.averageRating ? parseFloat(ratingData.averageRating.toFixed(1)) : 0;

        // Process completion stats
        let totalBookings = 0;
        let completedBookings = 0;
        completionStats.forEach(stat => {
            totalBookings += stat.count;
            if (stat._id === 'completed') {
                completedBookings = stat.count;
            }
        });

        const completionRate = totalBookings > 0 ? parseFloat(((completedBookings / totalBookings) * 100).toFixed(1)) : 0;

        // Determine performance badge
        let performanceBadge = 'Bronze';
        if (averageRating >= 4.5 && completionRate >= 95) {
            performanceBadge = 'Platinum';
        } else if (averageRating >= 4.0 && completionRate >= 90) {
            performanceBadge = 'Gold';
        } else if (averageRating >= 3.5 && completionRate >= 85) {
            performanceBadge = 'Silver';
        }

        res.status(200).json({
            success: true,
            data: {
                averageRating,
                totalReviews: ratingData.totalReviews || 0,
                completionRate,
                performanceBadge
            }
        });

    } catch (error) {
        console.error('Performance ratings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch performance ratings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


