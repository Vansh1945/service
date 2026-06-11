import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Filter, Clock, IndianRupee, CheckCircle,
  AlertCircle, RefreshCw, Sliders, Star, X
} from 'lucide-react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../context/auth';
import Rating from '@mui/material/Rating';
import ServiceCardSkeleton from '../../components/ui-skeletons/ServiceCardSkeleton';
import HeroSection from '../../components/HeroSection';
import ErrorState from '../../components/Error';
import { getPublicServices } from '../../services/ServiceService';
import useCategory from '../../hooks/useCategory';
import { resolveActiveSurcharges } from '../../services/SurgeService';

const ServiceListingPage = () => {
  const { API, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [services, setServices] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeSurcharges, setActiveSurcharges] = useState([]);

  // Fetch active surcharges
  useEffect(() => {
    const fetchSurcharges = async () => {
      try {
        const params = {};
        if (user?.address?.lat && user?.address?.lng) {
          params.lat = user.address.lat;
          params.lng = user.address.lng;
        }
        const response = await resolveActiveSurcharges(params);
        if (response.data?.success) {
          setActiveSurcharges(response.data.data || []);
        }
      } catch (err) {
        console.error("Error fetching active surcharges:", err);
      }
    };
    fetchSurcharges();
  }, [user]);

  // Helper to get merged price (base price + active demand surge)
  const getMergedPrice = (basePrice) => {
    let demandSurge = 0;
    activeSurcharges.forEach(s => {
      if (s.chargeType === 'demand') {
        if (s.maxBookingValue && basePrice > s.maxBookingValue) {
          return;
        }
        let chargeAmount = 0;
        if (s.mode === 'flat') {
          chargeAmount = s.value;
        } else if (s.mode === 'percentage') {
          chargeAmount = (basePrice * s.value) / 100;
        } else if (s.mode === 'multiplier') {
          chargeAmount = basePrice * (s.value - 1);
        }
        demandSurge += parseFloat(chargeAmount.toFixed(2));
      }
    });
    return basePrice + demandSurge;
  };
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sortBy, setSortBy] = useState('popular');
  const [retryCount, setRetryCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState([]);
  const { categories: categoriesData } = useCategory();
  const [maxPrice, setMaxPrice] = useState(10000);

  const searchTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);


  // Fetch all services
  const fetchAllServices = async () => {
    try {
      setInitialLoading(true);
      setError(null);

      const response = await getPublicServices(1, 100);
      const responseData = response.data;

      if (responseData.success && Array.isArray(responseData.data)) {
        const transformedServices = responseData.data.map(service => ({
          ...service,
          displayImage: service.images?.[0] || service.image
        }));

        setAllServices(transformedServices);
        setServices(transformedServices);

        const maxServicePrice = Math.max(...transformedServices.map(s => s.basePrice || 0), 10000);
        setMaxPrice(maxServicePrice);
        setPriceRange([0, maxServicePrice]);
        setRetryCount(0);
      } else {
        throw new Error(responseData.message || 'Invalid response');
      }
    } catch (error) {
      console.error('Fetch services error:', error);
      setError(error.message || 'Failed to load services');

      if (retryCount < 2) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchAllServices();
        }, 2000);
      } else {
        toast.error('Failed to load services. Please try again later.');
      }
    } finally {
      setInitialLoading(false);
    }
  };

  // Apply local filters
  const applyLocalFilters = (searchValue, categoryValue) => {
    let filtered = [...allServices];

    const getCatName = (cat) => {
      if (typeof cat === 'object' && cat !== null) return cat.name || '';
      return categoriesData.find(c => c.value === cat)?.label || '';
    };

    if (searchValue?.trim()) {
      const searchLower = searchValue.toLowerCase().trim();
      filtered = filtered.filter(service =>
        service.title?.toLowerCase().includes(searchLower) ||
        service.description?.toLowerCase().includes(searchLower) ||
        getCatName(service.category).toLowerCase().includes(searchLower)
      );
    }

    if (categoryValue && categoryValue !== 'All') {
      filtered = filtered.filter(service => {
        const catId = typeof service.category === 'object' ? service.category?._id : service.category;
        return catId === categoryValue;
      });
    }

    setServices(filtered);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      const params = {};
      if (value) params.search = value;
      if (selectedCategory !== 'All') params.category = selectedCategory;
      setSearchParams(params);
      applyLocalFilters(value, selectedCategory);
    }, 300);
  };

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (categoryId !== 'All') params.category = categoryId;
    setSearchParams(params);
    applyLocalFilters(searchTerm, categoryId);
  };

  useEffect(() => {
    if (isInitialMount.current) {
      fetchAllServices();
      isInitialMount.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isInitialMount.current) {
      applyLocalFilters(searchTerm, selectedCategory);
    }
  }, [searchTerm, selectedCategory]);

  const categoriesForFilter = useMemo(() => {
    return [{ value: 'All', label: 'All' }, ...categoriesData];
  }, [categoriesData]);

  // Filter and sort services
  const filteredServices = useMemo(() => {
    let results = [...services];

    results = results.filter(service =>
      service.basePrice >= priceRange[0] && service.basePrice <= priceRange[1]
    );

    if (selectedRatings.length > 0) {
      results = results.filter(service =>
        selectedRatings.includes(Math.floor(service.averageRating || 0))
      );
    }

    results.sort((a, b) => {
      switch (sortBy) {
        case 'price-low': return (a.basePrice || 0) - (b.basePrice || 0);
        case 'price-high': return (b.basePrice || 0) - (a.basePrice || 0);
        case 'rating': return (b.averageRating || 0) - (a.averageRating || 0);
        case 'name': return (a.title || '').localeCompare(b.title || '');
        default: return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

    return results;
  }, [services, priceRange, sortBy, selectedRatings]);

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
    navigate(`/customer/services/${serviceId}`, {
      state: { prefillBooking: location.state?.prefillBooking }
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setPriceRange([0, maxPrice]);
    setSortBy('popular');
    setSelectedRatings([]);
    setSearchParams({});
    setServices(allServices);
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedCategory('All');
    setSearchParams({});
    setServices(allServices);
  };

  const toggleRating = (rating) => {
    setSelectedRatings(prev =>
      prev.includes(rating) ? prev.filter(r => r !== rating) : [...prev, rating]
    );
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  if (initialLoading) {
    return (
      <div className="min-h-screen pt-20 md:pt-24 lg:pt-28">
        <HeroSection noMargin />
        <div className="max-w-[98%] mx-auto px-2 md:px-4 py-6 pb-24 md:pb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && allServices.length === 0) {
    return (
      <ErrorState
        title="Failed to Load"
        message={error}
        onRetry={() => fetchAllServices()}
        retryText="Try Again"
        onBack={() => navigate('/')}
        backText="Go Home"
      />
    );
  }

  return (
    <div className="min-h-screen pt-20 md:pt-24 lg:pt-28">
      <HeroSection noMargin />

      {/* Search Section */}
      <div className="fixed top-16 md:top-[72px] lg:top-20 left-0 right-0 z-20 bg-white/95 backdrop-blur-md py-4 px-3 md:px-6 border-b border-gray-200 shadow-sm">
        <div className="max-w-[98%] mx-auto">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {searchTerm && (
                <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            {/* Desktop Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="hidden md:block px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            >
              {categoriesForFilter.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            {/* Desktop Filters Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="hidden md:flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
            >
              <Filter className="w-4 h-4 text-primary" />
              <span className="font-medium">Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Filter Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 backdrop-blur-md py-3 px-4 border-t border-gray-200 flex gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="flex-1 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold cursor-pointer"
        >
          {categoriesForFilter.map(cat => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-all text-sm font-semibold"
        >
          <Filter className="w-4.5 h-4.5 text-primary" />
          <span>Filters</span>
        </button>
      </div>

      {/* Desktop Filters Panel */}
      {showFilters && (
        <div className="hidden md:block bg-white border-b border-gray-200 py-5 px-4">
          <div className="max-w-[98%] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Price Range */}
              <div>
                <label className="block text-sm font-semibold text-secondary mb-3">Price Range</label>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-600">₹{priceRange[0].toLocaleString()}</span>
                  <input
                    type="range"
                    min={0}
                    max={maxPrice}
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])}
                    className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <input
                    type="range"
                    min={0}
                    max={maxPrice}
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], +e.target.value])}
                    className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-sm text-gray-600">₹{priceRange[1].toLocaleString()}</span>
                </div>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-semibold text-secondary mb-3">Rating</label>
                <div className="flex gap-2">
                  {[5, 4, 3, 2, 1].map(rating => (
                    <button
                      key={rating}
                      onClick={() => toggleRating(rating)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-all ${selectedRatings.includes(rating)
                        ? 'bg-accent/10 border-accent text-accent'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-primary/50'
                        }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${selectedRatings.includes(rating) ? 'fill-accent' : ''}`} />
                      <span className="text-sm font-medium">{rating}+</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort & Reset */}
              <div className="flex items-end justify-between gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-secondary mb-3">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="popular">Most Recent</option>
                    <option value="rating">Top Rated</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="name">A - Z</option>
                  </select>
                </div>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-primary transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet Filters Drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-[60] md:hidden flex flex-col justify-end">
          {/* Backdrop Overlay */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setShowFilters(false)}
          />
          {/* Sheet Panel */}
          <div className="relative bg-white rounded-t-2xl max-h-[80vh] overflow-y-auto p-5 pb-8 shadow-2xl transition-transform duration-300 ease-out transform translate-y-0 z-10">
            {/* Header / Handle */}
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-secondary flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary" />
                Filters & Sorting
              </h3>
              <button 
                onClick={() => setShowFilters(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Form Fields inside sheet */}
            <div className="flex flex-col gap-6">
              {/* Price Range */}
              <div>
                <label className="block text-sm font-semibold text-secondary mb-3">Price Range</label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-medium">₹{priceRange[0].toLocaleString()}</span>
                  <input
                    type="range"
                    min={0}
                    max={maxPrice}
                    value={priceRange[0]}
                    onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])}
                    className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <input
                    type="range"
                    min={0}
                    max={maxPrice}
                    value={priceRange[1]}
                    onChange={(e) => setPriceRange([priceRange[0], +e.target.value])}
                    className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs text-gray-500 font-medium">₹{priceRange[1].toLocaleString()}</span>
                </div>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-semibold text-secondary mb-3">Rating</label>
                <div className="flex flex-wrap gap-2">
                  {[5, 4, 3, 2, 1].map(rating => (
                    <button
                      key={rating}
                      onClick={() => toggleRating(rating)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${selectedRatings.includes(rating)
                        ? 'bg-accent/10 border-accent text-accent'
                        : 'bg-white border-gray-200 text-gray-600'
                        }`}
                    >
                      <Star className={`w-4 h-4 ${selectedRatings.includes(rating) ? 'fill-accent' : ''}`} />
                      <span className="text-sm font-medium">{rating}+</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-secondary mb-3">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  {categoriesForFilter.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-semibold text-secondary mb-3">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  <option value="popular">Most Recent</option>
                  <option value="rating">Top Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">A - Z</option>
                </select>
              </div>

              {/* Bottom Actions inside drawer */}
              <div className="flex gap-3 mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => { resetFilters(); setShowFilters(false); }}
                  className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl hover:bg-gray-50 transition-colors text-sm font-semibold"
                >
                  Reset All
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="flex-1 py-3 bg-primary text-white rounded-xl hover:bg-primary/95 transition-colors text-sm font-semibold"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="max-w-[98%] mx-auto px-2 md:px-4 py-6 pb-24 md:pb-6">
        <div className="flex justify-between items-center mb-5">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-secondary">{filteredServices.length}</span> services
            {searchTerm && <span> for "<span className="font-semibold">{searchTerm}</span>"</span>}
          </p>
        </div>

        {filteredServices.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-secondary mb-2">No services found</h3>
            <p className="text-gray-500 mb-5">Try adjusting your search or filters</p>
            <button onClick={resetFilters} className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all">
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service._id}
                service={service}
                categoryMap={categoriesData.reduce((acc, cat) => ({ ...acc, [cat.value]: cat.label }), {})}
                onBook={handleBookNow}
                getMergedPrice={getMergedPrice}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Service Card Component
const ServiceCard = ({ service, categoryMap, onBook, getMergedPrice }) => {
  const imageUrl = service.displayImage || 'https://via.placeholder.com/400x300?text=Service';
  const isAvailable = service.isActive !== false;
  const categoryName = typeof service.category === 'object'
    ? service.category?.name
    : categoryMap[service.category] || 'Service';

  return (
    <div className="group bg-white rounded-xl border border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="relative h-36 overflow-hidden">
        <img
          src={imageUrl}
          alt={service.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => e.target.src = 'https://via.placeholder.com/400x300?text=Service'}
        />
        <div className="absolute top-2 left-2">
          <span className="text-xs font-medium bg-white/90 backdrop-blur-sm text-primary px-2 py-0.5 rounded-lg">
            {categoryName}
          </span>
        </div>
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-secondary text-sm line-clamp-1 mb-1">{service.title}</h3>
        <p className="text-gray-500 text-xs line-clamp-2 mb-2">{service.description}</p>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Clock className="w-3 h-3" />
            <span>{service.duration || 1} hr</span>
          </div>
          <div className="flex items-center gap-1">
            <Rating value={service.averageRating || 0} precision={0.5} readOnly size="small" sx={{ '& .MuiRating-iconFilled': { color: '#F97316' } }} />
            <span className="text-xs text-gray-500">({service.ratingCount || 0})</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-baseline gap-0.5">
            <IndianRupee className="w-3 h-3 text-secondary" />
            <span className="text-base font-bold text-secondary">
              {getMergedPrice ? getMergedPrice(service.basePrice)?.toLocaleString() : service.basePrice?.toLocaleString()}
            </span>
          </div>
          <button
            onClick={() => onBook(service._id, isAvailable)}
            disabled={!isAvailable}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${isAvailable
              ? 'bg-primary text-white hover:bg-primary/90'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceListingPage;