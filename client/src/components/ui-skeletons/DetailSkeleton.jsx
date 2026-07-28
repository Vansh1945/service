import React from 'react';

const DetailSkeleton = ({ className = '' }) => {
  return (
    <div className={`bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm space-y-6 animate-pulse ${className}`}>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-neutral-200 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="w-48 h-5 bg-neutral-200 rounded" />
          <div className="w-32 h-3.5 bg-neutral-100 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-neutral-100">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="w-20 h-3 bg-neutral-100 rounded" />
            <div className="w-28 h-4 bg-neutral-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DetailSkeleton;
