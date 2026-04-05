import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Filter, Clock, IndianRupee, CheckCircle,
  AlertCircle, RefreshCw, Sliders, Star, X
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from '../../context/auth';
import Rating from '@mui/material/Rating';
import LoadingSpinner from '../../components/Loader';
import HeroSection from '../../components/HeroSection';

const ServiceListingPage = () => {
  const { API, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [services, setServices] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All');
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sortBy, setSortBy] = useState('popular');
  const [retryCount, setRetryCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState([]);
  const [categoriesData, setCategoriesData] = useState([]);
  const [maxPrice, setMaxPrice] = useState(10000);

  const searchTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API}/system-setting/categories`);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setCategoriesData(data.data);
      }
    } catch (error) {
      console.error('Fetch categories error:', error);
    }
  };

  // Fetch all services
  const fetchAllServices = async () => {
    try {
      setInitialLoading(true);
      setError(null);

      const response = await fetch(`${API}/service/services?page=1&limit=100`);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        const transformedServices = data.data.map(service => ({
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
        throw new Error(data.message || 'Invalid response');
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
      return categoriesData.find(c => c._id === cat)?.name || '';
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
      fetchCategories();
      isInitialMount.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isInitialMount.current) {
      applyLocalFilters(searchTerm, selectedCategory);
    }
  }, [searchTerm, selectedCategory]);

  const categoriesForFilter = useMemo(() => {
    return [{ _id: 'All', name: 'All' }, ...categoriesData];
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
    navigate(`/customer/services/${serviceId}`);
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

  if (initialLoading) return <LoadingSpinner />;

  if (error && allServices.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md mx-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => fetchAllServices()}
            className="px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <HeroSection noMargin />

      {/* Search Section */}
      <div className="sticky top-16 z-20 bg-gray-50/95 backdrop-blur-sm py-4 px-2 md:px-4 border-b border-gray-200">
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
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              {categoriesForFilter.map(cat => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
            >
              <Filter className="w-4 h-4 text-primary" />
              <span className="font-medium">Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 py-5 px-2 md:px-4">
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

      {/* Results */}
      <div className="max-w-[98%] mx-auto px-2 md:px-4 py-6">
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
                categoryMap={categoriesData.reduce((acc, cat) => ({ ...acc, [cat._id]: cat.name }), {})}
                onBook={handleBookNow}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Service Card Component
const ServiceCard = ({ service, categoryMap, onBook }) => {
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
            <span className="text-base font-bold text-secondary">{service.basePrice?.toLocaleString()}</span>
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