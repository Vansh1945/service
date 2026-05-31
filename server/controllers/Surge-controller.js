const Surge = require('../models/Surge-model');
const Zone = require('../models/Zone-model');

// List surge rules for admin
exports.listSurgeRules = async (req, res) => {
  try {
    const { page = 1, limit = 10, active, scope, chargeType } = req.query;
    const query = {};

    if (active !== undefined) {
      query.active = active === 'true';
    }
    if (scope) {
      query.scope = scope;
    }
    if (chargeType) {
      query.chargeType = chargeType;
    }

    const rules = await Surge.find(query)
      .populate('zoneId', 'name city zoneLevel')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const count = await Surge.countDocuments(query);

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

// Create new surge rule
exports.createSurgeRule = async (req, res) => {
  try {
    const { chargeType, scope, zoneId, mode, value, startTime, endTime, active } = req.body;

    const newRule = new Surge({
      chargeType,
      scope,
      zoneId: scope === 'zone' ? zoneId : null,
      mode,
      value,
      startTime: startTime || null,
      endTime: endTime || null,
      active: active !== undefined ? active : true
    });

    await newRule.save();
    if (newRule.zoneId) {
      await newRule.populate('zoneId', 'name city zoneLevel');
    }

    res.status(201).json({
      success: true,
      data: newRule,
      message: 'Surge rule created successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get surge rule by ID
exports.getSurgeRuleById = async (req, res) => {
  try {
    const rule = await Surge.findById(req.params.id).populate('zoneId', 'name city zoneLevel');
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Surge rule not found'
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

// Update surge rule
exports.updateSurgeRule = async (req, res) => {
  try {
    const { chargeType, scope, zoneId, mode, value, startTime, endTime, active } = req.body;

    const rule = await Surge.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Surge rule not found'
      });
    }

    rule.chargeType = chargeType || rule.chargeType;
    rule.scope = scope || rule.scope;
    rule.zoneId = scope === 'zone' ? zoneId : null;
    rule.mode = mode || rule.mode;
    rule.value = value !== undefined ? value : rule.value;
    rule.startTime = startTime !== undefined ? (startTime || null) : rule.startTime;
    rule.endTime = endTime !== undefined ? (endTime || null) : rule.endTime;
    rule.active = active !== undefined ? active : rule.active;

    await rule.save();
    if (rule.zoneId) {
      await rule.populate('zoneId', 'name city zoneLevel');
    }

    res.status(200).json({
      success: true,
      data: rule,
      message: 'Surge rule updated successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Toggle surge rule active status
exports.toggleSurgeRuleStatus = async (req, res) => {
  try {
    const rule = await Surge.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Surge rule not found'
      });
    }

    rule.active = !rule.active;
    await rule.save();

    res.status(200).json({
      success: true,
      data: rule,
      message: `Surge rule is now ${rule.active ? 'active' : 'inactive'}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete surge rule
exports.deleteSurgeRule = async (req, res) => {
  try {
    const rule = await Surge.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Surge rule not found'
      });
    }

    await rule.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Surge rule deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Helper: Check if current time is within HH:MM window
const isTimeInWindow = (timeStr, start, end) => {
  if (!start || !end) return true;
  const parseTime = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  
  const current = parseTime(timeStr);
  const startTime = parseTime(start);
  const endTime = parseTime(end);

  if (startTime <= endTime) {
    return current >= startTime && current <= endTime;
  } else {
    // Midnight wrap-around, e.g. 22:00 to 05:00
    return current >= startTime || current <= endTime;
  }
};

// Resolve active surcharges for checkout
exports.resolveActiveSurcharges = async (req, res) => {
  try {
    const { zoneId, lat, lng, time } = req.query;
    
    let resolvedZoneId = zoneId;
    if (!resolvedZoneId && lat && lng) {
      const detectedZone = await Zone.findZoneByCoordinates(parseFloat(lat), parseFloat(lng));
      if (detectedZone) {
        resolvedZoneId = detectedZone._id;
      }
    }

    // Resolve ancestry
    const zoneAncestry = [];
    if (resolvedZoneId) {
      zoneAncestry.push(resolvedZoneId.toString());
      let current = await Zone.findById(resolvedZoneId).select('parentZone');
      while (current && current.parentZone) {
        zoneAncestry.push(current.parentZone.toString());
        current = await Zone.findById(current.parentZone).select('parentZone');
      }
    }

    // Get active rules
    const rules = await Surge.find({ active: true });
    
    // Filter based on scope and time window
    const currentTimeStr = time || new Date().toTimeString().substring(0, 5); // "HH:MM"
    
    const applicableRules = rules.filter(rule => {
      // 1. Check scope
      if (rule.scope === 'zone') {
        if (!rule.zoneId || !zoneAncestry.includes(rule.zoneId.toString())) {
          return false;
        }
      }
      
      // 2. Check time window
      return isTimeInWindow(currentTimeStr, rule.startTime, rule.endTime);
    });

    res.status(200).json({
      success: true,
      data: applicableRules,
      currentTime: currentTimeStr,
      zoneId: resolvedZoneId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
