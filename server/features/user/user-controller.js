const moment = require('moment');
const mongoose = require('mongoose');
const Booking = require('../booking/booking-model');
const Complaint = require('../complaint/complaint-model');
const Transaction = require('../payment/transaction-model');
const Coupon = require('../coupon/coupon-model');
const User = require('./user-model');
const Provider = require('../provider/provider-model');
const Admin = require('../admin/admin-model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { uploadProfilePic } = require('../../shared/middlewares/upload');
const path = require('path');
const fs = require('fs');
const { latLngToS2CellId } = require('../../shared/utils/s2-helper');
const Zone = require('../zone/zone-model');

/**
 * Register a new user
 */
const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    return "Name is required";
  }
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    return "Name must be at least 2 characters long";
  }
  if (trimmedName.length > 50) {
    return "Name must not exceed 50 characters";
  }
  if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
    return "Name can only contain letters and spaces";
  }
  return null;
};

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return "Email is required";
  }
  const trimmedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return "Please provide a valid email address";
  }
  return null;
};

const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return "Phone number is required";
  }
  const trimmedPhone = phone.trim().replace(/\s+/g, '');
  // Indian mobile number validation (10 digits starting with 6-9)
  if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
    return "Please provide a valid 10-digit Indian mobile number";
  }
  return null;
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return "Password is required";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  if (password.length > 128) {
    return "Password must not exceed 128 characters";
  }
  if (!/(?=.*[a-z])/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/(?=.*[A-Z])/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/(?=.*\d)/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
};

