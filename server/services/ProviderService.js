const Provider = require('../models/Provider-model');
const ProviderEarning = require('../models/ProviderEarning-model');
const PaymentRecord = require('../models/PaymentRecord-model');
const { sendOTP, verifyOTP, clearOTP } = require('../utils/otpSend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const cloudinary = require('./cloudinary'); // Updated import path for services/
const mongoose = require('mongoose');
const Booking = require('../models/Booking-model');
const Feedback = require('../models/Feedback-model');
const Complaint = require('../models/Complaint-model');
const User = require('../models/User-model');
const Admin = require('../models/Admin-model');
const { latLngToS2CellId } = require('../utils/s2Helper');
const Zone = require('../models/Zone-model');


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

const deleteFile = async (publicId) => {
    try {
        if (publicId) {
            await cloudinary.uploader.destroy(publicId);
        }
    } catch (error) {
        console.error('Failed to delete file from Cloudinary:', error);
    }
};


class ProviderService {

    static async initiateRegistration(req, res) {
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
    }

    static async completeRegistration(req, res) {
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

            // Process referral code if provided
            const referralCode = req.body.referralCode || req.body.referredByCode;
            if (referralCode) {
                try {
                    const referralController = require('./Referral-controller');
                    await referralController.processReferralRegistration(provider, 'provider', referralCode, req);
                } catch (refErr) {
                    console.error('Error handling referral during provider registration:', refErr);
                }
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
            const { SystemConfig } = require('../models/SystemSetting-model');
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
    }

    static async loginForCompletion(req, res) {
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
            const { SystemConfig } = require('../models/SystemSetting-model');
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
    }

    static async completeProfile(req, res) {
        console.log('req.files:', req.files);
        try {
            const providerId = req.providerId;
            const {
                services,
                experience,
                serviceArea,
                country,
                accountNo,
                ifsc,
                bankName,
                accountName,
                lat,
                lng,
                road,
                area,
                formattedAddress,
                addressLine,
                addressSame,
                currentAddress,
                permanentAddress,
                selfDeclaration,
                agreementAccepted,
                termsAccepted,
                privacyAccepted,
                signedName,
                signatureMethod,
                signatureImage
            } = req.body;

            // Check if KYC documents are uploaded
            const hasAadhaar = req.files && req.files['aadhaarFront'] && req.files['aadhaarBack'];
            const hasPan = req.files && req.files['panCard'];
            const hasSelfie = req.files && req.files['liveSelfie'];

            if (!hasSelfie || (!hasAadhaar && !hasPan)) {
                return res.status(400).json({
                    success: false,
                    message: 'A valid identity document (either Aadhaar Front & Back, or PAN Card) along with a Live Selfie is required'
                });
            }

            // Validate Legal Acceptance & Signature fields
            if (!selfDeclaration || !agreementAccepted || !termsAccepted || !privacyAccepted || !signedName || !signatureMethod || !signatureImage) {
                return res.status(400).json({
                    success: false,
                    message: 'Legal self declaration, agreements, signed name, signature method and signature image are required'
                });
            }

            // Validate required fields
            if (!services || !experience || !serviceArea || !accountNo || !ifsc || !currentAddress || (!addressSame && !permanentAddress)) {
                return res.status(400).json({
                    success: false,
                    message: 'All professional, bank details, and current/permanent address details are required'
                });
            }

            // Map currentAddress fields to the top-level variables for backward compatibility and location logic
            const street = currentAddress.street;
            const city = currentAddress.villageCity;
            const state = currentAddress.state;
            const postalCode = currentAddress.pincode;
            const houseNumber = currentAddress.houseNumber;
            const landmark = currentAddress.landmark;
            const pincode = currentAddress.pincode;

            // Validate IFSC using ifsc package
            const cleanIfsc = ifsc.trim().toUpperCase();
            const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
            if (!ifscRegex.test(cleanIfsc)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid IFSC format. Expected format: ABCD0123456'
                });
            }

            const isIfscValid = require('ifsc').validate(cleanIfsc);
            if (!isIfscValid) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid IFSC code. Validation failed.'
                });
            }

            let ifscDetails;
            try {
                ifscDetails = await require('ifsc').fetchDetails(cleanIfsc);
                if (!ifscDetails) throw new Error('Details not found');
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to fetch details for the provided IFSC code'
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

                const { Category } = require('../models/SystemSetting-model');
                const allCategories = await Category.find({ isActive: true }).lean();
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
                ifsc: cleanIfsc,
                bankName: ifscDetails.BANK ? `${ifscDetails.BANK}${ifscDetails.BRANCH ? ' - ' + ifscDetails.BRANCH : ''}` : (bankName || ''),
                district: ifscDetails.DISTRICT || '',
                city: ifscDetails.CITY || '',
                address: ifscDetails.ADDRESS || '',
                accountName: accountName || '',
                passbookImage: req.files && req.files['passbookImage'] ? req.files['passbookImage'][0].path : undefined,
                passbookImagePublicId: req.files && req.files['passbookImage'] ? req.files['passbookImage'][0].filename : undefined,
                verified: false
            };

            // Save profile picture if uploaded
            if (req.files && req.files['profilePic']) {
                provider.profilePicUrl = req.files['profilePic'][0].path;
                provider.profilePicPublicId = req.files['profilePic'][0].filename;
            }

            // Save KYC documents
            if (req.files) {
                if (req.files['aadhaarFront']) {
                    provider.aadhaarFront = req.files['aadhaarFront'][0].path;
                    provider.aadhaarFrontPublicId = req.files['aadhaarFront'][0].filename;
                }
                if (req.files['aadhaarBack']) {
                    provider.aadhaarBack = req.files['aadhaarBack'][0].path;
                    provider.aadhaarBackPublicId = req.files['aadhaarBack'][0].filename;
                }
                if (req.files['panCard']) {
                    provider.panCard = req.files['panCard'][0].path;
                    provider.panCardPublicId = req.files['panCard'][0].filename;
                }
                if (req.files['liveSelfie']) {
                    provider.liveSelfie = req.files['liveSelfie'][0].path;
                    provider.liveSelfiePublicId = req.files['liveSelfie'][0].filename;
                }
            }

            // Save address fields
            provider.addressSame = addressSame === 'true' || addressSame === true;
            provider.currentAddress = currentAddress;
            provider.permanentAddress = (addressSame === 'true' || addressSame === true) ? currentAddress : permanentAddress;

            // Save Legal Acceptance
            const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
            const userAgent = req.headers['user-agent'] || '';
            provider.legalAcceptance = {
                selfDeclaration: selfDeclaration === 'true' || selfDeclaration === true,
                agreementAccepted: agreementAccepted === 'true' || agreementAccepted === true,
                termsAccepted: termsAccepted === 'true' || termsAccepted === true,
                privacyAccepted: privacyAccepted === 'true' || privacyAccepted === true,
                acceptedAt: new Date(),
                ipAddress: ip,
                userAgent: userAgent,
                version: '1.0'
            };

            // Upload signature image to Cloudinary (since it comes as a base64 string)
            if (signatureImage && signatureImage.startsWith('data:image')) {
                try {
                    const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, '');
                    const sigBuffer = Buffer.from(base64Data, 'base64');
                    const sigUpload = await new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            { folder: 'provider_signatures' },
                            (error, result) => error ? reject(error) : resolve(result)
                        );
                        stream.end(sigBuffer);
                    });
                    provider.digitalSignature = {
                        signatureUrl: sigUpload.secure_url,
                        signaturePublicId: sigUpload.public_id,
                        signedName: signedName,
                        signedAt: new Date(),
                        method: signatureMethod,
                        deviceInfo: userAgent,
                        ipAddress: ip
                    };
                } catch (sigErr) {
                    console.error('Failed to upload signature image to Cloudinary:', sigErr);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to upload digital signature image'
                    });
                }
            }

            // Mark profile as complete
            provider.profileComplete = true;
            provider.registrationDate = new Date();

            // Generate and upload Agreement PDF
            try {
                const { generateAgreement, uploadPdfBuffer } = require('../services/agreementGenerator');
                const pdfBuffer = await generateAgreement(provider);
                const pdfUpload = await uploadPdfBuffer(pdfBuffer, 'provider_agreements', `agreement_${provider._id}`);
                provider.agreementPdfUrl = pdfUpload.secure_url;
                provider.agreementPdfPublicId = pdfUpload.public_id;
            } catch (pdfErr) {
                console.error('Failed to generate/upload agreement PDF:', pdfErr);
                // We do not fail the registration, but log it
            }

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
                    approved: provider.approved,
                    agreementPdfUrl: provider.agreementPdfUrl
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
    }

    static async getProfile(req, res) {
        try {

            let providerObj = await Provider.findById(req.providerId);
            if (!providerObj) {
                return res.status(404).json({
                    success: false,
                    message: 'Provider not found'
                });
            }

            // Lazy cleanup of expired referral benefits
            if (providerObj.referralBenefit && providerObj.referralBenefit.validTill && new Date(providerObj.referralBenefit.validTill) < new Date()) {
                providerObj.referralBenefit = undefined;
                await providerObj.save();
            }

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
                hasAadhaarFront: !!provider.aadhaarFront,
                hasAadhaarBack: !!provider.aadhaarBack,
                hasPanCard: !!provider.panCard,
                hasLiveSelfie: !!provider.liveSelfie,
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
    }

    static async updateProviderProfile(req, res) {
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
                updateType,
                // New settings fields
                availabilityStatus, trustedProvider, instantBookingEnabled, emergencyBookingEnabled, scheduledBookingEnabled, lastActive, providerReliabilityScore
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
                if (availabilityStatus !== undefined) updates.availabilityStatus = availabilityStatus;
                if (trustedProvider !== undefined) updates.trustedProvider = trustedProvider === 'true' || trustedProvider === true;
                if (instantBookingEnabled !== undefined) updates.instantBookingEnabled = instantBookingEnabled === 'true' || instantBookingEnabled === true;
                if (emergencyBookingEnabled !== undefined) updates.emergencyBookingEnabled = emergencyBookingEnabled === 'true' || emergencyBookingEnabled === true;
                if (scheduledBookingEnabled !== undefined) updates.scheduledBookingEnabled = scheduledBookingEnabled === 'true' || scheduledBookingEnabled === true;
                if (lastActive !== undefined) updates.lastActive = new Date(lastActive);
                if (providerReliabilityScore !== undefined) updates.providerReliabilityScore = parseFloat(providerReliabilityScore);

                if (isOnline !== undefined) {
                    updates.isOnline = isOnline === 'true' || isOnline === true;
                    if (updates.isOnline) {
                        updates.notificationPreferences = {
                            ...currentProvider.notificationPreferences,
                            bookingAlertTone: true,
                            bookingVibration: true,
                            booking: true,
                            pushEnabled: true
                        };
                    }
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

                        const { Category } = require('../models/SystemSetting-model');
                        const allCategories = await Category.find({ isActive: true }).lean();
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
                    // Validate IFSC using ifsc package
                    let ifscDetails = {};
                    let cleanIfsc = ifsc ? ifsc.trim().toUpperCase() : null;
                    if (cleanIfsc) {
                        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
                            return res.status(400).json({
                                success: false,
                                message: 'Invalid IFSC format. Expected format: ABCD0123456'
                            });
                        }

                        const isIfscValid = require('ifsc').validate(cleanIfsc);
                        if (!isIfscValid) {
                            return res.status(400).json({
                                success: false,
                                message: 'Invalid IFSC code. Validation failed.'
                            });
                        }

                        try {
                            ifscDetails = await require('ifsc').fetchDetails(cleanIfsc);
                            if (!ifscDetails) throw new Error('Details not found');
                        } catch (err) {
                            return res.status(400).json({
                                success: false,
                                message: 'Failed to fetch details for the provided IFSC code'
                            });
                        }
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
                        ...(cleanIfsc && {
                            ifsc: cleanIfsc,
                            bankName: ifscDetails.BANK ? `${ifscDetails.BANK}${ifscDetails.BRANCH ? ' - ' + ifscDetails.BRANCH : ''}` : (bankName || ''),
                            district: ifscDetails.DISTRICT || '',
                            city: ifscDetails.CITY || '',
                            address: ifscDetails.ADDRESS || ''
                        }),
                        ...(bankName && !cleanIfsc && { bankName }),
                        ...(accountName && { accountName }),
                        verified: false // Reset verification when details change
                    };
                }
            }

            // Check if KYC documents are uploaded but provider is approved
            const isKycUploadRequested = (req.files && (
                req.files['aadhaarFront'] ||
                req.files['aadhaarBack'] ||
                req.files['panCard'] ||
                req.files['liveSelfie']
            )) || (req.file && ['aadhaarFront', 'aadhaarBack', 'panCard', 'liveSelfie'].includes(req.file.fieldname));

            if (isKycUploadRequested && currentProvider.approved) {
                return res.status(400).json({
                    success: false,
                    message: 'KYC documents cannot be updated after account approval'
                });
            }

            // Parse and set address updates
            if (req.body.currentAddress) {
                updates.currentAddress = req.body.currentAddress;
                const streetVal = req.body.currentAddress.street;
                const cityVal = req.body.currentAddress.villageCity;
                const stateVal = req.body.currentAddress.state;
                const postalCodeVal = req.body.currentAddress.pincode;

                if (streetVal || cityVal || stateVal || postalCodeVal) {
                    const currentAddr = currentProvider.address || {};
                    const newLat = lat !== undefined ? (lat ? parseFloat(lat) : null) : currentAddr.lat;
                    const newLng = lng !== undefined ? (lng ? parseFloat(lng) : null) : currentAddr.lng;
                    const newS2CellId = (newLat && newLng) ? latLngToS2CellId(newLat, newLng, 13) : currentAddr.s2CellId || null;
                    const newS2CellIdPrecise = (newLat && newLng) ? latLngToS2CellId(newLat, newLng, 20) : currentAddr.s2CellIdPrecise || null;

                    updates.address = {
                        ...currentAddr,
                        ...(streetVal && { street: streetVal }),
                        ...(cityVal && { city: cityVal }),
                        ...(stateVal && { state: stateVal }),
                        ...(postalCodeVal && { postalCode: postalCodeVal }),
                        lat: newLat,
                        lng: newLng,
                        s2CellId: newS2CellId,
                        s2CellIdPrecise: newS2CellIdPrecise,
                        houseNumber: req.body.currentAddress.houseNumber || currentAddr.houseNumber,
                        landmark: req.body.currentAddress.landmark || currentAddr.landmark,
                        pincode: req.body.currentAddress.pincode || currentAddr.pincode
                    };
                }
            }

            if (req.body.addressSame !== undefined) {
                updates.addressSame = req.body.addressSame === 'true' || req.body.addressSame === true;
            }

            if (req.body.permanentAddress) {
                updates.permanentAddress = req.body.permanentAddress;
            } else if (updates.addressSame || (req.body.addressSame === undefined && currentProvider.addressSame)) {
                updates.permanentAddress = req.body.currentAddress || currentProvider.currentAddress;
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

                // KYC Uploads
                if (req.files['aadhaarFront']) {
                    const fileObj = req.files['aadhaarFront'][0];
                    if (currentProvider.aadhaarFrontPublicId) {
                        await deleteFile(currentProvider.aadhaarFrontPublicId);
                    }
                    updates.aadhaarFront = fileObj.path;
                    updates.aadhaarFrontPublicId = fileObj.filename;
                    successMessage = 'Aadhaar Front updated successfully';
                }
                if (req.files['aadhaarBack']) {
                    const fileObj = req.files['aadhaarBack'][0];
                    if (currentProvider.aadhaarBackPublicId) {
                        await deleteFile(currentProvider.aadhaarBackPublicId);
                    }
                    updates.aadhaarBack = fileObj.path;
                    updates.aadhaarBackPublicId = fileObj.filename;
                    successMessage = 'Aadhaar Back updated successfully';
                }
                if (req.files['panCard']) {
                    const fileObj = req.files['panCard'][0];
                    if (currentProvider.panCardPublicId) {
                        await deleteFile(currentProvider.panCardPublicId);
                    }
                    updates.panCard = fileObj.path;
                    updates.panCardPublicId = fileObj.filename;
                    successMessage = 'PAN Card updated successfully';
                }
                if (req.files['liveSelfie']) {
                    const fileObj = req.files['liveSelfie'][0];
                    if (currentProvider.liveSelfiePublicId) {
                        await deleteFile(currentProvider.liveSelfiePublicId);
                    }
                    updates.liveSelfie = fileObj.path;
                    updates.liveSelfiePublicId = fileObj.filename;
                    successMessage = 'Live Selfie updated successfully';
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
                } else if (fieldName === 'aadhaarFront') {
                    if (currentProvider.aadhaarFrontPublicId) {
                        await deleteFile(currentProvider.aadhaarFrontPublicId);
                    }
                    updates.aadhaarFront = req.file.path;
                    updates.aadhaarFrontPublicId = req.file.filename;
                    successMessage = 'Aadhaar Front updated successfully';
                } else if (fieldName === 'aadhaarBack') {
                    if (currentProvider.aadhaarBackPublicId) {
                        await deleteFile(currentProvider.aadhaarBackPublicId);
                    }
                    updates.aadhaarBack = req.file.path;
                    updates.aadhaarBackPublicId = req.file.filename;
                    successMessage = 'Aadhaar Back updated successfully';
                } else if (fieldName === 'panCard') {
                    if (currentProvider.panCardPublicId) {
                        await deleteFile(currentProvider.panCardPublicId);
                    }
                    updates.panCard = req.file.path;
                    updates.panCardPublicId = req.file.filename;
                    successMessage = 'PAN Card updated successfully';
                } else if (fieldName === 'liveSelfie') {
                    if (currentProvider.liveSelfiePublicId) {
                        await deleteFile(currentProvider.liveSelfiePublicId);
                    }
                    updates.liveSelfie = req.file.path;
                    updates.liveSelfiePublicId = req.file.filename;
                    successMessage = 'Live Selfie updated successfully';
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

            // Auto-regenerate agreement PDF if legalAcceptance exists
            if (updatedProvider.legalAcceptance && updatedProvider.legalAcceptance.agreementAccepted) {
                try {
                    const { generateAgreement, generateApprovalLetter, uploadPdfBuffer } = require('../services/agreementGenerator');

                    // Regenerate agreement PDF
                    const pdfBuffer = await generateAgreement(updatedProvider);
                    if (updatedProvider.agreementPdfPublicId) {
                        await deleteFile(updatedProvider.agreementPdfPublicId);
                    }
                    const pdfUpload = await uploadPdfBuffer(pdfBuffer, 'provider_agreements', `agreement_${updatedProvider._id}`);
                    updatedProvider.agreementPdfUrl = pdfUpload.secure_url;
                    updatedProvider.agreementPdfPublicId = pdfUpload.public_id;

                    // Regenerate approval letter PDF if already approved
                    if (updatedProvider.approved) {
                        const approvalBuffer = await generateApprovalLetter(updatedProvider, updatedProvider.rejectionReason || '');
                        if (updatedProvider.approvalLetterPublicId) {
                            await deleteFile(updatedProvider.approvalLetterPublicId);
                        }
                        const approvalUpload = await uploadPdfBuffer(approvalBuffer, 'provider_approval_letters', `approval_${updatedProvider._id}`);
                        updatedProvider.approvalLetterUrl = approvalUpload.secure_url;
                        updatedProvider.approvalLetterPublicId = approvalUpload.public_id;
                    }

                    await updatedProvider.save();
                } catch (pdfErr) {
                    console.error('Failed to regenerate PDFs during profile update:', pdfErr);
                }
            }

            res.status(200).json({
                success: true,
                message: successMessage,
                provider: updatedProvider.toJSON()
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
    }

    static async viewDocument(req, res) {
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
                case 'aadhaarFront':
                    fileUrl = provider.aadhaarFront;
                    publicId = provider.aadhaarFrontPublicId;
                    fileName = 'aadhaarFront';
                    break;
                case 'aadhaarBack':
                    fileUrl = provider.aadhaarBack;
                    publicId = provider.aadhaarBackPublicId;
                    fileName = 'aadhaarBack';
                    break;
                case 'panCard':
                    fileUrl = provider.panCard;
                    publicId = provider.panCardPublicId;
                    fileName = 'panCard';
                    break;
                case 'liveSelfie':
                    fileUrl = provider.liveSelfie;
                    publicId = provider.liveSelfiePublicId;
                    fileName = 'liveSelfie';
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
                        message: 'Invalid document type. Use: aadhaarFront, aadhaarBack, panCard, liveSelfie, passbook, or profile'
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
    }

    static async deleteAccount(req, res) {
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

            try {
                const { getIO } = require('../socket/socketServer');
                const io = getIO();
                if (io) {
                    const payload = { providerId: provider._id.toString(), status: 'deleted', isDeleted: true };
                    io.to(provider._id.toString()).emit('provider-status-changed', payload);
                    io.to('admin_live_room').emit('provider-status-changed', payload);
                }
            } catch (e) {
                console.error("Failed to emit provider deleted event:", e);
            }

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
    }

    static async permanentDeleteAccount(req, res) {
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
            if (provider.aadhaarFrontPublicId) {
                await deleteFile(provider.aadhaarFrontPublicId);
            }
            if (provider.aadhaarBackPublicId) {
                await deleteFile(provider.aadhaarBackPublicId);
            }
            if (provider.panCardPublicId) {
                await deleteFile(provider.panCardPublicId);
            }
            if (provider.liveSelfiePublicId) {
                await deleteFile(provider.liveSelfiePublicId);
            }
            if (provider.bankDetails?.passbookImagePublicId) {
                await deleteFile(provider.bankDetails.passbookImagePublicId);
            }

            // Permanent delete
            await Provider.findByIdAndDelete(req.params.id);

            try {
                const { getIO } = require('../socket/socketServer');
                const io = getIO();
                if (io) {
                    const payload = { providerId: req.params.id, status: 'deleted', isDeleted: true };
                    io.to(req.params.id).emit('provider-status-changed', payload);
                    io.to('admin_live_room').emit('provider-status-changed', payload);
                }
            } catch (e) {
                console.error("Failed to emit provider permanent delete event:", e);
            }

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
    }

    static async getDashboardData(req, res) {
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
                lastPayout,
                recentBookings
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
                            status: 'Completed',
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
                }).sort({ updatedAt: -1 }).lean(),

                // 12. Recent bookings
                Booking.find({ provider: providerId })
                    .populate('customer', 'name phone')
                    .populate('services.service', 'title')
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean()
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
                const statusKey = stat._id ? stat._id.toLowerCase() : '';
                switch (statusKey) {
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

                const label = statusLabels[statusKey] || (stat._id ? stat._id.charAt(0).toUpperCase() + stat._id.slice(1) : '');
                statusBreakdown[stat._id] = stat.count;
                pieChartData.push({
                    name: label,
                    value: stat.count,
                    status: stat._id
                });
            });

            const earnings = combinedEarnings[0] || { totalEarnings: 0, todaysEarnings: 0 };
            const averageRating = ratingStats.length > 0 ? parseFloat(ratingStats[0].averageRating.toFixed(1)) : 0;

            // Batch fetch earnings for all retrieved bookings to avoid N+1 queries
            const allJobIds = [
                ...todayJobs.map(j => j._id),
                ...upcomingJobs.map(j => j._id),
                ...recentBookings.map(j => j._id)
            ];
            const earningsList = await ProviderEarning.find({ booking: { $in: allJobIds } }).lean();
            const earningsMap = {};
            earningsList.forEach(e => {
                if (e.booking) {
                    earningsMap[e.booking.toString()] = e;
                }
            });

            // Process jobs with payout status helper (in-memory mapping)
            const jobsWithPayoutStatus = (jobs) => {
                return jobs.map(job => {
                    const earning = earningsMap[job._id.toString()];
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
                });
            };

            const todayJobsList = jobsWithPayoutStatus(todayJobs);
            const upcomingJobsList = jobsWithPayoutStatus(upcomingJobs);
            const recentJobsList = jobsWithPayoutStatus(recentBookings);

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

            const performance = provider?.performanceScore || {};

            let totalRelevant = 0;
            bookingStats.forEach(stat => {
                const statusKey = stat._id ? stat._id.toLowerCase() : '';
                if (['accepted', 'inprogress', 'in-progress', 'completed', 'cancelled', 'scheduled'].includes(statusKey)) {
                    totalRelevant += stat.count;
                }
            });

            // Calculate performance rating values (Lazy loaded only if not present in performance Score)
            let completionRate = 0;
            let onTimeRate = 0;

            if (performance.completionPercentage === undefined || performance.onTimePercentage === undefined) {
                const completedJobsCount = bookingStats.find(stat => stat._id?.toLowerCase() === 'completed')?.count || 0;
                completionRate = totalRelevant > 0 ? parseFloat(((completedJobsCount / totalRelevant) * 100).toFixed(1)) : 0;

                if (performance.onTimePercentage === undefined && completedJobsCount > 0) {
                    const completedJobs = await Booking.find({ provider: providerId, status: 'Completed' }).select('completedAt date time').lean();
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
                    onTimeRate = completedJobs.length > 0 ? parseFloat(((onTimeCompleted / completedJobs.length) * 100).toFixed(1)) : 0;
                }
            }

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
                        upcomingJobs: upcomingJobsList,
                        recentBookings: recentJobsList
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
    }

    static async getAgreementPdf(req, res) {
        try {
            const provider = await Provider.findById(req.providerId);
            if (!provider) {
                return res.status(404).json({ success: false, message: 'Provider not found' });
            }

            if (provider.agreementPdfUrl) {
                return res.status(200).json({ success: true, url: provider.agreementPdfUrl });
            }

            // Generate dynamically if missing but has accepted terms
            if (provider.legalAcceptance && provider.legalAcceptance.agreementAccepted) {
                const { generateAgreement, uploadPdfBuffer } = require('../services/agreementGenerator');
                const pdfBuffer = await generateAgreement(provider);
                const pdfUpload = await uploadPdfBuffer(pdfBuffer, 'provider_agreements', `agreement_${provider._id}`);
                provider.agreementPdfUrl = pdfUpload.secure_url;
                provider.agreementPdfPublicId = pdfUpload.public_id;
                await provider.save();
                return res.status(200).json({ success: true, url: provider.agreementPdfUrl });
            }

            return res.status(400).json({ success: false, message: 'Agreement PDF not generated yet' });
        } catch (error) {
            console.error('Get agreement PDF error:', error);
            res.status(500).json({ success: false, message: 'Server error while fetching agreement PDF' });
        }
    }

}

module.exports = ProviderService;

