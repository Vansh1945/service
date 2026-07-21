const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { addUser, removeUser } = require('./userSocketMap');
const { setIO: setNotifIO } = require('../utils/notificationHelper');
const Booking = require('../models/Booking-model');
const Provider = require('../models/Provider-model');

/**
 * Helper to get namespace-based room name for socket and tracking purposes
 */
const getRoomNamespace = (room) => {
    if (room.roomType === 'provider_customer') {
        return `provider_customer:${room.bookingId}`;
    } else if (room.roomType === 'customer_admin') {
        return `customer_admin:${room.customerId}`;
    } else if (room.roomType === 'provider_admin') {
        return `provider_admin:${room.providerId}`;
    } else if (room.roomType === 'complaint_admin') {
        return `complaint_admin:${room.complaintId}`;
    }
    return room._id.toString();
};

let io = null;

const ROUTE_CACHE = new Map();
const ROUTE_CACHE_TTL_MS = 45000;
const LAST_PROVIDER_POS = new Map();

// Periodically clean up stale route cache and provider positions to prevent memory leaks (Phase A)
setInterval(() => {
    try {
        const now = Date.now();
        // Evict route cache entries older than TTL
        for (const [key, val] of ROUTE_CACHE.entries()) {
            if (now - val.ts > ROUTE_CACHE_TTL_MS) {
                ROUTE_CACHE.delete(key);
            }
        }
        // Evict provider positions older than 1 hour (inactive providers)
        for (const [key, val] of LAST_PROVIDER_POS.entries()) {
            if (now - val.ts > 3600000) {
                LAST_PROVIDER_POS.delete(key);
            }
        }
    } catch (err) {
        if (global.logger) {
            global.logger.error('[Socket Cache Eviction Error]', err);
        } else {
            console.error('[Socket Cache Eviction Error]', err);
        }
    }
}, 60000); // Check every 60 seconds

const { calculateDistance } = require('../utils/geoUtils');

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

function routeCacheKey(pLat, pLng, tLat, tLng) {
    return `${pLat.toFixed(4)},${pLng.toFixed(4)}->${tLat.toFixed(4)},${tLng.toFixed(4)}`;
}

function filterGPSJitter(providerId, lat, lng, minMeters = 8) {
    const prev = LAST_PROVIDER_POS.get(providerId);
    if (!prev) {
        LAST_PROVIDER_POS.set(providerId, { lat, lng, ts: Date.now() });
        return { lat, lng, filtered: false };
    }
    const d = calculateDistance(prev.lat, prev.lng, lat, lng);
    if (d < minMeters) {
        return { lat: prev.lat, lng: prev.lng, filtered: true };
    }
    LAST_PROVIDER_POS.set(providerId, { lat, lng, ts: Date.now() });
    return { lat, lng, filtered: false };
}

