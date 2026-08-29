import React from 'react';
import { getStatusBadge, formatStatus } from '../../utils/status';

/**
 * Standardized StatusBadge component across all frontend domains.
 * Renders consistent status pills using centralized metadata from client/src/utils/status.jsx.
 * Supports props: status, module, domain, customLabel, label, className, showDot, size, icon.
 */
const StatusBadge = ({
  status,
  module = 'generic',
  domain,
  customLabel = null,
  label = null,
  className = '',
  showDot = false,
  size = 'md',
  icon: CustomIcon = null,
  ...props
}) => {
  const targetModule = domain || module || 'generic';
  const displayLabel = customLabel || label;
  
  const badge = getStatusBadge(status, targetModule);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm'
  };

  const finalSizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border ${badge.color || 'bg-gray-100 text-gray-700 border-gray-200'} ${finalSizeClass} ${className}`}
      {...props}
    >
      {showDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
      )}
      {CustomIcon && (
        <CustomIcon className="w-3.5 h-3.5" />
      )}
      {displayLabel || badge.label || formatStatus(status)}
    </span>
  );
};

export default StatusBadge;

