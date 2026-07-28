import React from 'react';
import { getStatusBadge } from '../../utils/status';

const StatusBadge = ({ status, module = 'generic', customLabel = null, className = '' }) => {
  const badge = getStatusBadge(status, module);
  return (
    <span className={`${badge.className} ${className}`}>
      {customLabel || badge.label}
    </span>
  );
};

export default StatusBadge;
