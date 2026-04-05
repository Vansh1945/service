import React, { useState, useEffect } from 'react';
import { State, City } from 'country-state-city';
import { MapPin, Building, Flag, CheckCircle, ChevronDown } from 'lucide-react';

const AddressSelector = ({
  selectedState,
  selectedCity,
  onStateChange,
  onCityChange,
  className = ""
}) => {
  const selectedCountry = 'IN'; // Fixed to India for now
  const [states, setStates] = useState([]);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    const countryStates = State.getStatesOfCountry(selectedCountry);
    setStates(countryStates);
  }, [selectedCountry]);

  // Find state code from state name
  const currentStateCode = states.find(s => s.name === selectedState)?.isoCode;

  useEffect(() => {
    if (currentStateCode) {
      const stateCities = City.getCitiesOfState(selectedCountry, currentStateCode);
      setCities(stateCities);
    } else {
      setCities([]);
    }
  }, [selectedCountry, currentStateCode]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* State & City Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        
        {/* State Selection */}
        <div>
          <label htmlFor="state" className="block text-sm font-semibold text-secondary mb-1.5">
            State *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="text-gray-400 w-4 h-4" />
            </div>
            <select
              id="state"
              name="state"
              value={selectedState}
              onChange={(e) => {
                onStateChange(e.target.value);
                onCityChange(""); // Clear city when state changes
              }}
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none"
              required
            >
              <option value="">Select State</option>
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
        <div>
          <label htmlFor="city" className="block text-sm font-semibold text-secondary mb-1.5">
            City *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building className="text-gray-400 w-4 h-4" />
            </div>
            <select
              id="city"
              name="city"
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-secondary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium appearance-none disabled:bg-gray-50 disabled:text-gray-400"
              disabled={!selectedState}
              required
            >
              <option value="">Select City</option>
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
      </div>
    </div>
  );
};

export default AddressSelector;
