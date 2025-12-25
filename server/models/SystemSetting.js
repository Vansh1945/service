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
    promoMessage: {
      type: String,
      trim: true,
    },
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
