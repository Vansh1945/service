import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import * as AdminService from '../../services/AdminService';
import * as ZoneService from '../../services/ZoneService';
import * as BookingService from '../../services/BookingService';
import * as ComplaintService from '../../services/ComplaintService';

import Loader from '../../components/ui-skeletons/Loader';
import { MapContainer, TileLayer, Marker, Tooltip, Popup, useMap, Polyline, Polygon, ZoomControl, LayersControl, Circle, FeatureGroup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { useNavigate } from 'react-router-dom';
import {
  Navigation, Search, Wifi, Layers,
  RefreshCw, AlertCircle, Clock, MessageSquare,
  X, Ticket, Briefcase, Zap, BarChart3
} from 'lucide-react';

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

const transparentIcon = L.divIcon({
  className: 'bg-transparent',
  html: '<div style="width: 40px; height: 40px;"></div>',
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

const legacyZonePopupEnabled = false;

// Distance helper using Haversine formula (returns distance in km)
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
};

// Calculate ETA based on distance (assuming avg 20 km/h in traffic + 3 min buffer)
const calculateETA = (distanceKm) => {
  if (!distanceKm) return 0;
  const timeHours = distanceKm / 20;
  const timeMinutes = Math.round(timeHours * 60) + 3;
  return timeMinutes;
};

const isValidLatLng = (pair) => {
  if (!Array.isArray(pair) || pair.length < 2) return false;
  const lat = Number(pair[0]);
  const lng = Number(pair[1]);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90
    && Math.abs(lng) <= 180
    && !(lat === 0 && lng === 0);
};

const getZoneId = (zone) => zone?._id || zone?.id;

const normalizeZoneCoordinates = (zone) => {
  const polygonCoords = zone?.polygon?.coordinates?.[0];
  const rawCoordinates = Array.isArray(polygonCoords)
    ? polygonCoords
    : (Array.isArray(zone?.coordinates) ? zone.coordinates : []);

  const normalized = rawCoordinates
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) return null;
      const first = Number(coord[0]);
      const second = Number(coord[1]);
      if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

      if (polygonCoords) return [second, first];
      if (Math.abs(first) > 90 && Math.abs(second) <= 90) return [second, first];
      return [first, second];
    })
    .filter(isValidLatLng);

  if (normalized.length > 1) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      normalized.pop();
    }
  }

  return normalized.length >= 3 ? normalized : [];
};

const normalizeZone = (zone) => {
  const zoneId = getZoneId(zone);
  return {
    ...zone,
    id: zoneId,
    _id: zoneId,
    coordinates: normalizeZoneCoordinates(zone),
    city: zone?.city || 'Unknown city',
    status: zone?.status || 'active',
    priority: zone?.priority || 'medium',
    maxProviders: zone?.maxProviders ?? 0,
    serviceRadius: zone?.serviceRadius ?? 0
  };
};

const isPointInPolygon = (lat, lng, polygon) => {
  if (!isValidLatLng([lat, lng]) || !Array.isArray(polygon) || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const latI = Number(polygon[i][0]);
    const lngI = Number(polygon[i][1]);
    const latJ = Number(polygon[j][0]);
    const lngJ = Number(polygon[j][1]);

    const intersects = ((lngI > lng) !== (lngJ > lng))
      && (lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI);

    if (intersects) inside = !inside;
  }
  return inside;
};

