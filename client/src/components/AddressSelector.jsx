import React, { useState, useEffect } from 'react';
import { MapPin, Building, ChevronDown } from 'lucide-react';
import LocationPickerModal from './LocationPickerModal';
import { buildAddressPreview, smartAddressBuilder } from '../utils/format';
import { latLngToS2CellId } from '../utils/s2Helper';

const AddressSelector = ({
  address = {},
  onChange,
  errors = {},
  className = ""
}) => {
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const selectedCountry = 'IN'; // Fixed to India for now
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    import('country-state-city').then(({ State }) => {
      const countryStates = State.getStatesOfCountry(selectedCountry);
      setStates(countryStates);
    });
  }, [selectedCountry]);

  // Find state code from state name
  const currentStateCode = states.find(s => s.name === address.state)?.isoCode;

  useEffect(() => {
    if (currentStateCode) {
      import('country-state-city').then(({ City }) => {
        const stateCities = City.getCitiesOfState(selectedCountry, currentStateCode);
        setCities(stateCities);
      });
    } else {
      setCities([]);
    }
  }, [selectedCountry, currentStateCode]);

  // Shared S2 Cell helper to ensure s2CellId, s2CellIdPrecise, and geoHash are computed if lat/lng are present
  const enrichAddressWithS2Cells = (addr) => {
    const lat = parseFloat(addr.lat);
    const lng = parseFloat(addr.lng);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return {
        ...addr,
        s2CellId: latLngToS2CellId(lat, lng, 13),
        s2CellIdPrecise: latLngToS2CellId(lat, lng, 20),
        geoHash: latLngToS2CellId(lat, lng, 13) // Map geoHash to level 13 S2 cell key
      };
    }
    return addr;
  };

  const handleFieldChange = (name, value) => {
    const updated = {
      ...address,
      [name]: value
    };

    // Keep postalCode and pincode in sync
    if (name === 'postalCode') {
      updated.pincode = value;
    } else if (name === 'pincode') {
      updated.postalCode = value;
    }

    // Auto-construct street if houseNumber and road are updated
    const houseNum = updated.houseNumber || '';
    const rd = updated.road || '';
    updated.street = houseNum && rd ? `${houseNum}, ${rd}` : (houseNum || rd);
    updated.addressLine = updated.street;

    // Re-build formattedAddress based on the changed inputs
    if (!address.isManuallyEdited) {
      updated.formattedAddress = buildAddressPreview(updated) || smartAddressBuilder(
        {
          house_number: updated.houseNumber,
          road: updated.road,
          residential: updated.area,
          neighbourhood: updated.area,
          suburb: updated.area,
          city: updated.city,
          state: updated.state,
          postcode: updated.pincode
        },
        ""
      );
    }

    onChange(enrichAddressWithS2Cells(updated));
  };

  const handleStateChange = (stateName) => {
    const updated = {
      ...address,
      state: stateName,
      city: "" // Reset city on state change
    };

    if (!address.isManuallyEdited) {
      updated.formattedAddress = buildAddressPreview(updated) || smartAddressBuilder(
        {
          house_number: updated.houseNumber,
          road: updated.road,
          residential: updated.area,
          neighbourhood: updated.area,
          suburb: updated.area,
          city: updated.city,
          state: updated.state,
          postcode: updated.pincode
        },
        ""
      );
    }

    onChange(enrichAddressWithS2Cells(updated));
  };

  const handleCityChange = (cityName) => {
    const updated = {
      ...address,
      city: cityName
    };

    if (!address.isManuallyEdited) {
      updated.formattedAddress = buildAddressPreview(updated) || smartAddressBuilder(
        {
          house_number: updated.houseNumber,
          road: updated.road,
          residential: updated.area,
          neighbourhood: updated.area,
          suburb: updated.area,
          city: updated.city,
          state: updated.state,
          postcode: updated.pincode
        },
        ""
      );
    }

    onChange(enrichAddressWithS2Cells(updated));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Section Header with Map Selector Trigger */}
      <div className="flex justify-between items-center pb-2 border-b border-gray-150">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Address Details</span>
        <button
          type="button"
          onClick={() => setIsMapModalOpen(true)}
          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2.5 shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center"
          title="Select Location on Map"
        >
          <MapPin className="w-5 h-5" />
        </button>
      </div>

      {/* Row 1: House No. & Road Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wide">House / Flat / Shop No. *</label>
          <input
            type="text"
            name="houseNumber"
            value={address.houseNumber || ''}
            onChange={(e) => handleFieldChange('houseNumber', e.target.value)}
            placeholder="e.g. House No. 349, Flat 4B"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-secondary font-medium"
          />
          {errors['address.houseNumber'] && <span className="text-[10px] text-red-500 font-medium">{errors['address.houseNumber']}</span>}
        </div>
        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wide">Road / Street / Lane *</label>
          <input
            type="text"
            name="road"
            value={address.road || ''}
            onChange={(e) => handleFieldChange('road', e.target.value)}
            placeholder="e.g. MG Road, Phase 1"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-secondary font-medium"
          />
          {errors['address.road'] && <span className="text-[10px] text-red-500 font-medium">{errors['address.road']}</span>}
        </div>
      </div>

      {/* Row 2: Landmark & Area */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wide">Landmark (Optional)</label>
          <input
            type="text"
            name="landmark"
            value={address.landmark || ''}
            onChange={(e) => handleFieldChange('landmark', e.target.value)}
            placeholder="e.g. Near Shiv Temple"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-secondary font-medium"
          />
        </div>
        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wide">Area / Locality / Sector</label>
          <input
            type="text"
            name="area"
            value={address.area || ''}
            onChange={(e) => handleFieldChange('area', e.target.value)}
            placeholder="e.g. Sector 15, Vasant Kunj"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-secondary font-medium"
          />
        </div>
      </div>

      {/* Row 3: State & City & Pincode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* State Selection */}
        <div className="flex flex-col gap-1 w-full">
          <label htmlFor="state" className="text-xs font-semibold text-secondary uppercase tracking-wide">State *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="text-gray-400 w-4 h-4" />
            </div>
            <select
              id="state"
              name="state"
              value={address.state || ''}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full pl-9 pr-10 py-2 bg-white border border-gray-200 rounded-lg text-sm text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none"
            >
              <option value="">Select State</option>
              {address.state && !states.some(s => s.name === address.state) && (
                <option value={address.state}>{address.state}</option>
              )}
              {states.map((state) => (
                <option key={state.isoCode} value={state.name}>
                  {state.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* City Selection */}
        <div className="flex flex-col gap-1 w-full">
          <label htmlFor="city" className="text-xs font-semibold text-secondary uppercase tracking-wide">City *</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building className="text-gray-400 w-4 h-4" />
            </div>
            <select
              id="city"
              name="city"
              value={address.city || ''}
              onChange={(e) => handleCityChange(e.target.value)}
              className="w-full pl-9 pr-10 py-2 bg-white border border-gray-200 rounded-lg text-sm text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none disabled:bg-gray-50 disabled:text-gray-400"
              disabled={!address.state}
            >
              <option value="">Select City</option>
              {address.city && !cities.some(c => c.name === address.city) && (
                <option value={address.city}>{address.city}</option>
              )}
              {cities.map((city) => (
                <option key={city.name} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Pincode Selection */}
        <div className="flex flex-col gap-1 w-full">
          <label className="text-xs font-semibold text-secondary uppercase tracking-wide">Pincode *</label>
          <input
            type="text"
            name="pincode"
            value={address.pincode || address.postalCode || ''}
            onChange={(e) => handleFieldChange('pincode', e.target.value)}
            placeholder="6-digit Pincode"
            maxLength="6"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 text-secondary font-medium font-mono"
          />
          {(errors['address.pincode'] || errors['address.postalCode']) && (
            <span className="text-[10px] text-red-500 font-medium">
              {errors['address.pincode'] || errors['address.postalCode']}
            </span>
          )}
        </div>
      </div>

      {/* Row 4: Calculated Address Preview / Editor */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Address Preview / Edit Manually</label>
        <textarea
          name="formattedAddress"
          value={address.formattedAddress || ''}
          onChange={(e) => {
            const val = e.target.value;
            onChange(enrichAddressWithS2Cells({
              ...address,
              formattedAddress: val,
              isManuallyEdited: true
            }));
          }}
          placeholder="Please fill House No. and Road name to construct preview, or edit here manually..."
          rows="2"
          className="w-full p-3 text-xs border border-gray-200 rounded-lg text-secondary font-medium leading-relaxed shadow-inner resize-none focus:ring-2 focus:ring-primary/20 focus:outline-none"
        />
      </div>

      {isMapModalOpen && (
        <LocationPickerModal
          isOpen={isMapModalOpen}
          onClose={() => setIsMapModalOpen(false)}
          onLocationSelect={(loc) => {
            const updated = {
              ...address,
              ...loc
            };
            onChange(enrichAddressWithS2Cells(updated));
          }}
        />
      )}
    </div>
  );
};

export default AddressSelector;
