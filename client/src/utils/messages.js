/**
 * Centralized Application-Wide User Messaging Standard & Factory Helpers.
 * Enforces plain language, correct grammar, clear results, clear next actions,
 * consistent punctuation, consistent capitalization, and mobile readability.
 * 
 * Never exposes raw stack traces, API status codes, database errors, internal service names,
 * or raw enum strings to Customer, Provider, or Admin users.
 */

export const MSG_PATTERNS = {
  SUCCESS: (action) => `${action} completed successfully.`,
  ERROR: (action, nextStep = 'Please try again.') => `We couldn't ${action} right now. ${nextStep}`,
  WARNING: (condition, nextStep) => `${condition}. ${nextStep}`,
  INFO: (state) => `${state}`,
  LOADING: (action) => `${action} is being processed...`,
  CONFIRMATION: (action) => `Are you sure you want to ${action}?`
};

/**
 * Format a standard success message
 * @param {string} action - Action performed (e.g. "Booking", "Payment")
 * @returns {string} Standardized success message
 */
export const formatSuccess = (action) => {
  if (!action) return 'Operation completed successfully.';
  const cleanAction = action.trim();
  if (cleanAction.toLowerCase().endsWith('completed successfully.')) return cleanAction;
  return MSG_PATTERNS.SUCCESS(cleanAction);
};

/**
 * Format a standard error message
 * @param {string} action - What failed (e.g. "complete your payment", "cancel this booking")
 * @param {string} [nextStep] - Recommended user action
 * @returns {string} Standardized error message
 */
