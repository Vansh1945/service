/* BACKUP COMMENT: Original implementation used in-memory otpStore = new Map() and synchronous helpers. */
const crypto = require("crypto");
const nodemailer = require('nodemailer');
const axios = require('axios');
const admin = require('../config/firebaseAdmin');
const OTP = require('../models/OTP-model');

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

// Internal function to send OTP using Brevo API (Preserved original signature and logic)
const sendOTPWithBrevoInternal = async (email, otp) => {
  const apiKey = process.env.BREVO_SMTP_PASS || process.env.SMTP_PASS;
  const senderEmail = process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER || 'noreply@service.com';

  const payload = {
    sender: { name: "Service Team", email: senderEmail },
    to: [{ email: email }],
    subject: "Your Verification Code",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #333; text-align: center;">Verification Code</h2>
        <p style="color: #555; font-size: 16px;">Hello,</p>
        <p style="color: #555; font-size: 16px;">Your One-Time Password (OTP) for verification is:</p>
        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;">
          <strong style="font-size: 24px; color: #2c3e50; letter-spacing: 2px;">${otp}</strong>
        </div>
        <p style="color: #555; font-size: 14px;">This code will expire in 5 minutes.</p>
        <p style="color: #555; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `
  };

  try {
    const response = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      }
    });

    return {
      success: true,
      message: "OTP sent via email successfully",
      messageId: response.data.messageId
    };
  } catch (error) {
    console.error("Brevo API Error:", error.response?.data || error.message);
    throw new Error(`Failed to send email via Brevo API: ${error.response?.data?.message || error.message}`);
  }
};

exports.sendOTP = async (email, fcmToken = null) => {
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
    return await sendOTPWithBrevoInternal(email, otp);
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
