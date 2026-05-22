import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Loader } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { LIGHT_MAP_TILES, LIGHT_MAP_ATTRIBUTION, calculateBearing } from '../utils/format';
import { latLngToS2CellId, s2CellIdToCorners } from '../utils/s2Helper';


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
  const centerLat = targetLat || 31.3260;
  const centerLng = targetLng || 75.5761;

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

  // Real-time S2 Geometry Cell calculations for visual containment geofencing
  const customerS2CellId = targetLat && targetLng ? latLngToS2CellId(targetLat, targetLng, 15) : null;
  const customerS2Corners = customerS2CellId ? s2CellIdToCorners(customerS2CellId) : [];

  const customerL13CellId = targetLat && targetLng ? latLngToS2CellId(targetLat, targetLng, 13) : null;
  const customerL13Corners = customerL13CellId ? s2CellIdToCorners(customerL13CellId) : [];

  const providerS2CellId = providerLoc && providerLoc.lat && providerLoc.lng ? latLngToS2CellId(providerLoc.lat, providerLoc.lng, 15) : null;
  const providerS2Corners = providerS2CellId ? s2CellIdToCorners(providerS2CellId) : [];

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

      {/* Dynamic S2 Location Telemetry overlay card */}
      <div className="absolute top-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-xl border border-slate-700 shadow-xl max-w-xs transition-all pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">S2 Geofence Status</span>
        </div>
        <div className="space-y-1.5 text-[11px] font-mono">
          <div className="flex justify-between gap-4 border-b border-slate-800 pb-1">
            <span className="text-slate-400 font-sans">Dest L15 Cell:</span>
            <span className="text-red-400 font-semibold">{customerS2CellId || '—'}</span>
          </div>
          {providerLoc && (
            <>
              <div className="flex justify-between gap-4 border-b border-slate-800 pb-1">
                <span className="text-slate-400 font-sans">Provider L15 Cell:</span>
                <span className="text-emerald-400 font-semibold">{providerS2CellId || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400 font-sans">Geofence Proximity:</span>
                <span className={customerS2CellId === providerS2CellId ? "text-emerald-400 font-bold" : "text-amber-400 font-bold animate-pulse"}>
                  {customerS2CellId === providerS2CellId ? "CONTAINED (0m)" : "EN ROUTE"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={14} 
        style={{ height: '100%', width: '100%', zIndex: 10 }}
        zoomControl={false}
      >
        <TileLayer attribution={LIGHT_MAP_ATTRIBUTION} url={LIGHT_MAP_TILES} />
        
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

        {/* Customer L13 Matchmaking Cell */}
        {customerL13Corners.length > 0 && (
          <Polygon
            positions={customerL13Corners}
            pathOptions={{
              color: '#3B82F6',
              weight: 1.5,
              dashArray: '8, 8',
              fillColor: '#3B82F6',
              fillOpacity: 0.02
            }}
          />
        )}

        {/* Customer L15 Geofence Cell */}
        {customerS2Corners.length > 0 && (
          <Polygon
            positions={customerS2Corners}
            pathOptions={{
              color: '#EF4444',
              weight: 2,
              dashArray: '5, 5',
              fillColor: '#EF4444',
              fillOpacity: 0.08
            }}
          />
        )}

        {/* Provider L15 Cell */}
        {providerS2Corners.length > 0 && (
          <Polygon
            positions={providerS2Corners}
            pathOptions={{
              color: '#10B981',
              weight: 1.8,
              dashArray: '4, 4',
              fillColor: '#10B981',
              fillOpacity: 0.06
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
