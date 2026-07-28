import React from 'react';

const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size = 'md',
  disabled = false,
  className = ''
}) => {
  const variantStyles = {
    primary: 'bg-primary hover:bg-primary/90 text-white shadow-sm',
    secondary: 'bg-secondary hover:bg-secondary/90 text-white shadow-sm',
    outline: 'border border-neutral-200 text-secondary hover:bg-neutral-50',
    danger: 'bg-danger hover:bg-danger/90 text-white shadow-sm',
    ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-secondary',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-xs gap-2',
    lg: 'px-4 py-2.5 text-sm gap-2',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none ${
        variantStyles[variant] || variantStyles.primary
      } ${sizeStyles[size] || sizeStyles.md} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {label && <span>{label}</span>}
    </button>
  );
};

export default ActionButton;
