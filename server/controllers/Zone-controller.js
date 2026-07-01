const mongoose = require('mongoose');
const Zone = require('../models/Zone-model');
const cache = require('../utils/cache');

const MAX_ZONE_POLYGON_VERTICES = 800;

const getPointSegmentDistance = (point, start, end) => {
  const x = point[0];
  const y = point[1];
  const x1 = start[0];
  const y1 = start[1];
  const x2 = end[0];
  const y2 = end[1];
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }

  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
};

const simplifyRdp = (points, tolerance) => {
  if (!Array.isArray(points) || points.length <= 2) return points || [];

  let maxDistance = 0;
  let index = 0;
  const lastIndex = points.length - 1;

  for (let i = 1; i < lastIndex; i++) {
    const distance = getPointSegmentDistance(points[i], points[0], points[lastIndex]);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance <= tolerance) {
    return [points[0], points[lastIndex]];
  }

  const left = simplifyRdp(points.slice(0, index + 1), tolerance);
  const right = simplifyRdp(points.slice(index), tolerance);
  return left.slice(0, -1).concat(right);
};

const normalizeZonePolygon = (polygon) => {
  if (!polygon || !polygon.coordinates || !Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
    throw new Error("Polygon and valid coordinates are required");
  }

  let coords = polygon.coordinates[0];
  if (!Array.isArray(coords)) {
    throw new Error("Polygon coordinates must be an array");
  }

  coords = coords
    .filter(coord => Array.isArray(coord) && Number.isFinite(Number(coord[0])) && Number.isFinite(Number(coord[1])))
    .map(coord => [Number(coord[0]), Number(coord[1])])
    .filter((coord, index, list) => index === 0 || coord[0] !== list[index - 1][0] || coord[1] !== list[index - 1][1]);

  if (coords.length > 1) {
    const firstCoord = coords[0];
    const lastCoord = coords[coords.length - 1];
    if (firstCoord[0] === lastCoord[0] && firstCoord[1] === lastCoord[1]) {
      coords = coords.slice(0, -1);
    }
  }

  let safeCoords = coords;
  let tolerance = 0.00025;
  while (safeCoords.length > MAX_ZONE_POLYGON_VERTICES && tolerance <= 0.02) {
    safeCoords = simplifyRdp(coords, tolerance);
    tolerance *= 1.8;
  }

  if (safeCoords.length > MAX_ZONE_POLYGON_VERTICES) {
    const step = Math.ceil(safeCoords.length / MAX_ZONE_POLYGON_VERTICES);
    safeCoords = safeCoords.filter((_, index) => index % step === 0);
  }

  if (safeCoords.length < 3) {
    throw new Error("Polygon must have at least 3 valid boundary points");
  }

  safeCoords.push([safeCoords[0][0], safeCoords[0][1]]);
  return {
    ...polygon,
    type: "Polygon",
    coordinates: [safeCoords]
  };
};

/**
 * Create a new Zone
 */
