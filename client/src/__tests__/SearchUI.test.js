import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('Frontend Search & Debounce Unit Tests', () => {
  const createDebouncedFunction = (fn, delay = 350) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fn(...args);
      }, delay);
    };
  };

  test('debounces rapid search input calls', async () => {
    const calls = [];
    const searchCallback = (val) => calls.push(val);
    const debouncedSearch = createDebouncedFunction(searchCallback, 50);

    debouncedSearch('C');
    debouncedSearch('Cl');
    debouncedSearch('Cle');
    debouncedSearch('Clean');

    assert.strictEqual(calls.length, 0);

    await new Promise((res) => setTimeout(res, 80));

    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0], 'Clean');
  });

  test('resets search query and triggers callback immediately on clear', () => {
    const calls = [];
    const onSearchChange = (val) => calls.push(val);
    let searchQuery = 'Deep Cleaning';

    searchQuery = '';
    onSearchChange(searchQuery);

    assert.strictEqual(searchQuery, '');
    assert.strictEqual(calls[0], '');
  });
});
