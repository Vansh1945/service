import React from 'react';
import { Search as SearchIcon, X } from 'lucide-react';

const Search = ({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
  ...props
}) => {
  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <SearchIcon className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2 bg-white border border-neutral-200 rounded-xl text-sm text-secondary placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        {...props}
      />
      {value && onClear && (
        <button
          onClick={onClear}
          className="absolute right-3 p-0.5 rounded-full text-neutral-400 hover:text-secondary hover:bg-neutral-100 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default Search;
