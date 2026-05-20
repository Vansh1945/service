const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { addUser, removeUser } = require('./userSocketMap');
const { setIO: setNotifIO } = require('../utils/notificationHelper');
const Booking = require('../models/Booking-model');
const Provider = require('../models/Provider-model');

let io = null;

// Distance helper (Haversine formula in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // meters
}

// Polyline decoder helper for overview route coordinates
function decodePolyline(str) {
    let index = 0,
        lat = 0,
        lng = 0,
        coordinates = [],
        shift = 0,
        result = 0,
        byte = null,
        latitude_change,
        longitude_change;

    while (index < str.length) {
        byte = null;
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += latitude_change;

        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += longitude_change;

        coordinates.push({
            lat: lat / 100000,
            lng: lng / 100000
        });
    }

    return coordinates;
}

const initSocket = (httpServer) => {
    const frontendUrl = process.env.FRONTEND_URL;

    io = new Server(httpServer, {
        cors: {
            origin: [frontendUrl, 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5173'],
            methods: ['GET', 'POST'],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Share io instance with controllers
    setNotifIO(io);

    // JWT Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.query?.token;

            if (!token || token === 'null' || token === 'undefined') {
                return next(new Error('Authentication token missing'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id?.toString();
            socket.userRole = decoded.role || 'customer';
            socket.userName = decoded.name || 'User';

            if (!socket.userId) {
                return next(new Error('Invalid token payload'));
            }

            next();
        } catch (err) {
            console.error('Socket auth error:', err.message);
            return next(new Error('Authentication failed'));
        }
    });

    // Connection handler
    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log(`✅ Socket connected: ${userId} (${socket.userRole})`);

        // Register user in socket map
        addUser(userId, socket.id);

        // Auto-join personal room and role room (for notifications)
        socket.join(userId.toString());
        if (socket.userRole) {
            socket.join('role_' + socket.userRole);
        }

        // Room joining & tracking architecture setup
        if (socket.userRole === 'provider') {
            socket.join(`provider_${userId}`);
            // Automatically mark online on connect
            Provider.findByIdAndUpdate(userId, { isOnline: true }).then(() => {
                io.to('admin_live_room').emit('provider-status-changed', { providerId: userId, isOnline: true });
            }).catch(err => console.error('Error marking provider online:', err.message));
        }

        if (socket.userRole === 'admin') {
            socket.join('admin_live_room');
        }

        // 1. Join Tracking Room
        socket.on('join-booking-tracking', async ({ bookingId }) => {
            try {
                if (!bookingId) return;
                socket.join(`booking_${bookingId}`);
                console.log(`📡 User ${userId} joined tracking room: booking_${bookingId}`);
                
                // Fetch current booking state
                const booking = await Booking.findById(bookingId)
                    .populate('provider', 'name phone profilePicUrl currentLocation isOnline')
                    .lean();
                
                if (booking) {
                    socket.emit('tracking-started', {
                        bookingId,
                        trackingEnabled: booking.trackingEnabled,
                        providerLiveLocation: booking.providerLiveLocation,
                        providerReached: booking.providerReached,
                        liveDistance: booking.liveDistance,
                        liveDuration: booking.liveDuration,
                        routeCoordinates: booking.routeCoordinates,
                        provider: booking.provider,
                        status: booking.status
                    });
                }
            } catch (err) {
                console.error('Error in join-booking-tracking:', err.message);
            }
        });

        // 2. Leave Tracking Room
        socket.on('leave-booking-tracking', ({ bookingId }) => {
            if (!bookingId) return;
            socket.leave(`booking_${bookingId}`);
            console.log(`📡 User ${userId} left tracking room: booking_${bookingId}`);
            socket.emit('tracking-stopped', { bookingId });
        });

        // 3. Provider Location Update (Rate limited to ~5s)
        const LAST_UPDATE_KEY = `loc_up_${userId}`;
        socket.on('provider-location-update', async (payload) => {
            try {
                const { bookingId, latitude, longitude } = payload;
                if (!bookingId || latitude === undefined || longitude === undefined) {
                    return;
                }

                // Rate limiting check
                const now = Date.now();
                if (socket[LAST_UPDATE_KEY] && (now - socket[LAST_UPDATE_KEY] < 4500)) {
                    return; // Skip update if sent within 5 seconds
                }
                socket[LAST_UPDATE_KEY] = now;

                // Find and validate booking
                const booking = await Booking.findById(bookingId);
                if (!booking) {
                    return socket.emit('error-alert', { message: 'Booking not found' });
                }

                // Security: Only assigned provider can update location
                if (!booking.provider || booking.provider.toString() !== userId.toString()) {
                    return socket.emit('error-alert', { message: 'Unauthorized location update' });
                }

                // Security: Tracking allowed only if status is accepted or in-progress
                const allowedStatuses = ['accepted', 'in-progress', 'in_progress', 'scheduled', 'arriving', 'assigned'];
                if (!allowedStatuses.includes(booking.status)) {
                    return socket.emit('error-alert', { message: 'Location tracking is inactive for this status' });
                }

                // Update provider's current location in DB
                await Provider.findByIdAndUpdate(userId, {
                    currentLocation: {
                        type: 'Point',
                        coordinates: [longitude, latitude] // GeoJSON: longitude first
                    },
                    isOnline: true,
                    activeBooking: bookingId,
                    lastUpdated: new Date()
                });

                // Get target booking coordinates
                let targetLat = null;
                let targetLng = null;

                if (booking.address && typeof booking.address.lat === 'number' && typeof booking.address.lng === 'number') {
                    targetLat = booking.address.lat;
                    targetLng = booking.address.lng;
                } else {
                    if (booking.statusHistory) {
                        for (const h of booking.statusHistory) {
                            if (h.note) {
                                const match = h.note.match(/TARGET_LOCATION:([-\d.]+),([-\d.]+)/);
                                if (match) {
                                    targetLat = parseFloat(match[1]);
                                    targetLng = parseFloat(match[2]);
                                    break;
                                }
                            }
                        }
                    }
                }

                // Fallback math calculation if coordinates are not available
                if (targetLat === null || targetLng === null) {
                    const addr = booking.address || {};
                    const addrStr = `${addr.street || ''} ${addr.city || ''} ${addr.postalCode || ''}`.trim();
                    let hash = 0;
                    for (let i = 0; i < addrStr.length; i++) {
                        hash = (hash << 5) - hash + addrStr.charCodeAt(i);
                        hash |= 0;
                    }
                    const absHash = Math.abs(hash);
                    targetLat = 28.5 + (absHash % 1000) / 1000 * 0.2;
                    targetLng = 77.1 + (Math.floor(absHash / 1000) % 1000) / 1000 * 0.2;
                }

                const d = calculateDistance(latitude, longitude, targetLat, targetLng);

                // Initial fallbacks (straight line)
                let distanceText = `${(d / 1000).toFixed(1)} km`;
                let durationText = `${Math.round(d / 1000 * 2.5) || 1} mins`;
                let routeCoords = [{ lat: latitude, lng: longitude }, { lat: targetLat, lng: targetLng }];

                // Request Route from OpenRouteService API
                const apiKey = process.env.ORS_API_KEY || process.env.OPENROUTESERVICE_API_KEY;
                if (apiKey) {
                    try {
                        const axios = require('axios');
                        const directionsUrl = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${longitude},${latitude}&end=${targetLng},${targetLat}`;
                        const response = await axios.get(directionsUrl);
                        if (response.data?.features?.[0]) {
                            const feature = response.data.features[0];
                            const prop = feature.properties?.segments?.[0];
                            if (prop) {
                                // ORS returns distance in meters, duration in seconds
                                const distKm = prop.distance / 1000;
                                const durMin = Math.round(prop.duration / 60);
                                distanceText = `${distKm.toFixed(1)} km`;
                                durationText = `${durMin} mins`;
                            }
                            if (feature.geometry) {
                                routeCoords = decodePolyline(feature.geometry);
                            }
                        }
                    } catch (gErr) {
                        console.error('Error fetching ORS route:', gErr.message);
                    }
                }

                // Update booking model
                booking.providerLiveLocation = {
                    lat: latitude,
                    lng: longitude,
                    updatedAt: new Date()
                };
                booking.liveDistance = distanceText;
                booking.liveDuration = durationText;
                booking.routeCoordinates = routeCoords;
                booking.trackingEnabled = true;

                // Arrival detection (100m threshold)
                if (d <= 100 && !booking.providerReached) {
                    booking.providerReached = true;
                    booking.statusHistory.push({
                        status: booking.status,
                        timestamp: new Date(),
                        note: `Provider arrived at service location. Target coordinates: ${targetLat}, ${targetLng}. Current coordinates: ${latitude}, ${longitude}. Distance: ${Math.round(d)}m.`,
                        updatedBy: 'system'
                    });

                    // Emit to tracking rooms
                    io.to(`booking_${bookingId}`).emit('provider-arrived', {
                        bookingId,
                        providerReached: true,
                        message: 'Service professional has arrived at your location'
                    });

                    io.to('admin_live_room').emit('admin-booking-update', {
                        bookingId,
                        event: 'provider-arrived',
                        providerReached: true
                    });

                    const { sendNotification } = require('../utils/notificationHelper');
                    try {
                        await sendNotification(
                            booking.customer,
                            'customer',
                            'Provider Arrived',
                            'Your service professional has arrived at your location. Share the START PIN to begin the service.',
                            'booking',
                            bookingId
                        );
                    } catch (notifErr) {
                        console.error('Error sending arrival notification:', notifErr.message);
                    }
                }

                await booking.save();

                // Broadcast live location to Customer tracking room
                io.to(`booking_${bookingId}`).emit('provider-live-location', {
                    bookingId,
                    providerId: userId,
                    latitude,
                    longitude,
                    liveDistance: booking.liveDistance,
                    liveDuration: booking.liveDuration,
                    routeCoordinates: booking.routeCoordinates,
                    providerReached: booking.providerReached
                });

                // Broadcast live location to Admin live room
                io.to('admin_live_room').emit('provider-moving', {
                    bookingId,
                    providerId: userId,
                    latitude,
                    longitude,
                    liveDistance: booking.liveDistance,
                    liveDuration: booking.liveDuration,
                    providerReached: booking.providerReached,
                    status: booking.status
                });

            } catch (err) {
                console.error('Error in provider-location-update socket handler:', err.message);
            }
        });

        // 4. Provider Toggle Online/Offline
        socket.on('provider-toggle-online', async ({ isOnline }) => {
            try {
                if (socket.userRole !== 'provider') return;
                await Provider.findByIdAndUpdate(userId, { isOnline });
                io.to('admin_live_room').emit('provider-status-changed', {
                    providerId: userId,
                    isOnline
                });
                console.log(`🔌 Provider ${userId} is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
            } catch (err) {
                console.error('Error toggling provider online status:', err.message);
            }
        });

        // Handle disconnect
        socket.on('disconnect', async (reason) => {
            console.log(`❌ Socket disconnected: ${userId} — ${reason}`);
            removeUser(socket.id);

            if (socket.userRole === 'provider') {
                try {
                    await Provider.findByIdAndUpdate(userId, { isOnline: false, activeBooking: null });
                    io.to('admin_live_room').emit('provider-status-changed', {
                        providerId: userId,
                        isOnline: false
                    });
                } catch (err) {
                    console.error('Error updating provider offline status on disconnect:', err.message);
                }
            }
        });
    });

    console.log('🔌 Socket.io initialized');
    return io;
};

/**
 * Get the io instance (for use outside of controllers)
 */
const getIO = () => {
    if (!io) throw new Error('Socket.io not initialized');
    return io;
};

module.exports = { initSocket, getIO };
