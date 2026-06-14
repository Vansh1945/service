import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Filter, Clock, IndianRupee,
  RefreshCw, X, LayoutGrid, ShieldCheck,
  ThumbsUp, ChevronRight, ChevronDown
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ServiceCardSkeleton from '../../components/ui-skeletons/ServiceCardSkeleton';
import HeroSection from '../../components/HeroSection';
import ErrorState from '../../components/Error';
import { getPublicServices } from '../../services/ServiceService';
import useCategory from '../../hooks/useCategory';
import useSurchargeBooking from '../../hooks/useSurchargeBooking';
import ServiceCard from './components/ServiceCard';
import ServiceEmptyState from './components/ServiceEmptyState';
import { getDynamicCategoryIcon } from './components/categoryIconHelper';
import ServiceFilterPanel from './components/ServiceFilterPanel';

const ServiceListingPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { getMergedPrice, handleBookNow } = useSurchargeBooking();
  // State
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
  const { categories: categoriesData } = useCategory();
  const [maxPrice, setMaxPrice] = useState(10000);

  const searchTimeoutRef = useRef(null);
  const lastPushedSearchRef = useRef(searchParams.get('search') || '');
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

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      const params = {};
      if (value) params.search = value;
      if (selectedCategory !== 'All') params.category = selectedCategory;
      lastPushedSearchRef.current = value;
      setSearchParams(params);
    }, 300);
  };

  const handleCategoryChange = (categoryId) => {
    navigate(`/customer/services-list?category=${categoryId}`);
  };

  useEffect(() => {
    if (isInitialMount.current) {
      fetchAllServices();
      isInitialMount.current = false;
    }
  }, []);

  // Sync url search parameters to state without overwriting active typing
  useEffect(() => {
    const searchVal = searchParams.get('search') || '';
    const categoryVal = searchParams.get('category') || 'All';

    if (searchVal !== lastPushedSearchRef.current) {
      setSearchTerm(searchVal);
      lastPushedSearchRef.current = searchVal;
    }
    setSelectedCategory(categoryVal);
  }, [searchParams]);

  const categoriesForFilter = useMemo(() => {
    return [{ value: 'All', label: 'All Categories' }, ...categoriesData];
  }, [categoriesData]);

  // Filter and sort services instantly on client side
  const filteredServices = useMemo(() => {
    let results = [...allServices];

    // 1. Filter by category
    if (selectedCategory && selectedCategory !== 'All') {
      results = results.filter(service => {
        const catId = typeof service.category === 'object' ? service.category?._id : service.category;
        return catId === selectedCategory;
      });
    }

    // 2. Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      const getCatName = (cat) => {
        if (typeof cat === 'object' && cat !== null) return cat.name || '';
        const found = categoriesData.find(c => c.value === cat);
        return found ? found.label : '';
      };

      results = results.filter(service => {
        const titleMatch = service.title?.toLowerCase().includes(searchLower);
        const descMatch = service.description?.toLowerCase().includes(searchLower);
        const catMatch = getCatName(service.category).toLowerCase().includes(searchLower);

        // Custom stemming for wire/wiring/wires
        const wireMatch = (searchLower === 'wire' && service.title?.toLowerCase().includes('wiring')) ||
          (searchLower === 'wiring' && service.title?.toLowerCase().includes('wire')) ||
          (searchLower === 'wire' && service.description?.toLowerCase().includes('wiring')) ||
          (searchLower === 'wiring' && service.description?.toLowerCase().includes('wire'));

        const tagsMatch = service.tags?.some(tag => tag?.toLowerCase().includes(searchLower));

        return titleMatch || descMatch || catMatch || wireMatch || tagsMatch;
      });
    }

    // 3. Filter by price range
    results = results.filter(service =>
      service.basePrice >= priceRange[0] && service.basePrice <= priceRange[1]
    );

    // 4. Filter by ratings
    if (selectedRatings.length > 0) {
      results = results.filter(service =>
        selectedRatings.includes(Math.floor(service.averageRating || 0))
      );
    }

    // 5. Sort
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
  }, [allServices, searchTerm, selectedCategory, priceRange, sortBy, selectedRatings, categoriesData]);

  const resetFilters = () => {
    setSearchTerm('');
    lastPushedSearchRef.current = '';
    setSelectedCategory('All');
    setPriceRange([0, maxPrice]);
    setSortBy('popular');
    setSelectedRatings([]);
    setSearchParams({});
  };

  const clearSearch = () => {
    setSearchTerm('');
    lastPushedSearchRef.current = '';
    setSelectedCategory('All');
    setSearchParams({});
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

  // Category scrolling ref
  const categoryScrollRef = useRef(null);
  const scrollCategories = (direction) => {
    if (categoryScrollRef.current) {
      const { scrollLeft, clientWidth } = categoryScrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - 200 : scrollLeft + 200;
      categoryScrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50">
        <HeroSection noMargin />
        <div className="max-w-[98%] mx-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
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
    <div className="min-h-screen bg-gray-50/30 pb-4 md:pb-0 pt-4">
      {/* Slider Banner Section */}
      <HeroSection noMargin />

      {/* Main Container */}
      <div className="max-w-[98%] mx-auto px-2 md:px-4 py-2 flex flex-col gap-5">

        {/* Horizontal Categories Ribbon */}
        <div className="relative bg-white rounded-2xl border border-gray-100 p-2 md:p-3.5 shadow-sm">
          <div
            className="flex items-center gap-4 md:gap-6 overflow-x-auto py-1.5 px-1 scrollbar-hide scroll-smooth"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {categoriesForFilter.map((cat) => {
              const IconComp = cat.value === 'All' ? LayoutGrid : getDynamicCategoryIcon(cat.icon);
              const isActive = selectedCategory === cat.value;
              const isUrlIcon = cat.icon && (cat.icon.startsWith('http') || cat.icon.startsWith('/') || cat.icon.startsWith('data:'));

              return (
                <button
                  key={cat.value}
                  onClick={() => handleCategoryChange(cat.value)}
                  className="flex flex-col items-center min-w-[64px] md:min-w-[80px] focus:outline-none group flex-shrink-0"
                >
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm border ${isActive
                    ? 'bg-primary/10 border-primary text-primary scale-105 ring-2 ring-primary/20'
                    : 'bg-gray-50 border-gray-150 text-gray-500 hover:border-primary/30 hover:bg-white group-hover:scale-105'
                    }`}>
                    {isUrlIcon ? (
                      <img
                        src={cat.icon}
                        alt={cat.label}
                        className={`w-5 h-5 md:w-6 md:h-6 object-contain ${isActive ? '' : 'opacity-80 group-hover:opacity-100'}`}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      IconComp && <IconComp className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </div>
                  <span className={`text-[10px] md:text-[11px] font-semibold tracking-wide text-center mt-2 md:mt-2.5 line-clamp-1 transition-colors ${isActive ? 'text-primary font-bold' : 'text-gray-600 group-hover:text-primary'
                    }`}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Popular Services & Controls Section */}
        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-secondary tracking-tight font-poppins">
                Popular Services
              </h2>
              <p className="text-xs md:text-sm text-gray-500 mt-1 font-inter">
                Book trusted technicians for top-rated, safe, and professional services
              </p>
            </div>

            {/* Premium Controls Row */}
            <div className="flex items-center gap-2.5 self-start md:self-end">
              {/* Sort Dropdown */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="pl-3.5 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 text-xs font-semibold text-gray-700 cursor-pointer appearance-none shadow-sm min-w-[130px]"
                >
                  <option value="popular">Sort by: Popular</option>
                  <option value="rating">Sort by: Top Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name: A - Z</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>

              {/* Filters Trigger */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl hover:bg-gray-50 active:scale-95 transition-all text-xs font-semibold shadow-sm ${showFilters ? 'border-primary text-primary bg-primary/5' : 'border-gray-200 text-gray-700'
                  }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Filters Panel (Drawer on Mobile, Inline on Desktop) */}
          {showFilters && (
            <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto flex flex-col justify-end lg:justify-start">
              {/* Backdrop for mobile */}
              <div
                className="fixed inset-0 bg-black/45 lg:hidden"
                onClick={() => setShowFilters(false)}
                role="button"
                tabIndex={0}
                onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowFilters(false); }}
                aria-label="Close filters"
              />

              {/* Drawer Content */}
              <div className="fixed bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl p-5 shadow-2xl lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:max-h-none lg:bg-transparent lg:p-0 lg:shadow-none z-10 transition-transform duration-300">
                {/* Drawer Header for mobile */}
                <div className="flex flex-col items-center gap-2 lg:hidden mb-4">
                  <div className="w-12 h-1 bg-gray-250 rounded-full" />
                  <div className="flex items-center justify-between w-full mt-2">
                    <span className="text-sm font-extrabold text-secondary font-poppins">Filters</span>
                    <button type="button" onClick={() => setShowFilters(false)} className="text-xs font-bold text-primary">Done</button>
                  </div>
                </div>

                <ServiceFilterPanel
                  layout="horizontal"
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  maxPrice={maxPrice}
                  selectedRatings={selectedRatings}
                  toggleRating={toggleRating}
                  resetFilters={resetFilters}
                />
              </div>
            </div>
          )}

          {/* Results Grid / List container */}
          {filteredServices.length === 0 ? (
            <ServiceEmptyState
              message="We couldn't find any services matching your current selection. Try resetting filters."
              buttonText="Reset Filters"
              onReset={resetFilters}
            />
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 md:gap-4">
                {filteredServices.slice(0, 18).map((service) => {
                  return (
                    <div key={service._id} className="block h-full">
                      <ServiceCard
                        service={service}
                        categoryMap={categoriesData.reduce((acc, cat) => ({ ...acc, [cat.value]: cat.label }), {})}
                        onBook={handleBookNow}
                        getMergedPrice={getMergedPrice}
                      />
                    </div>
                  );
                })}
              </div>

              {filteredServices.length > 18 && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => navigate('/customer/services-list')}
                    className="px-8 py-3 bg-white hover:bg-gray-50 text-primary border border-primary/20 hover:border-primary/40 rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 duration-200"
                  >
                    View More Services
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Features Strip */}
        <div className="bg-white rounded-2xl border border-gray-150 p-4 md:p-6 shadow-sm mt-1.5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-6 md:divide-x md:divide-gray-100">
            <div className="flex flex-col items-center text-center px-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-xs font-bold text-secondary">Verified Professionals</h4>
              <p className="text-[10px] text-gray-400 mt-1">Background-checked experts</p>
            </div>

            <div className="flex flex-col items-center text-center px-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-xs font-bold text-secondary">On-time Service</h4>
              <p className="text-[10px] text-gray-400 mt-1">Punctual & reliable experts</p>
            </div>

            <div className="flex flex-col items-center text-center px-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <IndianRupee className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-xs font-bold text-secondary">Upfront Pricing</h4>
              <p className="text-[10px] text-gray-400 mt-1">No hidden surcharges/fees</p>
            </div>

            <div className="flex flex-col items-center text-center px-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <ThumbsUp className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-xs font-bold text-secondary">Satisfaction Guarantee</h4>
              <p className="text-[10px] text-gray-400 mt-1">Quality workmanship assured</p>
            </div>

            <div className="flex flex-col items-center text-center px-2 col-span-2 md:col-span-1">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <RefreshCw className="w-5 h-5 text-primary" />
              </div>
              <h4 className="text-xs font-bold text-secondary">24/7 Support</h4>
              <p className="text-[10px] text-gray-400 mt-1">Always here to assist you</p>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Bar for Mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-150 px-3 py-3 shadow-lg flex items-center gap-2 z-40">
          {/* Category Select Dropdown */}
          <div className="flex-1 relative">
            <select
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full pl-2.5 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 text-xs font-bold text-gray-700 appearance-none cursor-pointer truncate"
            >
              {categoriesForFilter.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Sort By Select Dropdown */}
          <div className="flex-1 relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-2.5 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 text-xs font-bold text-gray-700 appearance-none cursor-pointer truncate"
            >
              <option value="popular">Sort: Popular</option>
              <option value="rating">Sort: Rated</option>
              <option value="price-low">Price: Low-High</option>
              <option value="price-high">Price: High-Low</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(true)}
            className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Filters</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default ServiceListingPage;