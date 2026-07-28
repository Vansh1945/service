import React from 'react';

const InfoCard = ({ label, value, icon: Icon, subtext, className = '', variant = 'neutral' }) => {
  const variantStyles = {
    neutral: 'bg-neutral-50 border-neutral-100 text-secondary',
    primary: 'bg-primary/5 border-primary/10 text-primary',
    success: 'bg-success-light border-success/20 text-success',
    warning: 'bg-warning-light border-warning/20 text-warning',
    danger: 'bg-danger-light border-danger/20 text-danger',
  };

  return (
    <div className={`p-4 rounded-xl border ${variantStyles[variant] || variantStyles.neutral} ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-neutral-500">{label}</span>
        {Icon && <Icon className="w-4 h-4 opacity-70" />}
      </div>
      <div className="text-base font-bold text-secondary">{value ?? '--'}</div>
      {subtext && <div className="text-[10px] text-neutral-400 mt-1">{subtext}</div>}
    </div>
  );
};

export default InfoCard;
