const CommissionRule = require('../models/CommissionRule-model');
const Booking = require('../models/Booking-model');
const Provider = require('../models/Provider-model');
const Transaction = require('../models/Transaction-model ');
const Admin = require('../models/Admin-model');





// Get all commission rules (for admin)
exports.listCommissionRules = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, applyTo } = req.query;
    const query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (applyTo) {
      query.applyTo = applyTo;
    }

    const rules = await CommissionRule.find(query)
      .populate('createdBy updatedBy', 'name email')
      .populate('specificProvider', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const count = await CommissionRule.countDocuments(query);

    res.status(200).json({
      success: true,
      data: rules,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create new commission rule
exports.createCommissionRule = async (req, res) => {
  try {
    const { name, description, type, value, applyTo, performanceTier, specificProvider, effectiveFrom, effectiveUntil } = req.body;

    // Validate required fields based on applyTo
    if (applyTo === 'performanceTier' && !performanceTier) {
      return res.status(400).json({
        success: false,
        message: 'Performance tier is required when applyTo is performanceTier'
      });
    }

    if (applyTo === 'specificProvider' && !specificProvider) {
      return res.status(400).json({
        success: false,
        message: 'Specific provider is required when applyTo is specificProvider'
      });
    }

    const newRule = new CommissionRule({
      name,
      description,
      type,
      value,
      applyTo,
      performanceTier: applyTo === 'performanceTier' ? performanceTier : undefined,
      specificProvider: applyTo === 'specificProvider' ? specificProvider : undefined,
      effectiveFrom,
      effectiveUntil,
      createdBy: req.admin._id
    });

    await newRule.save();
    await newRule.populate('createdBy', 'name email');
    await newRule.populate('specificProvider', 'name email');

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
    const updates = req.body;

    const updatedRule = await CommissionRule.updateCommissionRule(id, updates, req.admin._id);
    
    await updatedRule.populate('createdBy updatedBy', 'name email');
    await updatedRule.populate('specificProvider', 'name email');

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
exports.getCommissionRuleById = async (req, res) => {
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
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};