import React from 'react';
import { Link } from 'react-router-dom';

const StatsCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  subtext,
  iconBg = 'bg-primary/10',
  iconColor = 'text-primary',
  to,
  className = ''
}) => {
  const CardWrapper = to ? Link : 'div';
  const wrapperProps = to ? { to } : {};

  return (
    <CardWrapper
      {...wrapperProps}
      className={`bg-white rounded-2xl border border-slate-105 p-3 sm:p-4 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300 flex items-center gap-3 sm:gap-4 min-w-0 ${to ? 'cursor-pointer' : ''} ${className}`}
    >
      {Icon && (
        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full shrink-0 flex items-center justify-center ${iconBg} ${iconColor}`}>
          <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
        </div>
      )}
      <div className="min-w-0 flex-grow">
        <p className="text-xs font-medium text-slate-500 mb-0.5 break-words leading-tight">{title}</p>
        <p className="text-sm sm:text-base md:text-lg font-bold text-slate-800 leading-normal whitespace-nowrap">{value}</p>
        {trendValue && (
          <p className={`text-xs mt-1 ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendValue}% {trend === 'up' || trend === 'down' ? 'than last month' : ''}
          </p>
        )}
        {subtext && (
          <p className="text-[10px] text-slate-400 mt-0.5 break-words leading-tight">{subtext}</p>
        )}
      </div>
    </CardWrapper>
  );
};

export default StatsCard;

