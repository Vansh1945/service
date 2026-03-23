const crypto = require("crypto");
const { sendPushNotification } = require("./notificationService");
const User = require("../models/User-model");
const Provider = require("../models/Provider-model");
const Admin = require("../models/Admin-model");

// In-memory OTP store (for production, use Redis)
const otpStore = new Map();

// Cleanup expired OTPs every minute
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (data.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 60000);

exports.generateOTP = (email) => {
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 300000; // 5 minutes

  otpStore.set(email, {
    otp,
    expiresAt,
    attempts: 0, // Track verification attempts
    createdAt: Date.now()
  });

  return otp;
};

// Send OTP using FCM (Firebase Cloud Messaging)
const sendOTPWithFCM = async (email) => {
  // Clear any existing OTP for this email
  if (otpStore.has(email)) {
    otpStore.delete(email);
  }

  const otp = exports.generateOTP(email);

  // Find user in collections to get FCM tokens
  const user = await User.findOne({ email }) || 
               await Provider.findOne({ email }) || 
               await Admin.findOne({ email });

  if (!user) {
    throw new Error('User not found with this email.');
  }

  if (!user.fcmTokens || user.fcmTokens.length === 0) {
    throw new Error('No registered devices found for this account to receive verification code via push notification.');
  }

  const title = "Verification Code";
  const body = `Your verification code is: ${otp}. It expires in 5 minutes.`;
  const data = {
    type: 'otp_verification',
    otp: otp
  };

  const response = await sendPushNotification(user.fcmTokens, { title, body, data });
  
  const successCount = response ? response.successCount : 0;
  
  if (successCount === 0) {
    throw new Error('Failed to send verification code to your registered devices.');
  }

  return {
    success: true,
    message: "OTP sent via push notification successfully",
    successCount
  };
};

exports.sendOTP = async (email) => {
  try {
    return await sendOTPWithFCM(email);
  } catch (error) {
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

exports.verifyOTP = (email, otp) => {
  const storedData = otpStore.get(email);

  if (!storedData) {
    throw new Error("OTP not found or expired");
  }

  // Increment attempt counter
  storedData.attempts++;
  otpStore.set(email, storedData);

  if (storedData.attempts > 3) {
    otpStore.delete(email);
    throw new Error("Too many attempts. OTP invalidated.");
  }

  if (storedData.expiresAt < Date.now()) {
    otpStore.delete(email);
    throw new Error("OTP expired");
  }

  if (storedData.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  return true;
};

// Additional utility functions
exports.hasActiveOTP = (email) => {
  return otpStore.has(email);
};

exports.clearOTP = (email) => {
  otpStore.delete(email);
};
