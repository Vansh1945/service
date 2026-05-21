import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import * as AdminService from '../../services/AdminService';
import * as BookingService from '../../services/BookingService';
import * as ComplaintService from '../../services/ComplaintService';
import Loader from '../../components/Loader';
import { MapContainer, TileLayer, Marker, Circle, Tooltip, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

// Fix for default Leaflet marker assets in Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Rapido/Blinkit style dynamic Pulse Icons for orders/hotspots
const createPulseIcon = (color = 'green') => L.divIcon({
  className: 'bg-transparent',
  html: `<div class="radar-pulse-${color}" style="background-color: ${color}; width: 15px; height: 15px; border-radius: 50%; box-shadow: 0 0 10px ${color}, 0 0 20px ${color}; animation: pulse 1.5s infinite;"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
});

// Custom Vehicle Icons for Providers based on Status
const getProviderIcon = (status) => {
  let color = 'text-teal-600';
  let stroke = '#0d9488';
  let bgClass = '';
  
  if (status === 'OFFLINE') { color = 'text-gray-500'; stroke = '#6b7280'; }
  else if (status === 'BUSY') { color = 'text-red-500'; stroke = '#ef4444'; bgClass = 'animate-pulse'; }
  else if (status === 'IDLE') { color = 'text-blue-500'; stroke = '#3b82f6'; }
  else if (status === 'NOT_RESPONDING') { color = 'text-orange-500'; stroke = '#f97316'; bgClass = 'animate-bounce'; }
  else if (status === 'STUCK') { color = 'text-purple-500'; stroke = '#a855f7'; bgClass = 'animate-ping'; }

  return L.divIcon({
    className: 'bg-transparent',
    html: `<div class="vehicle-icon-marker ${bgClass}" style="background: white; border-radius: 50%; padding: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 2px solid ${stroke};">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H9a2 2 0 0 0-2 2v7.5M3 16h2"/><circle cx="16.5" cy="16.5" r="2.5"/><circle cx="5.5" cy="16.5" r="2.5"/></svg>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

// Distance helper in meters
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

// Custom component to handle smooth center updates
const MapCenterer = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => { 
    if (center && center[0] !== 0) {
      map.setView(center, zoom, { animate: true, duration: 1.5 }); 
    }
  }, [center, zoom, map]);
  return null;
};

// Custom Leaflet Heatmap Layer Component using leaflet.heat
const HeatmapLayer = ({ points }) => {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    
    const heatLayer = L.heatLayer(points, {
      radius: 35,
      blur: 20,
      maxZoom: 15,
      max: 1.0,
      gradient: { 
        0.4: '#10b981', // green
        0.7: '#facc15', // yellow
        1.0: '#ef4444'  // red
      }
    });
    
    heatLayer.addTo(map);
    
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);
  
  return null;
};

// Smooth Moving Marker Component for en-route providers
const SmoothProviderMarker = ({ position, icon, children }) => {
  const [currentPos, setCurrentPos] = useState(position);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!position || !position[0] || !position[1]) return;
    
    const startLat = currentPos[0];
    const startLng = currentPos[1];
    const endLat = position[0];
    const endLng = position[1];

    if (startLat === endLat && startLng === endLng) return;

    // Check if initial load or large jump (> 5km), set instantly
    const diff = Math.sqrt(Math.pow(endLat - startLat, 2) + Math.pow(endLng - startLng, 2));
    if (diff > 0.05) {
      setCurrentPos(position);
      return;
    }

    const duration = 3500; // Animate over 3.5 seconds
    const startTime = performance.now();

    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing curve (easeOutQuad)
      const t = progress * (2 - progress);

      const lat = startLat + (endLat - startLat) * t;
      const lng = startLng + (endLng - startLng) * t;

      setCurrentPos([lat, lng]);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [position]);

  return (
    <Marker position={currentPos} icon={icon}>
      {children}
    </Marker>
  );
};

