import React from 'react';
import { Star, RefreshCw } from 'lucide-react';

const ServiceFilterPanel = ({
  layout = 'horizontal',
  priceRange,
  setPriceRange,
  maxPrice,
  selectedRatings,
  toggleRating,
  resetFilters,
  sortBy,
  setSortBy
}) => {
  if (layout === 'sidebar') {
    return (
      <div className="flex flex-col gap-6 lg:bg-white lg:rounded-2xl lg:border lg:border-gray-150 lg:p-5 lg:shadow-sm p-0 bg-transparent border-none shadow-none lg:overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-sm font-bold text-secondary uppercase tracking-wider font-poppins">Filters</h3>
          <button onClick={resetFilters} className="text-xs font-bold text-primary hover:underline">Clear All</button>
        </div>

        {/* Price Range Slider */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Price Range</h4>
            <span className="text-xs font-bold text-primary">₹{priceRange[0]} - ₹{priceRange[1]}+</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="range"
              min={0}
              max={maxPrice}
              value={priceRange[0]}
              onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])}
              className="flex-1 min-w-0 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <input
              type="range"
              min={0}
              max={maxPrice}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], +e.target.value])}
              className="flex-1 min-w-0 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>

        {/* Rating Star Filters */}
        <div>
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Rating</h4>
          <div className="grid grid-cols-2 gap-2">
            {[4, 3, 2, 1].map((rating) => {
              const isActive = selectedRatings.includes(rating);
              return (
                <button
                  key={rating}
                  onClick={() => toggleRating(rating)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-[11px] font-semibold transition-all ${isActive
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isActive ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} />
                  <span>{rating}★ & above</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort By Radios */}
        {setSortBy && (
          <div>
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Sort By</h4>
            <div className="flex flex-col gap-2.5">
              {[
                { val: 'popular', label: 'Most Popular' },
                { val: 'rating', label: 'Highest Rated' },
                { val: 'price-low', label: 'Price: Low to High' },
                { val: 'price-high', label: 'Price: High to Low' },
              ].map((option) => (
                <label key={option.val} className="flex items-center gap-3 cursor-pointer group text-xs text-gray-600 font-medium">
                  <input
                    type="radio"
                    name="sort-by-sidebar"
                    value={option.val}
                    checked={sortBy === option.val}
                    onChange={() => setSortBy(option.val)}
                    className="w-4 h-4 text-primary border-gray-300 focus:ring-primary accent-primary"
                  />
                  <span className="group-hover:text-primary transition-colors">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Horizontal layout (for Services.jsx)
  return (
    <div className="lg:bg-white lg:rounded-2xl lg:border lg:border-gray-150 lg:p-6 lg:mb-6 lg:shadow-sm p-0 bg-transparent border-none shadow-none animation-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Price Range */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-3">Price Range</label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-semibold">₹{priceRange[0]}</span>
            <input
              type="range"
              min={0}
              max={maxPrice}
              value={priceRange[0]}
              onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])}
              className="flex-1 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <input
              type="range"
              min={0}
              max={maxPrice}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], +e.target.value])}
              className="flex-1 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <span className="text-xs text-gray-500 font-semibold">₹{priceRange[1]}</span>
          </div>
        </div>

        {/* Rating Filter */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-secondary mb-3">Rating</label>
          <div className="flex flex-wrap gap-2">
            {[5, 4, 3, 2, 1].map(rating => (
              <button
                key={rating}
                onClick={() => toggleRating(rating)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-xs font-semibold ${selectedRatings.includes(rating)
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-white border-gray-250 text-gray-600 hover:border-primary/50'
                  }`}
              >
                <Star className={`w-3.5 h-3.5 ${selectedRatings.includes(rating) ? 'fill-primary text-primary' : ''}`} />
                <span>{rating} Star</span>
              </button>
            ))}
          </div>
        </div>

        {/* Reset Action */}
        <div className="flex items-end justify-end">
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-primary transition-colors border border-dashed border-gray-300 hover:border-primary/40 rounded-xl bg-gray-50/50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset All Filters
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceFilterPanel;
