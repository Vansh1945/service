const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const providerSchema = new mongoose.Schema({
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
        validate: {
            validator: function (v) {
                return /^[0-9]{10}$/.test(v);
            },
            message: props => `${props.value} is not a valid 10-digit mobile number!`
        }
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters long'],
        select: false
    },
    dateOfBirth: {
        type: Date,
        required: [true, 'Date of birth is required']
    },

    // Professional Information
    role: {
        type: String,
        default: 'provider'
    },
    services: {
        type: String,
        enum: ['Electrical', 'AC', 'Appliance Repair', 'Other'],
    },
    experience: {
        type: Number,
        min: [0, 'Experience cannot be negative'],
        max: [40, 'Experience cannot be more than 40 years']
    },
    serviceArea: {
        type: String,
    },

    // Address Information
    address: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        postalCode: { type: String },
        country: { type: String, default: 'India' }
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
        passbookImage: {
            type: String,
        },
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
    resume: {
        type: String,
    },

    // Service Stats
    approved: {
        type: Boolean,
        default: false
    },
    testPassed: {
        type: Boolean,
        default: false
    },
    wallet: {
        type: Number,
        default: 0
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
    earningsHistory: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }],

    // Status
    blockedTill: {
        type: Date
    },
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
        type: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true }
});

// Password hashing middleware
providerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        return next();
    } catch (err) {
        return next(err);
    }
});

// Method to compare passwords
providerSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Method to generate JWT token
providerSchema.methods.generateJWT = function () {
    return jwt.sign(
        {
            id: this._id,
            email: this.email,
            role: this.role,
            kycStatus: this.kycStatus
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// Method to handle KYC rejection
providerSchema.methods.rejectKYC = function (reason) {
    this.kycStatus = 'rejected';
    this.rejectionReason = reason;
    this.approved = false;
    return this.save();
};

// Method to approve KYC
providerSchema.methods.approveKYC = function () {
    this.kycStatus = 'approved';
    this.approved = true;
    this.rejectionReason = '';
    return this.save();
};

// Method to reset KYC for resubmission
providerSchema.methods.resetKYC = function () {
    this.kycStatus = 'pending';
    this.rejectionReason = '';
    return this.save();
};

// Virtual for age calculation
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

module.exports = mongoose.model('Provider', providerSchema);