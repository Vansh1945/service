const mongoose = require('mongoose');
const { Schema } = mongoose;

// Address Sub-Schema
const addressSchema = new Schema({
  street: {
    type: String,
    required: [true, 'Street address is required'],
    trim: true,
    maxlength: [100, 'Street address cannot exceed 200 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [50, 'City name cannot exceed 50 characters']
  },
  postalCode: {
    type: String,
    required: [true, 'Pincode is required'],
    match: [/^[0-9]{6}$/, 'Please provide a valid 6-digit pincode']
  },
  state: {
    type: String,
    required: true
  },
  country: {
    type: String,
    default: 'India'
  },
  lat: {
    type: Number,
    default: null
  },
  lng: {
    type: Number,
    default: null
  },
  s2CellId: {
    type: String,
    index: true,
    default: null
  },
  s2CellIdPrecise: {
    type: String,
    index: true,
    default: null
  },
  addressLine: { type: String, trim: true },
  houseNumber: { type: String, trim: true },
  road: { type: String, trim: true },
  landmark: { type: String, trim: true },
  area: { type: String, trim: true },
  pincode: { type: String, trim: true },
  formattedAddress: { type: String, trim: true }
});

// Service Item Sub-Schema
const serviceItemSchema = new Schema({
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  }
}, { _id: true });

// Booking Schema
const bookingSchema = new Schema({
  bookingId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer ID is required']
  },
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
  },
  services: [serviceItemSchema],
  date: {
    type: Date,
    required: [true, 'Booking date is required'],
    validate: [
      {
        validator: function (value) {
          return value instanceof Date && !isNaN(value);
        },
        message: 'Invalid date format'
      }
    ]
  },
  time: {
    type: String,
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide time in HH:MM format']
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in-progress', 'started', 'completed', 'cancelled', 'confirmed', 'scheduled', 'no-show', 'assigned'],
    default: 'pending'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: false
  },
  hasComplaint: {
    type: Boolean,
    default: false
  },
  deadline: {
    type: Date
  },
  completedAt: {
    type: Date
  },

  // Payment method and status tracking
  paymentMethod: {
    type: String,
    enum: ['online', 'cash', 'wallet', 'mixed'],
    required: [true, 'Payment method is required']
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'processing', 'escrow_hold'],
    default: 'pending'
  },

  refundStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'none'],
    default: 'none'
  },

  refundMode: {
    type: String,
    enum: ['wallet', 'card', 'razorpay', 'none'],
    default: 'none'
  },

  refundProcessed: {
    type: Boolean,
    default: false
  },

  // Cancellation tracking  progress
  cancellationProgress: {
    status: {
      type: String,
      enum: ['not_cancelled', 'cancelled', 'processing_refund', 'refund_completed'],
      default: 'not_cancelled'
    },
    reason: {
      type: String,
      trim: true
    },
    cancelledAt: {
      type: Date
    },
    refundInitiatedAt: {
      type: Date
    },
    refundCompletedAt: {
      type: Date
    },
    refundAmount: {
      type: Number,
      min: [0, 'Refund amount cannot be negative']
    },
    refundTransactionId: {
      type: String,
      trim: true
    }
  },

  // Status history for progress tracking
  statusHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      trim: true
    },
    updatedBy: {
      type: String,
      enum: ['customer', 'provider', 'admin', 'system'],
      default: 'system'
    }
  }],

  // Estimated completion time for better UX
  estimatedCompletionTime: {
    type: Date
  },

  // Service completion tracking
  serviceStartedAt: {
    type: Date
  },

  serviceCompletedAt: {
    type: Date
  },

  address: {
    type: addressSchema,
    required: [true, 'Address is required']
  },
  // Store coupon details as an object so frontend can read full coupon meta
  couponApplied: {
    code: { type: String, trim: true },
    discountType: { type: String, trim: true },
    discountValue: { type: Number, min: [0, 'Discount cannot be negative'] },
    maxDiscount: { type: Number, min: [0, 'Max discount cannot be negative'], default: null }
  },
  // Optional customer notes for the booking
  notes: {
    type: String,
    default: null,
    trim: true
  },
  totalDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  commissionAmount: {
    type: Number,
    default: 0,
    min: [0, 'Commission cannot be negative']
  },
  providerEarnings: {
    type: Number,
    default: 0,
    min: [0, 'Provider earnings cannot be negative']
  },
  commissionRule: {
    type: Schema.Types.ObjectId,
    ref: 'CommissionRule'
  },

  feedback: [{
    type: Schema.Types.ObjectId,
    ref: 'Feedback'
  }],
  complaint: {
    type: Schema.Types.ObjectId,
    ref: 'Complaint'
  },
  adminRemark: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  },
  confirmedBooking: {
    type: Boolean,
    default: false
  },
  commissionProcessed: {
    type: Boolean,
    default: false
  },

  // Payout Hold & Dispute Logic
  payoutHoldUntil: {
    type: Date,
    default: null
  },
  disputeRaised: {
    type: Boolean,
    default: false
  },
  disputeStatus: {
    type: String,
    enum: ['none', 'under_review', 'provider_responded', 'customer_responded', 'resolved', 'refund_approved', 'refund_rejected'],
    default: 'none'
  },
  adminRefundDecision: {
    type: String,
    enum: ['none', 'approved', 'rejected', 'partial'],
    default: 'none'
  },

  // Photo Proof System
  providerWorkProof: {
    beforeImages: [
      {
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    afterImages: [
      {
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    startLocation: {
      latitude: Number,
      longitude: Number
    },
    completionLocation: {
      latitude: Number,
      longitude: Number
    }
  },

  complaintProofs: [
    {
      uploadedBy: {
        type: String,
        enum: ["customer", "provider", "admin"]
      },
      images: [
        {
          url: { type: String, required: true }
        }
      ],
      message: String,
      createdAt: { type: Date, default: Date.now }
    }
  ],
  trackingEnabled: {
    type: Boolean,
    default: false
  },

  providerLiveLocation: {
    lat: Number,
    lng: Number,
    updatedAt: Date
  },

  providerReached: {
    type: Boolean,
    default: false
  },

  liveDistance: String,
  liveDuration: String,

  routeCoordinates: [
    {
      lat: Number,
      lng: Number
    }
  ],

  isRebook: {
    type: Boolean,
    default: false
  },
  originalBooking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  isFavoriteProviderBooking: {
    type: Boolean,
    default: false
  },

  metadata: {
    ip: String,
    userAgent: String
  }
}, {
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.id; // Remove the virtual id field
      // Keep ret._id for API responses so frontend can access booking ID
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.id;
      return ret;
    }
  },
  timestamps: false
});

