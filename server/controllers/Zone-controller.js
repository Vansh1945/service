const mongoose = require('mongoose');
const Zone = require('../models/Zone-model');

/**
 * Create a new Zone
 */
exports.createZone = async (req, res) => {
  try {
    const { name, polygon, priority, status, serviceRadius, maxProviders, description, city, zoneLevel, parentZone, adjacentZones } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    if (!polygon || !polygon.coordinates || !Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
      return res.status(400).json({ success: false, message: "Polygon and valid coordinates are required" });
    }

    const coords = polygon.coordinates[0];
    if (!Array.isArray(coords) || coords.length < 4) {
      return res.status(400).json({ success: false, message: "Polygon must have at least 4 coordinates (minimum polygon points)" });
    }

    // Validate hierarchy constraints
    if (zoneLevel === 'state' && parentZone) {
      return res.status(400).json({ success: false, message: "State zones must not have a parentZone" });
    }
    if (zoneLevel === 'city') {
      if (!parentZone) {
        return res.status(400).json({ success: false, message: "City zones must reference a state as parentZone" });
      }
      const parent = await Zone.findById(parentZone);
      if (!parent || parent.zoneLevel !== 'state') {
        return res.status(400).json({ success: false, message: "Parent zone must be a state" });
      }
    }
    if (zoneLevel === 'micro') {
      if (!parentZone) {
        return res.status(400).json({ success: false, message: "Micro zones must reference a city as parentZone" });
      }
      const parent = await Zone.findById(parentZone);
      if (!parent || parent.zoneLevel !== 'city') {
        return res.status(400).json({ success: false, message: "Parent zone must be a city" });
      }
    }

    // Check duplicate zone name in the same city
    if (city) {
      const duplicate = await Zone.findOne({ city, name: name.trim() });
      if (duplicate) {
        return res.status(400).json({ success: false, message: "Zone name already exists in this city" });
      }
    }

    // Overlap validation with hierarchical containment
    if (status !== 'inactive') {
      // Find any overlapping active zones (including potential parent zone)
      const overlapping = await Zone.findOne({
        status: 'active',
        polygon: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: polygon.coordinates } } }
      });
      if (overlapping) {
        // Allow overlap if overlapping zone is the specified parent zone and the new zone is fully contained within it
        if (parentZone && overlapping._id.equals(parentZone)) {
          const isContained = await Zone.findOne({
            _id: parentZone,
            polygon: { $geoWithin: { $geometry: { type: "Polygon", coordinates: polygon.coordinates } } }
          });
          if (!isContained) {
            return res.status(400).json({ success: false, message: "Micro zone must be fully inside parent city" });
          }
        } else {
          // Any other overlap is disallowed (same-level or other zones)
          return res.status(400).json({ success: false, message: "Same-level overlap not allowed" });
        }
      }
    }

    const newZone = new Zone({
      city,
      name,
      polygon,
      priority,
      status,
      serviceRadius,
      maxProviders,
      description,
      zoneLevel: zoneLevel || 'city',
      parentZone: parentZone || null,
      adjacentZones: adjacentZones || [],
      createdBy: req.user ? req.user._id : (req.admin ? req.admin._id : undefined)
    });

    await newZone.save();

    return res.status(201).json({ success: true, message: "Zone created successfully", data: newZone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

/**
 * Get all zones with optional pagination and filters
 */
exports.getAllZones = async (req, res) => {
  try {
    const { city, status, zoneLevel, page = 1, limit = 100 } = req.query;
    const query = {};
    if (city) query.city = city;
    if (status) query.status = status;
    if (zoneLevel) query.zoneLevel = zoneLevel;

    const skipIndex = (parseInt(page) - 1) * parseInt(limit);
    const zones = await Zone.find(query)
      .populate('parentZone adjacentZones')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skipIndex);
    const total = await Zone.countDocuments(query);
    return res.status(200).json({ success: true, message: "Zones retrieved successfully", data: zones, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

/**
 * Point-in-Polygon (Ray-casting) spatial containment check
 * Coordinates format: polygon coordinates are in [longitude, latitude] format from GeoJSON.
 */
const isPointInPolygon = (lat, lng, polygon) => {
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

/**
 * Get a single Zone by ID (Enhanced with analytics and linked users/providers)
 */
exports.getZoneById = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id).populate('parentZone adjacentZones');
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found", data: null });
    }

    // Calculate Analytics
    const Booking = mongoose.model('Booking');
    const Provider = mongoose.model('Provider');
    const User = mongoose.model('User');
    
    const polygonCoords = zone.polygon && zone.polygon.coordinates && zone.polygon.coordinates[0];

    // 1. Fetch & match Providers (Explicit + Geo fallback)
    let matchedProviders = [];
    if (polygonCoords) {
      const providersInZone = await Provider.find({
        isDeleted: false,
        $or: [
          { currentZone: id },
          {
            currentLocation: {
              $geoWithin: {
                $geometry: {
                  type: "Polygon",
                  coordinates: zone.polygon.coordinates
                }
              }
            }
          }
        ]
      }).select('_id name email phone profilePicUrl status currentLocation address').lean();

      const allProviders = await Provider.find({ isDeleted: false }).select('_id name email phone profilePicUrl status currentLocation address').lean();
      const matchedProvMap = new Map();

      providersInZone.forEach(p => matchedProvMap.set(p._id.toString(), p));

      allProviders.forEach(p => {
        if (matchedProvMap.has(p._id.toString())) return;

        if (p.currentLocation && p.currentLocation.coordinates && p.currentLocation.coordinates.length === 2) {
          const [lng, lat] = p.currentLocation.coordinates;
          if (lat !== 0 || lng !== 0) {
            if (isPointInPolygon(lat, lng, polygonCoords)) {
              matchedProvMap.set(p._id.toString(), p);
              return;
            }
          }
        }

        if (p.address && typeof p.address.lat === 'number' && typeof p.address.lng === 'number' && !isNaN(p.address.lat) && !isNaN(p.address.lng)) {
          if (isPointInPolygon(p.address.lat, p.address.lng, polygonCoords)) {
            matchedProvMap.set(p._id.toString(), p);
          }
        }
      });

      matchedProviders = Array.from(matchedProvMap.values());
    } else {
      matchedProviders = await Provider.find({ currentZone: id, isDeleted: false }).select('_id name email phone profilePicUrl status').lean();
    }

    // 2. Fetch & match Users (Explicit + Geo fallback)
    let matchedUsers = [];
    if (polygonCoords) {
      const usersInZone = await User.find({
        isSuspended: false,
        $or: [
          { currentZone: id },
          {
            currentLocation: {
              $geoWithin: {
                $geometry: {
                  type: "Polygon",
                  coordinates: zone.polygon.coordinates
                }
              }
            }
          }
        ]
      }).select('_id name email phone profilePicUrl currentLocation address').lean();

      const allUsers = await User.find({ isSuspended: false }).select('_id name email phone profilePicUrl currentLocation address').lean();
      const matchedUserMap = new Map();

      usersInZone.forEach(u => matchedUserMap.set(u._id.toString(), u));

      allUsers.forEach(u => {
        if (matchedUserMap.has(u._id.toString())) return;

        if (u.currentLocation && u.currentLocation.coordinates && u.currentLocation.coordinates.length === 2) {
          const [lng, lat] = u.currentLocation.coordinates;
          if (lat !== 0 || lng !== 0) {
            if (isPointInPolygon(lat, lng, polygonCoords)) {
              matchedUserMap.set(u._id.toString(), u);
              return;
            }
          }
        }

        if (u.address && typeof u.address.lat === 'number' && typeof u.address.lng === 'number' && !isNaN(u.address.lat) && !isNaN(u.address.lng)) {
          if (isPointInPolygon(u.address.lat, u.address.lng, polygonCoords)) {
            matchedUserMap.set(u._id.toString(), u);
          }
        }
      });

      matchedUsers = Array.from(matchedUserMap.values());
    } else {
      matchedUsers = await User.find({ currentZone: id, isSuspended: false }).select('_id name email phone profilePicUrl').lean();
    }

    // 3. Fetch & match Bookings (Explicit + Geo fallback)
    let matchedBookings = [];
    if (polygonCoords) {
      const bookingsInZone = await Booking.find({ zoneId: id }).lean();
      const allBookings = await Booking.find({}).lean();
      const matchedBookingMap = new Map();

      bookingsInZone.forEach(b => matchedBookingMap.set(b._id.toString(), b));

      allBookings.forEach(b => {
        if (matchedBookingMap.has(b._id.toString())) return;

        if (b.address && typeof b.address.lat === 'number' && typeof b.address.lng === 'number' && !isNaN(b.address.lat) && !isNaN(b.address.lng)) {
          if (isPointInPolygon(b.address.lat, b.address.lng, polygonCoords)) {
            matchedBookingMap.set(b._id.toString(), b);
          }
        }
      });

      matchedBookings = Array.from(matchedBookingMap.values());
    } else {
      matchedBookings = await Booking.find({ zoneId: id }).lean();
    }

    // 4. Calculate Analytics Metrics
    const totalBookings = matchedBookings.length;
    const activeProvidersCount = matchedProviders.length;
    const activeUsersCount = matchedUsers.length;
    const assignedBookings = matchedBookings.filter(b => b.provider !== null && b.provider !== undefined).length;
    const couponUsage = matchedBookings.filter(b => b.couponApplied && b.couponApplied.code).length;
    const bookingsForCommission = matchedBookings.filter(b => b.commissionAmount !== undefined);

    const commissionGenerated = bookingsForCommission.reduce((sum, b) => sum + (b.commissionAmount || 0), 0);
    const assignmentSuccessRate = totalBookings > 0 ? parseFloat(((assignedBookings / totalBookings) * 100).toFixed(2)) : 100;
    
    const analytics = {
        totalBookings,
        activeProviders: activeProvidersCount,
        activeUsers: activeUsersCount,
        commissionGenerated: parseFloat(commissionGenerated.toFixed(2)),
        couponUsage,
        assignmentSuccessRate
    };

    return res.status(200).json({ 
      success: true, 
      message: "Zone retrieved successfully", 
      data: {
        ...zone.toObject(),
        analytics,
        linkedProviders: matchedProviders,
        linkedUsers: matchedUsers
      } 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

/**
 * Update an existing Zone
 */
exports.updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, polygon, priority, status, serviceRadius, maxProviders, description, city, zoneLevel, parentZone, adjacentZones } = req.body;
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found", data: null });
    }
    // Overlap validation with hierarchical containment
    if (status !== 'inactive') {
      // Find any overlapping active zones
      const overlapping = await Zone.findOne({
        status: 'active',
        _id: { $ne: id },
        polygon: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: polygon.coordinates } } }
      });
      if (overlapping) {
        // If this zone has a parent, allow overlap only with that parent zone
        if (parentZone && overlapping._id.equals(parentZone)) {
          // Ensure child polygon is fully inside parent (basic containment check)
          const containmentCheck = await Zone.findOne({
            _id: parentZone,
            polygon: { $geoWithin: { $geometry: { type: "Polygon", coordinates: polygon.coordinates } } }
          });
          if (!containmentCheck) {
            return res.status(400).json({ success: false, message: "Micro zone must be fully inside parent city" });
          }
        } else {
          return res.status(400).json({ success: false, message: `Zone overlaps with existing active zone: ${overlapping.name}` });
        }
      }
    }
    const newLevel = zoneLevel !== undefined ? zoneLevel : zone.zoneLevel;
    const newParent = parentZone !== undefined ? parentZone : zone.parentZone;
    if (newLevel === 'state' && newParent) {
      return res.status(400).json({ success: false, message: "State zones must not have a parentZone" });
    }
    if (newLevel === 'city') {
      if (!newParent) {
        return res.status(400).json({ success: false, message: "City zones must reference a state as parentZone" });
      }
      const parent = await Zone.findById(newParent);
      if (!parent || parent.zoneLevel !== 'state') {
        return res.status(400).json({ success: false, message: "Parent zone must be a state" });
      }
    }
    if (newLevel === 'micro') {
      if (!newParent) {
        return res.status(400).json({ success: false, message: "Micro zones must reference a city as parentZone" });
      }
      const parent = await Zone.findById(newParent);
      if (!parent || parent.zoneLevel !== 'city') {
        return res.status(400).json({ success: false, message: "Parent zone must be a city" });
      }
    }
    // Duplicate name check if name/city changes
    if (name !== undefined || city !== undefined) {
      const targetCity = city !== undefined ? city : zone.city;
      const targetName = name !== undefined ? name.trim() : zone.name;
      const duplicate = await Zone.findOne({ _id: { $ne: id }, city: targetCity, name: targetName });
      if (duplicate) {
        return res.status(400).json({ success: false, message: "Zone name already exists in this city" });
      }
    }
    // Overlap check if polygon/status changes and active
    const targetStatus = status !== undefined ? status : zone.status;
    const targetPolygon = polygon !== undefined ? polygon : zone.polygon;
    if (targetStatus === 'active' && targetPolygon && targetPolygon.coordinates) {
      const overlapQuery = { _id: { $ne: id }, status: 'active', polygon: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: targetPolygon.coordinates } } } };
      const overlapping = await Zone.findOne(overlapQuery);
      if (overlapping) {
        return res.status(400).json({ success: false, message: `Zone overlaps with existing active zone: ${overlapping.name}` });
      }
    }
    // Apply updates
    if (name !== undefined) zone.name = name;
    if (polygon !== undefined) zone.polygon = polygon;
    if (priority !== undefined) zone.priority = priority;
    if (status !== undefined) zone.status = status;
    if (serviceRadius !== undefined) zone.serviceRadius = serviceRadius;
    if (maxProviders !== undefined) zone.maxProviders = maxProviders;
    if (description !== undefined) zone.description = description;
    if (city !== undefined) zone.city = city;
    if (zoneLevel !== undefined) zone.zoneLevel = zoneLevel;
    if (parentZone !== undefined) zone.parentZone = parentZone;
    if (adjacentZones !== undefined) zone.adjacentZones = adjacentZones;
    await zone.save();
    return res.status(200).json({ success: true, message: "Zone updated successfully", data: zone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

/**
 * Delete a Zone (Soft Delete by setting status to inactive)
 */
exports.deleteZone = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found", data: null });
    }
    zone.status = 'inactive';
    await zone.save();
    return res.status(200).json({ success: true, message: "Zone deactivated successfully", data: zone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};

/**
 * Toggle Zone Status between active and inactive
 */
exports.toggleZoneStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found", data: null });
    }
    if (zone.status === 'inactive') {
      const overlapQuery = { _id: { $ne: id }, status: 'active', polygon: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: zone.polygon.coordinates } } } };
      const overlapping = await Zone.findOne(overlapQuery);
      if (overlapping) {
        return res.status(400).json({ success: false, message: `Cannot activate: overlaps with existing active zone (${overlapping.name})` });
      }
      zone.status = 'active';
    } else {
      zone.status = 'inactive';
    }
    await zone.save();
    return res.status(200).json({ success: true, message: `Zone status updated to ${zone.status}`, data: zone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, data: null });
  }
};



/**
 * Resolve Zone by Coordinates
 */
exports.resolveZoneByCoordinates = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: "Latitude (lat) and Longitude (lng) are required" });
    }
    const zone = await Zone.findZoneByCoordinates(lat, lng);
    if (!zone) {
      return res.status(200).json({ success: false, message: "No service zone found" });
    }
    return res.status(200).json({ success: true, zone });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
