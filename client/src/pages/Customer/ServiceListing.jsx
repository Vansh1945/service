import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Star, Filter, LayoutGrid, ChevronRight, Check, ChevronDown
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import { getPublicServices } from '../../services/ServiceService';
import useCategory from '../../hooks/useCategory';
import useSurchargeBooking from '../../hooks/useSurchargeBooking';
import ServiceCard from './components/ServiceCard';
import ServiceEmptyState from './components/ServiceEmptyState';
import ServiceCardSkeleton from '../../components/ui-skeletons/ServiceCardSkeleton';
import { getDynamicCategoryIcon } from './components/categoryIconHelper';
import ServiceFilterPanel from './components/ServiceFilterPanel';

const ServiceListing = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { getMergedPrice, handleBookNow } = useSurchargeBooking();
  const [allServices, setAllServices] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Pagination states
  const [visibleCount, setVisibleCount] = useState(10);

  // Filter states
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const getInitialCategories = () => {
    const cats = searchParams.get('categories') || searchParams.get('category');
    return cats ? cats.split(',') : [];
  };
  const [selectedCategories, setSelectedCategories] = useState(getInitialCategories());
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [sortBy, setSortBy] = useState('popular');
  const [selectedRatings, setSelectedRatings] = useState([]);
  const { categories: categoriesData } = useCategory();
  const [maxPrice, setMaxPrice] = useState(10000);

  const searchTimeoutRef = useRef(null);
  const lastPushedSearchRef = useRef(searchParams.get('search') || '');
  const lastPushedCategoriesRef = useRef(getInitialCategories());

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      const params = {};
      if (value) params.search = value;
      if (selectedCategories.length > 0) params.categories = selectedCategories.join(',');
      lastPushedSearchRef.current = value;
      setSearchParams(params);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Sync url search parameters to state when URL changes
  useEffect(() => {
    const searchVal = searchParams.get('search') || '';
    const cats = searchParams.get('categories') || searchParams.get('category');
    const categoriesVal = cats ? cats.split(',') : [];

    if (searchVal !== lastPushedSearchRef.current) {
      setSearchTerm(searchVal);
      lastPushedSearchRef.current = searchVal;
    }

    const isCatsMatch = categoriesVal.length === lastPushedCategoriesRef.current.length &&
      categoriesVal.every(c => lastPushedCategoriesRef.current.includes(c));

    if (!isCatsMatch) {
      setSelectedCategories(categoriesVal);
      lastPushedCategoriesRef.current = categoriesVal;
      setVisibleCount(10);
    }
  }, [searchParams]);

  // Fetch services from backend
  const fetchServices = async () => {
    try {
      setInitialLoading(true);
      setError(null);

      // Fetch active services (all at once for client side filtering)
      const response = await getPublicServices(1, 100);
      const responseData = response.data;

      if (responseData.success && Array.isArray(responseData.data)) {
        const transformedServices = responseData.data.map(service => ({
          ...service,
          displayImage: service.images?.[0] || service.image
        }));

        setAllServices(transformedServices);

        // Setup initial max price based on fetched items
        if (transformedServices.length > 0) {
          const maxServicePrice = Math.max(...transformedServices.map(s => s.basePrice || 0), 10000);
          setMaxPrice(maxServicePrice);
          setPriceRange([0, maxServicePrice]);
        }
      } else {
        throw new Error(responseData.message || 'Invalid response');
      }
    } catch (error) {
      console.error('Fetch services error:', error);
      setError(error.message || 'Failed to load services');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const categoryMap = useMemo(() => {
    return categoriesData.reduce((acc, cat) => ({ ...acc, [cat.value]: cat.label }), {});
  }, [categoriesData]);

  // Apply filters locally on the fetched data page
  const filteredAndSortedServices = useMemo(() => {
    let results = [...allServices];

    // Filter by category if matched locally
    if (selectedCategories.length > 0) {
      results = results.filter(service => {
        const catId = typeof service.category === 'object' ? service.category?._id : service.category;
        return selectedCategories.includes(catId);
      });
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      results = results.filter(service => {
        const titleMatch = service.title?.toLowerCase().includes(searchLower);
        const descMatch = service.description?.toLowerCase().includes(searchLower);
        const catName = typeof service.category === 'object' ? service.category?.name : categoryMap[service.category];
        const catMatch = catName?.toLowerCase().includes(searchLower);

        // Custom stemming for wire/wiring/wires
        const wireMatch = (searchLower === 'wire' && service.title?.toLowerCase().includes('wiring')) ||
          (searchLower === 'wiring' && service.title?.toLowerCase().includes('wire')) ||
          (searchLower === 'wire' && service.description?.toLowerCase().includes('wiring')) ||
          (searchLower === 'wiring' && service.description?.toLowerCase().includes('wire'));

        const tagsMatch = service.tags?.some(tag => tag?.toLowerCase().includes(searchLower));

        return titleMatch || descMatch || catMatch || wireMatch || tagsMatch;
      });
    }

    // Filter by price range
    results = results.filter(service => {
      const price = service.discountPrice || service.basePrice;
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Filter by ratings selection (e.g. 4★ & above means >= 4)
    if (selectedRatings.length > 0) {
      results = results.filter(service => {
        const rating = service.averageRating || 0;
        return selectedRatings.some(minRating => rating >= minRating);
      });
    }

    // Sort
    results.sort((a, b) => {
      const priceA = a.discountPrice || a.basePrice || 0;
      const priceB = b.discountPrice || b.basePrice || 0;
      switch (sortBy) {
        case 'price-low': return priceA - priceB;
        case 'price-high': return priceB - priceA;
        case 'rating': return (b.averageRating || 0) - (a.averageRating || 0);
        case 'name': return (a.title || '').localeCompare(b.title || '');
        default: return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

    return results;
  }, [allServices, selectedCategories, searchTerm, priceRange, selectedRatings, sortBy, categoryMap]);

  const activeCategoryDoc = useMemo(() => {
    if (selectedCategories.length === 1) {
      return categoriesData.find(c => c.value === selectedCategories[0]);
    }
    return null;
  }, [categoriesData, selectedCategories]);

  const categoriesForFilter = useMemo(() => {
    return [{ value: 'All', label: 'All Categories' }, ...categoriesData];
  }, [categoriesData]);

  const activeCategoryName = activeCategoryDoc
    ? (activeCategoryDoc.label || activeCategoryDoc.name)
    : selectedCategories.length > 1
      ? 'Selected Services'
      : 'All Services';
  const activeCategoryDescription = activeCategoryDoc?.description || 'Find trusted electricians and technicians for all types of services.';
  const ActiveIcon = selectedCategories.length === 0 ? LayoutGrid : getDynamicCategoryIcon(activeCategoryDoc?.icon);

  // Derived Header Statistics
  const stats = useMemo(() => {
    const activeServices = allServices.filter(s => {
      if (selectedCategories.length === 0) return true;
      const catId = typeof s.category === 'object' ? s.category?._id : s.category;
      return selectedCategories.includes(catId);
    });

    const totalCount = activeServices.length;
    const ratings = activeServices.map(s => s.averageRating || 0).filter(r => r > 0);
    const avgRating = ratings.length > 0 ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1) : '4.7';

    // Estimate electricians and customer satisfaction dynamically based on rating and count
    const electriciansCount = Math.max(15, totalCount * 3 + 4);
    const satisfactionRate = ratings.length > 0 ? Math.min(100, Math.round(90 + (parseFloat(avgRating) - 4) * 10)) : 100;

    return {
      totalCount,
      avgRating,
      electriciansCount,
      satisfactionRate
    };
  }, [allServices, selectedCategories]);

  const handleCategoryChange = (categoryId) => {
    let updated;
    if (categoryId === 'All') {
      updated = [];
    } else {
      if (selectedCategories.includes(categoryId)) {
        updated = selectedCategories.filter(id => id !== categoryId);
      } else {
        updated = [...selectedCategories, categoryId];
      }
    }
    setSelectedCategories(updated);
    setVisibleCount(10);
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (updated.length > 0) params.categories = updated.join(',');
    lastPushedCategoriesRef.current = updated;
    setSearchParams(params);
  };

  const handleDropdownCategoryChange = (categoryId) => {
    const updated = categoryId === 'All' ? [] : [categoryId];
    setSelectedCategories(updated);
    setVisibleCount(10);
    const params = {};
    if (searchTerm) params.search = searchTerm;
    if (updated.length > 0) params.categories = updated.join(',');
    lastPushedCategoriesRef.current = updated;
    setSearchParams(params);
  };

  const resetFilters = () => {
    setSearchTerm('');
    lastPushedSearchRef.current = '';
    setSelectedCategories([]);
    lastPushedCategoriesRef.current = [];
    setPriceRange([0, maxPrice]);
    setSortBy('popular');
    setSelectedRatings([]);
    setSearchParams({});
    setVisibleCount(10);
  };

  const toggleRating = (rating) => {
    setSelectedRatings(prev =>
      prev.includes(rating) ? prev.filter(r => r !== rating) : [...prev, rating]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/30 font-roboto pb-20 lg:pb-0">
      {/* Main content */}
      <div className="max-w-[98%] mx-auto px-2 md:px-4 pt-4 py-2">

        {/* 1. Breadcrumb Row */}
        <nav className="flex items-center gap-2 text-xs text-gray-400 font-medium mb-3.5">
          <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-600 font-semibold">{activeCategoryName}</span>
        </nav>

        {/* 2. Header Section with Stats */}
        <div className="bg-white rounded-xl border border-gray-150 px-3 py-2.5 md:px-4 md:py-3 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 flex-shrink-0">
              {activeCategoryDoc?.icon ? (
                <img
                  src={activeCategoryDoc.icon}
                  alt={activeCategoryName}
                  className="w-5 h-5 object-contain"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <ActiveIcon className="w-5 h-5" />
              )}
            </div>
            <div>
              <h1 className="text-sm md:text-base font-extrabold text-secondary tracking-tight font-poppins leading-snug">
                {activeCategoryName.toLowerCase().includes('services') ? activeCategoryName : `${activeCategoryName} Services`}
              </h1>
              <p className="text-[11px] md:text-xs text-gray-500 mt-0.5 leading-relaxed max-w-xl font-inter">
                {activeCategoryDescription}
              </p>
            </div>
          </div>

          {/* Premium Statistic Cards */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 flex-shrink-0 w-full lg:w-auto">
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-center min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-primary font-poppins leading-tight">{stats.totalCount}+</div>
              <div className="text-[7px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Services</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-center min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-secondary flex items-center justify-center gap-0.5 font-poppins leading-tight">
                {stats.avgRating} <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-500 fill-amber-500" />
              </div>
              <div className="text-[7px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Avg. Rating</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-center min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-secondary font-poppins leading-tight">{stats.electriciansCount}+</div>
              <div className="text-[7px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Electricians</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-center min-w-0">
              <div className="text-xs sm:text-sm font-extrabold text-emerald-600 font-poppins leading-tight">{stats.satisfactionRate}%</div>
              <div className="text-[7px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-0.5">Satisfaction</div>
            </div>
          </div>
        </div>

        {/* 4. Main Layout Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* LEFT SIDEBAR / MOBILE BOTTOM DRAWER */}
          <div className={`fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto lg:col-span-2 flex-col ${showMobileFilters ? 'flex' : 'hidden lg:flex'}`}>
            {/* Backdrop for mobile */}
            <div className="fixed inset-0 bg-black/45 lg:hidden" onClick={() => setShowMobileFilters(false)} />

            {/* Drawer Content */}
            <aside className={`fixed bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto bg-white rounded-t-3xl p-5 shadow-2xl lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:max-h-none lg:bg-transparent lg:p-0 lg:shadow-none flex flex-col gap-5 z-10 transition-transform duration-300`}>
              {/* Drawer Header for mobile */}
              <div className="flex flex-col items-center gap-2 lg:hidden mb-1">
                <div className="w-12 h-1 bg-gray-250 rounded-full" />
                <div className="flex items-center justify-between w-full mt-2">
                  <span className="text-sm font-extrabold text-secondary font-poppins">Filters & Categories</span>
                  <button onClick={() => setShowMobileFilters(false)} className="text-xs font-bold text-primary">Done</button>
                </div>
              </div>

              {/* Categories Selector */}
              <div className="lg:bg-white lg:rounded-2xl lg:border lg:border-gray-150 lg:p-5 lg:shadow-sm p-0 bg-transparent border-none shadow-none lg:overflow-hidden">
                <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-4 font-poppins">Categories</h3>
                <div className="flex flex-col gap-1">
                  {categoriesForFilter.map((cat) => {
                    const isActive = cat.value === 'All'
                      ? selectedCategories.length === 0
                      : selectedCategories.includes(cat.value);

                    return (
                      <button
                        key={cat.value}
                        onClick={() => handleCategoryChange(cat.value)}
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold transition-all group ${isActive
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                          }`}
                      >
                        <span className="truncate">{cat.label}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar Filters */}
              <ServiceFilterPanel
                layout="sidebar"
                priceRange={priceRange}
                setPriceRange={setPriceRange}
                maxPrice={maxPrice}
                selectedRatings={selectedRatings}
                toggleRating={toggleRating}
                resetFilters={resetFilters}
                sortBy={sortBy}
                setSortBy={setSortBy}
              />
            </aside>
          </div>

          {/* RIGHT CONTENT AREA */}
          <main className="lg:col-span-10 flex flex-col gap-6">

            {/* Top Info Bar & View Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <p className="text-sm text-gray-500 font-medium font-inter">
                Showing <span className="font-semibold text-secondary">{filteredAndSortedServices.length} services</span>
              </p>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="hidden sm:block pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 text-xs font-semibold text-gray-700 cursor-pointer appearance-none shadow-sm min-w-[130px]"
                >
                  <option value="popular">Sort by: Popular</option>
                  <option value="rating">Sort by: Top Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* Service Grid/List results */}
            {initialLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <ServiceCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredAndSortedServices.length === 0 ? (
              <ServiceEmptyState
                message="We couldn't find any services matching your selection or filter. Try adjusting pricing or ratings."
                buttonText="Reset All Filters"
                onReset={resetFilters}
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
                {filteredAndSortedServices.slice(0, visibleCount).map((service) => (
                  <div key={service._id} className="h-full">
                    <ServiceCard
                      key={service._id}
                      service={service}
                      categoryMap={categoryMap}
                      onBook={handleBookNow}
                      getMergedPrice={getMergedPrice}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* View More Button */}
            {visibleCount < filteredAndSortedServices.length && (
              <div className="mt-8 flex justify-center w-full">
                <button
                  onClick={() => setVisibleCount(prev => prev + 10)}
                  className="px-8 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-md shadow-primary/10 hover:bg-primary/95 transition-all active:scale-95 duration-200"
                >
                  View More ({filteredAndSortedServices.length - visibleCount} remaining)
                </button>
              </div>
            )}

          </main>
        </div>

        {/* Sticky Bottom Bar for Mobile */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-150 px-3 py-3 shadow-lg flex items-center gap-2 z-40">
          {/* Category Select Dropdown */}
          <div className="flex-1 relative">
            <select
              value={selectedCategories.length === 1 ? selectedCategories[0] : 'All'}
              onChange={(e) => handleDropdownCategoryChange(e.target.value)}
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
            onClick={() => setShowMobileFilters(true)}
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

export default ServiceListing;
