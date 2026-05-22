import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPin, Navigation } from 'lucide-react';
import { toast } from 'react-toastify';
import 'leaflet/dist/leaflet.css';
import {
  reverseGeocode,
  toLegacyAddressFields,
  LIGHT_MAP_TILES,
  LIGHT_MAP_ATTRIBUTION,
  smartAddressBuilder
} from '../utils/format';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const locationIcon = L.divIcon({
  html: `<div style="background-color: #EF4444; width: 28px; height: 28px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [1, -34]
});

const DraggableMarker = ({ position, setPosition }) => {
  const markerRef = useRef(null);
  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        setPosition([newPos.lat, newPos.lng]);
      }
    },
  };

  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={locationIcon}
    />
  );
};

const MapUpdater = ({ center }) => {
  const map = useMapEvents({});
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 16));
  }, [center, map]);
  return null;
};

const LocationPickerModal = ({ isOpen, onClose, onLocationSelect }) => {
  const [position, setPosition] = useState([20.5937, 78.9629]);
  const [structuredAddress, setStructuredAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [houseNo, setHouseNo] = useState('');
  const geocodeTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen && !hasInitialized) {
      handleCurrentLocation();
      setHasInitialized(true);
    }
    if (!isOpen) {
      setHasInitialized(false);
    }
  }, [isOpen, hasInitialized]);

  useEffect(() => {
    if (!isOpen || position[0] === 20.5937 && position[1] === 78.9629) return;
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => {
      fetchAddressFromCoords(position[0], position[1]);
    }, 400);
    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    };
  }, [position, isOpen]);

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setDetecting(false);
      },
      () => {
        setDetecting(false);
        toast.error('Could not fetch current location');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const fetchAddressFromCoords = async (lat, lng) => {
    setLoading(true);
    try {
      const data = await reverseGeocode(lat, lng);
      setStructuredAddress(data);
      if (data.houseNumber) setHouseNo(data.houseNumber);
    } catch (error) {
      console.error('Error fetching address:', error);
      toast.error('Could not resolve address for this location');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!structuredAddress) {
      toast.error('Please wait for address to load or select a valid location');
      return;
    }

    const legacy = toLegacyAddressFields({
      ...structuredAddress,
      lat: position[0],
      lng: position[1],
      houseNumber: houseNo || structuredAddress.houseNumber || '',
      street: structuredAddress.street || structuredAddress.formattedAddress || ''
    });

    if (houseNo && !legacy.houseNumber) {
      legacy.houseNumber = houseNo;
      legacy.street = houseNo + (legacy.street ? `, ${legacy.street}` : '');
      legacy.addressLine = legacy.street;
      legacy.formattedAddress = smartAddressBuilder(
        { house_number: houseNo, road: legacy.road, suburb: legacy.area, city: legacy.city, state: legacy.state, postcode: legacy.pincode },
        legacy.formattedAddress
      );
    }

    onLocationSelect(legacy);
    onClose();
  };

  if (!isOpen) return null;

  const displayText =
    structuredAddress?.formattedAddress ||
    (structuredAddress
      ? [structuredAddress.houseNumber, structuredAddress.road, structuredAddress.area, structuredAddress.city, structuredAddress.state, structuredAddress.pincode]
          .filter(Boolean)
          .join(', ')
      : '');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[85vh] md:h-[600px]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-secondary flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> Select Your Location
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 relative bg-gray-100">
          <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution={LIGHT_MAP_ATTRIBUTION} url={LIGHT_MAP_TILES} />
            <DraggableMarker position={position} setPosition={setPosition} />
            <MapUpdater center={position} />
          </MapContainer>

          <button
            onClick={handleCurrentLocation}
            className="absolute bottom-4 right-4 z-[400] bg-white p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 text-primary"
            title="My Location"
          >
            <Navigation className={`w-5 h-5 ${detecting ? 'animate-pulse' : ''}`} />
          </button>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-md text-xs font-bold text-secondary border border-gray-200 pointer-events-none text-center">
            Drag the pin or tap on the map
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">House / Flat No.</label>
            <input
              type="text"
              value={houseNo}
              onChange={(e) => setHouseNo(e.target.value)}
              placeholder="e.g. 349, Flat 4B"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
              <span className="text-gray-400 font-semibold block">Road</span>
              <span className="text-secondary font-medium truncate block">{structuredAddress?.road || '—'}</span>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
              <span className="text-gray-400 font-semibold block">Area</span>
              <span className="text-secondary font-medium truncate block">{structuredAddress?.area || '—'}</span>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
              <span className="text-gray-400 font-semibold block">City</span>
              <span className="text-secondary font-medium truncate block">{structuredAddress?.city || '—'}</span>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
              <span className="text-gray-400 font-semibold block">Pincode</span>
              <span className="text-secondary font-medium truncate block">{structuredAddress?.pincode || structuredAddress?.postalCode || '—'}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">Formatted Address</p>
            <p className="text-sm font-medium text-secondary line-clamp-3 min-h-[48px] bg-gray-50 p-2 rounded-lg border border-gray-100">
              {loading ? (
                <span className="animate-pulse text-gray-400">Resolving address...</span>
              ) : displayText ? (
                displayText
              ) : (
                'Move map pin to select location'
              )}
            </p>
          </div>
          <button
            onClick={handleConfirm}
            disabled={loading || !structuredAddress}
            className="w-full py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
