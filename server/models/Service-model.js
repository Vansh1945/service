const mongoose = require('mongoose');
const { Schema } = mongoose;

// Service Schema
const serviceSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  category: {
    type: String,
    required: true,
    enum: ['Electrical', 'AC', 'Appliance Repair', 'Other'], 
    default: 'Other'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  image: {
    type: String,
    default: 'default-service.jpg'
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 0.25,
    max: 500,
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
  timestamps: false
});

// Indexes
serviceSchema.index({ title: 'text', description: 'text' });
serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ createdBy: 1 });

// Pre-save hook
serviceSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for formatted duration
serviceSchema.virtual('durationFormatted').get(function () {
  const hours = Math.floor(this.duration);
  const minutes = Math.round((this.duration - hours) * 60);
  return `${hours > 0 ? `${hours} hr` : ''} ${minutes > 0 ? `${minutes} min` : ''}`.trim();
});

// ADMIN METHODS ==============================================

// Static method for admin to create service
serviceSchema.statics.createService = async function (adminId, serviceData) {
  const service = new this({
    ...serviceData,
    createdBy: adminId
  });
  return service.save();
};

// Static method for admin to update base price
serviceSchema.statics.updateBasePrice = async function (adminId, serviceId, newPrice) {
  const service = await this.findById(serviceId);

  if (!service.createdBy.equals(adminId)) {
    throw new Error('Not authorized to update this service');
  }

  service.basePrice = newPrice;
  return service.save();
};

// QUERY METHODS =============================================

// Query active services by category
serviceSchema.statics.findActiveByCategory = function (category) {
  return this.find({ category, isActive: true });
};

// Query services for provider
serviceSchema.statics.findForProvider = function () {
  return this.find({ isActive: true })
    .select('title category description image basePrice duration');
};

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;