const mongoose = require('mongoose');
const { Schema } = mongoose;

// Coupon Schema
const couponSchema = new Schema({
  code: {
    type: String,
    required: [true, 'Coupon code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9_]{5,20}$/, 'Coupon code must be 5-20 alphanumeric characters']
  },
  discountType: {
    type: String,
    required: [true, 'Discount type is required'],
    enum: ['flat', 'percent'],
    default: 'flat'
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [1, 'Discount value must be at least 1'],
    validate: {
      validator: function(value) {
        if (this.discountType === 'percent') {
          return value <= 100;
        }
        return true;
      },
      message: 'Percentage discount cannot exceed 100%'
    }
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required'],
    min: [Date.now, 'Expiry date cannot be in the past']
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  usageLimit: {
    type: Number,
    default: 1,
    min: [1, 'Usage limit must be at least 1']
  },
  usedBy: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isFirstCoupon: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ assignedTo: 1, isActive: 1 });
couponSchema.index({ isFirstCoupon: 1, isActive: 1 });

// Virtual properties
couponSchema.virtual('remainingUses').get(function() {
  return this.usageLimit - this.usedBy.length;
});

couponSchema.virtual('isExpired').get(function() {
  return this.expiryDate < new Date();
});

couponSchema.virtual('formattedDiscount').get(function() {
  return this.discountType === 'flat' 
    ? `₹${this.discountValue} OFF` 
    : `${this.discountValue}% OFF`;
});

// Pre-save hook
couponSchema.pre('save', function(next) {
  if (this.isExpired) {
    this.isActive = false;
  }
  next();
});

// ADMIN METHODS ==============================================

// Static method for admin to create coupon
couponSchema.statics.createCoupon = async function(adminId, couponData) {
  const coupon = new this({
    ...couponData,
    createdBy: adminId
  });
  return coupon.save();
};

// Static method for admin to update coupon
couponSchema.statics.updateCoupon = async function(adminId, couponId, updateData) {
  return this.findOneAndUpdate(
    { _id: couponId, createdBy: adminId },
    updateData,
    { new: true, runValidators: true }
  );
};

// Static method for admin to list all coupons
couponSchema.statics.listAllCoupons = async function(adminId) {
  return this.find({ createdBy: adminId })
    .sort({ createdAt: -1 });
};

// Static method for admin to get coupon details
couponSchema.statics.getCouponDetails = async function(adminId, couponId) {
  return this.findOne({ _id: couponId, createdBy: adminId });
};

// USER METHODS ==============================================

// Static method for users to validate coupon
couponSchema.statics.validateCoupon = async function(userId, code) {
  const coupon = await this.findOne({ 
    code: code.toUpperCase(),
    isActive: true,
    expiryDate: { $gte: new Date() },
    $or: [
      { assignedTo: null },
      { assignedTo: userId }
    ]
  });

  if (!coupon) {
    throw new Error('Invalid or expired coupon');
  }

  if (coupon.usedBy.some(usage => usage.user.equals(userId))) {
    throw new Error('You have already used this coupon');
  }

  if (coupon.remainingUses <= 0) {
    throw new Error('This coupon has reached its usage limit');
  }

  return coupon;
};

// Static method to get available coupons for user
couponSchema.statics.getAvailableCoupons = async function(userId) {
  return this.find({
    isActive: true,
    expiryDate: { $gte: new Date() },
    $or: [
      { assignedTo: null },
      { assignedTo: userId }
    ],
    $expr: { $gt: ['$usageLimit', { $size: '$usedBy' }] }
  }).select('-usedBy -createdBy');
};

// Static method to get first coupon for new user
couponSchema.statics.getFirstCoupon = async function(userId) {
  return this.findOne({
    isFirstCoupon: true,
    isActive: true,
    expiryDate: { $gte: new Date() },
    $or: [
      { assignedTo: null },
      { assignedTo: userId }
    ],
    $expr: { $gt: ['$usageLimit', { $size: '$usedBy' }] }
  });
};

// Instance method to apply coupon
couponSchema.methods.applyCoupon = function(totalAmount) {
  if (this.discountType === 'flat') {
    return {
      discount: this.discountValue,
      finalAmount: Math.max(0, totalAmount - this.discountValue)
    };
  } else {
    const discount = (totalAmount * this.discountValue) / 100;
    return {
      discount,
      finalAmount: totalAmount - discount
    };
  }
};

// Instance method to mark as used
couponSchema.methods.markAsUsed = function(userId) {
  if (this.usedBy.some(usage => usage.user.equals(userId))) {
    throw new Error('User has already used this coupon');
  }
  
  this.usedBy.push({ user: userId });
  
  if (this.remainingUses <= 0) {
    this.isActive = false;
  }
  
  return this.save();
};

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;