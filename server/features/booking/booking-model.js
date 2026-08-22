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
    enum: ['pending', 'searchingprovider', 'offered', 'accepted', 'ontheway', 'arrived', 'workstarted', 'completed', 'cancelled', 'rejected', 'noshow'],
    default: 'pending',
    set: function (v) {
      if (!v) return v;
      const clean = v.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sMap = {
        'inprogress': 'workstarted',
        'started': 'workstarted',
        'assigned': 'accepted'
      };
      return sMap[clean] || clean;
    }
  },
  assignmentStatus: {
    type: String,
    enum: ['waiting', 'autoassigning', 'autoassigned', 'manualassigned', 'rejected', 'timeout', 'reassigned'],
    default: 'waiting',
    set: function (v) {
      if (!v) return v;
      const clean = v.toLowerCase().replace(/[^a-z0-9]/g, '');
      const aMap = {
        'assigned': 'autoassigned',
        'accepted': 'autoassigned'
      };
      return aMap[clean] || clean;
    }
  },
  complaintStatus: {
    type: String,
    enum: ['none', 'raised', 'underreview', 'resolved', 'closed'],
    default: 'none',
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
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
  acceptedAt: {
    type: Date
  },
  journeyStartedAt: {
    type: Date
  },
  arrivedAt: {
    type: Date
  },
  workStartedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },

  // Payment method and status tracking
  paymentMethod: {
    type: String,
    enum: ['online', 'cash', 'wallet', 'mixed'],
    required: [true, 'Payment method is required'],
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
  },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'escrowhold', 'settlementpending', 'settled', 'refundpending', 'refundapproved', 'refunded', 'failed', 'processing'],
    default: 'pending',
    set: function (v) {
      if (!v) return v;
      const clean = v.toLowerCase().replace(/[^a-z0-9]/g, '');
      const pMap = {
        'processing': 'escrowhold'
      };
      return pMap[clean] || clean;
    }
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

  // Cash Booking Payment Verification Tracking
  paymentVerification: {
    method: {
      type: String,
      enum: ['cash_received', 'qr_code', null],
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'waiting_payment', 'verified', 'failed', 'expired', null],
      default: null
    },
    qrCodeId: {
      type: String,
      default: null
    },
    qrImageUrl: {
      type: String,
      default: null
    },
    qrExpiresAt: {
      type: Date,
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    idempotencyKey: {
      type: String,
      default: null
    }
  },

  // Cancellation tracking  progress
  cancellationProgress: {
    status: {
      type: String,
      enum: ['notcancelled', 'cancelled', 'processingrefund', 'refundcompleted'],
      default: 'notcancelled',
      set: function (v) {
        if (!v) return v;
        return v.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
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

  // Reschedule history & count tracking
  rescheduleHistory: [{
    oldDate: {
      type: Date,
      default: Date.now
    },
    oldTime: {
      type: String,
      default: ''
    },
    newDate: {
      type: Date,
      default: Date.now
    },
    newTime: {
      type: String,
      default: ''
    },
    changedByRole: {
      type: String,
      enum: ['customer', 'provider', 'admin', 'system'],
      default: 'customer'
    },
    changedById: {
      type: Schema.Types.ObjectId,
      default: null
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [300, 'Reason cannot exceed 300 characters'],
      default: ''
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  rescheduleCount: {
    type: Number,
    default: 0
  },

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
    appliedZone: { type: Schema.Types.ObjectId, ref: 'Zone', default: null },
    isReferralCoupon: { type: Boolean, default: false }
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
  referralDiscountAmount: {
    type: Number,
    default: 0
  },
  providerApplicableDiscount: {
    type: Number,
    default: 0
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
  referralDiscountApplied: {
    type: Boolean,
    default: false
  },
  referralBenefitCounted: {
    type: Boolean,
    default: false
  },

  // Audit Snapshots for Dynamic Commission & Financial Traceability
  commissionSource: {
    type: String,
    enum: ['rating_rule', 'standard_rule', 'system_default'],
    default: 'standard_rule'
  },
  commissionTypeSnapshot: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  commissionValueSnapshot: {
    type: Number,
    default: null
  },
  commissionRateSnapshot: {
    type: Number,
    default: null
  },
  ratingSnapshot: {
    type: Number,
    default: null
  },
  ratingCountSnapshot: {
    type: Number,
    default: null
  },
  ratingEvaluationPeriodDays: {
    type: Number,
    default: null
  },
  commissionSnapshotFinalized: {
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
    enum: ['none', 'pending', 'underreview', 'providerresponded', 'customerresponded', 'resolved', 'refundapproved', 'refundrejected'],
    default: 'none',
    set: function (v) {
      if (!v) return v;
      return v.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
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

bookingSchema.virtual('providerFestivalShare').get(function () {
  const split = this.surgeSplitSettings?.festival ?? 70;
  return parseFloat(((this.visitingCharge || 0) * (split / 100)).toFixed(2));
});

bookingSchema.virtual('providerCustomShare').get(function () {
  const split = this.surgeSplitSettings?.custom ?? 70;
  return parseFloat(((this.customCharges || 0) * (split / 100)).toFixed(2));
});

bookingSchema.virtual('providerPlatformShare').get(function () {
  const split = this.surgeSplitSettings?.platform ?? 0;
  return parseFloat(((this.platformFee || 0) * (split / 100)).toFixed(2));
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
      const { latLngToS2CellId } = require('../../shared/utils/s2-helper');
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
      case 'workstarted':
        statusChange.note = 'Service is in progress';
        if (!this.serviceStartedAt) {
          this.serviceStartedAt = new Date();
        }
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
    await this.recalculateFinancials();
  }

  next();
});

// Payment confirmation will be handled through Transaction model updates
// in the booking controller

// Virtual for booking progress status
bookingSchema.virtual('progressStatus').get(function () {
  const { getBookingProgress } = require('./booking-helper');
  return getBookingProgress(this);
});

// Dynamic SLA status virtual calculator
bookingSchema.virtual('slaStatus').get(function () {
  if (['Completed', 'completed', 'Cancelled', 'cancelled', 'Rejected', 'rejected', 'Expired', 'expired'].includes(this.status)) {
    return 'COMPLETED';
  }

  const now = new Date();
  const type = (this.bookingType || '').toLowerCase();

  let settings = null;
  try {
    if (global.systemSettingsCache) {
      settings = global.systemSettingsCache;
    }
  } catch (e) {
    // Ignore cache fetch errors
  }

  const thresholds = settings?.bookingSettings?.slaThresholds || {
    scheduled: { atRiskMinutes: 10, delayedMinutes: 15, criticalMinutes: 30 },
    instant: { atRiskMinutes: 15, delayedMinutes: 45, criticalMinutes: 60 },
    emergency: { atRiskMinutes: 5, delayedMinutes: 15, criticalMinutes: 20 }
  };

  if (type === 'scheduled') {
    if (!this.date) return 'ON_TIME';
    const scheduledTime = new Date(this.date);
    if (this.time) {
      const [hours, minutes] = this.time.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        scheduledTime.setHours(hours, minutes, 0, 0);
      }
    }
    const diffMs = scheduledTime.getTime() - now.getTime();
    const diffMins = diffMs / (60 * 1000);

    const atRisk = thresholds.scheduled?.atRiskMinutes ?? 10;
    const delayed = thresholds.scheduled?.delayedMinutes ?? 15;
    const critical = thresholds.scheduled?.criticalMinutes ?? 30;

    if (this.arrivedAt || this.workStartedAt) {
      return 'ON_TIME';
    }

    if (!this.journeyStartedAt && diffMins <= atRisk && diffMins > -delayed) {
      return 'AT_RISK';
    }
    if (!this.arrivedAt && diffMins <= 0) {
      if (diffMins <= -critical) {
        return 'CRITICAL';
      } else if (diffMins <= -delayed) {
        return 'DELAYED';
      } else {
        return 'AT_RISK';
      }
    }
  } else if (type === 'instant' || type === 'emergency') {
    if (this.arrivedAt || this.workStartedAt) {
      return 'ON_TIME';
    }
    const category = type === 'emergency' ? 'emergency' : 'instant';
    const atRisk = thresholds[category]?.atRiskMinutes ?? (category === 'emergency' ? 5 : 15);
    const delayed = thresholds[category]?.delayedMinutes ?? (category === 'emergency' ? 15 : 45);
    const critical = thresholds[category]?.criticalMinutes ?? (category === 'emergency' ? 20 : 60);

    const refTime = this.acceptedAt ? new Date(this.acceptedAt) : new Date(this.createdAt);
    const diffMins = (now.getTime() - refTime.getTime()) / (60 * 1000);

    if (diffMins >= critical) {
      return 'CRITICAL';
    }
    if (diffMins >= delayed) {
      return 'DELAYED';
    }
    if (!this.journeyStartedAt && diffMins >= atRisk) {
      return 'AT_RISK';
    }
  }

  return 'ON_TIME';
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
bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ customer: 1, status: 1, createdAt: -1 });
bookingSchema.index({ provider: 1 });
bookingSchema.index({ provider: 1, status: 1 });
bookingSchema.index({ provider: 1, date: 1, status: 1 });
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


bookingSchema.post('init', function (doc) {
  if (doc) {
    doc._previousStatus = doc.status;
  }
});

bookingSchema.methods.recalculateFinancials = async function (options = {}) {
  try {
    const { finalizeCommission = false, mode = 'normal' } = options;
    const previousStatus = this._previousStatus || (this.isNew ? null : this.status);
    const isFinalizingTransition = previousStatus !== 'completed' && this.status === 'completed' && !this.commissionSnapshotFinalized;

    // Lock financials if already finalized unless explicit financial adjustment
    if (this.commissionSnapshotFinalized && mode === 'normal' && !finalizeCommission) {
      return;
    }

    const CommissionRule = mongoose.model('CommissionRule');
    const firstService = this.services && this.services[0];
    const serviceId = firstService ? firstService.service : null;

    const commissionRule = await CommissionRule.getCommissionForProvider(
      this.provider,
      this.zoneId,
      'standard',
      serviceId
    );

    const isReferralDiscount = (this.couponApplied && this.couponApplied.isReferralCoupon) || this.isReferralDiscount;
    const referralDiscountAmount = isReferralDiscount ? (this.totalDiscount || 0) : 0;
    const providerApplicableDiscount = Math.max(0, (this.totalDiscount || 0) - referralDiscountAmount);
    const baseForCommission = Math.max(0, this.subtotal - providerApplicableDiscount);

    this.referralDiscountAmount = referralDiscountAmount;
    this.providerApplicableDiscount = providerApplicableDiscount;

    // Load settings for surge splits
    const { SystemConfig } = require('../system-setting/system-setting-model');
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
    const splitFestival = typeof splits.festival === 'number' && !isNaN(splits.festival) ? splits.festival : 70;
    const splitCustom = typeof splits.custom === 'number' && !isNaN(splits.custom) ? splits.custom : 70;
    const splitPlatform = typeof splits.platform === 'number' && !isNaN(splits.platform) ? splits.platform : 0;
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
    const provCustomShare = parseFloat((custom * (splitCustom / 100)).toFixed(2)) || 0;
    const provPlatformShare = parseFloat((platformFee * (splitPlatform / 100)).toFixed(2)) || 0;
    const provEmergencyShare = parseFloat((emergency * (splitEmergency / 100)).toFixed(2)) || 0;

    const providerSurgeShare = parseFloat((provVisitingShare + provRainShare + provTrafficShare + provNightShare + provDemandShare + provCustomShare + provPlatformShare + provEmergencyShare).toFixed(2)) || 0;
    const totalSurcharges = visiting + rain + traffic + night + demand + emergency + custom + platformFee;
    const companySurgeShare = parseFloat((totalSurcharges - providerSurgeShare).toFixed(2)) || 0;

    this.providerSurgeShare = providerSurgeShare;
    this.companySurgeShare = companySurgeShare;

    let activeCommissionRule = commissionRule;
    let effectiveRate = commissionRule ? commissionRule.value : 0;
    if (this.provider) {
      const Provider = mongoose.model('Provider');
      const providerDoc = await Provider.findById(this.provider);
      if (providerDoc && providerDoc.referralBenefit) {
        const { getReferralCommissionDiscount } = require('../referral/referral-helpers');
        effectiveRate = getReferralCommissionDiscount(providerDoc, commissionRule, baseForCommission);
        if (effectiveRate !== (commissionRule ? commissionRule.value : 0)) {
          activeCommissionRule = commissionRule.toObject ? commissionRule.toObject() : { ...commissionRule };
          activeCommissionRule.value = effectiveRate;
          this.referralDiscountApplied = true;
        }
      }
    }

    if (activeCommissionRule) {
      const { commission, netAmount } = CommissionRule.calculateCommission(baseForCommission, activeCommissionRule);
      this.commissionAmount = commission || 0;
      this.providerEarnings = parseFloat((netAmount + providerSurgeShare).toFixed(2));
      this.commissionRule = activeCommissionRule._id || null;

      // Populate snapshot metadata
      this.commissionSource = activeCommissionRule.conditionType === 'rating' ? 'rating_rule' : (activeCommissionRule._id ? 'standard_rule' : 'system_default');
      this.commissionRuleId = activeCommissionRule._id || null;
      this.commissionTypeSnapshot = activeCommissionRule.type || 'percentage';
      this.commissionValueSnapshot = activeCommissionRule.value || 0;
      this.commissionRateSnapshot = activeCommissionRule.type === 'percentage' ? effectiveRate : null;
      if (activeCommissionRule.ratingInfo) {
        this.ratingSnapshot = activeCommissionRule.ratingInfo.averageRating;
        this.ratingCountSnapshot = activeCommissionRule.ratingInfo.ratingCount;
        this.ratingEvaluationPeriodDays = activeCommissionRule.ratingInfo.periodDays;
      }
    } else {
      const defaultCommPercent = settings?.commissionSettings?.defaultCommission ?? parseFloat(process.env.DEFAULT_COMMISSION || 10);
      const commission = parseFloat(((baseForCommission * defaultCommPercent) / 100).toFixed(2));
      const netAmount = parseFloat((baseForCommission - commission).toFixed(2));

      this.commissionAmount = commission || 0;
      this.providerEarnings = parseFloat((netAmount + providerSurgeShare).toFixed(2));
      this.commissionRule = null;

      this.commissionSource = 'system_default';
      this.commissionRuleId = null;
      this.commissionTypeSnapshot = 'percentage';
      this.commissionValueSnapshot = defaultCommPercent;
      this.commissionRateSnapshot = defaultCommPercent;
    }

    if (finalizeCommission || isFinalizingTransition) {
      this.commissionSnapshotFinalized = true;
    }
  } catch (error) {
    console.error('Error in recalculateFinancials:', error);
    // Safe error fallback
    const defaultCommPercent = 10;
    const baseForCommission = Math.max(0, (this.subtotal || 0) - (this.totalDiscount || 0));
    const commission = parseFloat(((baseForCommission * defaultCommPercent) / 100).toFixed(2));
    this.commissionAmount = commission;
    this.providerEarnings = parseFloat((baseForCommission - commission).toFixed(2));
    this.commissionSource = 'system_default';
    this.commissionRuleId = null;
    this.commissionTypeSnapshot = 'percentage';
    this.commissionValueSnapshot = defaultCommPercent;
    this.commissionRateSnapshot = defaultCommPercent;
  }
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
