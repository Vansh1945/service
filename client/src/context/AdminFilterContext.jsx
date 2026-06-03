import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as BookingService from '../services/BookingService';
import * as ZoneService from '../services/ZoneService';

const AdminFilterContext = createContext();

export const AdminFilterProvider = ({ children }) => {
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

  // Fetch earliest year from bookings & load zones list
  useEffect(() => {
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
  }, []);

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

  const resetGlobalFilters = () => {
    setFilterType('calendar');
    setYear(new Date().getFullYear());
    setMonth('');
    setQuarter('');
    setZoneIds([]);
  };

  const getMergedQuery = useCallback((localFilters = {}) => {
    const dates = getComputedDateRange();
    const query = {
      ...dates,
      ...(zoneIds.length > 0 && { zoneIds: zoneIds.join(',') }),
      ...localFilters
    };
    return query;
  }, [getComputedDateRange, zoneIds]);

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
        getComputedDateRange,
        resetGlobalFilters,
        getMergedQuery
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
