const crypto = require("crypto");
const nodemailer = require('nodemailer');
const axios = require('axios');
const admin = require('../config/firebaseAdmin');

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

// Send OTP using FCM
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

// Internal function to send OTP using Brevo API
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
    // Clear any existing OTP for this email
    if (otpStore.has(email)) {
      otpStore.delete(email);
    }

    const otp = exports.generateOTP(email);

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
