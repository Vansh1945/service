const CommissionRule = require('../models/CommissionRule-model');
const Booking = require('../models/Booking-model');
const Provider = require('../models/Provider-model');
const Transaction = require('../models/Transaction-model ');

// Process commission for a completed booking
exports.processBookingCommission = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await Booking.findById(bookingId)
      .populate('provider service');
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Commission can only be processed for completed bookings'
      });
    }
    
    const provider = await Provider.findById(booking.provider._id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const performanceTier = provider.performanceTier || 'standard';
    
    // Get applicable commission rule
    const commissionRule = await CommissionRule.getCommissionForProvider(
      booking.provider._id,
      performanceTier
    );
    
    if (!commissionRule) {
      return res.status(404).json({
        success: false,
        message: 'No applicable commission rule found'
      });
    }
    
    // Calculate commission
    const commissionResult = CommissionRule.calculateCommission(booking.totalAmount, commissionRule);
    
    // Update provider's wallet
    provider.wallet += commissionResult.netAmount;
    await provider.save();
    
    // Create transaction record
    const transaction = new Transaction({
      booking: booking._id,
      provider: provider._id,
      amount: booking.totalAmount,
      commission: commissionResult.commission,
      netAmount: commissionResult.netAmount,
      commissionRule: commissionRule._id,
      type: 'commission',
      status: 'completed'
    });
    await transaction.save();
    
    res.status(200).json({
      success: true,
      data: {
        booking: booking._id,
        totalAmount: booking.totalAmount,
        commissionRate: commissionRule.displayValue,
        commissionAmount: commissionResult.commission,
        providerEarning: commissionResult.netAmount,
        appliedRule: commissionRule.name,
        transactionId: transaction._id
      }
    });
    
  } catch (error) {
    console.error('Commission processing error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get commission details for a provider
exports.getProviderCommissionDetails = async (req, res) => {
  try {
    const providerId = req.params.providerId;
    const provider = await Provider.findById(providerId);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    const performanceTier = provider.performanceTier || 'standard';

    // Get current applicable commission rule
    const currentRule = await CommissionRule.getCommissionForProvider(
      providerId,
      performanceTier
    );

    // Get all active rules for reference
    const allRules = await CommissionRule.getActiveRules();

    res.status(200).json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          name: provider.name,
          performanceTier,
          wallet: provider.wallet
        },
        currentCommission: currentRule,
        allActiveRules: allRules
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

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