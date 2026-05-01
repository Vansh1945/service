import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  limit,
  onPageChange
}) => {
  if (!totalPages || totalPages <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const nextPage = () => {
    if (hasNext) onPageChange(currentPage + 1);
  };

  const prevPage = () => {
    if (hasPrev) onPageChange(currentPage - 1);
  };

  return (
    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 mt-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-sm text-gray-600">
          Showing <span className="font-medium">{(currentPage - 1) * limit + 1}</span> to{' '}
          <span className="font-medium">
            {Math.min(currentPage * limit, totalItems)}
          </span>{' '}
          of <span className="font-medium">{totalItems}</span> results
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={prevPage}
            disabled={!hasPrev}
            className="px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </button>

          <div className="hidden sm:flex items-center space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNumber;
              if (totalPages <= 5) {
                pageNumber = i + 1;
              } else if (currentPage <= 3) {
                pageNumber = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNumber = totalPages - 4 + i;
              } else {
                pageNumber = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNumber}
                  onClick={() => onPageChange(pageNumber)}
                  className={`w-8 h-8 text-sm rounded ${
                    currentPage === pageNumber
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>

          <button
            onClick={nextPage}
            disabled={!hasNext}
            className="px-3 py-2 text-sm font-medium text-secondary bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
