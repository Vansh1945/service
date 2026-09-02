describe('CRUD, Search & Pagination Logic Tests', () => {
  describe('Search Query Sanitization & Filtering', () => {
    // Utility function mirroring backend search regex sanitization
    const sanitizeSearchQuery = (query) => {
      if (!query || typeof query !== 'string') return '';
      const trimmed = query.trim();
      if (!trimmed) return '';
      return trimmed.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&');
    };

    test('escapes regex special characters safely', () => {
      const rawQuery = 'AC Repair (Urban) + 10% [Offer]';
      const sanitized = sanitizeSearchQuery(rawQuery);
      expect(sanitized).toBe('AC Repair \\(Urban\\) \\+ 10% \\[Offer\\]');
    });

    test('handles Hindi / Unicode search input correctly', () => {
      const unicodeQuery = 'सफाई सेवा Plumber';
      const sanitized = sanitizeSearchQuery(unicodeQuery);
      expect(sanitized).toBe('सफाई सेवा Plumber');
    });

    test('handles empty or whitespace-only search string', () => {
      expect(sanitizeSearchQuery('')).toBe('');
      expect(sanitizeSearchQuery('   ')).toBe('');
      expect(sanitizeSearchQuery(null)).toBe('');
    });
  });

  describe('Pagination Calculation Helper', () => {
    // Utility calculation matching backend / frontend pagination standard
    const calculatePagination = (totalItems, currentPage = 1, pageSize = 10) => {
      const limit = Math.max(1, parseInt(pageSize, 10) || 10);
      const totalPages = Math.max(1, Math.ceil(totalItems / limit));
      const page = Math.min(Math.max(1, parseInt(currentPage, 10) || 1), totalPages);
      const skip = (page - 1) * limit;

      return {
        totalItems,
        totalPages,
        currentPage: page,
        pageSize: limit,
        skip,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      };
    };

    test('calculates correct pages for standard dataset (55 items, limit 10)', () => {
      const result = calculatePagination(55, 2, 10);
      expect(result.totalPages).toBe(6);
      expect(result.currentPage).toBe(2);
      expect(result.skip).toBe(10);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
    });

    test('handles empty dataset (0 items)', () => {
      const result = calculatePagination(0, 1, 10);
      expect(result.totalItems).toBe(0);
      expect(result.totalPages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.skip).toBe(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(false);
    });

    test('clamps requested page higher than total pages', () => {
      const result = calculatePagination(25, 10, 10); // Requested page 10 out of 3
      expect(result.totalPages).toBe(3);
      expect(result.currentPage).toBe(3);
      expect(result.skip).toBe(20);
      expect(result.hasNextPage).toBe(false);
    });

    test('clamps requested page below 1', () => {
      const result = calculatePagination(30, -5, 10);
      expect(result.currentPage).toBe(1);
      expect(result.skip).toBe(0);
      expect(result.hasPrevPage).toBe(false);
    });
  });

  describe('CRUD Entity Payload Validation', () => {
    const validateServicePayload = (data) => {
      const errors = [];
      if (!data.name || data.name.trim().length < 2) errors.push('Service name required (min 2 chars)');
      if (!data.price || data.price <= 0) errors.push('Price must be greater than 0');
      if (!data.category) errors.push('Category is required');
      return { isValid: errors.length === 0, errors };
    };

    test('validates correct service CRUD payload', () => {
      const validPayload = { name: 'Deep Home Cleaning', price: 999, category: 'cleaning_123' };
      const validation = validateServicePayload(validPayload);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('rejects invalid service CRUD payload with negative price', () => {
      const invalidPayload = { name: 'X', price: -50, category: '' };
      const validation = validateServicePayload(invalidPayload);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
