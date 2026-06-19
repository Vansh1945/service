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
    enum: ['city', 'service', 'local', 'micro'],
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

  const levelWeight = { micro: 4, local: 3, service: 2, city: 1 };
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

// Point-in-Polygon containment check for S2 cell generator
const isPointInPolygonForS2 = (lat, lng, polygon) => {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const lngI = polygon[i][0];
    const latI = polygon[i][1];
    const lngJ = polygon[j][0];
    const latJ = polygon[j][1];

    const intersect = ((latI > lat) !== (latJ > lat))
      && (lng < (lngJ - lngI) * (lat - latI) / (latJ - latI) + lngI);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Pre-save hook to compute and sync S2 cell coverage for the zone polygon
zoneSchema.pre('save', async function(next) {
  if (this.isModified('polygon') || this.isNew) {
    try {
      const { latLngToS2CellIdAsync } = require('../utils/s2HelperAsync');
      const polygonCoords = this.polygon && this.polygon.coordinates && this.polygon.coordinates[0];
      
      if (polygonCoords && polygonCoords.length >= 3) {
        const lats = polygonCoords.map(c => c[1]);
        const lngs = polygonCoords.map(c => c[0]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const uniqueCells = new Set();

        // 1. Add all boundary vertices' cell IDs
        const boundaryPromises = polygonCoords.map(async (coord) => {
          const cell = await latLngToS2CellIdAsync(coord[1], coord[0], 13);
          if (cell) uniqueCells.add(cell);
        });

        // 2. Sample points in a grid within the bounding box
        const step = 0.005; // ~500m grid sampling step
        const gridPoints = [];
        for (let lat = minLat + step/2; lat < maxLat; lat += step) {
          for (let lng = minLng + step/2; lng < maxLng; lng += step) {
            if (isPointInPolygonForS2(lat, lng, polygonCoords)) {
              gridPoints.push({ lat, lng });
            }
          }
        }

        // Limit grid points to maximum 1000 points to prevent thread pool congestion
        const cappedGridPoints = gridPoints.slice(0, 1000);

        const gridPromises = cappedGridPoints.map(async (point) => {
          const cell = await latLngToS2CellIdAsync(point.lat, point.lng, 13);
          if (cell) uniqueCells.add(cell);
        });

        await Promise.all([...boundaryPromises, ...gridPromises]);

        this.s2CellIds = Array.from(uniqueCells);
      }
    } catch (err) {
      console.error('Error generating zone S2 cell IDs in pre-save:', err);
    }
  }
  next();
});

module.exports = mongoose.model("Zone", zoneSchema);
