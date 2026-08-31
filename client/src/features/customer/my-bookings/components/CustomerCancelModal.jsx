import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Wallet, CreditCard, RefreshCw, CheckCircle2, Info } from 'lucide-react';
import { isPaymentSuccessful } from '../../../../utils/status';
import { getSystemSetting } from '../../../../services/SystemService';

const CANCELLATION_REASONS = [
  'Change of plans / Schedule conflict',
  'Found alternative service provider',
  'Booked by mistake / Incorrect service chosen',
  'Price higher than expected',
  'Delay in provider arrival',
  'Other reason'
];

const CustomerCancelModal = ({ isOpen, onClose, onConfirm, booking, loading }) => {
  const [reason, setReason] = useState(CANCELLATION_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [refundDestination, setRefundDestination] = useState('original_payment');
  const [forceWalletOnly, setForceWalletOnly] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getSystemSetting()
        .then(res => {
          const isForceWallet = Boolean(res.data?.data?.walletSettings?.refundToWalletOnly);
          setForceWalletOnly(isForceWallet);
        })
        .catch(err => console.warn('[CustomerCancelModal] Error fetching system data:', err));
    }
  }, [isOpen]);

  if (!isOpen || !booking) return null;

  const totalAmount = booking.totalAmount || 0;
  const platformFee = booking.platformFee || 0;
  const isPaid = isPaymentSuccessful(booking.paymentStatus);

  const walletPaid = booking.walletUsed || (booking.paymentMethod === 'wallet' ? totalAmount : 0);
  const onlinePaid = booking.onlinePaid || (booking.paymentMethod === 'online' ? totalAmount : Math.max(0, totalAmount - walletPaid));
  
  const isMixed = booking.paymentMethod === 'mixed' || (walletPaid > 0 && onlinePaid > 0);
  const isPureWallet = booking.paymentMethod === 'wallet' || onlinePaid <= 0;
  const isPureOnline = (booking.paymentMethod === 'online' || onlinePaid > 0) && !isMixed && !isPureWallet;

  // Original Payment (Razorpay) is allowed ONLY if booking is pure online AND system setting allows original payment refund
  const canChooseOriginalPayment = isPureOnline && !forceWalletOnly;

  // Refund calculation
  const calculatedRefund = Math.max(0, totalAmount - platformFee);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason = reason === 'Other reason' ? (customReason || 'Customer requested cancellation') : reason;
    const finalDestination = canChooseOriginalPayment ? refundDestination : 'wallet';

    onConfirm({
      reason: finalReason,
      refundDestination: finalDestination,
      customerChoice: finalDestination
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in">
      <div 
        className="relative w-full max-w-lg overflow-hidden bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Simple clean header */}
        <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-danger/10 text-danger border border-danger/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-poppins text-secondary">Cancel Booking</h3>
              <p className="text-xs text-gray-500 font-inter">Booking #{booking.bookingId || booking._id?.substring(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/80 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto font-inter">

          {/* Cancellation Reason Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 block">
              Reason for Cancellation <span className="text-danger">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              disabled={loading}
            >
              {CANCELLATION_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {reason === 'Other reason' && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please specify your cancellation reason..."
                rows={2}
                className="w-full mt-2 px-3.5 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
                disabled={loading}
              />
            )}
          </div>

          {/* Refund Destination Selection Section (if booking is paid) */}
          {isPaid && calculatedRefund > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-600">
                  Select Refund Destination
                </label>
                <span className="text-xs font-bold text-success bg-success-light px-2.5 py-1 rounded-full border border-success/30">
                  Eligible Refund: ₹{calculatedRefund}
                </span>
              </div>

              {!canChooseOriginalPayment ? (
                /* Friendly Customer Wallet Refund Notice */
                <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-gray-900 text-sm">Refund to Customer Wallet</p>
                    <p className="text-gray-600">
                      ₹{calculatedRefund} will be credited instantly to your App Wallet for fast & easy future bookings.
                    </p>
                  </div>
                </div>
              ) : (
                /* Customer Choice: Original Source vs Wallet (Pure Online Payment + Allowed by System Settings) */
                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option 1: Original Payment Source */}
                  <label 
                    className={`relative p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      refundDestination === 'original_payment' 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="refundDestination"
                      value="original_payment"
                      checked={refundDestination === 'original_payment'}
                      onChange={() => setRefundDestination('original_payment')}
                      className="sr-only"
                      disabled={loading}
                    />
                    <div className={`p-2 rounded-lg shrink-0 ${refundDestination === 'original_payment' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">Original Payment Source (Razorpay)</span>
                        {refundDestination === 'original_payment' && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        UPI / Card / NetBanking bank account (2-5 business days).
                      </p>
                    </div>
                  </label>

                  {/* Option 2: Customer Wallet */}
                  <label 
                    className={`relative p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      refundDestination === 'wallet' 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="refundDestination"
                      value="wallet"
                      checked={refundDestination === 'wallet'}
                      onChange={() => setRefundDestination('wallet')}
                      className="sr-only"
                      disabled={loading}
                    />
                    <div className={`p-2 rounded-lg shrink-0 ${refundDestination === 'wallet' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">Customer Wallet (Instant)</span>
                        {refundDestination === 'wallet' && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Credit directly to your app wallet balance for instant re-use.
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Monetary Summary Card */}
          {isPaid && (
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Total Amount Paid</span>
                <span className="font-semibold text-gray-900">₹{totalAmount}</span>
              </div>
              {platformFee > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Non-refundable Platform Fee</span>
                  <span className="font-semibold">- ₹{platformFee}</span>
                </div>
              )}
              <div className="pt-1.5 border-t border-gray-200 flex justify-between font-bold text-gray-900 text-sm">
                <span>Net Refund Amount</span>
                <span className="text-primary font-poppins font-bold">₹{calculatedRefund}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              Keep Booking
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-danger hover:bg-red-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerCancelModal;
