import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPin, Navigation, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import 'leaflet/dist/leaflet.css';
import {
  reverseGeocode,
  toLegacyAddressFields,
  buildAddressPreview,
  LIGHT_MAP_TILES,
  LIGHT_MAP_ATTRIBUTION,
  smartAddressBuilder,
  detectCurrentLocation,
  cleanAddressFields
} from '../utils/format';
import { latLngToS2CellId, s2CellIdToCorners } from '../utils/s2Helper';


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
  const [road, setRoad] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const geocodeTimerRef = useRef(null);
  const shouldSkipGeocodeRef = useRef(false);
  const searchContextRef = useRef(null);
  const didInitializeRef = useRef(false);

  // State for India-only address search autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // S2 Cell calculations for real-time visualization & backend sync
  const cellId13 = position ? latLngToS2CellId(position[0], position[1], 13) : null;
  const cellId20 = position ? latLngToS2CellId(position[0], position[1], 20) : null;

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=15&countrycode=in&lat=${position[0]}&lon=${position[1]}&location_bias_scale=0.6`);
      const data = await res.json();
      let results = data?.features || [];
      
      // Filter India strictly to prevent any noise
      results = results.filter(feat => {
        const props = feat.properties || {};
        const country = props.country || '';
        const countryCode = props.countrycode || '';
        return country.toLowerCase() === 'india' || countryCode.toLowerCase() === 'in';
      });

      // Nominatim search fallback if results are low to guarantee "Google Maps-like" POI/landmark lookup
      if (results.length < 5) {
        try {
          const nomSearchRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=in&limit=10&accept-language=en`,
            { headers: { "User-Agent": "SafeVoltServiceBooking/1.0 (service-booking-app)" } }
          );
          const nomSearchJson = await nomSearchRes.json();
          if (Array.isArray(nomSearchJson) && nomSearchJson.length > 0) {
            const mappedNom = nomSearchJson.map(item => ({
              geometry: {
                coordinates: [parseFloat(item.lon), parseFloat(item.lat)]
              },
              properties: {
                name: item.address.amenity || item.address.shop || item.address.building || item.address.house_number || item.display_name.split(",")[0],
                street: item.address.road || item.address.suburb || "",
                city: item.address.city || item.address.town || item.address.village || "",
                state: item.address.state || "",
                postcode: item.address.postcode || "",
                country: item.address.country || "India",
                district: item.address.suburb || item.address.neighbourhood || ""
              }
            }));
            
            // Deduplicate against existing results
            const existingKeys = new Set(results.map(r => {
              const namePart = (r.properties.name || '').toLowerCase();
              const cityPart = (r.properties.city || '').toLowerCase();
              return `${namePart}|${cityPart}`;
            }));

            for (const item of mappedNom) {
              const key = `${(item.properties.name || '').toLowerCase()}|${(item.properties.city || '').toLowerCase()}`;
              if (!existingKeys.has(key)) {
                results.push(item);
                existingKeys.add(key);
              }
            }
          }
        } catch (nomErr) {
          console.warn("Nominatim search fallback failed:", nomErr);
        }
      }

      setSearchResults(results.slice(0, 15));
      setShowDropdown(results.length > 0);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (result) => {
    const coords = result.geometry.coordinates; // [lng, lat]
    const lat = coords[1];
    const lng = coords[0];
    
    const pProps = result.properties || {};
    
    // Extract any 6-digit pincode explicitly typed by the user in the search query
    const pincodeMatch = searchQuery.match(/\b\d{6}\b/);
    const queryPincode = pincodeMatch ? pincodeMatch[0] : null;
    
    const postcode = queryPincode || pProps.postcode || "";
    const cityVal = pProps.city || "";
    const streetVal = pProps.street || "";
    const areaVal = pProps.district || pProps.suburb || pProps.locality || pProps.name || "";

    searchContextRef.current = {
      pincode: postcode,
      area: areaVal,
      road: streetVal,
      city: cityVal
    };
    
    // Populate editable states immediately to avoid UI flicker
    setRoad(streetVal);
    setArea(areaVal);
    setCity(cityVal);
    setPincode(postcode);
    
    // Set position and trigger a high-precision geocode immediately for the exact coordinates
    shouldSkipGeocodeRef.current = true; // Tell position useEffect to skip redundant geocoding
    setPosition([lat, lng]);
    fetchAddressFromCoords(lat, lng);
    
    setShowDropdown(false);
    setSearchQuery('');
  };

  useEffect(() => {
    if (isOpen && !didInitializeRef.current) {
      didInitializeRef.current = true;
      handleCurrentLocation();
      setHasInitialized(true);
    }
    if (!isOpen) {
      didInitializeRef.current = false;
      setHasInitialized(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || position[0] === 20.5937 && position[1] === 78.9629) return;
    if (shouldSkipGeocodeRef.current) {
      shouldSkipGeocodeRef.current = false;
      return;
    }
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    geocodeTimerRef.current = setTimeout(() => {
      fetchAddressFromCoords(position[0], position[1]);
    }, 700);
    return () => {
      if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
    };
  }, [position, isOpen]);

  const handleCurrentLocation = async () => {
    if (detecting) return;
    setDetecting(true);
    toast.info('Detecting your current location...');
    try {
      const result = await detectCurrentLocation({
        timeout: 8000,
        targetAccuracy: 80,
        maxUpdates: 2,
        maxRetries: 0
      });
      shouldSkipGeocodeRef.current = true;
      setPosition([result.latitude, result.longitude]);
      setStructuredAddress(result.address);
      setHouseNo(result.address.houseNumber || '');
      setRoad(result.address.road || '');
      setArea(result.address.area || result.address.locality || '');
      setCity(result.address.city || '');
      setPincode(result.address.pincode || result.address.postalCode || '');
    } catch (err) {
      toast.error(err.message || 'Could not fetch current location');
    } finally {
      setDetecting(false);
    }
  };

  const fetchAddressFromCoords = async (lat, lng) => {
    setLoading(true);
    try {
      const data = await reverseGeocode(lat, lng);
      
      // Merge with search result context if available to preserve user query's pincode and sub-locality
      if (searchContextRef.current) {
        const ctx = searchContextRef.current;
        
        // Preserve search suggestion values, only fallback to geocoded ones if suggestion had them empty
        const finalRoadValue = ctx.road || data.road || '';
        const finalAreaValue = ctx.area || data.area || data.locality || '';
        const finalCityValue = ctx.city || data.city || '';
        
        // Resolve pincode with specific fallback
        let finalPincodeValue = ctx.pincode || data.pincode || data.postalCode || '';
        if (finalPincodeValue.endsWith("001") && ctx.pincode && ctx.pincode !== "") {
          finalPincodeValue = ctx.pincode;
        }

        setStructuredAddress({
          ...data,
          road: finalRoadValue,
          area: finalAreaValue,
          city: finalCityValue,
          pincode: finalPincodeValue,
          postalCode: finalPincodeValue
        });

        setHouseNo(data.houseNumber || '');
        setRoad(finalRoadValue);
        setArea(finalAreaValue);
        setCity(finalCityValue);
        setPincode(finalPincodeValue);
        
        // Reset context
        searchContextRef.current = null;
      } else {
        // Standard pin drag geocode: overwrite everything with fresh coordinates data
        setStructuredAddress(data);
        setHouseNo(data.houseNumber || '');
        setRoad(data.road || '');
        setArea(data.area || data.locality || '');
        setCity(data.city || '');
        setPincode(data.pincode || data.postalCode || '');
      }
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

    const updatedAddress = {
      ...structuredAddress,
      houseNumber: houseNo.trim(),
      road: road.trim(),
      area: area.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
      postalCode: pincode.trim(),
      lat: position[0],
      lng: position[1]
    };

    if (houseNo.trim()) {
      const streetBase = updatedAddress.road || updatedAddress.street || '';
      if (streetBase) {
        if (!streetBase.includes(houseNo.trim())) {
          updatedAddress.street = `${houseNo.trim()}, ${streetBase}`;
        } else {
          updatedAddress.street = streetBase;
        }
      } else {
        updatedAddress.street = houseNo.trim();
      }
      updatedAddress.addressLine = updatedAddress.street;
    }

    updatedAddress.formattedAddress = buildAddressPreview(updatedAddress) || smartAddressBuilder(
      {
        house_number: houseNo.trim(),
        road: updatedAddress.road,
        residential: updatedAddress.area,
        neighbourhood: updatedAddress.area,
        suburb: updatedAddress.area,
        city: updatedAddress.city,
        state: updatedAddress.state,
        postcode: updatedAddress.pincode
      },
      updatedAddress._displayName || updatedAddress.formattedAddress
    );

    const legacy = {
      ...toLegacyAddressFields(updatedAddress),
      s2CellId: cellId13,
      s2CellIdPrecise: cellId20
    };
    onLocationSelect(legacy);
    onClose();
  };


  if (!isOpen) return null;

  const displayText = structuredAddress
    ? buildAddressPreview({
        ...structuredAddress,
        houseNumber: houseNo,
        road: road,
        area: area,
        city: city,
        pincode: pincode
      }) || structuredAddress.formattedAddress
    : '';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[90vh] max-h-[780px]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-bold text-secondary flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> Select Your Location
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* India-Only Address Search Autocomplete Input */}
        <div className="relative p-3 border-b border-gray-100 bg-white z-[1005]">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search address in India..."
              className="w-full pl-10 pr-10 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </div>
            {searching && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
              </div>
            )}
            {!searching && searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowDropdown(false);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 border-none bg-transparent"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown Overlay */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 mx-3 bg-white border border-gray-200 rounded-lg shadow-xl max-h-[220px] overflow-y-auto z-[1010] divide-y divide-gray-50">
              {searchResults.map((result, idx) => {
                const props = result.properties || {};
                const name = props.name || '';
                const street = props.street || '';
                const city = props.city || '';
                const state = props.state || '';
                const postcode = props.postcode || '';
                
                // Construct a beautiful split address format
                const mainTitle = name || street || city;
                const subTitle = [
                  name ? street : '',
                  props.district || props.suburb || '',
                  city,
                  state,
                  postcode
                ].filter(Boolean).filter(s => s !== mainTitle).join(', ');

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSearchResult(result)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-xs text-secondary transition-colors flex items-start gap-2.5 border-none bg-transparent"
                  >
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="font-bold text-secondary text-xs">{mainTitle}</span>
                      {subTitle && <span className="text-gray-400 text-[10px] mt-0.5">{subTitle}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 relative bg-gray-100">
          <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution={LIGHT_MAP_ATTRIBUTION} url={LIGHT_MAP_TILES} />
            <DraggableMarker position={position} setPosition={setPosition} />
            <MapUpdater center={position} />
          </MapContainer>


          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCurrentLocation();
            }}
            disabled={detecting}
            className="absolute bottom-4 right-4 z-[1000] bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg shadow-red-500/20 active:scale-95 transition-all border-none flex items-center justify-center disabled:opacity-70 disabled:cursor-wait"
            title={detecting ? 'Detecting location...' : 'My Location'}
            aria-label={detecting ? 'Detecting current location' : 'Detect current location'}
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
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
              <label className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Road / Street</label>
              <input
                type="text"
                value={road}
                onChange={(e) => setRoad(e.target.value)}
                placeholder="e.g. Street 1, Main Road"
                className="w-full bg-transparent text-secondary font-medium text-xs focus:outline-none border-none p-0 mt-0.5"
              />
            </div>
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
              <label className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Area / Locality</label>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Urban Estate Phase 2"
                className="w-full bg-transparent text-secondary font-medium text-xs focus:outline-none border-none p-0 mt-0.5"
              />
            </div>
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
              <label className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mohali"
                className="w-full bg-transparent text-secondary font-medium text-xs focus:outline-none border-none p-0 mt-0.5"
              />
            </div>
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
              <label className="text-gray-400 font-semibold block text-[10px] uppercase tracking-wider">Pincode</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 160062"
                className="w-full bg-transparent text-secondary font-medium text-xs focus:outline-none border-none p-0 mt-0.5"
              />
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
    </div>,
    document.body
  );
};

export default LocationPickerModal;
