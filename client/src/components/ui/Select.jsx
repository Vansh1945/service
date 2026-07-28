import React from 'react';
import { ChevronDown } from 'lucide-react';

const Select = ({
  label,
  error,
  options = [],
  children,
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
        <select
          id={id}
          className={`w-full appearance-none pl-3.5 pr-10 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-neutral-50 disabled:text-neutral-400 transition-all ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''} ${className}`}
          {...props}
        >
          {children ? (
            children
          ) : (
            options.map((opt, i) => (
              <option key={opt.value ?? i} value={opt.value}>
                {opt.label}
              </option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
};

export default Select;
