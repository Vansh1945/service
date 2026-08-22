const Surge = require('./surge-model');
const Zone = require('./zone-model');
const { SystemConfig } = require('../system-setting/system-setting-model');

// List surge rules for admin
exports.listSurgeRules = async (req, res, next) => {
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
    global.logger.error(`[SurgeController.listSurgeRules] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Create new surge rule
exports.createSurgeRule = async (req, res) => {
  try {
    const {
      chargeType,
      scope,
      zoneId,
      mode,
      value,
      startTime,
      endTime,
      effectiveFrom,
      effectiveUntil,
      daysOfWeek,
      maxBookingValue,
      active
    } = req.body;

    const newRule = new Surge({
      chargeType,
      scope,
      zoneId: (scope === 'zone' && zoneId !== '') ? zoneId : null,
      mode,
      value,
      startTime: startTime || null,
      endTime: endTime || null,
      effectiveFrom: effectiveFrom || null,
      effectiveUntil: effectiveUntil || null,
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek : [],
      maxBookingValue: maxBookingValue !== undefined && maxBookingValue !== '' ? maxBookingValue : null,
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
exports.getSurgeRuleById = async (req, res, next) => {
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
    global.logger.error(`[SurgeController.getSurgeRuleById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Update surge rule
exports.updateSurgeRule = async (req, res) => {
  try {
    const {
      chargeType,
      scope,
      zoneId,
      mode,
      value,
      startTime,
      endTime,
      effectiveFrom,
      effectiveUntil,
      daysOfWeek,
      maxBookingValue,
      active
    } = req.body;

    const rule = await Surge.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Surge rule not found'
      });
    }

    rule.chargeType = chargeType || rule.chargeType;
    rule.scope = scope || rule.scope;
    rule.zoneId = (scope === 'zone' && zoneId !== '') ? zoneId : null;
    rule.mode = mode || rule.mode;
    rule.value = value !== undefined ? value : rule.value;
    rule.startTime = startTime !== undefined ? (startTime || null) : rule.startTime;
    rule.endTime = endTime !== undefined ? (endTime || null) : rule.endTime;
    rule.effectiveFrom = effectiveFrom !== undefined ? (effectiveFrom || null) : rule.effectiveFrom;
    rule.effectiveUntil = effectiveUntil !== undefined ? (effectiveUntil || null) : rule.effectiveUntil;
    rule.daysOfWeek = daysOfWeek !== undefined ? (Array.isArray(daysOfWeek) ? daysOfWeek : []) : rule.daysOfWeek;
    rule.maxBookingValue = maxBookingValue !== undefined ? (maxBookingValue !== '' ? maxBookingValue : null) : rule.maxBookingValue;
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

// Resolve active surcharges for checkout
exports.resolveActiveSurcharges = async (req, res, next) => {
  try {
    const { zoneId, lat, lng, date, time, subtotal: rawSubtotal } = req.query;
    
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

    // Fetch SystemConfig for business timezone
    const settings = await SystemConfig.findOne().lean();
    const systemTimezone = settings?.timezone || 'Asia/Kolkata';

    // Get active rules
    const rules = await Surge.find({ active: true }).lean();
    
    const subtotal = rawSubtotal ? parseFloat(rawSubtotal) : 0;
    
    const evalContext = {
      date: date || null,
      time: time || null,
      subtotal,
      systemTimezone
    };

    const defaultComponents = Surge.getDateTimeComponentsInTimezone(new Date(), systemTimezone);
    const currentTimeStr = time || defaultComponents.timeStr;
    const currentDateStr = date || defaultComponents.dateStr;
    
    const applicableRules = rules.filter(rule => {
      // 1. Check scope & zone ancestry
      if (rule.scope === 'zone') {
        if (!rule.zoneId || !zoneAncestry.includes(rule.zoneId.toString())) {
          return false;
        }
      }
      
      // 2. Check schedule & maxBookingValue via Surge model static method
      return Surge.isRuleApplicable(rule, evalContext);
    });

    res.status(200).json({
      success: true,
      data: applicableRules,
      currentTime: currentTimeStr,
      currentDate: currentDateStr,
      zoneId: resolvedZoneId,
      zoneAncestry: zoneAncestry
    });
  } catch (error) {
    global.logger.error(`[SurgeController.resolveActiveSurcharges] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};
