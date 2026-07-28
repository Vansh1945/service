import React from 'react';

const SummaryCard = ({ title, items = [], className = '' }) => {
  return (
    <div className={`bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm ${className}`}>
      {title && <h4 className="text-sm font-bold text-secondary mb-4 pb-2 border-b border-neutral-100">{title}</h4>}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <span className="text-neutral-500 font-medium">{item.label}</span>
            <span className={`font-bold ${item.colorClass || 'text-secondary'}`}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SummaryCard;
