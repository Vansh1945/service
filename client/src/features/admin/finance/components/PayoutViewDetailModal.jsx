import React from 'react';
import { FiX, FiDollarSign, FiUser, FiCreditCard, FiCheckCircle, FiXCircle, FiClock, FiFileText, FiRefreshCw, FiSend, FiShield, FiLink } from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import { formatDate, formatDateTime } from '../../../../utils/format';
import { getWithdrawalStatusBadge } from '../../../../utils/status';
import { useAdminFilter } from '../../../../context/AdminFilterContext';

const maskAccNo = (acc) => {
  if (!acc || acc === 'N/A') return '••••••••';
  const str = String(acc);
  return str.length > 4 ? `•••• ${str.slice(-4)}` : str;
};

const PayoutViewDetailModal = ({ isOpen, onClose, entityData, payoutMode = 'manual' }) => {
  const { getEntityRoute } = useAdminFilter();

  if (!isOpen || !entityData) return null;

  const data = entityData;
  const status = (data.status || 'PENDING').toLowerCase();
  const statusBadge = getWithdrawalStatusBadge(status);
  const isRazorpayX = payoutMode === 'razorpayx' || data.withdrawalType === 'razorpayx';

  const provider = data.provider || {};
  const providerName = provider.name || data.providerName || 'Service Provider';
  const providerPhone = provider.phone || data.providerPhone || 'N/A';
  const providerEmail = provider.email || data.providerEmail || 'N/A';
  const amount = data.amount || 0;

  const bank = data.paymentDetails || data.bankDetails || {};
  const accountName = bank.accountName || provider.bankDetails?.accountName || providerName;

  const handleEntityClick = (type, id) => {
    if (id) {
      const route = getEntityRoute(type, id);
      if (route) window.location.href = route;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white flex items-center justify-between border-b border-neutral-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <FiDollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">
                  {isRazorpayX ? 'RazorpayX Automated Payout Detail' : 'Manual Withdrawal Details'}
                </span>
                <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
              </div>
              <h2 className="text-lg font-black text-white">{data.transactionReference || `#${(data._id || '').slice(-8)}`}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 bg-slate-50/50 overflow-y-auto">
          {/* Top Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Withdrawal Amount</p>
              <p className="text-3xl font-black text-neutral-900 mt-1">
                <PriceDisplay amount={amount} />
              </p>
            </div>
            <div className="p-4 bg-slate-100/70 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">UTR / Reference No.</p>
              <p className="text-lg font-mono font-bold text-slate-900 mt-1">
                {data.utrNo || data.transactionReference || 'Pending Batch Settlement'}
              </p>
            </div>
          </div>

          {/* Mode Specific Section Header */}
          <div className="px-4 py-2.5 bg-slate-200/60 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FiShield className="text-primary" /> Active Engine Strategy: <strong className="uppercase">{data.withdrawalType || (isRazorpayX ? 'RAZORPAYX' : 'MANUAL_BULK')}</strong>
            </span>
            <span className="text-slate-500">Requested: {formatDate(data.createdAt)}</span>
          </div>

          {/* Provider Info */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center justify-between">
              <span className="flex items-center gap-2"><FiUser className="text-primary" /> Service Provider Information</span>
              {data.provider && (
                <button
                  type="button"
                  onClick={() => handleEntityClick('provider', data.provider._id || data.provider)}
                  className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <FiLink /> View Profile
                </button>
              )}
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm pt-1">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Provider Name</span>
                <span className="font-bold text-slate-800">{providerName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Phone</span>
                <span className="font-semibold text-slate-800">{providerPhone}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Email</span>
                <span className="font-semibold text-slate-800">{providerEmail}</span>
              </div>
            </div>
          </div>

          {/* Bank Account Details */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
              <FiCreditCard className="text-primary" /> {data.paymentMethod === 'upi' ? 'Beneficiary UPI Account' : 'Beneficiary Bank Account'}
            </h3>
            {data.paymentMethod === 'upi' ? (
              <div className="grid grid-cols-2 gap-4 text-sm pt-1">
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Account Name</span>
                  <span className="font-bold text-slate-800">{accountName}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">UPI ID / VPA</span>
                  <span className="font-mono font-bold text-slate-800">
                    {bank.upiId 
                      ? bank.upiId 
                      : (provider.bankDetails?.upiId 
                        ? `${provider.bankDetails.upiId} (Fallback)` 
                        : 'Destination unavailable in historical record')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">UPI Verification Status</span>
                  <span className="font-semibold text-slate-800">{provider.bankDetails?.upiVerificationStatus || 'N/A'}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-1">
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Account Name</span>
                  <span className="font-bold text-slate-800">{accountName}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Bank Name</span>
                  <span className="font-bold text-slate-800">{bank.bankName || provider.bankDetails?.bankName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Account Number</span>
                  <span className="font-mono font-bold text-slate-800">
                    {bank.accountNumber 
                      ? maskAccNo(bank.accountNumber) 
                      : ((provider.bankDetails?.accountNo || provider.bankDetails?.accountNumber)
                        ? `${maskAccNo(provider.bankDetails.accountNo || provider.bankDetails.accountNumber)} (Fallback)` 
                        : 'Destination unavailable in historical record')}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">IFSC Code</span>
                  <span className="font-mono font-bold text-slate-800">{bank.ifscCode || provider.bankDetails?.ifsc || provider.bankDetails?.ifscCode || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Bank Verification Status</span>
                  <span className="font-semibold text-slate-800">{provider.bankDetails?.bankVerificationStatus || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>

          {/* RazorpayX Advanced Diagnostics (Future Mode Only) */}
          {isRazorpayX ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
                <FiSend className="text-primary" /> RazorpayX Payout Engine Status & Diagnostics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Contact Status</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{data.contactStatus || 'Active (Configured)'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Fund Account Status</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{data.fundAccountStatus || 'Verified'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Razorpay Payout ID</span>
                  <span className="font-mono font-bold text-slate-800 mt-0.5 block">{data.razorpayPayoutId || 'N/A (Disabled)'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Retry Count</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{data.retryCount !== undefined ? `${data.retryCount} Attempts` : '0 Retries'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Webhook Status</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{data.webhookEvent || 'Not Triggered'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-medium">Settlement Status</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{data.settlementStatus || 'Batch Pending'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
                <FiFileText className="text-primary" /> Manual Processing Log
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Processed By Admin</span>
                  <span className="font-bold text-slate-800">{data.admin?.name || 'Admin'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Transfer Date</span>
                  <span className="font-bold text-slate-800">{data.transferDate ? formatDate(data.transferDate) : 'Pending'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Transfer Time</span>
                  <span className="font-bold text-slate-800">{data.transferTime || '—'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Linked Entities Drawers Quick Links */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
              <FiLink className="text-primary" /> Linked Audit Entities
            </h3>
            <div className="flex flex-wrap gap-2 pt-1">
              {data.booking && (
                <button
                  type="button"
                  onClick={() => handleEntityClick('booking', data.booking._id || data.booking)}
                  className="px-3 py-1.5 bg-teal-50 text-teal-700 hover:bg-teal-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-teal-200 cursor-pointer"
                >
                  Booking #{data.booking.bookingId || String(data.booking._id || data.booking).slice(-6)}
                </button>
              )}
              {data.payment && (
                <button
                  type="button"
                  onClick={() => handleEntityClick('payment', data.payment._id || data.payment)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-blue-200 cursor-pointer"
                >
                  Payment #{String(data.payment._id || data.payment).slice(-6)}
                </button>
              )}
              {data.settlement && (
                <button
                  type="button"
                  onClick={() => handleEntityClick('settlement', data.settlement._id || data.settlement)}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-indigo-200 cursor-pointer"
                >
                  Settlement
                </button>
              )}
              {data.walletTransaction && (
                <button
                  type="button"
                  onClick={() => handleEntityClick('wallet', data.walletTransaction._id || data.walletTransaction)}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-purple-200 cursor-pointer"
                >
                  Wallet Transaction
                </button>
              )}
              {data.complaint && (
                <button
                  type="button"
                  onClick={() => handleEntityClick('complaint', data.complaint._id || data.complaint)}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-rose-200 cursor-pointer"
                >
                  Complaint Ticket
                </button>
              )}
              {!data.booking && !data.payment && !data.settlement && !data.walletTransaction && !data.complaint && (
                <span className="text-xs text-slate-400 italic">No linked entities attached to this withdrawal request.</span>
              )}
            </div>
          </div>

          {data.adminRemark && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-bold uppercase tracking-wider text-amber-700">Admin Remarks</p>
              <p>{data.adminRemark}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayoutViewDetailModal;
