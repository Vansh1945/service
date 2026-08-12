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
  if (!providerOrBankDetails) {
    return {
      bankDetails: null,
      bankVerificationStatus: 'pending',
      verified: false,
      payoutEnabled: false,
      isWithdrawalReady: false,
      bankName: '',
      accountNo: '',
      maskedAccountNo: '',
      ifsc: '',
      upiId: '',
      hasBank: false,
      hasUpi: false,
      preferredMethod: 'bank_account',
      bankRejectReason: null,
      statusLabel: 'Pending Review',
      statusColor: 'amber'
    };
  }

  // Support passing either provider object or provider.bankDetails directly
  const bd = providerOrBankDetails.bankDetails !== undefined
    ? (providerOrBankDetails.bankDetails || {})
    : providerOrBankDetails;

  const rawStatus = bd.bankVerificationStatus || (bd.verified ? 'verified' : 'pending');
  const bankVerificationStatus = ['pending', 'verified', 'rejected'].includes(rawStatus)
    ? rawStatus
    : 'pending';

  const payoutEnabled = bd.payoutEnabled === true;
  const isVerified = bankVerificationStatus === 'verified';
  const isWithdrawalReady = isVerified && payoutEnabled;

  const accountNo = bd.accountNo || '';
  const maskedAccountNo = accountNo && accountNo.length >= 4
    ? `•••• ${accountNo.slice(-4)}`
    : accountNo;

  const hasBank = !!(accountNo && bd.ifsc);
  const hasUpi = !!bd.upiId;

  let statusLabel = 'Pending Review';
  let statusColor = 'amber';

  if (bankVerificationStatus === 'verified') {
    statusLabel = payoutEnabled ? 'Verified & Active' : 'Verified';
    statusColor = 'emerald';
  } else if (bankVerificationStatus === 'rejected') {
    statusLabel = 'Verification Rejected';
    statusColor = 'rose';
  }

  return {
    bankDetails: bd,
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
    preferredMethod: bd.preferredMethod || 'bank_account',
    bankRejectReason: bd.bankRejectReason || null,
    statusLabel,
    statusColor
  };
};
