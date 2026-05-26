const User = require('../models/User-model');
const Provider = require('../models/Provider-model');
const Admin = require('../models/Admin-model');
const { sendOTP, verifyOTP, clearOTP } = require('../utils/otpSend');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const firebaseAdmin = require('../config/firebaseAdmin');

// ── Helpers ───────────────────────────────────────────────────────────────
const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const extractDeviceInfo = (req) => {
  const ip = req.clientIp || req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  return {
    ip,
    deviceId:    req.headers['x-device-id'] || req.body?.deviceId || '',
    fingerprint: req.deviceFingerprint || req.body?.fingerprint || '',
    ipHash:      ip ? crypto.createHash('sha256').update(ip).digest('hex') : '',
    userAgent:   req.headers['user-agent'] || '',
    platform:    req.headers['x-device-platform'] || ''
  };
};

const recordLoginHistory = (user, deviceInfo, method = 'email', success = true) => {
  if (!user.loginHistory) user.loginHistory = [];
  user.loginHistory.push({ ip: deviceInfo.ip, userAgent: deviceInfo.userAgent, deviceId: deviceInfo.deviceId, method, success });
  if (user.loginHistory.length > 20) user.loginHistory = user.loginHistory.slice(-20);
  user.lastLoginIp = deviceInfo.ip;
  user.lastLoginAt = new Date();
};

