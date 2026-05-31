const mongoose = require('mongoose');
const { Schema } = mongoose;

const surgeSchema = new Schema({
  chargeType: {
    type: String,
    required: [true, 'Charge type is required'],
    enum: {
      values: ['rain', 'traffic', 'night', 'demand', 'festival', 'custom'],
      message: 'Charge type must be one of: rain, traffic, night, demand, festival, custom'
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
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for fast querying
surgeSchema.index({ active: 1 });
surgeSchema.index({ scope: 1, zoneId: 1 });

const Surge = mongoose.model('Surge', surgeSchema);
module.exports = Surge;
