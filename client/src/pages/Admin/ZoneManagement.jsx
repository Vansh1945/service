import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import StatsCard from '../../components/ui/StatsCard';
import * as BookingService from '../../services/BookingService';
import * as ZoneService from '../../services/ZoneService';
import AdminSearchBar from '../../components/AdminSearchBar';
import { MapContainer, TileLayer, Polygon, Polyline, Circle, Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Users, Zap, Trash2, Edit, X,
  Plus, RefreshCw, AlertTriangle, Layers,
  Compass, Eye, ShieldCheck, Activity, Award, ChevronDown, ChevronUp,
  Ticket, Briefcase, BarChart3
} from 'lucide-react';

// Fix default Leaflet markers in Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const legacyZonePopupEnabled = false;

// Point-in-Polygon (Ray-casting) spatial containment check
const isPointInPolygon = (lat, lng, polygon) => {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const latI = polygon[i][0];
    const lngI = polygon[i][1];
    const latJ = polygon[j][0];
    const lngJ = polygon[j][1];

    const intersect = ((lngI > lng) !== (lngJ > lng))
      && (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Calculate center of gravity for polygon to fly map
const getPolygonCenter = (coordinates) => {
  if (!coordinates || coordinates.length === 0) return [31.3260, 75.5762];
  const latSum = coordinates.reduce((sum, coord) => sum + coord[0], 0);
  const lngSum = coordinates.reduce((sum, coord) => sum + coord[1], 0);
  return [latSum / coordinates.length, lngSum / coordinates.length];
};

const generateApproximatedPolygon = (lat, lng, radiusKm = 2) => {
  const points = [];
  const numberOfSides = 12; // 12-sided polygon approximation
  const earthRadius = 6371; // km
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const d = radiusKm / earthRadius;

  for (let i = 0; i < numberOfSides; i++) {
    const angle = (i * 2 * Math.PI) / numberOfSides;
    const pointLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(d) +
      Math.cos(latRad) * Math.sin(d) * Math.cos(angle)
    );
    const pointLngRad = lngRad + Math.atan2(
      Math.sin(angle) * Math.sin(d) * Math.cos(latRad),
      Math.cos(d) - Math.sin(latRad) * Math.sin(pointLatRad)
    );
    points.push([
      (pointLatRad * 180) / Math.PI,
      (pointLngRad * 180) / Math.PI
    ]);
  }
  return points;
};

// Helper component to smoothly center Leaflet map
const MapCenterer = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0) {
      map.setView(center, zoom, { animate: true, duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
};

// Map click listener component for polygon vertex drawing
const MapDrawingEvents = ({ isDrawing, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      onMapClick(e.latlng);
    }
  });
  return null;
};

const mockProviders = [
  { _id: 'p-1', name: 'Amrinder Singh', serviceCategory: 'Electrician', isOnline: true, status: 'available', coords: [31.330, 75.580] },
  { _id: 'p-2', name: 'Rajesh Kumar', serviceCategory: 'Plumber', isOnline: true, status: 'busy', coords: [31.325, 75.572] },
  { _id: 'p-3', name: 'Gurbaksh Singh', serviceCategory: 'HVAC Specialist', isOnline: true, status: 'overloaded', coords: [31.335, 75.590] },
  { _id: 'p-4', name: 'Priya Sharma', serviceCategory: 'Cleaning', isOnline: true, status: 'available', coords: [31.135, 75.480] },
  { _id: 'p-5', name: 'Amit Verma', serviceCategory: 'Appliance Repair', isOnline: true, status: 'busy', coords: [31.220, 75.775] }
];
const defaultZones = [];

