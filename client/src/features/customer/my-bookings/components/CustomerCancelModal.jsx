import React, { useState } from 'react';
import { X, AlertTriangle, Wallet, CreditCard, RefreshCw, CheckCircle2 } from 'lucide-react';
import { normalizeStatus } from '../../../../utils/status';

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

  if (!isOpen || !booking) return null;

  const totalAmount = booking.totalAmount || 0;
  const platformFee = booking.platformFee || 0;
  const isPaid = ['paid', 'escrowhold'].includes(normalizeStatus(booking.paymentStatus));
  const isOnlinePayment = booking.paymentMethod === 'online' || booking.paymentMethod === 'mixed' || (booking.onlinePaid && booking.onlinePaid > 0);
  const isPureWallet = booking.paymentMethod === 'wallet' && (!booking.onlinePaid || booking.onlinePaid === 0);

  // Refund calculation
  const calculatedRefund = Math.max(0, totalAmount - platformFee);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalReason = reason === 'Other reason' ? (customReason || 'Customer requested cancellation') : reason;
    const finalDestination = isPureWallet ? 'wallet' : refundDestination;

    onConfirm({
      reason: finalReason,
      refundDestination: finalDestination,
      customerChoice: finalDestination
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 animate-fadeIn">
      <div 
        className="relative w-full max-w-lg overflow-hidden bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-poppins text-white">Cancel Booking</h3>
              <p className="text-xs text-slate-300 font-inter">Booking #{booking.bookingId || booking._id?.substring(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto font-inter">

          {/* Cancellation Reason Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Reason for Cancellation <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
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
                className="w-full mt-2 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                required
                disabled={loading}
              />
            )}
          </div>

          {/* Refund Destination Selection Section (if booking is paid) */}
          {isPaid && calculatedRefund > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Select Refund Destination
                </label>
                <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Eligible Refund: ₹{calculatedRefund}
                </span>
              </div>

              {isPureWallet ? (
                /* Pure Wallet Payment Notice */
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3 text-purple-900">
                  <Wallet className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold">Refund to Customer Wallet</p>
                    <p className="text-purple-700">
                      Since this booking was paid entirely via Wallet balance, ₹{calculatedRefund} will be credited back instantly to your Wallet.
                    </p>
                  </div>
                </div>
              ) : isOnlinePayment ? (
                /* Customer Choice: Original Source vs Wallet */
                <div className="grid grid-cols-1 gap-3">
                  {/* Option 1: Original Payment Source */}
                  <label 
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                      refundDestination === 'original_payment' 
                        ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500/20' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
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
                    <div className={`p-2.5 rounded-lg shrink-0 ${refundDestination === 'original_payment' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">Original Payment Source</span>
                        {refundDestination === 'original_payment' && (
                          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        UPI / Credit Card / Debit Card / Net Banking bank account.
                      </p>
                      <span className="inline-block mt-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded">
                        Est. 3-7 Banking Days
                      </span>
                    </div>
                  </label>

                  {/* Option 2: Customer Wallet */}
                  <label 
                    className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3.5 ${
                      refundDestination === 'wallet' 
                        ? 'border-purple-600 bg-purple-50/40 ring-2 ring-purple-500/20' 
                        : 'border-slate-200 bg-white hover:border-slate-300'
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
                    <div className={`p-2.5 rounded-lg shrink-0 ${refundDestination === 'wallet' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">Customer Wallet</span>
                        {refundDestination === 'wallet' && (
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Credit directly to your app wallet balance for instant re-use.
                      </p>
                      <span className="inline-block mt-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                        ⚡ Instant Wallet Credit
                      </span>
                    </div>
                  </label>
                </div>
              ) : null}
            </div>
          )}

          {/* Monetary Summary Card */}
          {isPaid && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Total Amount Paid</span>
                <span className="font-semibold text-slate-900">₹{totalAmount}</span>
              </div>
              {platformFee > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Non-refundable Platform Fee</span>
                  <span className="font-semibold">- ₹{platformFee}</span>
                </div>
              )}
              <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                <span>Net Refund Amount</span>
                <span className="text-indigo-600 font-poppins">₹{calculatedRefund}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              Keep Booking
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-600/25 transition-all flex items-center gap-2 disabled:opacity-50"
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
