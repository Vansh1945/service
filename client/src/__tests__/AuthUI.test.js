import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('Frontend Auth UI & Session Management Unit Tests', () => {
  const validateLoginForm = (email, password) => {
    const errors = {};
    if (!email || !email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Invalid email address format';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    return { isValid: Object.keys(errors).length === 0, errors };
  };

  const logoutUser = () => {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.removeItem('token');
      globalThis.localStorage.removeItem('user');
      globalThis.localStorage.removeItem('role');
    }
  };

  test('validates correct email and password inputs', () => {
    const result = validateLoginForm('user@example.com', 'password123');
    assert.strictEqual(result.isValid, true);
    assert.deepStrictEqual(result.errors, {});
  });

  test('detects invalid email format', () => {
    const result = validateLoginForm('invalid-email-string', 'password123');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.email, 'Invalid email address format');
  });

  test('detects short password', () => {
    const result = validateLoginForm('user@example.com', '123');
    assert.strictEqual(result.isValid, false);
    assert.strictEqual(result.errors.password, 'Password must be at least 6 characters');
  });

  test('clears localStorage session tokens on logout', () => {
    const mockStorage = {};
    globalThis.localStorage = {
      setItem: (key, val) => { mockStorage[key] = val; },
      getItem: (key) => mockStorage[key] || null,
      removeItem: (key) => { delete mockStorage[key]; }
    };

    globalThis.localStorage.setItem('token', 'fake_jwt_token_123');
    globalThis.localStorage.setItem('user', JSON.stringify({ name: 'Test User' }));
    assert.strictEqual(globalThis.localStorage.getItem('token'), 'fake_jwt_token_123');

    logoutUser();

    assert.strictEqual(globalThis.localStorage.getItem('token'), null);
    assert.strictEqual(globalThis.localStorage.getItem('user'), null);
  });
});
