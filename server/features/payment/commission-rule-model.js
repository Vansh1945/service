const mongoose = require('mongoose');
const { Schema } = mongoose;
const cache = require('../../shared/utils/cache');

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
      values: ['all', 'performanceScore', 'specificProvider', 'specificService', 'specificCategory'],
      message: 'ApplyTo must be one of: all, performanceScore, specificProvider, specificService, specificCategory'
    },
    default: 'all'
  },
  performanceScore: {
    type: String,
    enum: {
      values: ['bronze', 'silver', 'gold', 'platinum'],
      message: 'Performance tier must be one of: bronze, silver, gold, platinum'
    },
    trim: true,
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
  specificService: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: function () {
      return this.applyTo === 'specificService';
    },
    default: null
  },
  specificCategory: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: function () {
      return this.applyTo === 'specificCategory';
    },
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  conditionType: {
    type: String,
    enum: {
      values: ['none', 'rating', 'performanceScore'],
      message: 'conditionType must be one of: none, rating, performanceScore'
    },
    default: 'none'
  },
  ratingMin: {
    type: Number,
    min: 0,
    max: 5,
    default: null
  },
  ratingMax: {
    type: Number,
    min: 0,
    max: 5,
    default: null
  },
  evaluationPeriodDays: {
    type: Number,
    min: 1,
    default: 30
  },
  minimumRatings: {
    type: Number,
    min: 0,
    default: 5
  },
  priority: {
    type: Number,
    default: 0
  },
  zoneId: {
    type: Schema.Types.ObjectId,
    ref: 'Zone',
    default: null
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
commissionRuleSchema.index({ conditionType: 1 });
commissionRuleSchema.index({ ratingMin: 1 });
commissionRuleSchema.index({ priority: -1 });



/**
 * 🔹 Static Methods
 */

// Reusable helper for active rule filter enforcing effective dates
commissionRuleSchema.statics.buildActiveRuleFilter = function (extraQuery = {}) {
  const now = new Date();
  return {
    ...extraQuery,
    isActive: true,
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveUntil: { $exists: false } },
      { effectiveUntil: null },
      { effectiveUntil: { $gt: now } }
    ]
  };
};

// Reusable static method to calculate rolling rating
commissionRuleSchema.statics.getProviderRatingForCommission = async function (providerId, options = {}) {
  try {
    if (!providerId) {
      return { averageRating: 0, ratingCount: 0, periodDays: options.evaluationPeriodDays || 30, eligible: false };
    }
    const evaluationPeriodDays = options.evaluationPeriodDays || 30;
    const minimumRatings = options.minimumRatings ?? 5;
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - evaluationPeriodDays * 24 * 60 * 60 * 1000);

    const Feedback = mongoose.model('Feedback');
    const result = await Feedback.aggregate([
      {
        $match: {
          'providerFeedback.provider': new mongoose.Types.ObjectId(providerId),
          'providerFeedback.rating': { $ne: null },
          createdAt: { $gte: periodStart, $lte: periodEnd }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$providerFeedback.rating' },
          ratingCount: { $sum: 1 }
        }
      }
    ]);

    const averageRating = result.length > 0 ? parseFloat(Number(result[0].avgRating).toFixed(2)) : 0;
    const ratingCount = result.length > 0 ? result[0].ratingCount : 0;
    const eligible = ratingCount >= minimumRatings;

    return {
      averageRating,
      ratingCount,
      periodDays: evaluationPeriodDays,
      eligible
    };
  } catch (err) {
    console.error('Error in getProviderRatingForCommission:', err);
    return { averageRating: 0, ratingCount: 0, periodDays: options.evaluationPeriodDays || 30, eligible: false, error: err };
  }
};

