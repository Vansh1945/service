/**
 * Enterprise Provider Payout Readiness & Status Hook / Utility
 * Single Source of Truth for Provider Payout & Bank Verification State across the app.
 *
 * Rules:
 * - bankVerificationStatus: 'pending' | 'verified' | 'rejected'
 * - payoutEnabled: boolean
 * - Withdrawal Ready = bankVerificationStatus === 'verified' AND payoutEnabled === true
 */

export const getProviderPayoutState = (providerOrBankDetails) => {
  const bd = providerOrBankDetails
    ? (providerOrBankDetails.bankDetails !== undefined
        ? (providerOrBankDetails.bankDetails || {})
        : providerOrBankDetails)
    : {};

  const accountNo = bd.accountNo || '';
  const maskedAccountNo = accountNo && accountNo.length >= 4
    ? `•••• ${accountNo.slice(-4)}`
    : accountNo;

  const hasBank = !!(accountNo && bd.ifsc);
  const hasUpi = !!bd.upiId;
  const hasPayoutDestination = hasBank || hasUpi;

  // Document/passbook exists check
  const hasRequiredDocument = !hasBank || !!bd.passbookImage;

  // Normalize status values to lowercase
  const normalizeStatus = (val) => {
    if (!val) return '';
    return String(val).trim().toLowerCase();
  };

  const rawStatus = bd.bankVerificationStatus || (bd.verified ? 'verified' : 'pending');
  const bankVerificationStatus = ['pending', 'verified', 'rejected'].includes(normalizeStatus(rawStatus))
    ? normalizeStatus(rawStatus)
    : 'pending';

  const payoutEnabled = bd.payoutEnabled === true;
  const isVerified = bankVerificationStatus === 'verified' && bd.verified === true;

  // Withdrawal Ready only when:
  // - bank account or UPI exists
  // - bankVerificationStatus === 'verified'
  // - verified === true
  // - payoutEnabled === true
  // - required bank document/passbook exists (if bank account)
  const isWithdrawalReady = hasPayoutDestination && isVerified && payoutEnabled && hasRequiredDocument;

  // Determine preferred method
  let preferredMethod = 'NOT_CONFIGURED';
  if (isWithdrawalReady) {
    const dbPref = String(bd.preferredMethod || bd.defaultMethod || 'bank_account').toLowerCase();
    if (dbPref === 'upi' && hasUpi) {
      preferredMethod = 'UPI';
    } else if (hasBank) {
      preferredMethod = 'BANK_ACCOUNT';
    } else if (hasUpi) {
      preferredMethod = 'UPI';
    }
  }

  let statusLabel = 'Setup Required';
  let statusColor = 'amber';
  let withdrawalReadyLabel = 'No (Add Bank Account)';

  if (!hasPayoutDestination) {
    statusLabel = 'Setup Required';
    statusColor = 'amber';
    withdrawalReadyLabel = 'No (Add Bank Account)';
  } else if (bankVerificationStatus === 'verified' && !payoutEnabled) {
    statusLabel = 'Payout Disabled';
    statusColor = 'rose';
    withdrawalReadyLabel = 'No (Payout Disabled)';
  } else if (bankVerificationStatus === 'verified') {
    statusLabel = 'Verified / Ready';
    statusColor = 'emerald';
    withdrawalReadyLabel = 'Yes (Ready)';
  } else if (bankVerificationStatus === 'rejected') {
    statusLabel = 'Rejected';
    statusColor = 'rose';
    withdrawalReadyLabel = 'No (Bank Verification Rejected)';
  } else {
    // pending
    statusLabel = 'Pending Review';
    statusColor = 'amber';
    withdrawalReadyLabel = 'No (Pending Verification)';
  }

  return {
    bankDetails: providerOrBankDetails ? bd : null,
    bankVerificationStatus,
    verified: isVerified,
    payoutEnabled,
    isWithdrawalReady,
    bankName: bd.bankName || '',
    accountNo,
    maskedAccountNo,
    ifsc: bd.ifsc || '',
    upiId: bd.upiId || '',
    hasBank,
    hasUpi,
    preferredMethod,
    bankRejectReason: bd.bankRejectReason || null,
    statusLabel,
    statusColor,
    withdrawalReadyLabel
  };
};
