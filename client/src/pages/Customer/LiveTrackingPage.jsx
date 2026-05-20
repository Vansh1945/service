import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import { 
  MapPin, Phone, Star, Shield, ArrowLeft, Navigation, Clock, ShieldCheck, HelpCircle, PhoneCall
} from 'lucide-react';
import { toast } from 'react-toastify';
import Loader from '../../components/Loader';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import * as BookingService from '../../services/BookingService';

const customerIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const providerIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

const MapBoundsHelper = ({ providerLoc, targetLat, targetLng }) => {
  const map = useMap();
  React.useEffect(() => {
    if (targetLat && targetLng) {
      if (providerLoc) {
        const bounds = L.latLngBounds([
          [targetLat, targetLng],
          [providerLoc.lat, providerLoc.lng]
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        map.setView([targetLat, targetLng], 15);
      }
    }
  }, [providerLoc, targetLat, targetLng, map]);
  return null;
};

const LiveTrackingPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { API, user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trackingState, setTrackingState] = useState({
    trackingEnabled: false,
    providerLiveLocation: null,
    providerReached: false,
    liveDistance: '',
    liveDuration: '',
    routeCoordinates: []
  });
  const [routeCoords, setRouteCoords] = useState([]);

  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        setLoading(true);
        const res = await BookingService.getBooking(bookingId);
        if (res.data?.success || res.status === 200) {
          const b = res.data.data;
          setBooking(b);
          setTrackingState({
            trackingEnabled: b.trackingEnabled || false,
            providerLiveLocation: b.providerLiveLocation || null,
            providerReached: b.providerReached || false,
            liveDistance: b.liveDistance || '',
            liveDuration: b.liveDuration || '',
            routeCoordinates: b.routeCoordinates || []
          });
        }
      } catch (err) {
        console.error("Error fetching booking details:", err);
        toast.error("Failed to load tracking page details");
      } finally {
        setLoading(false);
      }
    };

    if (bookingId) {
      fetchBookingDetails();
    }
  }, [bookingId]);

  useEffect(() => {
    if (!socket || !bookingId) return;

    socket.emit('join-booking-tracking', { bookingId });

    socket.on('tracking-started', (data) => {
      console.log('📡 Customer Tracking sync:', data);
      setTrackingState(data);
    });

    socket.on('provider-live-location', (data) => {
      console.log('📡 Customer location update:', data);
      setTrackingState(prev => ({
        ...prev,
        providerLiveLocation: { lat: data.latitude, lng: data.longitude },
        liveDistance: data.liveDistance,
        liveDuration: data.liveDuration,
        routeCoordinates: data.routeCoordinates,
        providerReached: data.providerReached
      }));
    });

    socket.on('provider-arrived', () => {
      setTrackingState(prev => ({ ...prev, providerReached: true }));
    });

    return () => {
      socket.emit('leave-booking-tracking', { bookingId });
      socket.off('tracking-started');
      socket.off('provider-live-location');
      socket.off('provider-arrived');
    };
  }, [socket, bookingId]);

  const provider = booking?.provider || booking?.providerDetails || null;

  const providerLoc = trackingState.providerLiveLocation || (
    provider?.currentLocation?.coordinates?.length === 2 && provider.currentLocation.coordinates[0] !== 0
      ? { lat: provider.currentLocation.coordinates[1], lng: provider.currentLocation.coordinates[0] }
      : null
  );

  useEffect(() => {
    if (!booking || !providerLoc) return;

    let targetLat = 28.5;
    let targetLng = 77.1;
    if (booking.address && typeof booking.address.lat === 'number' && typeof booking.address.lng === 'number') {
      targetLat = booking.address.lat;
      targetLng = booking.address.lng;
    }

    const fetchOSRMRoute = async () => {
      try {
        const pLat = providerLoc.lat;
        const pLng = providerLoc.lng;
        const url = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${targetLng},${targetLat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
          setRouteCoords(coords);
        }
      } catch (err) {
        console.error("Customer OSRM Route fetch failed:", err);
      }
    };

    fetchOSRMRoute();
  }, [booking, providerLoc]);

  const getStartPin = (b) => {
    if (!b) return '';
    return b.startPin || b.pin || (b.statusHistory && b.statusHistory.find(h => h.note?.includes('START_PIN'))?.note.match(/START_PIN:(\d+)/)?.[1]) || '1234';
  };

  const getCompletionPin = (b) => {
    if (!b) return '';
    return b.completionPin || (b.statusHistory && b.statusHistory.find(h => h.note?.includes('COMPLETION_PIN'))?.note.match(/COMPLETION_PIN:(\d+)/)?.[1]) || '5678';
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-secondary flex flex-col md:flex-row">
      
      {/* Top Header */}
      <div className="absolute top-4 left-4 z-30 flex items-center gap-3">
        <button 
          onClick={() => navigate('/customer/bookings')}
          className="flex items-center justify-center w-10 h-10 bg-white/95 backdrop-blur shadow-lg border border-gray-100 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-secondary" />
        </button>
        <div className="bg-white/95 backdrop-blur shadow-lg border border-gray-100 px-4 py-2 rounded-2xl flex flex-col">
          <span className="text-[10px] font-black text-primary uppercase tracking-wider">Live Tracking</span>
          <span className="text-xs font-bold text-secondary">{booking.services?.[0]?.service?.title || 'Service Delivery'}</span>
        </div>
      </div>

      {/* Leaflet Map Fullscreen Container */}
      <div className="w-full h-[60vh] md:h-full flex-grow relative z-10">
        <MapContainer center={[28.5, 77.1]} zoom={13} style={{ height: '100%', width: '100%', zIndex: 10 }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {booking && (() => {
            let targetLat = 28.5;
            let targetLng = 77.1;
            if (booking.address && typeof booking.address.lat === 'number' && typeof booking.address.lng === 'number') {
              targetLat = booking.address.lat;
              targetLng = booking.address.lng;
            } else if (booking.statusHistory) {
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
            return (
              <>
                <Marker position={[targetLat, targetLng]} icon={customerIcon} />
                {providerLoc && (
                  <Marker position={[providerLoc.lat, providerLoc.lng]} icon={providerIcon} />
                )}
                {routeCoords.length > 0 ? (
                  <Polyline positions={routeCoords} color="#00F0FF" weight={5} opacity={0.8} />
                ) : trackingState.routeCoordinates?.length > 0 && (
                  <Polyline positions={trackingState.routeCoordinates.map(c => [c.lat, c.lng])} color="#00F0FF" weight={4} opacity={0.8} />
                )}
                <MapBoundsHelper providerLoc={providerLoc} targetLat={targetLat} targetLng={targetLng} />
              </>
            );
          })()}
        </MapContainer>
      </div>

      {/* Split/Bottom Info Card */}
      <div className="w-full md:w-[420px] md:absolute md:right-6 md:top-6 md:bottom-6 z-20 flex flex-col justify-end p-4 pointer-events-none">
        <div className="w-full bg-white/95 backdrop-blur-md border border-gray-100 shadow-2xl rounded-3xl p-5 pointer-events-auto flex flex-col space-y-4 max-h-[85vh] overflow-y-auto">
          
          {/* Status Alert Overlay */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${trackingState.providerReached ? 'bg-green-500 animate-ping' : 'bg-primary animate-pulse'}`} />
              <span className="text-xs font-black text-secondary uppercase tracking-widest">
                {trackingState.providerReached 
                  ? 'Arrived at your Location' 
                  : booking.status === 'in-progress' || booking.status === 'in_progress'
                  ? 'Service In Progress'
                  : 'Professional En Route'}
              </span>
            </div>
            <span className="text-[10px] font-bold text-gray-400">ID: #{booking.bookingId || booking._id.slice(-8).toUpperCase()}</span>
          </div>

          {/* Time & Distance Glass Card */}
          <div className="grid grid-cols-2 gap-3 bg-gradient-to-r from-primary/5 to-blue-500/5 border border-primary/10 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Estimated ETA</p>
                <p className="text-sm font-black text-secondary">{trackingState.liveDuration || 'Calculating...'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-l border-gray-100 pl-3">
              <div className="w-10 h-10 bg-teal-50 border border-teal-100 rounded-xl flex items-center justify-center text-teal-600 shrink-0">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase">Distance</p>
                <p className="text-sm font-black text-secondary">{trackingState.liveDistance || 'Calculating...'}</p>
              </div>
            </div>
          </div>

          {/* Verification Code Box */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
              <span className="text-xs font-bold text-secondary">
                {['in-progress', 'in_progress'].includes(booking.status) 
                  ? 'Completion PIN Code' 
                  : 'Arrival Start PIN Code'}
              </span>
            </div>
            <div className="bg-white rounded-xl p-3 border border-blue-50/50 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-blue-600/60 uppercase tracking-widest mb-0.5">Share with provider</p>
                <p className="text-2xl font-black text-secondary tracking-widest font-mono">
                  {['in-progress', 'in_progress'].includes(booking.status) 
                    ? getCompletionPin(booking) 
                    : getStartPin(booking)}
                </p>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed max-w-[150px]">
                {['in-progress', 'in_progress'].includes(booking.status)
                  ? 'Provide completion PIN only after work satisfies requirements.'
                  : 'Provide start PIN when professional arrives to initiate service.'}
              </p>
            </div>
          </div>

          {/* Provider details */}
          {provider ? (
            <div className="border-t border-gray-100 pt-4 flex gap-4 items-center">
              <div className="relative shrink-0">
                <img 
                  src={provider.profilePicUrl || 'https://placehold.co/100x100?text=Avatar'} 
                  alt={provider.name} 
                  className="w-14 h-14 object-cover rounded-full border-2 border-primary/20 shadow-md"
                />
                <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center" />
              </div>
              <div className="flex-grow min-w-0">
                <h4 className="font-black text-secondary text-sm truncate">{provider.name}</h4>
                <p className="text-[10px] text-gray-400 font-bold mb-1">Your Certified Technician</p>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-0.5 font-bold text-amber-500 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md">
                    <Star className="w-3 h-3 fill-amber-500" />
                    <span>{(provider.performanceScore?.rating || 5.0).toFixed(1)}</span>
                  </div>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-500 font-medium">{provider.completedBookings || 0} completed jobs</span>
                </div>
              </div>
              
              {/* Call Professional button */}
              {provider.phone && (
                <a 
                  href={`tel:${provider.phone}`}
                  className="w-11 h-11 bg-primary text-white border border-primary/10 rounded-full flex items-center justify-center hover:bg-primary/95 transition-all shadow-md active:scale-95 shrink-0"
                >
                  <PhoneCall className="w-5 h-5" />
                </a>
              )}
            </div>
          ) : (
            <div className="py-4 text-center border border-dashed border-gray-100 rounded-2xl">
              <HelpCircle className="w-8 h-8 text-gray-300 mx-auto mb-1" />
              <p className="text-xs font-semibold text-gray-500">Assigning service professional...</p>
            </div>
          )}

          {/* Customer support button */}
          <button 
            onClick={() => navigate('/customer/complaints')}
            className="w-full py-2.5 text-xs font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" /> Need Help? Contact Customer Support
          </button>

        </div>
      </div>

    </div>
  );
};

export default LiveTrackingPage;
