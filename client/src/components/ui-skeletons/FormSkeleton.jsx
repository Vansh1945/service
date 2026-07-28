import React from 'react';

const FormSkeleton = ({ fields = 4, className = '' }) => {
  return (
    <div className={`bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm space-y-5 animate-pulse ${className}`}>
      {Array.from({ length: fields }).map((_, idx) => (
        <div key={idx} className="space-y-2">
          <div className="w-24 h-3 bg-neutral-200 rounded" />
          <div className="w-full h-10 bg-neutral-100 rounded-xl" />
        </div>
      ))}
      <div className="w-32 h-10 bg-neutral-200 rounded-xl pt-2" />
    </div>
  );
};

export default FormSkeleton;
