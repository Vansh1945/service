const Coupon = require('../models/Coupon-model');
const User = require('../models/User-model');

// ADMIN CONTROLLERS

// Create new coupon
const createCoupon = async (req, res, next) => {
  try {
    const { code, discountType, discountValue, expiryDate, minBookingValue, isGlobal, isFirstBooking, assignedTo, usageLimit, applicableZones, scope, selectedZones } = req.body;

    if (isFirstBooking) {
      const existingFirstBookingCoupon = await Coupon.findOne({ isFirstBooking: true, isActive: true });
      if (existingFirstBookingCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Active first-booking coupon already exists'
        });
      }
    }

    if (assignedTo) {
      const userExists = await User.findById(assignedTo);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: 'Assigned user not found'
        });
      }
    }

    const coupon = await Coupon.createCoupon(req.adminID, {
      code,
      discountType,
      discountValue,
      expiryDate,
      minBookingValue: minBookingValue || 0,
      isGlobal,
      isFirstBooking,
      assignedTo,
      usageLimit: usageLimit || null,
      applicableZones: applicableZones || [],
      scope: scope || (isGlobal === true ? 'global' : 'zone'),
      selectedZones: selectedZones || applicableZones || []
    });

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
      data: coupon
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }
    global.logger.error(`[CouponController.createCoupon] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Get all coupons with filters
const getAllCoupons = async (req, res, next) => {
  try {
    const { status, type, page, limit: limitQ } = req.query;
    const pageNum = parseInt(page) || 1;
    const limit = parseInt(limitQ) || 10;
    const skip = (pageNum - 1) * limit;
    const filters = {};

    if (status === 'active') {
      filters.isActive = true;
      filters.expiryDate = { $gte: new Date() };
    } else if (status === 'expired') {
      filters.$or = [
        { isActive: false },
        { expiryDate: { $lt: new Date() } }
      ];
    }

    if (type === 'global') {
      filters.isGlobal = true;
    } else if (type === 'first-booking') {
      filters.isFirstBooking = true;
    } else if (type === 'assigned') {
      filters.assignedTo = { $ne: null };
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(filters)
        .populate('usedBy.user', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(filters)
    ]);

    res.json({
      success: true,
      count: coupons.length,
      data: coupons,
      pagination: {
        total,
        page: pageNum,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    global.logger.error(`[CouponController.getAllCoupons] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};


// Update coupon
const updateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Clean up assignedTo if empty string
    if (updateData.assignedTo === "" || updateData.assignedTo === undefined) {
      updateData.assignedTo = null;
    }

    // Check if coupon exists
    const existingCoupon = await Coupon.findById(id);
    if (!existingCoupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid Coupon '
      });
    }

    // Restrict modifications if used
    if (existingCoupon.usedBy && existingCoupon.usedBy.length > 0) {
      const restrictedFields = ['code', 'discountType', 'discountValue', 'isGlobal', 'isFirstBooking'];
      restrictedFields.forEach(field => {
        if (field in updateData) {
          delete updateData[field];
        }
      });
    }

    // Convert fields
    if (updateData.expiryDate) {
      updateData.expiryDate = new Date(updateData.expiryDate);
    }
    if (updateData.discountValue) {
      updateData.discountValue = Number(updateData.discountValue);
    }
    if (updateData.minBookingValue) {
      updateData.minBookingValue = Number(updateData.minBookingValue);
    }
    if (updateData.usageLimit) {
      updateData.usageLimit = Number(updateData.usageLimit);
    }

    // Perform update
    Object.assign(existingCoupon, updateData);
    await existingCoupon.save();

    const updatedCoupon = await Coupon.findById(id)
      .populate('assignedTo', 'name email totalBookings')
      .populate('usedBy.user', 'name email');

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: updatedCoupon
    });
  } catch (error) {
    global.logger.error(`[CouponController.updateCoupon] Route: ${req.originalUrl || req.url} - Update coupon error: ${error.message}`, error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map(val => val.message).join(', ')
      });
    } else if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Coupon code already exists'
      });
    }

    next(error);
  }
};


// Activate / Deactivate coupon (toggle)
const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid Coupon ',
      });
    }

    // Toggle isActive
    coupon.isActive = !coupon.isActive;
    await coupon.save();

    res.json({
      success: true,
      message: coupon.isActive
        ? 'Coupon activated successfully'
        : 'Coupon deactivated successfully',
      data: {
        isActive: coupon.isActive,
      },
    });
  } catch (error) {
    global.logger.error(`[CouponController.deleteCoupon] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// Hard delete coupon
const hardDeleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid Coupon ',
      });
    }

    const now = new Date();
    const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < now;
    const isDeactivated = coupon.isActive === false;

    if (!isDeactivated && !isExpired) {
      return res.status(400).json({
        success: false,
        message: 'Only deactivated or expired coupons can be permanently deleted',
      });
    }

    global.logger.info(`Deleting coupon: ${coupon.code}`);

    await Coupon.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Coupon permanently deleted',
    });
  } catch (error) {
    global.logger.error(`[CouponController.hardDeleteCoupon] Route: ${req.originalUrl || req.url} - Error: ${error.message}`, error);
    next(error);
  }
};

// USER CONTROLLERS

// Validate and apply coupon
const applyCoupon = async (req, res) => {
  try {
    const { code, bookingValue, bookingData } = req.body;
    const userId = req.user.id;

    let bookingZoneId = null;
    if (bookingData) {
      if (bookingData.zoneId && bookingData.zoneId !== 'null' && bookingData.zoneId !== 'undefined') {
        bookingZoneId = bookingData.zoneId;
      }

      if (!bookingZoneId && bookingData.address) {
        const lat = parseFloat(bookingData.address.lat);
        const lng = parseFloat(bookingData.address.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          const Zone = require('../models/Zone-model');
          const detectedZone = await Zone.findZoneByCoordinates(lat, lng);
          if (detectedZone) {
            bookingZoneId = detectedZone._id;
          }
        }
      }
    }

    const coupon = await Coupon.validateCoupon(userId, code, bookingValue, bookingZoneId);
    const discountDetails = coupon.applyCoupon(bookingValue);

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        coupon: {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          formattedDiscount: coupon.formattedDiscount
        },
        discountAmount: discountDetails.discount,
        finalAmount: discountDetails.finalAmount,
        appliedZoneId: coupon.matchedZoneId || bookingZoneId || null
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const markCouponUsed = async (req, res) => {
  try {
    const { code, bookingValue } = req.body;
    const userId = req.user.id;

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid Coupon '
      });
    }

    await coupon.markAsUsed(userId, bookingValue);

    res.json({
      success: true,
      message: 'Coupon marked as used'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const getAvailableCoupons = async (req, res, next) => {
  try {
    const { bookingValue, zoneId } = req.query;
    const userId = req.user?.id; // safe check

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User ID missing' });
    }

    const coupons = await Coupon.getAvailableCoupons(userId, Number(bookingValue) || 0, zoneId || null);

    res.json({
      success: true,
      count: coupons.length,
      data: coupons
    });
  } catch (error) {
    global.logger.error(`[CouponController.getAvailableCoupons] Route: ${req.originalUrl || req.url} - Get Available Coupons Error: ${error.message}`, error);
    next(error);
  }
};


module.exports = {
  createCoupon,
  getAllCoupons,
  updateCoupon,
  deleteCoupon,
  hardDeleteCoupon,
  applyCoupon,
  markCouponUsed,
  getAvailableCoupons
};