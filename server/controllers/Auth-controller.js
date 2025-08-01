const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Admin = require('../models/Admin-model');
const { sendOTP, verifyOTP, clearOTP } = require('../utils/otpSend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


/**
 * @desc    Unified login for all user types
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.Login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    // Trim and normalize email
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Try to find user in all collections
    let user = await User.findOne({ email: trimmedEmail }).select('+password');
    let userType = 'customer';

    if (!user) {
      user = await Provider.findOne({ 
        email: { $regex: new RegExp(`^${trimmedEmail}$`, 'i') }
      }).select('+password +approved +blockedTill');
      userType = 'provider';
    }

    if (!user) {
      user = await Admin.findOne({ email: trimmedEmail }).select('+password');
      userType = 'admin';
    }

    // If no user found
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Role-specific validations
    if (userType === 'provider') {
      // Check approval status
      if (!user.approved) {
        return res.status(403).json({
          success: false,
          message: 'Your account is pending approval from admin'
        });
      }

      // Check blocked status
      if (user.blockedTill && user.blockedTill > new Date()) {
        return res.status(403).json({
          success: false,
          message: `Your account is blocked until ${user.blockedTill}`
        });
      }
    }

    if (userType === 'admin' && !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access denied'
      });
    }

    // Verify password (using appropriate method based on model)
    const isMatch = user.comparePassword 
      ? await user.comparePassword(trimmedPassword)
      : await bcrypt.compare(trimmedPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: userType === 'admin' ? 'admin' : user.role || userType
    };

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );

    // Prepare response data (excluding sensitive fields)
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: userType === 'admin' ? 'admin' : user.role || userType,
      ...(userType === 'provider' && { 
        approved: user.approved,
        serviceArea: user.serviceArea 
      }),
      ...(userType === 'customer' && {
        phone: user.phone,
        address: user.address
      })
    };

    // Return token in response body without setting cookie
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// Password Reset (All User)
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Check in all user types
    const user = await User.findOne({ email }) || 
                 await Provider.findOne({ email }) || 
                 await Admin.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await sendOTP(email);
    
    res.status(200).json({
      success: true,
      message: "OTP sent to your email"
    });

  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP"
    });
  }
};

exports.verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    // Verify OTP
    const isValid = verifyOTP(email, otp);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }

    // Clear OTP after successful verification
    clearOTP(email);

    res.status(200).json({
      success: true,
      message: "OTP verified successfully"
    });

  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(400).json({
      success: false,
      message: err.message || "OTP verification failed"
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    console.log('Reset Password Request Body:', req.body); // Log incoming request
    
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      console.log('Validation failed - missing fields');
      return res.status(400).json({
        success: false,
        message: "Email and new password are required"
      });
    }

    console.log('Searching for user with email:', email);
    
    let user = await User.findOne({ email });
    let userType = 'user';
    
    if (!user) {
      user = await Provider.findOne({ email });
      userType = 'provider';
      console.log('Found provider user');
    }
    
    if (!user) {
      user = await Admin.findOne({ email });
      userType = 'admin';
      console.log('Found admin user');
    }

    if (!user) {
      console.log('User not found in any collection');
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log('Checking password match...');
    const isMatch = await bcrypt.compare(newPassword, user.password);
    if (isMatch) {
      console.log('New password matches old password');
      return res.status(400).json({
        success: false,
        message: "New password cannot be same as old password"
      });
    }

    console.log('Updating password...');
    user.password = newPassword;
    await user.save();
    console.log('Password updated successfully');

    res.status(200).json({
      success: true,
      message: "Password reset successfully"
    });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({
      success: false,
      message: "Password reset failed"
    });
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Clear any existing OTP first
    clearOTP(email);

    // Send new OTP
    await sendOTP(email);

    res.status(200).json({
      success: true,
      message: "New OTP sent successfully"
    });

  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP"
    });
  }
};