import React from 'react';
import { FiX, FiCreditCard, FiUser, FiActivity, FiArrowUpRight, FiArrowDownLeft } from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import { formatDateTime } from '../../../../utils/format';

const WalletViewDetailModal = ({ isOpen, onClose, entityData }) => {
  if (!isOpen || !entityData) return null;

  const data = entityData;
  const balance = data.balance || data.walletBalance || 0;
  const userName = data.user?.name || data.name || 'Account Holder';
  const role = (data.user?.role || data.role || 'CUSTOMER').toUpperCase();
  const transactions = data.transactions || data.history || [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white flex items-center justify-between border-b border-neutral-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <FiCreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">{role} WALLET DETAIL</span>
              </div>
              <h2 className="text-lg font-black text-white">{userName}</h2>
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
          <div className="p-5 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-between">
            <div>
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Current Wallet Balance</p>
              <p className="text-3xl font-black text-neutral-900 mt-1">
                <PriceDisplay amount={balance} />
              </p>
            </div>
            <div className="px-3 py-1 bg-white rounded-xl shadow-xs text-xs font-bold text-primary border border-primary/30">
              ACTIVE LEDGER
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
              <FiActivity className="text-primary" /> Recent Wallet Activity
            </h3>
            
            {transactions.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No recent credit/debit records found for this wallet.</p>
            ) : (
              <div className="space-y-2">
                {transactions.slice(0, 5).map((txn, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      {txn.type === 'CREDIT' ? (
                        <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg"><FiArrowDownLeft /></span>
                      ) : (
                        <span className="p-1.5 bg-rose-100 text-rose-700 rounded-lg"><FiArrowUpRight /></span>
                      )}
                      <div>
                        <p className="font-bold text-slate-800">{txn.description || txn.type}</p>
                        <p className="text-[10px] text-slate-400">{txn.date ? formatDateTime(txn.date) : 'Recent'}</p>
                      </div>
                    </div>
                    <span className={`font-black ${txn.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {txn.type === 'CREDIT' ? '+' : '-'}<PriceDisplay amount={txn.amount || 0} />
                    </span>
                  </div>
                ))}
              </div>
            )}
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

export default WalletViewDetailModal;
