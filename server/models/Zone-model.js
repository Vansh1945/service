const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
  city: {
    type: String,
    required: true,
    trim: true,
    default: 'Jalandhar'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  polygon: {
    type: {
      type: String,
      enum: ['Polygon'],
      default: 'Polygon',
      required: true
    },
    coordinates: {
      type: [[[Number]]],
      required: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  maxProviders: {
    type: Number,
    default: 0
  },
  serviceRadius: {
    type: Number,
    default: 5
  },
  description: {
    type: String
  },
  // New hierarchical fields
  zoneLevel: {
    type: String,
    enum: ['state', 'city', 'micro'],
    default: 'city'
  },
  parentZone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone',
    default: null
  },
  adjacentZones: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Zone'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId
  },
  s2CellIds: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

// Indexes
zoneSchema.index({ polygon: '2dsphere' });
zoneSchema.index({ s2CellIds: 1 });
zoneSchema.index({ city: 1, name: 1 }, { unique: true });

// Static helper to find zone by lat/lng coordinates
zoneSchema.statics.findZoneByCoordinates = async function(lat, lng) {
  const { latLngToS2CellId } = require('../utils/s2Helper');
  const cellId = latLngToS2CellId(parseFloat(lat), parseFloat(lng), 13);
  
  let zones = [];
  if (cellId) {
    // Phase 1: Fast $in match on S2 cells
    zones = await this.find({
      status: 'active',
      s2CellIds: cellId
    });
  }

  // Phase 2: Fallback to GeoJSON intersection query if no S2 cells precomputed or matched
  if (zones.length === 0) {
    zones = await this.find({
      status: 'active',
      polygon: {
        $geoIntersects: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          }
        }
      }
    });
  }
  if (zones.length === 0) return null;

  const levelWeight = { micro: 3, city: 2, state: 1 };
  const priorityWeight = { high: 3, medium: 2, low: 1 };

  zones.sort((a, b) => {
    const aLevel = levelWeight[a.zoneLevel] || 0;
    const bLevel = levelWeight[b.zoneLevel] || 0;
    if (aLevel !== bLevel) {
      return bLevel - aLevel; // higher specificity first (micro > city > state)
    }
    const aPriority = priorityWeight[a.priority] || 0;
    const bPriority = priorityWeight[b.priority] || 0;
    return bPriority - aPriority; // higher priority first
  });

  return zones[0];
};

module.exports = mongoose.model("Zone", zoneSchema);
