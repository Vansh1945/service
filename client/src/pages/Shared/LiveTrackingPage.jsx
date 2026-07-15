import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import {
  MapPin, Phone, Star, Shield, ArrowLeft, Navigation, Clock, ShieldCheck, HelpCircle, PhoneCall, MessageSquare
} from 'lucide-react';
import { toast } from 'react-toastify';
import Loader from '../../components/ui-skeletons/Loader';
import LiveTrackingMapUI from '../../components/LiveTrackingMapUI';
import * as BookingService from '../../services/BookingService';
import { filterGPSJitter } from '../../utils/format';

const calculateHaversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const routeKeyFor = (pLat, pLng, tLat, tLng) =>
  [pLat, pLng, tLat, tLng].map((value) => Number(value).toFixed(4)).join(',');

const LiveTrackingPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const isProvider = user?.role === 'provider';

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  // Unified State
  const [providerLoc, setProviderLoc] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeSource, setRouteSource] = useState('none');
  const [eta, setEta] = useState('');
  const [distance, setDistance] = useState('');
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [providerReached, setProviderReached] = useState(false);

  // Resolve Customer Target Location
  const { lat: targetLat, lng: targetLng } = useMemo(() => {
    if (!booking) return { lat: 31.3260, lng: 75.5761 }; // Jalandhar default
    let lat = 31.3260;
    let lng = 75.5761;
    if (booking.address && booking.address.lat != null && booking.address.lng != null) {
      const pLat = parseFloat(booking.address.lat);
      const pLng = parseFloat(booking.address.lng);
      if (!isNaN(pLat) && !isNaN(pLng) && (pLat !== 0 || pLng !== 0)) {
        lat = pLat;
        lng = pLng;
      }
    } else if (booking.statusHistory) {
      for (const h of booking.statusHistory) {
        if (h.note) {
          const match = h.note.match(/TARGET_LOCATION:([-\d.]+),([-\d.]+)/);
          if (match) {
            lat = parseFloat(match[1]);
            lng = parseFloat(match[2]);
            break;
          }
        }
      }
    }
    return { lat, lng };
  }, [booking]);

  // Fetch Booking Details based on Role
  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        setLoading(true);
        let res;
        if (isProvider) {
          res = await BookingService.getProviderBookingById(bookingId);
        } else {
          res = await BookingService.getBooking(bookingId);
        }

        if (res?.data?.success || res?.status === 200) {
          const b = res.data.data;
          setBooking(b);

          if (!isProvider) {
            setProviderReached(b.providerReached || false);
            setDistance(b.liveDistance || '');
            setEta(b.liveDuration || '');

            const providerDetails = b.provider || b.providerDetails;
            let initialLoc = b.providerLiveLocation;
            if (!initialLoc && providerDetails?.currentLocation?.coordinates?.length === 2) {
              const coords = providerDetails.currentLocation.coordinates;
              if (coords[0] !== 0 && coords[1] !== 0) {
                initialLoc = { lat: coords[1], lng: coords[0] };
              }
            }
            if (initialLoc) setProviderLoc(initialLoc);

            if (b.routeCoordinates?.length > 2) {
              setRouteCoords(b.routeCoordinates.map((c) => [c.lat, c.lng]));
              setRouteSource('road');
              setLoadingRoute(false);
            } else if (initialLoc && b.address?.lat != null && b.address?.lng != null) {
              const tLat = parseFloat(b.address.lat);
              const tLng = parseFloat(b.address.lng);
              if (!isNaN(tLat) && !isNaN(tLng)) {
                if (!b.liveDistance) {
                  const km = calculateHaversine(initialLoc.lat, initialLoc.lng, tLat, tLng);
                  setDistance(`${(km * 1.2).toFixed(1)} km`);
                  setEta(`${Math.max(2, Math.round((km * 1.2 / 25) * 60))} mins`);
                }
                setRouteCoords([]);
                setRouteSource('none');
                setLoadingRoute(true);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching booking details:", err);
        toast.error("Failed to load tracking details");
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) fetchBookingDetails();
  }, [bookingId, isProvider]);

  // Tracking and stability refs
  const bookingRef = useRef(null);
  const targetLocRef = useRef({ lat: 31.3260, lng: 75.5761 });
  const lastProviderPosRef = useRef(null);
  const routeFetchInFlightRef = useRef(false);
  const routeTimeoutRef = useRef(null);
  const routeRequestKeyRef = useRef('');

  // Keep refs synchronized with active states/props
  useEffect(() => {
    bookingRef.current = booking;
  }, [booking]);

  useEffect(() => {
    targetLocRef.current = { lat: targetLat, lng: targetLng };
  }, [targetLat, targetLng]);

  // Set initial provider location for customer once booking details load
  useEffect(() => {
    if (booking && !isProvider && !providerLoc) {
      const providerDetails = booking.provider || booking.providerDetails;
      let initialLoc = booking.providerLiveLocation;
      if (!initialLoc && providerDetails?.currentLocation?.coordinates?.length === 2) {
        const coords = providerDetails.currentLocation.coordinates;
        if (coords[0] !== 0 && coords[1] !== 0) {
          initialLoc = { lat: coords[1], lng: coords[0] };
        }
      }
      if (initialLoc) {
        setProviderLoc(initialLoc);
      }
    }
  }, [booking, isProvider, providerLoc]);

  const fetchClientRoute = useCallback(async (pLat, pLng, tLat, tLng) => {
    if (routeFetchInFlightRef.current) return;
    const routeKey = routeKeyFor(pLat, pLng, tLat, tLng);
    routeFetchInFlightRef.current = true;
    routeRequestKeyRef.current = routeKey;
    setLoadingRoute(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${tLng},${tLat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.[0]) {
        const route = data.routes[0];
        if (!route.geometry?.coordinates?.length) {
          throw new Error('Route geometry missing');
        }
        setDistance(`${(route.distance / 1000).toFixed(1)} km`);
        setEta(`${Math.max(1, Math.round(route.duration / 60))} mins`);
        setRouteCoords(route.geometry.coordinates.map((c) => [c[1], c[0]]));
        setRouteSource('road');
      } else {
        throw new Error(data.message || data.code || 'Road route not found');
      }
    } catch (err) {
      console.warn('Client route fallback:', err.message);
      setRouteCoords([[pLat, pLng], [tLat, tLng]]);
      setRouteSource('fallback');
      const km = calculateHaversine(pLat, pLng, tLat, tLng);
      setDistance(`${(km * 1.2).toFixed(1)} km`);
      setEta(`${Math.max(2, Math.round((km * 1.2 / 25) * 60))} mins`);
    } finally {
      routeFetchInFlightRef.current = false;
      setLoadingRoute(false);
    }
  }, []);

  // Max 6s loading overlay — then show map with straight-line fallback
  useEffect(() => {
    if (loading) return;
    routeTimeoutRef.current = setTimeout(() => {
      setLoadingRoute(false);
      if (providerLoc?.lat && targetLat && targetLng) {
        setRouteSource('fallback');
      }
      setRouteCoords((prev) => {
        if (prev.length > 1) return prev;
        if (providerLoc?.lat && targetLat && targetLng) {
          return [[providerLoc.lat, providerLoc.lng], [targetLat, targetLng]];
        }
        return prev;
      });
    }, 6000);
    return () => {
      if (routeTimeoutRef.current) clearTimeout(routeTimeoutRef.current);
    };
  }, [isProvider, loading, bookingId, providerLoc, targetLat, targetLng]);

  // Fetch road route when provider position is known but polyline missing
  useEffect(() => {
    if (!providerLoc?.lat || !targetLat || !targetLng) return;
    const nextRouteKey = routeKeyFor(providerLoc.lat, providerLoc.lng, targetLat, targetLng);
    if (routeRequestKeyRef.current === nextRouteKey && (routeSource === 'road' || routeSource === 'fallback')) {
      setLoadingRoute(false);
      return;
    }
    const t = setTimeout(() => {
      fetchClientRoute(providerLoc.lat, providerLoc.lng, targetLat, targetLng);
    }, 800);
    return () => clearTimeout(t);
  }, [isProvider, providerLoc, targetLat, targetLng, routeSource, fetchClientRoute]);

  // Stable watchPosition and socket setup: completely decoupled from mutable state refreshes
  useEffect(() => {
    if (!bookingId || !socket) return;

    let watchId = null;

    const applySocketRoute = (data) => {
      if (data.liveDistance) setDistance(data.liveDistance);
      if (data.liveDuration) setEta(data.liveDuration);
      if (data.routeCoordinates?.length > 2) {
        const coords = data.routeCoordinates.map((c) => [c.lat, c.lng]);
        setRouteCoords(coords);
        setRouteSource('road');
      }
      if (data.liveDistance || data.liveDuration || data.routeCoordinates?.length > 2) {
        setLoadingRoute(false);
      }
    };

    socket.on('tracking-started', (data) => {
      applySocketRoute(data);
      if (data.providerLiveLocation?.lat != null) {
        setProviderLoc({
          lat: data.providerLiveLocation.lat,
          lng: data.providerLiveLocation.lng
        });
      }
    });

    if (isProvider) {
      // -------------------------
      // PROVIDER LOGIC: Broadcast Location
      // -------------------------
      let lastUpdatedTime = 0;

      const handleLocationUpdate = (pos) => {
        const now = Date.now();
        if (now - lastUpdatedTime < 5000) return;
        lastUpdatedTime = now;

        const { latitude, longitude } = pos.coords;
        const smoothed = filterGPSJitter(
          lastProviderPosRef.current,
          { lat: latitude, lng: longitude },
          8
        );
        lastProviderPosRef.current = smoothed;

        setProviderLoc(smoothed);
        socket.emit('provider-location-update', {
          bookingId,
          latitude: smoothed.lat,
          longitude: smoothed.lng
        });
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          handleLocationUpdate,
          (err) => {
            console.warn("GPS High Accuracy failed:", err);
            // Fallback to Provider registered DB coords if GPS fails
            const provDB = bookingRef.current?.provider || bookingRef.current?.providerDetails;
            let fbLat = 31.3260, fbLng = 75.5761; // Jalandhar default

            if (provDB?.address?.lat != null && provDB?.address?.lng != null) {
              const pLat = parseFloat(provDB.address.lat);
              const pLng = parseFloat(provDB.address.lng);
              if (!isNaN(pLat) && !isNaN(pLng) && (pLat !== 0 || pLng !== 0)) {
                fbLat = pLat;
                fbLng = pLng;
              }
            } else if (provDB?.currentLocation?.coordinates?.length === 2 && provDB.currentLocation.coordinates[0] !== 0) {
              fbLat = provDB.currentLocation.coordinates[1];
              fbLng = provDB.currentLocation.coordinates[0];
            }

            handleLocationUpdate({ coords: { latitude: fbLat, longitude: fbLng } });
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
        );

        watchId = navigator.geolocation.watchPosition(
          handleLocationUpdate,
          (err) => console.error("GPS Watch Error:", err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        socket.on('provider-live-location', (data) => {
          applySocketRoute(data);
        });
      }
    } else {
      // -------------------------
      // CUSTOMER LOGIC: Receive Broadcasts
      // -------------------------
      socket.on('provider-live-location', (data) => {
        const smoothed = filterGPSJitter(
          lastProviderPosRef.current,
          { lat: data.latitude, lng: data.longitude },
          8
        );
        lastProviderPosRef.current = smoothed;
        setProviderLoc(smoothed);
        applySocketRoute(data);
        if (data.providerReached !== undefined) setProviderReached(data.providerReached);
      });

      socket.on('provider-arrived', () => {
        setProviderReached(true);
      });
    }

    socket.emit('join-booking-tracking', { bookingId });

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      socket.emit('leave-booking-tracking', { bookingId });
      socket.off('provider-live-location');
      socket.off('provider-arrived');
      socket.off('tracking-started');
    };
  }, [socket, bookingId, isProvider]);

  const getStartPin = (b) => {
    if (!b) return '';
    return b.startPin || b.pin || (b.statusHistory && b.statusHistory.find(h => h.note?.includes('START_PIN'))?.note.match(/START_PIN:(\d+)/)?.[1]) || '1234';
  };
  const getCompletionPin = (b) => {
    if (!b) return '';
    return b.completionPin || (b.statusHistory && b.statusHistory.find(h => h.note?.includes('COMPLETION_PIN'))?.note.match(/COMPLETION_PIN:(\d+)/)?.[1]) || '5678';
  };

  if (loading) return <Loader />;

  const otherUser = isProvider
    ? (booking?.customer || booking?.userDetails)
    : (booking?.provider || booking?.providerDetails);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-secondary">

      {/* Top Header */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-3">
        <button
          onClick={() => navigate(isProvider ? '/provider/booking-requests' : '/customer/bookings')}
          className="flex items-center justify-center w-10 h-10 bg-white/95 backdrop-blur shadow-lg border border-gray-100 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-secondary" />
        </button>
        <div className="bg-white/95 backdrop-blur shadow-lg border border-gray-100 px-3 py-1.5 md:px-4 md:py-2 rounded-2xl flex flex-col max-w-[170px] sm:max-w-xs md:max-w-none">
          <span className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-wider">Live Tracking</span>
          <span className="text-[11px] md:text-xs font-bold text-secondary truncate">
            {isProvider ? 'En Route' : (booking?.services?.[0]?.service?.title || 'Service Delivery')}
          </span>
        </div>
      </div>

      {/* Shared Leaflet Map UI */}
      <LiveTrackingMapUI
        targetLat={targetLat}
        targetLng={targetLng}
        providerLoc={providerLoc}
        routeCoords={routeCoords}
        loadingRoute={loadingRoute}
      />

      {/* Floating Bottom Sheet Card (Mobile & Web responsive) */}
      <div className="absolute bottom-6 left-4 right-4 md:right-6 md:left-auto md:w-[400px] z-[1000] pointer-events-auto bg-white/95 backdrop-blur-md rounded-[28px] shadow-2xl border border-gray-100 p-4 space-y-4">

        {/* 1. Provider Status Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">
              {isProvider ? 'Navigation Active' : (providerReached ? 'Arrived at Location' : 'Professional En Route')}
            </span>
          </div>
          <span className="text-[9.5px] font-black font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-250/30">
            ID: #{booking?.bookingId || booking?._id?.slice(-8).toUpperCase()}
          </span>
        </div>

        {/* 2. ETA & Distance Side by Side Cards */}
        <div className="grid grid-cols-2 gap-3 bg-slate-50/80 border border-slate-100/50 rounded-2xl p-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">Estimated ETA</span>
            <span className="text-lg font-black text-primary mt-0.5">{eta || '8 min'}</span>
          </div>
          <div className="flex flex-col border-l border-gray-200 pl-3">
            <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider">Distance</span>
            <span className="text-lg font-black text-secondary mt-0.5">{distance || '1.2 km'}</span>
          </div>
        </div>

        {/* 3. Secure Service PIN (Customer Only) */}
        {!isProvider && ['scheduled', 'accepted', 'inprogress', 'assigned', 'ontheway', 'arrived', 'started'].includes((booking?.status || '').toLowerCase().replace(/[^a-z]/g, '')) && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-3 flex items-center justify-between gap-3">
            <div>
              <span className="text-[9px] font-black text-blue-600/60 uppercase tracking-wider block mb-0.5">
                {['in-progress', 'in_progress'].includes(booking?.status) ? 'Completion PIN' : 'Start PIN'}
              </span>
              <span className="text-xl font-black text-secondary tracking-widest font-mono">
                {['in-progress', 'in_progress'].includes(booking?.status) ? getCompletionPin(booking) : getStartPin(booking)}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-semibold max-w-[170px] text-right">
              Share only when provider arrives.
            </p>
          </div>
        )}

        {/* 4. Provider / Customer Detail Card */}
        {otherUser && (
          <div className="flex items-center gap-3 bg-white/50 border border-gray-50 p-2.5 rounded-2xl shadow-sm">
            <img
              src={otherUser.profilePicUrl}
              alt={otherUser.name}
              className="w-11 h-11 object-cover rounded-full border-2 border-primary/10 shadow-sm shrink-0"
            />
            {isProvider ? (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-black text-slate-800 text-sm truncate leading-none">{otherUser.name}</h4>
                  <span className="bg-blue-50 text-blue-600 text-[8px] font-black uppercase px-1 py-0.5 rounded border border-blue-100">Customer</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-gray-500 flex-wrap leading-none">
                  <span>{otherUser.phone || 'No Phone Number'}</span>
                  <span>•</span>
                  <span>{booking?.address?.city || 'Nearby'}</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-black text-slate-800 text-sm truncate leading-none">{otherUser.name}</h4>
                  <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase px-1 py-0.5 rounded border border-emerald-100">Verified</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-gray-500 flex-wrap leading-none">
                  <span className="flex items-center gap-0.5 text-amber-500"><Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {(otherUser.rating || otherUser.performanceScore?.rating || 4.8).toFixed(1)}</span>
                  <span>•</span>
                  <span>{(otherUser.completedBookings || 125)} Jobs Completed</span>
                  <span>•</span>
                  <span>{distance || '1.2 km'} away</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Emergency Actions & Map Navigation (Provider Specific) */}
        {isProvider && booking?.status !== 'completed' && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 bg-primary text-white font-bold rounded-2xl text-xs hover:bg-primary/95 shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4 animate-bounce" /> Open Google Maps Navigation
          </a>
        )}

        {/* 6. Quick Action Buttons */}
        <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
          {otherUser?.phone && (
            <a
              href={`tel:${otherUser.phone}`}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          )}
          {!isProvider && (
            <button
              onClick={() => navigate('/customer/bookings')}
              className="flex items-center justify-center gap-1.5 py-2.5 bg-primary hover:bg-primary/95 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Bookings
            </button>
          )}
          <button
            onClick={() => navigate(isProvider ? '/provider/booking-requests' : '/customer/complaints')}
            className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <Shield className="w-3.5 h-3.5" /> Support
          </button>
        </div>

      </div>
    </div>
  );
};

export default LiveTrackingPage;
