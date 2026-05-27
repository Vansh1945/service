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
      appName: { type: String, default: "SafeVolt Customer" },
      shortName: { type: String, default: "SafeVolt" },
      logo: { type: String, default: "" },
      icon: { type: String, default: "" },
      splashScreen: { type: String, default: "" },
      themeColor: { type: String, default: "#3b82f6" },
      backgroundColor: { type: String, default: "#ffffff" },
      description: { type: String, default: "Book certified electricians near you" }
    },
    providerBranding: {
      appName: { type: String, default: "SafeVolt Provider" },
      shortName: { type: String, default: "Provider" },
      logo: { type: String, default: "" },
      icon: { type: String, default: "" },
      splashScreen: { type: String, default: "" },
      themeColor: { type: String, default: "#10b981" },
      backgroundColor: { type: String, default: "#ffffff" },
      description: { type: String, default: "Provide electrical services on SafeVolt" }
    },
    adminBranding: {
      appName: { type: String, default: "SafeVolt Admin" },
      shortName: { type: String, default: "Admin" },
      logo: { type: String, default: "" },
      icon: { type: String, default: "" },
      favicon: { type: String, default: "" },
      themeColor: { type: String, default: "#4f46e5" },
      backgroundColor: { type: String, default: "#f3f4f6" },
      dashboardTitle: { type: String, default: "SafeVolt Control Panel" }
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
