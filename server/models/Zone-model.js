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
  }
}, {
  timestamps: true
});

// Indexes
zoneSchema.index({ polygon: '2dsphere' });
zoneSchema.index({ city: 1, name: 1 }, { unique: true });

// Static helper to find zone by lat/lng coordinates
zoneSchema.statics.findZoneByCoordinates = function(lat, lng) {
  return this.findOne({
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
};

module.exports = mongoose.model("Zone", zoneSchema);
