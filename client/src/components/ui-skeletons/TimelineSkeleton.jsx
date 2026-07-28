import React from 'react';

const TimelineSkeleton = ({ items = 3, className = '' }) => {
  return (
    <div className={`space-y-4 animate-pulse ${className}`}>
      {Array.from({ length: items }).map((_, idx) => (
        <div key={idx} className="flex items-start gap-4">
          <div className="w-6 h-6 rounded-full bg-neutral-200 shrink-0" />
          <div className="flex-1 bg-neutral-50 p-3 rounded-xl border border-neutral-100 space-y-2">
            <div className="w-32 h-3.5 bg-neutral-200 rounded" />
            <div className="w-48 h-3 bg-neutral-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimelineSkeleton;
