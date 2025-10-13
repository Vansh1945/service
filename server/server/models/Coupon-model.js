const mongoose = require('mongoose');
const { Schema } = mongoose;
const User = require('./User-model');

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
      validator: function (value) {
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
    required: [true, 'Expiry date is required']
  },
  minBookingValue: {
    type: Number,
    default: 0,
    min: [0, 'Minimum booking value cannot be negative']
  },
  isGlobal: {
    type: Boolean,
    default: false
  },
  isFirstBooking: {
    type: Boolean,
    default: false
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
    default: null, // null means unlimited usage
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
    },
    bookingValue: Number
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// -------------------- Indexes --------------------
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ assignedTo: 1, isActive: 1 });
couponSchema.index({ isGlobal: 1, isActive: 1 });
couponSchema.index({ isFirstBooking: 1, isActive: 1 });

// -------------------- Virtuals --------------------
couponSchema.virtual('remainingUses').get(function () {
  if (this.usageLimit === null) return Infinity;
  const usedCount = this.usedBy ? this.usedBy.length : 0;
  return this.usageLimit - usedCount;
});

couponSchema.virtual('isExpired').get(function () {
  return this.expiryDate < new Date();
});

couponSchema.virtual('formattedDiscount').get(function () {
  return this.discountType === 'flat'
    ? `₹${this.discountValue} OFF`
    : `${this.discountValue}% OFF`;
});

// -------------------- Pre-save hook --------------------
couponSchema.pre('save', function (next) {
  if (this.isExpired) {
    this.isActive = false;
  }

  if (this.isGlobal && this.isFirstBooking) {
    return next(new Error('Coupon cannot be both global and first-booking'));
  }

  next();
});

// -------------------- Admin Methods --------------------
couponSchema.statics.createCoupon = async function (adminId, couponData) {
  if (couponData.isFirstBooking) {
    const exists = await this.findOne({ isFirstBooking: true, isActive: true });
    if (exists) {
      throw new Error('Active first-booking coupon already exists');
    }
  }

  const coupon = new this({
    ...couponData,
    createdBy: adminId
  });

  return coupon.save();
};

couponSchema.statics.listAllCoupons = async function (adminId, filters = {}) {
  const query = { createdBy: adminId, ...filters };
  return this.find(query).sort({ createdAt: -1 });
};

// -------------------- User Methods --------------------
couponSchema.statics.validateCoupon = async function (userId, couponCode, serviceAmount) {
  const coupon = await this.findOne({ code: couponCode.toUpperCase() });

  if (!coupon) throw new Error('Coupon not found');
  if (!coupon.isActive) throw new Error('Coupon is not active');
  if (coupon.expiryDate && new Date() > coupon.expiryDate) throw new Error('Coupon has expired');
  if (coupon.minBookingValue && serviceAmount < coupon.minBookingValue) {
    throw new Error(`Booking amount must be at least ₹${coupon.minBookingValue}`);
  }
  if (coupon.usageLimit && coupon.usedBy.length >= coupon.usageLimit) {
    throw new Error('Coupon usage limit reached');
  }
  
  // Check if user has already used this coupon
  const alreadyUsed = coupon.usedBy.some(usage => usage.user && usage.user.toString() === userId.toString());
  if (alreadyUsed) throw new Error('You have already used this coupon');

  return coupon;
};

couponSchema.statics.getAvailableCoupons = async function (userId, bookingValue = 0) {
  const user = await User.findById(userId);

  const query = {
    isActive: true,
    expiryDate: { $gte: new Date() },
    usedBy: { $not: { $elemMatch: { user: userId } } },
    $or: [
      { isGlobal: true },
      { assignedTo: userId }
    ]
  };

  // Exclude first-booking coupons if user has bookings
  if (user && user.totalBookings > 0) {
    query.isFirstBooking = false;
  }

  const coupons = await this.find(query).select('-usedBy -createdBy');

  return coupons;
};

// -------------------- Instance Methods --------------------
couponSchema.methods.applyCoupon = function (totalAmount) {
  if (totalAmount < this.minBookingValue) {
    throw new Error(`Minimum booking value of ₹${this.minBookingValue} required`);
  }

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

couponSchema.methods.markAsUsed = async function (userId, bookingValue = 0) {
  const alreadyUsed = this.usedBy.some(usage => 
    usage.user && usage.user.toString() === userId.toString()
  );
  if (alreadyUsed) throw new Error('User has already used this coupon');

  this.usedBy.push({ user: userId, bookingValue });

  if (this.usageLimit !== null && this.remainingUses <= 0) {
    this.isActive = false;
  }

  if (this.isFirstBooking) {
    await User.findByIdAndUpdate(userId, {
      $set: { firstBookingUsed: true }
    });
  }

  return this.save();
};

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;