import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPin, Navigation } from 'lucide-react';
import { toast } from 'react-toastify';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const locationIcon = L.divIcon({ html: `<div style="background-color: #EF4444; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`, className: '', iconSize: [24, 24], iconAnchor: [12, 24], popupAnchor: [1, -34] });

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
        map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
};

const LocationPickerModal = ({ isOpen, onClose, onLocationSelect }) => {
    const [position, setPosition] = useState([20.5937, 78.9629]); // Default India center
    const [addressDetails, setAddressDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);
    
    // Custom House No state since Nominatim might miss it
    const [houseNo, setHouseNo] = useState('');

    useEffect(() => {
        if (isOpen && !hasInitialized) {
            handleCurrentLocation();
            setHasInitialized(true);
        }
    }, [isOpen, hasInitialized]);

    useEffect(() => {
        if (position[0] !== 20.5937 && isOpen) {
            fetchAddressFromCoords(position[0], position[1]);
        }
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
            (err) => {
                setDetecting(false);
                toast.error('Could not fetch current location');
            },
            { enableHighAccuracy: true }
        );
    };

    const fetchAddressFromCoords = async (lat, lng) => {
        setLoading(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
            const data = await response.json();
            
            if (data && data.address) {
                setAddressDetails(data);
                if(data.address.house_number) {
                    setHouseNo(data.address.house_number);
                }
            }
        } catch (error) {
            console.error('Error fetching address:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = () => {
        if (!addressDetails) {
            toast.error('Please wait for address to load or select a valid location');
            return;
        }

        const { address } = addressDetails;
        const houseInfo = houseNo ? `House No. ${houseNo}` : '';
        const landmarkInfo = address.building || address.amenity || address.shop || address.office || address.commercial || address.tourism || address.leisure || address.historic ? `Near ${address.building || address.amenity || address.shop || address.office || address.commercial || address.tourism || address.leisure || address.historic}` : '';
        const streetAddress = [houseInfo, address.road, address.neighbourhood, address.suburb, landmarkInfo].filter(Boolean).join(', ') || addressDetails.display_name.split(',').slice(0, 3).join(', ');

        onLocationSelect({
            street: streetAddress,
            city: address.city || address.town || address.village || '',
            state: address.state || '',
            postalCode: address.postcode || '',
            lat: position[0],
            lng: position[1]
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[85vh] md:h-[600px]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <h3 className="font-bold text-secondary flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-primary" /> Select Your Location
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-gray-100">
                    <MapContainer 
                        center={position} 
                        zoom={16} 
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
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
                        Drag the pin or click on the map
                    </div>
                </div>

                {/* Footer/Details */}
                <div className="p-4 border-t border-gray-100 bg-white space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">House/Flat No. (Important)</label>
                        <input
                            type="text"
                            value={houseNo}
                            onChange={(e) => setHouseNo(e.target.value)}
                            placeholder="E.g. House 123, Flat 4B (Add if missing)"
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-400 mb-1">Detected Area</p>
                        <p className="text-sm font-medium text-secondary line-clamp-2 min-h-[40px] bg-gray-50 p-2 rounded-lg border border-gray-100">
                            {loading ? (
                                <span className="animate-pulse text-gray-400">Loading address...</span>
                            ) : addressDetails ? (
                                addressDetails.display_name
                            ) : (
                                "Move map pin to select location"
                            )}
                        </p>
                    </div>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !addressDetails}
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
