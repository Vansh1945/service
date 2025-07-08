const mongoose = require('mongoose');
const { Schema } = mongoose;

// Address Sub-Schema
const addressSchema = new Schema({
  street: {
    type: String,
    required: [true, 'Street address is required'],
    trim: true,
    maxlength: [200, 'Street address cannot exceed 200 characters']
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    maxlength: [50, 'City name cannot exceed 50 characters']
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required'],
    match: [/^[0-9]{6}$/, 'Please provide a valid 6-digit pincode']
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 &&
                 coords[1] >= -90 && coords[1] <= 90;
        },
        message: 'Invalid coordinates. Provide [longitude, latitude]'
      }
    }
  }
});

// Booking Schema
const bookingSchema = new Schema({
  customer: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer ID is required']
  },
  provider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: [true, 'Provider ID is required']
  },
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Booking date is required'],
    min: [Date.now, 'Booking date cannot be in the past']
  },
  time: {
    type: String,
    required: [true, 'Booking time is required'],
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide time in HH:MM format']
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'cod'],
    default: 'pending'
  },
  address: {
    type: addressSchema,
    required: [true, 'Address is required']
  },
  couponApplied: {
    type: String,
    trim: true
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  invoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  feedback: {
    type: Schema.Types.ObjectId,
    ref: 'Feedback'
  },
  complaint: {
    type: Schema.Types.ObjectId,
    ref: 'Complaint'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ provider: 1, status: 1 });
bookingSchema.index({ service: 1, status: 1 });
bookingSchema.index({ date: 1, time: 1 });
bookingSchema.index({ 'address.coordinates': '2dsphere' });

// Pre-save hook to update timestamps
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for booking datetime
bookingSchema.virtual('bookingDateTime').get(function() {
  const dateStr = this.date.toISOString().split('T')[0];
  return new Date(`${dateStr}T${this.time}`);
});

// Virtual for isUpcoming
bookingSchema.virtual('isUpcoming').get(function() {
  return this.status === 'accepted' && this.bookingDateTime > new Date();
});

// Static method to find upcoming bookings
bookingSchema.statics.findUpcoming = function(userId, userType) {
  const query = {};
  query[userType] = userId;
  query.status = 'accepted';
  
  return this.find(query)
    .where('bookingDateTime').gt(new Date())
    .sort({ date: 1, time: 1 });
};

// Instance method to cancel booking
bookingSchema.methods.cancel = function(reason) {
  if (this.status === 'completed') {
    throw new Error('Cannot cancel a completed booking');
  }
  this.status = 'cancelled';
  return this.save();
};

// Instance method to complete booking
bookingSchema.methods.complete = function() {
  if (this.status !== 'accepted') {
    throw new Error('Only accepted bookings can be marked completed');
  }
  this.status = 'completed';
  return this.save();
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;