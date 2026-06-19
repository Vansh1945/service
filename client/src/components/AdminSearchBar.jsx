import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, ArrowRight, Calendar, AlertCircle, Users, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminSearchBar = ({
  value: propValue,
  onChange: propOnChange,
  placeholder = 'Search...',
  className = '',
  disabled = false,
  autoFocus = false,
  loading = false,
  icon: IconProp,
  onClear: propOnClear,
  menuGroups = [],
  isGlobal = false,
  ...restProps
}) => {
  const Icon = IconProp || Search;
  const navigate = useNavigate();

  // For global search, manage local input state
  const [localQuery, setLocalQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const query = isGlobal ? localQuery : (propValue || '');

  // Close dropdown on click outside
  useEffect(() => {
    if (!isGlobal) return;
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isGlobal]);

  // Reset active index when query changes
  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const handleClear = (e) => {
    e.preventDefault();
    if (isGlobal) {
      setLocalQuery('');
      setActiveIndex(-1);
      inputRef.current?.focus();
    } else if (propOnClear) {
      propOnClear();
    }
  };

  const handleInputChange = (e) => {
    if (isGlobal) {
      setLocalQuery(e.target.value);
      setIsOpen(true);
    } else if (propOnChange) {
      propOnChange(e);
    }
  };

  // Generate suggestions dynamically from menuGroups, matching standard and sub-route aliases
  const getFilteredSuggestions = () => {
    if (!query.trim()) return [];
    const cleanQuery = query.toLowerCase().trim();
    const rawVal = query.trim();

    const suggestions = [];

    // Check for ID prefix/pattern matches
    const isBookingId = cleanQuery.startsWith('bk-') || /^[a-z]{2,3}-\d{4}-[a-z0-9]+$/i.test(cleanQuery);
    const isComplaintId = cleanQuery.startsWith('comp-') || cleanQuery.startsWith('cp-');
    const isProviderId = cleanQuery.startsWith('prov-');
    const isTxnId = cleanQuery.startsWith('txn-') || cleanQuery.startsWith('pay_') || cleanQuery.startsWith('order_');

    if (isBookingId) {
      suggestions.push({
        name: `Search Booking ID: ${rawVal}`,
        section: 'Quick Search',
        route: `/admin/bookings?search=${encodeURIComponent(rawVal)}`,
        icon: <Calendar className="w-4 h-4" />
      });
    }
    if (isComplaintId) {
      suggestions.push({
        name: `Search Complaint ID: ${rawVal}`,
        section: 'Quick Search',
        route: `/admin/complaints?search=${encodeURIComponent(rawVal)}`,
        icon: <AlertCircle className="w-4 h-4" />
      });
    }
    if (isProviderId) {
      suggestions.push({
        name: `Search Provider ID (Pending): ${rawVal}`,
        section: 'Quick Search',
        route: `/admin/providers?search=${encodeURIComponent(rawVal)}`,
        icon: <Users className="w-4 h-4" />
      });
      suggestions.push({
        name: `Search Provider ID (Approved): ${rawVal}`,
        section: 'Quick Search',
        route: `/admin/approve-providers?search=${encodeURIComponent(rawVal)}`,
        icon: <Users className="w-4 h-4" />
      });
    }
    if (isTxnId) {
      suggestions.push({
        name: `Search Transaction/Payment ID: ${rawVal}`,
        section: 'Quick Search',
        route: `/admin/transactions?search=${encodeURIComponent(rawVal)}`,
        icon: <Activity className="w-4 h-4" />
      });
    }

    // Generic fallback for any other long alphanumeric strings that might be raw IDs
    const looksLikeId = cleanQuery.length >= 6 && /^[a-z0-9_-]+$/i.test(cleanQuery);
    if (looksLikeId && !isBookingId && !isComplaintId && !isProviderId && !isTxnId) {
      suggestions.push({
        name: `Search Bookings for "${rawVal}"`,
        section: 'Quick ID Search',
        route: `/admin/bookings?search=${encodeURIComponent(rawVal)}`,
        icon: <Calendar className="w-4 h-4" />
      });
      suggestions.push({
        name: `Search Complaints for "${rawVal}"`,
        section: 'Quick ID Search',
        route: `/admin/complaints?search=${encodeURIComponent(rawVal)}`,
        icon: <AlertCircle className="w-4 h-4" />
      });
      suggestions.push({
        name: `Search Providers for "${rawVal}"`,
        section: 'Quick ID Search',
        route: `/admin/providers?search=${encodeURIComponent(rawVal)}`,
        icon: <Users className="w-4 h-4" />
      });
      suggestions.push({
        name: `Search Transactions for "${rawVal}"`,
        section: 'Quick ID Search',
        route: `/admin/transactions?search=${encodeURIComponent(rawVal)}`,
        icon: <Activity className="w-4 h-4" />
      });
    }

    // Traverse navigation definition
    menuGroups.forEach(group => {
      group.items.forEach(item => {
        const pageName = item.name;
        const section = group.title;
        const route = item.path;
        const icon = item.icon;

        // Base match
        if (pageName.toLowerCase().includes(cleanQuery) || section.toLowerCase().includes(cleanQuery)) {
          suggestions.push({
            name: pageName,
            section: section,
            route: route,
            icon: icon
          });
        }

        // Sub-page matches (as requested in Step 5: provider, booking, refund)
        if (cleanQuery.includes('provider') || 'provider'.includes(cleanQuery)) {
          if (pageName === 'Approved Providers' && !suggestions.some(s => s.name === 'Provider Verification')) {
            suggestions.push({ name: 'Provider Verification', section: 'User Management', route: '/admin/approve-providers', icon });
          }
          if (pageName === 'Pending Providers' && !suggestions.some(s => s.name === 'Provider Management')) {
            suggestions.push({ name: 'Provider Management', section: 'User Management', route: '/admin/providers', icon });
          }
          if (pageName === 'Payout' && !suggestions.some(s => s.name === 'Provider Wallet')) {
            suggestions.push({ name: 'Provider Wallet', section: 'Financials & Offers', route: '/admin/payout', icon });
          }
          if (pageName === 'Complaint' && !suggestions.some(s => s.name === 'Provider Complaints')) {
            suggestions.push({ name: 'Provider Complaints', section: 'Support & Interaction', route: '/admin/complaints', icon });
          }
          if (pageName === 'Earning Reports' && !suggestions.some(s => s.name === 'Provider Earnings')) {
            suggestions.push({ name: 'Provider Earnings', section: 'Financials & Offers', route: '/admin/earning-reports', icon });
          }
        }

        if (cleanQuery.includes('booking') || 'booking'.includes(cleanQuery)) {
          if (pageName === 'Bookings') {
            if (!suggestions.some(s => s.name === 'Pending Bookings')) {
              suggestions.push({ name: 'Pending Bookings', section: 'Bookings & Zones', route: '/admin/bookings?status=pending', icon });
            }
            if (!suggestions.some(s => s.name === 'Completed Bookings')) {
              suggestions.push({ name: 'Completed Bookings', section: 'Bookings & Zones', route: '/admin/bookings?status=completed', icon });
            }
            if (!suggestions.some(s => s.name === 'Cancelled Bookings')) {
              suggestions.push({ name: 'Cancelled Bookings', section: 'Bookings & Zones', route: '/admin/bookings?status=cancelled', icon });
            }
          }
        }

        if (cleanQuery.includes('refund') || 'refund'.includes(cleanQuery)) {
          if (pageName === 'Refunds' && !suggestions.some(s => s.name === 'Refund Management')) {
            suggestions.push({ name: 'Refund Management', section: 'Financials & Offers', route: '/admin/refunds', icon });
            suggestions.push({ name: 'Refund Ledger', section: 'Financials & Offers', route: '/admin/refunds', icon });
          }
          if (pageName === 'Transactions' && !suggestions.some(s => s.name === 'Escrow')) {
            suggestions.push({ name: 'Escrow', section: 'Financials & Offers', route: '/admin/transactions', icon });
          }
        }
      });
    });

    // Deduplicate suggestions by name + route
    const unique = [];
    const seen = new Set();
    suggestions.forEach(s => {
      const key = `${s.name}-${s.route}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    });

    return unique.slice(0, 10);
  };

  const suggestionsList = isGlobal ? getFilteredSuggestions() : [];

  const handleSelectSuggestion = (suggestion) => {
    setIsOpen(false);
    setLocalQuery('');
    navigate(suggestion.route);
    inputRef.current?.blur();
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!isGlobal) return;

    if (activeIndex >= 0 && activeIndex < suggestionsList.length) {
      handleSelectSuggestion(suggestionsList[activeIndex]);
      return;
    }

    const cleanQuery = localQuery.trim();
    if (cleanQuery) {
      const lowerQuery = cleanQuery.toLowerCase();
      // If we submit the search directly (by pressing Enter) and it looks like an ID, route directly to the corresponding page
      if (lowerQuery.startsWith('bk-') || /^[a-z]{2,3}-\d{4}-[a-z0-9]+$/i.test(lowerQuery)) {
        navigate(`/admin/bookings?search=${encodeURIComponent(cleanQuery)}`);
      } else if (lowerQuery.startsWith('comp-') || lowerQuery.startsWith('cp-')) {
        navigate(`/admin/complaints?search=${encodeURIComponent(cleanQuery)}`);
      } else if (lowerQuery.startsWith('prov-')) {
        navigate(`/admin/approve-providers?search=${encodeURIComponent(cleanQuery)}`);
      } else if (lowerQuery.startsWith('txn-') || lowerQuery.startsWith('pay_') || lowerQuery.startsWith('order_')) {
        navigate(`/admin/transactions?search=${encodeURIComponent(cleanQuery)}`);
      } else {
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/admin')) {
          navigate(`${currentPath}?search=${encodeURIComponent(cleanQuery)}`);
        } else {
          navigate(`/admin/bookings?search=${encodeURIComponent(cleanQuery)}`);
        }
      }
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleKeyDown = (e) => {
    if (!isGlobal || !isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1 < suggestionsList.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 >= 0 ? prev - 1 : suggestionsList.length - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form onSubmit={handleSearchSubmit} className="relative w-full">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center pointer-events-none z-10">
          {loading ? (
            <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-gray-400 animate-spin" />
          ) : (
            <Icon className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => isGlobal && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-10 py-2 md:py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50 focus:bg-white text-secondary placeholder-gray-400 text-xs transition-all disabled:opacity-50 font-inter shadow-sm"
          {...restProps}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-secondary focus:outline-none transition-colors z-10"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        )}
      </form>

      {/* Suggestion Dropdown */}
      {isGlobal && isOpen && query.trim() && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl z-[999] overflow-hidden max-h-[420px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
          {suggestionsList.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500 font-inter">
              No matching pages, providers, or settings found.
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {suggestionsList.map((suggestion, idx) => {
                const isHovered = activeIndex === idx;
                return (
                  <button
                    key={`${suggestion.name}-${suggestion.route}-${idx}`}
                    onClick={() => handleSelectSuggestion(suggestion)}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${
                      isHovered ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {suggestion.icon && <span className="text-gray-400">{suggestion.icon}</span>}
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold truncate font-inter">{suggestion.name}</span>
                        <span className="text-[10px] text-gray-400 truncate font-inter">{suggestion.section}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSearchBar;
