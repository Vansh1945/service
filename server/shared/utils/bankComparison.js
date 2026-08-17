/**
 * Enterprise Reusable Bank & UPI Details Comparison Helper
 * Single Source of Truth for comparing new bank/UPI details against current stored details.
 */

const normalizeString = (str) => {
  if (str === null || str === undefined) return '';
  return String(str).trim().replace(/\s+/g, ' ');
};

const normalizeIfsc = (str) => {
  return normalizeString(str).toUpperCase();
};

const normalizeUpi = (str) => {
  return normalizeString(str).toLowerCase();
};

/**
 * Compares current bank details with new proposed bank details.
 * Returns true if identical, false if changed.
 */
const isSameBankDetails = (currentDetails = {}, newDetails = {}) => {
  if (!currentDetails) currentDetails = {};
  if (!newDetails) newDetails = {};

  const currentAccountNo = normalizeString(currentDetails.accountNo);
  const newAccountNo = normalizeString(newDetails.accountNo);

  const currentIfsc = normalizeIfsc(currentDetails.ifsc);
  const newIfsc = normalizeIfsc(newDetails.ifsc);

  const currentAccountName = normalizeString(currentDetails.accountName);
  const newAccountName = normalizeString(newDetails.accountName);

  const currentBankName = normalizeString(currentDetails.bankName);
  const newBankName = normalizeString(newDetails.bankName);

  // If no bank account existed before and new data is empty -> Same
  if (!currentAccountNo && !newAccountNo) return true;

  // Account No
  if (newAccountNo && currentAccountNo !== newAccountNo) return false;

  // IFSC
  if (newIfsc && currentIfsc !== newIfsc) return false;

  // Account Name
  if (newAccountName && currentAccountName !== newAccountName) return false;

  // Bank Name (optional comparison if provided)
  if (newBankName && currentBankName && currentBankName !== newBankName) return false;

  return true;
};

/**
 * Compares current UPI details with new proposed UPI details.
 * Returns true if identical, false if changed.
 */
const isSameUPIDetails = (currentDetails = {}, newDetails = {}) => {
  if (!currentDetails) currentDetails = {};
  if (!newDetails) newDetails = {};

  const currentUpi = normalizeUpi(currentDetails.upiId);
  const newUpi = normalizeUpi(newDetails.upiId);

  if (!currentUpi && !newUpi) return true;

  return currentUpi === newUpi;
};

/**
 * Comprehensive check for both Bank & UPI.
 */
const isSamePayoutDetails = (currentDetails = {}, newDetails = {}) => {
  const bankSame = isSameBankDetails(currentDetails, newDetails);
  const upiSame = isSameUPIDetails(currentDetails, newDetails);

  // If checking Bank payload
  if (newDetails.accountNo || newDetails.ifsc || newDetails.accountName) {
    return bankSame;
  }

  // If checking UPI payload
  if (newDetails.upiId !== undefined) {
    return upiSame;
  }

  return bankSame && upiSame;
};

module.exports = {
  isSameBankDetails,
  isSameUPIDetails,
  isSamePayoutDetails
};
