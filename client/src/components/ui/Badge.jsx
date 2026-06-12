import React from 'react';

const Badge = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors duration-200';

  const variants = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-secondary/10 text-secondary border-secondary/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    info: 'bg-info/10 text-info border-info/20',
    neutral: 'bg-neutral-100 text-neutral-800 border-neutral-200',
  };

  return (
    <span
      className={`${baseStyles} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};

export default Badge;
