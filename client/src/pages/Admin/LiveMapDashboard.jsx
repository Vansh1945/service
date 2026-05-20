import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import * as AdminService from '../../services/AdminService';
import * as BookingService from '../../services/BookingService';
import Loader from '../../components/Loader';
import { MapContainer, TileLayer, Marker, Circle, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

const customerIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const onlineProviderIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
const offlineProviderIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

const MapCenterer = ({ center, zoom }) => {
  const map = useMap();
  React.useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
  return null;
};
import {
  MapPin, Users, Activity, Navigation, Search,
  RefreshCw, Map, Compass, ChevronRight, AlertCircle
} from 'lucide-react';

const LiveMapDashboard = () => {
  const { showToast } = useAuth();
  const { socket } = useSocket();
  const [providers, setProviders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('providers'); // providers or logs
  const [liveLogs, setLiveLogs] = useState([]);
  const [mapCenter, setMapCenter] = useState([28.6139, 77.2090]);
  const [mapZoom, setMapZoom] = useState(12);
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem('admin_map_style') || 'voyager'); // 'streets', 'voyager', or 'dark'
  const [stats, setStats] = useState({
    activeCount: 0,
    bookingCount: 0,
    densityHotspots: 0
  });

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString();
    setLiveLogs(prev => [{ id: Date.now() + Math.random(), time, text }, ...prev].slice(0, 50));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [provRes, bookRes] = await Promise.all([
        AdminService.getAllProviders(),
        BookingService.getAllBookings({ limit: 1000, status: 'pending,accepted,in-progress,arriving,scheduled,started' })
      ]);

      const allProviders = Array.isArray(provRes.data?.providers)
        ? provRes.data.providers
        : (Array.isArray(provRes.data?.data) ? provRes.data.data : (Array.isArray(provRes.data) ? provRes.data : []));

      const allBookings = Array.isArray(bookRes.data?.data)
        ? bookRes.data.data
        : (Array.isArray(bookRes.data?.bookings) ? bookRes.data.bookings : (Array.isArray(bookRes.data) ? bookRes.data : []));

      setProviders(allProviders);
      setBookings(allBookings);

      // Calculate statistics
      const activeCount = allProviders.filter(p => p.isOnline).length;
      const bookingCount = allBookings.length;
      const densityHotspots = allBookings.filter(b => b.status === 'in-progress' || b.status === 'accepted').length;

      setStats({
        activeCount,
        bookingCount,
        densityHotspots
      });

      addLog(`System initialization: Ingested ${allProviders.length} providers & ${allBookings.length} booking overlays`);

      // Default map center to first online provider or first booking
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
          addLog(`PROVIDER STATUS CHANGED: ${p.name || providerId} is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
          return { ...p, isOnline, isActive: isOnline };
        }
        return p;
      }));
      setStats(prev => ({
        ...prev,
        activeCount: prev.activeCount + (isOnline ? 1 : -1)
      }));
    };

    const handleProviderMoving = (payload) => {
      const { providerId, latitude, longitude } = payload;
      setProviders(prev => prev.map(p => {
        if (p._id === providerId) {
          addLog(`TELEMETRY INGEST: ${p.name || providerId} moved to [${latitude.toFixed(5)}, ${longitude.toFixed(5)}]`);
          return {
            ...p,
            currentLocation: {
              type: 'Point',
              coordinates: [longitude, latitude]
            }
          };
        }
        return p;
      }));
    };

    const handleAdminBookingUpdate = ({ bookingId, event }) => {
      addLog(`BOOKING UPDATE EVENT: Booking ID ${bookingId} trigger event: ${event}`);
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
        addLog(`Focused view on provider: ${provider.name}`);
      } else {
        showToast('Provider location coordinates not logged', 'warning');
      }
    }
  };

  const filteredProviders = providers.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] -m-4 lg:-m-6 bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Telemetry Statistics Dashboard */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap justify-between items-center gap-4 relative z-10 shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-primary/20 rounded-xl border border-primary/30 animate-pulse">
            <Map className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-base font-extrabold uppercase tracking-widest bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              Live Map Telemetry Dashboard
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Demand Density & Fleet Visualizer</p>
          </div>
        </div>

        {/* Stats Summary Widgets */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2 flex items-center space-x-3">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <div>
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Online Fleet</p>
              <h3 className="text-sm font-black text-white">{stats.activeCount} Providers</h3>
            </div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2 flex items-center space-x-3">
            <Users className="w-4 h-4 text-blue-400" />
            <div>
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Booking Overlays</p>
              <h3 className="text-sm font-black text-white">{stats.bookingCount} Hotspots</h3>
            </div>
          </div>
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-2 flex items-center space-x-3">
            <Activity className="w-4 h-4 text-rose-400" />
            <div>
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-400">Demand Density</p>
              <h3 className="text-sm font-black text-white">{stats.densityHotspots} Hotzones</h3>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all hover:scale-105 active:scale-95"
            title="Force refresh logs"
          >
            <RefreshCw className="w-4 h-4 text-teal-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side Sidebar - Control Console & Provider Dispatch */}
        <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full relative z-10 shrink-0">
          <div className="p-4 border-b border-slate-800">
            {/* Tab Swappers */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-3">
              <button
                onClick={() => setActiveTab('providers')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${activeTab === 'providers' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Fleet Status
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider ${activeTab === 'logs' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Live Feed
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
                          <span className={`w-2.5 h-2.5 rounded-full border border-slate-900 absolute -bottom-1 -right-1 ${provider.isActive ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">{provider.name}</h4>
                          <p className="text-[10px] text-slate-400 truncate">{provider.serviceCategory || 'Service Pro'}</p>
                        </div>
                      </div>

                      {hasLocation ? (
                        <Navigation className="w-3.5 h-3.5 text-teal-400 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-slate-600" title="No location coordinates logged" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-20 text-center text-slate-500 text-xs italic">
                  No online specialists detected
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
          <div className="p-3 bg-slate-950 border-t border-slate-850 text-center text-[9px] text-slate-500 uppercase tracking-widest font-black">
            Platform dispatch secure console v2.4
          </div>
        </div>

        {/* Dynamic High Definition Map Canvas */}
        <div className="flex-1 h-full relative bg-slate-900">
          {/* Sleek Floating Map Style Selector */}
          <div className="absolute top-4 right-4 z-[1000] flex bg-slate-900/90 backdrop-blur border border-slate-700/60 p-1 rounded-xl shadow-2xl">
            <button
              onClick={() => setMapStyle('streets')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all ${mapStyle === 'streets' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              OSM Streets
            </button>
            <button
              onClick={() => setMapStyle('voyager')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all ${mapStyle === 'voyager' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Voyager
            </button>
            <button
              onClick={() => setMapStyle('dark')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all ${mapStyle === 'dark' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              Dark Mode
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
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url={
                    mapStyle === 'streets'
                      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                      : mapStyle === 'voyager'
                        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
                        : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                  }
                />
                <MapCenterer center={mapCenter} zoom={mapZoom} />

                {/* Bookings Layers */}
                {bookings.map((booking, idx) => {
                  if (booking.address && typeof booking.address.lat === 'number') {
                    const statusColor = booking.status === 'in-progress' ? '#10B981' : '#EF4444';
                    return (
                      <React.Fragment key={'b' + idx}>
                        <Circle center={[booking.address.lat, booking.address.lng]} radius={600} pathOptions={{ color: statusColor, fillColor: statusColor, fillOpacity: 0.12, weight: 1 }} />
                        <Marker position={[booking.address.lat, booking.address.lng]} icon={customerIcon}>
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

                {/* Providers */}
                {providers.map(provider => {
                  const loc = provider.currentLocation;
                  if (loc && loc.coordinates && loc.coordinates.length === 2 && loc.coordinates[1] !== 0) {
                    return (
                      <Marker
                        key={provider._id}
                        position={[loc.coordinates[1], loc.coordinates[0]]}
                        icon={provider.isActive ? onlineProviderIcon : offlineProviderIcon}
                      >
                        <Popup minWidth={240}>
                          <div className="p-2.5 font-sans text-slate-800">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Specialist Status
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${provider.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                                }`}>
                                {provider.isActive ? 'Online' : 'Offline'}
                              </span>
                            </div>

                            <h3 className="font-extrabold text-sm text-slate-900 mb-1">
                              {provider.name}
                            </h3>
                            <p className="text-[11px] text-slate-500 font-semibold mb-2 uppercase tracking-wide">
                              {provider.serviceCategory || 'Service Professional'}
                            </p>

                            {(() => {
                              const activeBooking = bookings.find(b =>
                                b.provider?._id === provider._id ||
                                b.provider === provider._id ||
                                (typeof b.provider === 'object' && b.provider?._id === provider._id)
                              );

                              return activeBooking ? (
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
                              );
                            })()}
                          </div>
                        </Popup>
                        <Tooltip>
                          <div style={{ color: '#1f2937', padding: '2px', fontFamily: 'sans-serif' }}>
                            <h4 style={{ margin: '0 0 4px', fontWeight: 'bold', fontSize: '12px' }}>{provider.name}</h4>
                            <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#4b5563' }}><b>Category:</b> {provider.serviceCategory || 'N/A'}</p>
                            <p style={{ margin: '0', fontSize: '10px', color: '#10b981' }}><b>Status:</b> {provider.isActive ? 'Online & Ready' : 'Offline'}</p>
                          </div>
                        </Tooltip>
                      </Marker>
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
