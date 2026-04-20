const mongoose = require("mongoose");



// Schema for tracking status changes
const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
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
      required: function () { return this.category === 'Service issue'; },
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider", // Assuming you have a Provider model
      required: function () { return this.category === 'Service issue'; },
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
      enum: ["Service issue", "Payment issue", "Delivery issue", "Suggestion", "Payment", "Booking", "Account", "Other"],
    },

    // 5. File Storage (Cloudinary)
    images: [{
      secure_url: { type: String, required: true },
      public_id: { type: String, required: true }
    }],

    // Complaint Status
    status: {
      type: String,
      enum: ["Open", "In-Progress", "Solved", "Reopened", "Closed"],
      default: "Open",
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
    }
  },
  {
    // Complaint creation date and time
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Middleware to track status changes
complaintSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    this.statusHistory.push({ status: this.status });

    if (this.status === "Solved") {
      this.resolvedAt = new Date();
    } else if (this.status !== "Solved") {
      this.resolvedAt = null;
      this.resolvedBy = null;
    }
  }
  next();
});

// Initialize status history on creation
complaintSchema.pre("save", function (next) {
  if (this.isNew) {
    this.statusHistory.push({ status: 'Open' });
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

const Complaint = mongoose.model("Complaint", complaintSchema);

module.exports = Complaint;