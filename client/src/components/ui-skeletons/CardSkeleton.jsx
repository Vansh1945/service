import React from 'react';

const CardSkeleton = ({ count = 3, className = '' }) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="w-24 h-4 bg-neutral-200 rounded" />
            <div className="w-8 h-8 bg-neutral-200 rounded-full" />
          </div>
          <div className="w-32 h-6 bg-neutral-200 rounded mb-2" />
          <div className="w-16 h-3 bg-neutral-100 rounded" />
        </div>
      ))}
    </div>
  );
};

export default CardSkeleton;