bookingSchema.pre('save', async function (next) {
  this.updatedAt = Date.now();

  // If a provider is assigned and the status is pending, transition to accepted
  if (this.provider && this.status === 'pending') {
    this.status = 'accepted';
  }

  // Populate address S2 cell fields on creation or update
  if (this.isModified('address.lat') || this.isModified('address.lng') || this.isNew) {
    try {
      const { latLngToS2CellId } = require('../utils/s2Helper');
      if (this.address && typeof this.address.lat === 'number' && typeof this.address.lng === 'number') {
        this.address.s2CellId = latLngToS2CellId(this.address.lat, this.address.lng, 13);
        this.address.s2CellIdPrecise = latLngToS2CellId(this.address.lat, this.address.lng, 20);
      }
    } catch (s2Err) {
      console.error('Error computing address S2 cells in pre-save:', s2Err);
    }
  }

  // Track status changes
  if (this.isModified('status') && !this.isNew) {
    const statusChange = {
      status: this.status,
      timestamp: new Date(),
      updatedBy: 'system'
    };

    switch (this.status) {
      case 'pending':
        statusChange.note = 'Booking is waiting for provider assignment';
        break;
      case 'scheduled':
        statusChange.note = 'Booking is confirmed and scheduled';
        break;
      case 'accepted':
        statusChange.note = 'Provider has accepted the booking';
        break;
      case 'in-progress':
        statusChange.note = 'Service is in progress';
        this.serviceStartedAt = new Date();
        break;
      case 'completed':
        statusChange.note = 'Service has been completed successfully';
        this.serviceCompletedAt = new Date();
        // Note: totalBookings increment is handled in the controller on confirmation
        break;
      case 'cancelled':
        statusChange.note = 'Booking has been cancelled';
        this.cancellationProgress.status = 'cancelled';
        this.cancellationProgress.cancelledAt = new Date();
        break;
    }

    this.statusHistory.push(statusChange);
  }

  // Track payment status changes to refunded
  if (this.isModified('paymentStatus') && this.paymentStatus === 'refunded') {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      note: `Payment Refunded: ₹${this.cancellationProgress?.refundAmount || this.totalAmount} added to wallet`,
      updatedBy: 'system'
    });
  }

  // Commission calculation
  if (this.provider && (this.isModified('transaction') || this.isModified('provider') || this.isNew || this.isModified('totalAmount'))) {
    try {
      const CommissionRule = mongoose.model('CommissionRule');
      const commissionRule = await CommissionRule.getCommissionForProvider(this.provider);

      if (commissionRule) {
        const { commission, netAmount } = CommissionRule.calculateCommission(this.totalAmount, commissionRule);
        this.commissionAmount = commission || 0;
        this.providerEarnings = netAmount || this.totalAmount;
        this.commissionRule = commissionRule._id;
      } else {
        const { SystemConfig } = require('./SystemSetting');
        let settings = await SystemConfig.findOne();
        if (!settings) {
          settings = new SystemConfig({ companyName: 'Raj Electrical Services' });
          await settings.save();
        }
        const defaultCommPercent = settings?.commissionSettings?.defaultCommission ?? 10;
        const commission = parseFloat(((this.totalAmount * defaultCommPercent) / 100).toFixed(2));
        const netAmount = parseFloat((this.totalAmount - commission).toFixed(2));

        this.commissionAmount = commission || 0;
        this.providerEarnings = netAmount || this.totalAmount;
        this.commissionRule = null;
      }
    } catch (error) {
      console.error('Error calculating commission:', error);
      this.commissionAmount = 0;
      this.providerEarnings = this.totalAmount;
      this.commissionRule = null;
    }
  }

  /* BACKUP COMMENT: Removed non-atomic totalBookings pre-save increment hook.
     Moved to transactional completeBooking block in Booking-controller.js.
  */

  next();
});

// Payment confirmation will be handled through Transaction model updates
// in the booking controller

// Virtual for booking progress status
bookingSchema.virtual('progressStatus').get(function () {
  const { getBookingProgress } = require('../utils/bookingHelper');
  return getBookingProgress(this);
});

// Indexes for query optimization
bookingSchema.index({ customer: 1 });
bookingSchema.index({ provider: 1 });
bookingSchema.index({ provider: 1, status: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ createdAt: -1 });

// Unique partial compound index to prevent duplicate booking creation race conditions
bookingSchema.index(
  { customer: 1, date: 1, time: 1, totalAmount: 1 },
  { 
    unique: true,
    partialFilterExpression: { 
      status: { $nin: ['cancelled'] }, 
      paymentStatus: { $in: ['pending', 'processing'] } 
    } 
  }
);


const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