const registerDevice = (user, deviceInfo) => {
  if (!deviceInfo.deviceId) return;
  if (!user.deviceIds) user.deviceIds = [];
  const existing = user.deviceIds.find(d => d.deviceId === deviceInfo.deviceId);
  if (existing) { existing.lastSeen = new Date(); }
  else { user.deviceIds.push({ deviceId: deviceInfo.deviceId, platform: deviceInfo.platform, userAgent: deviceInfo.userAgent }); }
};

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
      const { trackEvent } = require('../middlewares/fraud-middleware');
      await trackEvent({
        req,
        actionType: 'failed_login',
        flagReason: `Failed login attempt: Email ${trimmedEmail} not found`,
        role: 'customer'
      });
      if (global.logger) global.logger.warn(`Failed login attempt: Email ${trimmedEmail} not found`);

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
      const { trackEvent } = require('../middlewares/fraud-middleware');
      await trackEvent({
        req,
        actionType: 'failed_login',
        userId: user._id,
        userModel: userType === 'admin' ? 'Admin' : (userType === 'provider' ? 'Provider' : 'User'),
        role: userType === 'admin' ? 'admin' : (userType === 'provider' ? 'provider' : 'customer'),
        flagReason: `Failed login attempt: Incorrect password for ${trimmedEmail}`
      });
      if (global.logger) global.logger.warn(`Failed login attempt: Incorrect password for ${trimmedEmail}`);

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is suspended
    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: `Your account has been suspended. Reason: ${user.suspensionReason || 'Suspicious/fraudulent activity detected.'}`
      });
    }

    // Check if provider is blocked
    if (userType === 'provider' && user.blockedTill && new Date(user.blockedTill) > new Date()) {
      return res.status(403).json({
        success: false,
        message: `Your provider account has been blocked by the administrator until ${new Date(user.blockedTill).toLocaleDateString()}.`
      });
    }

    // Check Global Maintenance Mode Restrictions
    try {
      const { SystemConfig } = require('../models/SystemSetting');
      const settings = await SystemConfig.findOne();

      if (userType === 'customer') {
        if (settings?.maintenanceMode?.customer?.enabled) {
          return res.status(503).json({
            success: false,
            maintenance: true,
            role: 'customer',
            message:
              settings.maintenanceMode.customer.message ||
              'Customer services are under maintenance.'
          });
        }
      }

      if (userType === 'provider') {
        if (settings?.maintenanceMode?.provider?.enabled) {
          return res.status(503).json({
            success: false,
            maintenance: true,
            role: 'provider',
            message:
              settings.maintenanceMode.provider.message ||
              'Provider services are under maintenance.'
          });
        }
      }
    } catch (maintenanceErr) {
      // Ignore database or check errors to avoid locking out login entirely
    }

    // Provider Specific Login Restrictions
    if (userType === 'provider') {
      if (!user.profileComplete) {
        return res.status(403).json({
          success: false,
          message: 'Your profile is incomplete. Please complete registration.'
        });
      }
    }

    // Generate access token (15 min)
    /* BACKUP COMMENT: Original was { expiresIn: '30d' } */
    const token = jwt.sign(
      { id: user._id, email: user.email, role: userType === 'admin' ? 'admin' : user.role || userType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    // Prepare response data
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: userType === 'admin' ? 'admin' : user.role || userType,
      ...(userType === 'provider' && { approved: user.approved, serviceArea: user.serviceArea, providerId: user.providerId }),
      ...(userType === 'customer' && { phone: user.phone, address: user.address })
    };

    // Generate refresh token + record history
    const deviceInfo = extractDeviceInfo(req);
    let refreshTokenRaw = null;
    user.metadata = { ip: deviceInfo.ip, device: deviceInfo.deviceId || req.deviceFingerprint, userAgent: deviceInfo.userAgent, lastLogin: new Date() };
    recordLoginHistory(user, deviceInfo, 'email', true);
    registerDevice(user, deviceInfo);
    if (user.generateRefreshToken) {
      const { raw } = user.generateRefreshToken(deviceInfo);
      refreshTokenRaw = raw;
    }
    await user.save();

    const { trackEvent } = require('../middlewares/fraud-middleware');
    await trackEvent({
      req, actionType: 'login', userId: user._id,
      userModel: userType === 'admin' ? 'Admin' : (userType === 'provider' ? 'Provider' : 'User'),
      role: userType === 'admin' ? 'admin' : (userType === 'provider' ? 'provider' : 'customer'),
      flagReason: 'Successful login'
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken: refreshTokenRaw,
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

    // Track OTP request event
    let userModel = 'User';
    let role = 'customer';
    if (user.providerId) {
      userModel = 'Provider';
      role = 'provider';
    } else if (user.role === 'admin') {
      userModel = 'Admin';
      role = 'admin';
    }

    const { trackEvent } = require('../middlewares/fraud-middleware');
    await trackEvent({
      req,
      actionType: 'otp_request',
      userId: user._id,
      userModel,
      role,
      flagReason: 'Forgot password OTP request'
    });

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
    /* BACKUP COMMENT: Original was: const isValid = verifyOTP(normalizedEmail, otp); */
    const isValid = await verifyOTP(normalizedEmail, otp);
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
      /* BACKUP COMMENT: Original was: const isValidOTP = verifyOTP(normalizedEmail, otp); */
      const isValidOTP = await verifyOTP(normalizedEmail, otp);
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
    /* BACKUP COMMENT: Original was: clearOTP(normalizedEmail); */
    await clearOTP(normalizedEmail);

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
    /* BACKUP COMMENT: Original was: clearOTP(normalizedEmail); */
    await clearOTP(normalizedEmail);

    let fcmToken = null;
    if (user && user.fcmTokens && user.fcmTokens.length > 0) {
      fcmToken = user.fcmTokens[0].token;
    }

    // Send new OTP
    const otpResponse = await sendOTP(normalizedEmail, fcmToken);

    // Track OTP request event
    if (user) {
      let userModel = 'User';
      let role = 'customer';
      if (user.providerId) {
        userModel = 'Provider';
        role = 'provider';
      } else if (user.role === 'admin') {
        userModel = 'Admin';
        role = 'admin';
      }

      const { trackEvent } = require('../middlewares/fraud-middleware');
      await trackEvent({
        req,
        actionType: 'otp_request',
        userId: user._id,
        userModel,
        role,
        flagReason: 'Resend OTP request'
      });
    }

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

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Login  (Google + Phone OTP)
// POST /api/auth/firebase-login
// Body: { firebaseToken, role: 'customer'|'provider', deviceId? }
// ─────────────────────────────────────────────────────────────────────────────
exports.firebaseLogin = async (req, res) => {
  try {
    const { firebaseToken, role = 'customer' } = req.body;
    if (!firebaseToken) {
      return res.status(400).json({ success: false, message: 'Firebase token required' });
    }

    // 1. Verify with Firebase Admin SDK
    let decoded;
    try {
      decoded = await firebaseAdmin.auth().verifyIdToken(firebaseToken);
    } catch (e) {
      return res.status(401).json({ success: false, message: 'Invalid or expired Firebase token' });
    }

    const { uid, email, phone_number, name, picture, firebase: fbData } = decoded;
    const signInProvider = fbData?.sign_in_provider || 'google.com';
    const authProvider   = signInProvider === 'phone' ? 'phone' : 'google';
    const deviceInfo     = extractDeviceInfo(req);

    // 2. Find or create user
    let user, userType;
    const emailNorm = email ? email.toLowerCase() : null;

    if (role === 'provider') {
      userType = 'provider';
      user = emailNorm ? await Provider.findOne({ email: emailNorm }) : null;
      if (!user && phone_number) {
        user = await Provider.findOne({ phone: phone_number.replace(/^\+91/, '') });
      }
      if (!user) {
        return res.status(404).json({ success: false, message: 'No provider account found. Please register first.' });
      }
    } else {
      userType = 'customer';
      user = emailNorm ? await User.findOne({ email: emailNorm }) : null;
      if (!user && phone_number) {
        user = await User.findOne({ phone: phone_number.replace(/^\+91/, '') });
      }
      if (!user) {
        // Auto-create new customer for Firebase users
        user = new User({
          name: name || 'Customer',
          email: emailNorm || `${uid}@firebase.phone`,
          phone: phone_number ? phone_number.replace(/^\+91/, '') : '',
          authProvider,
          firebaseUid: uid,
          role: 'customer'
        });
        await user.save();
      }
    }

    // 3. Common business checks
    if (user.isSuspended) {
      return res.status(403).json({ success: false, message: `Account suspended: ${user.suspensionReason || 'Suspicious activity'}` });
    }
    if (userType === 'provider' && user.blockedTill && new Date(user.blockedTill) > new Date()) {
      return res.status(403).json({ success: false, message: `Your provider account has been blocked by the administrator until ${new Date(user.blockedTill).toLocaleDateString()}.` });
    }
    try {
      const { SystemConfig } = require('../models/SystemSetting');
      const s = await SystemConfig.findOne();
      if (userType === 'customer' && s?.maintenanceMode?.customer?.enabled)
        return res.status(503).json({ success: false, maintenance: true, message: s.maintenanceMode.customer.message });
      if (userType === 'provider' && s?.maintenanceMode?.provider?.enabled)
        return res.status(503).json({ success: false, maintenance: true, message: s.maintenanceMode.provider.message });
    } catch (e) {}

    if (userType === 'provider') {
      if (!user.profileComplete)
        return res.status(403).json({ success: false, message: 'Profile incomplete. Complete registration first.' });
      if (user.isDeleted)
        return res.status(403).json({ success: false, message: 'Account deactivated' });
    }

    // 4. Link Firebase UID
    if (!user.firebaseUid) { user.firebaseUid = uid; user.authProvider = authProvider; }
    if (picture && !user.profilePicUrl) user.profilePicUrl = picture;

    // 5. Generate tokens
    /* BACKUP COMMENT: Original was: { expiresIn: '30d' } */
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: userType === 'provider' ? 'provider' : 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );
    const { raw: refreshTokenRaw } = user.generateRefreshToken(deviceInfo);

    // 6. Update metadata / history / devices
    user.metadata = { ip: deviceInfo.ip, device: deviceInfo.deviceId, userAgent: deviceInfo.userAgent, lastLogin: new Date() };
    recordLoginHistory(user, deviceInfo, authProvider, true);
    registerDevice(user, deviceInfo);
    await user.save();

    // 7. Fraud track
    const { trackEvent } = require('../middlewares/fraud-middleware');
    await trackEvent({ req, actionType: 'login', userId: user._id,
      userModel: userType === 'provider' ? 'Provider' : 'User',
      role: userType, flagReason: `Firebase ${authProvider} login` });

    const userData = {
      _id: user._id, name: user.name, email: user.email,
      role: userType, phone: user.phone, profilePicUrl: user.profilePicUrl,
      ...(userType === 'provider' && { approved: user.approved, kycStatus: user.kycStatus, providerId: user.providerId }),
      isNewUser: !user.loginHistory || user.loginHistory.length <= 1
    };

    return res.status(200).json({ success: true, message: 'Login successful', token: accessToken, refreshToken: refreshTokenRaw, user: userData });
  } catch (err) {
    console.error('Firebase login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Refresh Access Token
// POST /api/auth/refresh-token
// Body: { refreshToken }
// ─────────────────────────────────────────────────────────────────────────────
exports.refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const tokenHash = hashToken(refreshToken);
    const now = new Date();

    // Search all collections for matching valid token
    let user, userType, Model;
    const collections = [
      { model: User,     type: 'customer' },
      { model: Provider, type: 'provider' },
      { model: Admin,    type: 'admin'    }
    ];

    for (const { model, type } of collections) {
      const found = await model.findOne({
        'refreshTokens.tokenHash': tokenHash,
        'refreshTokens.isValid': true,
        'refreshTokens.expiresAt': { $gt: now }
      });
      if (found) { user = found; userType = type; Model = model; break; }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    // Invalidate old token (rotation)
    const oldToken = user.refreshTokens.find(t => t.tokenHash === tokenHash);
    if (oldToken) oldToken.isValid = false;

    // Issue new tokens
    /* BACKUP COMMENT: Original was: { expiresIn: '30d' } */
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: userType === 'admin' ? 'admin' : user.role || userType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );
    const deviceInfo = extractDeviceInfo(req);
    const { raw: newRefreshRaw } = user.generateRefreshToken(deviceInfo);

    recordLoginHistory(user, deviceInfo, 'refresh', true);
    await user.save();

    return res.status(200).json({ success: true, token: accessToken, refreshToken: newRefreshRaw });
  } catch (err) {
    console.error('Refresh token error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Secure Logout
// POST /api/auth/logout
// Body: { refreshToken, allDevices? }
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    const { refreshToken, fcmToken, allDevices = false } = req.body;

    // 1. Revoke FCM Token if provided to prevent stale notifications on logout
    if (fcmToken) {
      try {
        await User.updateMany({}, { $pull: { fcmTokens: { token: fcmToken } } });
        await Provider.updateMany({}, { $pull: { fcmTokens: { token: fcmToken } } });
        await Admin.updateMany({}, { $pull: { fcmTokens: { token: fcmToken } } });
      } catch (fcmPullErr) {
        console.error('Error pulling FCM token on logout:', fcmPullErr);
      }
    }

    if (!refreshToken) {
      // Still clear client – just return success
      return res.status(200).json({ success: true, message: 'Logged out' });
    }

    const tokenHash = hashToken(refreshToken);
    const now = new Date();

    const collections = [
      { model: User }, { model: Provider }, { model: Admin }
    ];

    for (const { model } of collections) {
      const found = await model.findOne({ 'refreshTokens.tokenHash': tokenHash });
      if (found) {
        if (allDevices) {
          // Revoke all sessions
          found.refreshTokens.forEach(t => { t.isValid = false; });
        } else {
          const t = found.refreshTokens.find(t => t.tokenHash === tokenHash);
          if (t) t.isValid = false;
        }
        await found.save();
        break;
      }
    }

    return res.status(200).json({ success: true, message: allDevices ? 'Logged out from all devices' : 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};