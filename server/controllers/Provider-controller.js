const Provider = require('../models/Provider-model');
const { sendOTP, verifyOTP, clearOTP } = require('../utils/otpSend');
const { uploadProfilePic, uploadResume, uploadPassbookImg } = require('../middlewares/upload');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Helper function to delete file
const deleteFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
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

        // Check if provider already exists (either fully registered or in progress)
        const existingProvider = await Provider.findOne({ 
            email: { $regex: new RegExp(`^${email}$`, 'i') }, 
            isDeleted: false 
        });
        
        if (existingProvider) {
            if (existingProvider.profileComplete) {
                return res.status(400).json({
                    success: false,
                    message: 'Provider with this email already exists'
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
            existingIncompleteProvider.phone = phone;
            existingIncompleteProvider.dateOfBirth = dob;
            provider = await existingIncompleteProvider.save();
        } else {
            // Create new provider with basic info only
            provider = new Provider({
                email,
                password,
                name,
                phone,
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
        
        // Handle specific validation errors
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
    try {
        const providerId = req.providerID;
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
            passbookImage: req.files['passbookImage'] ? req.files['passbookImage'][0].path : undefined,
            verified: false
        };

        // Update profile picture if uploaded
        if (req.files['profilePic']) {
            provider.profilePicUrl = req.files['profilePic'][0].path;
        }

        // Update resume if uploaded
        if (req.files['resume']) {
            provider.resume = req.files['resume'][0].path;
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
        res.status(500).json({
            success: false,
            message: 'Failed to complete profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


/**
 * @desc    Get provider profile
 * @route   GET /api/providers/profile
 * @access  Private (Provider)
 */
exports.getProfile = async (req, res) => {
    try {
        const provider = await Provider.findById(req.providerID)
            .select('-password -bankDetails.passbookImage -__v')
            .populate({
                path: 'feedbacks',
                select: 'rating comment createdAt',
                options: { limit: 5, sort: { createdAt: -1 } }
            })
            .populate({
                path: 'earningsHistory',
                select: 'amount date description',
                options: { limit: 5, sort: { date: -1 } }
            });

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
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Update provider profile (basic info)
 * @route   PUT /api/providers/profile
 * @access  Private (Provider)
 */
exports.updateProfile = async (req, res) => {
    try {
        const { name, phone, dateOfBirth } = req.body;
        const updates = {};

        if (name) updates.name = name;
        if (phone) updates.phone = phone;
        if (dateOfBirth) updates.dateOfBirth = new Date(dateOfBirth);

        const provider = await Provider.findByIdAndUpdate(
            req.providerID,
            updates,
            { new: true, runValidators: true }
        ).select('-password -bankDetails.passbookImage -__v');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            provider
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Update provider professional info
 * @route   PUT /api/providers/profile/professional
 * @access  Private (Provider)
 */
exports.updateProfessionalInfo = async (req, res) => {
    try {
        const { services, experience, serviceArea } = req.body;
        const updates = {};

        if (services) updates.services = services;
        if (experience) updates.experience = experience;
        if (serviceArea) updates.serviceArea = serviceArea;

        const provider = await Provider.findByIdAndUpdate(
            req.providerID,
            updates,
            { new: true, runValidators: true }
        ).select('-password -bankDetails.passbookImage -__v');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Professional info updated successfully',
            provider
        });
    } catch (error) {
        console.error('Update professional info error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update professional info',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Update provider address
 * @route   PUT /api/providers/profile/address
 * @access  Private (Provider)
 */
exports.updateAddress = async (req, res) => {
    try {
        const { street, city, state, postalCode, country } = req.body;

        if (!street || !city || !state || !postalCode) {
            return res.status(400).json({
                success: false,
                message: 'All address fields are required'
            });
        }

        const address = {
            street,
            city,
            state,
            postalCode,
            country: country || 'India'
        };

        const provider = await Provider.findByIdAndUpdate(
            req.providerID,
            { address },
            { new: true, runValidators: true }
        ).select('-password -bankDetails.passbookImage -__v');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Address updated successfully',
            provider
        });
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update address',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Update provider bank details
 * @route   PUT /api/providers/profile/bank
 * @access  Private (Provider)
 */
exports.updateBankDetails = async (req, res) => {
    try {
        const { accountNo, ifsc } = req.body;

        if (!accountNo || !ifsc) {
            return res.status(400).json({
                success: false,
                message: 'Account number and IFSC code are required'
            });
        }

        const updates = {
            'bankDetails.accountNo': accountNo,
            'bankDetails.ifsc': ifsc,
            'bankDetails.verified': false // Reset verification status when details change
        };

        // Add passbook image if uploaded
        if (req.file) {
            // Get provider to delete old passbook image
            const provider = await Provider.findById(req.providerID);
            if (provider?.bankDetails?.passbookImage) {
                deleteFile(path.join(__dirname, '../', provider.bankDetails.passbookImage));
            }
            updates['bankDetails.passbookImage'] = req.file.path;
        }

        const updatedProvider = await Provider.findByIdAndUpdate(
            req.providerID,
            updates,
            { new: true, runValidators: true }
        ).select('-password -__v');

        if (!updatedProvider) {
            return res.status(404).json({
                success: false,
                message: 'Provider not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Bank details updated successfully. Verification will be processed.',
            provider: updatedProvider
        });
    } catch (error) {
        console.error('Update bank details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update bank details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Update provider profile picture
 * @route   PUT /api/providers/profile/picture
 * @access  Private (Provider)
 */
exports.updateProfilePicture = [
    uploadProfilePic.single('profilePic'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Profile picture is required'
                });
            }

            // Get provider to delete old picture
            const provider = await Provider.findById(req.providerID);
            if (!provider) {
                // Delete the just uploaded file if provider not found
                deleteFile(req.file.path);
                return res.status(404).json({
                    success: false,
                    message: 'Provider not found'
                });
            }

            // Delete old profile picture if it exists and not the default
            if (provider.profilePicUrl && provider.profilePicUrl !== 'default-provider.jpg') {
                deleteFile(path.join(__dirname, '../', provider.profilePicUrl));
            }

            // Update profile picture
            provider.profilePicUrl = req.file.path;
            await provider.save();

            res.status(200).json({
                success: true,
                message: 'Profile picture updated successfully',
                profilePicUrl: provider.profilePicUrl
            });
        } catch (error) {
            console.error('Update profile picture error:', error);
            // Delete the uploaded file if error occurred
            if (req.file) {
                deleteFile(req.file.path);
            }
            res.status(500).json({
                success: false,
                message: 'Failed to update profile picture',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
];

/**
 * @desc    Update provider resume
 * @route   PUT /api/providers/profile/resume
 * @access  Private (Provider)
 */
exports.updateResume = [
    uploadResume.single('resume'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Resume file is required'
                });
            }

            // Get provider to delete old resume
            const provider = await Provider.findById(req.providerID);
            if (!provider) {
                // Delete the just uploaded file if provider not found
                deleteFile(req.file.path);
                return res.status(404).json({
                    success: false,
                    message: 'Provider not found'
                });
            }

            // Delete old resume if it exists
            if (provider.resume) {
                deleteFile(path.join(__dirname, '../', provider.resume));
            }

            // Update resume
            provider.resume = req.file.path;
            await provider.save();

            res.status(200).json({
                success: true,
                message: 'Resume updated successfully',
                resumeUrl: provider.resume
            });
        } catch (error) {
            console.error('Update resume error:', error);
            // Delete the uploaded file if error occurred
            if (req.file) {
                deleteFile(req.file.path);
            }
            res.status(500).json({
                success: false,
                message: 'Failed to update resume',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
];

/**
 * @desc    Delete provider account (soft delete)
 * @route   DELETE /api/providers/profile
 * @access  Private (Provider)
 */
exports.deleteAccount = async (req, res) => {
    try {
        const provider = await Provider.findById(req.providerID);
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

        // Delete files
        if (provider.profilePicUrl && provider.profilePicUrl !== 'default-provider.jpg') {
            deleteFile(path.join(__dirname, '../', provider.profilePicUrl));
        }
        if (provider.resume) {
            deleteFile(path.join(__dirname, '../', provider.resume));
        }
        if (provider.bankDetails.passbookImage) {
            deleteFile(path.join(__dirname, '../', provider.bankDetails.passbookImage));
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


