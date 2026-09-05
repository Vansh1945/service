const mongoose = require('mongoose');
const { Schema } = mongoose;

const surgeSchema = new Schema({
  chargeType: {
    type: String,
    required: [true, 'Charge type is required'],
    enum: {
      values: ['rain', 'traffic', 'night', 'demand', 'festival', 'custom', 'visiting', 'platform'],
      message: 'Charge type must be one of: rain, traffic, night, demand, festival, custom, visiting, platform'
    }
  },
  scope: {
    type: String,
    required: [true, 'Scope is required'],
    enum: {
      values: ['global', 'zone'],
      message: 'Scope must be either global or zone'
    },
    default: 'global'
  },
  zoneId: {
    type: Schema.Types.ObjectId,
    ref: 'Zone',
    default: null,
    required: function () {
      return this.scope === 'zone';
    }
  },
  mode: {
    type: String,
    required: [true, 'Charge mode is required'],
    enum: {
      values: ['flat', 'percentage', 'multiplier'],
      message: 'Charge mode must be one of: flat, percentage, multiplier'
    },
    default: 'flat'
  },
  value: {
    type: Number,
    required: [true, 'Surge value is required'],
    min: [0, 'Surge value cannot be negative']
  },
  startTime: {
    type: String,
    default: null,
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide start time in HH:MM format']
  },
  endTime: {
    type: String,
    default: null,
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide end time in HH:MM format']
  },
  maxBookingValue: {
    type: Number,
    default: null
  },
  effectiveFrom: {
    type: String,
    default: null,
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Please provide effectiveFrom in YYYY-MM-DD format']
  },
  effectiveUntil: {
    type: String,
    default: null,
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Please provide effectiveUntil in YYYY-MM-DD format']
  },
  daysOfWeek: {
    type: [Number],
    default: []
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Enforce: only ONE rule per chargeType per scope/zone combination
surgeSchema.index({ chargeType: 1, scope: 1, zoneId: 1 }, { unique: true });

// Helper: Extract dateStr (YYYY-MM-DD), timeStr (HH:MM), and dayOfWeek (0-6) in given timezone
surgeSchema.statics.getDateTimeComponentsInTimezone = function (dateObj, timeZone = 'Asia/Kolkata') {
  const d = dateObj || new Date();
  const tz = timeZone || 'Asia/Kolkata';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short'
    });

    const parts = formatter.formatToParts(d);
    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });

    const year = map.year;
    const month = map.month;
    const day = map.day;
    const hour = map.hour === '24' ? '00' : map.hour;
    const minute = map.minute;

    const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const evalDay = weekdayMap[map.weekday] !== undefined ? weekdayMap[map.weekday] : d.getDay();

    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hour}:${minute}`,
      dayOfWeek: evalDay
    };
  } catch (err) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return {
      dateStr: `${year}-${month}-${day}`,
      timeStr: `${hour}:${minute}`,
      dayOfWeek: d.getDay()
    };
  }
};

// Helper: Check if time is within window (handling midnight wrap-around 22:00 -> 05:00)
surgeSchema.statics.isTimeInWindow = function (timeStr, start, end) {
  if (!start || !end) return true;
  const parseTime = (t) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const current = parseTime(timeStr);
  const startTime = parseTime(start);
  const endTime = parseTime(end);

  if (startTime <= endTime) {
    return current >= startTime && current <= endTime;
  } else {
    return current >= startTime || current <= endTime;
  }
};

// Helper: Evaluate whether a surge rule is currently applicable
surgeSchema.statics.isRuleApplicable = function (rule, evalContext = {}) {
  if (!rule) return false;
  if (!rule.active) return false;

  const timezone = evalContext.systemTimezone || 'Asia/Kolkata';
  const now = evalContext.now || new Date();
  const defaultComponents = this.getDateTimeComponentsInTimezone(now, timezone);

  let dateStr = evalContext.date || defaultComponents.dateStr;
  let timeStr = evalContext.time || defaultComponents.timeStr;
  let dayOfWeek = defaultComponents.dayOfWeek;

  if (evalContext.date) {
    const parts = String(evalContext.date).trim().split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const utcDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
      dayOfWeek = utcDate.getUTCDay();
      dateStr = `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
    }
  }

  // 1. Date range check (effectiveFrom / effectiveUntil)
  if (rule.effectiveFrom && dateStr < rule.effectiveFrom) {
    return false;
  }
  if (rule.effectiveUntil && dateStr > rule.effectiveUntil) {
    return false;
  }

  // 2. Day of week check (0=Sun, 1=Mon, ..., 6=Sat)
  if (Array.isArray(rule.daysOfWeek) && rule.daysOfWeek.length > 0) {
    if (!rule.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
  }

  // 3. Daily time window check
  if (!this.isTimeInWindow(timeStr, rule.startTime, rule.endTime)) {
    return false;
  }

  // 4. maxBookingValue check (if subtotal > maxBookingValue, rule does NOT apply)
  if (evalContext.subtotal !== undefined && evalContext.subtotal !== null && rule.maxBookingValue) {
    if (Number(evalContext.subtotal) > Number(rule.maxBookingValue)) {
      return false;
    }
  }

  return true;
};

// Helper: Derived status for admin view
surgeSchema.statics.getRuleStatus = function (rule, evalContext = {}) {
  if (!rule || !rule.active) return 'inactive';

  const timezone = evalContext.systemTimezone || 'Asia/Kolkata';
  const now = evalContext.now || new Date();
  const defaultComponents = this.getDateTimeComponentsInTimezone(now, timezone);

  const dateStr = evalContext.date || defaultComponents.dateStr;

  if (rule.effectiveFrom && dateStr < rule.effectiveFrom) {
    return 'scheduled';
  }
  if (rule.effectiveUntil && dateStr > rule.effectiveUntil) {
    return 'expired';
  }

  return 'active';
};

const Surge = mongoose.model('Surge', surgeSchema);
module.exports = Surge;
