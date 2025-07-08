const mongoose = require('mongoose');
const { Schema } = mongoose;

// Service Schema with Hybrid Pricing Model
const serviceSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Service title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['Electrical', 'Plumbing', 'HVAC', 'Handyman', 'Appliance Repair', 'Other'],
    default: 'Other'
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    type: String,
    default: 'default-service.jpg'
  },
  // Admin-set base price
  basePrice: {
    type: Number,
    required: [true, 'Base price is required'],
    min: [0, 'Price cannot be negative']
  },
  // Provider-specific pricing adjustments
  providerPrices: [{
    provider: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true
    },
    adjustedPrice: {
      type: Number,
      required: true,
      validate: {
        validator: function(value) {
          // Check if price is within ±10% of base price
          const minPrice = this.parent().basePrice * 0.9;
          const maxPrice = this.parent().basePrice * 1.1;
          return value >= minPrice && value <= maxPrice;
        },
        message: 'Price must be within ±10% of base price'
      }
    },
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Creator is required']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  duration: {
    type: Number, // in hours
    required: [true, 'Duration is required'],
    min: [0.25, 'Minimum duration is 15 minutes'],
    max: [24, 'Maximum duration is 24 hours']
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
  toObject: { virtuals: true }
});

// Indexes
serviceSchema.index({ title: 'text', description: 'text' });
serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ 'providerPrices.provider': 1 });
serviceSchema.index({ createdBy: 1 });

// Pre-save hook
serviceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtuals
serviceSchema.virtual('durationFormatted').get(function() {
  const hours = Math.floor(this.duration);
  const minutes = Math.round((this.duration - hours) * 60);
  return `${hours > 0 ? `${hours} hr` : ''} ${minutes > 0 ? `${minutes} min` : ''}`.trim();
});

// ADMIN METHODS ==============================================

// Static method for admin to create service
serviceSchema.statics.createService = async function(adminId, serviceData) {
  const service = new this({
    ...serviceData,
    createdBy: adminId
  });
  return service.save();
};

// Static method for admin to update base price
serviceSchema.statics.updateBasePrice = async function(adminId, serviceId, newPrice) {
  const service = await this.findById(serviceId);
  
  if (!service.createdBy.equals(adminId)) {
    throw new Error('Not authorized to update this service');
  }

  service.basePrice = newPrice;
  
  // Revalidate all provider prices against new base price
  service.providerPrices.forEach(pp => {
    const minPrice = newPrice * 0.9;
    const maxPrice = newPrice * 1.1;
    pp.adjustedPrice = Math.max(minPrice, Math.min(maxPrice, pp.adjustedPrice));
  });

  return service.save();
};

// PROVIDER METHODS ==========================================

// Method for provider to set their price
serviceSchema.methods.setProviderPrice = function(providerId, price) {
  const minPrice = this.basePrice * 0.9;
  const maxPrice = this.basePrice * 1.1;
  
  if (price < minPrice || price > maxPrice) {
    throw new Error(`Price must be between ₹${minPrice.toFixed(2)} and ₹${maxPrice.toFixed(2)}`);
  }

  const existingPrice = this.providerPrices.find(pp => pp.provider.equals(providerId));
  
  if (existingPrice) {
    existingPrice.adjustedPrice = price;
  } else {
    this.providerPrices.push({
      provider: providerId,
      adjustedPrice: price
    });
  }

  return this.save();
};

// Method for provider to get their price
serviceSchema.methods.getProviderPrice = function(providerId) {
  const providerPrice = this.providerPrices.find(pp => pp.provider.equals(providerId));
  return providerPrice ? providerPrice.adjustedPrice : this.basePrice;
};

// Method to get all active provider prices
serviceSchema.methods.getAllActivePrices = function() {
  return this.providerPrices
    .filter(pp => pp.isActive)
    .map(pp => ({
      provider: pp.provider,
      price: pp.adjustedPrice,
      discount: ((this.basePrice - pp.adjustedPrice) / this.basePrice * 100).toFixed(1)
    }));
};

// QUERY METHODS =============================================

// Query active services by category
serviceSchema.statics.findActiveByCategory = function(category) {
  return this.find({ category, isActive: true });
};

// Query services with provider's specific price
serviceSchema.statics.findForProvider = function(providerId) {
  return this.aggregate([
    { $match: { isActive: true } },
    { $addFields: {
      providerPrice: {
        $let: {
          vars: {
            pp: { $arrayElemAt: [
              { $filter: {
                input: "$providerPrices",
                cond: { $eq: ["$$this.provider", providerId] }
              }},
              0
            ]}
          },
          in: { $ifNull: ["$$pp.adjustedPrice", "$basePrice"] }
        }
      }
    }},
    { $project: {
      title: 1,
      category: 1,
      description: 1,
      image: 1,
      basePrice: 1,
      providerPrice: 1,
      duration: 1,
      durationFormatted: 1
    }}
  ]);
};

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;