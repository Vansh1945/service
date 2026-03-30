const crypto = require("crypto");
const nodemailer = require('nodemailer');

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

const axios = require('axios');

// Send OTP using Brevo API
const sendOTPWithBrevo = async (email) => {
  // Clear any existing OTP for this email
  if (otpStore.has(email)) {
    otpStore.delete(email);
  }

  const otp = exports.generateOTP(email);

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

exports.sendOTP = async (email) => {
  try {
    return await sendOTPWithBrevo(email);
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
