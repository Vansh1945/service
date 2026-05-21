import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import { 
  MapPin, Phone, Star, Shield, ArrowLeft, Navigation, Clock, ShieldCheck, HelpCircle, PhoneCall
} from 'lucide-react';
import { toast } from 'react-toastify';
import Loader from '../../components/Loader';
import LiveTrackingMapUI from '../../components/LiveTrackingMapUI';
import * as BookingService from '../../services/BookingService';

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
            
            // Initial Provider Location from DB (MongoDB stores [longitude, latitude])
            const providerDetails = b.provider || b.providerDetails;
            let initialLoc = b.providerLiveLocation;
            if (!initialLoc && providerDetails?.currentLocation?.coordinates?.length === 2) {
              const coords = providerDetails.currentLocation.coordinates;
              if (coords[0] !== 0 && coords[1] !== 0) {
                 initialLoc = { lat: coords[1], lng: coords[0] };
              }
            }
            if (initialLoc) setProviderLoc(initialLoc);
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
  const lastOSRMPosRef = useRef(null);

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

  // Fetch initial route for customer once provider location is available
  useEffect(() => {
    if (!isProvider && providerLoc && routeCoords.length === 0 && targetLat && targetLng) {
      const fetchInitialRoute = async () => {
        try {
          setLoadingRoute(true);
          const url = `https://router.project-osrm.org/route/v1/driving/${providerLoc.lng},${providerLoc.lat};${targetLng},${targetLat}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            const distKm = (route.distance / 1000).toFixed(1);
            const durMin = Math.round(route.duration / 60);
            setEta(`${durMin} mins`);
            setDistance(`${distKm} km`);
            const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
            setRouteCoords(coords);
          }
        } catch (err) {
          console.error("Initial OSRM Route Error:", err);
        } finally {
          setLoadingRoute(false);
        }
      };
      fetchInitialRoute();
    }
  }, [isProvider, providerLoc, routeCoords.length, targetLat, targetLng]);

  // Stable watchPosition and socket setup: completely decoupled from mutable state refreshes
  useEffect(() => {
    if (!bookingId || !socket) return;

    let watchId = null;

    const fetchOSRMRoute = async (pLat, pLng) => {
      try {
        setLoadingRoute(true);
        const { lat: tLat, lng: tLng } = targetLocRef.current;
        const url = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${tLng},${tLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          const distKm = (route.distance / 1000).toFixed(1);
          const durMin = Math.round(route.duration / 60);
          
          setEta(`${durMin} mins`);
          setDistance(`${distKm} km`);
          
          const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
          setRouteCoords(coords);

          if (isProvider) {
            socket.emit('provider-location-update', {
              bookingId,
              latitude: pLat,
              longitude: pLng,
              liveDistance: `${distKm} km`,
              liveDuration: `${durMin} mins`
            });
          }
        }
      } catch (err) {
        console.error("OSRM Route Error:", err);
      } finally {
        setLoadingRoute(false);
      }
    };

    if (isProvider) {
      // -------------------------
      // PROVIDER LOGIC: Broadcast Location
      // -------------------------
      let lastUpdatedTime = 0;

      const handleLocationUpdate = (pos) => {
        const now = Date.now();
        if (now - lastUpdatedTime < 5000) return; // Throttle to every 5 seconds
        lastUpdatedTime = now;

        const { latitude, longitude } = pos.coords;
        const { lat: tLat, lng: tLng } = targetLocRef.current;
        
        const dist = calculateHaversine(latitude, longitude, tLat, tLng);
        const estDetourDist = dist * 1.25;
        const estTimeMin = Math.max(2, Math.round((estDetourDist / 25) * 60));

        setProviderLoc({ lat: latitude, lng: longitude });
        setDistance(`${estDetourDist.toFixed(1)} km`);
        setEta(`${estTimeMin} mins`);
        setRouteCoords(prev => prev.length === 0 ? [[latitude, longitude], [tLat, tLng]] : prev);
        
        socket.emit('provider-location-update', {
          bookingId, latitude, longitude,
          liveDistance: `${estDetourDist.toFixed(1)} km`,
          liveDuration: `${estTimeMin} mins`
        });

        // Throttle OSRM calls based on distance >= 15m
        let shouldFetchOSRM = false;
        if (!lastOSRMPosRef.current) {
          shouldFetchOSRM = true;
        } else {
          const delta = calculateHaversine(
            latitude,
            longitude,
            lastOSRMPosRef.current.lat,
            lastOSRMPosRef.current.lng
          );
          if (delta >= 0.015) { // 15 meters
            shouldFetchOSRM = true;
          }
        }

        if (shouldFetchOSRM) {
          lastOSRMPosRef.current = { lat: latitude, lng: longitude };
          fetchOSRMRoute(latitude, longitude);
        }
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
      }
    } else {
      // -------------------------
      // CUSTOMER LOGIC: Receive Broadcasts
      // -------------------------
      socket.on('provider-live-location', (data) => {
        setProviderLoc({ lat: data.latitude, lng: data.longitude });
        if (data.liveDistance) setDistance(data.liveDistance);
        if (data.liveDuration) setEta(data.liveDuration);
        if (data.routeCoordinates?.length > 0) {
           setRouteCoords(data.routeCoordinates.map(c => [c.lat, c.lng]));
        } else {
           let shouldFetchOSRM = false;
           if (!lastOSRMPosRef.current) {
             shouldFetchOSRM = true;
           } else {
             const delta = calculateHaversine(
               data.latitude,
               data.longitude,
               lastOSRMPosRef.current.lat,
               lastOSRMPosRef.current.lng
             );
             if (delta >= 0.015) {
               shouldFetchOSRM = true;
             }
           }
           if (shouldFetchOSRM) {
             lastOSRMPosRef.current = { lat: data.latitude, lng: data.longitude };
             fetchOSRMRoute(data.latitude, data.longitude);
           }
        }
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
    <div className="relative w-full h-screen overflow-hidden bg-secondary flex flex-col md:flex-row">
      
      {/* Top Header */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-3">
        <button 
          onClick={() => navigate(isProvider ? '/provider/booking-requests' : '/customer/bookings')}
          className="flex items-center justify-center w-10 h-10 bg-white/95 backdrop-blur shadow-lg border border-gray-100 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-secondary" />
        </button>
        <div className="bg-white/95 backdrop-blur shadow-lg border border-gray-100 px-4 py-2 rounded-2xl flex flex-col">
          <span className="text-[10px] font-black text-primary uppercase tracking-wider">Live Tracking</span>
          <span className="text-xs font-bold text-secondary">
            {isProvider ? 'En Route to Customer' : (booking?.services?.[0]?.service?.title || 'Service Delivery')}
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

      {/* Info Card (Customer vs Provider specific layouts) */}
      <div className="w-full md:w-[420px] md:absolute md:right-6 md:top-6 md:bottom-6 z-20 flex flex-col justify-end p-4 pointer-events-none">
        <div className="w-full bg-white/95 backdrop-blur-md border border-gray-100 shadow-2xl rounded-3xl p-5 pointer-events-auto flex flex-col space-y-4 max-h-[85vh] overflow-y-auto">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${providerReached ? 'bg-green-500 animate-ping' : 'bg-primary animate-pulse'}`} />
              <span className="text-xs font-black text-secondary uppercase tracking-widest">
                {isProvider ? 'LIVE NAVIGATION ACTIVE' : (
                  providerReached ? 'Arrived at your Location' :
                  (booking.status === 'in-progress' || booking.status === 'in_progress') ? 'Service In Progress' : 'Professional En Route'
                )}
              </span>
            </div>
            {isProvider ? (
              <div className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                GPS ON
              </div>
            ) : (
              <span className="text-[10px] font-bold text-gray-400">ID: #{booking?.bookingId || booking?._id?.slice(-8).toUpperCase()}</span>
            )}
          </div>

          <div className={`grid grid-cols-2 gap-3 rounded-2xl p-3 ${isProvider ? 'bg-gray-50 border border-gray-100' : 'bg-gradient-to-r from-primary/5 to-blue-500/5 border border-primary/10'}`}>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estimated ETA</span>
              <span className="text-lg font-black text-primary">{eta || '--'}</span>
            </div>
            <div className="flex flex-col border-l border-gray-200 pl-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Distance</span>
              <span className="text-lg font-black text-secondary">{distance || '--'}</span>
            </div>
          </div>

          {/* Customer Specific PIN Block */}
          {!isProvider && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
                <span className="text-xs font-bold text-secondary">
                  {['in-progress', 'in_progress'].includes(booking?.status) ? 'Completion PIN' : 'Arrival Start PIN'}
                </span>
              </div>
              <div className="bg-white rounded-xl p-3 border border-blue-50/50 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-blue-600/60 uppercase tracking-widest mb-0.5">Share with provider</p>
                  <p className="text-2xl font-black text-secondary tracking-widest font-mono">
                    {['in-progress', 'in_progress'].includes(booking?.status) ? getCompletionPin(booking) : getStartPin(booking)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* User Details (Provider seeing Customer OR Customer seeing Provider) */}
          {otherUser ? (
            <div className={`flex gap-4 items-center ${isProvider ? 'p-4 border border-gray-100 rounded-2xl bg-white shadow-sm' : 'border-t border-gray-100 pt-4'}`}>
              <div className="relative shrink-0">
                {isProvider ? (
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-base shadow-sm">
                    {otherUser.name?.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <>
                    <img src={otherUser.profilePicUrl || 'https://placehold.co/100x100?text=Avatar'} alt={otherUser.name} className="w-14 h-14 object-cover rounded-full border-2 border-primary/20 shadow-md"/>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center" />
                  </>
                )}
              </div>
              <div className="flex-grow min-w-0 flex flex-col">
                {isProvider && <span className="text-[10px] font-black text-primary uppercase tracking-widest">CUSTOMER</span>}
                <h4 className="font-black text-secondary text-sm truncate">{otherUser.name}</h4>
                {!isProvider && (
                  <div className="flex items-center gap-2 text-xs mb-1 mt-0.5">
                    <div className="flex items-center gap-0.5 font-bold text-amber-500 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md">
                      <Star className="w-3 h-3 fill-amber-500" />
                      <span>{(otherUser.performanceScore?.rating || 5.0).toFixed(1)}</span>
                    </div>
                  </div>
                )}
                {(!isProvider && otherUser.address) && (
                  <p className="text-[10px] text-gray-500 font-bold flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                    <span>{[otherUser.address.street, otherUser.address.city].filter(Boolean).join(', ')}</span>
                  </p>
                )}
                {isProvider && <span className="text-xs text-gray-500">{booking.address?.street}, {booking.address?.city}</span>}
              </div>
              
              {otherUser.phone && (
                <a href={`tel:${otherUser.phone}`} className={`${isProvider ? 'flex-1 inline-flex items-center justify-center py-2.5 bg-gray-50 text-secondary text-xs rounded-xl shadow-sm border border-gray-200' : 'w-11 h-11 bg-primary text-white rounded-full flex items-center justify-center shadow-md'}`}>
                  <PhoneCall className={isProvider ? "w-3.5 h-3.5 mr-2" : "w-5 h-5"} />
                  {isProvider ? 'Call' : ''}
                </a>
              )}
            </div>
          ) : (
            !isProvider && (
              <div className="py-4 text-center border border-dashed border-gray-100 rounded-2xl">
                <HelpCircle className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-500">Assigning service professional...</p>
              </div>
            )
          )}

          {!isProvider ? (
            <button onClick={() => navigate('/customer/complaints')} className="w-full py-2.5 text-xs font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-700 transition-colors flex items-center justify-center gap-2">
              <Shield className="w-4 h-4" /> Need Help? Contact Support
            </button>
          ) : (
            <div className="flex flex-col gap-2 w-full">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}&travelmode=driving`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-primary text-white font-bold rounded-2xl text-xs hover:bg-primary/95 shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Navigation className="w-4 h-4 animate-bounce" /> Open Google Maps Navigation
              </a>
              <button 
                onClick={() => navigate('/provider/booking-requests')} 
                className="w-full py-3 bg-secondary text-white font-bold rounded-2xl text-xs hover:bg-secondary/90 shadow-lg transition-all"
              >
                Return to Dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default LiveTrackingPage;
