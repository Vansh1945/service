const CommissionRule = require('./commission-rule-model');
const Booking = require('../booking/booking-model');
const Provider = require('../provider/provider-model');
const Transaction = require('./transaction-model');
const Admin = require('../admin/admin-model');
const cache = require('../../shared/utils/cache');





// Get all commission rules (for admin)
exports.listCommissionRules = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, isActive, applyTo, priorityTier, performanceScore, zoneIds } = req.query;
    const query = {};

    if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true';
    }

    if (applyTo) {
      query.applyTo = applyTo;
    }

    // Priority Tier Filter
    if (priorityTier) {
      if (priorityTier === 'global') {
        query.zoneId = null;
      } else if (priorityTier === 'zone') {
        query.zoneId = { $ne: null };
      } else if (priorityTier === 'performance') {
        query.applyTo = 'performanceScore';
      } else if (priorityTier === 'provider') {
        query.applyTo = 'specificProvider';
      }
    }

    // Performance Score Filter
    if (performanceScore) {
      query.performanceScore = typeof performanceScore === 'string' ? performanceScore.toLowerCase() : performanceScore;
      query.applyTo = 'performanceScore';
    }

    // Zone IDs Filter
    if (zoneIds) {
      const ids = Array.isArray(zoneIds) ? zoneIds : zoneIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        query.zoneId = { $in: ids };
      }
    }

    const [rules, count, activeCount, percentageStats] = await Promise.all([
      CommissionRule.find(query)
        .populate('createdBy updatedBy', 'name email')
        .populate('specificProvider', 'name email')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit)),
      CommissionRule.countDocuments(query),
      CommissionRule.countDocuments({ ...query, isActive: true }),
      CommissionRule.aggregate([
        { $match: { ...query, type: 'percentage' } },
        { $group: { _id: null, avgRate: { $avg: '$value' } } }
      ])
    ]);

    const avgCommissionRate = percentageStats[0]?.avgRate ? percentageStats[0].avgRate.toFixed(1) : '0.0';

    res.status(200).json({
      success: true,
      data: rules,
      stats: {
        totalRules: count,
        activeRules: activeCount,
        avgCommissionRate
      },
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    global.logger.error(`[CommissionController.listCommissionRules] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

const validateRatingRuleOverlap = async (newRuleData, currentRuleId = null) => {
  if (newRuleData.conditionType !== 'rating' || newRuleData.ratingMin === null) return;

  const query = {
    isActive: true,
    conditionType: 'rating',
    applyTo: newRuleData.applyTo || 'all',
    zoneId: newRuleData.zoneId || null
  };

  if (currentRuleId) {
    query._id = { $ne: currentRuleId };
  }

  if (newRuleData.applyTo === 'specificProvider') query.specificProvider = newRuleData.specificProvider;
  if (newRuleData.applyTo === 'specificService') query.specificService = newRuleData.specificService;
  if (newRuleData.applyTo === 'specificCategory') query.specificCategory = newRuleData.specificCategory;

  const existingRules = await CommissionRule.find(query);
  const newMin = Number(newRuleData.ratingMin);
  const newMax = newRuleData.ratingMax !== null && newRuleData.ratingMax !== undefined ? Number(newRuleData.ratingMax) : 5.0;

  for (const rule of existingRules) {
    const existingMin = Number(rule.ratingMin);
    const existingMax = rule.ratingMax !== null && rule.ratingMax !== undefined ? Number(rule.ratingMax) : 5.0;

    const overlapMin = Math.max(newMin, existingMin);
    const overlapMax = Math.min(newMax, existingMax);

    if (overlapMin < overlapMax) {
      throw new Error(`Rating range [${newMin} - ${newMax}] overlaps with active rule "${rule.name}" [${existingMin} - ${existingMax}] for the same scope.`);
    }
  }
};

// Create new commission rule
exports.createCommissionRule = async (req, res) => {
  try {
    const {
      name, description, type, value, applyTo, performanceScore,
      specificProvider, specificService, specificCategory, zoneId,
      conditionType, ratingMin, ratingMax, evaluationPeriodDays, minimumRatings, priority,
      effectiveFrom, effectiveUntil
    } = req.body;

    if (applyTo === 'performanceScore' && conditionType === 'rating') {
      return res.status(400).json({
        success: false,
        message: 'Combining performanceScore applyTo with rating condition is not supported in V1'
      });
    }

    if (applyTo === 'performanceScore' && !performanceScore) {
      return res.status(400).json({
        success: false,
        message: 'Performance score is required when applyTo is performanceScore'
      });
    }

    let targetProviderId = specificProvider;
    if (applyTo === 'specificProvider') {
      if (!specificProvider) {
        return res.status(400).json({
          success: false,
          message: 'Specific provider ID is required'
        });
      }

      if (typeof specificProvider === 'string' && specificProvider.startsWith('PROV-')) {
        const provider = await Provider.findOne({ providerId: specificProvider });
        if (!provider) {
          return res.status(404).json({
            success: false,
            message: `Provider with ID ${specificProvider} not found`
          });
        }
        targetProviderId = provider._id;
      }
    }

    await validateRatingRuleOverlap(req.body);

    const newRule = new CommissionRule({
      name,
      description,
      type,
      value,
      applyTo,
      performanceScore: applyTo === 'performanceScore' && typeof performanceScore === 'string' ? performanceScore.toLowerCase() : (applyTo === 'performanceScore' ? performanceScore : undefined),
      specificProvider: applyTo === 'specificProvider' ? targetProviderId : undefined,
      specificService: applyTo === 'specificService' ? specificService : undefined,
      specificCategory: applyTo === 'specificCategory' ? specificCategory : undefined,
      zoneId,
      conditionType: conditionType || 'none',
      ratingMin: ratingMin !== undefined ? ratingMin : null,
      ratingMax: ratingMax !== undefined ? ratingMax : null,
      evaluationPeriodDays: evaluationPeriodDays || 30,
      minimumRatings: minimumRatings !== undefined ? minimumRatings : 5,
      priority: priority || 0,
      effectiveFrom,
      effectiveUntil,
      createdBy: req.admin._id
    });

    await newRule.save();
    await newRule.populate('createdBy', 'name email');
    await newRule.populate('specificProvider', 'name email');

    cache.delByPrefix('comm_rule_');

    res.status(201).json({
      success: true,
      data: newRule,
      message: 'Commission rule created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Preview Commission Rule (Read-Only)
exports.previewCommissionRule = async (req, res, next) => {
  try {
    const { providerId, serviceId, categoryId, zoneId, amount = 1000 } = req.body;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: 'providerId is required for preview'
      });
    }

    const rule = await CommissionRule.getCommissionForProvider(providerId, zoneId, 'standard', serviceId, categoryId);

    const baseAmount = Number(amount);
    const { commission, netAmount } = CommissionRule.calculateCommission(baseAmount, rule);

    res.status(200).json({
      success: true,
      data: {
        providerId,
        matchedRule: rule,
        ratingInfo: rule?.ratingInfo || null,
        baseAmount,
        commissionAmount: commission,
        providerEarning: netAmount,
        commissionSource: rule?.conditionType === 'rating' ? 'rating_rule' : (rule?._id ? 'standard_rule' : 'system_default')
      }
    });
  } catch (error) {
    global.logger.error(`[CommissionController.previewCommissionRule] Error: ${error.message}`, error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update commission rule status
exports.toggleCommissionRuleStatus = async (req, res) => {
  try {
    const rule = await CommissionRule.findById(req.params.id);

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Commission rule not found'
      });
    }

    rule.isActive = !rule.isActive;
    rule.updatedBy = req.admin._id;
    await rule.save();

    cache.delByPrefix('comm_rule_');

    res.status(200).json({
      success: true,
      data: rule,
      message: `Rule is now ${rule.isActive ? 'active' : 'inactive'}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Update commission rule
exports.updateCommissionRule = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // If specificProvider is a providerId (PROV-XXXX), find the actual ObjectId
    if (updates.applyTo === 'specificProvider' && typeof updates.specificProvider === 'string' && updates.specificProvider.startsWith('PROV-')) {
      const provider = await Provider.findOne({ providerId: updates.specificProvider });
      if (!provider) {
        return res.status(404).json({
          success: false,
          message: `Provider with ID ${updates.specificProvider} not found`
        });
      }
      updates.specificProvider = provider._id;
    }

    const updatedRule = await CommissionRule.updateCommissionRule(id, updates, req.admin._id);

    await updatedRule.populate('createdBy updatedBy', 'name email');
    await updatedRule.populate('specificProvider', 'name email');

    cache.delByPrefix('comm_rule_');

    res.status(200).json({
      success: true,
      data: updatedRule,
      message: 'Commission rule updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete commission rule
exports.deleteCommissionRule = async (req, res) => {
  try {
    const { id } = req.params;

    await CommissionRule.deleteCommissionRule(id);

    cache.delByPrefix('comm_rule_');

    res.status(200).json({
      success: true,
      message: 'Commission rule deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get commission rule by ID
exports.getCommissionRuleById = async (req, res, next) => {
  try {
    const rule = await CommissionRule.findById(req.params.id)
      .populate('createdBy updatedBy', 'name email')
      .populate('specificProvider', 'name email');

    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Commission rule not found'
      });
    }

    res.status(200).json({
      success: true,
      data: rule
    });
  } catch (error) {
    global.logger.error(`[CommissionController.getCommissionRuleById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};