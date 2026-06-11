import React from 'react';

const ServiceCardSkeleton = () => {
  return (
    <div className="animate-pulse bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col h-full ring-1 ring-gray-100">
      {/* Image Area */}
      <div className="relative h-36 md:h-44 bg-gray-200">
        <div className="absolute top-2 left-2 w-16 h-5 bg-gray-300 rounded-lg"></div>
      </div>

      {/* Info Area */}
      <div className="p-3 md:p-4 flex flex-col flex-grow space-y-3">
        <div className="flex-grow space-y-2">
          {/* Title */}
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          {/* Description */}
          <div className="space-y-1.5">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>

        {/* Metrics (Duration / Rating) */}
        <div className="flex items-center justify-between mb-1 pt-1">
          <div className="w-12 h-3.5 bg-gray-200 rounded"></div>
          <div className="w-20 h-3.5 bg-gray-200 rounded"></div>
        </div>

        {/* Pricing & Booking Button */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
          <div className="w-16 h-5 bg-gray-200 rounded"></div>
          <div className="w-16 h-7 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    </div>
  );
};

export default ServiceCardSkeleton;
