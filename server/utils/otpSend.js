const crypto = require("crypto");
const nodemailer = require('nodemailer');
const axios = require('axios');
const admin = require('../config/firebaseAdmin');
const OTP = require('../models/OTP-model');
const { sendMail } = require('./sendmail');

exports.generateOTP = async (email) => {
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Clear previous OTP for this email dynamically
  await OTP.findOneAndDelete({ email });

  await OTP.create({
    email,
    otp,
    expiresAt,
    attempts: 0
  });

  return otp;
};

// Send OTP using FCM (Preserved original signature and logic)
exports.sendOTPViaFCM = async (fcmToken, otp) => {
  const message = {
    notification: {
      title: "Password Reset OTP",
      body: `Your OTP is ${otp}`
    },
    data: {
      otp: otp.toString(),
      type: "PASSWORD_RESET"
    },
    token: fcmToken
  };

  try {
    return await admin.messaging().send(message);
  } catch (error) {
    console.error("FCM Send Error:", error);
    throw error;
  }
};

// Internal function to send OTP using Brevo API (Preserved original signature and logic, but uses dynamic HBS templates)
const sendOTPWithBrevoInternal = async (email, otp, otpType = 'forgotPasswordOtp') => {
  try {
    const result = await sendMail({
      to: email,
      templateType: otpType,
      variables: {
        otp,
        email,
        expiry: 5
      }
    });

    return {
      success: true,
      message: "OTP sent via email successfully",
      messageId: result.messageId
    };
  } catch (error) {
    console.error("Brevo API Error in OTP Send:", error.message);
    throw new Error(`Failed to send email via Brevo API: ${error.message}`);
  }
};

exports.sendOTP = async (email, fcmToken = null, otpType = 'forgotPasswordOtp') => {
  try {
    // Clear any existing OTP for this email in database
    await OTP.findOneAndDelete({ email });

    const otp = await exports.generateOTP(email);

    // Try FCM first if token is available
    if (fcmToken) {
      console.log(`[FCM Attempt] Sending Push Notification OTP to token: ${fcmToken.substring(0, 15)}...`);
      try {
        await exports.sendOTPViaFCM(fcmToken, otp);
        console.log(`[FCM Success] OTP Push Notification sent successfully to ${email}`);
        return {
          success: true,
          message: "OTP sent via Push Notification text"
        };
      } catch (fcmError) {
        console.error("[FCM Failed] Error sending Push Notification:", fcmError.message);
        console.warn("FCM fallback to Brevo Email.");
      }
    } else {
      console.log(`[FCM Ignored] No FCM token provided for ${email}. Falling back to Brevo Email.`);
    }

    // Fallback to Brevo
    return await sendOTPWithBrevoInternal(email, otp, otpType);
  } catch (error) {
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

exports.verifyOTP = async (email, otp) => {
  const storedData = await OTP.findOne({ email });

  if (!storedData) {
    throw new Error("OTP not found or expired");
  }

  // Increment attempt counter
  storedData.attempts++;
  await storedData.save();

  if (storedData.attempts > 3) {
    await OTP.deleteOne({ email });
    throw new Error("Too many attempts. OTP invalidated.");
  }

  if (storedData.expiresAt < new Date()) {
    await OTP.deleteOne({ email });
    throw new Error("OTP expired");
  }

  if (storedData.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  return true;
};

// Additional utility functions
exports.hasActiveOTP = async (email) => {
  const count = await OTP.countDocuments({ email });
  return count > 0;
};

exports.clearOTP = async (email) => {
  await OTP.deleteOne({ email });
};
