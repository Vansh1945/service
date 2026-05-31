const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const walletSchema = new mongoose.Schema({
    availableBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    totalWithdrawn: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const providerSchema = new mongoose.Schema({
    // Identifiers
    providerId: {
        type: String,
        unique: true,
        sparse: true
    },
    // Basic Information
    name: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Mobile number is required'],
        maxlength: [10, 'Mobile number cannot exceed 10 characters'],
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit mobile number'],
    },
    password: {
        type: String,
        required: function () { return !this.authProvider || this.authProvider === 'email'; },
        minlength: [8, 'Password must be at least 8 characters long'],
        select: false
    },
    // Firebase / OAuth fields
    firebaseUid: { type: String, sparse: true, index: true },
    authProvider: {
        type: String,
        enum: ['email', 'google', 'phone'],
        default: 'email'
    },
    // Refresh token sessions (max 5)
    refreshTokens: [{
        tokenHash: { type: String, required: true },
        deviceId: { type: String },
        fingerprint: { type: String },
        ipHash: { type: String },
        userAgent: { type: String },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
        isValid: { type: Boolean, default: true }
    }],
    // Known devices
    deviceIds: [{
        deviceId: { type: String },
        fingerprint: { type: String },
        platform: { type: String },
        userAgent: { type: String },
        firstSeen: { type: Date, default: Date.now },
        lastSeen: { type: Date, default: Date.now },
        isTrusted: { type: Boolean, default: true }
    }],
    // Login history (last 20)
    loginHistory: [{
        timestamp: { type: Date, default: Date.now },
        ip: { type: String },
        userAgent: { type: String },
        deviceId: { type: String },
        method: { type: String, enum: ['email', 'google', 'phone', 'refresh'] },
        success: { type: Boolean, default: true },
        suspiciousFlag: { type: Boolean, default: false }
    }],
    lastLoginIp: { type: String },
    lastLoginAt: { type: Date },
    suspiciousScore: { type: Number, default: 0 },

    dateOfBirth: {
        type: Date,
        required: [true, 'Date of birth is required']
    },

    // Professional Information
    role: {
        type: String,
        default: 'provider'
    },

    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: [true, 'Service is required'],
    }],
    experience: {
        type: Number,
        min: [0, 'Experience cannot be negative'],
        max: [40, 'Experience cannot be more than 40 years']
    },
    serviceArea: {
        type: String,
    },

    address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        postalCode: { type: String },
        country: { type: String, default: 'India' },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        s2CellId: { type: String, index: true, default: null },
        s2CellIdPrecise: { type: String, index: true, default: null },
        addressLine: { type: String },
        houseNumber: { type: String },
        road: { type: String },
        landmark: { type: String },
        area: { type: String },
        pincode: { type: String },
        formattedAddress: { type: String }
    },

    // Geo JSON Location for 2dsphere queries
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

    currentLocation: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        },
        s2CellId: { type: String, index: true, default: null },
        s2CellIdPrecise: { type: String, index: true, default: null },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    // Zone tracking fields
    currentZone: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Zone', default: null
    },
    zoneUpdatedAt: {
        type: Date,
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

    isOnline: {
        type: Boolean,
        default: false
    },

    activeBooking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        default: null
    },

    // Bank Details
    bankDetails: {
        accountNo: {
            type: String,
            validate: {
                validator: function (v) {
                    return /^[0-9]{9,18}$/.test(v);
                },
                message: props => `${props.value} is not a valid account number!`
            }
        },
        ifsc: {
            type: String,
            validate: {
                validator: function (v) {
                    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
                },
                message: props => `${props.value} is not a valid IFSC code!`
            }
        },
        bankName: String,
        accountName: String,
        passbookImage: String,
        passbookImagePublicId: String,
        verified: {
            type: Boolean,
            default: false
        }
    },

    // KYC Status
    kycStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    rejectionReason: {
        type: String,
    },

    // Profile
    profilePicUrl: {
        type: String,
        default: 'default-provider.jpg'
    },
    profilePicPublicId: String,
    resume: String,
    resumePublicId: String,

    // Service Stats
    approved: {
        type: Boolean,
        default: false
    },
    testPassed: {
        type: Boolean,
        default: false
    },

    // Performance Score
    performanceScore: {
        rating: { type: Number, default: 0 },
        onTimePercentage: { type: Number, default: 0 },
        completionPercentage: { type: Number, default: 0 },
        trustScore: { type: Number, default: 100 },
        cancellationRatio: { type: Number, default: 0 },
        complaintRatio: { type: Number, default: 0 },
        codAbuseRisk: { type: String, default: 'LOW' },
        restrictionsActive: { type: Boolean, default: false },
        restrictedUntil: { type: Date, default: null },
        restrictionReason: { type: String, default: null }
    },

    completedBookings: {
        type: Number,
        default: 0
    },
    canceledBookings: {
        type: Number,
        default: 0
    },

    // References
    feedbacks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Feedback'
    }],

    // Status
    blockedTill: Date,
    isDeleted: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: false
    },
    profileComplete: {
        type: Boolean,
        default: false
    },
    registrationDate: {
        type: Date,
        default: Date.now
    },

    // Wallet Information
    wallet: walletSchema,
    fcmDevices: [{
        token: { type: String, required: true },
        deviceId: { type: String, required: true },
        platform: { type: String },
        lastActive: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true },
        appVersion: { type: String }
    }],
    withdrawalSecurity: {
        otp: String,
        otpExpires: Date,
        attempts: { type: Number, default: 0 },
        lastRequestTime: Date,
        isFlagged: { type: Boolean, default: false },
        flagReason: String,
        pendingAmount: Number,
        pendingRequestTime: Date
    },
    metadata: {
        ip: String,
        device: String,
        userAgent: String,
        lastLogin: Date
    },
    isSuspended: {
        type: Boolean,
        default: false
    },
    suspensionReason: String,
    notificationPreferences: {
        booking: { type: Boolean, default: true },
        payment: { type: Boolean, default: true },
        complaint: { type: Boolean, default: true },
        promotional: { type: Boolean, default: true },
        providerUpdates: { type: Boolean, default: true },
        adminAlerts: { type: Boolean, default: true },
        wallet: { type: Boolean, default: true },
        reminder: { type: Boolean, default: true },
        pushEnabled: { type: Boolean, default: true },
        quietHours: {
            enabled: { type: Boolean, default: false },
            start: { type: String, default: '22:00' },
            end: { type: String, default: '08:00' }
        }
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            delete ret.password;
            delete ret.isDeleted;
            return ret;
        }
    }
});

