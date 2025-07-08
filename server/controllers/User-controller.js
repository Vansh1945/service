const User = require('../models/User-model');
const { sendOTP, verifyOTP } = require('../utils/otpSend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


/**
 * Register a new user with OTP verification
 */
const register = async (req, res) => {
    try {
        const { name, email, phone, password, otp, address, profilePicUrl } = req.body;

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }

        // Check if user exists
        const userExists = await User.findOne({
            $or: [{ email }, { phone }]
        });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: "Email or phone already registered"
            });
        }

        // OTP handling
        if (!otp) {
            try {
                await sendOTP(email);
                return res.json({
                    success: true,
                    message: "OTP sent to email"
                });
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
        }

        // Verify OTP
        try {
            verifyOTP(email, otp);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            phone,
            address,
            profilePicUrl,
            role: 'customer'
        });

        // Generate JWT token
        const token = user.generateJWT();

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
            message: "Registration successful",
            token,
            user: userResponse
        });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error. Please try again later."
        });
    }
}



/**
 * Get current user profile
 */

const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

/**
 * Update user profile
 */


const updateProfile = async (req, res) => {
    try {
        const updates = {
            name: req.body.name,
            phone: req.body.phone,
            address: req.body.address,
            profilePicUrl: req.body.profilePicUrl
        };

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        ).select('-password');

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
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

module.exports = {
    register,
    getProfile,
    updateProfile
};

