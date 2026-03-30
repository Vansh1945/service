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

    // Try to find user in all collections with case-insensitive search
    let user = await User.findOne({
      email: { $regex: new RegExp(`^${trimmedEmail}$`, 'i') }
    }).select('+password');

    let userType = 'customer';

    if (!user) {
      user = await Provider.findOne({
        email: { $regex: new RegExp(`^${trimmedEmail}$`, 'i') }
      }).select('+password +approved +blockedTill');
      userType = 'provider';
    }

    if (!user) {
      user = await Admin.findOne({
        email: { $regex: new RegExp(`^${trimmedEmail}$`, 'i') }
      }).select('+password');
      userType = 'admin';
    }

    // If no user found
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }


    // Verify password
    let isMatch;
    try {
      // Always use bcrypt.compare for consistency across all user types
      isMatch = await bcrypt.compare(trimmedPassword, user.password);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error during login'
      });
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Provider Specific Login Restrictions
    if (userType === 'provider') {
      if (!user.profileComplete) {
        return res.status(403).json({
          success: false,
          message: 'Your profile is incomplete. Please complete registration.'
        });
      }

      if (!user.approved || user.kycStatus !== 'approved') {
        if (user.kycStatus === 'rejected') {
          return res.status(403).json({
            success: false,
            message: 'Your KYC was rejected. Please re-submit your details.'
          });
        }
        return res.status(403).json({
          success: false,
          message: 'Your account is pending admin approval. You cannot login yet.'
        });
      }
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
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Prepare response data
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
      message: 'Internal server error',
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

    const normalizedEmail = email.trim().toLowerCase();

    // Check in all user types
    let user = await User.findOne({ email: normalizedEmail }) ||
      await Provider.findOne({ email: normalizedEmail }) ||
      await Admin.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get FCM token if provider
    let fcmToken = null;
    if (user.fcmTokens && user.fcmTokens.length > 0) {
      fcmToken = user.fcmTokens[0].token;
    }

    const otpResponse = await sendOTP(normalizedEmail, fcmToken);

    res.status(200).json({
      success: true,
      message: otpResponse.message || "OTP sent successfully"
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

    const normalizedEmail = email.trim().toLowerCase();

    // Verify OTP
    const isValid = verifyOTP(normalizedEmail, otp);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }

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
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Verify OTP before allowing password reset
    try {
      const isValidOTP = verifyOTP(normalizedEmail, otp);
      if (!isValidOTP) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP'
        });
      }
    } catch (otpError) {
      console.error('OTP verification error during password reset:', otpError.message);
      return res.status(400).json({
        success: false,
        message: otpError.message
      });
    }

    // Find the user and select password field which is hidden by default
    let user = await User.findOne({ email: normalizedEmail }).select('+password');
    let userType = 'customer';

    if (!user) {
      user = await Provider.findOne({ email: normalizedEmail }).select('+password');
      userType = 'provider';
    }

    if (!user) {
      user = await Admin.findOne({ email: normalizedEmail }).select('+password');
      userType = 'admin';
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if new password is same as current password
    if (user.password) {
      const isSame = await bcrypt.compare(newPassword, user.password);
      if (isSame) {
        return res.status(400).json({
          success: false,
          message: "New password cannot be same as previous password"
        });
      }
    }

    // Assign new password - the model's pre-save hook will handle hashing
    user.password = newPassword;
    await user.save();

    // Clear OTP after successful password reset
    clearOTP(normalizedEmail);

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

    const normalizedEmail = email.trim().toLowerCase();

    // Find user to get FCM token
    const user = await User.findOne({ email: normalizedEmail }) ||
      await Provider.findOne({ email: normalizedEmail }) ||
      await Admin.findOne({ email: normalizedEmail });

    // Clear any existing OTP first
    clearOTP(normalizedEmail);

    let fcmToken = null;
    if (user && user.fcmTokens && user.fcmTokens.length > 0) {
      fcmToken = user.fcmTokens[0].token;
    }

    // Send new OTP
    const otpResponse = await sendOTP(normalizedEmail, fcmToken);

    res.status(200).json({
      success: true,
      message: otpResponse.message || "New OTP sent successfully"
    });

  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP"
    });
  }
};