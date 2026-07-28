import React from 'react';
import { FiX, FiCheckCircle, FiDollarSign, FiLayers, FiCreditCard } from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';

const SettlementViewDetailModal = ({ isOpen, onClose, entityData }) => {
  if (!isOpen || !entityData) return null;

  const data = entityData;
  const bookingAmount = data.grossAmount || data.bookingSettlement || data.amount || 0;
  const providerShare = data.providerShare || data.providerSettlement || 0;
  const commission = data.platformCommission || data.commissionSettlement || 0;
  const status = (data.status || 'SETTLED').toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white flex items-center justify-between border-b border-neutral-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <FiCheckCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">Bank Reconciliation & Settlement</span>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {status}
                </span>
              </div>
              <h2 className="text-lg font-black text-white">{data.settlementId || data._id || 'Settlement Batch'}</h2>
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
        <div className="p-6 space-y-6 bg-slate-50/50">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Gross Booking Collection</p>
              <p className="text-xl font-black text-neutral-900 mt-1">
                <PriceDisplay amount={bookingAmount} />
              </p>
            </div>
            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100">
              <p className="text-xs text-blue-700 font-bold uppercase tracking-wider">Provider Payable Share</p>
              <p className="text-xl font-black text-blue-900 mt-1">
                <PriceDisplay amount={providerShare} />
              </p>
            </div>
            <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100">
              <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider">Platform Net Revenue</p>
              <p className="text-xl font-black text-emerald-900 mt-1">
                <PriceDisplay amount={commission} />
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
              <FiLayers className="text-primary" /> Settlement Properties
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm pt-1">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Settlement Ref / Batch ID</span>
                <span className="font-mono font-bold text-slate-800">{data.settlementId || data._id || 'N/A'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Settlement Date</span>
                <span className="font-bold text-slate-800">
                  {data.createdAt ? new Date(data.createdAt).toLocaleString('en-IN') : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Gateway Payout ID</span>
                <span className="font-mono text-slate-700">{data.gatewayPayoutId || 'pout_RazorpayDirect'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Reconciliation Status</span>
                <span className="font-bold text-emerald-600">100% Reconciled (Zero Difference)</span>
              </div>
            </div>
          </div>
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

export default SettlementViewDetailModal;
