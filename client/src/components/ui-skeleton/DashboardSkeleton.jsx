import React, { useMemo } from 'react';

const DashboardSkeleton = ({
  type = 'default',
  statsCount = 6,
  showCharts = true,
  showTable = false,
  showActivity = false,
  showRecentBookings = false
}) => {
  // Render stats cards skeletons
  const statsCards = useMemo(() => {
    return Array.from({ length: statsCount }).map((_, idx) => (
      <div
        key={idx}
        className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex items-center justify-between"
      >
        <div className="space-y-2 flex-1 mr-4">
          <div className="h-3 bg-slate-200 rounded w-2/3"></div>
          <div className="h-6 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-150 shrink-0"></div>
      </div>
    ));
  }, [statsCount]);

  // Command Center Skeleton for Admin
  const adminCommandCenter = useMemo(() => {
    if (type !== 'admin') return null;
    return (
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div className="space-y-1.5">
            <div className="h-4 bg-slate-800 rounded w-36"></div>
            <div className="h-3 bg-slate-800 rounded w-64"></div>
          </div>
          <div className="w-24 h-7 bg-slate-800 rounded-full"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-slate-850 border border-slate-800 p-4 rounded-xl flex flex-col justify-between h-32">
              <div className="flex justify-between items-start">
                <div className="h-3 bg-slate-800 rounded w-16"></div>
                <div className="w-7 h-7 bg-slate-800 rounded-lg"></div>
              </div>
              <div className="h-6 bg-slate-800 rounded w-12 mt-2"></div>
              <div className="w-full h-7 bg-slate-800 rounded-lg mt-3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [type]);

  // Provider Performance Skeleton for Provider Dashboard
  const providerPerformance = useMemo(() => {
    if (type !== 'provider') return null;
    return (
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 bg-slate-200 rounded w-48"></div>
          <div className="w-16 h-5 bg-slate-200 rounded-full"></div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-7 bg-slate-200 rounded w-12 mx-auto"></div>
              <div className="h-3 bg-slate-200 rounded w-16 mx-auto"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [type]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 font-inter animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Block */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="h-6 bg-slate-200 rounded w-1/3 md:w-1/4"></div>
            <div className="h-3.5 bg-slate-200 rounded w-1/2 md:w-1/3"></div>
          </div>
          <div className="w-28 h-8 bg-slate-200 rounded-lg shrink-0"></div>
        </div>

        {/* Optional Admin Command Center */}
        {adminCommandCenter}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {statsCards}
        </div>

        {/* Optional Provider Performance Block */}
        {providerPerformance}

        {/* Charts Section */}
        {showCharts && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] h-[320px] flex flex-col justify-between">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="flex-1 bg-slate-100 rounded-xl mb-4 w-full"></div>
              <div className="h-10 bg-slate-200 rounded w-full"></div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] h-[320px] flex flex-col justify-between">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-4"></div>
              <div className="flex-1 bg-slate-100 rounded-xl mb-4 w-full"></div>
              <div className="h-10 bg-slate-200 rounded w-full"></div>
            </div>
          </div>
        )}

        {/* Table & Bottom widgets section */}
        {(showTable || showActivity || showRecentBookings) && (
          <div className={`grid grid-cols-1 ${showActivity && showRecentBookings ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
            
            {/* Recent Bookings / List skeleton */}
            {showRecentBookings && (
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-5 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <div className="h-5 bg-slate-200 rounded w-36"></div>
                  <div className="h-4 bg-slate-200 rounded w-16"></div>
                </div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0"></div>
                    <div className="flex-grow space-y-2">
                      <div className="h-3.5 bg-slate-200 rounded w-1/3"></div>
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                    </div>
                    <div className="text-right space-y-2 shrink-0">
                      <div className="h-3 bg-slate-200 rounded w-20 ml-auto"></div>
                      <div className="h-5 bg-slate-200 rounded w-12 ml-auto"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Activity Feed Skeleton */}
            {showActivity && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-5 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <div className="h-5 bg-slate-200 rounded w-36"></div>
                  <div className="h-3 bg-slate-200 rounded w-12"></div>
                </div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 rounded w-5/6"></div>
                      <div className="h-2.5 bg-slate-200 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Table Skeleton */}
            {showTable && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] p-5 space-y-4">
                <div className="h-5 bg-slate-200 rounded w-1/4"></div>
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 h-10 border-b border-slate-100 flex items-center px-4">
                    <div className="h-3 bg-slate-200 rounded w-full"></div>
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 border-b border-slate-150 flex items-center px-4">
                      <div className="h-3 bg-slate-200 rounded w-full"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(DashboardSkeleton);
