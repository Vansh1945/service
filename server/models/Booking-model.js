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
  postalCode: {
    type: String,
    required: [true, 'Pincode is required'],
    match: [/^[0-9]{6}$/, 'Please provide a valid 6-digit pincode']
  },
  state: {
    type: String,
    required: true
  },
  country: {
    type: String,
    default: 'India'
  }
});

// Service Item Sub-Schema
const serviceItemSchema = new Schema({
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  }
}, { _id: true });

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
    required: true
  },
  services: [serviceItemSchema],
  date: {
    type: Date,
    required: [true, 'Booking date is required'],
    min: [Date.now, 'Booking date cannot be in the past'],
    validate: {
      validator: function(value) {
        return value instanceof Date && !isNaN(value);
      },
      message: 'Invalid date format'
    }
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
  totalDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  invoice: {
    type: Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  feedback: [{
    type: Schema.Types.ObjectId,
    ref: 'Feedback'
  }],
  complaint: {
    type: Schema.Types.ObjectId,
    ref: 'Complaint'
  },
  adminRemark: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
}, {
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove virtuals that might cause issues during serialization
      delete ret.id;
      delete ret._id;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Remove virtuals that might cause issues during serialization
      delete ret.id;
      delete ret._id;
      return ret;
    }
  }
});

// Pre-save hook to update timestamps
bookingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for booking datetime - with null checks
bookingSchema.virtual('bookingDateTime').get(function () {
  if (!this.date || !this.time) return null;
  
  try {
    const dateStr = this.date.toISOString().split('T')[0];
    return new Date(`${dateStr}T${this.time}`);
  } catch (error) {
    return null;
  }
});

// Virtual for isUpcoming - with null checks
bookingSchema.virtual('isUpcoming').get(function () {
  if (!this.bookingDateTime || !this.status) return false;
  
  try {
    return this.status === 'accepted' && this.bookingDateTime > new Date();
  } catch (error) {
    return false;
  }
});

// Static method to find upcoming bookings
bookingSchema.statics.findUpcoming = function (userId, userType) {
  const query = {};
  query[userType] = userId;
  query.status = 'accepted';

  return this.find(query)
    .where('bookingDateTime').gt(new Date())
    .sort({ date: 1, time: 1 });
};

// Instance method to cancel booking
bookingSchema.methods.cancel = function (reason) {
  if (this.status === 'completed') {
    throw new Error('Cannot cancel a completed booking');
  }
  this.status = 'cancelled';
  return this.save();
};

// Instance method to complete booking
bookingSchema.methods.complete = function () {
  if (this.status !== 'accepted') {
    throw new Error('Only accepted bookings can be marked completed');
  }
  this.status = 'completed';
  return this.save();
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;