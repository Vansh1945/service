import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as BookingService from '../services/BookingService';
import * as ZoneService from '../services/ZoneService';
import * as AdminService from '../services/AdminService';
import { useAuth } from './auth';

const AdminFilterContext = createContext();

export const AdminFilterProvider = ({ children }) => {
  const { isAuthenticated, role } = useAuth();
  const isAdmin = isAuthenticated && role === 'admin';

  const [filterType, setFilterType] = useState('calendar'); // 'calendar' | 'financial'
  const [year, setYear] = useState(new Date().getFullYear());
  const [financialYear, setFinancialYear] = useState(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed
    if (currentMonth >= 4) {
      return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    } else {
      return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    }
  });
  const [month, setMonth] = useState(''); // '' means all
  const [quarter, setQuarter] = useState(''); // '' means all
  const [zoneIds, setZoneIds] = useState([]);
  const [zones, setZones] = useState([]);
  const [earliestYear, setEarliestYear] = useState(2024);
  const [showGlobalFilterBar, setShowGlobalFilterBar] = useState(false);

  // Fetch earliest year from bookings & load zones list
  useEffect(() => {
    if (!isAdmin) return;

    const fetchMetadata = async () => {
      try {
        const [bookingsRes, zonesRes] = await Promise.all([
          BookingService.getAllBookings({ limit: 1, sortBy: 'date:asc' }),
          ZoneService.getAllZones()
        ]);

        if (bookingsRes?.data?.success && bookingsRes?.data?.data?.length > 0) {
          const earliestDate = new Date(bookingsRes.data.data[0].date);
          const earliestYr = earliestDate.getFullYear();
          if (earliestYr && earliestYr >= 2000 && earliestYr <= new Date().getFullYear()) {
            setEarliestYear(earliestYr);
          }
        }

        if (zonesRes?.data?.success) {
          setZones(zonesRes.data.data || zonesRes.data.zones || []);
        }
      } catch (err) {
        console.error('Failed to fetch filter metadata:', err);
      }
    };

    fetchMetadata();
  }, [isAdmin]);

  // Compute startDate and endDate based on active global filters
  const getComputedDateRange = useCallback(() => {
    let startYear, endYear;

    if (filterType === 'financial') {
      const parts = financialYear.split('-');
      startYear = parseInt(parts[0], 10);
      endYear = startYear + 1;
    } else {
      startYear = year;
      endYear = year;
    }

    let start = new Date(startYear, 0, 1);
    let end = new Date(endYear, 11, 31);

    if (filterType === 'financial') {
      // Financial Year starts April 1st and ends March 31st
      start = new Date(startYear, 3, 1); // April 1
      end = new Date(endYear, 2, 31); // March 31
    }

    // Apply quarter restrictions if present
    if (quarter) {
      if (filterType === 'financial') {
        switch (quarter) {
          case 'Q1': // Apr - Jun
            start = new Date(startYear, 3, 1);
            end = new Date(startYear, 5, 30);
            break;
          case 'Q2': // Jul - Sep
            start = new Date(startYear, 6, 1);
            end = new Date(startYear, 8, 30);
            break;
          case 'Q3': // Oct - Dec
            start = new Date(startYear, 9, 1);
            end = new Date(startYear, 11, 31);
            break;
          case 'Q4': // Jan - Mar
            start = new Date(endYear, 0, 1);
            end = new Date(endYear, 2, 31);
            break;
          default:
            break;
        }
      } else {
        switch (quarter) {
          case 'Q1': // Jan - Mar
            start = new Date(startYear, 0, 1);
            end = new Date(startYear, 2, 31);
            break;
          case 'Q2': // Apr - Jun
            start = new Date(startYear, 3, 1);
            end = new Date(startYear, 5, 30);
            break;
          case 'Q3': // Jul - Sep
            start = new Date(startYear, 6, 1);
            end = new Date(startYear, 8, 30);
            break;
          case 'Q4': // Oct - Dec
            start = new Date(startYear, 9, 1);
            end = new Date(startYear, 11, 31);
            break;
          default:
            break;
        }
      }
    }

    // Apply month restrictions if present (month overrides quarter)
    if (month) {
      const monthIndex = parseInt(month, 10) - 1; // 0-indexed month
      let targetYear = startYear;

      if (filterType === 'financial') {
        // Months Jan (0), Feb (1), Mar (2) belong to endYear
        if (monthIndex < 3) {
          targetYear = endYear;
        }
      }

      start = new Date(targetYear, monthIndex, 1);
      end = new Date(targetYear, monthIndex + 1, 0); // Last day of month
    }

    // Format dates to YYYY-MM-DD
    const formatDate = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    return {
      startDate: formatDate(start),
      endDate: formatDate(end),
      fromDate: formatDate(start),
      toDate: formatDate(end)
    };
  }, [filterType, year, financialYear, month, quarter]);

  // Global Search State across finance console
  const [searchQuery, setSearchQuery] = useState('');

  // Finance Filter States
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [bookingStatus, setBookingStatus] = useState('all');
  const [transactionType, setTransactionType] = useState('all');
  const [refundStatus, setRefundStatus] = useState('all');
  const [gatewayStatus, setGatewayStatus] = useState('all');
  const [settlementStatus, setSettlementStatus] = useState('all');

  // Investigation Side-Drawer State
  const [drawerConfig, setDrawerConfig] = useState({
    isOpen: false,
    entityType: null, // 'booking' | 'payment' | 'transaction' | 'refund' | 'complaint' | 'provider' | 'customer' | 'wallet' | 'settlement' | 'razorpay'
    entityId: null,
    entityData: null,
  });

  const [drawerHistory, setDrawerHistory] = useState([]);

  const openInvestigationDrawer = useCallback((entityType, entityId, initialData = null) => {
    if (!entityId && !initialData) return;
    setDrawerConfig((prev) => {
      if (prev.isOpen && prev.entityId) {
        setDrawerHistory((hist) => [...hist, { entityType: prev.entityType, entityId: prev.entityId, entityData: prev.entityData }]);
      } else {
        setDrawerHistory([]);
      }
      return {
        isOpen: true,
        entityType,
        entityId: entityId || initialData?._id || initialData?.id || initialData?.bookingId,
        entityData: initialData
      };
    });
  }, []);

  const closeInvestigationDrawer = useCallback(() => {
    setDrawerConfig({
      isOpen: false,
      entityType: null,
      entityId: null,
      entityData: null
    });
    setDrawerHistory([]);
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('openDetail')) {
        params.delete('openDetail');
        const qs = params.toString();
        const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    } catch {}
  }, []);

  const popDrawerHistory = useCallback(() => {
    setDrawerHistory((prev) => {
      if (prev.length === 0) {
        closeInvestigationDrawer();
        return [];
      }
      const last = prev[prev.length - 1];
      const updated = prev.slice(0, prev.length - 1);
      setDrawerConfig({
        isOpen: true,
        entityType: last.entityType,
        entityId: last.entityId,
        entityData: last.entityData
      });
      return updated;
    });
  }, [closeInvestigationDrawer]);

  // ─────────────────────────────────────────────────────────────────────────────
  // UNIVERSAL ADVANCED SEARCH & FILTER ENGINE STATE
  // ─────────────────────────────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState('providers');
  const [universalSearch, setUniversalSearch] = useState('');
  const [universalFilters, setUniversalFilters] = useState({});
  const [universalPagination, setUniversalPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [universalResults, setUniversalResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  // AbortController ref to cancel previous in-flight requests
  const searchAbortControllerRef = useRef(null);

  const executeUniversalSearch = useCallback(async ({
    module: targetModule = activeModule,
    search = universalSearch,
    filters = universalFilters,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = {}) => {
    if (!isAdmin) return;

    // Abort previous in-flight request
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }
    searchAbortControllerRef.current = new AbortController();

    setIsSearching(true);
    setSearchError(null);

    try {
      // Merge date range filters from global calendar/financial controls
      const dateRange = getComputedDateRange();
      const mergedFilters = {
        ...dateRange,
        ...(zoneIds.length > 0 && { zoneId: zoneIds[0], zoneIds: zoneIds.join(',') }),
        ...filters
      };

      const payload = {
        module: targetModule,
        search: typeof search === 'string' ? search.trim() : '',
        filters: mergedFilters,
        page,
        limit,
        sortBy,
        sortOrder
      };

      const response = await AdminService.universalAdminSearch(payload, {
        signal: searchAbortControllerRef.current.signal
      });

      if (response?.data?.success) {
        setUniversalResults(response.data.data || []);
        if (response.data.pagination) {
          setUniversalPagination(response.data.pagination);
        }
      } else {
        setUniversalResults([]);
        setSearchError(response?.data?.message || 'Search failed');
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('Universal Search Error:', err);
        setSearchError(err.response?.data?.message || err.message || 'Error executing search');
        setUniversalResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, [isAdmin, activeModule, universalSearch, universalFilters, getComputedDateRange, zoneIds]);

  const resetUniversalSearch = useCallback(() => {
    setUniversalSearch('');
    setUniversalFilters({});
    setUniversalPagination({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1
    });
    setUniversalResults([]);
    setSearchError(null);
  }, []);

  const resetGlobalFilters = useCallback(() => {
    setFilterType('calendar');
    setYear(new Date().getFullYear());
    setMonth('');
    setQuarter('');
    setZoneIds([]);
    setSearchQuery('');
    setPaymentMethod('all');
    setBookingStatus('all');
    setTransactionType('all');
    setRefundStatus('all');
    setGatewayStatus('all');
    setSettlementStatus('all');
    resetUniversalSearch();
  }, [resetUniversalSearch]);

  const refresh = useCallback(async (fetchFn, setLoader) => {
    if (!fetchFn) return;
    if (setLoader) setLoader(true);
    try {
      await fetchFn();
    } catch (err) {
      console.error('Refresh action failed:', err);
    } finally {
      if (setLoader) setLoader(false);
    }
  }, []);

  const reset = useCallback(async (resetLocalFiltersFn, fetchFn) => {
    resetGlobalFilters();
    if (resetLocalFiltersFn) {
      resetLocalFiltersFn();
    }
    if (fetchFn) {
      setTimeout(() => {
        fetchFn();
      }, 0);
    }
  }, [resetGlobalFilters]);

  const getMergedQuery = useCallback((localFilters = {}) => {
    const dates = getComputedDateRange();
    
    // Clean local filters of null, undefined, or empty string values to prevent overwriting global filters
    const cleanedLocal = {};
    Object.keys(localFilters).forEach(key => {
      const val = localFilters[key];
      if (val !== null && val !== undefined && val !== '') {
        cleanedLocal[key] = val;
      }
    });

    const query = {
      ...dates,
      ...(zoneIds.length > 0 && { zoneIds: zoneIds.join(',') }),
      ...(searchQuery && { search: searchQuery, bookingId: searchQuery }),
      ...(paymentMethod !== 'all' && { paymentMethod }),
      ...(bookingStatus !== 'all' && { status: bookingStatus }),
      ...(transactionType !== 'all' && { type: transactionType }),
      ...(refundStatus !== 'all' && { refundStatus }),
      ...(gatewayStatus !== 'all' && { gatewayStatus }),
      ...(settlementStatus !== 'all' && { settlementStatus }),
      ...cleanedLocal
    };
    return query;
  }, [getComputedDateRange, zoneIds, searchQuery, paymentMethod, bookingStatus, transactionType, refundStatus, gatewayStatus, settlementStatus]);

  const getEntityRoute = useCallback((entityType, id) => {
    if (!id) return '/admin/dashboard';
    const cleanId = String(id).trim();
    const type = (entityType || '').toLowerCase();

    switch (type) {
      case 'booking':
        return `/admin/bookings?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'payment':
      case 'razorpay_payment':
      case 'gateway_payment':
        return `/admin/payments?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'transaction':
      case 'ledger':
        return `/admin/transactions?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'refund':
        return `/admin/refunds?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'complaint':
        return `/admin/complaints?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'settlement':
        return `/admin/settlements?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'withdrawal':
      case 'payout':
        return `/admin/payout?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'customer_wallet':
        return `/admin/customer-wallets?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'provider_wallet':
        return `/admin/provider-wallets?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'wallet':
        return `/admin/customer-wallets?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'customer':
      case 'user':
        return `/admin/customers?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'provider':
        return `/admin/approve-providers?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'audit':
      case 'audit_log':
        return `/admin/audit-logs?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'fraud':
        return `/admin/fraud?search=${encodeURIComponent(cleanId)}&openDetail=true`;
      case 'service':
        return `/admin/add-services?search=${encodeURIComponent(cleanId)}`;
      case 'feedback':
        return `/admin/feedback?search=${encodeURIComponent(cleanId)}`;
      default:
        return `/admin/bookings?search=${encodeURIComponent(cleanId)}&openDetail=true`;
    }
  }, []);

  return (
    <AdminFilterContext.Provider
      value={{
        filterType,
        setFilterType,
        year,
        setYear,
        financialYear,
        setFinancialYear,
        month,
        setMonth,
        quarter,
        setQuarter,
        zoneIds,
        setZoneIds,
        zones,
        earliestYear,
        searchQuery,
        setSearchQuery,
        paymentMethod,
        setPaymentMethod,
        bookingStatus,
        setBookingStatus,
        transactionType,
        setTransactionType,
        refundStatus,
        setRefundStatus,
        gatewayStatus,
        setGatewayStatus,
        settlementStatus,
        setSettlementStatus,
        drawerConfig,
        drawerHistory,
        openInvestigationDrawer,
        closeInvestigationDrawer,
        popDrawerHistory,
        getComputedDateRange,
        resetGlobalFilters,
        getMergedQuery,
        getEntityRoute,
        showGlobalFilterBar,
        setShowGlobalFilterBar,
        refresh,
        reset,

        // Universal Search & Filter Extensions
        activeModule,
        setActiveModule,
        universalSearch,
        setUniversalSearch,
        universalFilters,
        setUniversalFilters,
        universalPagination,
        setUniversalPagination,
        universalResults,
        setUniversalResults,
        isSearching,
        searchError,
        executeUniversalSearch,
        resetUniversalSearch
      }}
    >
      {children}
    </AdminFilterContext.Provider>
  );
};

export const useAdminFilter = () => {
  const context = useContext(AdminFilterContext);
  if (!context) {
    throw new Error('useAdminFilter must be used within an AdminFilterProvider');
  }
  return context;
};

export default AdminFilterContext;
