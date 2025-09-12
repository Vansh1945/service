const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const feedbackSchema = new Schema({
  // Common fields
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    immutable: true
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true,
    immutable: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date
  },
  
  // Provider-specific feedback (private to provider and admin)
  providerFeedback: {
    provider: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      immutable: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comment: {
      type: String,
      maxlength: 500,
      trim: true,
      default: ''
    },
    isEdited: {
      type: Boolean,
      default: false
    }
  },
  
  // Service-specific feedback (public)
  serviceFeedback: {
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      immutable: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comment: {
      type: String,
      maxlength: 500,
      trim: true,
      default: ''
    },
    isEdited: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
feedbackSchema.index({ 'providerFeedback.provider': 1 });
feedbackSchema.index({ 'serviceFeedback.service': 1 });

// Virtual for checking if feedback is complete
feedbackSchema.virtual('isComplete').get(function() {
  return this.providerFeedback.rating && this.serviceFeedback.rating;
});

// Middleware to update updatedAt when either feedback is modified
feedbackSchema.pre('save', function(next) {
  if (this.isModified('providerFeedback') || this.isModified('serviceFeedback')) {
    this.updatedAt = new Date();
  }
  next();
});



const Feedback = mongoose.model('Feedback', feedbackSchema);
module.exports = Feedback;