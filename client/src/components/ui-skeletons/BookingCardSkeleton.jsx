import React from 'react';

const BookingCardSkeleton = () => {
  return (
    <div className="animate-pulse bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-4 md:p-5 space-y-4">
      {/* Top row: Image, Title, Price */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-gray-200 rounded-xl flex-shrink-0"></div>
        <div className="flex-grow space-y-2 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1.5 flex-grow">
              <div className="h-4.5 bg-gray-200 rounded w-2/3"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
            <div className="h-5 bg-gray-200 rounded w-16 flex-shrink-0"></div>
          </div>
        </div>
      </div>

      {/* Mid row: Info line / Badges */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
        <div className="h-5 bg-gray-200 rounded-full w-24"></div>
      </div>

      {/* Bottom row: Action Buttons */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 pt-4 border-t border-gray-100">
        <div className="w-24 h-8 bg-gray-200 rounded-xl"></div>
        <div className="w-24 h-8 bg-gray-200 rounded-xl"></div>
        <div className="w-20 h-8 bg-gray-200 rounded-xl sm:ml-auto"></div>
      </div>
    </div>
  );
};

export default BookingCardSkeleton;
