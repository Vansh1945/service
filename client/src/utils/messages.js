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
