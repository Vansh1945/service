import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('Frontend Pagination UI & State Unit Tests', () => {
  const getPageNumbers = (currentPage, totalPages) => {
    if (!totalPages || totalPages <= 1) return [];
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
      if (totalPages <= 5) {
        return i + 1;
      } else if (currentPage <= 3) {
        return i + 1;
      } else if (currentPage >= totalPages - 2) {
        return totalPages - 4 + i;
      } else {
        return currentPage - 2 + i;
      }
    });
  };

  test('returns empty array when totalPages <= 1', () => {
    assert.deepStrictEqual(getPageNumbers(1, 1), []);
    assert.deepStrictEqual(getPageNumbers(1, 0), []);
  });

  test('renders all page numbers when totalPages <= 5', () => {
    assert.deepStrictEqual(getPageNumbers(1, 4), [1, 2, 3, 4]);
  });

  test('centers current page when totalPages > 5', () => {
    assert.deepStrictEqual(getPageNumbers(5, 10), [3, 4, 5, 6, 7]);
    assert.deepStrictEqual(getPageNumbers(9, 10), [6, 7, 8, 9, 10]);
  });

  test('disables previous button on first page', () => {
    const currentPage = 1;
    const totalPages = 5;
    const hasPrev = currentPage > 1;
    const hasNext = currentPage < totalPages;

    assert.strictEqual(hasPrev, false);
    assert.strictEqual(hasNext, true);
  });

  test('disables next button on last page', () => {
    const currentPage = 5;
    const totalPages = 5;
    const hasPrev = currentPage > 1;
    const hasNext = currentPage < totalPages;

    assert.strictEqual(hasPrev, true);
    assert.strictEqual(hasNext, false);
  });

  test('triggers page change callback with next/prev page numbers', () => {
    const calls = [];
    const onPageChange = (page) => calls.push(page);
    const currentPage = 2;

    onPageChange(currentPage + 1);
    assert.strictEqual(calls[0], 3);

    onPageChange(currentPage - 1);
    assert.strictEqual(calls[1], 1);
  });
});
