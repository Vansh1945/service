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
      validator: function (v) {
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
      values: ['all', 'performanceScore', 'specificProvider'],
      message: 'ApplyTo must be one of: all, performanceScore, specificProvider'
    },
    default: 'all'
  },
  performanceScore: {
    type: String,
    enum: {
      values: ['Bronze', 'Silver', 'Gold', 'Platinum'],
      message: 'Performance tier must be one of: Bronze, Silver, Gold, Platinum'
    },
    required: function () {
      return this.applyTo === 'performanceScore';
    }
  },
  specificProvider: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: function () {
      return this.applyTo === 'specificProvider';
    },
    validate: {
      validator: async function (v) {
        if (!v) return true; // avoid error when not required
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
      validator: function (v) {
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
commissionRuleSchema.index({ performanceScore: 1 });
commissionRuleSchema.index({ specificProvider: 1 });
commissionRuleSchema.index({ effectiveFrom: 1 });
commissionRuleSchema.index({ effectiveUntil: 1 });

/**
 * 🔹 Static Methods
 */

// Get applicable commission rule for a provider
commissionRuleSchema.statics.getCommissionForProvider = async function (providerId, providerperformanceScore = 'standard') {
  const now = new Date();

  try {
    // If tier not provided, calculate from provider metrics
    if (!providerperformanceScore) {
      const provider = await mongoose.model('Provider')
        .findById(providerId)
        .select('averageRating performanceScore feedbacks')
        .populate('feedbacks', 'providerFeedback.rating');
      
      if (provider) {
        // Use virtual averageRating logic if available, or calculate it
        let rating = provider.averageRating || 0;
        const completion = provider.performanceScore?.completionPercentage || 0;
        const onTime = provider.performanceScore?.onTimePercentage || 0;

        let badge = 'Bronze';
        if (rating >= 4.5 && completion >= 95 && onTime >= 95) {
          badge = 'Platinum';
        } else if (rating >= 4.0 && completion >= 90 && onTime >= 90) {
          badge = 'Gold';
        } else if (rating >= 3.5 && completion >= 85 && onTime >= 85) {
          badge = 'Silver';
        }
        providerperformanceScore = badge;
      } else {
        providerperformanceScore = 'Bronze';
      }
    }

    // 1. Check specific provider rule
    const providerSpecificRule = await this.findOne({
      isActive: true,
      applyTo: 'specificProvider',
      specificProvider: providerId,
    }).sort({ createdAt: -1 });

    if (providerSpecificRule) return providerSpecificRule;

    // 2. Check performance tier rule
    const tierRule = await this.findOne({
      isActive: true,
      applyTo: 'performanceScore',
      performanceScore: providerperformanceScore,
    }).sort({ createdAt: -1 });

    if (tierRule) return tierRule;

    // 3. Default rule for all providers
    const allProvidersRule = await this.findOne({
      isActive: true,
      applyTo: 'all',
    }).sort({ createdAt: -1 });

    return allProvidersRule || null;

  } catch (error) {
    console.error('Error getting commission rule:', error);
    return null;
  }
};

// Calculate commission amount
commissionRuleSchema.statics.calculateCommission = function (amount, rule) {
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

// Get all active rules
commissionRuleSchema.statics.getActiveRules = async function (filter = {}) {
  const now = new Date();
  return this.find({
    ...filter,
    isActive: true,
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveUntil: { $exists: false } },
      { effectiveUntil: { $gte: now } }
    ]
  }).sort({ applyTo: 1, performanceScore: 1, createdAt: -1 });
};

// Update a commission rule
commissionRuleSchema.statics.updateCommissionRule = async function (ruleId, updates, adminId) {
  const rule = await this.findById(ruleId);
  if (!rule) throw new Error('Commission rule not found');

  // Prevent changing critical fields if active
  if (rule.isActive) {
    const immutableFields = ['type', 'applyTo', 'performanceScore', 'specificProvider'];
    for (const field of immutableFields) {
      if (updates[field] && updates[field] !== rule[field]) {
        throw new Error(`Cannot change ${field} for an active commission rule. Deactivate first.`);
      }
    }
  }

  // Validate performance tier
  if (updates.applyTo === 'performanceScore' && !updates.performanceScore) {
    throw new Error('Performance tier is required when applyTo is performanceScore');
  }

  // Validate specific provider
  if (updates.applyTo === 'specificProvider') {
    if (!updates.specificProvider) {
      throw new Error('Specific provider is required when applyTo is specificProvider');
    }
    const providerExists = await mongoose.model('Provider').exists({ _id: updates.specificProvider });
    if (!providerExists) throw new Error('Specified provider does not exist');
  }

  Object.assign(rule, updates);
  rule.updatedBy = adminId;
  return await rule.save();
};

// Delete a commission rule
commissionRuleSchema.statics.deleteCommissionRule = async function (ruleId) {
  const rule = await this.findById(ruleId);
  if (!rule) throw new Error('Commission rule not found');

  if (rule.isActive) {
    throw new Error('Cannot delete an active commission rule. Deactivate first.');
  }

  const referencedTransactions = await mongoose.model('Transaction').countDocuments({
    commissionRule: rule._id
  });

  if (referencedTransactions > 0) {
    throw new Error('Cannot delete commission rule as it is referenced in existing transactions');
  }

  return await rule.deleteOne();
};

/**
 * 🔹 Virtuals
 */
commissionRuleSchema.virtual('displayValue').get(function () {
  return this.type === 'percentage'
    ? `${this.value}%`
    : `₹${this.value.toFixed(2)}`;
});

/**
 * 🔹 Hooks
 */
commissionRuleSchema.pre('save', function (next) {
  if (this.type === 'percentage' && (this.value < 0 || this.value > 100)) {
    return next(new Error('Percentage commission must be between 0 and 100'));
  }
  if (this.type === 'fixed' && this.value < 0) {
    return next(new Error('Fixed commission cannot be negative'));
  }
  next();
});

commissionRuleSchema.pre('deleteOne', { document: true }, async function (next) {
  const referencedTransactions = await mongoose.model('Transaction').countDocuments({
    commissionRule: this._id
  });

  if (referencedTransactions > 0) {
    return next(new Error('Cannot delete commission rule as it is referenced in existing transactions'));
  }
  next();
});

const CommissionRule = mongoose.model('CommissionRule', commissionRuleSchema);

module.exports = CommissionRule;
