import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Loader, X } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { LIGHT_MAP_TILES, LIGHT_MAP_ATTRIBUTION, calculateBearing } from '../utils/format';
import { latLngToS2CellId, s2CellIdToCorners } from '../utils/s2Helper';
import { getAllZones } from '../services/ZoneService';

// Fix for default Leaflet marker assets in Vite using a custom divIcon
let DefaultIcon = L.divIcon({
  html: `<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom stylized pins
const customerIcon = L.divIcon({ html: `<div style="background-color: #EF4444; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`, className: '', iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [1, -34] });

// Bike/car style moving provider marker with direction rotation
const createProviderIcon = (bearing) => {
  return L.divIcon({
    html: `
      <div style="transform: rotate(${bearing}deg); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; transition: transform 0.35s ease-out; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25));">
        <div style="background:#10B981;border:3px solid #fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M5 20a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm14 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM6.5 17h11M5 12l2-5h7l2 3h3l-2 4H8l-1-2z"/></svg>
        </div>
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

// Custom Smooth Moving Marker Component for realistic Uber style movement and rotation
const SmoothMarker = ({ position, children }) => {
  const [currentPos, setCurrentPos] = useState(position);
  const [bearing, setBearing] = useState(0);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!position || !position[0] || !position[1]) return;

    const startLat = currentPos[0];
    const startLng = currentPos[1];
    const endLat = position[0];
    const endLng = position[1];

    if (startLat === endLat && startLng === endLng) return;

    // Calculate bearing if movement is non-trivial
    const diff = Math.sqrt(Math.pow(endLat - startLat, 2) + Math.pow(endLng - startLng, 2));
    if (diff > 0.00001) {
      const newBearing = calculateBearing(startLat, startLng, endLat, endLng);
      setBearing(newBearing);
    }

    // Check if initial load or large jump (> 5km), set instantly to avoid sliding across cities
    if (diff > 0.05) {
      setCurrentPos(position);
      return;
    }

    const duration = 2800; // Sync with ~5s GPS throttle for smooth Uber-style movement
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

  const rotatedIcon = createProviderIcon(bearing);

  return (
    <Marker position={currentPos} icon={rotatedIcon}>
      {children}
    </Marker>
  );
};

// Helper component to smoothly center and fit the route bounds on updates
const MapBoundsHelper = ({ providerLoc, targetLat, targetLng }) => {
  const map = useMap();
  useEffect(() => {
    if (targetLat && targetLng) {
      if (providerLoc && providerLoc.lat && providerLoc.lng) {
        const bounds = L.latLngBounds([
          [targetLat, targetLng],
          [providerLoc.lat, providerLoc.lng]
        ]);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
      } else {
        map.setView([targetLat, targetLng], 15);
      }
    }
  }, [providerLoc, targetLat, targetLng, map]);
  return null;
};

const LiveTrackingMapUI = ({ targetLat, targetLng, providerLoc, routeCoords = [], loadingRoute = false }) => {
  const [mapStyle, setMapStyle] = useState('satellite');
  const [zones, setZones] = useState([]);
  const [actionHubModal, setActionHubModal] = useState({ open: false, zone: null });
  const centerLat = targetLat || 31.3260;
  const centerLng = targetLng || 75.5761;

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

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await getAllZones({ limit: 1000 });
        if (response?.data?.success) {
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
              name: z.name,
              city: z.city || 'Jalandhar',
              status: z.status,
              priority: z.priority,
              coordinates: coords,
              zoneLevel: z.zoneLevel || 'city',
              parentZone: z.parentZone
            };
          });
          setZones(dbZones.filter(z => z.coordinates.length > 0));
        }
      } catch (err) {
        console.error("Error loading zones in live tracking map:", err);
      }
    };
    fetchZones();
  }, []);

  const mapLayers = {
    satellite: {
      url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
      attribution: '&copy; Google Maps'
    },
    terrain: {
      url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
      attribution: '&copy; Google Maps'
    }
  };

  // Custom styling block for the premium live map animations
  const customStyles = `
    @keyframes pulseRing {
      0% {
        stroke-width: 1px;
        stroke-opacity: 0.95;
        fill-opacity: 0.35;
        transform: scale(0.65);
      }
      100% {
        stroke-width: 8px;
        stroke-opacity: 0;
        fill-opacity: 0;
        transform: scale(1.65);
      }
    }
    .live-pulse-ring {
      transform-origin: center;
      animation: pulseRing 2.5s infinite cubic-bezier(0.215, 0.610, 0.355, 1);
    }
    .custom-route-polyline {
      stroke-dasharray: 8 12;
      animation: dashmove 45s linear infinite;
    }
    @keyframes dashmove {
      to {
        stroke-dashoffset: -1000;
      }
    }
  `;

  const providerPos = providerLoc && providerLoc.lat && providerLoc.lng ? [providerLoc.lat, providerLoc.lng] : null;

  return (
    <div className="w-full h-[60vh] md:h-full flex-grow relative z-10">
      <style>{customStyles}</style>

      {/* Route GPS detection spinner overlay */}
      {loadingRoute && routeCoords.length < 2 && (
        <div className="absolute inset-0 z-[1001] bg-white/75 flex flex-col items-center justify-center backdrop-blur-sm">
          <Loader className="w-10 h-10 animate-spin text-primary" />
          <p className="text-xs font-bold text-secondary mt-3 animate-pulse uppercase tracking-wider">Calculating route...</p>
        </div>
      )}

      {/* Premium Glassmorphic Map Style Switcher */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-1 bg-white/95 backdrop-blur shadow-lg border border-gray-100 p-1 rounded-2xl pointer-events-auto">
        {[
          { id: 'satellite', label: 'Satellite', icon: '🛰️' },
          { id: 'terrain', label: '3D', icon: '🏔️' }
        ].map((style) => (
          <button
            key={style.id}
            onClick={() => setMapStyle(style.id)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase transition-all duration-200 flex items-center gap-1.5 select-none ${mapStyle === style.id
              ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
              : 'text-secondary/70 hover:bg-gray-100 hover:text-secondary active:scale-95'
              }`}
          >
            <span>{style.icon}</span>
            <span>{style.label}</span>
          </button>
        ))}
      </div>

      <MapContainer
        center={[centerLat, centerLng]}
        zoom={14}
        style={{ height: '100%', width: '100%', zIndex: 10 }}
        zoomControl={false}
      >
        <TileLayer
          key={mapStyle}
          attribution={mapLayers[mapStyle].attribution}
          url={mapLayers[mapStyle].url}
        />

        {/* Render active zone polygons */}
        {zones.map(zone => {
          let color = '#22c55e'; // active/low
          if (zone.status === 'inactive') color = '#9ca3af';
          else if (zone.priority === 'high') color = '#ef4444';
          else if (zone.priority === 'medium') color = '#eab308';

          return (
            <Polygon
              key={zone.id}
              positions={zone.coordinates}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.15, weight: 1.5 }}
              eventHandlers={{
                click: () => {
                  setActionHubModal({ open: true, zone });
                }
              }}
            />
          );
        })}

        {/* Customer Target Pulse Ring */}
        {targetLat && targetLng && (
          <Circle
            center={[targetLat, targetLng]}
            radius={200}
            pathOptions={{
              color: '#EF4444',
              fillColor: '#EF4444',
              weight: 2,
              className: 'live-pulse-ring'
            }}
          />
        )}

        {/* Customer Marker */}
        {targetLat && targetLng && (
          <Marker position={[targetLat, targetLng]} icon={customerIcon} />
        )}

        {/* Provider Pulse Ring */}
        {providerPos && (
          <Circle
            center={providerPos}
            radius={250}
            pathOptions={{
              color: '#10B981',
              fillColor: '#10B981',
              weight: 2,
              className: 'live-pulse-ring'
            }}
          />
        )}

        {/* Smooth Moving Provider Marker */}
        {providerPos && (
          <SmoothMarker position={providerPos} />
        )}

        {/* Route Polyline path */}
        {routeCoords && routeCoords.length > 0 && (
          <Polyline
            positions={routeCoords}
            color="#2563EB"
            weight={5}
            opacity={0.9}
            lineCap="round"
            lineJoin="round"
            className="custom-route-polyline"
          />
        )}

        <MapBoundsHelper
          providerLoc={providerLoc}
          targetLat={targetLat}
          targetLng={targetLng}
        />
      </MapContainer>
    </div>
  );
};

export default LiveTrackingMapUI;