exports.createZone = async (req, res, next) => {
  try {
    const { name, polygon, priority, status, serviceRadius, maxProviders, description, city, zoneLevel, parentZone, adjacentZones } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    let normalizedPolygon;
    try {
      normalizedPolygon = normalizeZonePolygon(polygon);
    } catch (validationError) {
      return res.status(400).json({ success: false, message: validationError.message });
    }

    // Validate hierarchy constraints
    if (zoneLevel === 'city' && parentZone) {
      return res.status(400).json({ success: false, message: "City zones must not have a parentZone" });
    }
    if (zoneLevel === 'service' && parentZone) {
      const parent = await Zone.findById(parentZone);
      if (!parent || parent.zoneLevel !== 'city') {
        return res.status(400).json({ success: false, message: "Parent zone must be a City level zone" });
      }
    }
    if (zoneLevel === 'local' && parentZone) {
      const parent = await Zone.findById(parentZone);
      if (!parent || parent.zoneLevel !== 'service') {
        return res.status(400).json({ success: false, message: "Parent zone must be a Service level zone" });
      }
    }
    if (zoneLevel === 'micro' && parentZone) {
      const parent = await Zone.findById(parentZone);
      if (!parent || parent.zoneLevel !== 'local') {
        return res.status(400).json({ success: false, message: "Parent zone must be a Local level zone" });
      }
    }

    // Check duplicate zone name in the same city
    if (city) {
      const duplicate = await Zone.findOne({ city, name: name.trim() });
      if (duplicate) {
        return res.status(400).json({ success: false, message: "Zone name already exists in this city" });
      }
    }

    // Overlap validation — only same-level overlap is blocked
    if (status !== 'inactive') {
      const overlappingZones = await Zone.find({
        status: 'active',
        polygon: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: normalizedPolygon.coordinates } } }
      });
      for (const overlapping of overlappingZones) {
        // Allow overlap with parent/child zones
        if (parentZone && overlapping._id.equals(parentZone)) {
          continue;
        }
        // Only same-level active zones are not allowed to overlap
        if (overlapping.zoneLevel === zoneLevel) {
          const poly1 = normalizedPolygon.coordinates[0];
          const poly2 = overlapping.polygon.coordinates[0];
          if (isPolygonInteriorOverlapping(poly1, poly2)) {
            return res.status(400).json({ success: false, message: `Same-level overlap not allowed with zone: ${overlapping.name}` });
          }
        }
      }
    }

    const newZone = new Zone({
      city,
      name,
      polygon: normalizedPolygon,
      priority,
      status,
      serviceRadius,
      maxProviders: (zoneLevel || 'city') === 'city' ? 0 : maxProviders,
      description,
      zoneLevel: zoneLevel || 'city',
      parentZone: zoneLevel !== 'city' && parentZone ? parentZone : null,
      adjacentZones: adjacentZones || [],
      createdBy: req.user ? req.user._id : (req.admin ? req.admin._id : undefined)
    });

    await newZone.save();

    cache.delByPrefix('zone_');
    cache.delByPrefix('zones_');

    return res.status(201).json({ success: true, message: "Zone created successfully", data: newZone });
  } catch (error) {
    global.logger.error(`[ZoneController.createZone] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Get all zones with optional pagination and filters
 */
exports.getAllZones = async (req, res, next) => {
  try {
    const { city, status, zoneLevel, page = 1, limit = 100 } = req.query;
    const query = {};
    if (city) query.city = city;
    if (status) query.status = status;
    if (zoneLevel) query.zoneLevel = zoneLevel;

    const cacheKey = `zones_all_${city || ''}_${status || ''}_${zoneLevel || ''}_${page}_${limit}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    const skipIndex = (parseInt(page) - 1) * parseInt(limit);
    
    const [zones, total] = await Promise.all([
      Zone.find(query)
        .populate('parentZone adjacentZones', 'name city status zoneLevel')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skipIndex)
        .lean(),
      Zone.countDocuments(query)
    ]);

    const resultResponse = { success: true, message: "Zones retrieved successfully", data: zones, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } };
    cache.set(cacheKey, resultResponse, 300);

    return res.status(200).json(resultResponse);
  } catch (error) {
    global.logger.error(`[ZoneController.getAllZones] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Point-in-Polygon (Ray-casting) spatial containment check
 * Coordinates format: polygon coordinates are in [longitude, latitude] format from GeoJSON.
 */
const isPointInPolygon = (lat, lng, polygon) => {
  if (!polygon || polygon.length < 3) return false;

  // Bounding box pre-filter optimization
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const pLng = polygon[i][0];
    const pLat = polygon[i][1];
    if (pLat < minLat) minLat = pLat;
    if (pLat > maxLat) maxLat = pLat;
    if (pLng < minLng) minLng = pLng;
    if (pLng > maxLng) maxLng = pLng;
  }
  if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
    return false;
  }

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

const isPolygonInteriorOverlapping = (poly1Coords, poly2Coords) => {
  if (!poly1Coords || poly1Coords.length < 3 || !poly2Coords || poly2Coords.length < 3) return false;

  const checkCentroidAndMidpoints = (p1, p2) => {
    let sumLng = 0;
    let sumLat = 0;
    const len = p1.length - 1;
    for (let i = 0; i < len; i++) {
      sumLng += p1[i][0];
      sumLat += p1[i][1];
    }
    const centroid = [sumLng / len, sumLat / len];

    // Check if centroid is inside both p1 and p2
    if (isPointInPolygon(centroid[1], centroid[0], p1) && isPointInPolygon(centroid[1], centroid[0], p2)) return true;

    // Check midpoints between centroid and boundary vertices
    for (let i = 0; i < len; i++) {
      const midpoint = [
        (centroid[0] + p1[i][0]) / 2,
        (centroid[1] + p1[i][1]) / 2
      ];
      if (isPointInPolygon(midpoint[1], midpoint[0], p1) && isPointInPolygon(midpoint[1], midpoint[0], p2)) return true;
    }
    return false;
  };

  return checkCentroidAndMidpoints(poly1Coords, poly2Coords) || checkCentroidAndMidpoints(poly2Coords, poly1Coords);
};

/**
 * Get a single Zone by ID (Enhanced with analytics and linked users/providers)
 */
exports.getZoneById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const cacheKey = `zone_${id}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    const zone = await Zone.findById(id).populate('parentZone adjacentZones');
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found", data: null });
    }

    // Calculate Analytics
    const Booking = mongoose.model('Booking');
    const Provider = mongoose.model('Provider');
    const User = mongoose.model('User');
    
    const polygonCoords = zone.polygon && zone.polygon.coordinates && zone.polygon.coordinates[0];

    // Helper to extract polygon bounding box for pre-filtering query
    const getPolygonBoundingBox = (coords) => {
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (let i = 0; i < coords.length; i++) {
        const pLng = coords[i][0];
        const pLat = coords[i][1];
        if (pLat < minLat) minLat = pLat;
        if (pLat > maxLat) maxLat = pLat;
        if (pLng < minLng) minLng = pLng;
        if (pLng > maxLng) maxLng = pLng;
      }
      return { minLat, maxLat, minLng, maxLng };
    };

    let matchedProviders = [];
    let matchedUsers = [];
    let matchedBookings = [];

    if (polygonCoords) {
      const bbox = getPolygonBoundingBox(polygonCoords);

      const [providersInZone, allProviders, usersInZone, allUsers, bookingsInZone, allBookings] = await Promise.all([
        Provider.find({
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
        }).select('_id name email phone profilePicUrl status currentLocation address').lean(),

        Provider.find({
          isDeleted: false,
          'address.lat': { $gte: bbox.minLat, $lte: bbox.maxLat },
          'address.lng': { $gte: bbox.minLng, $lte: bbox.maxLng }
        }).select('_id name email phone profilePicUrl status currentLocation address').lean(),

        User.find({
          isSuspended: { $ne: true },
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
        }).select('_id name email phone profilePicUrl currentLocation address').lean(),

        User.find({
          isSuspended: { $ne: true },
          'address.lat': { $gte: bbox.minLat, $lte: bbox.maxLat },
          'address.lng': { $gte: bbox.minLng, $lte: bbox.maxLng }
        }).select('_id name email phone profilePicUrl currentLocation address').lean(),

        Booking.find({ zoneId: id }).lean(),

        Booking.find({
          'address.lat': { $gte: bbox.minLat, $lte: bbox.maxLat },
          'address.lng': { $gte: bbox.minLng, $lte: bbox.maxLng }
        }).lean()
      ]);

      // Provider matching
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

      // User matching
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

      // Booking matching
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
      const [providers, users, bookings] = await Promise.all([
        Provider.find({ currentZone: id, isDeleted: false }).select('_id name email phone profilePicUrl status').lean(),
        User.find({ currentZone: id, isSuspended: false }).select('_id name email phone profilePicUrl').lean(),
        Booking.find({ zoneId: id }).lean()
      ]);
      matchedProviders = providers;
      matchedUsers = users;
      matchedBookings = bookings;
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

    const resultResponse = { 
      success: true, 
      message: "Zone retrieved successfully", 
      data: {
        ...zone.toObject(),
        analytics,
        linkedProviders: matchedProviders,
        linkedUsers: matchedUsers
      } 
    };

    cache.set(cacheKey, resultResponse, 300);

    return res.status(200).json(resultResponse);
  } catch (error) {
    global.logger.error(`[ZoneController.getZoneById] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Update an existing Zone
 */
exports.updateZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, polygon, priority, status, serviceRadius, maxProviders, description, city, zoneLevel, parentZone, adjacentZones } = req.body;
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found", data: null });
    }

    let normalizedPolygon;
    if (polygon !== undefined) {
      try {
        normalizedPolygon = normalizeZonePolygon(polygon);
      } catch (validationError) {
        return res.status(400).json({ success: false, message: validationError.message });
      }
    }

    const targetStatus = status !== undefined ? status : zone.status;
    const targetPolygon = normalizedPolygon !== undefined ? normalizedPolygon : zone.polygon;
    const targetParentZone = parentZone !== undefined ? parentZone : zone.parentZone;
    const targetZoneLevel = zoneLevel !== undefined ? zoneLevel : zone.zoneLevel;

    // Overlap validation — only same-level overlap is blocked
    if (targetStatus !== 'inactive' && targetPolygon && targetPolygon.coordinates) {
      const overlappingZones = await Zone.find({
        status: 'active',
        _id: { $ne: id },
        polygon: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: targetPolygon.coordinates } } }
      });
      for (const overlapping of overlappingZones) {
        // Allow overlap with parent/child zones
        if (targetParentZone && overlapping._id.equals(targetParentZone)) {
          continue;
        }
        // Only same-level active zones are not allowed to overlap
        if (overlapping.zoneLevel === targetZoneLevel) {
          const poly1 = targetPolygon.coordinates[0];
          const poly2 = overlapping.polygon.coordinates[0];
          if (isPolygonInteriorOverlapping(poly1, poly2)) {
            return res.status(400).json({ success: false, message: `Zone overlaps with existing active zone: ${overlapping.name}` });
          }
        }
      }
    }

    const newLevel = zoneLevel !== undefined ? zoneLevel : zone.zoneLevel;
    const newParent = parentZone !== undefined ? parentZone : zone.parentZone;
    if (newLevel === 'city' && newParent) {
      return res.status(400).json({ success: false, message: "City zones must not have a parentZone" });
    }
    if (newLevel === 'service' && newParent) {
      const parent = await Zone.findById(newParent);
      if (!parent || parent.zoneLevel !== 'city') {
        return res.status(400).json({ success: false, message: "Parent zone must be a City level zone" });
      }
    }
    if (newLevel === 'local' && newParent) {
      const parent = await Zone.findById(newParent);
      if (!parent || parent.zoneLevel !== 'service') {
        return res.status(400).json({ success: false, message: "Parent zone must be a Service level zone" });
      }
    }
    if (newLevel === 'micro' && newParent) {
      const parent = await Zone.findById(newParent);
      if (!parent || parent.zoneLevel !== 'local') {
        return res.status(400).json({ success: false, message: "Parent zone must be a Local level zone" });
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

    // Apply updates
    if (name !== undefined) zone.name = name;
    if (normalizedPolygon !== undefined) zone.polygon = normalizedPolygon;
    if (priority !== undefined) zone.priority = priority;
    if (status !== undefined) zone.status = status;
    if (serviceRadius !== undefined) zone.serviceRadius = serviceRadius;
    if (maxProviders !== undefined) zone.maxProviders = maxProviders;
    if (description !== undefined) zone.description = description;
    if (city !== undefined) zone.city = city;
    if (zoneLevel !== undefined) zone.zoneLevel = zoneLevel;
    if (zone.zoneLevel === 'city') zone.maxProviders = 0; // City level has no provider limit
    if (parentZone !== undefined) zone.parentZone = parentZone;
    if (adjacentZones !== undefined) zone.adjacentZones = adjacentZones;
    await zone.save();

    cache.delByPrefix('zone_');
    cache.delByPrefix('zones_');

    return res.status(200).json({ success: true, message: "Zone updated successfully", data: zone });
  } catch (error) {
    global.logger.error(`[ZoneController.updateZone] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

/**
 * Delete a Zone (Hard Delete and clean up references)
 */
exports.deleteZone = async (req, res, next) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found", data: null });
    }
    
    // Perform hard delete
    await Zone.findByIdAndDelete(id);

    // Clean up references in other zones
    await Zone.updateMany(
      { parentZone: id },
      { $set: { parentZone: null } }
    );
    await Zone.updateMany(
      { adjacentZones: id },
      { $pull: { adjacentZones: id } }
    );

    // Clean up references in Provider and User models
    const Provider = mongoose.model('Provider');
    const User = mongoose.model('User');
    await Provider.updateMany(
      { currentZone: id },
      { $set: { currentZone: null } }
    );
    await User.updateMany(
      { currentZone: id },
      { $set: { currentZone: null } }
    );

    cache.delByPrefix('zone_');
    cache.delByPrefix('zones_');

    return res.status(200).json({ success: true, message: "Zone deleted successfully", data: zone });
  } catch (error) {
    global.logger.error(`[ZoneController.deleteZone] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};


/**
 * Toggle Zone Status between active and inactive
 */
exports.toggleZoneStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({ success: false, message: "Zone not found", data: null });
    }
    if (zone.status === 'inactive') {
      const targetParentZone = zone.parentZone;
      const targetPolygon = zone.polygon;
      if (targetPolygon && targetPolygon.coordinates) {
        const overlappingZones = await Zone.find({
          status: 'active',
          _id: { $ne: id },
          polygon: { $geoIntersects: { $geometry: { type: "Polygon", coordinates: targetPolygon.coordinates } } }
        });
        for (const overlapping of overlappingZones) {
          const isParentChildRelationship = 
            (targetParentZone && overlapping._id.equals(targetParentZone)) ||
            (overlapping.parentZone && overlapping.parentZone.equals(zone._id));

          if (isParentChildRelationship) {
            continue;
          } else {
            // Check if there is an actual interior overlap, not just touching borders
            const poly1 = targetPolygon.coordinates[0];
            const poly2 = overlapping.polygon.coordinates[0];
            if (isPolygonInteriorOverlapping(poly1, poly2)) {
              return res.status(400).json({ success: false, message: `Cannot activate: overlaps with existing active zone (${overlapping.name})` });
            }
          }
        }
      }
      zone.status = 'active';
    } else {
      zone.status = 'inactive';
    }
    await zone.save();

    cache.delByPrefix('zone_');
    cache.delByPrefix('zones_');

    return res.status(200).json({ success: true, message: `Zone status updated to ${zone.status}`, data: zone });
  } catch (error) {
    global.logger.error(`[ZoneController.toggleZoneStatus] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};



/**
 * Resolve Zone by Coordinates
 */
exports.resolveZoneByCoordinates = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: "Latitude (lat) and Longitude (lng) are required" });
    }

    const cacheKey = `zone_coords_${lat}_${lng}`;
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return res.status(200).json(cachedResult);
    }

    const zone = await Zone.findZoneByCoordinates(lat, lng);
    if (!zone) {
      const failResponse = { success: false, message: "No service zone found" };
      return res.status(200).json(failResponse);
    }
    const successResponse = { success: true, zone };
    cache.set(cacheKey, successResponse, 300);

    return res.status(200).json(successResponse);
  } catch (error) {
    global.logger.error(`[ZoneController.resolveZoneByCoordinates] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};
