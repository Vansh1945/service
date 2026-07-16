import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Loader } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MdHome } from 'react-icons/md';
import { BsLightningChargeFill } from 'react-icons/bs';
import 'leaflet/dist/leaflet.css';
import { calculateBearing } from '../utils/format';

// Fix for default Leaflet marker assets in Vite using a custom divIcon
let DefaultIcon = L.divIcon({
  html: `<div style="background-color: #3B82F6; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [1, -34]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom stylized customer icon
const customerIconHtml = renderToStaticMarkup(
  <div className="w-[42px] h-[42px] flex items-center justify-center bg-transparent">
    <div className="bg-danger text-white border-[3px] border-white rounded-full w-[36px] h-[36px] md:w-[42px] md:h-[42px] flex items-center justify-center shadow-lg transition-all duration-300">
      <MdHome className="w-5 h-5 md:w-6 md:h-6 text-white" />
    </div>
  </div>
);

const customerIcon = L.divIcon({
  html: customerIconHtml,
  className: 'bg-transparent border-0',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -21]
});

// Bike/car style moving provider marker with direction rotation
const createProviderIcon = (bearing) => {
  const providerIconHtml = renderToStaticMarkup(
    <div className="w-[42px] h-[42px] flex items-center justify-center bg-transparent">
      <div 
        className="bg-primary text-white border-[3px] border-white rounded-full w-[36px] h-[36px] md:w-[42px] md:h-[42px] flex items-center justify-center shadow-lg transition-transform duration-300 animate-pulse"
        style={{ transform: `rotate(${bearing}deg)` }}
      >
        <BsLightningChargeFill className="w-4.5 h-4.5 md:w-5.5 md:h-5.5 text-white" />
      </div>
    </div>
  );
  return L.divIcon({
    html: providerIconHtml,
    className: 'bg-transparent border-0',
    iconSize: [42, 42],
    iconAnchor: [21, 21]
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
      <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
        ⚡ Service Provider
      </Tooltip>
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
  const centerLat = targetLat || 31.3260;
  const centerLng = targetLng || 75.5761;

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

  const providerPos = providerLoc && providerLoc.lat && providerLoc.lng ? [providerLoc.lat, providerLoc.lng] : null;

  return (
    <div className="w-full h-[60vh] md:h-full flex-grow relative z-10">
      {/* Route GPS detection spinner overlay */}
      {loadingRoute && routeCoords.length < 2 && (
        <div className="absolute inset-0 z-[1001] bg-white/75 flex flex-col items-center justify-center backdrop-blur-sm">
          <Loader className="w-10 h-10  text-primary" />
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

        {/* Customer Marker */}
        {targetLat && targetLng && (
          <Marker position={[targetLat, targetLng]} icon={customerIcon}>
            <Tooltip direction="top" offset={[0, -20]} opacity={0.9}>
              🏠 Customer Location
            </Tooltip>
          </Marker>
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