// Indexes for query optimization
providerSchema.index({ role: 1 });
providerSchema.index({ services: 1 });
providerSchema.index({ isActive: 1, approved: 1 });
providerSchema.index({ 'performanceScore.rating': -1 });
providerSchema.index({ location: '2dsphere' });
providerSchema.index({ currentLocation: '2dsphere' });
providerSchema.index({ currentZone: 1 });
providerSchema.index({ createdAt: -1 });

providerSchema.pre('save', async function (next) {
    // Populate S2 cell fields on creation or coordinate modifications
    if (this.isModified('address.lat') || this.isModified('address.lng') || this.isNew) {
        try {
            const { latLngToS2CellId } = require('../utils/s2Helper');
            if (this.address && typeof this.address.lat === 'number' && typeof this.address.lng === 'number') {
                this.address.s2CellId = latLngToS2CellId(this.address.lat, this.address.lng, 13);
                this.address.s2CellIdPrecise = latLngToS2CellId(this.address.lat, this.address.lng, 20);
            }
        } catch (s2Err) {
            console.error('Error computing provider address S2 cells in pre-save:', s2Err);
        }
    }

    if (this.isModified('currentLocation.coordinates') || this.isNew) {
        try {
            const { latLngToS2CellId } = require('../utils/s2Helper');
            if (this.currentLocation && this.currentLocation.coordinates && this.currentLocation.coordinates.length === 2) {
                const lng = this.currentLocation.coordinates[0];
                const lat = this.currentLocation.coordinates[1];
                if (typeof lat === 'number' && typeof lng === 'number' && (lat !== 0 || lng !== 0)) {
                    const cell13 = latLngToS2CellId(lat, lng, 13);
                    const cell20 = latLngToS2CellId(lat, lng, 20);
                    this.currentLocation.s2CellId = cell13;
                    this.currentLocation.s2CellIdPrecise = cell20;
                    // Also populate top level fields
                    this.s2CellId = cell13;
                    this.s2CellIdPrecise = cell20;
                }
            }
        } catch (s2Err) {
            console.error('Error computing provider currentLocation S2 cells in pre-save:', s2Err);
        }
    }

    if (this.isNew) {
        const existingProvider = await this.constructor.findOne({
            email: this.email,
            isActive: true,
            approved: true
        });
        if (existingProvider) {
            return next(new Error('A fully active and approved provider with this email already exists.'));
        }
    }
    next();
});

// Password hashing middleware (skip Firebase users)
providerSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        return next();
    } catch (err) {
        return next(err);
    }
});

// Methods
providerSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

providerSchema.methods.generateJWT = function () {
    return jwt.sign(
        { id: this._id, email: this.email, role: this.role, kycStatus: this.kycStatus },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );
};

providerSchema.methods.generateAccessToken = providerSchema.methods.generateJWT;

providerSchema.methods.generateRefreshToken = function (deviceInfo = {}) {
    const raw = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    this.refreshTokens = (this.refreshTokens || [])
        .filter(t => t.isValid && t.expiresAt > new Date())
        .slice(-4);

    this.refreshTokens.push({
        tokenHash,
        deviceId: deviceInfo.deviceId || '',
        fingerprint: deviceInfo.fingerprint || '',
        ipHash: deviceInfo.ipHash || '',
        userAgent: deviceInfo.userAgent || '',
        expiresAt,
        isValid: true
    });

    return { raw, expiresAt };
};

// KYC methods
providerSchema.methods.rejectKYC = function (reason) {
    this.kycStatus = 'rejected';
    this.rejectionReason = reason;
    this.approved = false;
    return this.save();
};

providerSchema.methods.approveKYC = function () {
    this.kycStatus = 'approved';
    this.approved = true;
    this.rejectionReason = '';
    return this.save();
};

providerSchema.methods.resetKYC = function () {
    this.kycStatus = 'pending';
    this.rejectionReason = '';
    return this.save();
};

// Virtuals
providerSchema.virtual('age').get(function () {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
});

providerSchema.virtual('averageRating').get(function () {
    if (!this.feedbacks || this.feedbacks.length === 0) return 0;
    const validFeedbacks = this.feedbacks.filter(fb => fb && fb.providerFeedback && fb.providerFeedback.rating);
    if (validFeedbacks.length === 0) return 0;

    const sum = validFeedbacks.reduce((total, feedback) =>
        total + feedback.providerFeedback.rating, 0);
    return parseFloat((sum / validFeedbacks.length).toFixed(1));
});

providerSchema.query.active = function () {
    return this.where({ isDeleted: false, blockedTill: { $lte: new Date() } });
};

providerSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: new RegExp(`^${email}$`, 'i') }).select('+password');
};

module.exports = mongoose.model('Provider', providerSchema);