const mongoose = require('mongoose');
const { Schema } = mongoose;

const commissionRuleSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Rule name is required'],
    trim: true,
    maxlength: [100, 'Rule name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    required: [true, 'Commission type is required'],
    enum: {
      values: ['percentage', 'fixed'],
      message: 'Commission type must be either "percentage" or "fixed"'
    },
    default: 'percentage'
  },
  value: {
    type: Number,
    required: [true, 'Commission value is required'],
    min: [0, 'Commission value cannot be negative'],
    validate: {
      validator: function(v) {
        if (this.type === 'percentage') {
          return v <= 100;
        }
        return true;
      },
      message: 'Percentage commission cannot exceed 100%'
    }
  },
  applyTo: {
    type: String,
    required: [true, 'Application scope is required'],
    enum: {
      values: ['all', 'performanceTier', 'specificProvider'],
      message: 'ApplyTo must be one of: all, performanceTier, specificProvider'
    },
    default: 'all'
  },
  performanceTier: {
    type: String,
    enum: {
      values: ['basic', 'standard', 'premium'],
      message: 'Performance tier must be one of: basic, standard, premium'
    },
    required: function() {
      return this.applyTo === 'performanceTier';
    }
  },
  specificProvider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: function() {
      return this.applyTo === 'specificProvider';
    },
    validate: {
      validator: async function(v) {
        const provider = await mongoose.model('Provider').findById(v);
        return !!provider;
      },
      message: 'Provider does not exist'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: [true, 'Creator admin ID is required']
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin'
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveUntil: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > this.effectiveFrom;
      },
      message: 'End date must be after start date'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
commissionRuleSchema.index({ isActive: 1 });
commissionRuleSchema.index({ applyTo: 1 });
commissionRuleSchema.index({ performanceTier: 1 });
commissionRuleSchema.index({ specificProvider: 1 });
commissionRuleSchema.index({ effectiveFrom: 1 });
commissionRuleSchema.index({ effectiveUntil: 1 });

// Static Methods
commissionRuleSchema.statics.getCommissionForProvider = async function(providerId, providerPerformanceTier = 'standard') {
  const now = new Date();
  
  try {
    let provider;
    if (!providerPerformanceTier) {
      provider = await mongoose.model('Provider').findById(providerId)
        .select('performanceTier')
        .lean();
      providerPerformanceTier = provider?.performanceTier || 'standard';
    }

    const providerSpecificRule = await this.findOne({
      isActive: true,
      applyTo: 'specificProvider',
      specificProvider: providerId,
      effectiveFrom: { $lte: now },
      $or: [
        { effectiveUntil: { $exists: false } },
        { effectiveUntil: { $gte: now } }
      ]
    }).sort({ createdAt: -1 });

    if (providerSpecificRule) return providerSpecificRule;

    const tierRule = await this.findOne({
      isActive: true,
      applyTo: 'performanceTier',
      performanceTier: providerPerformanceTier,
      effectiveFrom: { $lte: now },
      $or: [
        { effectiveUntil: { $exists: false } },
        { effectiveUntil: { $gte: now } }
      ]
    }).sort({ createdAt: -1 });

    if (tierRule) return tierRule;

    const allProvidersRule = await this.findOne({
      isActive: true,
      applyTo: 'all',
      effectiveFrom: { $lte: now },
      $or: [
        { effectiveUntil: { $exists: false } },
        { effectiveUntil: { $gte: now } }
      ]
    }).sort({ createdAt: -1 });

    return allProvidersRule || null;

  } catch (error) {
    console.error('Error getting commission rule:', error);
    return null;
  }
};

commissionRuleSchema.statics.calculateCommission = function(amount, rule) {
  if (!rule || typeof amount !== 'number' || amount < 0) {
    return {
      commission: 0,
      netAmount: amount,
      commissionRule: null
    };
  }

  let commission;
  
  if (rule.type === 'percentage') {
    commission = (amount * rule.value) / 100;
  } else {
    commission = Math.min(amount, rule.value);
  }

  commission = parseFloat(commission.toFixed(2));
  const netAmount = parseFloat((amount - commission).toFixed(2));

  return {
    commission,
    netAmount,
    commissionRule: rule
  };
};

commissionRuleSchema.statics.getActiveRules = async function(filter = {}) {
  const now = new Date();
  return this.find({
    ...filter,
    isActive: true,
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveUntil: { $exists: false } },
      { effectiveUntil: { $gte: now } }
    ]
  }).sort({ applyTo: 1, performanceTier: 1, createdAt: -1 });
};

// Virtuals
commissionRuleSchema.virtual('displayValue').get(function() {
  return this.type === 'percentage' 
    ? `${this.value}%` 
    : `₹${this.value.toFixed(2)}`;
});

// Hooks
commissionRuleSchema.pre('save', function(next) {
  if (this.type === 'percentage' && (this.value < 0 || this.value > 100)) {
    throw new Error('Percentage commission must be between 0 and 100');
  }

  if (this.type === 'fixed' && this.value < 0) {
    throw new Error('Fixed commission cannot be negative');
  }

  next();
});

const CommissionRule = mongoose.model('CommissionRule', commissionRuleSchema);

module.exports = CommissionRule;