const validateAddress = (address) => {
  const errors = {};

  if (!address || typeof address !== 'object') {
    return { address: "Address information is required" };
  }

  // Validate street
  if (!address.street || typeof address.street !== 'string') {
    errors['address.street'] = "Street address is required";
  } else if (address.street.trim().length < 5) {
    errors['address.street'] = "Street address must be at least 5 characters long";
  } else if (address.street.trim().length > 100) {
    errors['address.street'] = "Street address must not exceed 100 characters";
  }

  // Validate city
  if (!address.city || typeof address.city !== 'string') {
    errors['address.city'] = "City is required";
  } else if (address.city.trim().length < 2) {
    errors['address.city'] = "City must be at least 2 characters long";
  } else if (address.city.trim().length > 50) {
    errors['address.city'] = "City must not exceed 50 characters";
  } else if (!/^[a-zA-Z\s]+$/.test(address.city.trim())) {
    errors['address.city'] = "City can only contain letters and spaces";
  }

  // Validate postalCode (optional)
  if (address.postalCode !== undefined && address.postalCode !== null && address.postalCode !== '') {
    if (typeof address.postalCode !== 'string') {
      errors['address.postalCode'] = "Postal code must be a number";
    } else if (!/^\d{6}$/.test(address.postalCode.trim())) {
      errors['address.postalCode'] = "Postal code must be a valid 6-digit number";
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

/**
 * Comprehensive validation function
 */
const validateRegistrationData = (data) => {
  const errors = {};

  // Validate individual fields
  const nameError = validateName(data.name);
  if (nameError) errors.name = nameError;

  const emailError = validateEmail(data.email);
  if (emailError) errors.email = emailError;

  const phoneError = validatePhone(data.phone);
  if (phoneError) errors.phone = phoneError;

  const passwordError = validatePassword(data.password);
  if (passwordError) errors.password = passwordError;

  // Validate address if provided (required for final registration)
  if (data.address) {
    const addressErrors = validateAddress(data.address);
    if (addressErrors) {
      Object.assign(errors, addressErrors);
    }
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, address, profilePicUrl } = req.body;

    // Validate registration data including address
    const validationErrors = validateRegistrationData({ name, email, phone, password, address });

    if (validationErrors) {
      const firstErrorMsg = Object.values(validationErrors).flat()[0] || "Validation failed";
      return res.status(400).json({
        success: false,
        message: firstErrorMsg,
        error: firstErrorMsg,
        errors: validationErrors
      });
    }

    // Check if user already exists (including cross-user-type email check)
    const [userExists, emailExistsInProvider, emailExistsInAdmin] = await Promise.all([
      User.findOne({
        $or: [
          { email: email.trim().toLowerCase() },
          { phone: phone.trim().replace(/\s+/g, '') }
        ]
      }),
      Provider.findOne({
        email: { $regex: new RegExp(`^${email.trim().toLowerCase()}$`, 'i') },
        isDeleted: false
      }),
      Admin.findOne({
        email: email.trim().toLowerCase()
      })
    ]);

    if (userExists || emailExistsInProvider || emailExistsInAdmin) {
      const errors = {};

      const checkEmail = email.trim().toLowerCase();

      if (userExists && userExists.email && userExists.email.toLowerCase() === checkEmail) {
        errors.email = "Email is already registered";
      } else if (emailExistsInProvider) {
        errors.email = "Email is already registered";
      } else if (emailExistsInAdmin) {
        errors.email = "Email is already registered";
      }

      if (userExists && userExists.phone === phone.trim().replace(/\s+/g, '')) {
        errors.phone = "Phone number is already registered";
      }

      // Fallback if no specific field was matched
      if (Object.keys(errors).length === 0) {
        errors.email = "Email or Phone is already registered";
      }

      return res.status(400).json({
        success: false,
        message: "User already exists",
        errors
      });
    }

    // Create user with validated and sanitized data
    const userData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: password,
      phone: phone.trim().replace(/\s+/g, ''),
      profilePicUrl,
      role: 'customer',
      metadata: {
        ip: req.clientIp || req.ip || req.socket?.remoteAddress || '',
        device: req.deviceFingerprint || '',
        userAgent: req.headers['user-agent'],
        lastLogin: new Date()
      }
    };

    // Add address if provided
    if (address) {
      userData.address = {
        street: address.street ? address.street.trim() : undefined,
        city: address.city ? address.city.trim() : undefined,
        state: address.state ? address.state.trim() : undefined,
        postalCode: address.postalCode ? address.postalCode.trim() : undefined,
        country: address.country ? address.country.trim() : 'India',
        lat: typeof address.lat === 'number' ? address.lat : (address.lat ? parseFloat(address.lat) : 0),
        lng: typeof address.lng === 'number' ? address.lng : (address.lng ? parseFloat(address.lng) : 0),
        houseNumber: address.houseNumber ? address.houseNumber.trim() : undefined,
        road: address.road ? address.road.trim() : undefined,
        landmark: address.landmark ? address.landmark.trim() : undefined,
        area: address.area ? address.area.trim() : undefined,
        pincode: address.pincode ? address.pincode.trim() : undefined,
        formattedAddress: address.formattedAddress ? address.formattedAddress.trim() : undefined,
        addressLine: address.addressLine ? address.addressLine.trim() : undefined
      };
      if (typeof userData.address.lat === 'number' && typeof userData.address.lng === 'number' && !isNaN(userData.address.lat) && !isNaN(userData.address.lng)) {
        userData.currentLocation = {
          type: 'Point',
          coordinates: [userData.address.lng, userData.address.lat]
        };

        // Auto-detect zone from address coordinates during registration
        try {
          const detectedZone = await Zone.findZoneByCoordinates(userData.address.lat, userData.address.lng);
          userData.currentZone = detectedZone ? detectedZone._id : null;
          userData.zoneUpdatedAt = new Date();
        } catch (zoneErr) {
          global.logger.error('Zone detection error during registration: ' + zoneErr.message, zoneErr);
          userData.currentZone = null;
          userData.zoneUpdatedAt = new Date();
        }
      }
    }

    const user = await User.create(userData);

    // Process referral code if provided
    const referralCode = req.body.referralCode || req.body.referredByCode;
    if (referralCode) {
      try {
        const referralController = require('../referral/referral-controller');
        await referralController.processReferralRegistration(user, 'customer', referralCode, req);
      } catch (refErr) {
        global.logger.error('Error handling referral during registration: ' + refErr.message, refErr);
      }
    }

    // Track registration event with threshold check (>3 accounts in 24h)
    const FraudLog = require('../fraud/fraud-log-model');
    const recentRegistrations = await FraudLog.countDocuments({
      ip: req.clientIp,
      actionType: 'registration',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    const isSuspicious = recentRegistrations >= 3;
    const flagReason = isSuspicious ? 'More than 3 accounts registered from same IP in 24 hours' : 'Normal registration';

    const { trackEvent } = require('../../shared/middlewares/fraud-middleware');
    await trackEvent({
      req,
      actionType: 'registration',
      userId: user._id,
      userModel: 'User',
      role: 'customer',
      fraudScore: isSuspicious ? 60 : 0,
      riskLevel: isSuspicious ? 'HIGH' : 'LOW',
      flagReason
    });

    // Generate JWT token
    const { SystemConfig } = require('../system-setting/system-setting-model');
    const settings = await SystemConfig.findOne();
    const sessionTimeoutHours = settings?.securitySettings?.sessionTimeoutHours || 24;
    const token = user.generateJWT(sessionTimeoutHours);

    // Prepare response
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      address: user.address,
      firstBookingUsed: user.firstBookingUsed,
      profilePicUrl: user.profilePicUrl,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: "Registration completed successfully",
      token,
      user: userResponse
    });

  } catch (error) {
    global.logger.error(`[UserController.register] Route: ${req.originalUrl || req.url} - Registration error: ${error.message}`, error);

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });

      const firstMsg = Object.values(errors)[0] || "Validation failed";
      return res.status(400).json({
        success: false,
        message: firstMsg,
        error: firstMsg,
        errors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const errors = {};
      errors[field] = `${field.charAt(0).toUpperCase() + field.slice(1)} is already registered`;

      return res.status(400).json({
        success: false,
        message: "User already exists",
        errors
      });
    }

    next(error);
  }
};



