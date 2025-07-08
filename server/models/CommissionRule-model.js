const mongoose = require('mongoose');
const { Schema } = mongoose;

// Commission Rule Schema
const commissionRuleSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Commission type (flat or percentage)
  type: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  // Commission value (percentage or fixed amount)
  value: {
    type: Number,
    required: true,
    min: 0
  },
  // Applicable to (all providers or specific)
  applicableTo: {
    type: String,
    enum: ['all', 'specific'],
    default: 'all'
  },
  // Specific providers if applicableTo is 'specific'
  providers: [{
    type: Schema.Types.ObjectId,
    ref: 'Provider'
  }],
  // Location-based rules
  locations: [{
    type: String,
    enum: ['North', 'South', 'East', 'West', 'Central']
  }],
  // Performance tiers
  performanceTier: {
    type: String,
    enum: ['basic', 'standard', 'premium', null],
    default: null
  },
  // Service categories this applies to
  serviceCategories: [{
    type: String,
    enum: ['Electrical', 'Plumbing', 'HVAC', 'Handyman', 'Appliance Repair', 'Other']
  }],
  // Minimum booking amount for this rule to apply
  minBookingAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  // Is this rule active
  isActive: {
    type: Boolean,
    default: true
  },
  // Created/updated by admin
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Indexes for performance
commissionRuleSchema.index({ isActive: 1 });
commissionRuleSchema.index({ applicableTo: 1 });
commissionRuleSchema.index({ providers: 1 });
commissionRuleSchema.index({ locations: 1 });
commissionRuleSchema.index({ performanceTier: 1 });
commissionRuleSchema.index({ serviceCategories: 1 });

// Static method to get applicable commission for a booking
commissionRuleSchema.statics.getCommissionForBooking = async function(bookingDetails) {
  const { providerId, serviceCategory, bookingAmount, providerLocation, providerPerformanceTier } = bookingDetails;
  
  // Find all active rules that could apply
  const rules = await this.find({
    isActive: true,
    $or: [
      { applicableTo: 'all' },
      { 
        applicableTo: 'specific',
        providers: providerId
      }
    ],
    $or: [
      { serviceCategories: [] }, // Applies to all categories
      { serviceCategories: serviceCategory }
    ],
    minBookingAmount: { $lte: bookingAmount }
  });

  // Filter rules by location if specified
  const locationFiltered = rules.filter(rule => 
    rule.locations.length === 0 || 
    rule.locations.includes(providerLocation)
  );

  // Filter rules by performance tier if specified
  const tierFiltered = locationFiltered.filter(rule => 
    !rule.performanceTier || 
    rule.performanceTier === providerPerformanceTier
  );

  // Sort by specificity (rules with more specific conditions first)
  tierFiltered.sort((a, b) => {
    // Rules with specific providers come first
    if (a.applicableTo === 'specific' && b.applicableTo !== 'specific') return -1;
    if (b.applicableTo === 'specific' && a.applicableTo !== 'specific') return 1;
    
    // Then rules with location restrictions
    if (a.locations.length > 0 && b.locations.length === 0) return -1;
    if (b.locations.length > 0 && a.locations.length === 0) return 1;
    
    // Then rules with performance tier
    if (a.performanceTier && !b.performanceTier) return -1;
    if (b.performanceTier && !a.performanceTier) return 1;
    
    // Then rules with service category
    if (a.serviceCategories.length > 0 && b.serviceCategories.length === 0) return -1;
    if (b.serviceCategories.length > 0 && a.serviceCategories.length === 0) return 1;
    
    // Finally by higher min booking amount (more specific)
    return b.minBookingAmount - a.minBookingAmount;
  });

  // Return the most specific applicable rule, or default 20% if none found
  return tierFiltered[0] || { type: 'percentage', value: 20 };
};

const CommissionRule = mongoose.model('CommissionRule', commissionRuleSchema);

module.exports = CommissionRule;