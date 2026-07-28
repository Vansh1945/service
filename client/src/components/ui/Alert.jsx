import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

const Alert = ({ type = 'info', title, message, children, className = '' }) => {
  const configs = {
    info: {
      bg: 'bg-info-light border-info/20 text-info',
      icon: Info,
    },
    success: {
      bg: 'bg-success-light border-success/20 text-success',
      icon: CheckCircle,
    },
    warning: {
      bg: 'bg-warning-light border-warning/20 text-warning',
      icon: AlertTriangle,
    },
    danger: {
      bg: 'bg-danger-light border-danger/20 text-danger',
      icon: AlertCircle,
    },
  };

  const config = configs[type] || configs.info;
  const Icon = config.icon;

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border ${config.bg} ${className}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 text-xs">
        {title && <h5 className="font-bold mb-0.5">{title}</h5>}
        {message && <p className="leading-relaxed opacity-90 font-medium">{message}</p>}
        {children}
      </div>
    </div>
  );
};

export default Alert;
