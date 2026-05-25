import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import * as BookingService from '../../services/BookingService';
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

const defaultZones = [
  {
    id: 'zone-jalandhar',
    name: 'Jalandhar City Center',
    city: 'Jalandhar',
    status: 'active',
    priority: 'high',
    maxProviders: 40,
    serviceRadius: 5,
    coordinates: [
      [31.340, 75.560],
      [31.350, 75.595],
      [31.315, 75.605],
      [31.305, 75.565]
    ],
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'zone-nakodar',
    name: 'Nakodar Junction Area',
    city: 'Nakodar',
    status: 'active',
    priority: 'medium',
    maxProviders: 15,
    serviceRadius: 7,
    coordinates: [
      [31.140, 75.460],
      [31.155, 75.495],
      [31.120, 75.505],
      [31.110, 75.465]
    ],
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'zone-phagwara',
    name: 'Phagwara Hub East',
    city: 'Phagwara',
    status: 'inactive',
    priority: 'low',
    maxProviders: 25,
    serviceRadius: 6,
    coordinates: [
      [31.230, 75.760],
      [31.245, 75.790],
      [31.215, 75.795],
      [31.200, 75.765]
    ],
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const mockProviders = [
  { _id: 'p-1', name: 'Amrinder Singh', serviceCategory: 'Electrician', isOnline: true, status: 'available', coords: [31.330, 75.580] },
  { _id: 'p-2', name: 'Rajesh Kumar', serviceCategory: 'Plumber', isOnline: true, status: 'busy', coords: [31.325, 75.572] },
  { _id: 'p-3', name: 'Gurbaksh Singh', serviceCategory: 'HVAC Specialist', isOnline: true, status: 'overloaded', coords: [31.335, 75.590] },
  { _id: 'p-4', name: 'Priya Sharma', serviceCategory: 'Cleaning', isOnline: true, status: 'available', coords: [31.135, 75.480] },
  { _id: 'p-5', name: 'Amit Verma', serviceCategory: 'Appliance Repair', isOnline: true, status: 'busy', coords: [31.220, 75.775] }
];

const mockBookings = [
  { _id: 'b-1', customer: { name: 'Manpreet Kaur' }, lat: 31.332, lng: 75.578, amount: 1500 },
  { _id: 'b-2', customer: { name: 'Sunil Dutt' }, lat: 31.328, lng: 75.582, amount: 800 },
  { _id: 'b-3', customer: { name: 'Karan Johar' }, lat: 31.130, lng: 75.485, amount: 2200 },
  { _id: 'b-4', customer: { name: 'Asha Rani' }, lat: 31.225, lng: 75.780, amount: 1200 }
];

const ZoneManagement = () => {
  const { showToast } = useAuth();
  const [zones, setZones] = useState(() => {
    const saved = localStorage.getItem('service_dispatch_zones');
    return saved ? JSON.parse(saved) : defaultZones;
  });

  const [providers, setProviders] = useState(mockProviders);
  const [bookings, setBookings] = useState(mockBookings);
  const [loading, setLoading] = useState(false);

  // Search, Filter and Collapse States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Drawing and Form States
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState(null);

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

  // Save zones to local storage on changes
  useEffect(() => {
    localStorage.setItem('service_dispatch_zones', JSON.stringify(zones));
  }, [zones]);

  // Fetch provider and booking spatial coordinates from server
  const fetchTelemetry = async () => {
    try {
      setLoading(true);
      const [provRes, bookRes] = await Promise.all([
        AdminService.getAllProviders().catch(() => null),
        BookingService.getAllBookings({ limit: 1000 }).catch(() => null)
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
    } catch (err) {
      console.error("Telemetry fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  // Compute spatial statistics inside a zone polygon dynamically
  const getZoneStats = (coordinates) => {
    let provCount = 0;
    let activeJobs = 0;
    let totalEtaSum = 0;

    providers.forEach(p => {
      if (p.coords && isPointInPolygon(p.coords[0], p.coords[1], coordinates)) {
        provCount++;
      }
    });

    bookings.forEach(b => {
      if (isPointInPolygon(b.lat, b.lng, coordinates)) {
        activeJobs++;
        // Calculate mock response time
        totalEtaSum += 12; // 12 min default base response time
      }
    });

    const avgEta = activeJobs > 0 ? Math.round(totalEtaSum / activeJobs) : 10;

    return {
      providersCount: provCount,
      activeBookingsCount: activeJobs,
      avgResponseTime: avgEta
    };
  };

  // Color mapping based on Priority and Status
  const getZoneStyle = (status, priority) => {
    if (status === 'inactive') {
      return { color: '#9ca3af', fillColor: '#9ca3af', fillOpacity: 0.2, weight: 2 }; // Inactive zone = Gray
    }
    // Active zone colors based on demand/priority levels
    if (priority === 'high') {
      return { color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 2.5 }; // High demand = Red
    }
    if (priority === 'medium') {
      return { color: '#eab308', fillColor: '#eab308', fillOpacity: 0.2, weight: 2 }; // Medium = Yellow
    }
    return { color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.2, weight: 2 }; // Low/Active default = Green
  };

  const getProviderMarkerIcon = (status) => {
    let color = '#22c55e'; // Green Available
    if (status === 'busy') color = '#eab308'; // Yellow busy
    else if (status === 'overloaded') color = '#ef4444'; // Red overloaded

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

  // Save new or updated zone
  const handleSaveZone = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      if (showToast) showToast('Please enter a valid Zone Name', 'warning');
      return;
    }
    if (drawPoints.length < 3) {
      if (showToast) showToast('A boundary requires at least 3 vertices', 'warning');
      return;
    }

    const payload = {
      id: editingZoneId || 'zone-' + Date.now(),
      name: formData.name,
      city: formData.city,
      status: formData.status,
      priority: formData.priority,
      maxProviders: Number(formData.maxProviders),
      serviceRadius: Number(formData.serviceRadius),
      coordinates: drawPoints,
      updatedAt: new Date().toISOString()
    };

    if (editingZoneId) {
      setZones(prev => prev.map(z => z.id === editingZoneId ? { ...z, ...payload } : z));
      if (showToast) showToast('Service zone boundary updated successfully.', 'success');
    } else {
      payload.createdAt = new Date().toISOString();
      setZones(prev => [payload, ...prev]);
      if (showToast) showToast('New service zone deployed successfully.', 'success');
    }

    setIsDrawing(false);
    setDrawPoints([]);
    setShowForm(false);
    setEditingZoneId(null);
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
  const handleToggleStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    setZones(prev => prev.map(z => z.id === id ? { ...z, status: nextStatus, updatedAt: new Date().toISOString() } : z));
    if (showToast) showToast(`Zone is now ${nextStatus.toUpperCase()}`, 'success');
  };

  // Delete Zone Handler
  const handleDeleteZone = () => {
    if (!deleteConfirmId) return;
    setZones(prev => prev.filter(z => z.id !== deleteConfirmId));
    if (showToast) showToast('Service zone deleted successfully.', 'success');
    setDeleteConfirmId(null);
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
    <div className="flex flex-col h-[calc(100vh-150px)] text-gray-850 font-sans relative select-none overflow-hidden">
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
        <div className="col-span-2 md:col-span-1 bg-white border border-gray-250 p-4 rounded-2xl flex flex-col justify-between hover:border-primary/40 hover:shadow-md transition-all shadow-sm">
          <div className="flex justify-between items-center text-gray-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Avg Response Time</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-2xl font-black mt-2 text-gray-900">{stats.avgResponse} mins</h3>
          <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider">Dispatch Latency</p>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 relative overflow-hidden">
        {/* Left Side Sidebar Panel - Controls & Zone lists */}
        <div className={`${sidebarOpen ? 'w-full lg:w-96' : 'w-0 lg:w-0'} bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden transition-all duration-300 relative z-[2] shadow-sm`}>
          <div className="p-4 border-b border-gray-100 space-y-3 shrink-0">
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
              <form onSubmit={handleSaveZone} className="bg-gray-50 border border-gray-200 p-3 rounded-xl space-y-2.5 animate-slide-up">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-primary font-extrabold uppercase tracking-wider">
                    {editingZoneId ? '✏️ Edit Zone Coordinates' : '📐 Drawing Mode Active'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600 text-[8px] font-black uppercase">
                    {drawPoints.length} Vertices
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Zone Name (e.g. Jalandhar East)"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-white border border-gray-250 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary text-gray-900 placeholder-gray-400"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                    className="px-2.5 py-1.5 bg-white border border-gray-250 text-gray-900 rounded-lg text-[10px] outline-none"
                  >
                    <option value="Jalandhar">Jalandhar</option>
                    <option value="Nakodar">Nakodar</option>
                    <option value="Phagwara">Phagwara</option>
                  </select>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                    className="px-2.5 py-1.5 bg-white border border-gray-250 text-gray-900 rounded-lg text-[10px] outline-none"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="px-2.5 py-1.5 bg-white border border-gray-250 text-gray-900 rounded-lg text-[10px] outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Max Providers"
                    value={formData.maxProviders}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxProviders: e.target.value }))}
                    className="px-2.5 py-1.5 bg-white border border-gray-250 rounded-lg text-[10px] text-gray-900 placeholder-gray-400"
                    min="1"
                    title="Max Providers"
                  />
                </div>
                <div className="w-full">
                  <input
                    type="number"
                    placeholder="Service Radius (km)"
                    value={formData.serviceRadius}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceRadius: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-250 rounded-lg text-[10px] text-gray-900 placeholder-gray-400"
                    min="1"
                    title="Service Radius"
                  />
                </div>
                <div className="grid grid-cols-3 gap-1 text-[8px] font-black uppercase tracking-wider">
                  <button
                    type="submit"
                    className="py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-all font-black text-center"
                  >
                    Save Zone
                  </button>
                  <button
                    type="button"
                    onClick={handleClearDrawing}
                    className="py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-md transition-all font-black text-center"
                  >
                    Clear Map
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-md transition-all font-black text-center"
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
                    <option value="Jalandhar">Jalandhar</option>
                    <option value="Nakodar">Nakodar</option>
                    <option value="Phagwara">Phagwara</option>
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
                    className="p-3 bg-white border border-gray-150 rounded-xl space-y-2 hover:border-gray-300 hover:shadow-sm shadow-sm transition-all flex flex-col relative group"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-1.5 h-3.5 bg-primary rounded-full"></span>
                        <h4 className="text-[11px] font-black text-gray-900 uppercase tracking-wider">{zone.name}</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleToggleStatus(zone.id, zone.status)}
                          className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all tracking-wider ${zone.status === 'active'
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                          {zone.status === 'active' ? 'Active' : 'Disabled'}
                        </button>
                        <button
                          onClick={() => handleEditZone(zone)}
                          className="p-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-550 hover:text-gray-900 hover:bg-gray-150 transition-all"
                          title="Edit Boundary Parameters"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(zone.id)}
                          className="p-1 bg-gray-50 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Delete Zone"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-[9px] text-gray-400 uppercase tracking-widest font-bold">
                      <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 text-primary" /> {zone.city}</span>
                      <span>•</span>
                      <span className={`font-black ${zone.priority === 'high' ? 'text-red-600' :
                          zone.priority === 'medium' ? 'text-yellow-600' : 'text-emerald-600'
                        }`}>{zone.priority} Priority</span>
                    </div>

                    {/* Statistical details panel */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-[9px]">
                      <div className="bg-gray-55 p-1.5 rounded-lg border border-gray-100/85 flex flex-col justify-center">
                        <span className="text-[7px] text-gray-450 font-bold uppercase">Providers</span>
                        <span className="text-gray-800 font-black text-xs mt-0.5">{zoneStats.providersCount}</span>
                      </div>
                      <div className="bg-gray-55 p-1.5 rounded-lg border border-gray-100/85 flex flex-col justify-center">
                        <span className="text-[7px] text-gray-450 font-bold uppercase">Active Jobs</span>
                        <span className="text-gray-800 font-black text-xs mt-0.5">{zoneStats.activeBookingsCount}</span>
                      </div>
                      <div className="bg-gray-55 p-1.5 rounded-lg border border-gray-100/85 flex flex-col justify-center">
                        <span className="text-[7px] text-gray-450 font-bold uppercase">Avg ETA</span>
                        <span className="text-primary font-black text-xs mt-0.5">{zoneStats.avgResponseTime} min</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleFocusZone(zone.coordinates)}
                      className="w-full py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 text-[8px] font-black rounded-lg transition-all uppercase tracking-widest border border-gray-200 mt-1 flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> Center & Preview Map
                    </button>
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
        <div className="flex-1 bg-gray-100 border border-gray-200 rounded-2xl overflow-hidden relative min-h-[350px] shadow-sm">
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
                        <p className="flex justify-between"><span className="text-gray-400 font-semibold font-black text-amber-600">Total Bookings:</span> <span className="font-black text-amber-600 text-xs">{zoneDetails.activeBookingsCount}</span></p>
                        <p className="flex justify-between"><span className="text-gray-400 font-semibold">Response ETA:</span> <span className="font-black text-teal-600">{zoneDetails.avgResponseTime} min</span></p>
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
