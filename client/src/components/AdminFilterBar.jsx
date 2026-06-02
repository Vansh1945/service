import React from 'react';
import { useAdminFilter } from '../context/AdminFilterContext';
import HierarchicalZoneSelector from './HierarchicalZoneSelector';
import { FiCalendar, FiClock, FiGlobe, FiRefreshCw } from 'react-icons/fi';

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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-150 p-6 mb-6">
      <div className="flex flex-col gap-6">
        {/* Header & Toggle */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-secondary text-base flex items-center gap-2">
              <FiCalendar className="text-primary" /> Global Filter Control
            </h3>
            <p className="text-xs text-gray-500">Filters applied across all admin analytical dashboards</p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl w-fit border border-gray-200">
            <button
              onClick={() => setFilterType('calendar')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterType === 'calendar'
                  ? 'bg-white text-secondary shadow-sm'
                  : 'text-gray-500 hover:text-secondary'
              }`}
            >
              Calendar Year
            </button>
            <button
              onClick={() => setFilterType('financial')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Year Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
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
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold appearance-none"
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
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Month</label>
            <select
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                if (e.target.value) setQuarter(''); // Reset quarter if month is selected
              }}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
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
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quarter</label>
            <select
              value={quarter}
              onChange={(e) => {
                setQuarter(e.target.value);
                if (e.target.value) setMonth(''); // Reset month if quarter is selected
              }}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
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

export default AdminFilterBar;
