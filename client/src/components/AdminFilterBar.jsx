import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAdminFilter } from '../context/AdminFilterContext';
import HierarchicalZoneSelector from './HierarchicalZoneSelector';
import AdminSearchBar from './AdminSearchBar';
import {
  FiCalendar,
  FiRefreshCw,
  FiFilter,
  FiX,
  FiSliders,
  FiCreditCard,
  FiActivity,
  FiCheckCircle
} from 'react-icons/fi';

// Configuration of which routes display the shared AdminFilterBar and which fields they support
const ROUTE_CONFIGS = {
  // Dashboard & Analytics
  '/admin': { show: true, type: 'analytics', title: 'Global Analytics Filters' },
  '/admin/dashboard': { show: true, type: 'analytics', title: 'Global Analytics Filters' },
  '/admin/live-map': { show: true, type: 'analytics', title: 'Live Map Tracking Filters' },

  // Bookings
  '/admin/bookings': { show: true, type: 'bookings', title: 'Global Booking Filters', hasBookingStatus: true },

  // Marketing
  '/admin/coupons': { show: true, type: 'coupons', title: 'Coupon Analytics Filters' },

  // Financials & Operations
  '/admin/finance-dashboard': { show: true, type: 'finance', title: 'Finance Overview Filters', hasFinanceFields: true },
  '/admin/payments': { show: true, type: 'finance', title: 'Payment Management Filters', hasFinanceFields: true, hasPaymentMethod: true, hasBookingStatus: true },
  '/admin/transactions': { show: true, type: 'finance', title: 'Transaction Ledger Filters', hasFinanceFields: true, hasTransactionType: true, hasPaymentMethod: true },
  '/admin/refunds': { show: true, type: 'finance', title: 'Refund Ledger Filters', hasFinanceFields: true, hasRefundStatus: true, hasPaymentMethod: true },
  '/admin/cash-payments': { show: true, type: 'finance', title: 'Cash Payment Filters', hasFinanceFields: true },
  '/admin/customer-wallets': { show: true, type: 'finance', title: 'Customer Wallet Filters', hasFinanceFields: true },
  '/admin/provider-wallets': { show: true, type: 'finance', title: 'Provider Wallet Filters', hasFinanceFields: true },
  '/admin/provider-earnings': { show: true, type: 'finance', title: 'Provider Earnings Filters', hasFinanceFields: true },
  '/admin/payout': { show: true, type: 'finance', title: 'Payout & Withdrawal Filters', hasFinanceFields: true },
  '/admin/settlements': { show: true, type: 'finance', title: 'Settlement Filters', hasFinanceFields: true },
  '/admin/commission': { show: true, type: 'finance', title: 'Commission Policy Filters', hasFinanceFields: true },
  '/admin/commision': { show: true, type: 'finance', title: 'Commission Policy Filters', hasFinanceFields: true },
  '/admin/razorpay': { show: true, type: 'finance', title: 'Razorpay Gateway Filters', hasFinanceFields: true, hasPaymentMethod: true },
  '/admin/failed-payments': { show: true, type: 'finance', title: 'Failed Payments Filters', hasFinanceFields: true, hasPaymentMethod: true },
  '/admin/earning-reports': { show: true, type: 'finance', title: 'Financial Reports Filters', hasFinanceFields: true },
  '/admin/audit-logs': { show: true, type: 'finance', title: 'Audit Log Filters', hasFinanceFields: true },
  '/admin/fraud': { show: true, type: 'finance', title: 'Fraud Analytics Filters', hasFinanceFields: true }
};

export const getRouteFilterConfig = (pathname) => {
  if (!pathname) return null;
  const cleanPath = pathname.toLowerCase().replace(/\/$/, '');

  if (ROUTE_CONFIGS[cleanPath]) {
    return ROUTE_CONFIGS[cleanPath];
  }

  // Support /admin/finance/* subroutes
  if (cleanPath.startsWith('/admin/finance')) {
    return {
      show: true,
      type: 'finance',
      title: 'Finance Global Filters',
      hasFinanceFields: true
    };
  }

  // All other pages (customers, providers, services, complaints, feedback, contacts, settings, branding, templates)
  // use their own local table filter bar (AdminLocalFilterBar) and should NOT render global finance/date controls.
  return null;
};

