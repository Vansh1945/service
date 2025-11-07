const mongoose = require('mongoose');
const { Schema } = mongoose;

// Banner Schema
const bannerSchema = new Schema({
  title: {
    type: String,
    maxlength: 200,
  },
  subtitle: {
    type: String,
    maxlength: 300,
  },
  imageUrl: {
    type: String,
    required: true,
    trim: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: false
});

// Indexes
bannerSchema.index({ isActive: 1, startDate: 1 });
bannerSchema.index({ createdAt: -1 });

// Virtual for checking if banner is expired
bannerSchema.virtual('isExpired').get(function() {
  return this.endDate && new Date() > this.endDate;
});



// Static method to find active banners within date range
bannerSchema.statics.findActiveBanners = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    startDate: { $lte: now },
    $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }],
  }).sort({ createdAt: -1 });
};

// Static method to auto-expire banners
bannerSchema.statics.expireBanners = async function() {
  const now = new Date();
  const result = await this.updateMany(
    {
      isActive: true,
      endDate: { $exists: true, $lt: now }
    },
    { isActive: false }
  );
  return result.modifiedCount;
};

const Banner = mongoose.model('Banner', bannerSchema);

module.exports = Banner;
