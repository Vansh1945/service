const nodemailer = require("nodemailer");
const crypto = require("crypto");

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

  console.log(`Generated OTP for ${email}: ${otp} (expires: ${new Date(expiresAt).toISOString()})`);
  return otp;
};

exports.sendOTP = async (email) => {
  try {
    console.log(`Attempting to send OTP to: ${email}`);

    // Validate email credentials
    if (!process.env.SENDER_EMAIL || !process.env.EMAIL_PASSWORD) {
      console.error('Missing email credentials in environment variables');
      throw new Error('Email service not configured properly');
    }

    // Clear any existing OTP for this email
    if (otpStore.has(email)) {
      console.log(`Clearing existing OTP for ${email}`);
      otpStore.delete(email);
    }

    const otp = exports.generateOTP(email);

    // Optimized transporter configuration for better performance
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
      // Optimized settings for better performance
      pool: true,
      maxConnections: 5, // Increased from 1
      rateDelta: 10000, // Reduced from 20000ms
      rateLimit: 10, // Increased from 5
      secure: true,
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log('Email transporter verified successfully');
    } catch (verifyError) {
      console.error('Email transporter verification failed:', verifyError.message);
      throw new Error('Email service configuration error');
    }

    const mailOptions = {
      from: `"Raj Electrical Service" <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject: "Your Verification Code - Raj Electrical Service",
      text: `Your verification code is: ${otp}\nThis code is valid for 5 minutes.\n\nIf you didn't request this code, please ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 24px;">Raj Electrical Service</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Secure Verification</p>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 10px; text-align: center; border: 1px solid #e2e8f0;">
            <h2 style="color: #1e293b; margin: 0 0 20px 0;">Your Verification Code</h2>
            <div style="background: #ffffff; display: inline-block; padding: 20px 40px; border-radius: 8px; border: 2px solid #2563eb; margin: 20px 0;">
              <h1 style="color: #2563eb; margin: 0; font-size: 32px; letter-spacing: 4px; font-weight: bold;">${otp}</h1>
            </div>
            <p style="color: #64748b; margin: 20px 0; font-size: 16px;">
              This code will expire in <strong>5 minutes</strong>
            </p>
            <div style="background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <strong>Security Notice:</strong> If you didn't request this code, please ignore this email and contact our support team.
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px; color: #64748b; font-size: 14px;">
            <p>This is an automated message from Raj Electrical Service. Please do not reply to this email.</p>
          </div>
        </div>
      `,
      // Add priority and headers for better deliverability
      priority: 'high',
      headers: {
        'X-Priority': '1',
        'X-Mailer': 'Raj Electrical Service OTP System'
      }
    };

    console.log(`Sending email to ${email} with subject: ${mailOptions.subject}`);

    const info = await transporter.sendMail(mailOptions);

    console.log(`OTP email sent successfully to ${email}. Message ID: ${info.messageId}`);

    // Close transporter to free resources
    transporter.close();

    return {
      success: true,
      message: "OTP sent successfully",
      messageId: info.messageId
    };

  } catch (error) {
    console.error(`Failed to send OTP to ${email}:`, {
      error: error.message,
      stack: error.stack,
      code: error.code
    });

    // Provide more specific error messages
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Please check email credentials.');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Email service connection failed. Please check network connectivity.');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Email sending timed out. Please try again.');
    } else {
      throw new Error(`Failed to send OTP: ${error.message}`);
    }
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

  // Clear OTP after successful verification
  otpStore.delete(email);
  return true;
};

// Additional utility functions
exports.hasActiveOTP = (email) => {
  return otpStore.has(email);
};

exports.clearOTP = (email) => {
  otpStore.delete(email);
};