const mongoose = require('mongoose');
const { Schema } = mongoose;

const commissionRuleSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  applyTo: {
    type: String,
    enum: ['all', 'performanceTier'],
    default: 'all'
  },
  performanceTier: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    required: function() {
      return this.applyTo === 'performanceTier';
    }
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
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Indexes for performance
commissionRuleSchema.index({ isActive: 1 });
commissionRuleSchema.index({ applyTo: 1 });
commissionRuleSchema.index({ performanceTier: 1 });

// Static method to get applicable commission for a provider
commissionRuleSchema.statics.getCommissionForProvider = async function(providerId, providerPerformanceTier) {
  // First look for performance tier specific rules
  const tierRule = await this.findOne({
    isActive: true,
    applyTo: 'performanceTier',
    performanceTier: providerPerformanceTier || 'standard'
  }).sort({ createdAt: -1 });

  if (tierRule) return tierRule;

  // If no tier-specific rule, look for all providers rule
  const allProvidersRule = await this.findOne({
    isActive: true,
    applyTo: 'all'
  }).sort({ createdAt: -1 });

  // Default to 10% if no rules exist
  return allProvidersRule || { type: 'percentage', value: 10, _id: 'default-commission-rule' };
};

const CommissionRule = mongoose.model('CommissionRule', commissionRuleSchema);

module.exports = CommissionRule;