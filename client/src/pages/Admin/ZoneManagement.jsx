import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import * as BookingService from '../../services/BookingService';
import * as ZoneService from '../../services/ZoneService';
import Loader from '../../components/Loader';
import { MapContainer, TileLayer, Polygon, Polyline, Circle, Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Users, Zap, Clock, Trash2, Edit, Check, X,
  Plus, RefreshCw, AlertTriangle, Search, Filter, Layers,
  Compass, Eye, ShieldCheck, Activity, Award
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
    serviceRadius: 5
  });

  // Modal and Map States
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [mapCenter, setMapCenter] = useState([31.3260, 75.5762]);
  const [mapZoom, setMapZoom] = useState(12);

  // Fetch zones from server
  const fetchZones = async () => {
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
            updatedAt: z.updatedAt
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
  };

  // Fetch provider and booking spatial coordinates from server
  const fetchTelemetry = async () => {
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
  };

  useEffect(() => {
    fetchZones();
    fetchTelemetry();
  }, []);

  // Compute spatial statistics inside a zone polygon dynamically
  const getZoneStats = (coordinates) => {
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
      serviceRadius: 5
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

  // Clear current drawing vertices
  const handleClearDrawing = () => {
    setDrawPoints([]);
  };

  const handleAutoGenerateBoundary = async () => {
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
  };

  // Save new or updated zone
  const handleSaveZone = async (e) => {
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
      serviceRadius: Number(formData.serviceRadius)
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
  };

  // Trigger Zone Editing
  const handleEditZone = (zone) => {
    setEditingZoneId(zone.id);
    setFormData({
      name: zone.name,
      city: zone.city,
      priority: zone.priority,
      status: zone.status,
      maxProviders: zone.maxProviders,
      serviceRadius: zone.serviceRadius
    });
    setDrawPoints(zone.coordinates);
    setIsDrawing(true);
    setShowForm(true);
    const center = getPolygonCenter(zone.coordinates);
    setMapCenter(center);
    setMapZoom(13);
  };

  // Quick enable/disable status toggle from card
  const handleToggleStatus = async (id, currentStatus) => {
    try {
      setLoading(true);
      await ZoneService.toggleZoneStatus(id);
      if (showToast) showToast(`Zone status toggled successfully`, 'success');
      fetchZones();
    } catch (err) {
      console.error("Error toggling zone status:", err);
      if (showToast) showToast('Failed to toggle status', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete Zone Handler
  const handleDeleteZone = async () => {
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
  };

  // Center/Zoom map to specific zone
  const handleFocusZone = (coordinates) => {
    const center = getPolygonCenter(coordinates);
    setMapCenter(center);
    setMapZoom(13);
  };

  // Search and Filters Logic
  const filteredZones = useMemo(() => {
    return zones.filter(zone => {
      const matchSearch = zone.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCity = filterCity === '' || zone.city.toLowerCase() === filterCity.toLowerCase();
      const matchStatus = filterStatus === '' || zone.status === filterStatus;
      const matchPriority = filterPriority === '' || zone.priority === filterPriority;
      return matchSearch && matchCity && matchStatus && matchPriority;
    });
  }, [zones, searchQuery, filterCity, filterStatus, filterPriority]);

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 shrink-0">
        <div className="bg-white border border-gray-250 p-4 rounded-2xl flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all shadow-sm">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Zones</span>
            <Layers className="w-4 h-4 text-primary animate-pulse" />
          </div>
          <h3 className="text-2xl font-black mt-2 text-gray-900">{stats.totalZones}</h3>
          <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider">Configured Areas</p>
        </div>
        <div className="bg-white border border-gray-250 p-4 rounded-2xl flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all shadow-sm">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Active Zones</span>
            <Compass className="w-4 h-4 text-teal-500 animate-spin-slow" />
          </div>
          <h3 className="text-2xl font-black mt-2 text-gray-900">{stats.activeZones}</h3>
          <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider">Enforcing Dispatch</p>
        </div>
        <div className="bg-white border border-gray-250 p-4 rounded-2xl flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all shadow-sm">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Providers</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className="text-2xl font-black mt-2 text-gray-900">{stats.totalProviders}</h3>
          <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider">Active Providers</p>
        </div>
        <div className="bg-white border border-gray-250 p-4 rounded-2xl flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all shadow-sm">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Zone Coverage %</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <h3 className="text-2xl font-black mt-2 text-gray-900">{stats.coverage}%</h3>
          <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider">Operational Density</p>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 relative min-h-0 overflow-hidden">
        {/* Left Side Sidebar Panel - Controls & Zone lists */}
        <div className={`${sidebarOpen ? 'w-full lg:w-96' : 'w-0 lg:w-0'} ${activeTab === 'list' ? 'flex' : 'hidden lg:flex'
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
              <form onSubmit={handleSaveZone} className="bg-gray-50 border border-gray-200 p-3 rounded-xl space-y-3 animate-slide-up shadow-inner">
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
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-wider block">City</label>
                    <input
                      type="text"
                      placeholder="e.g. Jalandhar"
                      value={formData.city}
                      onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                      className="w-full px-2 py-1.5 bg-white border border-gray-250 text-gray-900 rounded-lg text-[11px] outline-none font-semibold"
                      required
                    />
                    <p className="text-[7.5px] text-gray-400 font-medium">City this zone belongs to.</p>
                  </div>
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
                    <p className="text-[7.5px] text-gray-400 font-medium">High = faster dispatch, surge pricing applies.</p>
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
                    <p className="text-[7.5px] text-gray-400 font-medium">Active = zone is live and enforcing dispatch rules.</p>
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
                    <p className="text-[7.5px] text-gray-400 font-medium">Maximum providers allowed to operate in this zone.</p>
                  </div>
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
                  <p className="text-[7.5px] text-gray-400 font-medium">Max distance (km) within which providers are matched to customers. Also used as fallback radius for auto-generated boundaries.</p>
                </div>

                <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-500/20 text-[8.5px] text-amber-800 font-medium leading-relaxed space-y-1">
                  <p className="font-black text-amber-950 text-[9px]">🗺️ How to create a zone boundary:</p>
                  <p><strong>Option A:</strong> Enter a Pincode or Area name above → click Generate. The boundary will be auto-drawn.</p>
                  <p><strong>Option B:</strong> Switch to Map tab → click on the map to place vertices one by one. Min 3 points needed.</p>
                  <p><strong>Editing:</strong> Drag any vertex to reposition. Click a vertex to delete it.</p>
                  <p className="text-amber-600 font-bold">When done → fill all fields above → click "Save Boundary".</p>
                </div>

                <div className="flex gap-2 pt-1.5">
                  <button
                    type="submit"
                    className="flex-1 w-full py-2 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-lg transition-all font-black text-center shadow-md cursor-pointer"
                  >
                    Save Boundary
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDrawing}
                    className="flex-1 py-2 bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-700 rounded-lg transition-all font-black text-center shadow-sm cursor-pointer"
                  >
                    Clear Map
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="flex-1 py-2 bg-white border border-gray-200 hover:bg-gray-50 active:scale-95 text-gray-700 rounded-lg transition-all font-black text-center shadow-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Search and Filters Layout */}
            {!showForm && (
              <div className="space-y-2 animate-fade-in">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search zones..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-[10px] outline-none focus:ring-1 focus:ring-primary text-gray-900 font-sans"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                  <select
                    value={filterCity}
                    onChange={(e) => setFilterCity(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1 text-gray-600"
                  >
                    <option value="">All Cities</option>
                    {Array.from(new Set(zones.map(z => z.city).filter(Boolean))).sort().map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1 text-gray-600"
                  >
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-1 text-gray-600"
                  >
                    <option value="">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Scrollable list card representation */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
            {filteredZones.length > 0 ? (
              filteredZones.map(zone => {
                const zoneStats = getZoneStats(zone.coordinates);
                return (
                  <div
                    key={zone.id}
                    className="p-3 bg-white border border-gray-150 rounded-xl space-y-2.5 hover:border-gray-300 hover:shadow-md shadow-sm transition-all flex flex-col relative group select-text"
                  >
                    {/* Header row */}
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                        <span className={`w-1.5 h-3.5 rounded-full shrink-0 ${zone.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                        <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-wider truncate cursor-text" title={zone.name}>{zone.name}</h4>
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

                    {/* Zone meta info */}
                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[9px] text-gray-500 font-semibold">
                      <span className="flex items-center gap-0.5 cursor-text" title="City this zone belongs to"><MapPin className="w-3 h-3 text-primary" /> {zone.city}</span>
                      <span className="text-gray-300">|</span>
                      <span className={`font-black cursor-text ${zone.priority === 'high' ? 'text-red-600' :
                        zone.priority === 'medium' ? 'text-yellow-600' : 'text-emerald-600'
                        }`} title={`Priority: ${zone.priority} — affects dispatch speed and surge pricing`}>{zone.priority} Priority</span>
                      <span className="text-gray-300">|</span>
                      <span className="cursor-text" title="Max providers limit for this zone">Max: {zone.maxProviders} providers</span>
                      <span className="text-gray-300">|</span>
                      <span className="cursor-text" title="Service matching radius in kilometers">Radius: {zone.serviceRadius} km</span>
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-1.5 text-[9px]">
                      <div className="bg-blue-50/60 p-1.5 rounded-lg border border-blue-100 flex flex-col justify-center" title="Total active providers inside this zone">
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
                  <Popup minWidth={220}>
                    <div className="p-2.5 font-sans text-gray-800 bg-white rounded-xl">
                      <div className="flex items-center space-x-1.5 border-b border-gray-150 pb-2 mb-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${zone.status === 'inactive' ? 'bg-gray-400' :
                          zone.priority === 'high' ? 'bg-red-500' :
                            zone.priority === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                          }`}></span>
                        <h3 className="font-black text-xs uppercase tracking-wider text-gray-900">{zone.name}</h3>
                      </div>
                      <div className="space-y-1.5 text-[10px] text-gray-650 uppercase font-sans">
                        <p className="flex justify-between"><span className="text-gray-400 font-semibold">City Hub:</span> <span className="font-black text-gray-800">{zone.city}</span></p>
                        <p className="flex justify-between"><span className="text-gray-400 font-semibold">Status:</span> <span className={`font-black ${zone.status === 'active' ? 'text-emerald-600' : 'text-gray-500'}`}>{zone.status}</span></p>
                        <p className="flex justify-between"><span className="text-gray-400 font-semibold">Max Providers:</span> <span className="font-black text-gray-800">{zone.maxProviders}</span></p>
                        <p className="flex justify-between"><span className="text-gray-400 font-semibold">Radius Limit:</span> <span className="font-black text-gray-800">{zone.serviceRadius} KM</span></p>
                        <p className="flex justify-between border-t border-gray-150 pt-2 mt-2"><span className="text-gray-400 font-semibold">Providers inside:</span> <span className="font-black text-blue-600">{zoneDetails.providersCount}</span></p>
                        <p className="flex justify-between"><span className="text-gray-400 font-semibold font-black text-purple-600">Customers:</span> <span className="font-black text-purple-600 text-xs">{zoneDetails.customerCount}</span></p>
                        <p className="flex justify-between"><span className="text-gray-400 font-semibold font-black text-amber-600">Total Bookings:</span> <span className="font-black text-amber-600 text-xs">{zoneDetails.activeBookingsCount}</span></p>
                      </div>
                    </div>
                  </Popup>
                  <Tooltip sticky>
                    <span className="font-sans font-bold text-xs uppercase text-slate-800">{zone.name} Zone ({zone.city})</span>
                  </Tooltip>
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
                  <div className="p-1 font-sans text-xs text-slate-900">
                    <h4 className="font-black text-slate-900">{prov.name}</h4>
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
    </div>
  );
};

export default ZoneManagement;
