const Zone = require('../models/Zone-model');

/**
 * Create a new Zone
 */
exports.createZone = async (req, res) => {
  try {
    const { name, polygon, priority, status, serviceRadius, maxProviders, description, city } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required"
      });
    }

    if (!polygon || !polygon.coordinates || !Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Polygon and valid coordinates are required"
      });
    }

    const coords = polygon.coordinates[0];
    if (!Array.isArray(coords) || coords.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Polygon must have at least 4 coordinates (minimum polygon points)"
      });
    }

    // Check duplicate zone name in the same city
    if (city) {
      const duplicate = await Zone.findOne({ city, name: name.trim() });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Zone name already exists in this city"
        });
      }
    }

    // Check overlapping zones only if creating as active
    if (status !== 'inactive') {
      const overlapQuery = {
        status: 'active',
        polygon: {
          $geoIntersects: {
            $geometry: {
              type: "Polygon",
              coordinates: polygon.coordinates
            }
          }
        }
      };

      const overlapping = await Zone.findOne(overlapQuery);
      if (overlapping) {
        return res.status(400).json({
          success: false,
          message: `Zone overlaps with existing active zone: ${overlapping.name}`
        });
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
      createdBy: req.user ? req.user._id : (req.admin ? req.admin._id : undefined)
    });

    await newZone.save();

    return res.status(201).json({
      success: true,
      message: "Zone created successfully",
      data: newZone
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

/**
 * Get all zones with optional pagination and filters
 */
exports.getAllZones = async (req, res) => {
  try {
    const { city, status, page = 1, limit = 10 } = req.query;
    const query = {};

    if (city) query.city = city;
    if (status) query.status = status;

    const skipIndex = (parseInt(page) - 1) * parseInt(limit);
    const zones = await Zone.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skipIndex);

    const total = await Zone.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: "Zones retrieved successfully",
      data: zones,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

/**
 * Get a single Zone by ID
 */
exports.getZoneById = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
        data: null
      });
    }

    return res.status(200).json({
      success: true,
      message: "Zone retrieved successfully",
      data: zone
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

/**
 * Update an existing Zone
 */
exports.updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, polygon, priority, status, serviceRadius, maxProviders, description, city } = req.body;

    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
        data: null
      });
    }

    const targetCity = city !== undefined ? city : zone.city;
    const targetName = name !== undefined ? name.trim() : zone.name;

    // Check duplicate zone name in the same city if changing name or city
    if (name !== undefined || city !== undefined) {
      const duplicate = await Zone.findOne({
        _id: { $ne: id },
        city: targetCity,
        name: targetName
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: "Zone name already exists in this city"
        });
      }
    }

    // Recheck overlap if polygon or status is changing and it will be active
    const targetStatus = status !== undefined ? status : zone.status;
    const targetPolygon = polygon !== undefined ? polygon : zone.polygon;

    if (targetStatus === 'active') {
      const overlapQuery = {
        _id: { $ne: id },
        status: 'active',
        polygon: {
          $geoIntersects: {
            $geometry: {
              type: "Polygon",
              coordinates: targetPolygon.coordinates
            }
          }
        }
      };

      const overlapping = await Zone.findOne(overlapQuery);
      if (overlapping) {
        return res.status(400).json({
          success: false,
          message: `Zone overlaps with existing active zone: ${overlapping.name}`
        });
      }
    }

    if (name !== undefined) zone.name = name;
    if (polygon !== undefined) zone.polygon = polygon;
    if (priority !== undefined) zone.priority = priority;
    if (status !== undefined) zone.status = status;
    if (serviceRadius !== undefined) zone.serviceRadius = serviceRadius;
    if (maxProviders !== undefined) zone.maxProviders = maxProviders;
    if (description !== undefined) zone.description = description;
    if (city !== undefined) zone.city = city;

    await zone.save();

    return res.status(200).json({
      success: true,
      message: "Zone updated successfully",
      data: zone
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
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
      return res.status(404).json({
        success: false,
        message: "Zone not found",
        data: null
      });
    }

    zone.status = 'inactive';
    await zone.save();

    return res.status(200).json({
      success: true,
      message: "Zone deactivated successfully",
      data: zone
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
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
      return res.status(404).json({
        success: false,
        message: "Zone not found",
        data: null
      });
    }

    if (zone.status === 'inactive') {
      // Check for overlap before activating
      const overlapQuery = {
        _id: { $ne: id },
        status: 'active',
        polygon: {
          $geoIntersects: {
            $geometry: {
              type: "Polygon",
              coordinates: zone.polygon.coordinates
            }
          }
        }
      };
      
      const overlapping = await Zone.findOne(overlapQuery);
      if (overlapping) {
        return res.status(400).json({
          success: false,
          message: `Cannot activate: overlaps with existing active zone (${overlapping.name})`
        });
      }
      zone.status = 'active';
    } else {
      zone.status = 'inactive';
    }

    await zone.save();

    return res.status(200).json({
      success: true,
      message: `Zone status updated to ${zone.status}`,
      data: zone
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      data: null
    });
  }
};

/**
 * Resolve Zone by Coordinates
 */
exports.resolveZoneByCoordinates = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: "Latitude (lat) and Longitude (lng) are required"
      });
    }

    const zone = await Zone.findZoneByCoordinates(lat, lng);

    if (!zone) {
      return res.status(200).json({
        success: false,
        message: "No service zone found"
      });
    }

    return res.status(200).json({
      success: true,
      zone
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
