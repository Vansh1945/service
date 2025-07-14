const CommissionRule = require('../models/CommissionRule-model');
const Booking = require('../models/Booking-model');
const Provider = require('../models/Provider-model');
const Transaction = require('../models/Transaction-model ');

// Helper function to normalize state names for comparison
const normalizeState = (state) => state ? state.toLowerCase().trim().replace(/\s+/g, ' ') : '';

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
    
    // Get provider details
    const provider = await Provider.findById(booking.provider._id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }

    // Get provider's state from address
    const providerState = provider.address?.state;
    if (!providerState) {
      return res.status(400).json({
        success: false,
        message: 'Provider state information is missing'
      });
    }

    // Determine provider's performance tier (you might calculate this based on ratings, completion rate, etc.)
    const performanceTier = provider.performanceTier || 'standard'; // Default to standard
    
    // Determine service category (assuming service model has category field)
    const serviceCategory = booking.service.category || 'Other';
    
    // Get applicable commission rule
    const commissionDetails = await CommissionRule.getCommissionForBooking({
      providerId: booking.provider._id,
      serviceCategory,
      bookingAmount: booking.totalAmount,
      providerState, // Pass the provider's state
      providerPerformanceTier: performanceTier
    });
    
    // Calculate commission amount
    let commissionAmount;
    if (commissionDetails.type === 'percentage') {
      commissionAmount = (booking.totalAmount * commissionDetails.value) / 100;
    } else {
      commissionAmount = commissionDetails.value;
    }
    
    // Create transaction record
    const transaction = new Transaction({
      booking: booking._id,
      provider: booking.provider._id,
      customer: booking.customer,
      amount: booking.totalAmount,
      commissionRate: commissionDetails.value,
      commissionType: commissionDetails.type,
      commissionAmount,
      providerEarning: booking.totalAmount - commissionAmount,
      status: 'completed',
      transactionType: 'booking',
      paymentMethod: booking.paymentMethod,
      details: {
        appliedRule: commissionDetails._id ? commissionDetails._id.toString() : 'default',
        providerState,
        performanceTier
      }
    });
    
    await transaction.save();
    
    // Update provider's wallet
    provider.wallet += (booking.totalAmount - commissionAmount);
    await provider.save();
    
    // Update booking with transaction reference
    booking.invoice = transaction._id;
    await booking.save();
    
    res.status(200).json({
      success: true,
      data: {
        booking: booking._id,
        totalAmount: booking.totalAmount,
        commissionRate: `${commissionDetails.value}${commissionDetails.type === 'percentage' ? '%' : ' fixed'}`,
        commissionAmount,
        providerEarning: booking.totalAmount - commissionAmount,
        transaction: transaction._id,
        appliedRule: commissionDetails.name || 'Default Commission',
        providerState
      }
    });
    
  } catch (error) {
    console.error('Commission processing error:', error);
    res.status(400).json({
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
    
    const providerState = provider.address?.state;
    if (!providerState) {
      return res.status(400).json({
        success: false,
        message: 'Provider state information is missing'
      });
    }

    // Get all applicable commission rules for this provider
    const rules = await CommissionRule.find({
      isActive: true,
      $or: [
        { applicableTo: 'all' },
        { 
          applicableTo: 'specific',
          providers: providerId
        }
      ]
    }).sort({ applicableTo: 1 }); // Specific rules first
    
    // Filter rules by state if specified
    const stateFilteredRules = rules.filter(rule => 
      !rule.states || rule.states.length === 0 || 
      rule.states.some(state => normalizeState(state) === normalizeState(providerState))
    );
    
    // Get provider's performance tier
    const performanceTier = provider.performanceTier || 'standard';
    
    res.status(200).json({
      success: true,
      data: {
        provider: {
          id: provider._id,
          name: provider.name,
          state: providerState,
          performanceTier
        },
        commissionRules: stateFilteredRules,
        defaultCommission: {
          type: 'percentage',
          value: 20,
          description: 'Default commission applied when no specific rules match'
        },
        effectiveCommission: stateFilteredRules[0] || { 
          type: 'percentage', 
          value: 20,
          description: 'Default commission (no matching rules found)'
        }
      }
    });
    
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all commission rules (for admin)
exports.listCommissionRules = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const rules = await CommissionRule.find(query)
      .populate('providers', 'name email phone')
      .populate('createdBy updatedBy', 'name email')
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
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Create new commission rule
exports.createCommissionRule = async (req, res) => {
  try {
    const { name, type, value, applicableTo, providers = [], states = [], 
            performanceTier, serviceCategories = [], minBookingAmount } = req.body;
    
    // Validate state names
    const normalizedStates = states.map(normalizeState).filter(s => s);
    
    const newRule = new CommissionRule({
      name,
      type,
      value,
      applicableTo,
      providers: applicableTo === 'specific' ? providers : [],
      states: normalizedStates,
      performanceTier: performanceTier || null,
      serviceCategories: serviceCategories || [],
      minBookingAmount: minBookingAmount || 0,
      createdBy: req.admin._id
    });

    await newRule.save();
    
    res.status(201).json({
      success: true,
      data: newRule
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