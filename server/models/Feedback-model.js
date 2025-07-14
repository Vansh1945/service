const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const feedbackSchema = new Schema({
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: true
  },
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 500,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
feedbackSchema.index({ provider: 1 });
feedbackSchema.index({ customer: 1 });
feedbackSchema.index({ service: 1 });
feedbackSchema.index({ booking: 1 }, { unique: true });

// Virtuals
feedbackSchema.virtual('customerDetails', {
  ref: 'User',
  localField: 'customer',
  foreignField: '_id',
  justOne: true
});

feedbackSchema.virtual('providerDetails', {
  ref: 'Provider',
  localField: 'provider',
  foreignField: '_id',
  justOne: true
});

feedbackSchema.virtual('serviceDetails', {
  ref: 'Service',
  localField: 'service',
  foreignField: '_id',
  justOne: true
});

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;