const ZoneManagement = () => {
  const { showToast } = useAuth();
  const loc = useLocation();
  const [zones, setZones] = useState([]);

  const [providers, setProviders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search, Filter and Collapse States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'map'

  // Drawing and Form States
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [geoQuery, setGeoQuery] = useState('');
  const [autoGenerating, setAutoGenerating] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    city: 'Jalandhar',
    priority: 'medium',
    status: 'active',
    maxProviders: 20,
    serviceRadius: 5,
    zoneLevel: 'city',
    parentZone: '',
    adjacentZones: []
  });

  // Sidebar, Tree and Analytics States
  const [sidebarTab, setSidebarTab] = useState('list'); // 'list' or 'tree'
  const [expandedNodes, setExpandedNodes] = useState({});
  const [filterLevel, setFilterLevel] = useState('');
  const [analyticsModal, setAnalyticsModal] = useState({ open: false, zone: null, loading: false });
  const [actionHubModal, setActionHubModal] = useState({ open: false, zone: null });

  // Modal and Map States
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [mapCenter, setMapCenter] = useState([31.3260, 75.5762]);
  const [mapZoom, setMapZoom] = useState(12);

  const resolveZonePath = useCallback((zoneId) => {
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
  }, [zones]);

  // Fetch zones from server
  const fetchZones = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ZoneService.getAllZones({ limit: 1000 });
      if (response && response.data && response.data.success) {
        const dbZones = response.data.data.map(z => {
          let coords = [];
          if (z.polygon && z.polygon.coordinates && z.polygon.coordinates[0]) {
            coords = z.polygon.coordinates[0].map(coord => [coord[1], coord[0]]);
            if (coords.length > 1 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]) {
              coords.pop();
            }
          }
          return {
            id: z._id,
            _id: z._id,
            name: z.name,
            city: z.city || 'Jalandhar',
            status: z.status,
            priority: z.priority,
            maxProviders: z.maxProviders,
            serviceRadius: z.serviceRadius,
            coordinates: coords,
            createdAt: z.createdAt,
            updatedAt: z.updatedAt,
            zoneLevel: z.zoneLevel || 'city',
            parentZone: z.parentZone,
            adjacentZones: z.adjacentZones || []
          };
        });
        setZones(dbZones.length > 0 ? dbZones : defaultZones);
      } else {
        setZones(defaultZones);
      }
    } catch (err) {
      console.error("Error fetching zones from backend:", err);
      setZones(defaultZones);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch provider and booking spatial coordinates from server
  const fetchTelemetry = useCallback(async () => {
    try {
      setLoading(true);
      const [provRes, bookRes, custRes] = await Promise.all([
        AdminService.getAllProviders().catch(() => null),
        BookingService.getAllBookings({ limit: 1000 }).catch(() => null),
        AdminService.getAllCustomers().catch(() => null)
      ]);

      if (provRes && provRes.data) {
        const allProviders = Array.isArray(provRes.data.providers)
          ? provRes.data.providers
          : (Array.isArray(provRes.data.data) ? provRes.data.data : (Array.isArray(provRes.data) ? provRes.data : []));
        if (allProviders.length > 0) {
          const mapped = allProviders.map(p => ({
            ...p,
            coords: p.currentLocation?.coordinates?.length === 2 && p.currentLocation.coordinates[0] !== 0
              ? [p.currentLocation.coordinates[1], p.currentLocation.coordinates[0]]
              : null,
            status: p.isOnline ? (p.status || 'available') : 'offline'
          })).filter(p => p.coords);
          if (mapped.length > 0) setProviders(mapped);
        }
      }

      if (bookRes && bookRes.data) {
        const allBookings = Array.isArray(bookRes.data.data)
          ? bookRes.data.data
          : (Array.isArray(bookRes.data.bookings) ? bookRes.data.bookings : (Array.isArray(bookRes.data) ? bookRes.data : []));
        if (allBookings.length > 0) {
          const mapped = allBookings.map(b => ({
            ...b,
            lat: b.address?.lat,
            lng: b.address?.lng
          })).filter(b => b.lat);
          if (mapped.length > 0) setBookings(mapped);
        }
      }

      if (custRes && custRes.data) {
        const allCustomers = Array.isArray(custRes.data.users)
          ? custRes.data.users
          : (Array.isArray(custRes.data.data) ? custRes.data.data : (Array.isArray(custRes.data) ? custRes.data : []));
        if (allCustomers.length > 0) {
          const mapped = allCustomers.map(c => ({
            ...c,
            lat: c.address?.lat || (c.currentLocation?.coordinates?.length === 2 ? c.currentLocation.coordinates[1] : null),
            lng: c.address?.lng || (c.currentLocation?.coordinates?.length === 2 ? c.currentLocation.coordinates[0] : null)
          })).filter(c => c.lat !== null && c.lat !== 0);
          if (mapped.length > 0) setCustomers(mapped);
        }
      }
    } catch (err) {
      console.error("Telemetry fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
    fetchTelemetry();
  }, [fetchZones, fetchTelemetry]);

  // Forward declaration of handleOpenAnalytics to satisfy dependency
  const handleOpenAnalytics = useCallback(async (zoneId) => {
    try {
      setAnalyticsModal({ open: true, zone: null, loading: true });
      const res = await ZoneService.getZoneById(zoneId);
      if (res.data?.success) {
        setAnalyticsModal({ open: true, zone: res.data.data, loading: false });
      } else {
        setAnalyticsModal({ open: false, zone: null, loading: false });
        if (showToast) showToast('Failed to fetch zone details', 'error');
      }
    } catch (err) {
      console.error('Error fetching zone details:', err);
      setAnalyticsModal({ open: false, zone: null, loading: false });
      if (showToast) showToast('Failed to fetch zone details', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    const params = new URLSearchParams(loc.search);
    const analyticsZone = params.get('analyticsZone');
    if (analyticsZone) {
      handleOpenAnalytics(analyticsZone);
    }
  }, [loc.search, handleOpenAnalytics]);

  // Compute spatial statistics inside a zone polygon dynamically
  const getZoneStats = useCallback((coordinates) => {
    let provCount = 0;
    let activeJobs = 0;
    let customerCount = 0;

    providers.forEach(p => {
      if (p.coords && isPointInPolygon(p.coords[0], p.coords[1], coordinates)) {
        provCount++;
      }
    });

    bookings.forEach(b => {
      if (isPointInPolygon(b.lat, b.lng, coordinates)) {
        activeJobs++;
      }
    });

    customers.forEach(c => {
      if (isPointInPolygon(c.lat, c.lng, coordinates)) {
        customerCount++;
      }
    });

    return {
      providersCount: provCount,
      activeBookingsCount: activeJobs,
      customerCount: customerCount
    };
  }, [providers, bookings, customers]);

  const getZoneMemberPreview = useCallback((coordinates) => {
    const providersPreview = providers
      .filter(provider => provider.coords && isPointInPolygon(provider.coords[0], provider.coords[1], coordinates))
      .slice(0, 2);

    const customersPreview = customers
      .filter(customer => isPointInPolygon(customer.lat, customer.lng, coordinates))
      .slice(0, 2);

    return { providersPreview, customersPreview };
  }, [providers, customers]);

  const renderZoneMapPopup = (zone, zoneStats) => {
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
            <span className="text-xs font-black text-right">{zoneStats.customerCount}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-secondary/65">Total Bookings:</span>
            <span className="text-amber-600 text-xs font-black text-right">{zoneStats.activeBookingsCount}</span>
          </div>
        </div>

        {/* Bottom Action Buttons (2x2 Grid with Icon & Name) */}
        <div className="grid grid-cols-2 gap-2 border-t border-primary/10 pt-3 mt-1 text-[10px] font-bold uppercase tracking-wider">
          <button
            onClick={() => { window.location.href = `/admin/coupons?prefillZone=${zone.id}`; }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary/10 text-primary transition-all hover:bg-primary hover:text-white"
            title="Create Coupon"
          >
            <Ticket className="h-3.5 w-3.5" />
            <span>Coupon</span>
          </button>
          <button
            onClick={() => { window.location.href = `/admin/commission?prefillZone=${zone.id}`; }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-secondary/10 text-secondary transition-all hover:bg-secondary hover:text-white"
            title="Set Commission"
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Commission</span>
          </button>
          <button
            onClick={() => { window.location.href = `/admin/surge?prefillZone=${zone.id}`; }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-accent/10 text-accent transition-all hover:bg-accent hover:text-white"
            title="Add Surge Charge"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Surge</span>
          </button>
          <button
            onClick={() => handleOpenAnalytics(zone.id)}
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

  // Color mapping based on Priority and Status
  const getZoneStyle = (status, priority) => {
    if (status === 'inactive') {
      return { color: '#9ca3af', fillColor: '#9ca3af', fillOpacity: 0.2, weight: 2 };
    }
    if (priority === 'high') {
      return { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 2.5 };
    }
    if (priority === 'medium') {
      return { color: '#eab308', fillColor: '#eab308', fillOpacity: 0.2, weight: 2 };
    }
    return { color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.2, weight: 2 };
  };

  const getProviderMarkerIcon = (status) => {
    let color = '#22c55e';
    if (status === 'busy') color = '#eab308';
    else if (status === 'overloaded') color = '#ef4444';

    return L.divIcon({
      className: 'bg-transparent',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="w-6 h-6 rounded-full bg-white border-2 flex items-center justify-center shadow-md" style="border-color: ${color};">
            <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${color};"></span>
          </div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  };

  // Click handler to add points to polygon drawing
  const handleMapClick = (latlng) => {
    setDrawPoints(prev => [...prev, [latlng.lat, latlng.lng]]);
  };

  // Drag handler for adjusting polygon vertices on map
  const handleUpdatePoint = (index, lat, lng) => {
    setDrawPoints(prev => {
      const updated = [...prev];
      updated[index] = [lat, lng];
      return updated;
    });
  };

  // Delete single point vertex on click
  const handleDeletePoint = (index) => {
    setDrawPoints(prev => prev.filter((_, idx) => idx !== index));
  };

  // Start Drawing Mode
  const handleStartDrawing = () => {
    setIsDrawing(true);
    setDrawPoints([]);
    setShowForm(true);
    setEditingZoneId(null);
    setFormData({
      name: '',
      city: 'Jalandhar',
      priority: 'medium',
      status: 'active',
      maxProviders: 20,
      serviceRadius: 5,
      zoneLevel: 'city',
      parentZone: '',
      adjacentZones: []
    });
    if (showToast) showToast('Map drawing mode activated. Click map to draw boundary.', 'info');
  };

  // Cancel Drawing / Form Editing
  const handleCancelForm = () => {
    setIsDrawing(false);
    setDrawPoints([]);
    setShowForm(false);
    setEditingZoneId(null);
  };

  const handleAdjacentZoneToggleCascade = (zone) => {
    const currentSelected = formData.adjacentZones || [];
    const zoneId = (zone._id || zone.id).toString();
    let newZones = [...currentSelected];

    if (currentSelected.includes(zoneId)) {
      // DESELECT logic
      newZones = newZones.filter(id => id.toString() !== zoneId);

      if (zone.zoneLevel === 'state') {
        const childCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const cityIds = childCities.map(c => (c._id || c.id).toString());
        newZones = newZones.filter(id => !cityIds.includes(id));

        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && cityIds.includes((z.parentZone?._id || z.parentZone || '').toString()));
        const microIds = childMicros.map(m => (m._id || m.id).toString());
        newZones = newZones.filter(id => !microIds.includes(id));
      } else if (zone.zoneLevel === 'city') {
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const microIds = childMicros.map(m => (m._id || m.id).toString());
        newZones = newZones.filter(id => !microIds.includes(id));

        const parentStateId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentStateId) {
          newZones = newZones.filter(id => id.toString() !== parentStateId);
        }
      } else if (zone.zoneLevel === 'micro') {
        const parentCityId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentCityId) {
          newZones = newZones.filter(id => id.toString() !== parentCityId);
          const parentCity = zones.find(z => (z._id || z.id).toString() === parentCityId);
          const parentStateId = parentCity ? (parentCity.parentZone?._id || parentCity.parentZone || '').toString() : '';
          if (parentStateId) {
            newZones = newZones.filter(id => id.toString() !== parentStateId);
          }
        }
      }
    } else {
      // SELECT logic
      newZones.push(zoneId);

      if (zone.zoneLevel === 'state') {
        const childCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const cityIds = childCities.map(c => (c._id || c.id).toString());

        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && cityIds.includes((z.parentZone?._id || z.parentZone || '').toString()));
        const microIds = childMicros.map(m => (m._id || m.id).toString());

        newZones = Array.from(new Set([...newZones, ...cityIds, ...microIds]));
      } else if (zone.zoneLevel === 'city') {
        const childMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === zoneId);
        const microIds = childMicros.map(m => (m._id || m.id).toString());
        newZones = Array.from(new Set([...newZones, ...microIds]));

        const parentStateId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentStateId) {
          const siblingCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === parentStateId);
          const allSiblingCityIds = siblingCities.map(c => (c._id || c.id).toString());
          const areAllSelected = allSiblingCityIds.every(id => newZones.includes(id));
          if (areAllSelected) {
            newZones.push(parentStateId);
          }
        }
      } else if (zone.zoneLevel === 'micro') {
        const parentCityId = (zone.parentZone?._id || zone.parentZone || '').toString();
        if (parentCityId) {
          const siblingMicros = zones.filter(z => z.zoneLevel === 'micro' && (z.parentZone?._id || z.parentZone || '').toString() === parentCityId);
          const allSiblingMicroIds = siblingMicros.map(m => (m._id || m.id).toString());
          const areAllSelected = allSiblingMicroIds.every(id => newZones.includes(id));
          if (areAllSelected) {
            newZones.push(parentCityId);

            const parentCity = zones.find(z => (z._id || z.id).toString() === parentCityId);
            const parentStateId = parentCity ? (parentCity.parentZone?._id || parentCity.parentZone || '').toString() : '';
            if (parentStateId) {
              const siblingCities = zones.filter(z => z.zoneLevel === 'city' && (z.parentZone?._id || z.parentZone || '').toString() === parentStateId);
              const allSiblingCityIds = siblingCities.map(c => (c._id || c.id).toString());
              const areAllSelected = allSiblingCityIds.every(id => newZones.includes(id));
              if (areAllSelected) {
                newZones.push(parentStateId);
              }
            }
          }
        }
      }
    }
    setFormData(prev => ({ ...prev, adjacentZones: newZones }));
  };

  // Clear current drawing vertices
  const handleClearDrawing = useCallback(() => {
    setDrawPoints([]);
  }, []);

  const handleAutoGenerateBoundary = useCallback(async () => {
    if (!geoQuery.trim()) {
      if (showToast) showToast('Please enter a Pincode or Area Name', 'warning');
      return;
    }
    setAutoGenerating(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(geoQuery)}&format=json&polygon_geojson=1&countrycodes=in`);
      const data = await response.json();

      if (!data || data.length === 0) {
        if (showToast) showToast('Location not found. Please try a different query.', 'error');
        return;
      }

      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      if (result.geojson && (result.geojson.type === 'Polygon' || result.geojson.type === 'MultiPolygon')) {
        let polygonCoords = [];
        if (result.geojson.type === 'Polygon') {
          polygonCoords = result.geojson.coordinates[0];
        } else {
          polygonCoords = result.geojson.coordinates[0][0];
        }

        const leafletCoords = polygonCoords.map(coord => [coord[1], coord[0]]);
        if (leafletCoords.length > 1 && leafletCoords[0][0] === leafletCoords[leafletCoords.length - 1][0] && leafletCoords[0][1] === leafletCoords[leafletCoords.length - 1][1]) {
          leafletCoords.pop();
        }

        setDrawPoints(leafletCoords);
        setMapCenter([lat, lng]);
        setMapZoom(14);
        if (showToast) showToast('Successfully generated exact polygon from boundary data!', 'success');
      } else {
        const radius = Number(formData.serviceRadius) || 5;
        const generatedCoords = generateApproximatedPolygon(lat, lng, radius);
        setDrawPoints(generatedCoords);
        setMapCenter([lat, lng]);
        setMapZoom(13);
        if (showToast) showToast(`Generated approximated polygon using ${radius} km radius around ${result.display_name.split(',')[0]}`, 'success');
      }
    } catch (err) {
      console.error("Error geocoding location:", err);
      if (showToast) showToast('Failed to auto-generate boundary. Please draw manually.', 'error');
    } finally {
      setAutoGenerating(false);
    }
  }, [geoQuery, formData.serviceRadius, showToast]);

  // Save new or updated zone
  const handleSaveZone = useCallback(async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      if (showToast) showToast('Please enter a valid Zone Name', 'warning');
      return;
    }
    if (drawPoints.length < 3) {
      if (showToast) showToast('A boundary requires at least 3 vertices', 'warning');
      return;
    }

    const geoCoords = drawPoints.map(p => [p[1], p[0]]);
    geoCoords.push([drawPoints[0][1], drawPoints[0][0]]); // Close the loop

    const payload = {
      name: formData.name,
      city: formData.city,
      polygon: {
        type: "Polygon",
        coordinates: [geoCoords]
      },
      status: formData.status,
      priority: formData.priority,
      maxProviders: Number(formData.maxProviders),
      serviceRadius: Number(formData.serviceRadius),
      zoneLevel: formData.zoneLevel,
      parentZone: formData.zoneLevel !== 'state' && formData.parentZone ? formData.parentZone : null,
      adjacentZones: formData.adjacentZones || []
    };

    setLoading(true);
    try {
      if (editingZoneId) {
        await ZoneService.updateZone(editingZoneId, payload);
        if (showToast) showToast('Service zone boundary updated successfully.', 'success');
      } else {
        await ZoneService.createZone(payload);
        if (showToast) showToast('New service zone deployed successfully.', 'success');
      }
      setIsDrawing(false);
      setDrawPoints([]);
      setShowForm(false);
      setEditingZoneId(null);
      fetchZones();
    } catch (err) {
      console.error("Error saving zone:", err);
      const errMsg = err.response?.data?.message || 'Failed to save service zone';
      if (showToast) showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, drawPoints, editingZoneId, showToast, fetchZones]);

  // Trigger Zone Editing
  const handleEditZone = useCallback((zone) => {
    setEditingZoneId(zone.id);
    setFormData({
      name: zone.name,
      city: zone.city,
      priority: zone.priority,
      status: zone.status,
      maxProviders: zone.maxProviders,
      serviceRadius: zone.serviceRadius,
      zoneLevel: zone.zoneLevel || 'city',
      parentZone: zone.parentZone?._id || zone.parentZone || '',
      adjacentZones: zone.adjacentZones ? zone.adjacentZones.map(z => z._id || z) : []
    });
    setDrawPoints(zone.coordinates);
    setIsDrawing(true);
    setShowForm(true);
    const center = getPolygonCenter(zone.coordinates);
    setMapCenter(center);
    setMapZoom(13);
  }, []);

  // Quick enable/disable status toggle from card
  const handleToggleStatus = useCallback(async (id, currentStatus) => {
    try {
      setLoading(true);
      await ZoneService.toggleZoneStatus(id);
      if (showToast) showToast(`Zone status toggled successfully`, 'success');
      fetchZones();
    } catch (err) {
      console.error("Error toggling zone status:", err);
      const errMsg = err.response?.data?.message || 'Failed to toggle status';
      if (showToast) showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, fetchZones]);

  // Delete Zone Handler
  const handleDeleteZone = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      setLoading(true);
      await ZoneService.deleteZone(deleteConfirmId);
      if (showToast) showToast('Service zone deactivated successfully.', 'success');
      setDeleteConfirmId(null);
      fetchZones();
    } catch (err) {
      console.error("Error deleting zone:", err);
      if (showToast) showToast('Failed to deactivate zone', 'error');
    } finally {
      setLoading(false);
    }
  }, [deleteConfirmId, showToast, fetchZones]);

  // Center/Zoom map to specific zone
  const handleFocusZone = useCallback((coordinates) => {
    const center = getPolygonCenter(coordinates);
    setMapCenter(center);
    setMapZoom(13);
  }, []);

  const parentOptions = useMemo(() => {
    if (formData.zoneLevel === 'state') return [];
    if (formData.zoneLevel === 'city') {
      return zones.filter(z => z.zoneLevel === 'state' && z.id !== editingZoneId);
    }
    if (formData.zoneLevel === 'micro') {
      return zones.filter(z => z.zoneLevel === 'city' && z.id !== editingZoneId);
    }
    return [];
  }, [zones, formData.zoneLevel, editingZoneId]);

  const zoneTree = useMemo(() => {
    const states = zones.filter(z => z.zoneLevel === 'state');
    const cities = zones.filter(z => z.zoneLevel === 'city');
    const micros = zones.filter(z => z.zoneLevel === 'micro');

    return states.map(state => {
      const stateCities = cities.filter(c => {
        const pId = c.parentZone?._id || c.parentZone;
        return pId === state.id;
      });

      const cityNodes = stateCities.map(city => {
        const cityMicros = micros.filter(m => {
          const pId = m.parentZone?._id || m.parentZone;
          return pId === city.id;
        });

        return {
          ...city,
          children: cityMicros
        };
      });

      return {
        ...state,
        children: cityNodes
      };
    });
  }, [zones]);

  const toggleNode = useCallback((nodeId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  }, []);

  // Search and Filters Logic
  const filteredZones = useMemo(() => {
    return zones.filter(zone => {
      const matchSearch = zone.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCity = filterCity === '' || zone.city.toLowerCase() === filterCity.toLowerCase();
      const matchStatus = filterStatus === '' || zone.status === filterStatus;
      const matchPriority = filterPriority === '' || zone.priority === filterPriority;
      const matchLevel = filterLevel === '' || zone.zoneLevel === filterLevel;
      return matchSearch && matchCity && matchStatus && matchPriority && matchLevel;
    });
  }, [zones, searchQuery, filterCity, filterStatus, filterPriority, filterLevel]);

  // Analytics Computation
  const stats = useMemo(() => {
    const total = zones.length;
    const active = zones.filter(z => z.status === 'active').length;

    // Count active providers inside active zones
    let uniqueProvidersCount = new Set();
    providers.forEach(p => {
      if (p.coords) {
        zones.forEach(z => {
          if (z.status === 'active' && isPointInPolygon(p.coords[0], p.coords[1], z.coordinates)) {
            uniqueProvidersCount.add(p._id);
          }
        });
      }
    });

    // Coverage calculation representation
    const coveragePercentage = total > 0 ? Math.round((active / total) * 100) : 0;

    // Response time calculation based on active priorities
    const activeZones = zones.filter(z => z.status === 'active');
    let responseSum = 0;
    activeZones.forEach(z => {
      if (z.priority === 'high') responseSum += 8;
      else if (z.priority === 'medium') responseSum += 12;
      else responseSum += 16;
    });
    const avgResponse = activeZones.length > 0 ? Math.round(responseSum / activeZones.length) : 0;

    return {
      totalZones: total,
      activeZones: active,
      totalProviders: uniqueProvidersCount.size || providers.length,
      coverage: coveragePercentage || 0,
      avgResponse: avgResponse || 12
    };
  }, [zones, providers]);

  return (
    <div className="flex flex-col h-[calc(100vh-150px)] text-gray-850 font-sans relative overflow-hidden">
      {/* Mobile view Tab Selectors */}
      <div className="flex lg:hidden bg-gray-100 p-1.5 rounded-xl mb-4 shrink-0 shadow-sm border border-gray-200">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'list' ? 'bg-primary text-white shadow-sm font-extrabold' : 'text-gray-500 hover:text-gray-900'
            }`}
        >
          Zone List & Details
        </button>
        <button
          onClick={() => {
            setActiveTab('map');
            if (showToast) showToast('Switch to Map: Tap anywhere to place boundary coordinates.', 'info');
          }}
          className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === 'map' ? 'bg-primary text-white shadow-sm font-extrabold' : 'text-gray-500 hover:text-gray-900'
            }`}
        >
          Interactive Map View
        </button>
      </div>

      {/* Analytics Counter Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 shrink-0">
        <StatsCard
          title="Total Zones"
          value={stats.totalZones}
          icon={Layers}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          subtext="Configured Areas"
          className="border border-gray-250 hover:border-primary/40 shadow-sm"
        />

        <StatsCard
          title="Active Zones"
          value={stats.activeZones}
          icon={Compass}
          iconBg="bg-teal-50"
          iconColor="text-teal-500"
          subtext="Enforcing Dispatch"
          className="border border-gray-250 hover:border-primary/40 shadow-sm"
        />

        <StatsCard
          title="Total Providers"
          value={stats.totalProviders}
          icon={Users}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          subtext="Active Providers"
          className="border border-gray-250 hover:border-primary/40 shadow-sm"
        />

        <StatsCard
          title="Zone Coverage %"
          value={`${stats.coverage}%`}
          icon={Activity}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          subtext="Operational Density"
          className="border border-gray-250 hover:border-primary/40 shadow-sm"
        />
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 relative min-h-0 overflow-hidden">
        {/* Left Side Sidebar Panel - Controls & Zone lists */}
        <div className={`${sidebarOpen ? 'w-full lg:w-96 lg:shrink-0' : 'w-0 lg:w-0'} ${activeTab === 'list' ? 'flex' : 'hidden lg:flex'
          } bg-white border border-gray-200 rounded-2xl flex flex-col min-h-0 overflow-hidden transition-all duration-300 relative z-[2] shadow-sm`}>
          <div className="p-4 border-b border-gray-100 space-y-3 shrink-0 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-primary/10 border border-primary/20 rounded-lg">
                  <Layers className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-xs font-black uppercase tracking-wider text-gray-800">Zone Dispatch Control</h1>
                  <p className="text-[8px] text-gray-400 uppercase tracking-widest font-bold">Geo-boundary configuration</p>
                </div>
              </div>
              <button
                onClick={handleStartDrawing}
                disabled={isDrawing && !editingZoneId}
                className="py-1.5 px-3 bg-primary hover:bg-teal-700 active:scale-95 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" /> Add Zone
              </button>
            </div>

            {/* Form Input Display Area */}
            {showForm && (
              <form onSubmit={handleSaveZone} className="bg-gray-50 border border-gray-200 p-3 pb-5 rounded-xl space-y-3 animate-slide-up shadow-inner">
                <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                  <span className="text-[10px] text-primary font-black uppercase tracking-wider">
                    {editingZoneId ? '✏️ Edit Zone Configuration' : '📐 New Zone Boundary'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 text-[8px] font-black uppercase" title="Number of boundary points drawn on the map">
                    {drawPoints.length} Vertices
                  </span>
                </div>

                {/* AUTO-GENERATE FROM PINCODE / AREA FEATURE */}
                <div className="bg-primary/5 p-2 rounded-lg border border-primary/25 space-y-1.5">
                  <label className="text-[8px] font-black uppercase text-primary tracking-wider block">⚡ Auto-Generate Boundary</label>
                  <p className="text-[7.5px] text-gray-500 font-medium leading-relaxed">Enter a pincode (e.g. 144001) or area name (e.g. Model Town Jalandhar) to auto-draw the zone boundary on the map.</p>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="e.g. 144001 or Model Town Jalandhar"
                      value={geoQuery}
                      onChange={(e) => setGeoQuery(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-white border border-gray-250 rounded text-[11px] outline-none font-semibold text-gray-900 placeholder-gray-400"
                    />
                    <button
                      type="button"
                      onClick={handleAutoGenerateBoundary}
                      disabled={autoGenerating}
                      className="px-2.5 py-1.5 bg-primary hover:bg-teal-700 active:scale-95 text-white rounded text-[9px] font-black uppercase tracking-wider disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center min-w-[70px]"
                    >
                      {autoGenerating ? 'Searching...' : 'Generate'}
                    </button>
                  </div>
                  <p className="text-[7px] text-gray-400 font-semibold">Uses OpenStreetMap data. If exact boundary not found, creates a circular approximation using the radius below.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Zone Name <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Jalandhar City Center"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-250 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary text-gray-900 placeholder-gray-400 font-semibold"
                    required
                  />
                  <p className="text-[7.5px] text-gray-400 font-medium">Unique name for this zone. Must be unique per city.</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Zone Level</label>
                    <select
                      value={formData.zoneLevel}
                      onChange={(e) => setFormData(prev => ({ ...prev, zoneLevel: e.target.value, parentZone: '' }))}
                      className="w-full px-2 py-1.5 bg-white border border-gray-250 text-gray-900 rounded-lg text-[11px] outline-none font-semibold cursor-pointer"
                    >
                      <option value="state">🌍 State</option>
                      <option value="city">🏙️ City</option>
                      <option value="micro">📍 Micro Zone</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">City</label>
                    <input
                      type="text"
                      placeholder="e.g. Jalandhar"
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white border border-gray-250 text-gray-900 rounded-lg text-[11px] outline-none font-semibold"
                      required
                    />
                  </div>
                </div>

                {/* Parent Zone Dropdown */}
                {formData.zoneLevel !== 'state' && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Parent Zone *</label>
                    <select
                      value={formData.parentZone}
                      onChange={(e) => setFormData(prev => ({ ...prev, parentZone: e.target.value }))}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-250 text-gray-900 rounded-lg text-[11px] outline-none font-semibold cursor-pointer"
                      required
                    >
                      <option value="">Select Parent Zone</option>
                      {parentOptions.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.city})</option>
                      ))}
                    </select>
                  </div>
                )}
                {/* Adjacent Zones Multi-Select */}
                <div className="space-y-1">
                  <HierarchicalZoneSelector
                    zones={zones.filter(z => z.id !== editingZoneId)}
                    selectedZoneIds={formData.adjacentZones}
                    onChange={handleAdjacentZoneToggleCascade}
                    label="Adjacent Zones (Optional)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Priority Level</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white border border-gray-250 text-gray-900 rounded-lg text-[11px] outline-none font-semibold cursor-pointer"
                    >
                      <option value="low">🟢 Low</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="high">🔴 High</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Max Providers</label>
                    <input
                      type="number"
                      placeholder="e.g. 20"
                      value={formData.maxProviders}
                      onChange={(e) => setFormData(prev => ({ ...prev, maxProviders: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white border border-gray-250 rounded-lg text-[11px] text-gray-900 placeholder-gray-400 font-semibold"
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white border border-gray-250 text-gray-900 rounded-lg text-[11px] outline-none font-semibold cursor-pointer"
                    >
                      <option value="active">✅ Active</option>
                      <option value="inactive">⏸️ Inactive</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">Service Radius (KM)</label>
                    <input
                      type="number"
                      placeholder="e.g. 5"
                      value={formData.serviceRadius}
                      onChange={(e) => setFormData(prev => ({ ...prev, serviceRadius: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white border border-gray-250 rounded-lg text-[11px] text-gray-900 placeholder-gray-400 font-semibold"
                      min="1"
                    />
                  </div>
                </div>

                <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-500/20 text-[8.5px] text-amber-800 font-medium leading-relaxed space-y-1 text-left">
                  <p className="font-black text-amber-950 text-[9px]">🗺️ How to create a zone boundary:</p>
                  <p><strong>Option A:</strong> Enter a Pincode/Area name → click Generate. The boundary will be auto-drawn.</p>
                  <p><strong>Option B:</strong> Switch to Map tab → click to place vertices. Min 3 points needed.</p>
                  <p className="text-amber-600 font-bold">When done → fill details → click "Save Boundary".</p>
                </div>

                <div className="flex gap-2 pt-1.5">
                  <button
                    type="submit"
                    className="flex-1 w-full py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-lg transition-all font-black text-center shadow-md cursor-pointer text-xs"
                  >
                    Save Boundary
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDrawing}
                    className="flex-1 py-2 bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-700 rounded-lg transition-all font-black text-center shadow-sm cursor-pointer text-xs"
                  >
                    Clear Map
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="flex-1 py-2 bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-700 rounded-lg transition-all font-black text-center shadow-sm cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Search and Filters Layout */}
            {!showForm && (
              <div className="space-y-2.5 animate-fade-in">
                {/* Sidebar View Toggle */}
                <div className="flex bg-gray-100 p-1 rounded-xl text-[9px] font-black uppercase tracking-wider border border-gray-200 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('list')}
                    className={`flex-1 py-1.5 text-center rounded-lg transition-all ${sidebarTab === 'list' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-950 font-bold'}`}
                  >
                    List View ({filteredZones.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab('tree')}
                    className={`flex-1 py-1.5 text-center rounded-lg transition-all ${sidebarTab === 'tree' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-950 font-bold'}`}
                  >
                    Hierarchy Tree
                  </button>
                </div>

                <AdminSearchBar
                  placeholder="Search zones..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                />
                <div className="grid grid-cols-2 gap-1.5 text-[8.5px] font-bold">
                  <select
                    value={filterCity}
                    onChange={(e) => setFilterCity(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1 text-gray-600 outline-none cursor-pointer"
                  >
                    <option value="">All Cities</option>
                    {Array.from(new Set(zones.map(z => z.city).filter(Boolean))).sort().map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1 text-gray-600 outline-none cursor-pointer"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1 text-gray-600 outline-none cursor-pointer"
                  >
                    <option value="">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1 text-gray-600 outline-none cursor-pointer"
                  >
                    <option value="">All Levels</option>
                    <option value="state">State</option>
                    <option value="city">City</option>
                    <option value="micro">Micro</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable list card representation */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
            {showForm ? null : sidebarTab === 'tree' ? (
              /* Tree View Mode */
              zoneTree.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs italic font-semibold font-sans">
                  No zones configured to build a tree.
                </div>
              ) : (
                <div className="space-y-2">
                  {zoneTree.map(stateNode => (
                    <div key={stateNode.id} className="border border-gray-150 rounded-xl p-2 bg-gray-50/50 mb-2 text-left animate-slide-up">
                      {/* State Node Header */}
                      <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 shadow-sm text-[11px] font-black uppercase tracking-wider text-gray-800">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${stateNode.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                          <span className="truncate">{stateNode.name}</span>
                          <span className="text-[7.5px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-black tracking-wider uppercase">State</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleFocusZone(stateNode.coordinates)} className="p-0.5 hover:bg-gray-150 text-gray-600 rounded" title="View on Map"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleEditZone(stateNode)} className="p-0.5 hover:bg-gray-150 text-primary rounded" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleOpenAnalytics(stateNode.id)} className="p-0.5 hover:bg-gray-150 text-indigo-500 rounded" title="View Analytics"><Activity className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      {/* Render Children (Cities) */}
                      {stateNode.children && stateNode.children.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {stateNode.children.map(cityNode => (
                            <div key={cityNode.id} className="pl-4 ml-2 border-l border-gray-200">
                              <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 shadow-sm text-[11px] font-black uppercase tracking-wider text-gray-800">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className={`w-1.5 h-1.5 rounded-full ${cityNode.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                                  <span className="truncate">{cityNode.name}</span>
                                  <span className="text-[7.5px] bg-teal-500/10 text-teal-600 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">City</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button onClick={() => handleFocusZone(cityNode.coordinates)} className="p-0.5 hover:bg-gray-150 text-gray-600 rounded" title="View on Map"><Eye className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleEditZone(cityNode)} className="p-0.5 hover:bg-gray-150 text-primary rounded" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => handleOpenAnalytics(cityNode.id)} className="p-0.5 hover:bg-gray-150 text-indigo-500 rounded" title="View Analytics"><Activity className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>

                              {/* Render Children (Micro Zones) */}
                              {cityNode.children && cityNode.children.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {cityNode.children.map(microNode => (
                                    <div key={microNode.id} className="pl-4 ml-2 border-l border-gray-200">
                                      <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 shadow-sm text-[11px] font-black uppercase tracking-wider text-gray-800">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className={`w-1 h-1 rounded-full ${microNode.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                                          <span className="truncate">{microNode.name}</span>
                                          <span className="text-[7.5px] bg-purple-500/10 text-purple-600 px-1.5 py-0.2 rounded font-black tracking-wider uppercase">Micro</span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button onClick={() => handleFocusZone(microNode.coordinates)} className="p-0.5 hover:bg-gray-150 text-gray-600 rounded" title="View on Map"><Eye className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => handleEditZone(microNode)} className="p-0.5 hover:bg-gray-150 text-primary rounded" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => handleOpenAnalytics(microNode.id)} className="p-0.5 hover:bg-gray-150 text-indigo-500 rounded" title="View Analytics"><Activity className="w-3.5 h-3.5" /></button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : filteredZones.length > 0 ? (
              filteredZones.map(zone => {
                const zoneStats = getZoneStats(zone.coordinates);
                return (
                  <div
                    key={zone.id}
                    className="p-3 bg-white border border-gray-150 rounded-xl space-y-2.5 hover:border-gray-300 hover:shadow-md shadow-sm transition-all flex flex-col relative group select-text text-left animate-slide-up"
                  >
                    {/* Header row */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                        <span className={`w-1.5 h-3.5 rounded-full shrink-0 ${zone.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                        <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-wider truncate cursor-text capitalize text-left" title={zone.name}>{zone.name}</h4>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleToggleStatus(zone.id, zone.status)}
                          title={zone.status === 'active' ? 'Click to deactivate this zone' : 'Click to activate this zone'}
                          className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all tracking-wider ${zone.status === 'active'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                          {zone.status === 'active' ? '● Active' : '○ Disabled'}
                        </button>

                        <button
                          onClick={() => handleEditZone(zone)}
                          className="p-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-550 hover:text-gray-900 hover:bg-gray-150 transition-all"
                          title="Edit zone boundary and settings"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(zone.id)}
                          className="p-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Permanently delete this zone"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Zone meta info & Hierarchy preview */}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[9px] text-gray-500 font-semibold bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                      <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-black tracking-wider text-[7.5px]">{zone.zoneLevel || 'city'}</span>
                      {zone.parentZone && (
                        <>
                          <span className="text-gray-300">➔</span>
                          <span className="capitalize text-gray-650" title="Parent zone name">Parent: {(zone.parentZone?.name || zone.parentZone)}</span>
                        </>
                      )}
                      {zone.adjacentZones && zone.adjacentZones.length > 0 && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="text-gray-650" title="Adjacent zones count">Neighbours: {zone.adjacentZones.length}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[9px] text-gray-500 font-semibold">
                      <span className="flex items-center gap-0.5 cursor-text" title="City this zone belongs to"><MapPin className="w-3 h-3 text-primary" /> {zone.city}</span>
                      <span className="text-gray-300">|</span>
                      <span className={`font-black cursor-text ${zone.priority === 'high' ? 'text-red-600' :
                        zone.priority === 'medium' ? 'text-yellow-600' : 'text-emerald-600'
                        }`} title={`Priority: ${zone.priority} — affects dispatch speed`}>{zone.priority} Priority</span>
                      <span className="text-gray-300">|</span>
                      <span className="cursor-text" title="Max providers limit for this zone">Max: {zone.maxProviders}</span>
                      <span className="text-gray-300">|</span>
                      <span className="cursor-text" title="Service matching radius in kilometers">Radius: {zone.serviceRadius} km</span>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                      <div className="bg-blue-50/60 p-1.5 rounded-lg border border-blue-100 flex flex-col justify-center animate-pulse-slow" title="Total active providers inside this zone">
                        <span className="text-[7px] text-blue-400 font-bold uppercase">Providers</span>
                        <span className="text-blue-700 font-black text-xs mt-0.5 cursor-text">{zoneStats.providersCount}</span>
                      </div>
                      <div className="bg-purple-50/60 p-1.5 rounded-lg border border-purple-100 flex flex-col justify-center" title="Total customers saved addresses inside this zone">
                        <span className="text-[7px] text-purple-400 font-bold uppercase">Customers</span>
                        <span className="text-purple-700 font-black text-xs mt-0.5 cursor-text">{zoneStats.customerCount}</span>
                      </div>
                      <div className="bg-amber-50/60 p-1.5 rounded-lg border border-amber-100 flex flex-col justify-center" title="Active bookings/jobs happening inside this zone right now">
                        <span className="text-[7px] text-amber-500 font-bold uppercase">Active Jobs</span>
                        <span className="text-amber-700 font-black text-xs mt-0.5 cursor-text">{zoneStats.activeBookingsCount}</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleFocusZone(zone.coordinates)}
                        className="flex-1 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-[8px] font-black rounded-lg transition-all uppercase tracking-widest border border-gray-200 flex items-center justify-center gap-1 shadow-sm"
                        title="Center the map on this zone and zoom in"
                      >
                        <Eye className="w-3.5 h-3.5" /> View on Map
                      </button>
                      <button
                        onClick={() => handleOpenAnalytics(zone.id)}
                        className="flex-1 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[8px] font-black rounded-lg transition-all uppercase tracking-widest border border-primary/20 flex items-center justify-center gap-1 shadow-sm"
                        title="View members and performance metrics for this zone"
                      >
                        <Activity className="w-3.5 h-3.5" /> View Analytics
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs italic font-semibold font-sans">
                No matching zones found.
              </div>
            )}
          </div>
        </div>

        {/* Collapsible toggle sidebar helper for mobile view */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white border border-gray-250 py-4 px-1 rounded-r-xl text-gray-500 hover:text-gray-900 transition-all hidden lg:block shadow-md"
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>

        {/* Leaflet Map Drawing Canvas */}
        <div className={`flex-1 ${activeTab === 'map' ? 'block' : 'hidden lg:block'
          } bg-gray-100 border border-gray-200 rounded-2xl overflow-hidden relative min-h-[350px] shadow-sm`}>
          {/* Custom Drawing Guidance Box */}
          {isDrawing && (
            <div className="absolute top-4 left-4 z-[1000] bg-white border border-amber-500/40 rounded-xl p-3 shadow-xl max-w-xs animate-slide-up">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
                <h4 className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Boundary Drawing active</h4>
              </div>
              <p className="text-[9px] text-gray-650 leading-relaxed uppercase tracking-wider font-sans">
                1. Click anywhere on the map to add coordinate vertices.<br />
                2. Drag any point to reposition its vertex.<br />
                3. Click a point vertex directly to delete it.<br />
                4. Fill the form metadata and click "Save Zone".
              </p>
            </div>
          )}

          {/* Leaflet Map Component container */}
          <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%', zIndex: 5 }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors &copy; Google Satellite'
              url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              maxZoom={20}
            />

            <MapCenterer center={mapCenter} zoom={mapZoom} />

            {/* Click event capturing layer in drawing mode */}
            <MapDrawingEvents isDrawing={isDrawing} onMapClick={handleMapClick} />

            {/* Live custom drawing polygon layer */}
            {isDrawing && drawPoints.length > 0 && (
              <>
                <Polyline positions={drawPoints} color="#eab308" weight={2} dashArray="5,5" />
                {drawPoints.map((point, index) => (
                  <Marker
                    key={'draw-pt-' + index}
                    position={point}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const { lat, lng } = e.target.getLatLng();
                        handleUpdatePoint(index, lat, lng);
                      },
                      click: () => {
                        handleDeletePoint(index);
                      }
                    }}
                    icon={L.divIcon({
                      className: 'bg-yellow-500 w-3.5 h-3.5 rounded-full border border-white cursor-pointer shadow-md animate-pulse',
                      iconSize: [14, 14],
                      iconAnchor: [7, 7]
                    })}
                  >
                    <Tooltip sticky>
                      <span className="font-sans font-extrabold text-[9px] uppercase text-slate-900">Drag point or click to delete vertex</span>
                    </Tooltip>
                  </Marker>
                ))}
                {drawPoints.length >= 3 && (
                  <Polygon
                    positions={drawPoints}
                    pathOptions={{ color: '#eab308', fillColor: '#eab308', fillOpacity: 0.15 }}
                  />
                )}
              </>
            )}

            {/* Render saved zones on the map */}
            {zones.map(zone => {
              const zoneStyle = getZoneStyle(zone.status, zone.priority);
              const zoneDetails = getZoneStats(zone.coordinates);

              return (
                <Polygon
                  key={zone.id}
                  positions={zone.coordinates}
                  pathOptions={zoneStyle}
                >
                  <Tooltip sticky>
                    <span className="font-sans font-bold text-xs uppercase text-slate-800">{zone.name} Zone ({zone.city})</span>
                  </Tooltip>
                  <Popup minWidth={288} maxWidth={320} closeButton>
                    {renderZoneMapPopup(zone, zoneDetails)}
                  </Popup>
                </Polygon>
              );
            })}

            {/* Provider Coverage Check display */}
            {providers.map(prov => (
              <Marker
                key={prov._id}
                position={prov.coords}
                icon={getProviderMarkerIcon(prov.status)}
              >
                <Popup>
                  <div className="p-1 font-sans text-xs text-slate-900 text-left">
                    <h4 className="font-black text-slate-900 capitalize">{prov.name}</h4>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5 uppercase tracking-wide">{prov.serviceCategory}</p>
                    <p className="text-[10px] text-indigo-500 font-black mt-1 uppercase">Status: {prov.status}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Booking density Heat circles inside zones */}
            {bookings.map(book => (
              <Circle
                key={'heat-' + book._id}
                center={[book.lat, book.lng]}
                radius={250}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.12,
                  weight: 1,
                  dashArray: "4,4"
                }}
              />
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Premium Action Hub Modal Overlay */}
      {legacyZonePopupEnabled && actionHubModal.open && actionHubModal.zone && (
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
                  window.location.href = `/admin/commission?prefillZone=${actionHubModal.zone.id}`;
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
                  setActionHubModal({ open: false, zone: null });
                  handleOpenAnalytics(actionHubModal.zone.id);
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
      )}

      {/* Confirmation Modal Overlay before delete */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 text-center space-y-4">
            <div className="p-3 bg-red-100 border border-red-200 rounded-full w-14 h-14 flex items-center justify-center mx-auto text-red-500">
              <AlertTriangle className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 uppercase tracking-wider">Decommission Boundary</h3>
              <p className="text-xs text-gray-500 mt-2 uppercase tracking-wide leading-relaxed">
                Warning! You are about to permanently decommission this service dispatch boundary zone. Providers inside this zone will revert to global dispatch rules.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs uppercase font-black tracking-wider">
              <button
                onClick={handleDeleteZone}
                className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="py-2.5 bg-gray-100 border border-gray-205 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
              >
                Keep Active
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal Overlay */}
      {analyticsModal.open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto p-4 select-text">
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-2xl max-w-4xl w-full mx-auto my-8 relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => setAnalyticsModal({ open: false, zone: null, loading: false })}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {analyticsModal.loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <RefreshCw className="w-8 h-8 text-primary " />
                <p className="text-xs text-gray-500 uppercase tracking-widest font-black">Fetching zone intelligence...</p>
              </div>
            ) : analyticsModal.zone ? (
              <div className="flex flex-col min-h-0 overflow-hidden text-left">
                {/* Modal Header */}
                <div className="border-b border-gray-150 pb-4 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-wider capitalize">
                      {analyticsModal.zone.name}
                    </h3>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded uppercase font-black tracking-wider text-[9px]">
                      {analyticsModal.zone.zoneLevel}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${analyticsModal.zone.status === 'active' ? 'bg-emerald-50 border border-emerald-250 text-emerald-700' : 'bg-gray-100 border border-gray-200 text-gray-500'
                      }`}>
                      {analyticsModal.zone.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mt-1 text-left">
                    Operational analytics and member list for {analyticsModal.zone.city} hub
                  </p>
                </div>

                {/* Scrollable Container */}
                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col justify-between hover:border-primary/30 shadow-sm">
                      <div className="flex justify-between items-center text-gray-400">
                        <span className="text-[9px] font-black uppercase tracking-wider">Total Bookings</span>
                        <Layers className="w-4 h-4 text-primary" />
                      </div>
                      <h4 className="text-xl font-black mt-2 text-gray-900 text-left">
                        {analyticsModal.zone.analytics?.totalBookings ?? 0}
                      </h4>
                      <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-wider text-left">All-time jobs in zone</p>
                    </div>

                    <div className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col justify-between hover:border-primary/30 shadow-sm">
                      <div className="flex justify-between items-center text-gray-400">
                        <span className="text-[9px] font-black uppercase tracking-wider">Active Providers</span>
                        <Users className="w-4 h-4 text-blue-500" />
                      </div>
                      <h4 className="text-xl font-black mt-2 text-gray-900 text-left">
                        {analyticsModal.zone.analytics?.activeProviders ?? 0}
                      </h4>
                      <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-wider text-left">Matched to zone</p>
                    </div>

                    <div className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col justify-between hover:border-primary/30 shadow-sm">
                      <div className="flex justify-between items-center text-gray-400">
                        <span className="text-[9px] font-black uppercase tracking-wider">Active Users</span>
                        <Users className="w-4 h-4 text-purple-500" />
                      </div>
                      <h4 className="text-xl font-black mt-2 text-gray-900 text-left">
                        {analyticsModal.zone.analytics?.activeUsers ?? 0}
                      </h4>
                      <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-wider text-left">Linked accounts</p>
                    </div>

                    <div className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col justify-between hover:border-primary/30 shadow-sm">
                      <div className="flex justify-between items-center text-gray-400">
                        <span className="text-[9px] font-black uppercase tracking-wider">Commission Generated</span>
                        <Award className="w-4 h-4 text-emerald-500" />
                      </div>
                      <h4 className="text-xl font-black mt-2 text-gray-900 text-left">
                        ₹{(analyticsModal.zone.analytics?.commissionGenerated ?? 0).toLocaleString()}
                      </h4>
                      <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-wider text-left">Total commission earned</p>
                    </div>

                    <div className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col justify-between hover:border-primary/30 shadow-sm">
                      <div className="flex justify-between items-center text-gray-400">
                        <span className="text-[9px] font-black uppercase tracking-wider">Coupon Usage</span>
                        <Zap className="w-4 h-4 text-amber-500" />
                      </div>
                      <h4 className="text-xl font-black mt-2 text-gray-900 text-left">
                        {analyticsModal.zone.analytics?.couponUsage ?? 0}
                      </h4>
                      <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-wider text-left">Successful redemptions</p>
                    </div>

                    <div className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col justify-between hover:border-primary/30 shadow-sm">
                      <div className="flex justify-between items-center text-gray-400">
                        <span className="text-[9px] font-black uppercase tracking-wider">Assignment Success</span>
                        <ShieldCheck className="w-4 h-4 text-teal-500" />
                      </div>
                      <h4 className="text-xl font-black mt-2 text-gray-900 text-left">
                        {analyticsModal.zone.analytics?.assignmentSuccessRate ?? 0}%
                      </h4>
                      <p className="text-[8px] text-gray-400 mt-1 uppercase tracking-wider text-left">Workforce dispatch rate</p>
                    </div>
                  </div>

                  {/* Split Linked Members Lists */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Providers Column */}
                    <div className="space-y-3 text-left">
                      <div className="flex justify-between items-center border-b border-gray-150 pb-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5 text-left">
                          <Users className="w-4 h-4 text-blue-500" /> Linked Providers ({analyticsModal.zone.linkedProviders?.length ?? 0})
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {analyticsModal.zone.linkedProviders && analyticsModal.zone.linkedProviders.length > 0 ? (
                          analyticsModal.zone.linkedProviders.map(provider => (
                            <div key={provider._id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex justify-between items-center gap-2 hover:border-gray-300 transition-all text-left">
                              <div className="min-w-0 flex-1 text-left">
                                <h5 className="text-[11px] font-black text-gray-900 truncate capitalize text-left">{provider.name}</h5>
                                <p className="text-[9px] text-gray-550 truncate text-left">{provider.email}</p>
                                <p className="text-[9px] text-gray-400 font-semibold text-left">{provider.phone || 'No phone'}</p>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shrink-0 ${provider.status === 'available' ? 'bg-emerald-50 border border-emerald-250 text-emerald-700' :
                                provider.status === 'busy' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                                  'bg-gray-100 border border-gray-200 text-gray-500'
                                }`}>
                                {provider.status}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-center py-6 text-xs text-gray-400 italic">No providers linked to this zone</p>
                        )}
                      </div>
                    </div>

                    {/* Users Column */}
                    <div className="space-y-3 text-left">
                      <div className="flex justify-between items-center border-b border-gray-150 pb-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5 text-left">
                          <Users className="w-4 h-4 text-purple-500" /> Linked Users ({analyticsModal.zone.linkedUsers?.length ?? 0})
                        </h4>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {analyticsModal.zone.linkedUsers && analyticsModal.zone.linkedUsers.length > 0 ? (
                          analyticsModal.zone.linkedUsers.map(user => (
                            <div key={user._id} className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col hover:border-gray-300 transition-all text-left">
                              <h5 className="text-[11px] font-black text-gray-900 truncate capitalize text-left">{user.name}</h5>
                              <p className="text-[9px] text-gray-550 truncate text-left">{user.email}</p>
                              <p className="text-[9px] text-gray-400 font-semibold text-left">{user.phone || 'No phone'}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-center py-6 text-xs text-gray-400 italic">No users linked to this zone</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="border-t border-gray-150 pt-4 mt-4 flex justify-end">
                  <button
                    onClick={() => setAnalyticsModal({ open: false, zone: null, loading: false })}
                    className="py-2 px-5 bg-gray-100 border border-gray-205 hover:bg-gray-200 active:scale-95 text-gray-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-sm"
                  >
                    Close Analytics
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-red-500">
                <AlertTriangle className="w-10 h-10 animate-bounce" />
                <p className="text-xs font-black uppercase tracking-wider mt-2">Failed to load zone intelligence</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const HierarchicalZoneSelector = ({
  zones,
  selectedZoneIds,
  onChange,
  label = "Applicable Zones"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedNodes, setExpandedNodes] = useState({});
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tree = useMemo(() => {
    const states = zones.filter(z => z.zoneLevel === 'state' || !z.zoneLevel);
    const cities = zones.filter(z => z.zoneLevel === 'city');
    const micros = zones.filter(z => z.zoneLevel === 'micro');

    return states.map(state => {
      const stateCities = cities.filter(c => {
        const pId = c.parentZone?._id || c.parentZone;
        return pId?.toString() === (state._id || state.id)?.toString();
      });

      const cityNodes = stateCities.map(city => {
        const cityMicros = micros.filter(m => {
          const pId = m.parentZone?._id || m.parentZone;
          return pId?.toString() === (city._id || city.id)?.toString();
        });

        return { ...city, children: cityMicros };
      });

      return { ...state, children: cityNodes };
    });
  }, [zones]);

  const filteredTree = useMemo(() => {
    if (!searchQuery) return tree;
    const lowerQuery = searchQuery.toLowerCase();

    const filterNodes = (nodes) => {
      return nodes.map(node => {
        const matchesSelf = node.name?.toLowerCase().includes(lowerQuery) || node.city?.toLowerCase().includes(lowerQuery);
        let filteredChildren = [];
        if (node.children) {
          filteredChildren = filterNodes(node.children);
        }
        const matchesChildren = filteredChildren.length > 0;

        if (matchesSelf || matchesChildren) {
          return {
            ...node,
            children: filteredChildren,
            forceExpanded: true
          };
        }
        return null;
      }).filter(Boolean);
    };

    return filterNodes(tree);
  }, [tree, searchQuery]);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isSelected = (id) => (selectedZoneIds || []).map(z => z.toString()).includes(id.toString());

  const renderNode = (node, depth = 0) => {
    const nodeId = node._id || node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!(expandedNodes[nodeId] || node.forceExpanded);
    const checked = isSelected(nodeId);

    return (
      <div key={nodeId} className="select-none">
        <div
          className="flex items-center hover:bg-gray-50 py-1.5 px-2 rounded-lg cursor-pointer transition-colors text-left"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => onChange(node)}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(nodeId, e)}
              className="p-1 hover:bg-gray-200 rounded mr-1 transition-transform duration-200"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}

          <input
            type="checkbox"
            checked={checked}
            onChange={() => { }}
            className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary mr-2 cursor-pointer"
          />

          <span className={`text-[11px] font-semibold text-secondary capitalize ${checked ? 'text-primary font-bold' : ''}`}>
            {node.name}
          </span>
          <span className="text-[8px] bg-gray-100 text-gray-500 ml-1.5 px-1.5 py-0.2 rounded font-black uppercase tracking-wider scale-90">
            {node.zoneLevel || 'state'}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <label className="block text-[10px] font-black uppercase text-gray-500 tracking-wider mb-1.5">
        {label}
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-1.5 border border-gray-250 rounded-lg bg-white cursor-pointer flex justify-between items-center text-[11px] shadow-sm hover:border-gray-400 transition-all font-semibold"
      >
        <span className="text-gray-700 truncate font-semibold">
          {(selectedZoneIds || []).length === 0 ? 'Select Zones (None)' : `${(selectedZoneIds || []).length} Zones Selected`}
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-[1000] mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-3 max-h-80 flex flex-col shrink-0">
          <AdminSearchBar
            placeholder="Search by state, city, or micro zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            className="mb-2 shrink-0"
          />

          <div className="overflow-y-auto flex-1 space-y-1 pr-1">
            {filteredTree.length === 0 ? (
              <div className="text-[10px] text-gray-400 italic text-center py-6">
                No matching zones found.
              </div>
            ) : (
              filteredTree.map(node => renderNode(node, 0))
            )}
          </div>
        </div>
      )}

      {(selectedZoneIds || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 max-h-24 overflow-y-auto p-1 bg-gray-50 rounded-lg border border-gray-200 shadow-inner">
          {(selectedZoneIds || []).map(id => {
            const zone = zones.find(z => (z._id || z.id)?.toString() === id.toString());
            if (!zone) return null;

            let badgeColor = 'bg-teal-50 text-teal-800 border-teal-200';
            if (zone.zoneLevel === 'city') badgeColor = 'bg-blue-50 text-blue-800 border-blue-200';
            if (zone.zoneLevel === 'micro') badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';

            return (
              <span key={id} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black border shadow-sm capitalize ${badgeColor}`}>
                <span>{zone.name} ({zone.zoneLevel?.toUpperCase() || 'STATE'})</span>
                <button
                  type="button"
                  onClick={() => onChange(zone)}
                  className="ml-1 inline-flex items-center justify-center focus:outline-none text-gray-400 hover:text-gray-650"
                >
                  <X className="w-2.5 h-2.5 ml-0.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ZoneManagement;
