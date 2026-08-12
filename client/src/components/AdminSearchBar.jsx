import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Loader2,
  ArrowRight,
  Calendar,
  AlertCircle,
  Users,
  Activity,
  Star,
  Briefcase,
  UserCheck,
  CreditCard,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import useDebounce from '../hooks/useDebounce';
import { useAdminFilter } from '../context/AdminFilterContext';
import * as AdminService from '../services/AdminService';

const AdminSearchBar = ({
  value: propValue,
  onChange: propOnChange,
  onSearch: propOnSearch,
  placeholder = 'Search...',
  className = '',
  disabled = false,
  autoFocus = false,
  loading: propLoading = false,
  icon: IconProp,
  onClear: propOnClear,
  menuGroups = [],
  isGlobal = false,
  debounceMs = 350,
  ...restProps
}) => {
  const Icon = IconProp || Search;
  const navigate = useNavigate();
  const location = useLocation();

  // Try consuming AdminFilterContext safely if available
  let filterContext = null;
  try {
    filterContext = useAdminFilter();
  } catch (e) {
    filterContext = null;
  }

  const setSearchQuery = filterContext?.setSearchQuery;
  const setUniversalSearch = filterContext?.setUniversalSearch;

  // Local state
  const [localQuery, setLocalQuery] = useState(propValue || '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState(null);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_recent_searches');
      return saved ? JSON.parse(saved).slice(0, 5) : [];
    } catch {
      return [];
    }
  });

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const loading = propLoading || (isGlobal && isSearchingGlobal);

  // Sync global search with URL query param if present
  useEffect(() => {
    if (isGlobal) {
      try {
        const urlParams = new URLSearchParams(location.search);
        const urlSearch = urlParams.get('search');
        if (urlSearch !== null && urlSearch !== localQuery) {
          setLocalQuery(urlSearch);
        }
      } catch {}
    }
  }, [isGlobal, location.search]);

  // Keep local query in sync with propValue when in controlled non-global mode
  useEffect(() => {
    if (!isGlobal && propValue !== undefined && propValue !== localQuery) {
      setLocalQuery(propValue);
    }
  }, [propValue, isGlobal]);

  const query = isGlobal ? localQuery : (propValue !== undefined ? propValue : localQuery);

  // Integrated useDebounce hook
  const debouncedQuery = useDebounce(query, debounceMs);

  // Save recent search
  const saveRecentSearch = (text, route = null) => {
    if (!text || text.trim().length < 2) return;
    try {
      const trimmed = text.trim();
      const updated = [{ text: trimmed, route, time: Date.now() }, ...recentSearches.filter(s => s.text !== trimmed)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('admin_recent_searches', JSON.stringify(updated));
    } catch { }
  };

  const removeRecentSearch = (e, textToRemove) => {
    e.stopPropagation();
    try {
      const updated = recentSearches.filter(s => s.text !== textToRemove);
      setRecentSearches(updated);
      localStorage.setItem('admin_recent_searches', JSON.stringify(updated));
    } catch { }
  };

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

  // Reset active index when query or results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [query, globalSearchResults]);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Execute Global Backend Search
  const fetchGlobalSearch = useCallback(async (searchStr) => {
    const cleanStr = (searchStr || '').trim();
    if (!cleanStr || cleanStr.length < 2) {
      // Check for quick ID pattern
      const isKnownId = /^(bk|pay|txn|prov|comp|cp|ref|wd|set|inv)[-_]/i.test(cleanStr);
      if (!isKnownId) {
        setGlobalSearchResults(null);
        setIsSearchingGlobal(false);
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearchingGlobal(true);
    try {
      const response = await AdminService.globalAdminSearch(
        { search: cleanStr, limitPerType: 5 },
        { signal: abortControllerRef.current.signal }
      );
      if (response?.data?.success) {
        setGlobalSearchResults(response.data);
      } else {
        setGlobalSearchResults(null);
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('Global search error:', err);
        setGlobalSearchResults(null);
      }
    } finally {
      setIsSearchingGlobal(false);
    }
  }, []);

  // React to debounced query changes using useDebounce hook
  useEffect(() => {
    if (isGlobal) {
      if (setSearchQuery) setSearchQuery(debouncedQuery);
      if (setUniversalSearch) setUniversalSearch(debouncedQuery);
      if (propOnSearch) propOnSearch(debouncedQuery);
      fetchGlobalSearch(debouncedQuery);
    } else {
      if (propOnSearch) {
        propOnSearch(debouncedQuery);
      }
    }
  }, [debouncedQuery, isGlobal, fetchGlobalSearch, propOnSearch, setSearchQuery, setUniversalSearch]);

  const handleClear = (e) => {
    if (e) e.preventDefault();
    setLocalQuery('');
    setActiveIndex(-1);
    setGlobalSearchResults(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (isGlobal) {
      if (setSearchQuery) setSearchQuery('');
      if (setUniversalSearch) setUniversalSearch('');
      try {
        const currentSearchParams = new URLSearchParams(window.location.search);
        if (currentSearchParams.has('search')) {
          currentSearchParams.delete('search');
          const qs = currentSearchParams.toString();
          navigate(qs ? `${window.location.pathname}?${qs}` : window.location.pathname, { replace: true });
        }
      } catch {}
      inputRef.current?.focus();
    }

    if (propOnClear) {
      propOnClear();
    } else if (propOnChange) {
      propOnChange({ target: { value: '' } });
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setLocalQuery(val);

    if (isGlobal) {
      setIsOpen(true);
    } else {
      if (propOnChange) {
        propOnChange(e);
      }
    }
  };

  // Build flattened list of items for keyboard navigation and rendering
  const getNavigableItems = () => {
    const items = [];

    // If we have global search results from backend:
    if (isGlobal && globalSearchResults?.results) {
      const res = globalSearchResults.results;

      // 1. Users
      if (res.users?.length > 0) {
        res.users.forEach(u => items.push({
          type: 'user',
          category: 'Users',
          title: u.name,
          subtitle: `${u.email || ''} ${u.phone ? '• ' + u.phone : ''}`,
          badge: u.role || 'Customer',
          route: u.route || `/admin/customers?search=${encodeURIComponent(u.id || u.name)}&openDetail=true`,
          icon: <Users className="w-4 h-4 text-purple-600" />
        }));
      }

      // 2. Providers
      if (res.providers?.length > 0) {
        res.providers.forEach(p => items.push({
          type: 'provider',
          category: 'Providers',
          title: p.name,
          subtitle: `${p.providerId ? p.providerId + ' • ' : ''}${p.phone || p.email || ''}`,
          badge: p.approved ? 'Approved' : 'Pending',
          badgeClass: p.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700',
          route: p.route || `/admin/approve-providers?search=${encodeURIComponent(p.providerId || p.name)}&openDetail=true`,
          icon: <UserCheck className="w-4 h-4 text-teal-600" />
        }));
      }

      // 3. Bookings
      if (res.bookings?.length > 0) {
        res.bookings.forEach(b => items.push({
          type: 'booking',
          category: 'Bookings',
          title: `${b.bookingId || 'Booking'}`,
          subtitle: `${b.customerName ? b.customerName + ' • ' : ''}${b.serviceTitle || ''}`,
          badge: b.status || 'pending',
          badgeClass: b.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700',
          route: b.route || `/admin/bookings?search=${encodeURIComponent(b.bookingId || b.id)}&openDetail=true`,
          icon: <Calendar className="w-4 h-4 text-teal-600" />
        }));
      }

      // 4. Payments
      if (res.payments?.length > 0) {
        res.payments.forEach(pay => items.push({
          type: 'payment',
          category: 'Payments',
          title: `${pay.transactionId || pay.id || 'Payment'}`,
          subtitle: `₹${(pay.amount || 0).toLocaleString()} • ${pay.customerName || pay.providerName || ''}`,
          badge: pay.paymentStatus || 'completed',
          badgeClass: 'bg-emerald-100 text-emerald-700',
          route: pay.route || `/admin/transactions?search=${encodeURIComponent(pay.transactionId || pay.id)}&openDetail=true`,
          icon: <Activity className="w-4 h-4 text-emerald-600" />
        }));
      }

      // 5. Withdrawals
      if (res.withdrawals?.length > 0) {
        res.withdrawals.forEach(w => items.push({
          type: 'withdrawal',
          category: 'Withdrawals',
          title: `Withdrawal: ₹${(w.amount || 0).toLocaleString()}`,
          subtitle: `${w.providerName ? w.providerName + ' • ' : ''}${w.utrNo ? 'UTR: ' + w.utrNo : ''}`,
          badge: w.status || 'requested',
          badgeClass: 'bg-amber-100 text-amber-700',
          route: w.route || `/admin/payout?search=${encodeURIComponent(w.utrNo || w.providerName || w.id)}&openDetail=true`,
          icon: <CreditCard className="w-4 h-4 text-amber-600" />
        }));
      }

      // 6. Refunds
      if (res.refunds?.length > 0) {
        res.refunds.forEach(r => items.push({
          type: 'refund',
          category: 'Refunds',
          title: `${r.refundId || 'Refund'}: ₹${(r.refundAmount || 0).toLocaleString()}`,
          subtitle: `${r.customerName ? r.customerName + ' • ' : ''}${r.bookingId ? 'Booking: ' + r.bookingId : ''}`,
          badge: r.status || 'processed',
          badgeClass: 'bg-rose-100 text-rose-700',
          route: r.route || `/admin/refunds?search=${encodeURIComponent(r.refundId || r.id)}&openDetail=true`,
          icon: <AlertCircle className="w-4 h-4 text-rose-600" />
        }));
      }

      // 7. Complaints
      if (res.complaints?.length > 0) {
        res.complaints.forEach(c => items.push({
          type: 'complaint',
          category: 'Complaints',
          title: `${c.complaintId ? c.complaintId + ' - ' : ''}${c.title}`,
          subtitle: `${c.customerName ? c.customerName + ' • ' : ''}${c.bookingId ? 'Booking: ' + c.bookingId : ''}`,
          badge: c.status || 'open',
          badgeClass: 'bg-orange-100 text-orange-700',
          route: c.route || `/admin/complaints?search=${encodeURIComponent(c.complaintId || c.id)}&openDetail=true`,
          icon: <AlertCircle className="w-4 h-4 text-orange-600" />
        }));
      }

      // 8. Feedback
      if (res.feedback?.length > 0) {
        res.feedback.forEach(f => items.push({
          type: 'feedback',
          category: 'Feedback',
          title: `${f.rating ? f.rating + '★ ' : ''}${f.comment || 'Feedback'}`,
          subtitle: `${f.customerName ? f.customerName : ''}`,
          badge: 'Rating',
          route: f.route || `/admin/feedback?search=${encodeURIComponent(f.customerName || '')}`,
          icon: <Star className="w-4 h-4 text-amber-500" />
        }));
      }

      // 9. Services
      if (res.services?.length > 0) {
        res.services.forEach(s => items.push({
          type: 'service',
          category: 'Services',
          title: s.title,
          subtitle: `₹${s.basePrice || 0}${s.duration ? ' • ' + s.duration : ''}`,
          badge: s.isActive ? 'Active' : 'Inactive',
          badgeClass: s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700',
          route: s.route || `/admin/services?search=${encodeURIComponent(s.title)}`,
          icon: <Briefcase className="w-4 h-4 text-indigo-600" />
        }));
      }

      return items;
    }

    // Fallback to menu items & ID recognition suggestions if no backend results loaded yet
    if (query.trim()) {
      const cleanQuery = query.toLowerCase().trim();
      const rawVal = query.trim();

      const isBookingId = cleanQuery.startsWith('bk-') || /^[a-z]{2,3}-\d{4}-[a-z0-9]+$/i.test(cleanQuery);
      const isComplaintId = cleanQuery.startsWith('comp-') || cleanQuery.startsWith('cp-');
      const isProviderId = cleanQuery.startsWith('prov-');
      const isTxnId = cleanQuery.startsWith('txn-') || cleanQuery.startsWith('txn_');
      const isPaymentId = cleanQuery.startsWith('pay_') || cleanQuery.startsWith('order_') || cleanQuery.startsWith('pay-');
      const isRefundId = cleanQuery.startsWith('ref-') || cleanQuery.startsWith('refund_');
      const isSettlementId = cleanQuery.startsWith('set-') || cleanQuery.startsWith('settlement_');
      const isWithdrawalId = cleanQuery.startsWith('wd-') || cleanQuery.startsWith('payout-');

      if (isBookingId) {
        items.push({
          type: 'booking',
          category: 'Quick ID Search',
          title: `Inspect Booking: ${rawVal}`,
          subtitle: 'Direct navigation to booking record',
          route: `/admin/bookings?search=${encodeURIComponent(rawVal)}&openDetail=true`,
          icon: <Calendar className="w-4 h-4 text-teal-600" />
        });
      }
      if (isPaymentId) {
        items.push({
          type: 'payment',
          category: 'Quick ID Search',
          title: `Inspect Payment: ${rawVal}`,
          subtitle: 'Direct navigation to payment record',
          route: `/admin/payments?search=${encodeURIComponent(rawVal)}&openDetail=true`,
          icon: <Activity className="w-4 h-4 text-emerald-600" />
        });
      }
      if (isTxnId) {
        items.push({
          type: 'transaction',
          category: 'Quick ID Search',
          title: `Inspect Transaction: ${rawVal}`,
          subtitle: 'Direct navigation to transaction ledger',
          route: `/admin/transactions?search=${encodeURIComponent(rawVal)}&openDetail=true`,
          icon: <Activity className="w-4 h-4 text-indigo-600" />
        });
      }
      if (isProviderId) {
        items.push({
          type: 'provider',
          category: 'Quick ID Search',
          title: `Inspect Provider: ${rawVal}`,
          subtitle: 'Direct navigation to provider details',
          route: `/admin/approve-providers?search=${encodeURIComponent(rawVal)}&openDetail=true`,
          icon: <UserCheck className="w-4 h-4 text-teal-600" />
        });
      }
      if (isRefundId) {
        items.push({
          type: 'refund',
          category: 'Quick ID Search',
          title: `Inspect Refund: ${rawVal}`,
          subtitle: 'Direct navigation to refund ledger',
          route: `/admin/refunds?search=${encodeURIComponent(rawVal)}&openDetail=true`,
          icon: <AlertCircle className="w-4 h-4 text-rose-600" />
        });
      }
      if (isComplaintId) {
        items.push({
          type: 'complaint',
          category: 'Quick ID Search',
          title: `Inspect Complaint: ${rawVal}`,
          subtitle: 'Direct navigation to complaint resolution',
          route: `/admin/complaints?search=${encodeURIComponent(rawVal)}&openDetail=true`,
          icon: <AlertCircle className="w-4 h-4 text-orange-600" />
        });
      }
      if (isWithdrawalId) {
        items.push({
          type: 'withdrawal',
          category: 'Quick ID Search',
          title: `Inspect Payout: ${rawVal}`,
          subtitle: 'Direct navigation to withdrawal request',
          route: `/admin/payout?search=${encodeURIComponent(rawVal)}&openDetail=true`,
          icon: <CreditCard className="w-4 h-4 text-amber-600" />
        });
      }

      // Menu suggestions
      menuGroups.forEach(group => {
        group.items?.forEach(item => {
          if (item.name.toLowerCase().includes(cleanQuery) || group.title.toLowerCase().includes(cleanQuery)) {
            items.push({
              type: 'page',
              category: group.title,
              title: item.name,
              subtitle: `Navigate to ${group.title} → ${item.name}`,
              route: item.path,
              icon: item.icon || <ExternalLink className="w-4 h-4 text-gray-400" />
            });
          }
        });
      });
    }

    return items;
  };

  const navigableItems = getNavigableItems();

  // Group items by category for grouped rendering
  const groupedSections = navigableItems.reduce((acc, item) => {
    const cat = item.category || 'Results';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const handleSelectItem = (item) => {
    if (!item || !item.route) return;
    saveRecentSearch(item.title || query, item.route);
    setIsOpen(false);
    setLocalQuery('');
    setGlobalSearchResults(null);
    navigate(item.route);
    inputRef.current?.blur();
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();

    if (activeIndex >= 0 && activeIndex < navigableItems.length) {
      handleSelectItem(navigableItems[activeIndex]);
      return;
    }

    const cleanQuery = query.trim();
    if (propOnSearch) {
      propOnSearch(cleanQuery);
    }

    if (!isGlobal) return;

    if (cleanQuery) {
      saveRecentSearch(cleanQuery);
      const lowerQuery = cleanQuery.toLowerCase();
      // If direct enter and matches ID pattern, route directly
      if (lowerQuery.startsWith('bk-') || /^[a-z]{2,3}-\d{4}-[a-z0-9]+$/i.test(lowerQuery)) {
        navigate(`/admin/bookings?search=${encodeURIComponent(cleanQuery)}`);
      } else if (lowerQuery.startsWith('comp-') || lowerQuery.startsWith('cp-')) {
        navigate(`/admin/complaints?search=${encodeURIComponent(cleanQuery)}`);
      } else if (lowerQuery.startsWith('prov-')) {
        navigate(`/admin/approve-providers?search=${encodeURIComponent(cleanQuery)}`);
      } else if (lowerQuery.startsWith('txn-') || lowerQuery.startsWith('pay_') || lowerQuery.startsWith('order_')) {
        navigate(`/admin/transactions?search=${encodeURIComponent(cleanQuery)}`);
      } else if (navigableItems.length > 0) {
        handleSelectItem(navigableItems[0]);
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
      setActiveIndex(prev => (prev + 1 < navigableItems.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 >= 0 ? prev - 1 : navigableItems.length - 1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form onSubmit={handleSearchSubmit} className="relative w-full">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center pointer-events-none z-10">
          {loading ? (
            <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-primary animate-spin" />
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
            title="Clear search"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        )}
      </form>

      {/* Suggestion & Global Cross-Module Results Dropdown */}
      {isGlobal && isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[999] overflow-hidden max-h-[460px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-gray-100">
          {/* Loading state indicator */}
          {loading && (
            <div className="p-3 bg-teal-50/50 flex items-center justify-center gap-2 text-xs font-semibold text-primary">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Searching cross-page admin modules...
            </div>
          )}

          {/* Empty Query State: Recent Searches */}
          {!query.trim() && (
            <div className="p-3">
              {recentSearches.length > 0 ? (
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2 flex items-center justify-between">
                    <span>Recent Searches</span>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((s, idx) => (
                      <div
                        key={`${s.text}-${idx}`}
                        onClick={() => {
                          setLocalQuery(s.text);
                          fetchGlobalSearch(s.text);
                          if (s.route) navigate(s.route);
                        }}
                        className="group flex items-center justify-between px-3 py-2 rounded-xl text-xs text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary" />
                          <span className="font-medium font-inter">{s.text}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(e, s.text)}
                          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-gray-400 font-inter">
                  Type to search across Users, Providers, Bookings, Payments, Withdrawals, Complaints, and Services...
                </div>
              )}
            </div>
          )}

          {/* Query has text, but 0 items found */}
          {query.trim() && !loading && navigableItems.length === 0 && (
            <div className="p-6 text-center text-xs text-gray-500 font-inter">
              <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">No cross-module results found for "{query.trim()}"</p>
              <p className="text-[11px] text-gray-400 mt-1">Try searching by full name, phone number, booking ID, or address.</p>
            </div>
          )}

          {/* Grouped Entity Results */}
          {query.trim() && Object.keys(groupedSections).map((category) => {
            const sectionItems = groupedSections[category];
            if (!sectionItems || sectionItems.length === 0) return null;

            return (
              <div key={category} className="p-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                  <span>{category}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[9px] font-bold">
                    {sectionItems.length}
                  </span>
                </div>
                <div className="space-y-0.5 mt-1">
                  {sectionItems.map((item) => {
                    const globalIdx = navigableItems.indexOf(item);
                    const isHovered = activeIndex === globalIdx;

                    return (
                      <button
                        key={`${item.category}-${item.title}-${item.route}-${globalIdx}`}
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-colors ${isHovered ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold truncate font-inter text-secondary">{item.title}</span>
                              {item.badge && (
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md ${item.badgeClass || 'bg-gray-100 text-gray-600'
                                  }`}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <span className="text-[11px] text-gray-400 truncate font-inter">{item.subtitle}</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 opacity-50 flex-shrink-0 ml-2" />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Footer: View all results */}
          {query.trim() && navigableItems.length > 0 && (
            <div className="p-2.5 bg-gray-50/80 flex items-center justify-between border-t border-gray-100">
              <span className="text-[11px] text-gray-500 font-inter">
                Found {globalSearchResults?.total || navigableItems.length} matching records across all modules
              </span>
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="text-xs font-bold text-primary hover:text-teal-700 flex items-center gap-1 transition-colors"
              >
                <span>View all results</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSearchBar;
