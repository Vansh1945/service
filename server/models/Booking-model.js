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
  zoneId: {
    type: Schema.Types.ObjectId,
    ref: 'Zone',
    default: null
  },
  assignmentSource: {
    type: String,
    enum: ['Same Zone', 'Adjacent Zone', 'Parent City', 'Parent State', 'Distance-based Fallback', null],
    default: null
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
    enum: ['Pending', 'SearchingProvider', 'Offered', 'Assigned', 'Accepted', 'OnTheWay', 'Arrived', 'Started', 'InProgress', 'Completed', 'Cancelled', 'Rejected', 'Expired', 'Reassigned', 'Refunded'],
    default: 'Pending',
    set: function (v) {
      if (!v) return v;
      const statusMap = {
        'pending': 'Pending',
        'searchingprovider': 'SearchingProvider',
        'offered': 'Offered',
        'assigned': 'Assigned',
        'accepted': 'Accepted',
        'ontheway': 'OnTheWay',
        'arrived': 'Arrived',
        'started': 'Started',
        'inprogress': 'InProgress',
        'in-progress': 'InProgress',
        'in_progress': 'InProgress',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'rejected': 'Rejected',
        'expired': 'Expired',
        'reassigned': 'Reassigned',
        'refunded': 'Refunded',
        'waiting admin assignment': 'Reassigned',
        'confirmed': 'Accepted',
        'scheduled': 'Accepted',
        'no-show': 'Cancelled'
      };
      const cleanKey = v.toLowerCase().replace(/[^a-z]/g, '');
      return statusMap[cleanKey] || statusMap[v.toLowerCase()] || v;
    }
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

  // Admin Cancellation Tracking
  cancelledBy: {
    type: String,
    enum: ['customer', 'admin', 'system'],
    default: null
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: null
  },
  complaintId: {
    type: Schema.Types.ObjectId,
    ref: 'Complaint',
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  refundDestination: {
    type: String,
    enum: ['wallet', 'none'],
    default: 'none'
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  nonRefundableAmount: {
    type: Number,
    default: 0
  },
  platformFeeRetained: {
    type: Number,
    default: 0
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'none'],
    default: 'none'
  },
  refundReference: {
    type: String,
    default: null
  },
  refundProcessedAt: {
    type: Date,
    default: null
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
    maxDiscount: { type: Number, min: [0, 'Max discount cannot be negative'], default: null },
    appliedZone: { type: Schema.Types.ObjectId, ref: 'Zone', default: null }
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
  walletUsed: {
    type: Number,
    default: 0
  },
  onlinePaid: {
    type: Number,
    default: 0
  },
  cashToPay: {
    type: Number,
    default: 0
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
  visitingCharge: {
    type: Number,
    default: 0
  },
  platformFee: {
    type: Number,
    default: 0
  },
  customCharges: {
    type: Number,
    default: 0
  },
  rainCharge: {
    type: Number,
    default: 0
  },
  trafficCharge: {
    type: Number,
    default: 0
  },
  nightCharge: {
    type: Number,
    default: 0
  },
  demandSurge: {
    type: Number,
    default: 0
  },
  emergencySurge: {
    type: Number,
    default: 0
  },
  providerSurgeShare: {
    type: Number,
    default: 0
  },
  companySurgeShare: {
    type: Number,
    default: 0
  },
  surgeSplitSettings: {
    type: Object,
    default: null
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
    },
    completionNotes: {
      type: String,
      trim: true,
      default: null
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

  bookingType: {
    type: String,
    enum: ['scheduled', 'instant', 'emergency'],
    default: 'scheduled'
  },
  estimatedDuration: {
    type: Number,
    default: null
  },
  travelBufferMinutes: {
    type: Number,
    default: null
  },
  expectedStartTime: {
    type: Date,
    default: null
  },
  expectedEndTime: {
    type: Date,
    default: null
  },
  providerAcceptanceStatus: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', null],
    default: null
  },
  reassignmentReason: {
    type: String,
    default: null
  },
  isEmergency: {
    type: Boolean,
    default: false
  },
  isInstant: {
    type: Boolean,
    default: false
  },
  surgeCharge: {
    type: Number,
    default: 0
  },
  providerBonus: {
    type: Number,
    default: 0
  },
  bookingPriority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  providerResponseDeadline: {
    type: Date,
    default: null
  },
  trustedProviderOnly: {
    type: Boolean,
    default: false
  },
  startPin: {
    type: String,
    select: false,
    default: null
  },
  completionPin: {
    type: String,
    select: false,
    default: null
  },

  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    }
  },

  metadata: {
    ip: String,
    userAgent: String,
    ignoredProviders: [{ type: Schema.Types.ObjectId, ref: 'Provider' }],
    assignedAt: Date
  },
  // BOOKING LOCK UPGRADE
  lockedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    default: null
  },
  lockedAt: {
    type: Date,
    default: null
  },
  lockExpiresAt: {
    type: Date,
    default: null
  },
  bookingVersion: {
    type: Number,
    default: 0
  }
  // BOOKING LOCK UPGRADE
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

// Virtual fields for provider splits (calculated dynamically on the backend without extra DB storage)
bookingSchema.virtual('providerVisitingShare').get(function () {
  const split = this.surgeSplitSettings?.visiting ?? 0;
  return parseFloat(((this.visitingCharge || 0) * (split / 100)).toFixed(2));
});

bookingSchema.virtual('providerRainShare').get(function () {
  const split = this.surgeSplitSettings?.rain ?? 0;
  return parseFloat(((this.rainCharge || 0) * (split / 100)).toFixed(2));
});

bookingSchema.virtual('providerTrafficShare').get(function () {
  const split = this.surgeSplitSettings?.traffic ?? 0;
  return parseFloat(((this.trafficCharge || 0) * (split / 100)).toFixed(2));
});

bookingSchema.virtual('providerNightShare').get(function () {
  const split = this.surgeSplitSettings?.night ?? 0;
  return parseFloat(((this.nightCharge || 0) * (split / 100)).toFixed(2));
});

bookingSchema.virtual('providerDemandShare').get(function () {
  const split = this.surgeSplitSettings?.demand ?? 0;
  return parseFloat(((this.demandSurge || 0) * (split / 100)).toFixed(2));
});

bookingSchema.virtual('providerEmergencyShare').get(function () {
  const split = this.surgeSplitSettings?.emergency ?? 0;
  return parseFloat(((this.emergencySurge || 0) * (split / 100)).toFixed(2));
});

bookingSchema.pre('save', async function (next) {
  this.updatedAt = Date.now();

  // EMERGENCY BOOKING ENGINE UPGRADE
  if (this.bookingType) {
    this.bookingType = this.bookingType.toLowerCase();
  }
  if (this.isModified('bookingType') || this.isNew) {
    this.bookingType = this.bookingType || 'scheduled';
    this.isEmergency = this.bookingType === 'emergency';
    this.isInstant = this.bookingType === 'instant';
  } else if (this.isModified('isEmergency') || this.isModified('isInstant')) {
    this.bookingType = this.isEmergency ? 'emergency' : (this.isInstant ? 'instant' : 'scheduled');
  }

  if (this.isEmergency) {
    this.bookingPriority = 'critical';
  } else if (this.isInstant) {
    this.bookingPriority = 'medium';
  } else {
    this.bookingPriority = 'low';
  }
  // END EMERGENCY BOOKING ENGINE UPGRADE

  // Populate payment splits automatically
  if (this.isModified('paymentMethod') || this.isModified('totalAmount') || this.isNew) {
    if (this.paymentMethod === 'cash') {
      this.walletUsed = 0;
      this.onlinePaid = 0;
      this.cashToPay = this.totalAmount;
    } else if (this.paymentMethod === 'wallet') {
      this.walletUsed = this.totalAmount;
      this.onlinePaid = 0;
      this.cashToPay = 0;
    } else if (this.paymentMethod === 'online') {
      this.walletUsed = 0;
      this.onlinePaid = this.totalAmount;
      this.cashToPay = 0;
    }
  }

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

        // Populate GeoJSON location
        this.location = {
          type: 'Point',
          coordinates: [this.address.lng, this.address.lat]
        };

        // Populate or reassign booking.zoneId when coordinates change or on creation
        if (this.isNew || this.isModified('address.lat') || this.isModified('address.lng')) {
          const Zone = mongoose.model('Zone');
          const detectedZone = await Zone.findZoneByCoordinates(this.address.lat, this.address.lng);
          if (detectedZone) {
            this.zoneId = detectedZone._id;
          } else {
            this.zoneId = null;
          }
        }
      }
    } catch (s2Err) {
      console.error('Error computing address S2 cells and resolving zone in pre-save:', s2Err);
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

  // Commission calculation (runs on new bookings with provider, or when provider/pricing changes on existing bookings)
  if (this.provider && (
    this.isNew ||
    this.isModified('provider') ||
    this.isModified('subtotal') ||
    this.isModified('totalDiscount') ||
    this.isModified('visitingCharge') ||
    this.isModified('rainCharge') ||
    this.isModified('trafficCharge') ||
    this.isModified('nightCharge') ||
    this.isModified('demandSurge')
  )) {
    try {
      const CommissionRule = mongoose.model('CommissionRule');
      const firstService = this.services && this.services[0];
      const serviceId = firstService ? firstService.service : null;

      const commissionRule = await CommissionRule.getCommissionForProvider(
        this.provider,
        this.zoneId,
        'standard',
        serviceId
      );

      const baseForCommission = Math.max(0, this.subtotal - this.totalDiscount);

      // Load settings for surge splits
      const { SystemConfig } = require('./SystemSetting');
      let settings = await SystemConfig.findOne();
      if (!settings) {
        settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
        await settings.save();
      }

      const splits = settings.surgeSplitSettings || {};
      const splitVisiting = typeof splits.visiting === 'number' && !isNaN(splits.visiting) ? splits.visiting : 60;
      const splitRain = typeof splits.rain === 'number' && !isNaN(splits.rain) ? splits.rain : 70;
      const splitTraffic = typeof splits.traffic === 'number' && !isNaN(splits.traffic) ? splits.traffic : 70;
      const splitNight = typeof splits.night === 'number' && !isNaN(splits.night) ? splits.night : 70;
      const splitDemand = typeof splits.demand === 'number' && !isNaN(splits.demand) ? splits.demand : 50;
      const splitEmergency = typeof splits.emergency === 'number' && !isNaN(splits.emergency) ? splits.emergency : 85;
      this.surgeSplitSettings = splits;

      // Surcharge amounts on this booking
      const visiting = typeof this.visitingCharge === 'number' && !isNaN(this.visitingCharge) ? this.visitingCharge : 0;
      const rain = typeof this.rainCharge === 'number' && !isNaN(this.rainCharge) ? this.rainCharge : 0;
      const traffic = typeof this.trafficCharge === 'number' && !isNaN(this.trafficCharge) ? this.trafficCharge : 0;
      const night = typeof this.nightCharge === 'number' && !isNaN(this.nightCharge) ? this.nightCharge : 0;
      const demand = typeof this.demandSurge === 'number' && !isNaN(this.demandSurge) ? this.demandSurge : 0;
      const emergency = typeof this.emergencySurge === 'number' && !isNaN(this.emergencySurge) ? this.emergencySurge : 0;
      const custom = typeof this.customCharges === 'number' && !isNaN(this.customCharges) ? this.customCharges : 0;
      const platformFee = typeof this.platformFee === 'number' && !isNaN(this.platformFee) ? this.platformFee : 0;

      // Provider splits
      const provVisitingShare = parseFloat((visiting * (splitVisiting / 100)).toFixed(2)) || 0;
      const provRainShare = parseFloat((rain * (splitRain / 100)).toFixed(2)) || 0;
      const provTrafficShare = parseFloat((traffic * (splitTraffic / 100)).toFixed(2)) || 0;
      const provNightShare = parseFloat((night * (splitNight / 100)).toFixed(2)) || 0;
      const provDemandShare = parseFloat((demand * (splitDemand / 100)).toFixed(2)) || 0;
      const provEmergencyShare = parseFloat((emergency * (splitEmergency / 100)).toFixed(2)) || 0;

      const providerSurgeShare = parseFloat((provVisitingShare + provRainShare + provTrafficShare + provNightShare + provDemandShare + provEmergencyShare).toFixed(2)) || 0;
      const totalSurcharges = visiting + rain + traffic + night + demand + emergency + custom + platformFee;
      const companySurgeShare = parseFloat((totalSurcharges - providerSurgeShare).toFixed(2)) || 0;

      this.providerSurgeShare = providerSurgeShare;
      this.companySurgeShare = companySurgeShare;

      if (commissionRule) {
        const { commission, netAmount } = CommissionRule.calculateCommission(baseForCommission, commissionRule);
        this.commissionAmount = commission || 0;
        this.providerEarnings = parseFloat((netAmount + providerSurgeShare).toFixed(2));
        this.commissionRule = commissionRule._id;
      } else {
        const defaultCommPercent = settings?.commissionSettings?.defaultCommission ?? parseFloat(process.env.DEFAULT_COMMISSION || 10);
        const commission = parseFloat(((baseForCommission * defaultCommPercent) / 100).toFixed(2));
        const netAmount = parseFloat((baseForCommission - commission).toFixed(2));

        this.commissionAmount = commission || 0;
        this.providerEarnings = parseFloat((netAmount + providerSurgeShare).toFixed(2));
        this.commissionRule = null;
      }
    } catch (error) {
      console.error('Error calculating commission:', error);
      this.commissionAmount = 0;
      this.providerEarnings = this.totalAmount;
      this.commissionRule = null;
    }
  }

  next();
});

