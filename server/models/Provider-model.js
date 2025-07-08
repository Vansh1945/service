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
        required: true
    },

    address: {
        street: String,
        city: String,
        pincode: String
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
        type: Number,
        default: null
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

    feedbacks: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Feedback'
        }
    ],


    bankDetails: {
        accountNo: String,
        ifsc: String,
        upiId: String
    },

    earningsHistory: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Transaction'
        }
    ],

    isDeleted: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true
});


// Password hashing before save
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

// Password comparison method
providerSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT
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


// // Add these to your existing schema
// providerSchema.virtual('averageRating').get(function () {
//     if (!this.feedbacks || this.feedbacks.length === 0) return 0;
//     const total = this.feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
//     return total / this.feedbacks.length;
// });

// // Add toJSON option to include virtuals in response
// providerSchema.set('toJSON', {
//     virtuals: true,
//     transform: function (doc, ret) {
//         delete ret.id;
//         if (ret.averageRating) {
//             ret.averageRating = ret.averageRating.toFixed(1);
//         }
//         return ret;
//     }
// });


const Provider = mongoose.model('Provider', providerSchema);
module.exports = Provider;