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
        default: 0,
        min: [0, 'Wallet balance cannot be negative']
    },
    walletHistory: [{
        amount: { type: Number, required: true },
        type: { type: String, enum: ['credit', 'debit'], required: true },
        description: { type: String, required: true },
        reference: { type: mongoose.Schema.Types.ObjectId },
        createdAt: { type: Date, default: Date.now }
    }],
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
        type: Date,
        default: Date.now
    },
}, {
    timestamps: true,
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            // Remove sensitive information when converting to JSON
            delete ret.password;
            delete ret.isDeleted;
            return ret;
        }
    }
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

// Wallet management methods
providerSchema.methods.addToWallet = async function(amount, description, reference) {
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }
    
    this.wallet += amount;
    this.walletHistory.push({
        amount,
        type: 'credit',
        description,
        reference
    });
    
    await this.save();
    return this.wallet;
};

providerSchema.methods.deductFromWallet = async function(amount, description, reference) {
    if (amount <= 0) {
        throw new Error('Amount must be positive');
    }
    if (this.wallet < amount) {
        throw new Error('Insufficient funds in wallet');
    }
    
    this.wallet -= amount;
    this.walletHistory.push({
        amount,
        type: 'debit',
        description,
        reference
    });
    
    await this.save();
    return this.wallet;
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

providerSchema.virtual('totalEarnings').get(function() {
    if (!this.populated('earningsHistory')) {
        throw new Error('You must populate earningsHistory to calculate total earnings');
    }
    
    return this.earningsHistory.reduce((total, transaction) => {
        return total + (transaction.amount || 0);
    }, 0);
});

// Query helper for active providers
providerSchema.query.active = function() {
    return this.where({ isDeleted: false, blockedTill: { $lte: new Date() } });
};

// Static method to find by email
providerSchema.statics.findByEmail = function(email) {
    return this.findOne({ email }).select('+password');
};

module.exports = mongoose.model('Provider', providerSchema);