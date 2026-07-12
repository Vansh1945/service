const mongoose = require('mongoose');
const Service = require('../models/Service-model');
const Coupon = require('../models/Coupon-model');
const { SystemConfig } = require('../models/SystemSetting');

class PricingService {
  /**
   * Calculates a complete price estimate for a booking.
   * Excludes GST calculations.
   */
  static async calculatePriceEstimate({
    serviceId,
    quantity = 1,
    couponCode,
    date,
    time,
    lat,
    lng,
    isEmergency = false,
    isInstant = false,
    userId,
    session = null
  }) {
    const ZoneModel = mongoose.model('Zone');
    const SurgeModel = mongoose.model('Surge');

    // 1. Fetch Service, Zone, Surges, and Config in parallel
    const promises = [
      session ? Service.findById(serviceId).session(session).lean() : Service.findById(serviceId).lean(),
      (typeof lat === 'number' && typeof lng === 'number') ? ZoneModel.findZoneByCoordinates(lat, lng) : null,
      session ? SurgeModel.find({ active: true }).session(session).lean() : SurgeModel.find({ active: true }).lean(),
      session ? SystemConfig.findOne().session(session).lean() : SystemConfig.findOne().lean(),
      session ? ZoneModel.find({ status: 'active' }).select('_id parentZone').session(session).lean() : ZoneModel.find({ status: 'active' }).select('_id parentZone').lean()
    ];

    let [service, detectedZone, allActiveSurges, settings, allActiveZones] = await Promise.all(promises);

    if (!service) {
      throw new Error('Service not found');
    }

    // 2. Resolve Booking Zone from Coordinates
    if (!detectedZone) {
      throw new Error('Selected address is outside our active service zones');
    }
    const detectedZoneId = detectedZone._id;

    if (!settings) {
      settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
      if (session) {
        await settings.save({ session });
      } else {
        await settings.save();
      }
    }

    // 4. Calculate Subtotal
    const subtotal = (service.discountPrice || service.basePrice) * quantity;

    // 5. Process Coupon
    let totalDiscount = 0;
    let couponDetails = null;
    if (couponCode) {
      try {
        const coupon = await Coupon.validateCoupon(userId, couponCode, subtotal, detectedZoneId);
        let discount = 0;
        if (coupon.discountType === 'percent') {
          discount = (subtotal * coupon.discountValue) / 100;
        } else {
          discount = coupon.discountValue;
        }
        totalDiscount = parseFloat(discount.toFixed(2));
        couponDetails = {
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          appliedZone: coupon.matchedZoneId || detectedZoneId || null
        };
      } catch (err) {
        // Log coupon validation error, but do not block estimation if coupon is invalid
        console.error('Coupon validation failed in PricingService:', err.message);
      }
    }

    // 6. Resolve Zone Ancestry in memory (no extra DB queries!)
    const zoneAncestry = [];
    if (detectedZoneId) {
      zoneAncestry.push(detectedZoneId.toString());
      let currentParentId = detectedZone.parentZone ? detectedZone.parentZone.toString() : null;
      while (currentParentId) {
        zoneAncestry.push(currentParentId);
        const parentZone = allActiveZones.find(z => z._id.toString() === currentParentId);
        currentParentId = (parentZone && parentZone.parentZone) ? parentZone.parentZone.toString() : null;
      }
    }

    // 7. Time helper for surges
    const isTimeInWindow = (timeStr, start, end) => {
      if (!start || !end) return true;
      const parseTime = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
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

    const currentTimeStr = time || new Date().toTimeString().substring(0, 5); // "HH:MM"

    // 8. Calculate Surges
    let totalSurcharge = 0;
    const surchargeBreakdown = [];
    let rainCharge = 0;
    let trafficCharge = 0;
    let nightCharge = 0;
    let demandSurge = 0;
    let visitingCharge = 0;
    let customCharges = 0;
    let platformFee = 0;
    let emergencySurge = 0;

    const applicableSurges = allActiveSurges.filter(rule => {
      if (rule.scope === 'zone') {
        if (!rule.zoneId || !zoneAncestry.includes(rule.zoneId.toString())) {
          return false;
        }
      }
      if (!isTimeInWindow(currentTimeStr, rule.startTime, rule.endTime)) {
        return false;
      }
      if (rule.maxBookingValue && subtotal > rule.maxBookingValue) {
        return false;
      }
      return true;
    });

    applicableSurges.forEach(s => {
      let chargeAmount = 0;
      if (s.mode === 'flat') {
        chargeAmount = s.value;
      } else if (s.mode === 'percentage') {
        chargeAmount = (subtotal * s.value) / 100;
      } else if (s.mode === 'multiplier') {
        chargeAmount = subtotal * (s.value - 1);
      }
      chargeAmount = parseFloat(chargeAmount.toFixed(2));

      if (s.chargeType === 'rain') {
        rainCharge += chargeAmount;
        totalSurcharge += chargeAmount;
      } else if (s.chargeType === 'traffic') {
        trafficCharge += chargeAmount;
        totalSurcharge += chargeAmount;
      } else if (s.chargeType === 'night') {
        nightCharge += chargeAmount;
        totalSurcharge += chargeAmount;
      } else if (s.chargeType === 'demand') {
        demandSurge += chargeAmount;
        totalSurcharge += chargeAmount;
      } else if (s.chargeType === 'platform') {
        platformFee += chargeAmount;
        totalSurcharge += chargeAmount;
      } else if (s.chargeType === 'visiting') {
        const shouldCharge = !isEmergency || settings?.bookingSettings?.chargeVisitingOnEmergency;
        if (shouldCharge) {
          visitingCharge += chargeAmount;
          totalSurcharge += chargeAmount;
        } else {
          chargeAmount = 0;
        }
      } else if (s.chargeType === 'festival' || s.chargeType === 'custom') {
        if (isEmergency) {
          chargeAmount = 0;
        } else {
          visitingCharge += chargeAmount;
          totalSurcharge += chargeAmount;
        }
      }

      if (chargeAmount > 0) {
        surchargeBreakdown.push({
          chargeType: s.chargeType,
          mode: s.mode,
          value: s.value,
          amount: chargeAmount
        });
      }
    });

    if (isEmergency) {
      const emergencySurgeCharge = settings?.bookingSettings?.emergencySurgeCharge || 0;
      if (emergencySurgeCharge > 0) {
        emergencySurge = emergencySurgeCharge;
        totalSurcharge += emergencySurge;
        surchargeBreakdown.push({
          chargeType: 'emergency',
          mode: 'flat',
          value: emergencySurgeCharge,
          amount: emergencySurge
        });
      }
    }

    const totalAmount = Math.max(0, subtotal - totalDiscount + totalSurcharge);

    const pricingBreakdown = {
      servicePrice: subtotal,
      visitingCharges: visitingCharge,
      emergencyCharges: emergencySurge,
      surgeCharges: rainCharge + trafficCharge + nightCharge + demandSurge + customCharges + platformFee,
      discount: totalDiscount,
      walletUsed: 0,
      platformCommission: 0,
      providerEarnings: 0,
      platformEarnings: 0,
      customerTotal: totalAmount,
      cashRemaining: totalAmount, // Initial default
      onlinePaid: 0,
      finalAmount: totalAmount
    };

    return {
      subtotal,
      totalDiscount,
      couponDetails,
      rainCharge,
      trafficCharge,
      nightCharge,
      demandSurge,
      visitingCharge,
      platformFee,
      customCharges,
      emergencySurge,
      totalSurcharge,
      surchargeBreakdown,
      totalAmount,
      detectedZoneId,
      pricingBreakdown
    };
  }
}

module.exports = PricingService;
