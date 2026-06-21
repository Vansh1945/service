import React from 'react';

const Processing = ({
  loading = false,
  children,
  className = '',
  disabled = false,
  type = 'button',
  size = 'md',
  fullWidth = false,
  icon,
  loadingText = 'Processing...',
  ...props
}) => {
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-lg',
    md: 'px-5 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3.5 text-base rounded-2xl'
  };

  const selectedSizeClass = sizeClasses[size] || sizeClasses.md;
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`
        inline-flex items-center justify-center font-bold relative overflow-hidden
        transition-all duration-300 active:scale-95 select-none
        disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100
        ${selectedSizeClass}
        ${widthClass}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2 w-full flex-row">
          <span className="relative flex h-4 w-4 shrink-0">
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></span>
          </span>
          <span>{loadingText}</span>
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2 w-full flex-row whitespace-nowrap">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </span>
      )}
    </button>
  );
};

export default Processing;
