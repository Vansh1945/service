import React from 'react';
import { Link } from 'react-router-dom';

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  subtext,
  iconBg = 'bg-primary/10',
  iconColor = 'text-primary',
  to,
  className = '',
  ...props
}) => {
  const CardWrapper = to ? Link : 'div';
  const wrapperProps = to ? { to } : {};

  return (
    <CardWrapper
      {...wrapperProps}
      {...props}
      className={`bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm hover:shadow-md transition-all duration-300 flex items-center gap-4 min-w-0 ${to || props.onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {Icon && (
        <div className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center ${iconBg} ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0 flex-grow">
        <p className="text-xs font-semibold text-neutral-500 mb-0.5 break-words leading-tight">{title}</p>
        <div className="text-base sm:text-lg font-bold text-secondary leading-normal">{value}</div>
        {trendValue && (
          <p className={`text-xs font-medium mt-1 ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-neutral-500'}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'} {trendValue}% {trend === 'up' || trend === 'down' ? 'than last month' : ''}
          </p>
        )}
        {subtext && (
          <div className="text-[10px] font-medium text-neutral-400 mt-0.5 break-words leading-tight">{subtext}</div>
        )}
      </div>
    </CardWrapper>
  );
};


export default StatCard;