// Relative relative time formatter
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return 'Never';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return '5 sec ago';
  if (diffSec < 60) return `${diffSec} sec ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  return `${Math.floor(diffMin / 60)} hr ago`;
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

// Leaflet Heatmap Layer utilizing leaflet.heat with Green-Yellow-Red density zones
const HeatmapLayer = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !points) return;

    // Clean up any stray heat layers on the map to prevent duplicates
    map.eachLayer(layer => {
      if (layer && layer.options && layer.options.blur !== undefined) {
        try {
          map.removeLayer(layer);
        } catch (e) {
          console.error("Error removing stray heat layer:", e);
        }
      }
    });

    if (points.length === 0) return;

    const heatLayer = L.heatLayer(points, {
      radius: 40,
      blur: 25,
      maxZoom: 15,
      max: 1.0,
      gradient: {
        0.2: '#22c55e', // Green: Low demand
        0.6: '#eab308', // Yellow: Medium demand
        1.0: '#ef4444'  // Red: High demand (surge potential)
      }
    });

    heatLayer.addTo(map);

    return () => {
      try {
        map.removeLayer(heatLayer);
      } catch (e) {
        console.error("Error removing heat layer on unmount:", e);
      }
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

    const diff = Math.sqrt(Math.pow(endLat - startLat, 2) + Math.pow(endLng - startLng, 2));
    if (diff > 0.05) {
      setCurrentPos(position);
      return;
    }

    const duration = 3000;
    const startTime = performance.now();

    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const t = progress * (2 - progress); // easeOutQuad

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

const LiveTrackingPage = () => {
  const navigate = useNavigate();
  const { showToast } = useAuth();
  const { socket } = useSocket();
  const [providers, setProviders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('providers'); // 'providers', 'bookings', 'logs'
  const [liveLogs, setLiveLogs] = useState([]);
  const [mapCenter, setMapCenter] = useState([31.3260, 75.5762]); // Default center around Jalandhar
  const [mapZoom, setMapZoom] = useState(12);
  const [mapStyle] = useState('hybrid'); // 'satellite' (Esri World Imagery) or 'hybrid' (Google Satellite with Labels & 3D Terrain)
  const [showHeatmap] = useState(true);
  const [, setTick] = useState(0);
  const [actionHubModal, setActionHubModal] = useState({ open: false, zone: null });
  const [zones, setZones] = useState([]);
  const resolveZonePath = (zoneId) => {
    const path = [];
    let currentZone = zones.find(z => z.id === zoneId || z._id === zoneId);
    while (currentZone) {
      path.unshift(currentZone.name);
      const parentId = currentZone.parentZone?._id || currentZone.parentZone;
      if (parentId) {
        currentZone = zones.find(z => z.id === parentId || z._id === parentId);
      } else {
        currentZone = null;
      }
    }
    return path.length > 0 ? path.join(" > ") : "Global / Root";
  };

  // Keep timers ticking for last location update displays
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString();
    setLiveLogs(prev => [{ id: Date.now() + Math.random(), time, text }, ...prev].slice(0, 50));
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [provRes, bookRes, compRes, zoneRes] = await Promise.all([
        AdminService.getAllProviders(),
        BookingService.getAllBookings({ limit: 1000 }),
        ComplaintService.getAllComplaints().catch(() => ({ data: { data: [] } })),
        ZoneService.getAllZones({ limit: 1000 })
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

      const allZones = (Array.isArray(zoneRes.data?.zones) ? zoneRes.data.zones : (Array.isArray(zoneRes.data?.data) ? zoneRes.data.data : []))
        .map(normalizeZone)
        .filter(zone => zone.coordinates.length >= 3);

      setProviders(allProviders);
      setZones(allZones);
      setBookings(allBookings);
      setComplaints(allComplaints);

      addLog(`Command Core: Ingested ${allProviders.length} providers, ${allBookings.length} bookings, & ${allComplaints.length} complaints.`);

      // Focus map center to first active provider or booking if coordinates exist
      const activeProv = allProviders.find(p => p.isOnline && p.currentLocation?.coordinates?.length === 2 && p.currentLocation.coordinates[0] !== 0);
      if (activeProv) {
        setMapCenter([activeProv.currentLocation.coordinates[1], activeProv.currentLocation.coordinates[0]]);
      } else if (allBookings[0]?.address?.lat) {
        setMapCenter([allBookings[0].address.lat, allBookings[0].address.lng]);
      }

    } catch (err) {
      console.error("Error loading live tracking page:", err);
      if (showToast) showToast("Failed to retrieve live satellite telemetry", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Socket Telemetry Live Synchronization
  useEffect(() => {
    if (!socket) return;

    const handleProviderStatusChanged = ({ providerId, isOnline }) => {
      setProviders(prev => prev.map(p => {
        if (p._id === providerId) {
          addLog(`FLEET TELEMETRY: ${p.name || providerId} status changed to ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
          return { ...p, isOnline, isActive: isOnline };
        }
        return p;
      }));
    };

    const handleProviderMoving = (payload) => {
      const { providerId, latitude, longitude, speed } = payload;
      const now = Date.now();
      setProviders(prev => prev.map(p => {
        if (p._id === providerId) {
          addLog(`GPS STREAM: ${p.name || providerId} coordinates updated [${latitude.toFixed(5)}, ${longitude.toFixed(5)}] at ${speed ? speed + ' km/h' : 'moving speed'}`);
          return {
            ...p,
            currentLocation: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            lastLocationUpdate: now,
            speed: speed || 15 // mock 15km/h if moving
          };
        }
        return p;
      }));
    };

    const handleAdminBookingUpdate = ({ bookingId, event }) => {
      addLog(`DISPATCH DISCREPANCY: Booking ${bookingId} triggers event: ${event}`);
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

  // Compute status for color coding
  const getProviderComputedStatus = (provider) => {
    if (!provider.isOnline) return 'OFFLINE';

    // Find active booking for this provider
    const activeBooking = bookings.find(b =>
      ['accepted', 'in-progress', 'in_progress', 'arriving', 'started'].includes(b.status) &&
      (b.provider?._id === provider._id || b.provider === provider._id || (typeof b.provider === 'object' && b.provider?._id === provider._id))
    );

    if (!activeBooking) return 'AVAILABLE'; // 🟢 Available
    if (['accepted', 'arriving'].includes(activeBooking.status)) return 'ON_THE_WAY'; // 🟡 On the way
    return 'WORKING'; // 🔵 Working on booking
  };

  // Custom vehicle status colors and icons
  const getProviderMarkerIcon = (status) => {
    let color = '#22c55e'; // 🟢 Available
    let shadow = 'rgba(34, 197, 94, 0.2)';
    let pulseClass = 'animate-pulse';

    if (status === 'ON_THE_WAY') {
      color = '#eab308'; // 🟡 On the way
      shadow = 'rgba(234, 179, 8, 0.2)';
      pulseClass = '';
    } else if (status === 'WORKING') {
      color = '#3b82f6'; // 🔵 Working
      shadow = 'rgba(59, 130, 246, 0.2)';
      pulseClass = '';
    } else if (status === 'OFFLINE') {
      color = '#ef4444'; // 🔴 Offline
      shadow = 'rgba(239, 68, 68, 0.15)';
      pulseClass = '';
    }

    return L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center shadow-md" style="border-color: ${color}; box-shadow: 0 0 8px ${shadow};">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H9a2 2 0 0 0-2 2v7.5M3 16h2"/><circle cx="16.5" cy="16.5" r="2.5"/><circle cx="5.5" cy="16.5" r="2.5"/></svg>
          </div>
          <span class="w-3 h-3 rounded-full absolute -top-0.5 -right-0.5 border-2 border-white ${pulseClass}" style="background-color: ${color};"></span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  };

  // Customer marker styling
  const getCustomerMarkerIcon = (isRepeat) => {
    const color = isRepeat ? '#a855f7' : '#0D9488'; // Purple for repeat client, Teal for standard client
    return L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center shadow-md" style="border-color: ${color};">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <span class="w-3.5 h-3.5 rounded-full absolute -top-1 -right-1 border-2 border-white bg-teal-500 flex items-center justify-center text-[7px] text-white font-bold font-sans">${isRepeat ? '⭐' : 'U'}</span>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
  };

  const handleFocusProvider = (provider) => {
    const loc = provider.currentLocation;
    if (loc?.coordinates?.length === 2) {
      const lng = loc.coordinates[0];
      const lat = loc.coordinates[1];
      if (lat !== 0 && lng !== 0 && lat !== null && lng !== null) {
        setMapCenter([lat, lng]);
        setMapZoom(15);
        addLog(`Focusing satellite array: Specialist ${provider.name}`);
        return;
      }
    }
    if (showToast) {
      showToast(`${provider.name || 'Specialist'} is offline or GPS tracking is not active.`, 'warning');
    }
  };

  const handleFocusBooking = (booking) => {
    if (booking.address?.lat) {
      setMapCenter([booking.address.lat, booking.address.lng]);
      setMapZoom(15);
      addLog(`Focusing dispatch array: Booking ID ${booking.bookingId}`);
    }
  };

  // Filtering
  const filteredProviders = providers.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.serviceCategory?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeBookings = bookings.filter(b =>
    ['pending', 'accepted', 'in-progress', 'in_progress', 'arriving', 'scheduled', 'started'].includes(b.status)
  );

  const filteredBookings = activeBookings.filter(b =>
    b.bookingId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.services?.[0]?.serviceDetails?.title || b.services?.[0]?.service?.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProviderLatLng = (provider) => {
    const coords = provider?.currentLocation?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      const pair = [Number(coords[1]), Number(coords[0])];
      if (isValidLatLng(pair)) return pair;
    }

    const addressPair = [Number(provider?.address?.lat), Number(provider?.address?.lng)];
    return isValidLatLng(addressPair) ? addressPair : null;
  };

  const getBookingLatLng = (booking) => {
    const pair = [Number(booking?.address?.lat), Number(booking?.address?.lng)];
    return isValidLatLng(pair) ? pair : null;
  };

  const getZoneStats = (zone) => {
    const polygon = zone?.coordinates || [];
    const providersInZone = providers.filter(provider => {
      const position = getProviderLatLng(provider);
      return position && isPointInPolygon(position[0], position[1], polygon);
    });

    const bookingsInZone = bookings.filter(booking => {
      const position = getBookingLatLng(booking);
      return position && isPointInPolygon(position[0], position[1], polygon);
    });

    const activeBookingsInZone = bookingsInZone.filter(booking =>
      ['pending', 'accepted', 'in-progress', 'in_progress', 'arriving', 'scheduled', 'started'].includes(booking.status)
    );

    const customerMap = new Map();
    bookingsInZone.forEach((booking, index) => {
      const customer = booking.customer || {};
      const rawCustomerId = customer?._id || customer?.id || booking.customerId || booking.user?._id || booking.user || booking._id || index;
      const customerId = rawCustomerId?.toString?.() || String(rawCustomerId);
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          id: customerId,
          name: customer?.name || booking.customerName || 'Customer',
          phone: customer?.phone || booking.customerPhone || ''
        });
      }
    });

    return {
      providersCount: providersInZone.length,
      customersCount: customerMap.size,
      activeBookingsCount: activeBookingsInZone.length,
      providersPreview: providersInZone.slice(0, 2),
      customersPreview: Array.from(customerMap.values()).slice(0, 2)
    };
  };

  const renderZoneActionPopup = (zone) => {
    if (!zone) return null;

    const zoneId = getZoneId(zone);
    const zoneStats = getZoneStats(zone);

    let dotColor = 'bg-emerald-500';
    if (zone.status === 'inactive') dotColor = 'bg-gray-400';
    else if (zone.priority === 'high') dotColor = 'bg-red-500';
    else if (zone.priority === 'medium') dotColor = 'bg-amber-500';

    return (
      <div className="w-full font-sans text-secondary">
        {/* Header */}
        <div className="flex items-center gap-2 pb-2.5 pr-6 border-b border-gray-200">
          <span className={`w-3 h-3 rounded-full ${dotColor} shrink-0`}></span>
          <h3 className="text-sm font-black uppercase text-secondary tracking-wider leading-none">
            {zone.name}
          </h3>
        </div>

        {/* Details List */}
        <div className="py-2.5 space-y-2 text-[10px] font-black uppercase tracking-wider text-secondary/65">
          <div className="flex justify-between items-center">
            <span>City Hub:</span>
            <span className="text-secondary font-black text-right">{zone.city || 'N/A'}</span>
          </div>

          <div className="flex justify-between items-center">
            <span>Level:</span>
            <span className="text-secondary font-black text-right">{zone.zoneLevel || 'N/A'}</span>
          </div>

          <div className="flex justify-between items-center">
            <span>Status:</span>
            <span className={`font-black text-right ${zone.status === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>
              {zone.status || 'ACTIVE'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span>Max Providers:</span>
            <span className="text-secondary font-black text-right">{zone.maxProviders || '0'}</span>
          </div>

          <div className="flex justify-between items-center">
            <span>Radius Limit:</span>
            <span className="text-secondary font-black text-right">{zone.serviceRadius ? `${zone.serviceRadius} KM` : 'N/A'}</span>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200 my-1"></div>

        {/* Counts Statistics */}
        <div className="py-2.5 space-y-2 text-[10px] font-black uppercase tracking-wider">
          <div className="flex justify-between items-center">
            <span className="text-secondary/65">Providers Inside:</span>
            <span className="text-blue-600 text-xs font-black text-right">{zoneStats.providersCount}</span>
          </div>

          <div className="flex justify-between items-center text-[#a855f7]">
            <span className="font-extrabold">Customers:</span>
            <span className="text-xs font-black text-right">{zoneStats.customersCount}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-secondary/65">Total Bookings:</span>
            <span className="text-amber-600 text-xs font-black text-right">{zoneStats.activeBookingsCount}</span>
          </div>
        </div>

        {/* Bottom Action Buttons (2x2 Grid with Icon & Name) */}
        <div className="grid grid-cols-2 gap-2 border-t border-primary/10 pt-3 mt-1 text-[10px] font-bold uppercase tracking-wider">
          <button
            onClick={() => { window.location.href = `/admin/coupons?prefillZone=${zoneId}`; }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white"
            title="Create Coupon"
          >
            <Ticket className="h-3.5 w-3.5" />
            <span>Coupon</span>
          </button>
          <button
            onClick={() => { window.location.href = `/admin/commission?prefillZone=${zoneId}`; }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-secondary/10 text-secondary transition-all hover:bg-secondary hover:text-white"
            title="Set Commission"
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Commission</span>
          </button>
          <button
            onClick={() => { window.location.href = `/admin/surge?prefillZone=${zoneId}`; }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-accent/10 text-accent transition-all hover:bg-accent hover:text-white"
            title="Add Surge Charge"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Surge</span>
          </button>
          <button
            onClick={() => { window.location.href = `/admin/zone-management?analyticsZone=${zoneId}`; }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white"
            title="View Zone Stats"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Analytics</span>
          </button>
        </div>
      </div>
    );
  };

  // Compute Heatmap Points based on all bookings
  const heatmapPoints = bookings
    .map(getBookingLatLng)
    .filter(Boolean)
    .map(([lat, lng]) => [lat, lng, 0.85]);

  const renderedBookings = useMemo(() => {
    return bookings
      .map(book => {
        const position = getBookingLatLng(book);
        if (!position) return null;
        return (
          <Marker
            key={'heat-circle-' + book._id}
            position={position}
            icon={transparentIcon}
          >
            <Popup minWidth={240}>
              <div className="p-2 font-sans text-xs text-slate-900 text-left">
                <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                  Demand Point
                </span>
                <h4 className="font-extrabold text-slate-900 mt-2 uppercase tracking-wide">
                  Booking ID: {book.bookingId || book._id?.substring(0, 8)}
                </h4>
                <div className="mt-2 space-y-1 text-[11px] text-slate-700 border-t border-slate-100 pt-1.5 font-sans">
                  <p className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Client:</span>
                    <span className="font-black text-slate-800">{book.customer?.name || book.customerName || 'N/A'}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Service:</span>
                    <span className="font-black text-slate-800">
                      {book.services?.[0]?.serviceDetails?.title || book.services?.[0]?.service?.title || 'Premium Service'}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Status:</span>
                    <span className="font-black text-rose-600 uppercase">{book.status || 'PENDING'}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Amount:</span>
                    <span className="font-black text-slate-800">₹{book.totalAmount || book.price || 0}</span>
                  </p>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })
      .filter(Boolean);
  }, [bookings]);

  const renderedRoutes = useMemo(() => {
    return activeBookings.map((booking, idx) => {
      const bookingPosition = getBookingLatLng(booking);
      if (bookingPosition) {
        const provId = booking.provider?._id || booking.provider;
        const provider = providers.find(p => p._id === provId);
        const providerPosition = provider ? getProviderLatLng(provider) : null;
        if (providerPosition) {
          const [pLat, pLng] = providerPosition;
          const route = (Array.isArray(booking.routeCoordinates) && booking.routeCoordinates.length > 0
            ? booking.routeCoordinates.map(c => [c.lat ?? c[0], c.lng ?? c[1]])
            : [[pLat, pLng], bookingPosition])
            .map(coord => [Number(coord[0]), Number(coord[1])]);
          const isValidRoute = Array.isArray(route) && route.length >= 2 && route.every(isValidLatLng);
          if (!isValidRoute) return null;
          const dist = calculateDistanceKm(pLat, pLng, bookingPosition[0], bookingPosition[1]);
          const eta = calculateETA(dist);
          return (
            <Polyline
              key={'route-poly-' + booking._id + '-' + idx}
              positions={route}
              color="#3b82f6"
              weight={3.5}
              opacity={0.85}
              dashArray="6, 12"
            >
              <Popup minWidth={220}>
                <div className="p-2 font-sans text-slate-900">
                  <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Route Telemetry</span>
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase mt-0.5">Booking ID: {booking.bookingId}</h4>
                  <div className="space-y-1 text-[11px] text-slate-700 mt-2 border-t border-slate-100 pt-1.5">
                    <p className="flex justify-between"><span className="text-slate-400">Status:</span> <span className="font-extrabold text-blue-600 uppercase">{booking.status}</span></p>
                    <p className="flex justify-between"><span className="text-slate-400">Distance Remaining:</span> <span className="font-bold text-slate-800">{dist} km</span></p>
                    <p className="flex justify-between"><span className="text-slate-400">Calculated ETA:</span> <span className="font-bold text-teal-600">{eta} mins</span></p>
                  </div>
                </div>
              </Popup>
            </Polyline>
          );
        }
      }
      return null;
    }).filter(Boolean);
  }, [activeBookings, providers]);

  return (
    <div className="flex flex-col h-[calc(100vh-150px)] bg-neutral-50 text-neutral-800 overflow-hidden font-sans select-none rounded-xl border border-neutral-200 shadow-sm">
      {/* Top Telemetry Header Bar */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-[2] shadow-sm">
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold text-neutral-800 tracking-tight">
                Live Dispatch Center
              </h1>
              <p className="text-[10px] text-neutral-500 font-semibold flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
                Active Tracking Session
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 md:hidden shrink-0">
            <button
              onClick={() => navigate('/admin/chat-monitor')}
              className="p-2 bg-primary text-white rounded-lg transition-all active:scale-95 flex items-center justify-center shrink-0"
              title="Open Chat Monitor"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={fetchData}
              className="p-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg transition-all flex items-center justify-center shrink-0 text-primary"
            >
              <RefreshCw className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>

        {/* Global Summary Stats Widgets */}
        <div className="flex flex-row md:flex-wrap gap-2 md:gap-3 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide snap-x">
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 flex items-center space-x-2 shrink-0 snap-start">
            <span className="w-2 h-2 bg-success rounded-full" />
            <div>
              <p className="text-[9px] uppercase font-bold text-neutral-500">Available</p>
              <h3 className="text-xs font-bold text-neutral-800">{providers.filter(p => getProviderComputedStatus(p) === 'AVAILABLE').length}</h3>
            </div>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 flex items-center space-x-2 shrink-0 snap-start">
            <span className="w-2 h-2 bg-warning rounded-full" />
            <div>
              <p className="text-[9px] uppercase font-bold text-neutral-500">On The Way</p>
              <h3 className="text-xs font-bold text-neutral-800">{providers.filter(p => getProviderComputedStatus(p) === 'ON_THE_WAY').length}</h3>
            </div>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 flex items-center space-x-2 shrink-0 snap-start">
            <span className="w-2 h-2 bg-info rounded-full" />
            <div>
              <p className="text-[9px] uppercase font-bold text-neutral-500">Working</p>
              <h3 className="text-xs font-bold text-neutral-800">{providers.filter(p => getProviderComputedStatus(p) === 'WORKING').length}</h3>
            </div>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5 flex items-center space-x-2 shrink-0 snap-start">
            <span className="w-2 h-2 bg-danger rounded-full" />
            <div>
              <p className="text-[9px] uppercase font-bold text-neutral-500">Offline</p>
              <h3 className="text-xs font-bold text-neutral-800">{providers.filter(p => getProviderComputedStatus(p) === 'OFFLINE').length}</h3>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/chat-monitor')}
            className="hidden md:flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-teal-700 text-white rounded-lg font-semibold text-xs transition-all hover:scale-105 active:scale-95 shrink-0"
            title="Open Chat Monitor"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Monitor</span>
          </button>
          <button
            onClick={fetchData}
            className="hidden md:block p-2.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg transition-all hover:scale-105 active:scale-95 shrink-0"
            title="Refresh Live Data"
          >
            <RefreshCw className="w-4 h-4 text-primary" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col-reverse lg:flex-row overflow-hidden relative">
        {/* Left Side Sidebar - Telemetry Panel & Dispatch Control */}
        <div className="w-full lg:w-80 h-[40%] lg:h-full bg-white border-t lg:border-t-0 lg:border-r border-neutral-200 flex flex-col relative z-10 shrink-0">
          <div className="p-4 border-b border-neutral-200 shrink-0">
            {/* Nav Tabs */}
            <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 mb-3">
              <button
                onClick={() => { setActiveTab('providers'); setSearchQuery(''); }}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all uppercase tracking-wider ${activeTab === 'providers' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Fleet
              </button>
              <button
                onClick={() => { setActiveTab('bookings'); setSearchQuery(''); }}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all uppercase tracking-wider ${activeTab === 'bookings' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Bookings
              </button>
              <button
                onClick={() => { setActiveTab('logs'); setSearchQuery(''); }}
                className={`flex-1 py-1.5 rounded text-xs font-semibold transition-all uppercase tracking-wider ${activeTab === 'logs' ? 'bg-white text-neutral-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Logs
              </button>
            </div>

            {/* Filter Search Bar */}
            {activeTab !== 'logs' && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'providers' ? 'Filter fleet...' : 'Filter active jobs...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary/50 text-neutral-800 placeholder-neutral-400 transition-all"
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
            {/* FLEET LIST */}
            {activeTab === 'providers' && (
              filteredProviders.length > 0 ? (
                filteredProviders.map(provider => {
                  const status = getProviderComputedStatus(provider);
                  const hasLocation = provider.currentLocation?.coordinates?.length === 2 && provider.currentLocation.coordinates[0] !== 0;

                  return (
                    <div
                      key={provider._id}
                      onClick={() => handleFocusProvider(provider)}
                      className="p-3 bg-white hover:bg-gray-50 border border-gray-100 hover:border-gray-200 rounded-xl cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-150 flex items-center justify-center font-black text-sm uppercase text-primary group-hover:bg-gray-200 transition-colors">
                            {provider.name?.charAt(0) || 'P'}
                          </div>
                          <span
                            className="w-3 h-3 rounded-full border-2 border-white absolute -bottom-1 -right-1"
                            style={{
                              backgroundColor:
                                status === 'AVAILABLE' ? '#22c55e' :
                                  status === 'ON_THE_WAY' ? '#eab308' :
                                    status === 'WORKING' ? '#3b82f6' : '#ef4444'
                            }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-gray-800 group-hover:text-primary transition-colors truncate">{provider.name}</h4>
                          <p className="text-[10px] text-gray-500 truncate tracking-wide">{provider.serviceCategory || 'Specialist'}</p>
                          <p className="text-[8px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">ID: {provider.providerId || provider._id?.slice(-8)}</p>
                        </div>
                      </div>

                      {hasLocation ? (
                        <div className="flex flex-col items-end space-y-1">
                          <Navigation
                            className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-all transform group-hover:scale-110"
                            style={{
                              color:
                                status === 'AVAILABLE' ? '#22c55e' :
                                  status === 'ON_THE_WAY' ? '#eab308' :
                                    status === 'WORKING' ? '#3b82f6' : '#ef4444'
                            }}
                          />
                          {provider.speed && provider.speed > 0 && (
                            <span className="text-[8px] bg-teal-50 text-teal-700 px-1 rounded font-black border border-teal-100">{provider.speed} KM/H</span>
                          )}
                        </div>
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-gray-300" title="Telemetry Inactive" />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-gray-400 text-xs italic font-semibold">
                  No Providers matching query
                </div>
              )
            )}

            {/* ACTIVE BOOKINGS LIST */}
            {activeTab === 'bookings' && (
              filteredBookings.length > 0 ? (
                filteredBookings.map(booking => {
                  return (
                    <div
                      key={booking._id}
                      onClick={() => handleFocusBooking(booking)}
                      className="p-3 bg-white hover:bg-gray-50 border border-gray-100 hover:border-gray-200 rounded-xl cursor-pointer transition-all space-y-2 group shadow-sm"
                    >
                      <div className="flex justify-between items-center">
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-gray-100 border border-gray-250 text-primary group-hover:border-primary/30 transition-colors">
                          {booking.status}
                        </span>
                        <span className="text-[8px] font-mono font-extrabold text-gray-400 uppercase">#{booking.bookingId || booking._id?.slice(-8)}</span>
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-gray-800 group-hover:text-primary transition-colors truncate">
                          {booking.services?.[0]?.serviceDetails?.title || booking.services?.[0]?.service?.title || 'Premium Service'}
                        </h4>
                        <p className="text-[10px] text-gray-550 truncate mt-0.5">Customer: {booking.customer?.name || 'Client'}</p>
                      </div>
                      <div className="flex items-center justify-between text-[8px] text-gray-400 font-extrabold tracking-wider uppercase pt-1 border-t border-gray-100">
                        <span className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(booking.date).toLocaleDateString()}
                        </span>
                        {booking.totalAmount && (
                          <span className="text-emerald-600 font-black">₹{booking.totalAmount}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-gray-400 text-xs italic font-semibold">
                  No active bookings in queue
                </div>
              )
            )}

            {/* LIVE TELEMETRY LOGS */}
            {activeTab === 'logs' && (
              <div className="space-y-1.5">
                {liveLogs.length > 0 ? (
                  liveLogs.map(log => (
                    <div key={log.id} className="p-2 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[9px] leading-relaxed">
                      <div className="flex justify-between text-teal-700 mb-0.5 font-bold uppercase tracking-wider">
                        <span>📡 stream ingestion</span>
                        <span>{log.time}</span>
                      </div>
                      <p className="text-gray-700">{log.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-gray-400 text-xs italic font-semibold font-sans">
                    Listening for telemetry stream packages...
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer panel info */}
          <div className="p-2 md:p-3 bg-gray-50 border-t border-gray-200 text-center text-[8px] md:text-[9px] text-gray-400 uppercase tracking-widest font-black shrink-0 flex items-center justify-center gap-1.5 font-sans">
            <Wifi className="w-3 h-3 text-primary animate-pulse" />
            platform secure core v3.1
          </div>
        </div>

        {/* High Definition Map Canvas */}
        <div className="flex-1 h-[60%] lg:h-full relative bg-gray-100 z-0">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 z-20">
              <Loader />
              <p className="text-xs text-primary font-mono mt-4 animate-pulse uppercase tracking-widest">BOOTING SATELLITE CHANNELS...</p>
            </div>
          ) : (
            <div className="w-full h-full absolute inset-0">
              <MapContainer center={mapCenter} zoom={mapZoom} zoomControl={false} style={{ height: '100%', width: '100%', zIndex: 10 }}>
                <ZoomControl position="bottomright" />
                <LayersControl position="topright">
                  <LayersControl.BaseLayer checked name="Satellite Hybrid">
                    <TileLayer
                      attribution='&copy; Google Satellite'
                      url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                      maxZoom={20}
                    />
                  </LayersControl.BaseLayer>

                  <LayersControl.BaseLayer name="3D Street Map (Google)">
                    <TileLayer
                      attribution='&copy; Google Maps'
                      url="https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}"
                      maxZoom={20}
                    />
                  </LayersControl.BaseLayer>

                  <LayersControl.BaseLayer name="Fast Street Map">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      maxZoom={19}
                    />
                  </LayersControl.BaseLayer>

                  <LayersControl.Overlay checked={showHeatmap} name="Demand Heatmap">
                    <FeatureGroup>
                      <HeatmapLayer points={heatmapPoints} />
                      {renderedBookings}
                    </FeatureGroup>
                  </LayersControl.Overlay>

                  <LayersControl.Overlay checked name="Active Zones">
                    <FeatureGroup>
                      {zones.filter(zone => Array.isArray(zone.coordinates) && zone.coordinates.length >= 3).map(zone => {
                        let color = '#22c55e';
                        if (zone.status === 'inactive') color = '#9ca3af';
                        else if (zone.priority === 'high') color = '#ef4444';
                        else if (zone.priority === 'medium') color = '#eab308';
                        return (
                          <Polygon
                            key={'zone-poly-' + getZoneId(zone)}
                            positions={zone.coordinates}
                            pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 2 }}
                          >
                            <Tooltip sticky>
                              <span className="font-sans font-bold text-xs uppercase text-slate-800">{zone.name} Zone ({zone.city})</span>
                            </Tooltip>
                            <Popup minWidth={288} maxWidth={320} closeButton>
                              {renderZoneActionPopup(zone)}
                            </Popup>
                          </Polygon>
                        );
                      })}
                    </FeatureGroup>
                  </LayersControl.Overlay>

                  <LayersControl.Overlay checked name="Dispatch Routes">
                    <FeatureGroup>
                      {renderedRoutes}
                    </FeatureGroup>
                  </LayersControl.Overlay>
                </LayersControl>

                <MapCenterer center={mapCenter} zoom={mapZoom} />

                {/* Action Hub Modal */}
                {legacyZonePopupEnabled && actionHubModal.open && actionHubModal.zone && (
                  <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 border border-slate-300/50 rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4 relative overflow-hidden">
                      {/* Ambient background glow using theme colors */}
                      <div className="absolute -top-20 -left-20 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
                      <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                      <div className="flex justify-between items-start border-b border-slate-200/50 pb-3 relative z-10">
                        <div>
                          <span className="text-xs font-medium uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20">Zone action hub</span>
                          <h3 className="text-lg font-bold mt-2 text-gray-900 dark:text-gray-100">{actionHubModal.zone.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">📍 {actionHubModal.zone.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ID: {actionHubModal.zone.id}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Status: {actionHubModal.zone.status}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Priority: {actionHubModal.zone.priority}</p>
                        </div>
                        <button onClick={() => setActionHubModal({ open: false, zone: null })} className="p-2 rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all border border-gray-300/50">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid gap-3">
                        <button onClick={() => { window.location.href = `/admin/coupons?prefillZone=${actionHubModal.zone.id}`; }} className="flex items-center justify-between bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-300/50 p-4 rounded-lg transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20 group-hover:bg-teal-500/20 transition-all">🎟️</div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Create Coupon</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Configure geo‑restricted discounts</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 group-hover:text-gray-800 transition-colors">➔</span>
                        </button>
                        {/* Additional buttons for Commission and Surge can be added here */}
                      </div>
                    </div>
                  </div>
                )}



                {/* Render Customer Markers for Active Bookings */}
                {activeBookings.map((booking, idx) => {
                  const customerPosition = getBookingLatLng(booking);
                  if (customerPosition) {
                    const customer = booking.customer;
                    const totalBookings = customer?.totalBookings || 1;
                    const isRepeatCustomer = totalBookings > 1;

                    // Fetch customer complaints
                    const customerComplaints = complaints.filter(c =>
                      c.customer === customer?._id ||
                      (typeof c.customer === 'object' && c.customer?._id === customer?._id)
                    );
                    const complaintText = customerComplaints.length > 0
                      ? `${customerComplaints.length} active dispute(s)`
                      : 'No dispute history';

                    return (
                      <Marker
                        key={'cust-' + booking._id + '-' + idx}
                        position={customerPosition}
                        icon={getCustomerMarkerIcon(isRepeatCustomer)}
                      >
                        <Popup minWidth={260}>
                          <div className="p-2.5 font-sans text-slate-800">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                CLIENT DIRECTORY
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${isRepeatCustomer ? 'bg-purple-100 text-purple-900 border border-purple-200' : 'bg-teal-100 text-teal-900 border border-teal-200'}`}>
                                {isRepeatCustomer ? '⭐ Repeat Client' : '🆕 First Time Client'}
                              </span>
                            </div>

                            <h3 className="font-black text-sm text-slate-900">
                              {customer?.name || 'Premium Client'}
                            </h3>
                            <p className="text-[10px] text-indigo-500 font-extrabold uppercase tracking-wide mt-0.5">
                              {booking.services?.[0]?.serviceDetails?.title || booking.services?.[0]?.service?.title || 'Premium Service'}
                            </p>

                            <div className="mt-2.5 space-y-1.5 text-xs text-slate-700">
                              <p className="flex flex-col">
                                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider mb-0.5">Address:</span>
                                <span className="font-medium bg-slate-50 p-1.5 rounded border border-slate-100 leading-relaxed text-[11px]">{booking.address?.formattedAddress || `${booking.address?.houseNumber || ''} ${booking.address?.street || ''}, ${booking.address?.city || ''}`}</span>
                              </p>
                              <p className="flex justify-between items-center border-t border-slate-100 pt-1.5">
                                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Booking ID:</span>
                                <span className="font-mono font-black text-[10px] text-slate-800">
                                  {booking.bookingId}
                                </span>
                              </p>
                              <p className="flex justify-between items-center">
                                <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Complaint History:</span>
                                <span className={`font-black text-[10px] ${customerComplaints.length > 0 ? 'text-red-500' : 'text-slate-600'}`}>
                                  {complaintText}
                                </span>
                              </p>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  }
                  return null;
                })}

                {/* Render Providers */}
                {providers.map(provider => {
                  const status = getProviderComputedStatus(provider);
                  const providerPos = getProviderLatLng(provider);

                  if (providerPos) {
                    // Check active booking logic for telemetry details popup
                    const activeBooking = bookings.find(b =>
                      ['accepted', 'in-progress', 'in_progress', 'arriving', 'started'].includes(b.status) &&
                      (b.provider?._id === provider._id || b.provider === provider._id || (typeof b.provider === 'object' && b.provider?._id === provider._id))
                    );

                    let dist = 0;
                    let calculatedEta = 0;
                    const activeBookingPosition = getBookingLatLng(activeBooking);
                    if (activeBookingPosition) {
                      dist = calculateDistanceKm(providerPos[0], providerPos[1], activeBookingPosition[0], activeBookingPosition[1]);
                      calculatedEta = calculateETA(dist);
                    }

                    return (
                      <SmoothProviderMarker
                        key={provider._id}
                        position={providerPos}
                        icon={getProviderMarkerIcon(status)}
                      >
                        <Popup minWidth={260}>
                          <div className="p-2.5 font-sans text-slate-800">
                            {/* Header Status Card */}
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Specialist Telemetry
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                                status === 'ON_THE_WAY' ? 'bg-yellow-100 text-yellow-800' :
                                  status === 'WORKING' ? 'bg-blue-100 text-blue-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                {status.replace(/_/g, ' ')}
                              </span>
                            </div>

                            <h3 className="font-black text-sm text-slate-900">
                              {provider.name}
                            </h3>
                            <p className="text-[10px] text-teal-600 font-extrabold uppercase tracking-widest mt-0.5">
                              {provider.serviceCategory || 'Service Specialist'}
                            </p>

                            {/* Core Details Grid */}
                            <div className="mt-2 text-xs space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <p className="flex justify-between text-slate-600"><span className="font-bold">ID:</span> <span className="font-mono text-slate-800">{provider.providerId || provider._id}</span></p>
                              <p className="flex justify-between text-slate-600"><span className="font-bold">Phone:</span> <span className="font-bold text-slate-800">{provider.phone || 'N/A'}</span></p>
                              <p className="flex justify-between text-slate-600"><span className="font-bold">Coordinates:</span> <span className="font-mono text-[10px] text-slate-800">[{providerPos[0].toFixed(5)}, {providerPos[1].toFixed(5)}]</span></p>
                              <p className="flex justify-between text-slate-600"><span className="font-bold">Last Update:</span> <span className="font-bold text-slate-800">{formatRelativeTime(provider.lastLocationUpdate)}</span></p>
                              <p className="flex justify-between text-slate-600"><span className="font-bold">Speed:</span> <span className="font-bold text-teal-600">{provider.speed ? `${provider.speed} km/h` : '0 km/h'}</span></p>
                              <p className="flex justify-between text-slate-600"><span className="font-bold">Network status:</span> <span className="font-bold text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Connected (92ms)</span></p>
                              {activeBooking && (
                                <>
                                  <p className="flex justify-between text-slate-600"><span className="font-bold">Active Booking ID:</span> <span className="font-mono font-bold text-slate-800">{activeBooking.bookingId}</span></p>
                                  <p className="flex justify-between text-slate-600"><span className="font-bold">ETA:</span> <span className="font-bold text-primary">{calculatedEta} mins</span></p>
                                </>
                              )}
                            </div>
                          </div>
                        </Popup>
                        <Tooltip>
                          <div style={{ color: '#1f2937', padding: '2px', fontFamily: 'sans-serif' }}>
                            <h4 style={{ margin: '0 0 2px', fontWeight: 'bold', fontSize: '11px' }}>{provider.name}</h4>
                            <p style={{ margin: '0 0 2px', fontSize: '9px', color: '#4b5563' }}><b>Category:</b> {provider.serviceCategory || 'N/A'}</p>
                            <p style={{ margin: '0', fontSize: '9px', color: status === 'AVAILABLE' ? '#22c55e' : status === 'ON_THE_WAY' ? '#eab308' : status === 'WORKING' ? '#3b82f6' : '#ef4444' }}>
                              <b>Status:</b> {status.replace(/_/g, ' ')}
                            </p>
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
      </div >

      {/* Premium Action Hub Modal Overlay */}
      {
        legacyZonePopupEnabled && actionHubModal.open && actionHubModal.zone && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-slate-700/50 p-6 rounded-3xl shadow-2xl max-w-md w-full mx-4 space-y-6 relative overflow-hidden">
              {/* Ambient Background Glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-700/50 pb-4 relative z-10">
                <div>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    Zone action hub
                  </span>
                  <h3 className="text-xl font-bold mt-3 text-white tracking-tight leading-tight">
                    {actionHubModal.zone.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 font-medium flex items-center gap-1">
                    📍 {resolveZonePath(actionHubModal.zone.id)}
                  </p>
                </div>
                <button
                  onClick={() => setActionHubModal({ open: false, zone: null })}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all border border-slate-700/50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Grid */}
              <div className="grid grid-cols-1 gap-3 relative z-10 font-sans">
                <button
                  onClick={() => {
                    window.location.href = `/admin/coupons?prefillZone=${actionHubModal.zone.id}`;
                  }}
                  className="flex items-center justify-between bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600 p-4 rounded-2xl transition-all group cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-teal-500/10 text-teal-400 rounded-xl border border-teal-500/20 group-hover:bg-teal-500/20 transition-all">
                      🎟️
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">Create Coupon</p>
                      <p className="text-[10px] text-slate-400 mt-1">Configure geo-restricted discounts</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 group-hover:text-white transition-colors">➔</span>
                </button>

                <button
                  onClick={() => {
                    window.location.href = `/admin/commision?prefillZone=${actionHubModal.zone.id}`;
                  }}
                  className="flex items-center justify-between bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600 p-4 rounded-2xl transition-all group cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 group-hover:bg-blue-500/20 transition-all">
                      💼
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">Set Commission</p>
                      <p className="text-[10px] text-slate-400 mt-1">Adjust provider payout splits</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 group-hover:text-white transition-colors">➔</span>
                </button>

                <button
                  onClick={() => {
                    window.location.href = `/admin/surge?prefillZone=${actionHubModal.zone.id}`;
                  }}
                  className="flex items-center justify-between bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600 p-4 rounded-2xl transition-all group cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 group-hover:bg-amber-500/20 transition-all">
                      ⚡
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">Add Surge Charge</p>
                      <p className="text-[10px] text-slate-400 mt-1">Activate weather or traffic surcharges</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 group-hover:text-white transition-colors">➔</span>
                </button>

                <button
                  onClick={() => {
                    window.location.href = `/admin/zone-management?analyticsZone=${actionHubModal.zone.id}`;
                  }}
                  className="flex items-center justify-between bg-slate-800/80 hover:bg-slate-700 border border-slate-700/50 hover:border-slate-600 p-4 rounded-2xl transition-all group cursor-pointer text-left w-full"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-all">
                      📊
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white leading-none">View Zone Stats</p>
                      <p className="text-[10px] text-slate-400 mt-1">Review operational telemetry analytics</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 group-hover:text-white transition-colors">➔</span>
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default LiveTrackingPage;
