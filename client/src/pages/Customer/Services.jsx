import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Filter, Clock, IndianRupee, CheckCircle, 
  Loader2, AlertCircle, RefreshCw, Sliders, 
  ChevronDown, ChevronUp, Star, X
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../store/auth';
import Rating from '@mui/material/Rating';

const ServiceListingPage = () => {
  const { API, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State Management
  const [services, setServices] = useState([]);
  const [allServices, setAllServices] = useState([]); // Store all services separately
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sortBy, setSortBy] = useState('popular');
  const [retryCount, setRetryCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState([]);
  const [categoriesData, setCategoriesData] = useState([]);
  
  // Refs for debouncing
  const searchTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);

  // Fetch categories from backend
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API}/system-setting/categories`);
     
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setCategoriesData(data.data);
      } else {
        throw new Error(data.message || 'Invalid response format for categories');
      }
    } catch (error) {
      console.error('Fetch categories error:', error);
      toast.error('Failed to load categories.');
    }
  };

  // Fetch ALL services from backend (without filters)
  const fetchAllServices = async (isSearchOperation = false) => {
    try {
      if (!isSearchOperation) {
        setInitialLoading(true);
      }
      setError(null);

      // Don't add search or category filters here - fetch ALL services
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '100'); // Get all services

      const response = await fetch(`${API}/service/services?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
            
      if (data.success && Array.isArray(data.data)) {
        const transformedServices = data.data.map(service => ({
          ...service,
          displayImage: service.images && service.images.length > 0 
            ? service.images[0] 
            : service.image 
        }));
        
        // Store all services
        setAllServices(transformedServices);
        
        // Also set services for initial display
        setServices(transformedServices);
        setRetryCount(0);
        
        // Calculate max price from services
        if (transformedServices.length > 0) {
          const maxServicePrice = Math.max(...transformedServices.map(service => service.basePrice || 0));
          setPriceRange([0, Math.max(maxServicePrice, 10000)]);
        }
      } else {
        throw new Error(data.message || 'Invalid response format');
      }
    } catch (error) {
      console.error('Fetch services error:', error);
      setError(error.message || 'Failed to load services');
      
      if (retryCount < 2) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchAllServices(isSearchOperation);
        }, 2000);
      } else {
        toast.error('Failed to load services. Please try again later.');
      }
    } finally {
      if (!isSearchOperation) {
        setInitialLoading(false);
      }
    }
  };

  // Handle search locally without API call
  const handleSearch = (value) => {
    setSearchTerm(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debouncing
    searchTimeoutRef.current = setTimeout(() => {
      // Update URL
      const params = {};
      if (value) params.search = value;
      if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
      setSearchParams(params);
      
      // Apply search filter locally
      applyLocalFilters(value, selectedCategory);
    }, 300);
  };

  // Handle category change locally
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    
    // Update URL
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (categoryId && categoryId !== 'All') params.category = categoryId;
    setSearchParams(params);
    
    // Apply category filter locally
    applyLocalFilters(searchTerm, categoryId);
  };

  // Apply filters locally (search and category)
  const applyLocalFilters = (searchValue, categoryValue) => {
    let filtered = [...allServices];
    
    // Apply search filter if search term exists
    if (searchValue && searchValue.trim() !== '') {
      const searchLower = searchValue.toLowerCase().trim();
      filtered = filtered.filter(service => 
        (service.title && service.title.toLowerCase().includes(searchLower)) ||
        (service.description && service.description.toLowerCase().includes(searchLower)) ||
        (categoryMap[service.category] && categoryMap[service.category].toLowerCase().includes(searchLower))
      );
    }
    
    // Apply category filter if not 'All'
    if (categoryValue && categoryValue !== 'All') {
      filtered = filtered.filter(service => 
        service.category === categoryValue
      );
    }
    
    setServices(filtered);
  };

  // Initial fetch on component mount
  useEffect(() => {
    if (isInitialMount.current) {
      fetchAllServices(false); // Fetch ALL services initially
      fetchCategories();
      isInitialMount.current = false;
    }
  }, []);

  // Update URL when filters change
  useEffect(() => {
    if (!isInitialMount.current) {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedCategory && selectedCategory !== 'All') params.category = selectedCategory;
      setSearchParams(params);
      
      // Apply filters locally
      applyLocalFilters(searchTerm, selectedCategory);
    }
  }, [searchTerm, selectedCategory, setSearchParams]);

  // Derived state for categories
  const categoryMap = useMemo(() => {
    if (categoriesData.length === 0) return {};
    return categoriesData.reduce((acc, category) => {
      acc[category._id] = category.name;
      return acc;
    }, {});
  }, [categoriesData]);

  const categoriesForFilter = useMemo(() => {
    return [{ _id: 'All', name: 'All' }, ...categoriesData];
  }, [categoriesData]);

  // Filtered and sorted services (client-side filtering)
  const filteredServices = useMemo(() => {
    let results = [...services]; // Use locally filtered services

    // Apply price range filter
    results = results.filter(service => 
      service.basePrice >= priceRange[0] && service.basePrice <= priceRange[1]
    );

    // Apply rating filter
    if (selectedRatings.length > 0) {
      results = results.filter(service => 
        selectedRatings.includes(Math.floor(service.averageRating || 0))
      );
    }

    // Apply sorting
    results.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.basePrice || 0) - (b.basePrice || 0);
        case 'price-high':
          return (b.basePrice || 0) - (a.basePrice || 0);
        case 'rating':
          return (b.averageRating || 0) - (a.averageRating || 0);
        case 'name':
          return (a.title || '').localeCompare(b.title || '');
        default: // popular
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

    return results;
  }, [services, priceRange, sortBy, selectedRatings, categoryMap]);

  // Handle booking navigation
  const handleBookNow = (serviceId, isActive) => {
    if (!isActive) {
      toast.error('This service is currently unavailable');
      return;
    }
    
    if (!user) {
      toast.info('Please login to book a service');
      navigate('/login');
      return;
    }
    
    navigate(`/customer/services/${serviceId}`);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setPriceRange([0, Math.max(...allServices.map(s => s.basePrice || 0))]);
    setSortBy('popular');
    setSelectedRatings([]);
    setSearchParams({});
    
    // Reset to show all services
    setServices(allServices);
  };

  // Clear search only
  const clearSearch = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setSearchParams({});
    setServices(allServices); // Show all services
  };

  // Toggle rating filter
  const toggleRating = (rating) => {
    setSelectedRatings(prev =>
      prev.includes(rating)
        ? prev.filter(r => r !== rating)
        : [...prev, rating]
    );
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Service Card Component
  const ServiceCard = ({ service }) => {
    const imageUrl = service.displayImage || 
      (service.images && service.images.length > 0 ? service.images[0] : 
       service.image || '//via.placeholder.com/400x300?text=No+Image');

    const isServiceAvailable = service.isActive !== false;

    return (
      <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] overflow-hidden">
        {/* Service Image */}
        <div className="relative h-48 overflow-hidden flex-shrink-0">
          <img
            src={imageUrl}
            alt={service.title || 'Service'}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
          
          {/* Category Badge */}
          <div className="absolute top-3 left-3 bg-teal-500 text-white px-3 py-1 rounded-full text-xs font-bold capitalize">
            {categoryMap[service.category] || 'Service'}
          </div>

          {/* Premium Badge */}
          {service.basePrice > 1000 && (
            <div className="absolute top-3 right-3 bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-bold">
              Premium
            </div>
          )}
        </div>

        {/* Service Details */}
        <div className="flex flex-col flex-grow p-4">
          <div className="flex items-center justify-between mb-2">
            {isServiceAvailable ? (
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                <CheckCircle size={12} /> Available
              </span>
            ) : (
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                Unavailable
              </span>
            )}
          </div>

          <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 text-lg leading-tight">
            {service.title}
          </h3>
          <p className="text-gray-600 text-sm mb-3 line-clamp-3 leading-relaxed flex-grow">
            {service.description}
          </p>

          {/* Rating and Duration */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-lg">
              <Clock className="w-4 h-4 text-teal-600" />
              <span className="text-sm text-gray-700 font-medium">
                {service.durationFormatted || `${service.duration || 1} hrs`}
              </span>
            </div>
            <div className="flex items-center ">
              <Rating
                name="read-only"
                value={service.averageRating || 0}
                precision={0.5}
                readOnly
                size="small"
                sx={{
                  '& .MuiRating-iconFilled': {
                    color: '#F97316',
                  },
                }}
              />
              <span className="text-sm font-medium text-gray-600 ml-1">
                ({service.ratingCount || 0})
              </span>
            </div>
          </div>

          {/* Price and Book Button */}
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
            <div className="flex items-end gap-1">
              <IndianRupee className="w-5 h-5 text-gray-800" />
              <span className="text-xl font-bold text-gray-800">
                {service.basePrice?.toLocaleString() || '0'}
              </span>
            </div>
            <button
              onClick={() => handleBookNow(service._id, isServiceAvailable)}
              disabled={!isServiceAvailable}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 ${
                isServiceAvailable 
                  ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-sm hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isServiceAvailable ? 'Book Now' : 'Unavailable'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Active Filters Display
  const ActiveFilters = () => {
    const activeFilters = [];
    
    if (searchTerm) activeFilters.push(`Search: "${searchTerm}"`);
    if (selectedCategory !== 'All') activeFilters.push(`Category: ${categoryMap[selectedCategory] || selectedCategory}`);
    if (priceRange[0] > 0 || priceRange[1] < Math.max(...allServices.map(s => s.basePrice || 0))) {
      activeFilters.push(`Price: ₹${priceRange[0]} - ₹${priceRange[1]}`);
    }
    if (selectedRatings.length > 0) {
      activeFilters.push(`Ratings: ${selectedRatings.map(r => `${r}+`).join(', ')}`);
    }

    if (activeFilters.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mb-4 px-4 sm:px-6 lg:px-8">
        {activeFilters.map((filter, index) => {
          let onRemove = resetFilters;
          if (filter.startsWith('Search:')) {
            onRemove = clearSearch;
          }
          
          return (
            <div
              key={index}
              className="flex items-center gap-1 bg-teal-100 text-teal-800 px-3 py-1 rounded-full text-sm"
            >
              {filter}
              <button
                onClick={onRemove}
                className="hover:text-teal-900 ml-1"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
        <button
          onClick={resetFilters}
          className="text-sm text-gray-600 hover:text-gray-800 underline"
        >
          Clear All
        </button>
      </div>
    );
  };

  // Loading State - Only show for initial load
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full px-4 sm:px-6 py-12">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-teal-500 animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Loading services...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error State
  if (error && allServices.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full px-4 sm:px-6 py-12">
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Failed to Load Services</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {error}
            </p>
            <button
              onClick={() => fetchAllServices(false)}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors shadow-sm hover:shadow-md flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Find Your Perfect Service
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Discover professional services tailored to your needs. Book with confidence and get the job done right.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search services by name, description or category..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white transition-colors duration-200"
                />
                {searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white transition-colors duration-200 min-w-[150px]"
              >
                {categoriesForFilter.map(category => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200"
              >
                <Sliders className="w-4 h-4" />
                <span className="text-sm font-medium">Filters</span>
                {showFilters ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto pb-8">
        {/* Active Filters */}
        <ActiveFilters />

        {/* Collapsible Filter Content */}
        <div className={`overflow-hidden transition-all duration-500 ease-in-out px-4 sm:px-6 lg:px-8 ${
          showFilters ? 'max-h-[400px] opacity-100 mb-6' : 'max-h-0 opacity-0'
        }`}>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Price Range Filter */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range: ₹{priceRange[0].toLocaleString()} - ₹{priceRange[1].toLocaleString()}
                </label>
                <div className="space-y-3">
                  <div className="flex gap-4 items-center">
                    <input
                      type="range"
                      min="0"
                      max={Math.max(...allServices.map(s => s.basePrice || 0))}
                      value={priceRange[0]}
                      onChange={(e) => setPriceRange([parseInt(e.target.value), priceRange[1]])}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-500"
                    />
                    <input
                      type="range"
                      min="0"
                      max={Math.max(...allServices.map(s => s.basePrice || 0))}
                      value={priceRange[1]}
                      onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-teal-500"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>₹0</span>
                    <span>₹{Math.max(...allServices.map(s => s.basePrice || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Customer Rating
                </label>
                <div className="flex flex-wrap gap-2">
                  {[5, 4, 3, 2, 1].map(rating => (
                    <button
                      key={rating}
                      onClick={() => toggleRating(rating)}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-all duration-200 ${
                        selectedRatings.includes(rating)
                          ? 'bg-orange-100 border-orange-300 text-orange-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                      <span className="text-sm font-medium">{rating}+</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex flex-wrap items-center justify-between pt-6 border-t border-gray-100 mt-6">
              <button
                onClick={resetFilters}
                className="px-6 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-all duration-200 hover:bg-gray-100 rounded-lg"
              >
                Reset All Filters
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium transition-colors duration-200"
                >
                  <option value="popular">Most Recent</option>
                  <option value="rating">Top Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Alphabetical</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="px-4 sm:px-6 lg:px-8 mb-6">
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold">{filteredServices.length}</span> of <span className="font-semibold">{allServices.length}</span> services
            {searchTerm && (
              <span> for "<span className="font-semibold">{searchTerm}</span>"</span>
            )}
          </div>
        </div>

        {/* Services Grid */}
        {filteredServices.length === 0 ? (
          <div className="text-center py-16 mx-4 sm:mx-6 lg:mx-8 bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="mx-auto w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">No services found</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              We couldn't find any services matching your criteria. Try adjusting your search or filters.
            </p>
            <button
              onClick={resetFilters}
              className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-4 sm:px-6 lg:px-8">
            {filteredServices.map((service) => (
              <ServiceCard key={service._id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceListingPage;