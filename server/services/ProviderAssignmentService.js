const mongoose = require('mongoose');
const Provider = require('../models/Provider-model');
const Booking = require('../models/Booking-model');
const Transaction = require('../models/Transaction-model');
const { sendNotification } = require('../utils/notificationHelper');
const { calculateDistance } = require('../utils/geoUtils');
const { latLngToS2CellId, getNeighbors } = require('../utils/s2Helper');

const getAbsoluteIstDate = (dateObj, timeStr) => {
  const d = new Date(dateObj);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();

  let h = 12; // default to noon
  let m = 0;
  if (timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length >= 2) {
      h = parts[0];
      m = parts[1];
    }
  }
  // Convert IST (h:m) to UTC by subtracting 5 hours and 30 minutes
  return new Date(Date.UTC(year, month, day, h - 5, m - 30, 0, 0));
};

const checkProviderOverlap = (newBooking, providerBookings, defaultBufferMinutes = 30) => {
  const newStart = getAbsoluteIstDate(newBooking.date, newBooking.time);

  let newDurationMs = 60 * 60 * 1000; // 1 hour default
  if (newBooking.estimatedDuration !== null && newBooking.estimatedDuration !== undefined) {
    newDurationMs = newBooking.estimatedDuration * 60 * 1000;
  } else if (newBooking.services && newBooking.services.length > 0) {
    const firstService = newBooking.services[0];
    const durationHours = firstService.service?.duration || firstService.serviceDetails?.duration || 1;
    newDurationMs = durationHours * 60 * 60 * 1000;
  }

  const newBufferMs = (newBooking.travelBufferMinutes !== null && newBooking.travelBufferMinutes !== undefined)
    ? newBooking.travelBufferMinutes * 60 * 1000
    : defaultBufferMinutes * 60 * 1000;

  const newEnd = new Date(newStart.getTime() + newDurationMs + newBufferMs);

  for (const pb of providerBookings) {
    const start = getAbsoluteIstDate(pb.date, pb.time);

    let durationMs = 60 * 60 * 1000;
    if (pb.estimatedDuration !== null && pb.estimatedDuration !== undefined) {
      durationMs = pb.estimatedDuration * 60 * 1000;
    } else if (pb.services && pb.services.length > 0) {
      const firstService = pb.services[0];
      const durationHours = firstService.service?.duration || firstService.serviceDetails?.duration || 1;
      durationMs = durationHours * 60 * 60 * 1000;
    }

    const bufferMs = (pb.travelBufferMinutes !== null && pb.travelBufferMinutes !== undefined)
      ? pb.travelBufferMinutes * 60 * 1000
      : defaultBufferMinutes * 60 * 1000;

    const end = new Date(start.getTime() + durationMs + bufferMs);

    if (newStart < end && start < newEnd) {
      return true;
    }
  }
  return false;
};

const getBookingAddressLocation = (booking) => {
  if (booking.location && booking.location.coordinates &&
    booking.location.coordinates.length === 2 &&
    (booking.location.coordinates[0] !== 0 || booking.location.coordinates[1] !== 0)) {
    return {
      latitude: booking.location.coordinates[1],
      longitude: booking.location.coordinates[0]
    };
  }
  if (booking.statusHistory) {
    for (const history of booking.statusHistory) {
      if (history.note) {
        const match = history.note.match(/TARGET_LOCATION:([-\d.]+),([-\d.]+)/);
        if (match) {
          return {
            latitude: parseFloat(match[1]),
            longitude: parseFloat(match[2])
          };
        }
      }
    }
  }
  const address = booking.address || {};
  const lat = parseFloat(address.lat);
  const lng = parseFloat(address.lng);
  if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
    return { latitude: lat, longitude: lng };
  }
  return null;
};