async function fetchDrivingRoute(startLng, startLat, endLng, endLat) {
    const cacheKey = routeCacheKey(startLat, startLng, endLat, endLng);
    const cached = ROUTE_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < ROUTE_CACHE_TTL_MS) {
        return cached.data;
    }

    const apiKey = process.env.ORS_API_KEY || process.env.OPENROUTESERVICE_API_KEY;
    let distanceText = null;
    let durationText = null;
    let routeCoords = null;

    if (apiKey) {
        try {
            const axios = require('axios');
            const directionsUrl = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startLng},${startLat}&end=${endLng},${endLat}`;
            const response = await axios.get(directionsUrl, { timeout: 12000 });
            if (response.data?.features?.[0]) {
                const feature = response.data.features[0];
                const prop = feature.properties?.segments?.[0];
                if (prop) {
                    distanceText = `${(prop.distance / 1000).toFixed(1)} km`;
                    durationText = `${Math.max(1, Math.round(prop.duration / 60))} mins`;
                }
                if (feature.geometry) {
                    if (typeof feature.geometry === 'string') {
                        routeCoords = decodePolyline(feature.geometry);
                    } else if (feature.geometry.coordinates) {
                        routeCoords = feature.geometry.coordinates.map((c) => ({
                            lat: c[1],
                            lng: c[0]
                        }));
                    }
                }
            }
        } catch (gErr) {
            console.error('ORS route error:', gErr.message);
        }
    }

    if (!routeCoords || routeCoords.length < 2) {
        try {
            const axios = require('axios');
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
            const osrmRes = await axios.get(osrmUrl, { timeout: 12000 });
            const route = osrmRes.data?.routes?.[0];
            if (route) {
                distanceText = `${(route.distance / 1000).toFixed(1)} km`;
                durationText = `${Math.max(1, Math.round(route.duration / 60))} mins`;
                routeCoords = route.geometry.coordinates.map((c) => ({
                    lat: c[1],
                    lng: c[0]
                }));
            }
        } catch (osrmErr) {
            console.error('OSRM route fallback error:', osrmErr.message);
        }
    }

    const result = {
        distanceText,
        durationText,
        routeCoords: routeCoords?.length >= 2
            ? routeCoords
            : [{ lat: startLat, lng: startLng }, { lat: endLat, lng: endLng }]
    };
    ROUTE_CACHE.set(cacheKey, { ts: Date.now(), data: result });
    return result;
}

function resolveBookingTargetCoords(booking) {
    if (booking.location && booking.location.coordinates && 
        booking.location.coordinates.length === 2 && 
        (booking.location.coordinates[0] !== 0 || booking.location.coordinates[1] !== 0)) {
        return { lat: booking.location.coordinates[1], lng: booking.location.coordinates[0] };
    }
    if (booking.address && typeof booking.address.lat === 'number' && typeof booking.address.lng === 'number') {
        const lat = parseFloat(booking.address.lat);
        const lng = parseFloat(booking.address.lng);
        if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
            return { lat, lng };
        }
    }
    if (booking.statusHistory) {
        for (const h of booking.statusHistory) {
            if (h.note) {
                const match = h.note.match(/TARGET_LOCATION:([-\d.]+),([-\d.]+)/);
                if (match) {
                    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
                }
            }
        }
    }
    return null;
}

const initSocket = (httpServer) => {
    const frontendUrl = process.env.FRONTEND_URL;

    io = new Server(httpServer, {
        cors: {
            origin: function (origin, callback) {
                const isDev = process.env.NODE_ENV !== 'production';
                let allowedOrigins = [];
                if (frontendUrl) {
                    allowedOrigins = frontendUrl.split(',').map(url => url.trim().replace(/\/$/, ""));
                }
                const normalizedOrigin = origin ? origin.trim().replace(/\/$/, "") : '';
                if (!origin || allowedOrigins.includes(normalizedOrigin) || (isDev && (normalizedOrigin.startsWith('http://localhost:') || normalizedOrigin.startsWith('http://127.0.0.1:')))) {
                    callback(null, true);
                } else {
                    callback(null, false);
                }
            },
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
            // Keep persistent online status on connection, notify admin of current status
            Provider.findById(userId).then((provider) => {
                if (provider) {
                    io.to('admin_live_room').emit('provider-status-changed', { providerId: userId, isOnline: provider.isOnline });
                }
            }).catch(err => console.error('Error fetching provider status on connect:', err.message));
        }

        if (socket.userRole === 'admin') {
            socket.join('admin_live_room');
        }

        // Mark undelivered messages as delivered for this user
        (async () => {
            try {
                const ChatRoom = require('../models/ChatRoom-model');
                const rooms = await ChatRoom.find({
                    $or: [
                        { customerId: userId },
                        { providerId: userId }
                    ]
                });
                
                for (const room of rooms) {
                    let modified = false;
                    const recipientIdStr = userId.toString();
                    room.messages.forEach(msg => {
                        if (msg.senderId.toString() !== recipientIdStr && !msg.delivered) {
                            msg.delivered = true;
                            msg.deliveredAt = new Date();
                            if (msg.status === 'sent') {
                                msg.status = 'delivered';
                            }
                            modified = true;
                        }
                    });
                    
                    if (modified) {
                        await room.save();
                        io.to(room._id.toString()).emit('chat:delivered', {
                            roomId: room._id.toString(),
                            deliveredBy: userId
                        });
                    }
                }
            } catch (err) {
                console.error('Error marking undelivered messages on connect:', err.message);
            }
        })();

        // 1. Join Tracking Room
        socket.on('join-booking-tracking', async ({ bookingId }) => {
            try {
                if (!bookingId) return;
                socket.join(`booking_${bookingId}`);
                console.log(`📡 User ${userId} joined tracking room: booking_${bookingId}`);

                // Fetch current booking state
                const booking = await Booking.findById(bookingId)
                    .populate('provider', 'name email phone rating address currentLocation isOnline profilePicUrl performanceScore completedBookings activeBooking')
                    .lean();

                if (booking) {
                    let trackingEnabled = booking.trackingEnabled;
                    let providerLiveLocation = booking.providerLiveLocation;
                    let liveDistance = booking.liveDistance;
                    let liveDuration = booking.liveDuration;
                    let routeCoordinates = booking.routeCoordinates;
                    let provider = booking.provider;

                    if (provider && socket.userRole === 'customer') {
                        const isThisBookingActive = provider.activeBooking && 
                                                    provider.activeBooking.toString() === bookingId.toString();
                        const isTrackable = (isThisBookingActive && ['accepted', 'assigned'].includes(booking.status)) ||
                                            ['arriving', 'started', 'in-progress', 'in_progress'].includes(booking.status);
                        if (!isTrackable) {
                            trackingEnabled = false;
                            providerLiveLocation = null;
                            liveDistance = null;
                            liveDuration = null;
                            routeCoordinates = null;
                            if (provider.currentLocation) {
                                provider = { ...provider, currentLocation: null };
                            }
                        }
                    }

                    socket.emit('tracking-started', {
                        bookingId,
                        trackingEnabled,
                        providerLiveLocation,
                        providerReached: booking.providerReached,
                        liveDistance,
                        liveDuration,
                        routeCoordinates,
                        provider,
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

                // Security: tracking only while en route / in service
                const blockedStatuses = ['completed', 'cancelled', 'pending', 'no-show'];
                const allowedStatuses = ['accepted', 'arriving', 'started', 'in-progress', 'in_progress', 'assigned'];
                if (blockedStatuses.includes(booking.status) || !allowedStatuses.includes(booking.status)) {
                    return socket.emit('error-alert', { message: 'Location tracking is inactive for this status' });
                }

                const smoothed = filterGPSJitter(userId, latitude, longitude);
                const emitLat = smoothed.lat;
                const emitLng = smoothed.lng;

                const { latLngToS2CellId } = require('../utils/s2Helper');
                const providerS2CellId = latLngToS2CellId(emitLat, emitLng, 13);
                const providerS2CellIdPrecise = latLngToS2CellId(emitLat, emitLng, 20);

                // Update provider's current location in DB
                await Provider.findByIdAndUpdate(userId, {
                    currentLocation: {
                        type: 'Point',
                        coordinates: [emitLng, emitLat], // GeoJSON: longitude first
                        s2CellId: providerS2CellId,
                        s2CellIdPrecise: providerS2CellIdPrecise
                    },
                    s2CellId: providerS2CellId,
                    s2CellIdPrecise: providerS2CellIdPrecise,
                    isOnline: true,
                    activeBooking: bookingId,
                    lastUpdated: new Date()
                });

                const target = resolveBookingTargetCoords(booking);
                let targetLat = target?.lat ?? null;
                let targetLng = target?.lng ?? null;

                let distanceText = payload.liveDistance || booking.liveDistance || '';
                let durationText = payload.liveDuration || booking.liveDuration || '';
                let routeCoords = (booking.routeCoordinates && booking.routeCoordinates.length > 1)
                    ? booking.routeCoordinates
                    : [
                        { lat: emitLat, lng: emitLng },
                        ...(targetLat != null && targetLng != null
                            ? [{ lat: targetLat, lng: targetLng }]
                            : [])
                    ];

                if (targetLat != null && targetLng != null) {
                    const d = calculateDistance(emitLat, emitLng, targetLat, targetLng);
                    distanceText = distanceText || `${(d / 1000).toFixed(1)} km`;
                    durationText = durationText || `${Math.max(1, Math.round((d / 1000) * 2.5))} mins`;

                    if (!smoothed.filtered) {
                        try {
                            const routeData = await Promise.race([
                                fetchDrivingRoute(emitLng, emitLat, targetLng, targetLat),
                                new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('route timeout')), 8000)
                                )
                            ]);
                            if (routeData.distanceText) distanceText = routeData.distanceText;
                            if (routeData.durationText) durationText = routeData.durationText;
                            if (routeData.routeCoords?.length > 1) routeCoords = routeData.routeCoords;
                        } catch (routeErr) {
                            console.warn('Route fetch skipped:', routeErr.message);
                        }
                    }
                }

                // Update booking model
                booking.providerLiveLocation = {
                    lat: emitLat,
                    lng: emitLng,
                    updatedAt: new Date()
                };
                booking.liveDistance = distanceText;
                booking.liveDuration = durationText;
                booking.routeCoordinates = routeCoords;
                booking.trackingEnabled = true;
                if (!booking.journeyStartedAt) {
                    booking.journeyStartedAt = new Date();
                }

                // Arrival detection (100m threshold)
                const arrivalDist = targetLat != null && targetLng != null
                    ? calculateDistance(emitLat, emitLng, targetLat, targetLng)
                    : Infinity;
                if (arrivalDist <= 100 && !booking.providerReached) {
                    booking.providerReached = true;
                    booking.arrivedAt = new Date();
                    booking.statusHistory.push({
                        status: booking.status,
                        timestamp: new Date(),
                        note: `Provider arrived at service location. Target coordinates: ${targetLat}, ${targetLng}. Current coordinates: ${emitLat}, ${emitLng}. Distance: ${Math.round(arrivalDist)}m.`,
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
                    latitude: emitLat,
                    longitude: emitLng,
                    s2CellId: providerS2CellId,
                    s2CellIdPrecise: providerS2CellIdPrecise,
                    liveDistance: booking.liveDistance,
                    liveDuration: booking.liveDuration,
                    routeCoordinates: booking.routeCoordinates,
                    providerReached: booking.providerReached
                });

                // Broadcast live location to Admin live room
                io.to('admin_live_room').emit('provider-moving', {
                    bookingId,
                    providerId: userId,
                    latitude: emitLat,
                    longitude: emitLng,
                    s2CellId: providerS2CellId,
                    s2CellIdPrecise: providerS2CellIdPrecise,
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
                
                const updateFields = { isOnline };
                if (isOnline) {
                    const provider = await Provider.findById(userId);
                    if (provider) {
                        updateFields.notificationPreferences = {
                            ...provider.notificationPreferences,
                            bookingAlertTone: true,
                            bookingVibration: true,
                            booking: true,
                            pushEnabled: true
                        };
                    }
                }
                
                await Provider.findByIdAndUpdate(userId, updateFields);
                io.to('admin_live_room').emit('provider-status-changed', {
                    providerId: userId,
                    isOnline
                });
                console.log(`🔌 Provider ${userId} is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
            } catch (err) {
                console.error('Error toggling provider online status:', err.message);
            }
        });

        // ─── Chat Sockets Integration ───

        // 1. Join Chat Room
        socket.on('join-chat-room', async ({ roomId }) => {
            if (!roomId) return;
            socket.join(roomId.toString());

            // Also join the namespace-based room for this room type
            try {
                const ChatRoom = require('../models/ChatRoom-model');
                const room = await ChatRoom.findById(roomId);
                if (room) {
                    const ns = getRoomNamespace(room);
                    socket.join(ns);
                    console.log(`💬 Socket user ${userId} also joined namespace room: ${ns}`);
                    // Broadcast online status to the room
                    io.to(roomId.toString()).emit('chat:user-online', { userId, isOnline: true });

                    // Mark messages from others as delivered & seen
                    let modified = false;
                    room.messages.forEach(msg => {
                        if (msg.senderId.toString() !== userId.toString()) {
                            if (!msg.delivered) {
                                msg.delivered = true;
                                msg.deliveredAt = new Date();
                                if (msg.status === 'sent') msg.status = 'delivered';
                                modified = true;
                            }
                            if (!msg.seen) {
                                msg.seen = true;
                                msg.readAt = new Date();
                                msg.status = 'read';
                                modified = true;
                            }
                        }
                    });

                    const userRole = socket.userRole;
                    if (userRole === 'customer' && room.unreadCustomer > 0) {
                        room.unreadCustomer = 0;
                        modified = true;
                    } else if (userRole === 'provider' && room.unreadProvider > 0) {
                        room.unreadProvider = 0;
                        modified = true;
                    } else if (userRole === 'admin' && room.unreadAdmin > 0) {
                        room.unreadAdmin = 0;
                        modified = true;
                    }

                    if (modified) {
                        await room.save();
                        io.to(roomId.toString()).emit('chat:seen', {
                            roomId,
                            seenBy: userId,
                            seenRole: userRole
                        });
                    }
                }
            } catch (err) {
                console.error('Error joining namespace room in socket:', err.message);
            }
            console.log(`💬 Socket user ${userId} (${socket.userRole}) joined chat room: ${roomId}`);
        });

        // 2. Chat Send (Save & Emit)
        socket.on('chat-send', async (payload) => {
            try {
                const { roomId, messageType, content, fileUrl, replyTo } = payload;
                if (!roomId) return;

                const ChatRoom = require('../models/ChatRoom-model');
                const Booking = require('../models/Booking-model');

                const room = await ChatRoom.findById(roomId);
                if (!room) return;

                // Validate sender
                const isCustomer = room.customerId && room.customerId.toString() === userId.toString() && socket.userRole === 'customer';
                const isProvider = room.providerId && room.providerId.toString() === userId.toString() && socket.userRole === 'provider';
                const isAdmin = socket.userRole === 'admin';

                if (!isCustomer && !isProvider && !isAdmin) return;

                // Check lifecycle rules ONLY for provider_customer room type
                if (room.roomType === 'provider_customer' || (!room.roomType && room.bookingId)) {
                    const booking = await Booking.findById(room.bookingId);
                    if (!booking) return;

                    if (booking.disputeStatus === 'resolved' && !isAdmin) return;

                    const allowedStatuses = ['accepted', 'confirmed', 'scheduled', 'in-progress', 'in_progress', 'assigned', 'started', 'completed'];
                    if (!allowedStatuses.includes(booking.status) && !isAdmin) return;

                    if (booking.status === 'completed' && !isAdmin) {
                        const completedTime = booking.serviceCompletedAt || booking.completedAt || booking.updatedAt;
                        const diffMs = completedTime ? (Date.now() - new Date(completedTime).getTime()) : 0;
                        if (diffMs > 24 * 60 * 60 * 1000 && !booking.hasComplaint) {
                            return; // Lock
                        }
                    }
                }

                // Build message
                const { getSocketId } = require('./userSocketMap');
                const otherPartyId = socket.userRole === 'customer' ? room.providerId : room.customerId;
                const isOtherOnline = otherPartyId && !!getSocketId(otherPartyId);

                const newMessage = {
                    senderId: userId,
                    senderRole: socket.userRole,
                    messageType: messageType || 'text',
                    content: messageType === 'text' || messageType === 'system' ? content : '',
                    fileUrl: fileUrl || null,
                    seen: false,
                    replyTo: replyTo || null,
                    delivered: isOtherOnline,
                    deliveredAt: isOtherOnline ? new Date() : null,
                    status: isOtherOnline ? 'delivered' : 'sent',
                    createdAt: new Date()
                };

                room.messages.push(newMessage);
                room.lastMessage = messageType === 'text' ? content : `[${messageType}]`;

                // Increment unread counts
                const isSupportRoom = ['customer_admin', 'provider_admin', 'complaint_admin'].includes(room.roomType);
                const shouldIncrementAdmin = room.adminJoined || isSupportRoom;

                if (isCustomer) {
                    room.unreadProvider += 1;
                    if (shouldIncrementAdmin) room.unreadAdmin += 1;
                } else if (isProvider) {
                    room.unreadCustomer += 1;
                    if (shouldIncrementAdmin) room.unreadAdmin += 1;
                } else if (isAdmin) {
                    room.unreadCustomer += 1;
                    room.unreadProvider += 1;
                }

                await room.save();
                
                // Send push notification to the recipient of the chat message
                if (otherPartyId) {
                    try {
                        const { sendNotification } = require('../utils/notificationHelper');
                        const otherRole = socket.userRole === 'customer' ? 'provider' : 'customer';
                        const targetUrl = otherRole === 'customer' ? `/messages/${room._id}` : `/provider/messages/${room._id}`;

                        await sendNotification(
                            otherPartyId,
                            otherRole,
                            'chat_message',
                            `${socket.userName}: ${newMessage.content || '[File/Image]'}`,
                            'booking',
                            room.bookingId || null,
                            targetUrl,
                            'chat_message'
                        );
                    } catch (nErr) {
                        console.error('Error triggering chat push notification in socket chat-send:', nErr);
                    }
                }
                
                const savedMessage = room.messages[room.messages.length - 1];

                // Broadcast live to both the room _id and the namespace room
                const ns = getRoomNamespace(room);
                io.to(roomId.toString()).to(ns).emit('chat:new-message', {
                    roomId,
                    message: savedMessage,
                    lastMessage: room.lastMessage,
                    unreadCustomer: room.unreadCustomer,
                    unreadProvider: room.unreadProvider,
                    unreadAdmin: room.unreadAdmin
                });
            } catch (err) {
                console.error('Error in socket chat-send:', err.message);
            }
        });

        // 3. Chat Typing Indicator Broadcast
        socket.on('chat-typing', ({ roomId, isTyping }) => {
            if (!roomId) return;
            socket.to(roomId.toString()).emit('chat:typing', {
                roomId,
                userId,
                userName: socket.userName,
                role: socket.userRole,
                isTyping: !!isTyping
            });
        });

        // 4. Chat Seen Receipt Processing
        socket.on('chat-seen', async ({ roomId }) => {
            if (!roomId) return;
            try {
                const ChatRoom = require('../models/ChatRoom-model');
                const room = await ChatRoom.findById(roomId);
                if (!room) return;

                let updated = false;
                room.messages.forEach(msg => {
                    if (msg.senderId.toString() !== userId.toString() && !msg.seen) {
                        msg.seen = true;
                        updated = true;
                    }
                });

                if (socket.userRole === 'customer') {
                    if (room.unreadCustomer > 0 || updated) {
                        room.unreadCustomer = 0;
                        updated = true;
                    }
                } else if (socket.userRole === 'provider') {
                    if (room.unreadProvider > 0 || updated) {
                        room.unreadProvider = 0;
                        updated = true;
                    }
                } else if (socket.userRole === 'admin') {
                    if (room.unreadAdmin > 0 || updated) {
                        room.unreadAdmin = 0;
                        updated = true;
                    }
                }

                if (updated) {
                    await room.save();
                    io.to(roomId.toString()).emit('chat:seen', {
                        roomId,
                        seenBy: userId,
                        seenRole: socket.userRole
                    });
                }
            } catch (err) {
                console.error('Error in socket chat-seen:', err.message);
            }
        });

        // 5. Chat Admin Intervene Join
        socket.on('chat-admin-join', async ({ roomId }) => {
            if (socket.userRole !== 'admin' || !roomId) return;
            try {
                const ChatRoom = require('../models/ChatRoom-model');
                const room = await ChatRoom.findById(roomId);
                if (!room) return;

                room.adminJoined = true;
                const systemMessage = {
                    senderId: userId,
                    senderRole: 'admin',
                    messageType: 'system',
                    content: 'Admin joined this conversation',
                    seen: false,
                    delivered: true,
                    createdAt: new Date()
                };
                room.messages.push(systemMessage);
                room.lastMessage = 'Admin joined this conversation';
                await room.save();

                const savedMessage = room.messages[room.messages.length - 1];

                io.to(roomId.toString()).emit('chat:new-message', {
                    roomId,
                    message: savedMessage,
                    lastMessage: room.lastMessage,
                    adminJoined: true
                });
                io.to(roomId.toString()).emit('chat:admin-joined', { roomId });
            } catch (err) {
                console.error('Error in socket chat-admin-join:', err.message);
            }
        });

        // Handle disconnect
        socket.on('disconnect', async (reason) => {
            console.log(`❌ Socket disconnected: ${userId} — ${reason}`);
            removeUser(socket.id);
            // Broadcast offline status to all rooms
            io.emit('chat:user-online', { userId, isOnline: false });

            try {
                const now = new Date();
                if (socket.userRole === 'provider') {
                    await Provider.findByIdAndUpdate(userId, { lastSeen: now });
                } else if (socket.userRole === 'customer') {
                    const User = require('../models/User-model');
                    await User.findByIdAndUpdate(userId, { lastSeen: now });
                }
            } catch (err) {
                console.error('Error updating lastSeen on disconnect:', err.message);
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
