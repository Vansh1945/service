import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Loader } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

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

// Custom stylized pins
const customerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const providerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom Smooth Moving Marker Component for realistic Uber style movement
const SmoothMarker = ({ position, icon, children }) => {
  const [currentPos, setCurrentPos] = useState(position);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!position || !position[0] || !position[1]) return;
    
    const startLat = currentPos[0];
    const startLng = currentPos[1];
    const endLat = position[0];
    const endLng = position[1];

    if (startLat === endLat && startLng === endLng) return;

    // Check if initial load or large jump (> 5km), set instantly to avoid sliding across cities
    const diff = Math.sqrt(Math.pow(endLat - startLat, 2) + Math.pow(endLng - startLng, 2));
    if (diff > 0.05) {
      setCurrentPos(position);
      return;
    }

    const duration = 4000; // Continuous 4-second animation for en-route smoothness
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

  return (
    <div className="w-full h-[60vh] md:h-full flex-grow relative z-10">
      <style>{customStyles}</style>

      {/* Route GPS detection spinner overlay */}
      {loadingRoute && (!providerLoc || routeCoords.length === 0) && (
        <div className="absolute inset-0 z-[1001] bg-slate-950/80 flex flex-col items-center justify-center backdrop-blur-sm">
          <Loader className="w-10 h-10 animate-spin text-teal-400" />
          <p className="text-xs font-bold text-slate-200 mt-3 animate-pulse uppercase tracking-wider">Calculating live en-route path...</p>
        </div>
      )}

      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={14} 
        style={{ height: '100%', width: '100%', zIndex: 10 }}
        zoomControl={false}
      >
        {/* CartoDB Dark Matter Tile Layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
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
          <SmoothMarker position={providerPos} icon={providerIcon} />
        )}
        
        {/* Route Polyline path */}
        {routeCoords && routeCoords.length > 0 && (
          <Polyline 
            positions={routeCoords} 
            color="#00F0FF" 
            weight={6} 
            opacity={0.85} 
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
