// Vitest setup file for Client UI testing
import { afterEach } from 'vitest';

// Cleanup DOM after each test run
afterEach(() => {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }
});