// Get applicable commission rule for a provider
commissionRuleSchema.statics.getCommissionForProvider = async function (providerId, zoneId = null, providerperformanceScore = 'standard', serviceId = null, categoryId = null) {
  try {
    // If tier not provided, calculate from provider metrics
    if (!providerperformanceScore || providerperformanceScore === 'standard') {
      const provider = await mongoose.model('Provider')
        .findById(providerId)
        .select('performanceScore');

      if (provider) {
        providerperformanceScore = provider.performanceScore?.badge || 'bronze';
      } else {
        providerperformanceScore = 'bronze';
      }
    }

    // If serviceId is provided and categoryId is not, let's fetch categoryId from service
    if (serviceId && !categoryId) {
      const service = await mongoose.model('Service').findById(serviceId).select('category');
      if (service) {
        categoryId = service.category;
      }
    }

    const cacheKey = `comm_rule_${providerId || ''}_${zoneId || ''}_${providerperformanceScore || ''}_${serviceId || ''}_${categoryId || ''}`;
    const cached = cache.get(cacheKey);
    if (cached && cached !== 'none' && cached.conditionType !== 'rating') {
      return cached;
    }

    // Resolve Zone Ancestry Array
    const zoneAncestry = [];
    if (zoneId) {
      zoneAncestry.push(zoneId.toString());
      const Zone = mongoose.model('Zone');
      let current = await Zone.findById(zoneId).select('parentZone');
      while (current && current.parentZone) {
        zoneAncestry.push(current.parentZone.toString());
        current = await Zone.findById(current.parentZone).select('parentZone');
      }
    }

    const evaluateScopeCandidates = async (query) => {
      const filter = this.buildActiveRuleFilter(query);
      const candidates = await this.find(filter).sort({ priority: -1, ratingMin: -1, createdAt: -1 });

      for (const candidate of candidates) {
        if (candidate.conditionType === 'rating' || candidate.ratingMin !== null) {
          if (!providerId) continue; // Rating rule requires providerId
          const ratingInfo = await this.getProviderRatingForCommission(providerId, {
            evaluationPeriodDays: candidate.evaluationPeriodDays,
            minimumRatings: candidate.minimumRatings
          });

          if (ratingInfo.error) {
            console.error('Rating evaluation runtime error:', ratingInfo.error);
            continue;
          }

          if (!ratingInfo.eligible) continue;
          if (candidate.ratingMin !== null && ratingInfo.averageRating < candidate.ratingMin) continue;
          if (candidate.ratingMax !== null && ratingInfo.averageRating > candidate.ratingMax) continue;

          const candidateObj = candidate.toObject ? candidate.toObject() : { ...candidate };
          candidateObj.ratingInfo = ratingInfo;
          return candidateObj;
        }

        // Standard rule (no rating condition)
        return candidate;
      }

      return null;
    };

    const rule = await (async () => {
      // PRIORITY 1: Specific Provider Rule (closest zone ancestry first, then global)
      if (providerId) {
        if (zoneAncestry.length > 0) {
          for (const zId of zoneAncestry) {
            const match = await evaluateScopeCandidates({
              applyTo: 'specificProvider',
              specificProvider: providerId,
              zoneId: zId
            });
            if (match) return match;
          }
        }

        const globalSpecificMatch = await evaluateScopeCandidates({
          applyTo: 'specificProvider',
          specificProvider: providerId,
          $or: [{ zoneId: null }, { zoneId: { $exists: false } }]
        });
        if (globalSpecificMatch) return globalSpecificMatch;
      }

      // PRIORITY 2: Specific Service Rule (closest zone ancestry first, then global)
      if (serviceId) {
        if (zoneAncestry.length > 0) {
          for (const zId of zoneAncestry) {
            const match = await evaluateScopeCandidates({
              applyTo: 'specificService',
              specificService: serviceId,
              zoneId: zId
            });
            if (match) return match;
          }
        }

        const globalServiceMatch = await evaluateScopeCandidates({
          applyTo: 'specificService',
          specificService: serviceId,
          $or: [{ zoneId: null }, { zoneId: { $exists: false } }]
        });
        if (globalServiceMatch) return globalServiceMatch;
      }

      // PRIORITY 3: Specific Category Rule (closest zone ancestry first, then global)
      if (categoryId) {
        if (zoneAncestry.length > 0) {
          for (const zId of zoneAncestry) {
            const match = await evaluateScopeCandidates({
              applyTo: 'specificCategory',
              specificCategory: categoryId,
              zoneId: zId
            });
            if (match) return match;
          }
        }

        const globalCategoryMatch = await evaluateScopeCandidates({
          applyTo: 'specificCategory',
          specificCategory: categoryId,
          $or: [{ zoneId: null }, { zoneId: { $exists: false } }]
        });
        if (globalCategoryMatch) return globalCategoryMatch;
      }

      // PRIORITY 4: Zone + Performance Score Rule (closest zone first)
      if (zoneAncestry.length > 0) {
        for (const zId of zoneAncestry) {
          const match = await evaluateScopeCandidates({
            applyTo: 'performanceScore',
            performanceScore: providerperformanceScore,
            zoneId: zId
          });
          if (match) return match;
        }
      }

      // PRIORITY 5: Zone Default Rule (closest zone first)
      if (zoneAncestry.length > 0) {
        for (const zId of zoneAncestry) {
          const match = await evaluateScopeCandidates({
            applyTo: 'all',
            zoneId: zId
          });
          if (match) return match;
        }
      }

      // PRIORITY 6: Global Rules (Performance global tier first, then Global Default rule)
      const globalTierMatch = await evaluateScopeCandidates({
        applyTo: 'performanceScore',
        performanceScore: providerperformanceScore,
        $or: [{ zoneId: null }, { zoneId: { $exists: false } }]
      });
      if (globalTierMatch) return globalTierMatch;

      const globalDefaultMatch = await evaluateScopeCandidates({
        applyTo: 'all',
        $or: [{ zoneId: null }, { zoneId: { $exists: false } }]
      });
      if (globalDefaultMatch) return globalDefaultMatch;

      // Fallback: Default system setting commission
      try {
        const { SystemConfig } = require('../system-setting/system-setting-model');
        const sysSettings = await SystemConfig.findOne().lean();
        const defaultRate = sysSettings?.commissionSettings?.defaultCommission ?? 10;
        return {
          _id: null,
          name: 'System Default Commission',
          type: 'percentage',
          value: defaultRate,
          applyTo: 'all',
          isActive: true,
          conditionType: 'none'
        };
      } catch (err) {
        return {
          _id: null,
          name: 'System Default Commission',
          type: 'percentage',
          value: 10,
          applyTo: 'all',
          isActive: true,
          conditionType: 'none'
        };
      }
    })();

    if (rule && rule.conditionType !== 'rating') {
      cache.set(cacheKey, rule, 300);
    }
    return rule;

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
