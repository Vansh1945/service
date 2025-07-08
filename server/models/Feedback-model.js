const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const feedbackSchema = new Schema({
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'User', // or 'Customer' if you have a separate model
    required: true, 
  },
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: true, 
  },
  booking: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
  rating: {
    type: Number,
    required: true, 
    min: 1, 
    max: 5, 
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
  timestamps: true, // Adds createdAt and updatedAt automatically
  toJSON: { virtuals: true }, // Include virtuals when converted to JSON
  toObject: { virtuals: true }
});

// Indexes for faster queries
feedbackSchema.index({ provider: 1 });
feedbackSchema.index({ customer: 1 });
feedbackSchema.index({ booking: 1 }, { unique: true }); // Ensures one feedback per booking

// Virtual population (if you need to access data without storing it)
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

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;