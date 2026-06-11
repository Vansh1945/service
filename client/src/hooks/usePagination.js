import { useState, useCallback, useEffect } from 'react';

export const usePagination = (initialPage = 1, initialLimit = 10) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [totalItems, setTotalItems] = useState(0);

  const onPageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const totalPages = Math.ceil(totalItems / limit);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return {
    currentPage,
    setCurrentPage,
    limit,
    setLimit,
    totalItems,
    setTotalItems,
    totalPages,
    onPageChange
  };
};

export default usePagination;