// Payment confirmation will be handled through Transaction model updates
// in the booking controller

// Virtual for booking progress status
bookingSchema.virtual('progressStatus').get(function () {
  const { getBookingProgress } = require('../utils/bookingHelper');
  return getBookingProgress(this);
});

// Virtual for admin earning
bookingSchema.virtual('adminEarning').get(function () {
  return parseFloat(((this.commissionAmount || 0) + (this.companySurgeShare || 0)).toFixed(2));
});

// Virtual for standardized pricing breakdown response
bookingSchema.virtual('pricingBreakdown').get(function () {
  const servicePrice = this.subtotal;
  const visitingCharges = this.visitingCharge || 0;
  const emergencyCharges = this.emergencySurge || 0;
  const surgeCharges = (this.rainCharge || 0) +
    (this.trafficCharge || 0) +
    (this.nightCharge || 0) +
    (this.demandSurge || 0) +
    (this.customCharges || 0) +
    (this.platformFee || 0);
  const discount = this.totalDiscount || 0;
  const platformCommission = this.commissionAmount || 0;
  const providerEarnings = this.providerEarnings || 0;
  const platformEarnings = parseFloat((platformCommission + (this.companySurgeShare || 0)).toFixed(2));
  const customerTotal = this.totalAmount;

  let walletUsed = this.walletUsed || 0;
  let onlinePaid = this.onlinePaid || 0;
  let cashToPay = this.cashToPay || 0;

  // Fallback calculation for older bookings where these fields might be undefined or 0
  if (!this.walletUsed && !this.onlinePaid && !this.cashToPay) {
    if (this.paymentMethod === 'cash') {
      cashToPay = customerTotal;
    } else if (this.paymentMethod === 'wallet') {
      walletUsed = customerTotal;
    } else if (this.paymentMethod === 'online') {
      onlinePaid = customerTotal;
    } else if (this.paymentMethod === 'mixed') {
      cashToPay = 0;
      onlinePaid = customerTotal;
      walletUsed = 0;
    }
  }

  return {
    servicePrice,
    visitingCharges,
    emergencyCharges,
    surgeCharges,
    discount,
    walletUsed,
    platformCommission,
    providerEarnings,
    platformEarnings,
    customerTotal,
    cashRemaining: cashToPay,
    onlinePaid,
    finalAmount: customerTotal
  };
});

bookingSchema.index({ location: '2dsphere' });

// Indexes for query optimization
bookingSchema.index({ customer: 1 });
bookingSchema.index({ provider: 1 });
bookingSchema.index({ provider: 1, status: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ date: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ status: 1, createdAt: -1 });

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
