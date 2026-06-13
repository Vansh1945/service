import React from 'react';
import { Search } from 'lucide-react';

const ServiceEmptyState = ({ message, buttonText, onReset }) => {
  return (
    <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm w-full">
      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
        <Search className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-bold text-secondary mb-2">No services found</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
        {message || "We couldn't find any services matching your selection. Try adjusting filters."}
      </p>
      {onReset && (
        <button
          onClick={onReset}
          className="px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/95 shadow-md shadow-primary/10 transition-all active:scale-95"
        >
          {buttonText || "Reset Filters"}
        </button>
      )}
    </div>
  );
};

export default ServiceEmptyState;
