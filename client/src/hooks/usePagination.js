import { useState, useCallback, useEffect } from 'react';

/**
 * Reusable Pagination Hook.
 * Manages pagination state (`currentPage`, `limit`, `totalItems`, `totalPages`)
 * and provides helper methods for easy API integration.
 */
export const usePagination = (initialPage = 1, initialLimit = 10) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [totalItems, setTotalItems] = useState(0);
  const [customTotalPages, setCustomTotalPages] = useState(null);

  const onPageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const computedTotalPages = Math.max(1, Math.ceil(totalItems / (limit || 1)));
  const totalPages = customTotalPages !== null ? customTotalPages : computedTotalPages;

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const setPaginationData = useCallback(({ total, pages, limit: newLimit }) => {
    if (total !== undefined) setTotalItems(total);
    if (pages !== undefined) setCustomTotalPages(pages);
    if (newLimit !== undefined) setLimit(newLimit);
  }, []);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    setCurrentPage,
    page: currentPage,
    setPage: setCurrentPage,
    limit,
    setLimit,
    totalItems,
    setTotalItems,
    totalPages,
    onPageChange,
    setPaginationData,
    resetPagination
  };
};

export default usePagination;