/**
 * Get current user profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -__v')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Enhance favoriteProviders with ratings and other provider details
    let enrichedFavorites = [];
    if (user.favoriteProviders && user.favoriteProviders.length > 0) {
      const providerIds = user.favoriteProviders.map(fav => fav.providerId).filter(Boolean);
      const providers = await Provider.find({ _id: { $in: providerIds } })
        .select('performanceScore.rating profilePicUrl isOnline isActive approved services completedBookings')
        .populate('services', 'name')
        .lean();

      const providerMap = {};
      providers.forEach(p => {
        providerMap[p._id.toString()] = p;
      });

      enrichedFavorites = user.favoriteProviders.map(fav => {
        const prov = providerMap[fav.providerId?.toString()];
        if (prov) {
          const categoryNames = prov.services && prov.services.length > 0
            ? prov.services.map(s => s.name).join(', ')
            : 'N/A';

          return {
            ...fav,
            rating: prov.performanceScore?.rating || 0,
            profilePicUrl: prov.profilePicUrl,
            isOnline: prov.isOnline,
            isActive: prov.isActive,
            approved: prov.approved,
            category: categoryNames,
            completedBookings: prov.completedBookings || 0
          };
        } else {
          return {
            ...fav,
            rating: 0,
            category: fav.category || 'N/A',
            completedBookings: 0
          };
        }
      });
    }

    const totalBookings = await Booking.countDocuments({ customer: req.user._id });

    // Update user with calculated values
    const updatedUser = {
      ...user,
      favoriteProviders: enrichedFavorites,
      totalBookings
    };

    // Optionally update the stored values in DB for future use only if changed
    if (user.totalBookings !== totalBookings) {
      await User.updateOne({ _id: req.user._id }, { totalBookings });
    }

    res.status(200).json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    global.logger.error(`[UserController.getProfile] Route: ${req.originalUrl || req.url} - Get profile error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Update user profile (text fields)
 */
