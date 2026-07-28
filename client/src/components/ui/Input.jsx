import React from 'react';

const Input = ({
  label,
  error,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  className = '',
  id,
  ...props
}) => {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-secondary">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {LeftIcon && (
          <div className="absolute left-3 text-neutral-400 pointer-events-none">
            <LeftIcon className="w-4 h-4" />
          </div>
        )}
        <input
          id={id}
          className={`w-full ${LeftIcon ? 'pl-9' : 'px-3.5'} ${RightIcon ? 'pr-9' : 'px-3.5'} py-2.5 bg-white border border-neutral-200 rounded-xl text-sm text-secondary placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-neutral-50 disabled:text-neutral-400 transition-all ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''} ${className}`}
          {...props}
        />
        {RightIcon && (
          <div className="absolute right-3 text-neutral-400 pointer-events-none">
            <RightIcon className="w-4 h-4" />
          </div>
        )}
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
};

export default Input;
