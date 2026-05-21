import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
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
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
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

  return (
    <div className="w-full h-[60vh] md:h-full flex-grow relative z-10">
      {/* Route GPS detection spinner overlay */}
      {loadingRoute && (!providerLoc || routeCoords.length === 0) && (
        <div className="absolute inset-0 z-[1001] bg-white/75 flex flex-col items-center justify-center backdrop-blur-sm">
          <Loader className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-bold text-secondary mt-2 animate-pulse">Calculating live OSRM navigation path...</p>
        </div>
      )}

      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={14} 
        style={{ height: '100%', width: '100%', zIndex: 10 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Customer Marker */}
        {targetLat && targetLng && (
          <Marker position={[targetLat, targetLng]} icon={customerIcon} />
        )}
        
        {/* Provider Marker */}
        {providerLoc && providerLoc.lat && providerLoc.lng && (
          <Marker position={[providerLoc.lat, providerLoc.lng]} icon={providerIcon} />
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
