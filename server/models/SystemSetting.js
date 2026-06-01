const mongoose = require("mongoose");

/* ===============================
   System Configuration Schema
================================ */

const bannerSchema = new mongoose.Schema(
  {
    image: {
      type: String, // image URL (Cloudinary / S3)
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    startDate: Date,
    endDate: Date,
  }
);

const emailTemplateSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    body: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    allowedVariables: [{ type: String }],
    updatedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const systemConfigSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    tagline: {
      type: String,
      trim: true,
    },
    logo: {
      type: String, // image url
    },
    favicon: {
      type: String, // image url
    },
    address: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    defaultCurrency: {
      type: String,
      default: "INR"
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata"
    },
    timeFormat: {
      type: String,
      enum: ["12h", "24h"],
      default: "12h"
    },
    socialLinks: {
      facebook: {
        type: String,
        trim: true,
      },
      instagram: {
        type: String,
        trim: true,
      },
      twitter: {
        type: String,
        trim: true,
      },
      linkedin: {
        type: String,
        trim: true,
      },
      youtube: {
        type: String,
        trim: true,
      },
    },
    bookingSettings: {
      autoAssignProvider: {
        type: Boolean,
        default: false
      },
      cancellationWindowMinutes: {
        type: Number,
        default: 60
      },
      refundReviewHours: {
        type: Number,
        default: 48
      },
      maxBookingsPerProvider: {
        type: Number,
        default: 10
      },
      allowCOD: {
        type: Boolean,
        default: true
      },
      bookingBufferTime: {
        type: Number,
        default: 30
      },
      trackingEnabled: {
        type: Boolean,
        default: true
      },
      trackingInterval: {
        type: Number,
        default: 5
      },
      autoAssignRadius: {
        type: Number,
        default: 15
      }
    },
    walletSettings: {
      minWithdrawal: {
        type: Number,
        default: 500
      },
      refundToWalletOnly: {
        type: Boolean,
        default: true
      },
      cashbackEnabled: {
        type: Boolean,
        default: false
      },
      referralBonus: {
        type: Number,
        default: 0
      }
    },
    commissionSettings: {
      defaultCommission: {
        type: Number,
        default: 10
      },
      payoutHoldHours: {
        type: Number,
        default: 48
      }
    },
    surgeSplitSettings: {
      visiting: {
        type: Number,
        default: 60
      },
      rain: {
        type: Number,
        default: 70
      },
      traffic: {
        type: Number,
        default: 70
      },
      night: {
        type: Number,
        default: 70
      },
      demand: {
        type: Number,
        default: 50
      }
    },
    notificationSettings: {
      pushEnabled: {
        type: Boolean,
        default: true
      },
      emailEnabled: {
        type: Boolean,
        default: true
      },
      smsEnabled: {
        type: Boolean,
        default: false
      },
      providerAlerts: {
        type: Boolean,
        default: true
      },
      customerAlerts: {
        type: Boolean,
        default: true
      }
    },
    maintenanceMode: {
      customer: {
        enabled: {
          type: Boolean,
          default: false
        },
        message: {
          type: String,
          default: "System is under maintenance. Please try again later."
        }
      },
      provider: {
        enabled: {
          type: Boolean,
          default: false
        },
        message: {
          type: String,
          default: "System is under maintenance. Please try again later."
        }
      },
      globalMessage: {
        type: String,
        default: "System is under maintenance. Please try again later."
      }
    },
    featureFlags: {
      walletEnabled: {
        type: Boolean,
        default: true
      },
      referralEnabled: {
        type: Boolean,
        default: false
      }
    },
    securitySettings: {
      maxLoginAttempts: {
        type: Number,
        default: 5
      },
      otpExpiryMinutes: {
        type: Number,
        default: 10
      },
      sessionTimeoutHours: {
        type: Number,
        default: 24
      }
    },
    uploadSettings: {
      maxImageSizeMB: {
        type: Number,
        default: 5
      },
      allowedImageFormats: [{
        type: String
      }]
    },
    customerBranding: {
      appName: { type: String, default: "Raj Electrical Service" },
      shortName: { type: String, default: "Raj Service" },
      logo: { type: String, default: "" },
      icon: { type: String, default: "" },
      splashScreen: { type: String, default: "" },
      browserTitle: { type: String, default: "Raj Electrical Service | Book Trusted Electricians Near You" },
      description: { type: String, default: "Book certified electricians for home and commercial electrical repairs, installations, and maintenance. Fast, reliable, and affordable electrician service at your doorstep." }
    },
    providerBranding: {
      appName: { type: String, default: "Raj Provider" },
      shortName: { type: String, default: "Raj Partner" },
      logo: { type: String, default: "" },
      icon: { type: String, default: "" },
      splashScreen: { type: String, default: "" },
      browserTitle: { type: String, default: "Raj Electrical Partner | Earn as a Certified Electrician" },
      description: { type: String, default: "Join Raj Electrical Service as a certified partner. Accept electrical repair and installation bookings and grow your earnings." }
    },
    adminBranding: {
      appName: { type: String, default: "Raj Electrical Services Admin" },
      shortName: { type: String, default: "Admin" },
      logo: { type: String, default: "" },
      icon: { type: String, default: "" },
      splashScreen: { type: String, default: "" },
      favicon: { type: String, default: "" },
      browserTitle: { type: String, default: "Raj Electrical Services Control Panel" },
      description: { type: String, default: "Raj Electrical Services Control Panel" }
    },
    appVersions: {
      customer: { type: Number, default: 1 },
      provider: { type: Number, default: 1 },
      admin: { type: Number, default: 1 }
    },
    lastPublished: {
      customer: { type: Date, default: Date.now },
      provider: { type: Date, default: Date.now },
      admin: { type: Date, default: Date.now }
    },
    invalidTokenCleanupCount: {
      type: Number,
      default: 0
    },
    emailTemplates: {
      forgotPasswordOtp: { type: emailTemplateSchema },
      providerRegistrationOtp: { type: emailTemplateSchema },
      providerApproval: { type: emailTemplateSchema },
      providerRejection: { type: emailTemplateSchema },
      contactReply: { type: emailTemplateSchema },
      withdrawApproved: { type: emailTemplateSchema },
      withdrawRejected: { type: emailTemplateSchema },
      complaintResponse: { type: emailTemplateSchema }
    },
    metadata: {
      updatedBy: { type: String },
      updatedAt: { type: Date }
    }
  },
  { timestamps: true }
);

/* ===============================
   Category Schema
================================ */

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    icon: {
      type: String, // icon URL or icon name
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

/* ===============================
   Banner Schema
================================ */

const Banner = mongoose.model("Banner", bannerSchema);

/* ===============================
   Models Export
================================ */

const SystemConfig = mongoose.model("SystemConfig", systemConfigSchema);
const Category = mongoose.model("Category", categorySchema);

module.exports = {
  SystemConfig,
  Category,
  Banner,
};