const AdminFilterBar = ({ onApply, className = '' }) => {
  const location = useLocation();
  const config = getRouteFilterConfig(location.pathname);

  const {
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
    resetGlobalFilters,
    paymentMethod,
    setPaymentMethod,
    bookingStatus,
    setBookingStatus,
    transactionType,
    setTransactionType,
    refundStatus,
    setRefundStatus,
    showGlobalFilterBar,
    reset
  } = useAdminFilter();

  // If current route does not require global filter bar, or is toggled hidden, render nothing
  if (!config || !config.show || !showGlobalFilterBar) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  // Safe earliest year calculation: guarantees at least 4-5 years selectable even if DB returns no earlier date
  const safeEarliestYear = Math.min(earliestYear || (currentYear - 3), currentYear - 3, 2022);

  // Generate Calendar Year options
  const calendarYears = [];
  for (let y = currentYear; y >= safeEarliestYear; y--) {
    calendarYears.push(y);
  }

  // Generate Financial Year options (e.g. 2026-27, 2025-26, 2024-25, 2023-24)
  const financialYears = [];
  for (let y = currentYear; y >= safeEarliestYear; y--) {
    const nextYr = (y + 1).toString().slice(-2);
    financialYears.push(`${y}-${nextYr}`);
  }

  const months = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const quarters = [
    { value: '', label: 'All Quarters' },
    { value: 'Q1', label: 'Q1' },
    { value: 'Q2', label: 'Q2' },
    { value: 'Q3', label: 'Q3' },
    { value: 'Q4', label: 'Q4' }
  ];

  const paymentMethods = [
    { value: 'all', label: 'All Methods' },
    { value: 'cash', label: 'Cash' },
    { value: 'online', label: 'Online (Razorpay)' },
    { value: 'wallet', label: 'Wallet' },
    { value: 'card', label: 'Card' },
    { value: 'upi', label: 'UPI' },
    { value: 'netbanking', label: 'Net Banking' }
  ];

  const bookingStatuses = [
    { value: 'all', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const transactionTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'payment', label: 'Payment' },
    { value: 'refund', label: 'Refund' },
    { value: 'withdrawal', label: 'Withdrawal' },
    { value: 'commission', label: 'Commission' },
    { value: 'settlement', label: 'Settlement' },
    { value: 'cash_collection', label: 'Cash Collection' }
  ];

  const refundStatuses = [
    { value: 'all', label: 'All Refund Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'processed', label: 'Processed' },
    { value: 'failed', label: 'Failed' },
    { value: 'rejected', label: 'Rejected' }
  ];

  const handleZoneChange = (newZoneIds) => {
    if (Array.isArray(newZoneIds)) {
      setZoneIds(newZoneIds);
    } else if (newZoneIds && (newZoneIds._id || newZoneIds.id)) {
      const targetId = (newZoneIds._id || newZoneIds.id).toString();
      setZoneIds(prev => prev.filter(id => id.toString() !== targetId));
    }
  };

  // Count active non-default filters
  const activeCount = [
    month ? 1 : 0,
    quarter ? 1 : 0,
    (zoneIds || []).length > 0 ? 1 : 0,
    filterType === 'financial' ? 1 : 0,
    config.hasPaymentMethod && paymentMethod && paymentMethod !== 'all' ? 1 : 0,
    config.hasBookingStatus && bookingStatus && bookingStatus !== 'all' ? 1 : 0,
    config.hasTransactionType && transactionType && transactionType !== 'all' ? 1 : 0,
    config.hasRefundStatus && refundStatus && refundStatus !== 'all' ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  return (
    <div className={`bg-white rounded-xl shadow-xs border border-gray-200/90 p-4 mb-4 transition-all duration-200 ${className}`}>
      <div className="flex flex-col gap-3.5">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <FiCalendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-secondary text-xs tracking-tight">
                  {config.title || 'Global Analytics Filters'}
                </h3>
                {activeCount > 0 && (
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.2 rounded-full">
                    {activeCount} active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                Synchronized across analytical dashboards & reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Calendar vs Financial Year Toggle */}
            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/80">
              <button
                type="button"
                onClick={() => setFilterType('calendar')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${filterType === 'calendar'
                  ? 'bg-white text-secondary shadow-xs'
                  : 'text-gray-500 hover:text-secondary'
                  }`}
              >
                Calendar Year
              </button>
              <button
                type="button"
                onClick={() => setFilterType('financial')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${filterType === 'financial'
                  ? 'bg-white text-secondary shadow-xs'
                  : 'text-gray-500 hover:text-secondary'
                  }`}
              >
                Financial Year
              </button>
            </div>

            {/* Quick Reset Button */}
            <button
              type="button"
              onClick={() => {
                reset(null, onApply);
              }}
              title="Reset all global filters"
              className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 transition-colors"
            >
              <FiRefreshCw className="w-3 h-3 text-gray-500" />
              <span>Reset</span>
            </button>

            {onApply && (
              <button
                type="button"
                onClick={onApply}
                className="px-4 py-1 bg-primary hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs"
              >
                Apply
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          {/* Year Selector */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              {filterType === 'financial' ? 'Financial Year' : 'Year'}
            </label>
            <select
              value={filterType === 'financial' ? financialYear : year}
              onChange={(e) => {
                if (filterType === 'financial') {
                  setFinancialYear(e.target.value);
                } else {
                  setYear(parseInt(e.target.value, 10));
                }
              }}
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              {filterType === 'financial'
                ? financialYears.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))
                : calendarYears.map((cy) => (
                  <option key={cy} value={cy}>
                    {cy}
                  </option>
                ))}
            </select>
          </div>

          {/* Month Selector */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                if (e.target.value) setQuarter('');
              }}
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quarter Selector */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Quarter
            </label>
            <select
              value={quarter}
              onChange={(e) => {
                setQuarter(e.target.value);
                if (e.target.value) setMonth('');
              }}
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            >
              {quarters.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>

          {/* Zone Selector (Spans 2 cols on lg) */}
          <div className="lg:col-span-2">
            <HierarchicalZoneSelector
              zones={zones}
              selectedZoneIds={zoneIds}
              onChange={handleZoneChange}
              label="Selected Zone"
            />
          </div>

          {/* Route-Specific Selects */}
          {config.hasBookingStatus && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Booking Status
              </label>
              <select
                value={bookingStatus}
                onChange={(e) => setBookingStatus(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                {bookingStatuses.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.hasPaymentMethod && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                {paymentMethods.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.hasTransactionType && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Transaction Type
              </label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                {transactionTypes.map((tt) => (
                  <option key={tt.value} value={tt.value}>
                    {tt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.hasRefundStatus && (
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Refund Status
              </label>
              <select
                value={refundStatus}
                onChange={(e) => setRefundStatus(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                {refundStatuses.map((rs) => (
                  <option key={rs.value} value={rs.value}>
                    {rs.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminLocalFilterBar = ({
  filters = {},
  onChange,
  onClear,
  fields = [],
  showFilters,
  setShowFilters,
  searchProps,
  searchValue,
  onSearchChange,
  onSearchClear,
  searchPlaceholder,
  searchLoading,
  actions,
  className = ''
}) => {
  const isCollapsible = typeof showFilters === 'boolean' && typeof setShowFilters === 'function';
  const shouldRenderFields = !isCollapsible || showFilters;

  // Derive search configuration if provided
  const hasSearch = !!(searchProps || searchValue !== undefined || onSearchChange);

  return (
    <div className={`bg-white rounded-xl border border-gray-150 p-4 mb-6 shadow-sm ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Search Bar OR Inline Fields */}
        <div className="flex-1">
          {hasSearch ? (
            <div className="max-w-md">
              {searchProps ? (
                <AdminSearchBar {...searchProps} isGlobal={false} />
              ) : (
                <AdminSearchBar
                  value={searchValue}
                  onChange={onSearchChange}
                  onClear={onSearchClear}
                  placeholder={searchPlaceholder || 'Search name, email, phone, ID, address...'}
                  loading={searchLoading}
                  isGlobal={false}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 mr-2 pb-0.5">
                <FiFilter className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-bold text-secondary font-inter shrink-0">Filters:</span>
              </div>
              {fields.map((field) => (
                <div key={field.key} className="flex flex-col min-w-[120px]">
                  <label className="block text-[9px] font-extrabold text-gray-400 uppercase tracking-wider mb-0.5 font-inter">
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={filters[field.key] ?? ''}
                      onChange={(e) => onChange(field.key, e.target.value)}
                      className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-inter cursor-pointer"
                    >
                      {field.options.map((opt) => {
                        const val = typeof opt === 'object' ? opt.value : opt;
                        const label = typeof opt === 'object' ? opt.label : opt;
                        return (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={filters[field.key] ?? ''}
                      onChange={(e) => onChange(field.key, e.target.value)}
                      placeholder={field.placeholder || ''}
                      className="w-full px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-inter"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Clear Filters & Collapsible Controls */}
        <div className="flex items-center justify-end gap-3 flex-wrap shrink-0">
          {actions}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1.5 font-inter py-1.5 px-2.5 rounded-lg hover:bg-red-50/50 cursor-pointer"
            >
              <FiRefreshCw className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
          {isCollapsible && (
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="p-1.5 text-gray-500 hover:text-secondary rounded-lg border border-gray-250 hover:bg-gray-50 transition-colors flex items-center gap-1.5 text-xs font-semibold font-inter cursor-pointer"
            >
              <FiFilter className="w-4 h-4 text-primary" />
              <span>{showFilters ? 'Hide Filters' : 'More Filters'}</span>
              {showFilters ? <FiX className="w-3.5 h-3.5" /> : null}
            </button>
          )}
        </div>
      </div>

      {/* Bottom Grid for Filters (1 or 2 rows on desktop) */}
      {hasSearch && shouldRenderFields && fields.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3.5 border-t border-gray-100/80 pt-3.5">
          {fields.map((field) => (
            <div key={field.key} className="flex flex-col w-full">
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 font-inter">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  value={filters[field.key] ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-inter cursor-pointer"
                >
                  {field.options.map((opt) => {
                    const val = typeof opt === 'object' ? opt.value : opt;
                    const label = typeof opt === 'object' ? opt.label : opt;
                    return (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <input
                  type={field.type || 'text'}
                  value={filters[field.key] ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  placeholder={field.placeholder || ''}
                  className="w-full px-2.5 py-1.5 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-inter"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFilterBar;
