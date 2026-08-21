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
    <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/50 mt-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {limit !== undefined && limit !== null && totalItems !== undefined && totalItems !== null && (
          <div className="text-xs text-neutral-500 font-medium">
            Showing <span className="font-bold text-secondary">{(currentPage - 1) * limit + 1}</span> to{' '}
            <span className="font-bold text-secondary">
              {Math.min(currentPage * limit, totalItems)}
            </span>{' '}
            of <span className="font-bold text-secondary">{totalItems}</span> results
          </div>
        )}
        <div className="flex items-center space-x-2">
          <button
            onClick={prevPage}
            disabled={!hasPrev}
            className="px-3 py-1.5 text-xs font-semibold text-secondary bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center shadow-sm"
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
                  aria-current={currentPage === pageNumber ? 'page' : undefined}
                  className={`min-w-[2.25rem] h-9 px-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center ${
                    currentPage === pageNumber
                      ? 'bg-primary text-white shadow-sm font-bold'
                      : 'bg-white text-secondary hover:bg-neutral-100 border border-neutral-200'
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
            className="px-3 py-1.5 text-xs font-semibold text-secondary bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center shadow-sm"
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
