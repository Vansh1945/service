const mongoose = require('mongoose');
const Provider = require('../models/Provider-model');
const Booking = require('../models/Booking-model');
const Transaction = require('../models/Transaction-model');
const { sendNotification } = require('../utils/notificationHelper');
const { calculateDistance } = require('../utils/geoUtils');
const { latLngToS2CellId, getNeighbors } = require('../utils/s2Helper');

const checkProviderOverlap = (newBooking, providerBookings, bufferMinutes = 30) => {
  const newStart = new Date(newBooking.date);
  if (newBooking.time) {
    const [h, m] = newBooking.time.split(':').map(Number);
    newStart.setHours(h, m, 0, 0);
  }
  let newDurationHours = 1;
  if (newBooking.services && newBooking.services.length > 0) {
    const firstService = newBooking.services[0];
    newDurationHours = firstService.service?.duration || firstService.serviceDetails?.duration || 1;
  }
  const newEnd = new Date(newStart.getTime() + newDurationHours * 60 * 60 * 1000 + bufferMinutes * 60 * 1000);

  for (const pb of providerBookings) {
    const start = new Date(pb.date);
    if (pb.time) {
      const [h, m] = pb.time.split(':').map(Number);
      start.setHours(h, m, 0, 0);
    }
    let durationHours = 1;
    if (pb.services && pb.services.length > 0) {
      const firstService = pb.services[0];
      durationHours = firstService.service?.duration || firstService.serviceDetails?.duration || 1;
    }
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000 + bufferMinutes * 60 * 1000);

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
  static calculateDistance(lat1, lon1, lat2, lon2) {
    return calculateDistance(lat1, lon1, lat2, lon2);
  }

  static checkProviderOverlap(newBooking, providerBookings, bufferMinutes) {
    return checkProviderOverlap(newBooking, providerBookings, bufferMinutes);
  }

  static async autoAssignProviderIfEnabled(bookingId) {
    try {
      const { SystemConfig } = require('../models/SystemSetting');
      let settings = await SystemConfig.findOne();
      if (!settings) {
        settings = new SystemConfig({ companyName: process.env.COMPANY_NAME || 'Raj Electrical Services' });
        await settings.save();
      }

      if (!settings || !settings.bookingSettings || !settings.bookingSettings.autoAssignProvider) {
        const booking = await Booking.findById(bookingId).populate('services.service');
        if (booking && !booking.provider) {
          const { triggerEventNotification } = require('../utils/notificationHelper');
          await triggerEventNotification('booking_created', {
            serviceName: booking.services?.[0]?.serviceDetails?.title || 'service',
            street: booking.address?.street || 'your area',
            booking
          });
        }
        return null;
      }

      const booking = await Booking.findById(bookingId).populate('services.service');
      if (!booking || booking.provider) {
        return null;
      }

      const maxDistanceKm = settings.bookingSettings.autoAssignRadius || 15;
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

          const scoredProviders = providersWithDetails.map(item => {
            const p = item.provider;
            const pIdStr = p._id.toString();
            const workload = workloadMap[pIdStr] || 0;

            if (workload >= maxBookings) {
              return null;
            }

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

      if (!selectedProvider) {
        console.log(`[AutoAssign] No nearby or zone providers found for booking ${booking._id} within ${maxDistanceKm}km`);
        return null;
      }

      const nearestProvider = selectedProvider;

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
}

module.exports = ProviderAssignmentService;