import {
  MapPin, Users, Activity, Navigation, Search,
  RefreshCw, Map, Compass, ChevronRight, AlertCircle, ShieldAlert, CheckCircle2
} from 'lucide-react';

const LiveMapDashboard = () => {
  const { showToast } = useAuth();
  const { socket } = useSocket();
  const [providers, setProviders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('providers'); // 'providers', 'complaints', or 'logs'
  const [liveLogs, setLiveLogs] = useState([]);
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]);
  const [mapZoom, setMapZoom] = useState(12);
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem('admin_map_style') || 'dark'); // 'streets', 'voyager', or 'dark'
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [tick, setTick] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const [stats, setStats] = useState({
    activeCount: 0,
    bookingCount: 0,
    densityHotspots: 0,
    complaintsCount: 0,
    busyProviders: 0,
    idleProviders: 0,
    offlineProviders: 0,
    stuckProviders: 0
  });

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString();
    setLiveLogs(prev => [{ id: Date.now() + Math.random(), time, text }, ...prev].slice(0, 50));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [provRes, bookRes, compRes] = await Promise.all([
        AdminService.getAllProviders(),
        BookingService.getAllBookings({ limit: 1000, status: 'pending,accepted,in-progress,arriving,scheduled,started' }),
        ComplaintService.getAllComplaints().catch(() => ({ data: { data: [] } }))
      ]);

      const allProviders = Array.isArray(provRes.data?.providers)
        ? provRes.data.providers
        : (Array.isArray(provRes.data?.data) ? provRes.data.data : (Array.isArray(provRes.data) ? provRes.data : []));

      const allBookings = Array.isArray(bookRes.data?.data)
        ? bookRes.data.data
        : (Array.isArray(bookRes.data?.bookings) ? bookRes.data.bookings : (Array.isArray(bookRes.data) ? bookRes.data : []));

      const allComplaints = Array.isArray(compRes.data?.data)
        ? compRes.data.data
        : (Array.isArray(compRes.data) ? compRes.data : []);

      setProviders(allProviders);
      setBookings(allBookings);
      setComplaints(allComplaints);

      // Calculate statistics
      const activeCount = allProviders.filter(p => p.isOnline).length;
      const bookingCount = allBookings.length;
      const densityHotspots = allBookings.filter(b => b.status === 'in-progress' || b.status === 'accepted' || b.status === 'arriving').length;
      const complaintsCount = allComplaints.filter(c => ['submitted', 'under_review', 'provider_responded', 'Open', 'In-Progress'].includes(c.status)).length;

      setStats({
        activeCount,
        bookingCount,
        densityHotspots,
        complaintsCount
      });

      addLog(`System Ingest: Ingested ${allProviders.length} providers, ${allBookings.length} bookings, & ${allComplaints.length} complaints.`);

      // Center map to first online provider or booking
      const activeProv = allProviders.find(p => (p.isOnline || p.isActive) && p.currentLocation?.coordinates?.length === 2 && p.currentLocation.coordinates[0] !== 0);
      if (activeProv) {
        setMapCenter([activeProv.currentLocation.coordinates[1], activeProv.currentLocation.coordinates[0]]);
      } else if (allBookings[0]?.address?.lat) {
        setMapCenter([allBookings[0].address.lat, allBookings[0].address.lng]);
      }

    } catch (err) {
      console.error("Error loading dashboard data:", err);
      if (showToast) {
        showToast("Failed to retrieve live telemetry channels", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_map_style', mapStyle);
  }, [mapStyle]);

  // Socket Telemetry Live Synchronization
  useEffect(() => {
    if (!socket) return;

    const handleProviderStatusChanged = ({ providerId, isOnline }) => {
      setProviders(prev => prev.map(p => {
        if (p._id === providerId) {
          addLog(`FLEET EVENT: ${p.name || providerId} is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
          return { ...p, isOnline, isActive: isOnline };
        }
        return p;
      }));
      setStats(prev => ({
        ...prev,
        activeCount: Math.max(0, prev.activeCount + (isOnline ? 1 : -1))
      }));
    };

    const handleProviderMoving = (payload) => {
      const { providerId, latitude, longitude } = payload;
      const now = Date.now();
      setProviders(prev => prev.map(p => {
        if (p._id === providerId) {
          addLog(`LIVE TELEMETRY: ${p.name || providerId} coordinates updated [${latitude.toFixed(5)}, ${longitude.toFixed(5)}]`);
          
          let stuckStartTime = p.stuckStartTime;
          if (p.currentLocation && p.currentLocation.coordinates && p.currentLocation.coordinates[0] !== 0) {
            const dist = calculateDistance(p.currentLocation.coordinates[1], p.currentLocation.coordinates[0], latitude, longitude);
            if (dist < 10) { // Has not moved > 10m
              if (!stuckStartTime) stuckStartTime = now;
            } else {
              stuckStartTime = null; // Reset stuck timer
            }
          }

          return {
            ...p,
            currentLocation: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            lastLocationUpdate: now,
            stuckStartTime: stuckStartTime
          };
        }
        return p;
      }));
    };

    const handleAdminBookingUpdate = ({ bookingId, event }) => {
      addLog(`BOOKING DISPATCH: Booking ${bookingId} trigger update: ${event}`);
      fetchData();
    };

    socket.on('provider-status-changed', handleProviderStatusChanged);
    socket.on('provider-moving', handleProviderMoving);
    socket.on('admin-booking-update', handleAdminBookingUpdate);

    return () => {
      socket.off('provider-status-changed', handleProviderStatusChanged);
      socket.off('provider-moving', handleProviderMoving);
      socket.off('admin-booking-update', handleAdminBookingUpdate);
    };
  }, [socket]);

  const handleFocusProvider = (provider) => {
    const loc = provider.currentLocation;
    if (loc && loc.coordinates && loc.coordinates.length === 2) {
      const lng = loc.coordinates[0];
      const lat = loc.coordinates[1];
      if (lat !== 0 && lng !== 0) {
        setMapCenter([lat, lng]);
        setMapZoom(15);
        addLog(`Camera focus on specialist: ${provider.name}`);
      } else {
        showToast('Provider location coordinates not logged', 'warning');
      }
    }
  };

  const filteredProviders = providers.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Compute Heatmap Points from bookings
  const heatmapPoints = bookings
    .filter(b => b.address && typeof b.address.lat === 'number' && b.address.lat !== 0)
    .map(b => [b.address.lat, b.address.lng, 0.85]);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] -m-4 lg:-m-6 bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Telemetry Statistics Dashboard */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 md:gap-4 relative z-10 shadow-lg">
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/20 rounded-xl border border-primary/30 animate-pulse">
              <Map className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h1 className="text-sm md:text-base font-extrabold uppercase tracking-widest bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                Live Command Center
              </h1>
              <p className="text-[9px] md:text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Demand Density & Fleet Tracking</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="md:hidden p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all"
            title="Refresh Live Data"
          >
            <RefreshCw className="w-4 h-4 text-teal-400" />
          </button>
        </div>

        {/* Stats Summary Widgets */}
        <div className="flex flex-row md:flex-wrap gap-2 md:gap-3 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide snap-x">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center space-x-2 shrink-0 snap-start">
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full" />
            <div>
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">IDLE</p>
              <h3 className="text-xs font-black text-white">{providers.filter(p => p.computedStatus === 'IDLE').length}</h3>
            </div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            <div>
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">BUSY</p>
              <h3 className="text-xs font-black text-white">{providers.filter(p => p.computedStatus === 'BUSY').length}</h3>
            </div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce" />
            <div>
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">NO SIGNAL</p>
              <h3 className="text-xs font-black text-white">{providers.filter(p => p.computedStatus === 'NOT_RESPONDING').length}</h3>
            </div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center space-x-2 shrink-0 snap-start">
            <span className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-ping" />
            <div>
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">STUCK</p>
              <h3 className="text-xs font-black text-white">{providers.filter(p => p.computedStatus === 'STUCK').length}</h3>
            </div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-3 py-1.5 flex items-center space-x-2 shrink-0 snap-start">
            <Users className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">ACTIVE ORDERS</p>
              <h3 className="text-xs font-black text-white">{stats.densityHotspots}</h3>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="hidden md:block p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all hover:scale-105 active:scale-95 shrink-0"
            title="Refresh Live Data"
          >
            <RefreshCw className="w-4 h-4 text-teal-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col-reverse lg:flex-row overflow-hidden relative">
        {/* Left Side Sidebar - Control Console & Provider Dispatch */}
        <div className="w-full lg:w-80 h-[40%] lg:h-full bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col relative z-10 shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] lg:shadow-none">
          <div className="p-3 md:p-4 border-b border-slate-800 shrink-0">
            {/* Tab Swappers */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-3">
              <button
                onClick={() => setActiveTab('providers')}
                className={`flex-1 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all uppercase tracking-wider ${activeTab === 'providers' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Fleet
              </button>
              <button
                onClick={() => setActiveTab('complaints')}
                className={`flex-1 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all uppercase tracking-wider ${activeTab === 'complaints' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Disputes
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all uppercase tracking-wider ${activeTab === 'logs' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Feed
              </button>
            </div>

            {activeTab === 'providers' && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter active fleet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary/50 text-white placeholder-slate-500"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activeTab === 'providers' ? (
              filteredProviders.length > 0 ? (
                filteredProviders.map(provider => {
                  const hasLocation = provider.currentLocation?.coordinates?.length === 2 && provider.currentLocation.coordinates[0] !== 0;
                  return (
                    <div
                      key={provider._id}
                      onClick={() => handleFocusProvider(provider)}
                      className="p-3 bg-slate-850 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-lg bg-teal-950 border border-teal-800 flex items-center justify-center font-bold text-teal-400">
                            {provider.name?.charAt(0) || 'P'}
                          </div>
                          <span className={`w-2.5 h-2.5 rounded-full border border-slate-900 absolute -bottom-1 -right-1 ${provider.computedStatus === 'BUSY' ? 'bg-red-500 animate-pulse' : provider.computedStatus === 'IDLE' ? 'bg-blue-500' : provider.computedStatus === 'STUCK' ? 'bg-purple-500 animate-ping' : provider.computedStatus === 'NOT_RESPONDING' ? 'bg-orange-500' : 'bg-gray-500'}`} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">{provider.name}</h4>
                          <p className="text-[10px] text-slate-400 truncate">{provider.serviceCategory || 'Specialist'}</p>
                        </div>
                      </div>

                      {hasLocation ? (
                        <Navigation className={`w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all ${provider.computedStatus === 'BUSY' ? 'text-red-500' : provider.computedStatus === 'IDLE' ? 'text-blue-500' : provider.computedStatus === 'STUCK' ? 'text-purple-500 animate-ping' : provider.computedStatus === 'NOT_RESPONDING' ? 'text-orange-500 animate-bounce' : 'text-teal-400'}`} />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-slate-600" title="No coordinates" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center text-slate-500 text-xs italic">
                  No online specialists detected
                </div>
              )
            ) : activeTab === 'complaints' ? (
              /* Live Complaints Tab */
              complaints.length > 0 ? (
                complaints.map(complaint => (
                  <div 
                    key={complaint._id}
                    className="p-3 bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-red-950/60 border border-red-900 text-red-400">
                        {complaint.status}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">#{complaint.complaintId || complaint._id?.slice(-8)}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{complaint.title}</h4>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">{complaint.description}</p>
                    <div className="flex justify-between text-[8px] text-slate-500 font-medium">
                      <span>Category: {complaint.category}</span>
                      <span>{new Date(complaint.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center text-slate-500 text-xs italic">
                  No disputes reported
                </div>
              )
            ) : (
              /* Live Telemetry Logs Feed */
              <div className="space-y-2">
                {liveLogs.length > 0 ? (
                  liveLogs.map(log => (
                    <div key={log.id} className="p-2.5 bg-slate-950 border border-slate-850 rounded-lg font-mono text-[9px] leading-relaxed">
                      <div className="flex justify-between text-teal-400 mb-1 font-bold">
                        <span>📡 TELEMETRY INGEST</span>
                        <span>{log.time}</span>
                      </div>
                      <p className="text-slate-300">{log.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-20 text-center text-slate-500 text-xs italic">
                    Waiting for GPS stream data...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer of sidebar */}
          <div className="p-2 md:p-3 bg-slate-950 border-t border-slate-850 text-center text-[8px] md:text-[9px] text-slate-500 uppercase tracking-widest font-black shrink-0 hidden md:block">
            Platform dispatch secure console v3.0
          </div>
        </div>

        {/* Dynamic High Definition Map Canvas */}
        <div className="flex-1 h-[60%] lg:h-full relative bg-slate-900 z-0">
          {/* Heatmap Overlay Toggle Control */}
          <div className="absolute top-2 left-2 md:top-4 md:left-4 z-[1000] flex bg-slate-900/90 backdrop-blur border border-slate-700/60 p-1 md:p-1.5 rounded-xl shadow-2xl">
            <label className="flex items-center gap-1.5 md:gap-2 px-2 py-1 md:px-3 md:py-1.5 text-[9px] md:text-[10px] font-extrabold uppercase tracking-wider text-teal-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showHeatmap}
                onChange={(e) => setShowHeatmap(e.target.checked)}
                className="accent-teal-400 w-3 h-3 md:w-3.5 md:h-3.5 rounded border-slate-750 bg-slate-800"
              />
              <span className="hidden md:inline">Show Heatmap Zones</span>
              <span className="md:hidden">Heatmap</span>
            </label>
          </div>

          {/* Sleek Floating Map Style Selector */}
          <div className="absolute top-2 right-2 md:top-4 md:right-4 z-[1000] flex bg-slate-900/90 backdrop-blur border border-slate-700/60 p-1 rounded-xl shadow-2xl">
            <button
              onClick={() => setMapStyle('streets')}
              className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[8px] md:text-[10px] font-extrabold uppercase tracking-wider transition-all ${mapStyle === 'streets' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <span className="hidden md:inline">OSM Streets</span>
              <span className="md:hidden">Map</span>
            </button>
            <button
              onClick={() => setMapStyle('voyager')}
              className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[8px] md:text-[10px] font-extrabold uppercase tracking-wider transition-all ${mapStyle === 'voyager' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Voyager
            </button>
            <button
              onClick={() => setMapStyle('dark')}
              className={`px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-[8px] md:text-[10px] font-extrabold uppercase tracking-wider transition-all ${mapStyle === 'dark' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Dark
            </button>
          </div>

          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-20">
              <Loader />
              <p className="text-xs text-teal-400 font-mono mt-3 animate-pulse">BOOTING GEO-MAPPING CHANNELS...</p>
            </div>
          ) : (
            <div className="w-full h-full absolute inset-0">
              <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%', zIndex: 10 }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url={
                    mapStyle === 'streets'
                      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                      : mapStyle === 'voyager'
                        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                  }
                />
                <MapCenterer center={mapCenter} zoom={mapZoom} />

                {/* Leaflet Heatmap Layer */}
                {showHeatmap && heatmapPoints.length > 0 && (
                  <HeatmapLayer points={heatmapPoints} />
                )}

                {/* Bookings Layers */}
                {bookings.map((booking, idx) => {
                  if (booking.address && typeof booking.address.lat === 'number') {
                    const statusColor = booking.status === 'in-progress' ? '#10B981' : '#EF4444';
                    const pulseColor = booking.status === 'in-progress' ? 'green' : 'red';
                    return (
                      <React.Fragment key={'b' + idx}>
                        <Circle center={[booking.address.lat, booking.address.lng]} radius={600} pathOptions={{ color: statusColor, fillColor: statusColor, fillOpacity: 0.12, weight: 1 }} />
                        <Marker position={[booking.address.lat, booking.address.lng]} icon={createPulseIcon(pulseColor)}>
                          <Popup minWidth={240}>
                            <div className="p-2.5 font-sans text-slate-800">
                              <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  Booking Overlay
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${booking.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                    booking.status === 'in-progress' ? 'bg-teal-100 text-teal-800' :
                                      booking.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                                        booking.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                                          'bg-slate-100 text-slate-800'
                                  }`}>
                                  {booking.status}
                                </span>
                              </div>

                              <h3 className="font-extrabold text-sm text-slate-900 mb-1">
                                {booking.services?.[0]?.serviceDetails?.title || booking.services?.[0]?.service?.title || 'Premium Service'}
                              </h3>
                              <p className="text-[11px] text-slate-500 font-medium mb-2 uppercase tracking-wide">
                                ID: {booking.bookingId}
                              </p>

                              <div className="space-y-1.5 text-xs text-slate-700">
                                <p className="flex justify-between">
                                  <span className="text-slate-400 font-medium">Customer:</span>
                                  <span className="font-bold">{booking.customer?.name || 'Customer'}</span>
                                </p>
                                <p className="flex justify-between">
                                  <span className="text-slate-400 font-medium">Provider:</span>
                                  <span className={`font-bold ${booking.provider?.name ? 'text-primary' : 'text-amber-600'}`}>
                                    {booking.provider?.name || 'Awaiting Assignment'}
                                  </span>
                                </p>
                                <p className="flex justify-between">
                                  <span className="text-slate-400 font-medium">Scheduled Date:</span>
                                  <span className="font-semibold">{new Date(booking.date).toLocaleDateString()}</span>
                                </p>
                              </div>
                            </div>
                          </Popup>
                          <Tooltip>Booking: {booking.bookingId || 'Active Job'}</Tooltip>
                        </Marker>
                      </React.Fragment>
                    );
                  }
                  return null;
                })}

                {/* Live Active Booking Route Polylines */}
                {bookings.map((booking, idx) => {
                  if (booking.address && typeof booking.address.lat === 'number' && ['accepted', 'in-progress', 'in_progress', 'arriving'].includes(booking.status)) {
                    // Find active provider location from providers list
                    const provId = booking.provider?._id || booking.provider;
                    const provider = providers.find(p => p._id === provId);
                    if (provider && provider.currentLocation?.coordinates?.length === 2 && provider.currentLocation.coordinates[1] !== 0) {
                      const pLat = provider.currentLocation.coordinates[1];
                      const pLng = provider.currentLocation.coordinates[0];
                      const route = booking.routeCoordinates && booking.routeCoordinates.length > 0
                        ? booking.routeCoordinates.map(c => [c.lat || c[0], c.lng || c[1]])
                        : [[pLat, pLng], [booking.address.lat, booking.address.lng]];
                      return (
                        <Polyline
                          key={'route-' + booking._id + '-' + idx}
                          positions={route}
                          color="#10B981"
                          weight={4}
                          opacity={0.8}
                          dashArray="5, 10"
                        />
                      );
                    }
                  }
                  return null;
                })}

                {/* Providers */}
                {providers.map(provider => {
                  const loc = provider.currentLocation;
                  
                  // COMPUTE STATUS
                  const now = Date.now();
                  let computedStatus = 'OFFLINE';
                  
                  const activeBooking = bookings.find(b =>
                    b.provider?._id === provider._id ||
                    b.provider === provider._id ||
                    (typeof b.provider === 'object' && b.provider?._id === provider._id)
                  );
                  const isBusy = activeBooking && ['accepted', 'in-progress', 'in_progress', 'arriving', 'started'].includes(activeBooking.status);

                  if (!provider.isOnline) {
                    computedStatus = 'OFFLINE';
                  } else {
                    const timeSinceUpdate = provider.lastLocationUpdate ? (now - provider.lastLocationUpdate) : 0;
                    
                    if (provider.lastLocationUpdate && timeSinceUpdate > 30000) {
                      computedStatus = 'NOT_RESPONDING';
                    } else if (isBusy) {
                      const timeStuck = provider.stuckStartTime ? (now - provider.stuckStartTime) : 0;
                      if (timeStuck > 5 * 60 * 1000) {
                        computedStatus = 'STUCK';
                      } else {
                        computedStatus = 'BUSY';
                      }
                    } else {
                      computedStatus = 'IDLE';
                    }
                  }
                  provider.computedStatus = computedStatus;

                  if (loc && loc.coordinates && loc.coordinates.length === 2 && loc.coordinates[1] !== 0) {
                    const providerPos = [loc.coordinates[1], loc.coordinates[0]];
                    return (
                      <SmoothProviderMarker
                        key={provider._id}
                        position={providerPos}
                        icon={getProviderIcon(computedStatus)}
                      >
                        <Popup minWidth={240}>
                          <div className="p-2.5 font-sans text-slate-800">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Specialist Status
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${computedStatus === 'IDLE' ? 'bg-blue-100 text-blue-800' : computedStatus === 'BUSY' ? 'bg-red-100 text-red-800' : computedStatus === 'STUCK' ? 'bg-purple-100 text-purple-800' : computedStatus === 'NOT_RESPONDING' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                {computedStatus.replace('_', ' ')}
                              </span>
                            </div>

                            <h3 className="font-extrabold text-sm text-slate-900 mb-1">
                              {provider.name}
                            </h3>
                            <p className="text-[11px] text-slate-500 font-semibold mb-2 uppercase tracking-wide">
                              {provider.serviceCategory || 'Service Professional'}
                            </p>

                            {isBusy ? (
                                <div className="mt-2.5 pt-2.5 border-t border-slate-100 bg-teal-50/50 p-2 rounded-lg">
                                  <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-[9px] font-bold text-teal-800 uppercase tracking-wider">
                                      Active Booking
                                    </span>
                                    <span className="px-1.5 py-0.5 bg-teal-100 text-teal-900 rounded text-[8px] font-black uppercase">
                                      {activeBooking.status}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-[11px] text-slate-700">
                                    <p className="flex justify-between">
                                      <span className="text-slate-500">Booking ID:</span>
                                      <span className="font-bold">{activeBooking.bookingId}</span>
                                    </p>
                                    <p className="flex justify-between">
                                      <span className="text-slate-500">Customer:</span>
                                      <span className="font-semibold">{activeBooking.customer?.name || 'Client'}</span>
                                    </p>
                                    {activeBooking.liveDistance && (
                                      <p className="flex justify-between">
                                        <span className="text-slate-500">Distance / ETA:</span>
                                        <span className="font-semibold text-teal-600">{activeBooking.liveDistance} ({activeBooking.liveDuration})</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2 text-center py-1.5 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  ⚡ Awaiting Dispatch
                                </div>
                              )}
                          </div>
                        </Popup>
                        <Tooltip>
                          <div style={{ color: '#1f2937', padding: '2px', fontFamily: 'sans-serif' }}>
                            <h4 style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '12px' }}>{provider.name}</h4>
                            <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#4b5563' }}><b>Category:</b> {provider.serviceCategory || 'N/A'}</p>
                            <p style={{ margin: '0', fontSize: '10px', color: computedStatus === 'OFFLINE' ? '#6b7280' : computedStatus === 'BUSY' ? '#ef4444' : computedStatus === 'IDLE' ? '#3b82f6' : '#f97316' }}><b>Status:</b> {computedStatus.replace('_', ' ')}</p>
                          </div>
                        </Tooltip>
                      </SmoothProviderMarker>
                    );
                  }
                  return null;
                })}
              </MapContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMapDashboard;
