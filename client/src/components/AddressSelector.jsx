import React, { useState, useEffect } from 'react';
import { Country, State, City } from 'country-state-city';
import { MapPin, Building, Flag, CheckCircle } from 'lucide-react';

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
    <div className={`space-y-6 ${className}`}>
      {/* Country Selection (Read-only India) */}
      <div className="group">
        <label htmlFor="country" className="block text-secondary font-semibold mb-3 text-sm tracking-wide">
          Country *
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
            <Flag className="text-primary w-5 h-5 group-focus-within:scale-110 transition-transform duration-200" />
          </div>
          <select
            id="country"
            name="country"
            value={selectedCountry}
            disabled
            className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 bg-gray-100 text-secondary cursor-not-allowed font-medium appearance-none"
          >
            <option value="IN">India</option>
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* State Selection */}
        <div className="group">
          <label htmlFor="state" className="block text-secondary font-semibold mb-3 text-sm tracking-wide">
            State *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <MapPin className="text-primary w-5 h-5 group-focus-within:scale-110 transition-transform duration-200" />
            </div>
            <select
              id="state"
              name="state"
              value={selectedState}
              onChange={(e) => {
                onStateChange(e.target.value);
                onCityChange(""); // Clear city when state changes
              }}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 bg-gradient-to-r from-primary/5 to-transparent text-secondary hover:border-primary/50 hover:shadow-md focus:shadow-lg font-medium appearance-none"
              required
            >
              <option value="">Select State</option>
              {states.map((state) => (
                <option key={state.isoCode} value={state.name}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* City Selection */}
        <div className="group">
          <label htmlFor="city" className="block text-secondary font-semibold mb-3 text-sm tracking-wide">
            City *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
              <Building className="text-primary w-5 h-5 group-focus-within:scale-110 transition-transform duration-200" />
            </div>
            <select
              id="city"
              name="city"
              value={selectedCity}
              onChange={(e) => onCityChange(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all duration-300 bg-gradient-to-r from-primary/5 to-transparent text-secondary hover:border-primary/50 hover:shadow-md focus:shadow-lg font-medium appearance-none"
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
          </div>
        </div>
      </div>
    </div>
  );
};



export default AddressSelector;
