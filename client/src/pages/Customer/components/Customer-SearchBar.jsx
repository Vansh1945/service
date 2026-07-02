import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Grid, Shield, Calendar, ArrowRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCategories } from '../../../services/SystemService';
import { getPublicServices } from '../../../services/ServiceService';
import { getCustomerBookings } from '../../../services/BookingService';
import { useAuth } from '../../../context/auth';

const SearchBar = ({ placeholder = "Search services, categories, bookings..." }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const isBookingsPage = location.pathname === '/customer/bookings';
  const displayPlaceholder = isBookingsPage ? "Search your bookings by service or ID..." : placeholder;

  useEffect(() => {
    if (isBookingsPage) {
      const params = new URLSearchParams(location.search);
      const searchVal = params.get('search') || '';
      setQuery(searchVal);
    } else {
      setQuery('');
    }
  }, [location.search, isBookingsPage]);

  // Data states
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Active item index for keyboard navigation
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch all searchable data once when user focuses the search bar
  const fetchData = async () => {
    if (hasFetched) return;
    setLoading(true);
    try {
      const [catRes, svcRes] = await Promise.all([
        getCategories(),
        getPublicServices(1, 100)
      ]);

      if (catRes.data?.success) {
        setCategories(catRes.data.data || []);
      }
      if (svcRes.data?.success) {
        setServices(svcRes.data.data || []);
      }

      if (isAuthenticated) {
        const bookingsParams = new URLSearchParams({ page: 1, limit: 50 });
        const bookingsRes = await getCustomerBookings(bookingsParams);
        if (bookingsRes.data?.success) {
          setBookings(bookingsRes.data.data || []);
        }
      }
      setHasFetched(true);
    } catch (err) {
      console.error("Error prefetching search data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const getFilteredSuggestions = () => {
    if (!query.trim()) return { categories: [], services: [], bookings: [] };
    const cleanQuery = query.toLowerCase().trim();

    const filteredCats = categories.filter(cat =>
      cat.name?.toLowerCase().includes(cleanQuery)
    ).slice(0, 5);

    const filteredSvcs = services.filter(svc =>
      svc.title?.toLowerCase().includes(cleanQuery) ||
      svc.description?.toLowerCase().includes(cleanQuery)
    ).slice(0, 5);

    const filteredBookings = bookings.filter(b => {
      const firstSvcTitle = b.services?.[0]?.service?.title || '';
      const bookingId = b.bookingId || '';
      return firstSvcTitle.toLowerCase().includes(cleanQuery) ||
        bookingId.toLowerCase().includes(cleanQuery);
    }).slice(0, 5);

    return {
      categories: filteredCats,
      services: filteredSvcs,
      bookings: filteredBookings
    };
  };

  const suggestions = getFilteredSuggestions();
  const totalSuggestionsCount = suggestions.categories.length + suggestions.services.length + suggestions.bookings.length;

  // Flattened suggestions helper for keyboard navigation
  const getFlattenedSuggestions = () => {
    const list = [];
    suggestions.categories.forEach(cat => list.push({ type: 'category', item: cat }));
    suggestions.services.forEach(svc => list.push({ type: 'service', item: svc }));
    suggestions.bookings.forEach(b => list.push({ type: 'booking', item: b }));
    return list;
  };

  const flattenedList = getFlattenedSuggestions();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion) => {
    setIsOpen(false);
    setQuery('');
    if (suggestion.type === 'category') {
      navigate(`/customer/services-list?categories=${suggestion.item._id}`);
    } else if (suggestion.type === 'service') {
      navigate(`/customer/services-list?search=${encodeURIComponent(suggestion.item.title)}`);
    } else if (suggestion.type === 'booking') {
      navigate(`/customer/bookings?bookingId=${suggestion.item._id}`);
    }
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (isBookingsPage) {
      inputRef.current?.blur();
      return;
    }
    if (activeIndex >= 0 && activeIndex < flattenedList.length) {
      handleSelectSuggestion(flattenedList[activeIndex]);
      return;
    }
    if (query.trim()) {
      navigate(`/customer/services-list?search=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1 < totalSuggestionsCount ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 >= 0 ? prev - 1 : totalSuggestionsCount - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  return (
    <div ref={containerRef} className="w-full relative">
      <form onSubmit={handleSearchSubmit} className="relative w-full">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
          <Search className="text-gray-400/80 w-4 h-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder={displayPlaceholder}
          value={query}
          onFocus={() => {
            if (!isBookingsPage) {
              fetchData();
              setIsOpen(true);
            }
          }}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            if (isBookingsPage) {
              const params = new URLSearchParams(location.search);
              if (val.trim()) {
                params.set('search', val);
              } else {
                params.delete('search');
              }
              navigate(`${location.pathname}?${params.toString()}`, { replace: true });
            } else {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all font-inter text-xs text-secondary placeholder-gray-400"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setActiveIndex(-1);
              if (isBookingsPage) {
                const params = new URLSearchParams(location.search);
                params.delete('search');
                navigate(`${location.pathname}?${params.toString()}`, { replace: true });
              }
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 transition-colors"
            type="button"
            aria-label="Clear search"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </form>

      {/* Suggestions Dropdown */}
      {isOpen && query.trim() && !isBookingsPage && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-[999] overflow-hidden max-h-[420px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          {totalSuggestionsCount === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">
              No matching categories, services, or bookings found.
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {/* Categories Section */}
              {suggestions.categories.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5 text-gray-400" />
                    Categories
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {suggestions.categories.map((cat, idx) => {
                      const overallIndex = idx;
                      const isHovered = activeIndex === overallIndex;
                      return (
                        <button
                          key={cat._id}
                          onClick={() => handleSelectSuggestion({ type: 'category', item: cat })}
                          className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${isHovered ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                          <span className="text-xs font-semibold">{cat.name}</span>
                          <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Services Section */}
              {suggestions.services.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-gray-400" />
                    Services
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {suggestions.services.map((svc, idx) => {
                      const overallIndex = suggestions.categories.length + idx;
                      const isHovered = activeIndex === overallIndex;
                      return (
                        <button
                          key={svc._id}
                          onClick={() => handleSelectSuggestion({ type: 'service', item: svc })}
                          className={`w-full text-left px-3 py-2 rounded-xl flex flex-col transition-colors ${isHovered ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                          <span className="text-xs font-semibold">{svc.title}</span>
                          {svc.description && (
                            <span className="text-[10px] text-gray-400 truncate w-full mt-0.5">{svc.description}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bookings Section */}
              {suggestions.bookings.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    Bookings History
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {suggestions.bookings.map((b, idx) => {
                      const overallIndex = suggestions.categories.length + suggestions.services.length + idx;
                      const isHovered = activeIndex === overallIndex;
                      const firstSvcTitle = b.services?.[0]?.service?.title || 'Service Booking';
                      return (
                        <button
                          key={b._id}
                          onClick={() => handleSelectSuggestion({ type: 'booking', item: b })}
                          className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${isHovered ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold truncate">{firstSvcTitle}</span>
                            <span className="text-[10px] text-gray-400 font-mono mt-0.5">{b.bookingId || `#${b._id?.slice(-8).toUpperCase()}`}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${b.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                              b.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                            {b.status}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
