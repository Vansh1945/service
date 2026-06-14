import React from 'react';
import { Search, X, Loader2 } from 'lucide-react';

const AdminSearchBar = ({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  disabled = false,
  autoFocus = false,
  loading = false,
  icon: IconProp,
  onClear,
  ...restProps
}) => {
  const Icon = IconProp || Search;

  const handleClear = (e) => {
    e.preventDefault();
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center pointer-events-none z-10">
        {loading ? (
          <Loader2 className="w-4 h-4 md:w-5 md:h-5 text-gray-400 animate-spin" />
        ) : (
          <Icon className="w-4 h-4 md:w-5 md:h-5 text-gray-400" />
        )}
      </div>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-10 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white text-secondary placeholder-gray-400 text-sm disabled:opacity-50"
        {...restProps}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-secondary focus:outline-none transition-colors z-10"
        >
          <X className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      )}
    </div>
  );
};

export default AdminSearchBar;
