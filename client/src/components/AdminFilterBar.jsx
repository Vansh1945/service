import React from 'react';
import { useAdminFilter } from '../context/AdminFilterContext';
import HierarchicalZoneSelector from './HierarchicalZoneSelector';
import { FiCalendar, FiClock, FiGlobe, FiRefreshCw, FiFilter, FiX } from 'react-icons/fi';

const AdminFilterBar = ({ onApply }) => {
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
    resetGlobalFilters
  } = useAdminFilter();

  const currentYear = new Date().getFullYear();

  // Generate Calendar Year options
  const calendarYears = [];
  for (let y = currentYear; y >= earliestYear; y--) {
    calendarYears.push(y);
  }

  // Generate Financial Year options (e.g. 2024-25, 2025-26, 2026-27)
  const financialYears = [];
  for (let y = currentYear; y >= earliestYear; y--) {
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

  const handleZoneChange = (newZoneIds) => {
    // HierarchicalZoneSelector calls onChange with either selected IDs array or target node when deselecting.
    // If it's a deselect single action, newZoneIds might be a zone object or a deselect target. Let's make it robust:
    if (Array.isArray(newZoneIds)) {
      setZoneIds(newZoneIds);
    } else if (newZoneIds && (newZoneIds._id || newZoneIds.id)) {
      const targetId = (newZoneIds._id || newZoneIds.id).toString();
      setZoneIds(prev => prev.filter(id => id.toString() !== targetId));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-4 mb-4">
      <div className="flex flex-col gap-4">
        {/* Header & Toggle */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="font-bold text-secondary text-sm flex items-center gap-2">
              <FiCalendar className="text-primary" /> Global Filter Control
            </h3>
            <p className="text-[11px] text-gray-500">Filters applied across all admin analytical dashboards</p>
          </div>

          <div className="flex bg-gray-100 p-0.5 rounded-lg w-fit border border-gray-200">
            <button
              onClick={() => setFilterType('calendar')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                filterType === 'calendar'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-500 hover:text-secondary'
              }`}
            >
              Calendar Year
            </button>
            <button
              onClick={() => setFilterType('financial')}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                filterType === 'financial'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-500 hover:text-secondary'
              }`}
            >
              Financial Year
            </button>
          </div>
        </div>

        {/* Dynamic Filters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          {/* Year Selector */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              {filterType === 'financial' ? 'Financial Year' : 'Year'}
            </label>
            <div className="relative">
              <select
                value={filterType === 'financial' ? financialYear : year}
                onChange={(e) => {
                  if (filterType === 'financial') {
                    setFinancialYear(e.target.value);
                  } else {
                    setYear(parseInt(e.target.value, 10));
                  }
                }}
                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold appearance-none"
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
          </div>

          {/* Month Selector */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                if (e.target.value) setQuarter(''); // Reset quarter if month is selected
              }}
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
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
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Quarter</label>
            <select
              value={quarter}
              onChange={(e) => {
                setQuarter(e.target.value);
                if (e.target.value) setMonth(''); // Reset month if quarter is selected
              }}
              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
            >
              {quarters.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>

          {/* Zone Selector */}
          <div className="lg:col-span-2">
            <HierarchicalZoneSelector
              zones={zones}
              selectedZoneIds={zoneIds}
              onChange={handleZoneChange}
              label="Selected Zone"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            onClick={() => {
              resetGlobalFilters();
              if (onApply) onApply();
            }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-55 transition-all"
          >
            <FiRefreshCw /> Reset
          </button>
          {onApply && (
            <button
              onClick={onApply}
              className="px-6 py-2 bg-primary hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-md hover:shadow-lg"
            >
              Apply Global Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const AdminLocalFilterBar = ({
  filters,
  onChange,
  onClear,
  fields,
  showFilters,
  setShowFilters
}) => {
  const isCollapsible = typeof showFilters === 'boolean' && typeof setShowFilters === 'function';
  const shouldRenderFields = !isCollapsible || showFilters;

  return (
    <div className="bg-white rounded-xl border border-gray-150 p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-secondary flex items-center gap-2 font-inter">
          <FiFilter className="w-4 h-4 text-primary" /> Filter Options
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={onClear}
            className="text-xs font-semibold text-gray-555 hover:text-red-500 transition-colors"
          >
            Clear All
          </button>
          {isCollapsible && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-1 text-gray-400 hover:text-secondary rounded-lg transition-colors"
            >
              {showFilters ? <FiX className="w-4 h-4" /> : <FiFilter className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {shouldRenderFields && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  value={filters[field.key] ?? ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                  className="w-full px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-semibold text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
