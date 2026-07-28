import React from 'react';

const ChartSkeleton = ({ className = '' }) => {
  return (
    <div className={`bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm animate-pulse ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="w-36 h-4 bg-neutral-200 rounded" />
        <div className="w-24 h-4 bg-neutral-100 rounded" />
      </div>
      <div className="h-64 bg-neutral-100/60 rounded-xl flex items-end justify-between p-4 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="w-full bg-neutral-200 rounded-t-lg"
            style={{ height: `${(i % 3 + 1) * 25}%` }}
          />
        ))}
      </div>
    </div>
  );
};

export default ChartSkeleton;
