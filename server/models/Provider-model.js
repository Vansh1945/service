const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const providerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true
    },
    resume: {
        type: String,
        required: true
    },
    role: {
        type: String,
        default: 'provider'
    },
    profilePicUrl: {
        type: String,
        default: 'default-provider.jpg'
    },
    approved: {
        type: Boolean,
        default: false
    },
    testPassed: {
        type: Boolean,
        default: false
    },
    services: {
        type: String,
        enum: ['Electrical', 'AC', 'Appliance Repair', 'Other'],
    },
    address: {
        street: String,
        city: String,
        state: String,
        postalCode: String
    },
    serviceArea: {
        type: String,
        required: true,
    },
    experience: {
        type: Number,
        required: true,
        min: 0,
        max: 40
    },
    wallet: {
        type: Number,
        default: 0
    },
    commissionRate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Complaint'
    },
    blockedTill: {
        type: Date
    },
    completedBookings: {
        type: Number,
        default: 0
    },
    canceledBookings: {
        type: Number,
        default: 0
    },
    feedbacks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Feedback'
    }],
    bankDetails: {
        accountNo: String,
        ifsc: String,
        upiId: String
    },
    earningsHistory: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }],
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Password hashing and other methods remain the same
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

providerSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

providerSchema.methods.generateJWT = function () {
    return jwt.sign(
        {
            id: this._id,
            email: this.email,
            role: this.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
};

module.exports = mongoose.model('Provider', providerSchema);