const updateProfile = async (req, res, next) => {
  try {
    const updates = {
      name: req.body.name,
      phone: req.body.phone
    };

    if (req.body.address) {
      const address = req.body.address;
      const latVal = typeof address.lat === 'number' ? address.lat : (address.lat ? parseFloat(address.lat) : 0);
      const lngVal = typeof address.lng === 'number' ? address.lng : (address.lng ? parseFloat(address.lng) : 0);
      // Resolve zone based on coordinates using existing Zone model helper
      let zone = null;
      if (latVal && lngVal && !isNaN(latVal) && !isNaN(lngVal)) {
        try {
          zone = await Zone.findZoneByCoordinates(latVal, lngVal);
        } catch (err) {
          global.logger.error('Zone resolution error: ' + err.message, err);
        }
      }

      // Compute S2 Cell IDs explicitly (findByIdAndUpdate bypasses pre-save hooks)
      const s2CellId = (latVal && lngVal && !isNaN(latVal) && !isNaN(lngVal)) ? latLngToS2CellId(latVal, lngVal, 13) : (address.s2CellId || null);
      const s2CellIdPrecise = (latVal && lngVal && !isNaN(latVal) && !isNaN(lngVal)) ? latLngToS2CellId(latVal, lngVal, 20) : (address.s2CellIdPrecise || null);

      updates.address = {
        street: address.street ? address.street.trim() : undefined,
        city: address.city ? address.city.trim() : undefined,
        state: address.state ? address.state.trim() : undefined,
        postalCode: address.postalCode ? address.postalCode.trim() : undefined,
        country: address.country ? address.country.trim() : 'India',
        lat: latVal,
        lng: lngVal,
        s2CellId,
        s2CellIdPrecise,
        houseNumber: address.houseNumber ? address.houseNumber.trim() : undefined,
        road: address.road ? address.road.trim() : undefined,
        landmark: address.landmark ? address.landmark.trim() : undefined,
        area: address.area ? address.area.trim() : undefined,
        pincode: address.pincode ? address.pincode.trim() : undefined,
        formattedAddress: address.formattedAddress ? address.formattedAddress.trim() : undefined,
        addressLine: address.addressLine ? address.addressLine.trim() : undefined
      };

      // Always update zone fields — set to detected zone or null if not found
      updates.currentZone = zone ? zone._id : null;
      updates.zoneUpdatedAt = new Date();
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    global.logger.error(`[UserController.updateProfile] Route: ${req.originalUrl || req.url} - Update profile error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Upload profile picture
 */
const uploadProfilePicture = async (req, res, next) => {
  try {
    global.logger.info('Upload request received'); // Debug log
    global.logger.info('File: ' + JSON.stringify(req.file)); // Debug log

    if (!req.file) {
      global.logger.info('No file in request'); // Debug log
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // For Cloudinary uploads, req.file.path contains the full Cloudinary URL
    const cloudinaryUrl = req.file.path;

    // Update user's profile picture URL with Cloudinary URL
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicUrl: cloudinaryUrl },
      { new: true }
    ).select('-password -__v');

    global.logger.info('User updated with Cloudinary URL: ' + cloudinaryUrl); // Debug log

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicUrl: cloudinaryUrl,
      user
    });
  } catch (error) {
    global.logger.error(`[UserController.uploadProfilePicture] Route: ${req.originalUrl || req.url} - Upload profile picture error: ${error.message}`, error);
    next(error);
  }
};


/**
 * @desc    Get customer dashboard stats
 * @route   GET /api/customer/dashboard/stats
 * @access  Private (Customer)
 */
const getCustomerDashboardStats = async (req, res, next) => {
  try {
    const customerId = req.user._id; // Get customer ID from authenticated user

    // Set date ranges
    const today = moment().startOf('day');
    const currentWeek = moment().startOf('week');
    const currentMonth = moment().startOf('month');
    const currentYear = moment().startOf('year');

    // Parallelize all database queries for better performance
    const [
      bookingStatusStats,
      spendingStats,
      complaintStats,
      couponStats,
      recentBookings,
      favoriteServices,
      recentTransactions
    ] = await Promise.all([
      // Booking status and counts aggregation (combined)
      Booking.aggregate([
        { $match: { customer: new mongoose.Types.ObjectId(customerId) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            todayBookings: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', today.toDate()] }, 1, 0]
              }
            },
            weeklyBookings: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', currentWeek.toDate()] }, 1, 0]
              }
            },
            monthlyBookings: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', currentMonth.toDate()] }, 1, 0]
              }
            },
            yearlyBookings: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', currentYear.toDate()] }, 1, 0]
              }
            }
          }
        }
      ]).lean(),

      // Spending calculations
      Transaction.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(customerId),
            paymentStatus: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalSpent: { $sum: '$amount' },
            todaySpent: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', today.toDate()] },
                  '$amount',
                  0
                ]
              }
            },
            weeklySpent: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', currentWeek.toDate()] },
                  '$amount',
                  0
                ]
              }
            },
            monthlySpent: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', currentMonth.toDate()] },
                  '$amount',
                  0
                ]
              }
            },
            yearlySpent: {
              $sum: {
                $cond: [
                  { $gte: ['$createdAt', currentYear.toDate()] },
                  '$amount',
                  0
                ]
              }
            }
          }
        }
      ]).lean(),

      // Complaint statistics
      Complaint.aggregate([
        { $match: { customer: new mongoose.Types.ObjectId(customerId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]).lean(),

      // Coupon statistics
      Promise.all([
        Coupon.countDocuments({
          $or: [{ assignedTo: new mongoose.Types.ObjectId(customerId) }, { isGlobal: true }],
          isActive: true,
          expiryDate: { $gte: new Date() },
          "usedBy.user": { $ne: new mongoose.Types.ObjectId(customerId) }
        }),
        Coupon.countDocuments({
          "usedBy.user": new mongoose.Types.ObjectId(customerId)
        })
      ]),

      // Recent bookings (last 5)
      Booking.find({ customer: customerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('provider', 'name')
        .populate('services.service', 'title')
        .lean(),

      // Favorite services (most booked)
      Booking.aggregate([
        {
          $match: {
            customer: new mongoose.Types.ObjectId(customerId),
            status: { $in: ['completed', 'accepted'] }
          }
        },
        { $unwind: '$services' },
        { $group: { _id: '$services.service', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 },
        {
          $lookup: {
            from: 'services',
            localField: '_id',
            foreignField: '_id',
            as: 'service'
          }
        },
        { $unwind: '$service' },
        {
          $project: {
            _id: 0,
            serviceId: '$service._id',
            serviceName: '$service.title',
            category: '$service.category',
            count: 1
          }
        }
      ]).lean(),

      // Recent transactions (last 5)
      Transaction.find({ user: customerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('booking', 'services')
        .lean()
    ]);

    // Process the booking results
    let totalBookings = 0;
    let todayBookings = 0;
    let weeklyBookings = 0;
    let monthlyBookings = 0;
    let yearlyBookings = 0;
    const bookingStatusCounts = { pending: 0, accepted: 0, completed: 0, cancelled: 0 };

    bookingStatusStats.forEach(item => {
      const count = item.count || 0;
      totalBookings += count;
      todayBookings += (item.todayBookings || 0);
      weeklyBookings += (item.weeklyBookings || 0);
      monthlyBookings += (item.monthlyBookings || 0);
      yearlyBookings += (item.yearlyBookings || 0);
      if (item._id) {
        bookingStatusCounts[item._id] = count;
      }
    });

    // Process the spending results
    const spending = spendingStats[0] || {
      totalSpent: 0,
      todaySpent: 0,
      weeklySpent: 0,
      monthlySpent: 0,
      yearlySpent: 0
    };

    const complaintStatusCounts = complaintStats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, { open: 0, resolved: 0 });

    // Prepare the response
    const dashboardStats = {
      overview: {
        totalBookings,
        todayBookings,
        weeklyBookings,
        monthlyBookings,
        yearlyBookings,
        bookingStatus: bookingStatusCounts,
        totalSpent: spending.totalSpent,
        todaySpent: spending.todaySpent,
        weeklySpent: spending.weeklySpent,
        monthlySpent: spending.monthlySpent,
        yearlySpent: spending.yearlySpent,
        availableCoupons: couponStats[0],
        usedCoupons: couponStats[1]
      },
      complaints: complaintStatusCounts,
      recentBookings,
      favoriteServices,
      recentTransactions
    };

    res.json({
      success: true,
      data: dashboardStats
    });

  } catch (error) {
    global.logger.error(`[UserController.getCustomerDashboardStats] Route: ${req.originalUrl || req.url} - Error fetching customer dashboard stats: ${error.message}`, error);
    next(error);
  }
};

/**
 * @desc    Get customer wallet history
 * @route   GET /api/user/wallet/history
 * @access  Private (Customer)
 */
const getWalletHistory = async (req, res, next) => {
  try {
    const { SystemConfig } = require('../system-setting/system-setting-model');
    const settings = await SystemConfig.findOne();
    if (settings?.featureFlags?.walletEnabled === false) {
      return res.status(403).json({
        success: false,
        message: 'Wallet feature is currently disabled.'
      });
    }

    const user = await User.findById(req.user._id)
      .select('wallet')
      .populate({
        path: 'wallet.walletTransactions.booking',
        select: 'bookingId status totalAmount'
      })
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const transactions = user.wallet?.walletTransactions || [];

    // Retrieve raw transactions to access original booking ObjectIds if populate returned null
    const rawUser = await User.findById(req.user._id).select('wallet').lean();
    const rawTxns = rawUser?.wallet?.walletTransactions || [];

    const mappedTxns = transactions.map((txn, idx) => {
      const rawTxn = rawTxns.find(rt => rt._id && txn._id && rt._id.toString() === txn._id.toString()) || rawTxns[idx];
      const rawBookingId = rawTxn?.booking;
      const storedBookingId = rawTxn?.bookingId || txn.bookingId;

      let bookingData = txn.booking;
      let reasonText = txn.reason;

      // Extract booking ID from reason description if present (e.g. for referrals)
      const reasonMatch = txn.reason?.match(/(BK-[A-Z0-9-]+)/i)?.[0];
      if (reasonMatch) {
        reasonText = txn.reason.replace(new RegExp(`\\s*\\(${reasonMatch}\\)|\\s*${reasonMatch}`, 'i'), '');
      }

      const finalBookingId = (bookingData && bookingData.bookingId) || storedBookingId || reasonMatch;

      if (!bookingData) {
        if (finalBookingId) {
          bookingData = {
            _id: rawBookingId || null,
            bookingId: finalBookingId,
            status: 'deleted'
          };
        } else if (rawBookingId) {
          const hex = rawBookingId.toString();
          const suffix = hex.substring(hex.length - 6).toUpperCase();
          bookingData = {
            _id: rawBookingId,
            bookingId: `BK-DEL-${suffix}`,
            status: 'deleted'
          };
        }
      }

      return {
        ...txn,
        reason: reasonText,
        booking: bookingData
      };
    });

    res.status(200).json({
      success: true,
      count: mappedTxns.length,
      data: mappedTxns.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )
    });
  } catch (error) {
    global.logger.error(`[UserController.getWalletHistory] Route: ${req.originalUrl || req.url} - Wallet history error: ${error.message}`, error);
    next(error);
  }
};

const toggleFavoriteProvider = async (req, res, next) => {
  try {
    const { providerId, providerName, category } = req.body;
    if (!providerId) {
      return res.status(400).json({ success: false, message: 'Provider ID is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify provider exists in database
    const prov = await Provider.findById(providerId)
      .select('name services approved isActive role')
      .populate('services', 'name')
      .lean();

    if (!prov) {
      return res.status(404).json({ success: false, message: 'Provider not found or has been removed' });
    }

    if (!user.favoriteProviders) {
      user.favoriteProviders = [];
    }

    // Clean up any historical duplicates and check existence
    const existingCount = user.favoriteProviders.filter(
      fp => fp.providerId && fp.providerId.toString() === providerId.toString()
    ).length;

    let isFavorite = false;
    if (existingCount > 0) {
      // Remove all duplicate instances (unfavorite)
      user.favoriteProviders = user.favoriteProviders.filter(
        fp => !fp.providerId || fp.providerId.toString() !== providerId.toString()
      );
      isFavorite = false;
    } else {
      const categoryNames = prov && prov.services && prov.services.length > 0
        ? prov.services.map(s => s.name).join(', ')
        : (category || 'N/A');

      user.favoriteProviders.push({
        providerId: prov._id,
        providerName: prov.name || providerName || 'Provider',
        category: categoryNames,
        lastBookedAt: new Date()
      });
      isFavorite = true;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: isFavorite ? 'Added to favorites' : 'Removed from favorites',
      isFavorite,
      favoriteProviders: user.favoriteProviders
    });
  } catch (error) {
    global.logger.error(`[UserController.toggleFavoriteProvider] Route: ${req.originalUrl || req.url} - Error toggling favorite provider: ${error.message}`, error);
    next(error);
  }
};

const checkFavoriteProviderAvailability = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const { categoryId } = req.query;

    const providerDoc = await Provider.findById(providerId);
    if (!providerDoc) {
      return res.status(404).json({ success: false, isAvailable: false, message: 'Provider not found' });
    }

    // Smart rules: approved, online, active, service category matches
    const isApproved = providerDoc.approved === true;
    const isOnline = providerDoc.isOnline === true;
    const isActive = providerDoc.isActive !== false;
    const isSuspended = providerDoc.isSuspended === true;
    const blockedTill = providerDoc.blockedTill;
    const isBlocked = blockedTill && new Date(blockedTill) > new Date();

    let serviceCategoryMatch = true;
    if (categoryId && categoryId !== 'undefined' && categoryId !== 'null') {
      const targetCatId = (typeof categoryId === 'object' && categoryId._id) ? categoryId._id.toString() : categoryId.toString();
      if (providerDoc.services && providerDoc.services.length > 0) {
        serviceCategoryMatch = providerDoc.services.some(s => {
          if (!s) return false;
          const sId = (s._id || s).toString();
          return sId === targetCatId;
        });
      }
    }

    const reasons = [];
    if (!isApproved) reasons.push('Provider profile is pending admin approval');
    if (!isOnline) reasons.push('Provider is currently offline');
    if (!isActive) reasons.push('Provider account is inactive');
    if (isSuspended) reasons.push('Provider account is currently suspended');
    if (isBlocked) reasons.push('Provider is temporarily blocked');
    if (!serviceCategoryMatch) reasons.push('Provider does not offer this service category');

    const isAvailable = isApproved && isOnline && isActive && !isSuspended && !isBlocked && serviceCategoryMatch;

    return res.status(200).json({
      success: true,
      isAvailable: !!isAvailable,
      message: isAvailable ? 'Provider is online & available' : (reasons.join('. ') || 'Provider is currently unavailable'),
      details: {
        isApproved,
        isOnline,
        isActive,
        isSuspended,
        isBlocked,
        serviceCategoryMatch
      }
    });
  } catch (error) {
    global.logger.error(`[UserController.checkFavoriteProviderAvailability] Route: ${req.originalUrl || req.url} - Error checking favorite provider availability: ${error.message}`, error);
    next(error);
  }
};

/**
 * Saved Addresses Controllers
 */

// GET /api/customer/addresses
const getSavedAddresses = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('savedAddresses').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({
      success: true,
      savedAddresses: user.savedAddresses || []
    });
  } catch (error) {
    if (global.logger) {
      global.logger.error(`[UserController.getSavedAddresses] Error: ${error.message}`, error);
    }
    next(error);
  }
};

// POST /api/customer/addresses
const createSavedAddress = async (req, res, next) => {
  try {
    const {
      label,
      houseNumber,
      street,
      road,
      landmark,
      area,
      city,
      state,
      pincode,
      postalCode,
      country,
      formattedAddress,
      lat,
      lng,
      isDefault
    } = req.body;

    const pincodeVal = (pincode || postalCode || '').toString().trim();
    if (!pincodeVal || !/^\d{6}$/.test(pincodeVal)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 6-digit Indian PIN code'
      });
    }

    const cityVal = (city || '').toString().trim();
    const stateVal = (state || '').toString().trim();
    if (!cityVal || !stateVal) {
      return res.status(400).json({
        success: false,
        message: 'City and state are required'
      });
    }

    const userDoc = await User.findById(req.user._id).select('savedAddresses');
    if (!userDoc) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const currentAddresses = userDoc.savedAddresses || [];
    let shouldBeDefault = !!isDefault;
    if (currentAddresses.length === 0) {
      shouldBeDefault = true;
    }

    if (shouldBeDefault && currentAddresses.length > 0) {
      await User.updateOne(
        { _id: req.user._id },
        { $set: { "savedAddresses.$[].isDefault": false } }
      );
    }

    const latVal = typeof lat === 'number' ? lat : (lat ? parseFloat(lat) : null);
    const lngVal = typeof lng === 'number' ? lng : (lng ? parseFloat(lng) : null);

    let s2CellId = null;
    let s2CellIdPrecise = null;
    if (latVal !== null && lngVal !== null && !isNaN(latVal) && !isNaN(lngVal) && (latVal !== 0 || lngVal !== 0)) {
      s2CellId = latLngToS2CellId(latVal, lngVal, 13);
      s2CellIdPrecise = latLngToS2CellId(latVal, lngVal, 20);
    }

    const newAddressObj = {
      label: (label || 'Home').trim(),
      houseNumber: houseNumber ? houseNumber.trim() : '',
      street: street ? street.trim() : '',
      road: road ? road.trim() : '',
      landmark: landmark ? landmark.trim() : '',
      area: area ? area.trim() : '',
      city: cityVal,
      state: stateVal,
      pincode: pincodeVal,
      postalCode: pincodeVal,
      country: country ? country.trim() : 'India',
      formattedAddress: formattedAddress ? formattedAddress.trim() : '',
      lat: latVal,
      lng: lngVal,
      s2CellId,
      s2CellIdPrecise,
      isDefault: shouldBeDefault,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { savedAddresses: newAddressObj } },
      { new: true, runValidators: true }
    ).select('savedAddresses');

    const createdAddr = updatedUser.savedAddresses[updatedUser.savedAddresses.length - 1];

    return res.status(201).json({
      success: true,
      message: 'Address saved successfully',
      savedAddresses: updatedUser.savedAddresses,
      address: createdAddr
    });
  } catch (error) {
    if (global.logger) {
      global.logger.error(`[UserController.createSavedAddress] Error: ${error.message}`, error);
    }
    next(error);
  }
};

// PUT /api/customer/addresses/:addressId
const updateSavedAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;

    const existingUser = await User.findOne({
      _id: req.user._id,
      "savedAddresses._id": addressId
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Saved address not found'
      });
    }

    const {
      label,
      houseNumber,
      street,
      road,
      landmark,
      area,
      city,
      state,
      pincode,
      postalCode,
      country,
      formattedAddress,
      lat,
      lng,
      isDefault
    } = req.body;

    const pincodeVal = (pincode || postalCode || '').toString().trim();
    if (pincodeVal && !/^\d{6}$/.test(pincodeVal)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 6-digit Indian PIN code'
      });
    }

    if (isDefault === true) {
      await User.updateOne(
        { _id: req.user._id },
        { $set: { "savedAddresses.$[].isDefault": false } }
      );
    }

    const latVal = typeof lat === 'number' ? lat : (lat ? parseFloat(lat) : null);
    const lngVal = typeof lng === 'number' ? lng : (lng ? parseFloat(lng) : null);

    let s2CellId = null;
    let s2CellIdPrecise = null;
    if (latVal !== null && lngVal !== null && !isNaN(latVal) && !isNaN(lngVal) && (latVal !== 0 || lngVal !== 0)) {
      s2CellId = latLngToS2CellId(latVal, lngVal, 13);
      s2CellIdPrecise = latLngToS2CellId(latVal, lngVal, 20);
    }

    const setFields = {
      "savedAddresses.$[elem].updatedAt": new Date()
    };

    if (label !== undefined) setFields["savedAddresses.$[elem].label"] = label.trim();
    if (houseNumber !== undefined) setFields["savedAddresses.$[elem].houseNumber"] = houseNumber.trim();
    if (street !== undefined) setFields["savedAddresses.$[elem].street"] = street.trim();
    if (road !== undefined) setFields["savedAddresses.$[elem].road"] = road.trim();
    if (landmark !== undefined) setFields["savedAddresses.$[elem].landmark"] = landmark.trim();
    if (area !== undefined) setFields["savedAddresses.$[elem].area"] = area.trim();
    if (city !== undefined) setFields["savedAddresses.$[elem].city"] = city.trim();
    if (state !== undefined) setFields["savedAddresses.$[elem].state"] = state.trim();
    if (pincodeVal) {
      setFields["savedAddresses.$[elem].pincode"] = pincodeVal;
      setFields["savedAddresses.$[elem].postalCode"] = pincodeVal;
    }
    if (country !== undefined) setFields["savedAddresses.$[elem].country"] = country.trim();
    if (formattedAddress !== undefined) setFields["savedAddresses.$[elem].formattedAddress"] = formattedAddress.trim();
    if (latVal !== null) setFields["savedAddresses.$[elem].lat"] = latVal;
    if (lngVal !== null) setFields["savedAddresses.$[elem].lng"] = lngVal;
    if (s2CellId) setFields["savedAddresses.$[elem].s2CellId"] = s2CellId;
    if (s2CellIdPrecise) setFields["savedAddresses.$[elem].s2CellIdPrecise"] = s2CellIdPrecise;
    if (isDefault !== undefined) setFields["savedAddresses.$[elem].isDefault"] = !!isDefault;

    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $set: setFields },
      {
        arrayFilters: [{ "elem._id": addressId }],
        new: true,
        runValidators: true
      }
    ).select('savedAddresses');

    return res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      savedAddresses: updatedUser.savedAddresses
    });
  } catch (error) {
    if (global.logger) {
      global.logger.error(`[UserController.updateSavedAddress] Error: ${error.message}`, error);
    }
    next(error);
  }
};

// DELETE /api/customer/addresses/:addressId
const deleteSavedAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;

    const existingUser = await User.findOne({
      _id: req.user._id,
      "savedAddresses._id": addressId
    }).select('savedAddresses');

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Saved address not found'
      });
    }

    const targetAddr = existingUser.savedAddresses.id(addressId);
    const wasDefault = targetAddr ? targetAddr.isDefault : false;

    await User.updateOne(
      { _id: req.user._id },
      { $pull: { savedAddresses: { _id: addressId } } }
    );

    const refreshedUser = await User.findById(req.user._id).select('savedAddresses');

    if (wasDefault && refreshedUser.savedAddresses.length > 0) {
      const hasDefault = refreshedUser.savedAddresses.some(a => a.isDefault);
      if (!hasDefault) {
        refreshedUser.savedAddresses[refreshedUser.savedAddresses.length - 1].isDefault = true;
        await refreshedUser.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully',
      savedAddresses: refreshedUser.savedAddresses
    });
  } catch (error) {
    if (global.logger) {
      global.logger.error(`[UserController.deleteSavedAddress] Error: ${error.message}`, error);
    }
    next(error);
  }
};

// PATCH /api/customer/addresses/:addressId/default
const setDefaultSavedAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;

    const existingUser = await User.findOne({
      _id: req.user._id,
      "savedAddresses._id": addressId
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'Saved address not found'
      });
    }

    // Step 1: Set all savedAddresses.isDefault = false
    await User.updateOne(
      { _id: req.user._id },
      { $set: { "savedAddresses.$[].isDefault": false } }
    );

    // Step 2: Set target address isDefault = true
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, "savedAddresses._id": addressId },
      {
        $set: {
          "savedAddresses.$.isDefault": true,
          "savedAddresses.$.updatedAt": new Date()
        }
      },
      { new: true }
    ).select('savedAddresses');

    return res.status(200).json({
      success: true,
      message: 'Default address updated successfully',
      savedAddresses: updatedUser.savedAddresses
    });
  } catch (error) {
    if (global.logger) {
      global.logger.error(`[UserController.setDefaultSavedAddress] Error: ${error.message}`, error);
    }
    next(error);
  }
};

module.exports = {
  register,
  getProfile,
  updateProfile,
  uploadProfilePicture,
  getCustomerDashboardStats,
  getWalletHistory,
  toggleFavoriteProvider,
  checkFavoriteProviderAvailability,
  getSavedAddresses,
  createSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
  setDefaultSavedAddress
};




