import React, { useState, useEffect } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import useDebounce from '../../hooks/useDebounce';

const Search = ({
  value = '',
  onChange,
  onDebouncedChange,
  onClear,
  placeholder = 'Search...',
  className = '',
  delay = 400,
  ...props
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const debouncedSearchTerm = useDebounce(searchTerm, delay);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    if (onDebouncedChange) {
      onDebouncedChange(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, onDebouncedChange]);

  const handleChange = (e) => {
    setSearchTerm(e.target.value);
    if (onChange) onChange(e);
  };

  const handleClear = () => {
    setSearchTerm('');
    if (onClear) onClear();
  };

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <SearchIcon className="absolute left-3.5 w-4 h-4 text-neutral-400 pointer-events-none" />
      <input
        type="text"
        value={searchTerm}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2 bg-white border border-neutral-200 rounded-xl text-sm text-secondary placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        {...props}
      />
      {searchTerm && onClear && (
        <button
          onClick={handleClear}
          className="absolute right-3 p-0.5 rounded-full text-neutral-400 hover:text-secondary hover:bg-neutral-100 transition-all"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default Search;