class ProviderAssignmentService {
  static async findEligibleProviders({ bookingType, serviceCategory, lat, lng, zoneId, trustedProviderOnly }) {
  try {
    const { SystemConfig } = require('../models/SystemSetting-model');
    let settings = await SystemConfig.findOne();
    if (!settings) {
      settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
      await settings.save();
    }

    const isEmergency = bookingType === 'emergency';
    const isInstant = bookingType === 'instant';
    const isScheduled = !isEmergency && !isInstant;
    const isTrustedOnly = !!(trustedProviderOnly || isEmergency);

    let isAutoAssignEnabled = false;
    if (isEmergency) {
      isAutoAssignEnabled = settings.bookingSettings?.autoAssignEmergency !== false;
    } else if (isInstant) {
      isAutoAssignEnabled = settings.bookingSettings?.autoAssignInstant !== false;
    } else {
      isAutoAssignEnabled = settings.bookingSettings?.autoAssignProvider !== false && settings.bookingSettings?.autoAssignScheduled !== false;
    }

    if (!isAutoAssignEnabled && (isEmergency || isInstant)) {
      return [];
    }

    let maxDistanceKm = settings.bookingSettings?.autoAssignRadius || 15;
    const maxDistanceMeters = maxDistanceKm * 1000;

    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      return [];
    }

    const categoryStr = serviceCategory?._id ? serviceCategory._id.toString() : serviceCategory?.toString();
    const bookingServicesCategories = categoryStr ? [categoryStr] : [];

    const baseProviderQuery = {
      role: 'provider',
      isActive: true,
      approved: true,
      isOnline: true,
      isSuspended: { $ne: true },
      kycStatus: 'approved',
      $or: [
        { blockedTill: { $exists: false } },
        { blockedTill: null },
        { blockedTill: { $lte: new Date() } }
      ],
      'performanceScore.restrictionsActive': { $ne: true }
    };

    if (bookingServicesCategories.length > 0) {
      baseProviderQuery.services = { $all: bookingServicesCategories };
    }

    const bookingS2CellId = latLngToS2CellId(lat, lng, 13);
    if (bookingS2CellId) {
      const s2CellIds = [bookingS2CellId, ...getNeighbors(bookingS2CellId)];
      baseProviderQuery.$and = [
        {
          $or: [
            { s2CellId: { $in: s2CellIds } },
            { 'currentLocation.s2CellId': { $in: s2CellIds } },
            { 'address.s2CellId': { $in: s2CellIds } }
          ]
        }
      ];
    }

    const eligibleProviders = await Provider.find(baseProviderQuery);
    if (!eligibleProviders || eligibleProviders.length === 0) {
      return [];
    }

    const providersWithDetails = eligibleProviders.map(p => {
      const pLng = p.currentLocation?.coordinates?.[0];
      const pLat = p.currentLocation?.coordinates?.[1];
      let dist = Infinity;
      if (typeof pLat === 'number' && typeof pLng === 'number' && (pLat !== 0 || pLng !== 0)) {
        dist = calculateDistance(lat, lng, pLat, pLng);
      }
      return { provider: p, distance: dist };
    }).filter(item => item.distance <= maxDistanceMeters);

    if (providersWithDetails.length === 0) {
      return [];
    }

    const providerIds = providersWithDetails.map(item => item.provider._id);
    const activeBookings = await Booking.find({
      provider: { $in: providerIds },
      status: { $in: ['accepted', 'in-progress', 'started', 'confirmed', 'scheduled', 'assigned'] }
    }).select('provider date time services');

    const workloadMap = {};
    const providerBookingsMap = {};
    providerIds.forEach(id => {
      workloadMap[id.toString()] = 0;
      providerBookingsMap[id.toString()] = [];
    });
    activeBookings.forEach(b => {
      if (b.provider) {
        const pId = b.provider.toString();
        workloadMap[pId] = (workloadMap[pId] || 0) + 1;
        providerBookingsMap[pId].push(b);
      }
    });

    const maxBookings = settings?.bookingSettings?.maxBookingsPerProvider ?? 10;
    const bufferMinutes = settings?.bookingSettings?.bookingBufferTime ?? 30;

    let strategy = 'scheduled';
    if (isEmergency || isTrustedOnly) {
      strategy = 'emergency';
    } else if (isInstant) {
      strategy = 'instant';
    }

    const mockBooking = {
      bookingType,
      isEmergency,
      isInstant,
      services: serviceCategory ? [{ service: { category: serviceCategory } }] : []
    };

    const scoredProviders = providersWithDetails.map(item => {
      const p = item.provider;
      const pIdStr = p._id.toString();
      const workload = workloadMap[pIdStr] || 0;

      if (workload >= maxBookings) return null;

      if (strategy === 'emergency' || strategy === 'instant') {
        if (p.isOnline !== true || p.availabilityStatus !== 'online') {
          return null;
        }
      }

      if (strategy === 'emergency' && p.emergencyBookingEnabled === false) return null;
      if (strategy === 'instant' && p.instantBookingEnabled === false) return null;
      if (strategy === 'scheduled' && p.scheduledBookingEnabled === false) return null;

      if (isTrustedOnly && p.trustedProvider !== true) return null;

      const rules = settings?.bookingSettings?.trustedProviderRules;
      if (rules && (strategy === 'emergency' || isTrustedOnly)) {
        const pRating = p.performanceScore?.averageRating || p.performanceScore?.rating || 5;
        if (rules.minRating && pRating < rules.minRating) return null;
        const pCompleted = p.completedBookings || 0;
        if (rules.minCompletedJobs && pCompleted < rules.minCompletedJobs) return null;
        const pCancelRate = p.performanceScore?.cancellationRate || p.performanceScore?.cancellationRatio || 0;
        if (rules.maxCancellationRate && pCancelRate > rules.maxCancellationRate) return null;
        const pCompletionRate = p.performanceScore?.completionRate || p.performanceScore?.completionPercentage || 100;
        if (rules.minCompletionRate && pCompletionRate < rules.minCompletionRate) return null;
        const pComplaintRate = p.performanceScore?.complaintRatio || 0;
        if (rules.maxComplaintRate && pComplaintRate > rules.maxComplaintRate) return null;
        const pResponseTimeSec = p.performanceScore?.responseTime || 0;
        const pResponseTimeMin = pResponseTimeSec / 60;
        if (rules.providerResponseTimeMinutes && pResponseTimeMin > rules.providerResponseTimeMinutes) return null;
      }

      const providerBookings = providerBookingsMap[pIdStr] || [];
      if (checkProviderOverlap(mockBooking, providerBookings, bufferMinutes)) return null;

      return item.provider;
    }).filter(Boolean);

    return scoredProviders;
  } catch (err) {
    console.error('[ProviderAssignmentService.findEligibleProviders] Error:', err);
    return [];
  }
}

  static async autoAssignProviderIfEnabled(bookingId) {
  try {
    const { SystemConfig } = require('../models/SystemSetting-model');
    let settings = await SystemConfig.findOne();
    if (!settings) {
      settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
      await settings.save();
    }

    const booking = await Booking.findById(bookingId).populate('services.service');
    if (!booking || booking.provider) {
      return null;
    }

    // EMERGENCY BOOKING ENGINE UPGRADE
    const isEmergency = booking.bookingType === 'emergency' || booking.isEmergency;
    const isInstant = booking.bookingType === 'instant' || booking.isInstant;
    const isScheduled = !isEmergency && !isInstant;

    let isAutoAssignEnabled = false;
    if (isEmergency) {
      isAutoAssignEnabled = settings.bookingSettings?.autoAssignEmergency !== false;
    } else if (isInstant) {
      isAutoAssignEnabled = settings.bookingSettings?.autoAssignInstant !== false;
    } else {
      isAutoAssignEnabled = settings.bookingSettings?.autoAssignProvider !== false && settings.bookingSettings?.autoAssignScheduled !== false;
    }

    if (!isAutoAssignEnabled) {
      if (isEmergency || isInstant) {
        await ProviderAssignmentService.escalateToAdmin(booking._id, isEmergency ? 'Emergency auto-assign disabled' : 'Instant auto-assign disabled');
      } else {
        if (booking && !booking.provider) {
          const { triggerEventNotification } = require('../utils/notificationHelper');
          await triggerEventNotification('booking_created', {
            serviceName: booking.services?.[0]?.serviceDetails?.title || 'service',
            street: booking.address?.street || 'your area',
            booking
          });
        }
      }
      return null;
    }
    // END EMERGENCY BOOKING ENGINE UPGRADE

    let maxDistanceKm = settings.bookingSettings.autoAssignRadius || 15;
    if (isInstant && booking.metadata?.ignoredProviders?.length > 0) {
      maxDistanceKm += (booking.metadata.ignoredProviders.length * 10);
      maxDistanceKm = Math.min(maxDistanceKm, 50);
    }
    const maxDistanceMeters = maxDistanceKm * 1000;

    let lat = booking.address?.lat;
    let lng = booking.address?.lng;

    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      const coords = getBookingAddressLocation(booking);
      lat = coords?.latitude;
      lng = coords?.longitude;
    }

    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      console.warn(`[AutoAssign] Skipped auto-assign for booking ${booking._id}: Coordinates missing`);
      return null;
    }

    const bookingServicesCategories = booking.services.map(item => {
      const cat = item.service?.category;
      return cat?._id ? cat._id.toString() : cat?.toString();
    }).filter(Boolean);

    const baseProviderQuery = {
      _id: { $nin: booking.metadata?.ignoredProviders || [] },
      role: 'provider',
      isActive: true,
      approved: true,
      isOnline: true,
      isSuspended: { $ne: true },
      kycStatus: 'approved',
      $or: [
        { blockedTill: { $exists: false } },
        { blockedTill: null },
        { blockedTill: { $lte: new Date() } }
      ],
      'performanceScore.restrictionsActive': { $ne: true },
      services: { $all: bookingServicesCategories }
    };

    const bookingS2CellId = latLngToS2CellId(lat, lng, 13);
    if (bookingS2CellId) {
      const s2CellIds = [bookingS2CellId, ...getNeighbors(bookingS2CellId)];
      baseProviderQuery.$and = [
        {
          $or: [
            { s2CellId: { $in: s2CellIds } },
            { 'currentLocation.s2CellId': { $in: s2CellIds } },
            { 'address.s2CellId': { $in: s2CellIds } }
          ]
        }
      ];
    }

    let selectedProvider = null;
    let selectedSource = null;

    const ZoneModel = mongoose.model('Zone');
    let bookingZoneId = booking.zoneId;
    if (!bookingZoneId) {
      const detectedZone = await ZoneModel.findZoneByCoordinates(lat, lng);
      if (detectedZone) {
        bookingZoneId = detectedZone._id;
        booking.zoneId = detectedZone._id;
      }
    }

    const adjacentZoneIds = [];
    const parentZoneIds = [];
    const childZoneIds = [];

    if (bookingZoneId) {
      const bookingZone = await ZoneModel.findById(bookingZoneId).lean();
      if (bookingZone) {
        if (bookingZone.adjacentZones && bookingZone.adjacentZones.length > 0) {
          bookingZone.adjacentZones.forEach(id => adjacentZoneIds.push(id.toString()));
        }
        let curr = bookingZone;
        while (curr && curr.parentZone) {
          parentZoneIds.push(curr.parentZone.toString());
          curr = await ZoneModel.findById(curr.parentZone).lean();
        }
        const childZones = await ZoneModel.find({ parentZone: bookingZoneId }).select('_id').lean();
        if (childZones && childZones.length > 0) {
          childZones.forEach(z => childZoneIds.push(z._id.toString()));
        }
      }
    }

    const eligibleProviders = await Provider.find(baseProviderQuery);

    if (eligibleProviders.length > 0) {
      const providersWithDetails = eligibleProviders.map(p => {
        const pLng = p.currentLocation?.coordinates?.[0];
        const pLat = p.currentLocation?.coordinates?.[1];
        let dist = Infinity;
        if (typeof pLat === 'number' && typeof pLng === 'number' && (pLat !== 0 || pLng !== 0)) {
          dist = calculateDistance(lat, lng, pLat, pLng);
        }
        return { provider: p, distance: dist };
      }).filter(item => item.distance <= maxDistanceMeters);

      if (providersWithDetails.length > 0) {
        const providerIds = providersWithDetails.map(item => item.provider._id);
        const activeBookings = await Booking.find({
          provider: { $in: providerIds },
          status: { $in: ['accepted', 'in-progress', 'started', 'confirmed', 'scheduled', 'assigned'] }
        }).select('provider date time services');

        const workloadMap = {};
        const providerBookingsMap = {};
        providerIds.forEach(id => {
          workloadMap[id.toString()] = 0;
          providerBookingsMap[id.toString()] = [];
        });
        activeBookings.forEach(b => {
          if (b.provider) {
            const pId = b.provider.toString();
            workloadMap[pId] = (workloadMap[pId] || 0) + 1;
            providerBookingsMap[pId].push(b);
          }
        });

        const maxBookings = settings?.bookingSettings?.maxBookingsPerProvider ?? 10;
        const bufferMinutes = settings?.bookingSettings?.bookingBufferTime ?? 30;

        const isEmergency = booking.bookingType === 'emergency' || booking.isEmergency;
        const isInstant = booking.bookingType === 'instant' || booking.isInstant;
        const isTrustedOnly = !!booking.trustedProviderOnly;

        let strategy = 'scheduled';
        if (isEmergency || isTrustedOnly) {
          strategy = 'emergency';
        } else if (isInstant) {
          strategy = 'instant';
        }

        const scoredProviders = providersWithDetails.map(item => {
          const p = item.provider;
          const pIdStr = p._id.toString();
          const workload = workloadMap[pIdStr] || 0;

          // 1. Basic workload capacity check
          if (workload >= maxBookings) {
            return null;
          }

          // 2. Online & status check
          if (strategy === 'emergency' || strategy === 'instant') {
            if (p.isOnline !== true || p.availabilityStatus !== 'online') {
              return null;
            }
          }

          // 3. Permissions check
          if (strategy === 'emergency' && p.emergencyBookingEnabled === false) {
            return null;
          }
          if (strategy === 'instant' && p.instantBookingEnabled === false) {
            return null;
          }
          if (strategy === 'scheduled' && p.scheduledBookingEnabled === false) {
            return null;
          }

          // 4. Trusted provider constraint
          if (isTrustedOnly && p.trustedProvider !== true) {
            return null;
          }

          // 4.5. Trusted Provider Rules Validation
          const rules = settings?.bookingSettings?.trustedProviderRules;
          if (rules) {
            const pRating = p.performanceScore?.averageRating || p.performanceScore?.rating || 5;
            if (rules.minRating && pRating < rules.minRating) {
              return null;
            }
            const pCompleted = p.completedBookings || 0;
            if (rules.minCompletedJobs && pCompleted < rules.minCompletedJobs) {
              return null;
            }
            const pCancelRate = p.performanceScore?.cancellationRate || p.performanceScore?.cancellationRatio || 0;
            if (rules.maxCancellationRate && pCancelRate > rules.maxCancellationRate) {
              return null;
            }
            const pCompletionRate = p.performanceScore?.completionRate || p.performanceScore?.completionPercentage || 100;
            if (rules.minCompletionRate && pCompletionRate < rules.minCompletionRate) {
              return null;
            }
            const pComplaintRate = p.performanceScore?.complaintRatio || 0;
            if (rules.maxComplaintRate && pComplaintRate > rules.maxComplaintRate) {
              return null;
            }
            const pResponseTimeSec = p.performanceScore?.responseTime || 0;
            const pResponseTimeMin = pResponseTimeSec / 60;
            if (rules.providerResponseTimeMinutes && pResponseTimeMin > rules.providerResponseTimeMinutes) {
              return null;
            }
          }

          // 5. Calendar conflict check (using custom duration & buffers)
          const providerBookings = providerBookingsMap[pIdStr] || [];
          if (checkProviderOverlap(booking, providerBookings, bufferMinutes)) {
            return null;
          }

          const pZoneStr = p.currentZone ? p.currentZone.toString() : null;
          let tier = 3;

          if (bookingZoneId && pZoneStr) {
            if (pZoneStr === bookingZoneId.toString()) {
              tier = 1;
            } else if (
              adjacentZoneIds.includes(pZoneStr) ||
              parentZoneIds.includes(pZoneStr) ||
              childZoneIds.includes(pZoneStr)
            ) {
              tier = 2;
            }
          }

          return {
            ...item,
            tier,
            workload
          };
        }).filter(Boolean);

        if (strategy === 'emergency' || strategy === 'instant') {
          // Priority 1 & 2: Nearest available provider
          scoredProviders.sort((a, b) => a.distance - b.distance);
        } else {
          // Priority 3: Scheduled / Existing logic
          scoredProviders.sort((a, b) => {
            if (a.tier !== b.tier) {
              return a.tier - b.tier;
            }
            if (a.distance !== b.distance) {
              return a.distance - b.distance;
            }
            if (a.workload !== b.workload) {
              return a.workload - b.workload;
            }
            // Onboarding priority listing boost
            const priorityA = (a.provider.onboardingPriorityExpiresAt && new Date(a.provider.onboardingPriorityExpiresAt) > new Date()) ? 1 : 0;
            const priorityB = (b.provider.onboardingPriorityExpiresAt && new Date(b.provider.onboardingPriorityExpiresAt) > new Date()) ? 1 : 0;
            if (priorityB !== priorityA) {
              return priorityB - priorityA;
            }
            const ratingA = a.provider.performanceScore?.rating || 0;
            const ratingB = b.provider.performanceScore?.rating || 0;
            if (ratingB !== ratingA) {
              return ratingB - ratingA;
            }
            return 0;
          });
        }

        if (scoredProviders.length > 0) {
          const matched = scoredProviders[0];
          selectedProvider = matched.provider;

          const pZoneStr = selectedProvider.currentZone ? selectedProvider.currentZone.toString() : null;
          if (matched.tier === 1) {
            selectedSource = 'Same Zone';
          } else if (matched.tier === 2) {
            if (pZoneStr && adjacentZoneIds.includes(pZoneStr)) {
              selectedSource = 'Adjacent Zone';
            } else if (pZoneStr && parentZoneIds.includes(pZoneStr)) {
              selectedSource = 'Parent Zone';
            } else if (pZoneStr && childZoneIds.includes(pZoneStr)) {
              selectedSource = 'Child Zone';
            } else {
              selectedSource = 'Adjacent Zone';
            }
          } else {
            selectedSource = 'Distance-based Fallback';
          }
        }
      }
    }

    if (!selectedProvider) {
      console.log(`[AutoAssign] No nearby or zone providers found for booking ${booking._id} within ${maxDistanceKm}km`);
      // EMERGENCY BOOKING ENGINE UPGRADE
      if (isEmergency || isInstant) {
        await ProviderAssignmentService.escalateToAdmin(booking._id, 'No nearby providers found');
      }
      // END EMERGENCY BOOKING ENGINE UPGRADE
      return null;
    }

    const nearestProvider = selectedProvider;

    // EMERGENCY BOOKING ENGINE UPGRADE
    if (isEmergency || isInstant) {
      booking.provider = nearestProvider._id;
      booking.assignmentSource = selectedSource;
      booking.status = 'pending';
      booking.providerAcceptanceStatus = 'pending';

      const responseTimeoutSec = isEmergency
        ? (settings.bookingSettings?.emergencyResponseTime || 60)
        : 120; // 120s for instant

      booking.providerResponseDeadline = new Date(Date.now() + responseTimeoutSec * 1000);
      booking.updatedAt = new Date();
      if (!booking.metadata) booking.metadata = {};
      booking.metadata.assignedAt = new Date();

      booking.statusHistory.push({
        status: 'pending',
        timestamp: new Date(),
        note: `Auto-assigned candidate provider: ${nearestProvider.name}. Waiting for provider acceptance within ${responseTimeoutSec} seconds.`,
        updatedBy: 'system'
      });

      await booking.save();

      // Start Provider Response Timer
      setTimeout(async () => {
        try {
          const currentBooking = await Booking.findById(booking._id);
          if (currentBooking && currentBooking.status === 'pending' && currentBooking.provider?.toString() === nearestProvider._id.toString() && currentBooking.providerAcceptanceStatus === 'pending') {
            console.log(`[Provider Timeout] Provider ${nearestProvider.name} failed to respond to booking ${booking._id} in time. Escalating...`);
            await ProviderAssignmentService.escalateToAdmin(booking._id, 'Provider response timeout');
          }
        } catch (err) {
          console.error('Error in Provider Response Timer:', err);
        }
      }, responseTimeoutSec * 1000);

      try {
        const { triggerEventNotification, sendNotification } = require('../utils/notificationHelper');

        await triggerEventNotification('booking_created', {
          serviceName: booking.services?.[0]?.serviceDetails?.title || 'service',
          street: booking.address?.street || 'your area',
          booking
        }, nearestProvider._id);

        sendNotification(
          nearestProvider._id,
          'provider',
          isEmergency ? '🚨 Emergency Booking Request' : '⚡ Instant Booking Request',
          `New ${booking.bookingType || 'Instant'} request. Please accept within ${responseTimeoutSec} seconds.`,
          'booking',
          booking._id
        );

        const { getIO } = require('../socket/socketServer');
        const io = getIO();
        if (io) {
          // Broadcast emergency/instant alerts to candidate provider
          io.to(`provider_${nearestProvider._id}`).emit('new-booking-offer', {
            bookingId: booking._id,
            bookingType: booking.bookingType || (isEmergency ? 'emergency' : 'instant'),
            priority: isEmergency ? 'critical' : 'medium',
            deadline: booking.providerResponseDeadline,
            distance: matched ? matched.distance : 0,
            totalAmount: booking.totalAmount
          });

          io.to('admin_live_room').emit('admin-booking-update', {
            bookingId: booking._id,
            event: 'provider-offered',
            providerId: nearestProvider._id,
            status: 'pending'
          });
        }
      } catch (socketErr) {
        console.error('Error sending offered sockets/notifications:', socketErr);
      }

      console.log(`[AutoAssign] Booking ${booking._id} offered to candidate provider ${nearestProvider.name}`);
      return nearestProvider;
    }
    // END EMERGENCY BOOKING ENGINE UPGRADE

    booking.provider = nearestProvider._id;
    booking.assignmentSource = selectedSource;
    booking.status = 'accepted';
    booking.updatedAt = new Date();
    if (!booking.metadata) booking.metadata = {};
    booking.metadata.assignedAt = new Date();

    booking.statusHistory.push({
      status: 'accepted',
      timestamp: new Date(),
      note: `Booking assigned to nearest provider: ${nearestProvider.name}.`,
      updatedBy: 'system'
    });

    await booking.save();

    try {
      await Provider.findByIdAndUpdate(nearestProvider._id, {
        activeBooking: booking._id,
        lastUpdated: new Date()
      });
    } catch (e) {
      console.error('Error updating provider activeBooking:', e);
    }

    try {
      const isOnline = booking.paymentMethod?.toLowerCase() === 'online' || booking.paymentMethod?.toLowerCase() === 'upi';
      await Transaction.updateMany(
        { booking: booking._id },
        {
          provider: booking.provider,
          providerId: booking.provider.toString(),
          commission: booking.commissionAmount || 0,
          providerEarning: booking.providerEarnings || 0,
          commissionRule: booking.commissionRule,
          ...((booking.paymentStatus === 'paid' || booking.paymentStatus === 'escrow_hold') && {
            paymentStatus: isOnline ? 'success' : 'completed'
          })
        }
      );
    } catch (transError) {
      console.error('Error syncing transaction on auto-assign:', transError);
    }

    try {
      const { triggerEventNotification } = require('../utils/notificationHelper');

      await triggerEventNotification('provider_assigned', {
        providerName: nearestProvider.name,
        booking
      }, booking.customer);

      await triggerEventNotification('booking_created', {
        serviceName: booking.services?.[0]?.serviceDetails?.title || 'service',
        street: booking.address?.street || 'your area',
        booking
      }, nearestProvider._id);

      const { getIO } = require('../socket/socketServer');
      const io = getIO();
      if (io) {
        io.to(`booking_${booking._id}`).emit('tracking-started', {
          bookingId: booking._id,
          trackingEnabled: true,
          providerLiveLocation: nearestProvider.currentLocation ? {
            lat: nearestProvider.currentLocation.coordinates[1],
            lng: nearestProvider.currentLocation.coordinates[0],
            updatedAt: new Date()
          } : null,
          provider: nearestProvider,
          status: 'accepted'
        });

        io.to('admin_live_room').emit('admin-booking-update', {
          bookingId: booking._id,
          event: 'auto-assigned',
          providerId: nearestProvider._id,
          status: 'accepted'
        });
      }
    } catch (socketErr) {
      console.error('Error sending auto-assign sockets/notifications:', socketErr);
    }

    console.log(`[AutoAssign] Booking ${booking._id} successfully assigned to provider ${nearestProvider.name}`);
    return nearestProvider;

  } catch (error) {
    console.error('Error in autoAssignProviderIfEnabled:', error);
    return null;
  }
}


  static async escalateToAdmin(bookingId, reason) {
  try {
    console.log(`[Escalation] Escalating booking ${bookingId} to Admin. Reason: ${reason}`);
    const booking = await Booking.findById(bookingId).populate('customer');
    if (!booking || ['accepted', 'in-progress', 'started', 'completed', 'cancelled', 'Waiting Admin Assignment'].includes(booking.status)) {
      return;
    }

    booking.status = 'Waiting Admin Assignment';
    booking.provider = undefined;
    booking.providerAcceptanceStatus = null;
    booking.providerResponseDeadline = null;
    booking.statusHistory.push({
      status: 'Waiting Admin Assignment',
      timestamp: new Date(),
      note: `Escalated to Admin: ${reason}`,
      updatedBy: 'system'
    });

    await booking.save();

    const { SystemConfig } = require('../models/SystemSetting-model');
    let settings = await SystemConfig.findOne();
    const adminTimeoutMin = settings?.bookingSettings?.adminResponseTime || 30;

    // Start Admin Response Timer
    setTimeout(async () => {
      try {
        const currentBooking = await Booking.findById(bookingId);
        if (currentBooking && currentBooking.status === 'Waiting Admin Assignment') {
          console.log(`[Admin Timeout] Admin failed to respond to escalated booking ${bookingId} within ${adminTimeoutMin} minutes. Auto-cancelling...`);
          await ProviderAssignmentService.autoCancelBooking(bookingId, 'Admin response timeout');
        }
      } catch (err) {
        console.error('Error in Admin Response Timer:', err);
      }
    }, adminTimeoutMin * 60 * 1000);

    // Notify Admins
    try {
      const { getIO } = require('../socket/socketServer');
      const io = getIO();
      if (io) {
        io.to('admin_live_room').emit('admin-booking-update', {
          bookingId: booking._id,
          event: 'booking-escalated',
          status: 'Waiting Admin Assignment',
          bookingType: booking.bookingType,
          reason
        });
        io.to('role_admin').emit('booking-escalated-alert', {
          bookingId: booking._id,
          message: `Booking ${booking.bookingId || booking._id} escalated to Admin queue!`,
          sound: true
        });
      }

      const { sendNotification } = require('../utils/notificationHelper');
      // Notify any system admin or admin role
      const Admin = require('../models/Admin-model');
      const admins = await Admin.find().select('_id').lean();
      for (const admin of admins) {
        sendNotification(
          admin._id,
          'admin',
          '🚨 Booking Escalated to Admin Queue',
          `Booking ${booking.bookingId || booking._id} has escalated due to: ${reason}`,
          'booking',
          booking._id
        );
      }
    } catch (notifErr) {
      console.error('Error broadcasting escalation notifications:', notifErr);
    }

  } catch (err) {
    console.error('Error in escalateToAdmin:', err);
  }
}

  static async autoCancelBooking(bookingId, reason) {
  try {
    console.log(`[AutoCancel] Auto-cancelling booking ${bookingId}. Reason: ${reason}`);
    const booking = await Booking.findById(bookingId);
    if (!booking || ['completed', 'cancelled', 'accepted', 'in-progress', 'started'].includes(booking.status)) {
      return;
    }

    booking.status = 'cancelled';
    if (!booking.cancellationProgress) booking.cancellationProgress = {};
    booking.cancellationProgress.status = 'cancelled';
    booking.cancellationProgress.reason = reason || 'No provider available';
    booking.cancellationProgress.cancelledAt = new Date();
    booking.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: `System Auto-Cancelled: ${reason}`,
      updatedBy: 'system'
    });

    // Handle refunds for online/prepaid bookings
    if (['paid', 'escrow_hold'].includes(booking.paymentStatus) || ['online', 'wallet', 'mixed'].includes(booking.paymentMethod)) {
      try {
        const User = require('../models/User-model');
        const Transaction = require('../models/Transaction-model');

        await User.findByIdAndUpdate(
          booking.customer,
          {
            $inc: { 'wallet.availableBalance': booking.totalAmount, 'wallet.totalRefunded': booking.totalAmount },
            $push: {
              'wallet.walletTransactions': {
                type: 'credit',
                amount: booking.totalAmount,
                reason: `System Auto-cancellation refund: ${reason}`,
                booking: booking._id,
                createdAt: new Date()
              }
            },
            $set: { 'wallet.lastUpdated': new Date() }
          }
        );

        const refundTxn = new Transaction({
          booking: booking._id,
          bookingId: booking.bookingId || booking._id.toString(),
          user: booking.customer,
          customerId: booking.customer.toString(),
          amount: booking.totalAmount,
          paymentStatus: 'completed',
          paymentMethod: 'wallet',
          type: 'refund',
          description: `System auto-cancelled booking - Automatic refund to wallet: ${reason}`,
          refundReason: reason,
          completedAt: new Date()
        });
        await refundTxn.save();

        booking.paymentStatus = 'refunded';
        booking.cancellationProgress.status = 'refund_completed';
        booking.cancellationProgress.refundAmount = booking.totalAmount;
        booking.cancellationProgress.refundCompletedAt = new Date();
      } catch (refundErr) {
        console.error('[Refund Error] Failed to process auto-refund:', refundErr);
      }
    }

    await booking.save();

    // Broadcast Socket events and push notifications
    try {
      const { getIO } = require('../socket/socketServer');
      const io = getIO();
      if (io) {
        io.to(booking.customer.toString()).emit('booking-status-updated', {
          bookingId: booking._id,
          status: 'cancelled',
          reason
        });
        io.to('admin_live_room').emit('admin-booking-update', {
          bookingId: booking._id,
          event: 'auto-cancelled',
          status: 'cancelled',
          reason
        });
      }

      const { sendNotification } = require('../utils/notificationHelper');
      sendNotification(
        booking.customer,
        'customer',
        'Booking Cancelled',
        `Your booking was cancelled: ${reason}. Refund has been processed if paid.`,
        'booking',
        booking._id
      );
    } catch (notifErr) {
      console.error('Error broadcasting cancellation alerts:', notifErr);
    }

  } catch (err) {
    console.error('Error in autoCancelBooking:', err);
  }
}

}

module.exports = ProviderAssignmentService;

