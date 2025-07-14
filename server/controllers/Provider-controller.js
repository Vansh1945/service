const Provider = require('../models/Provider-model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { sendOTP, verifyOTP } = require('../utils/otpSend');

/**
 * @desc    Register a new provider
 * @route   POST /api/providers/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, otp, services, experience, serviceArea, address } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: name, email, phone, password, services, and serviceArea"
      });
    }

    // Check if provider already exists
    const existingProvider = await Provider.findOne({ email });
    if (existingProvider) {
      return res.status(400).json({
        success: false,
        message: "Provider already exists with this email"
      });
    }

    // Handle OTP verification
    if (!otp) {
      try {
        await sendOTP(email);
        return res.status(200).json({
          success: true,
          message: "OTP sent to email"
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP"
        });
      }
    }

    // Verify OTP
    const isOTPValid = await verifyOTP(email, otp);
    if (!isOTPValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    // Handle resume file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required"
      });
    }
    const resume = req.file.filename;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new provider
    const provider = await Provider.create({
      name,
      email,
      phone,
      password: hashedPassword,
      resume,
      services,
      experience: experience || 0,
      serviceArea,
      address: address || {},
      role: 'provider'
    });

    // Generate JWT token
    const token = provider.generateJWT();

    // Prepare response data (excluding sensitive info)
    const providerData = {
      _id: provider._id,
      name: provider.name,
      email: provider.email,
      phone: provider.phone,
      role: provider.role,
      approved: provider.approved,
      services: provider.services,
      serviceArea: provider.serviceArea,
      experience: provider.experience,
      createdAt: provider.createdAt
    };

    res.status(201).json({
      success: true,
      message: "Provider registered successfully. Awaiting approval.",
      token,
      provider: providerData
    });

  } catch (error) {
    console.error("Registration error:", error);

    // Clean up uploaded file if error occurs
    if (req.file) {
      const filePath = path.join(__dirname, '../uploads/resumes', req.file.filename);
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete file:", err);
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Server error during registration"
    });
  }
};

/**
 * @desc    Get provider profile
 * @route   GET /api/provider/profile
 * @access  Private (Provider)
 */
exports.getProfile = async (req, res) => {
  try {
    const provider = await Provider.findById(req.providerID)
      .select('-password -__v')
      .populate({
        path: 'feedbacks',
        select: 'rating comment createdAt',
        populate: {
          path: 'user',
          select: 'name profilePicUrl'
        }
      })
      .populate('earningsHistory', 'amount date description transactionType');

    if (!provider || provider.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Provider not found"
      });
    }

    // Calculate average rating
    let averageRating = 0;
    if (provider.feedbacks && provider.feedbacks.length > 0) {
      const total = provider.feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
      averageRating = total / provider.feedbacks.length;
    }

    const profileData = {
      ...provider.toObject(),
      averageRating: averageRating.toFixed(1)
    };

    res.status(200).json({
      success: true,
      profile: profileData
    });

  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching profile"
    });
  }
};

/**
 * @desc    Update provider profile
 * @route   PUT /api/provider/update-profile
 * @access  Private (Provider)
 */
exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const providerId = req.providerID;

    // Find the existing provider
    const existingProvider = await Provider.findById(providerId);
    if (!existingProvider || existingProvider.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Provider not found"
      });
    }

    // Handle profile picture update if provided
    if (req.file) {
      // Delete old profile picture if exists and not default
      if (existingProvider.profilePicUrl && existingProvider.profilePicUrl !== 'default-provider.jpg') {
        const oldFilePath = path.join(__dirname, '../uploads/profilePics', existingProvider.profilePicUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlink(oldFilePath, (err) => {
            if (err) console.error("Failed to delete old profile picture:", err);
          });
        }
      }
      updates.profilePicUrl = req.file.filename;
    }

    // Prevent updating restricted fields
    const restrictedFields = [
      '_id', 'password', 'role', 'approved', 'wallet', 
      'blockedTill', 'completedBookings', 'canceledBookings', 
      'feedbacks', 'earningsHistory', 'isDeleted', 'testPassed'
    ];
    
    restrictedFields.forEach(field => delete updates[field]);

    // Handle address update
    if (updates.address) {
      updates.address = {
        ...existingProvider.address,
        ...updates.address
      };
    }

    // Handle bank details update
    if (updates.bankDetails) {
      updates.bankDetails = {
        ...existingProvider.bankDetails,
        ...updates.bankDetails
      };
    }

    // Update provider
    const updatedProvider = await Provider.findByIdAndUpdate(
      providerId,
      updates,
      { new: true, runValidators: true }
    ).select('-password -__v');

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      provider: updatedProvider
    });

  } catch (error) {
    console.error("Update profile error:", error);

    // Clean up uploaded file if error occurs
    if (req.file) {
      const filePath = path.join(__dirname, '../uploads/profilePics', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error("Failed to delete file:", err);
        });
      }
    }

    let errorMessage = "Server error while updating profile";
    if (error.name === 'ValidationError') {
      errorMessage = Object.values(error.errors).map(val => val.message).join(', ');
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
};




