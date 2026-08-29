const mongoose = require("mongoose");



// Schema for tracking status changes
const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    trim: true,
    default: null
  },
  updatedBy: {
    type: String,
    enum: ['customer', 'provider', 'admin', 'system'],
    default: 'system'
  },
  updatedById: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  }
});

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      unique: true,
      index: true
    },
    // 1. Customer Details
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Links to the User who made the complaint
      required: false,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: function () { return (this.category || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'serviceissue'; },
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider", // Assuming you have a Provider model
      required: function () { return (this.category || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'serviceissue'; },
    },

    // New Fields for Role-Based Complaints
    userType: {
      type: String,
      enum: ["customer", "provider"],
      required: true,
      default: "customer"
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
    },

    // Complaint Details
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    category: {
      type: String,
      required: true,
      enum: ["serviceissue", "paymentissue", "refundrequest", "suggestion", "other", "booking", "account", "deliveryissue", "payment"],
      set: function (v) {
        if (!v) return v;
        return v.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    },



    // 5. File Storage (Cloudinary)
    images: [{
      secure_url: { type: String, required: true },
      public_id: { type: String, required: true }
    }],

    // Complaint Status
    status: {
      type: String,
      enum: ["open", "underreview", "waitingforcustomer", "waitingforprovider", "escalated", "resolutionproposed", "resolved", "rejected", "cancelled", "closed", "reopened"],
      default: "open",
      set: function (v) {
        if (!v) return v;
        return v.toLowerCase().replace(/[^a-z0-9]/g, '');
      }
    },

    // Response deadline for provider replies
    responseDeadline: {
      type: Date,
      default: null
    },

    // 4. Timeline & History
    statusHistory: [statusHistorySchema], // Tracks all status changes


    // 2. Reopen Functionality
    reopenHistory: [{
      reopenedAt: { type: Date, default: Date.now },
      reason: { type: String, required: true }
    }],

    // Resolution Details
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolutionNotes: {
      type: String,
      default: null
    },
    resolution: {
      type: String,
      default: null
    },
    bookingCancelled: {
      type: Boolean,
      default: false
    },
    bookingCancelledAt: {
      type: Date,
      default: null
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null
    }
  },
  {
    // Complaint creation date and time
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Pre-validate hook to normalize category and status before Mongoose enum validation
complaintSchema.pre("validate", function (next) {
  if (this.category) {
    this.category = this.category.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  if (this.status) {
    this.status = this.status.toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  next();
});

// Middleware to track status changes and initial creation
complaintSchema.pre("save", function (next) {

  const now = new Date();
  if (this.isNew) {
    // Initial status history entry on creation
    if (!this.statusHistory || this.statusHistory.length === 0) {
      this.statusHistory = [{
        status: this.status || 'open',
        timestamp: now,
        updatedAt: now,
        note: this._statusNote || null,
        updatedBy: this._statusUpdatedBy || (this.userType || 'customer'),
        updatedById: this._statusUpdatedById || this.customer || this.userId || null
      }];
    }
  } else if (this.isModified("status")) {
    // Status transition history entry
    const lastHistory = this.statusHistory && this.statusHistory.length > 0 ? this.statusHistory[this.statusHistory.length - 1] : null;

    if (!lastHistory || lastHistory.status !== this.status || (now.getTime() - new Date(lastHistory.timestamp || lastHistory.updatedAt || 0).getTime() > 1000)) {
      this.statusHistory.push({
        status: this.status,
        timestamp: now,
        updatedAt: now,
        note: this._statusNote || null,
        updatedBy: this._statusUpdatedBy || 'system',
        updatedById: this._statusUpdatedById || null
      });
    }
  }

  if (this.isModified("status")) {
    const normS = (this.status || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (["solved", "resolved"].includes(normS)) {
      this.resolvedAt = this.resolvedAt || now;
    }
  }
  next();
});

// Indexes for query optimization
complaintSchema.index({ booking: 1 });
complaintSchema.index({ customer: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ userId: 1 });
complaintSchema.index({ providerId: 1 });
complaintSchema.index({ userType: 1 });
complaintSchema.index({ booking: 1, status: 1 });
complaintSchema.index({ providerId: 1, status: 1 });

const Complaint = mongoose.model("Complaint", complaintSchema);

module.exports = Complaint;