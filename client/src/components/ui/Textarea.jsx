import React from 'react';

const Textarea = ({
  label,
  error,
  rows = 4,
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
      <textarea
        id={id}
        rows={rows}
        className={`w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm text-secondary placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-neutral-50 disabled:text-neutral-400 transition-all ${error ? 'border-danger focus:ring-danger/20 focus:border-danger' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
};

export default Textarea;