export const formatError = (action, nextStep = 'Please try again.') => {
  if (!action) return `We couldn't complete this action right now. ${nextStep}`;
  const cleanAction = action.trim().replace(/^we couldn't\s+/i, '');
  return MSG_PATTERNS.ERROR(cleanAction, nextStep);
};

/**
 * Format a standard warning message
 * @param {string} condition - Important condition
 * @param {string} nextStep - Action to take
 * @returns {string} Standardized warning message
 */
export const formatWarning = (condition, nextStep) => {
  if (!condition) return nextStep || 'Please check your input and try again.';
  if (!nextStep) return condition;
  return MSG_PATTERNS.WARNING(condition.trim().replace(/\.$/, ''), nextStep.trim());
};

/**
 * Format a standard info message
 * @param {string} state - Current operational state
 * @returns {string} Standardized info message
 */
export const formatInfo = (state) => {
  if (!state) return '';
  return MSG_PATTERNS.INFO(state.trim());
};

/**
 * Format a standard loading message
 * @param {string} action - Action being performed
 * @returns {string} Standardized loading message
 */
export const formatLoading = (action) => {
  if (!action) return 'Your request is being processed...';
  const clean = action.trim().replace(/\.\.\.$/, '');
  return MSG_PATTERNS.LOADING(clean);
};

/**
 * Format a standard confirmation prompt
 * @param {string} action - Action to confirm
 * @returns {string} Standardized confirmation prompt
 */
export const formatConfirmation = (action) => {
  if (!action) return 'Are you sure you want to proceed?';
  const clean = action.trim().replace(/^\?+|\?+$/g, '');
  return MSG_PATTERNS.CONFIRMATION(clean);
};

/**
 * Centralized API Error Normalizer
 * Map status codes, network errors, and timeouts to consistent, user-friendly error objects.
 * 
 * @param {Error|Object|string} error - Axios error, JS Error, status object, or string message
 * @returns {Object} Normalized error payload: { code, status, title, message, isNetworkError, isServerError, isAuthError, isForbidden, isNotFound, isTimeout, isRateLimited, rawError }
 */
export const normalizeApiError = (error) => {
  if (!error) {
    return {
      _isNormalized: true,
      code: 'ERR_UNKNOWN',
      status: null,
      title: 'Something Went Wrong',
      message: 'An unexpected error occurred. Please try again.',
      isNetworkError: false,
      isServerError: false,
      isAuthError: false,
      isForbidden: false,
      isNotFound: false,
      isTimeout: false,
      isRateLimited: false,
      rawError: null,
    };
  }

  // Avoid double-normalizing
  if (typeof error === 'object' && error._isNormalized) {
    return error;
  }

  let status = error?.response?.status || error?.status || null;
  let code = error?.code || error?.response?.data?.code || (status ? `HTTP_${status}` : 'ERR_UNKNOWN');
  let backendMessage = error?.response?.data?.message || error?.response?.data?.error || (typeof error === 'string' ? error : error?.message);

  // Helper to detect technical / backend / DB leak strings
  const isTechnicalMessage = (msg) => {
    if (typeof msg !== 'string' || !msg.trim()) return true;
    const lower = msg.toLowerCase();
    return (
      lower.includes('mongo') ||
      lower.includes('cast') ||
      lower.includes('objectid') ||
      lower.includes('enotfound') ||
      lower.includes('syntaxerror') ||
      lower.includes('econnrefused') ||
      lower.includes('etimedout') ||
      lower.includes('typeerror') ||
      lower.includes('referenceerror') ||
      lower.includes('axioserror') ||
      lower.includes('network error') ||
      lower.includes('internal server') ||
      lower.includes('uncaught') ||
      lower.includes('exception') ||
      lower.includes('stack') ||
      lower.includes('jwt') ||
      lower.includes('token') ||
      lower.includes('[object') ||
      lower.includes('database') ||
      lower.includes('mongoose') ||
      lower.includes('sql') ||
      lower.includes('e11000') ||
      lower.includes('validationerror') ||
      lower.includes('failed with status code') ||
      lower.includes('request failed') ||
      lower.includes('express') ||
      lower.includes('router') ||
      msg.includes('at ') ||
      msg.includes('Error:')
    );
  };

  if (isTechnicalMessage(backendMessage)) {
    backendMessage = null;
  }

  let title = 'Something Went Wrong';
  let message = backendMessage || 'We couldn\'t complete your request right now. Please try again.';
  let isNetworkError = false;
  let isServerError = false;
  let isAuthError = false;
  let isForbidden = false;
  let isNotFound = false;
  let isTimeout = false;
  let isRateLimited = false;

  // Timeout detection
  if (code === 'ECONNABORTED' || error?.message?.toLowerCase().includes('timeout') || status === 408) {
    status = 408;
    code = 'HTTP_408';
    title = 'Request Timed Out';
    message = 'The server took too long to respond. Please check your internet connection and try again.';
    isTimeout = true;
  }
  // Network connection error
  else if (error?.message === 'Network Error' || (!error?.response && error?.request) || (typeof window !== 'undefined' && !window.navigator.onLine && !status)) {
    code = 'ERR_NETWORK';
    title = 'Check Your Internet Connection';
    message = 'Unable to connect to the server. Please verify your internet connection and try again.';
    isNetworkError = true;
  }
  // Status specific handling
  else if (status === 401) {
    code = 'HTTP_401';
    title = 'Session Expired';
    message = backendMessage || 'Your session has expired. Please log in again to continue.';
    isAuthError = true;
  } else if (status === 403) {
    code = 'HTTP_403';
    title = 'Access Denied';
    message = 'You do not have permission to access this resource or perform this action.';
    isForbidden = true;
  } else if (status === 404) {
    code = 'HTTP_404';
    title = 'Resource Not Found';
    message = backendMessage || 'The requested page or resource could not be found.';
    isNotFound = true;
  } else if (status === 429) {
    code = 'HTTP_429';
    title = 'Too Many Requests';
    message = 'You have sent too many requests in a short period. Please slow down and try again.';
    isRateLimited = true;
  } else if (status >= 500 && status <= 599) {
    code = `HTTP_${status}`;
    title = 'Server Temporarily Unavailable';
    message = 'Our servers are experiencing technical difficulty. Please try again shortly.';
    isServerError = true;
  } else if (typeof error === 'string' && !isTechnicalMessage(error)) {
    message = error;
  }

  return {
    _isNormalized: true,
    code,
    status,
    title,
    message,
    isNetworkError,
    isServerError,
    isAuthError,
    isForbidden,
    isNotFound,
    isTimeout,
    isRateLimited,
    rawError: error
  };
};

