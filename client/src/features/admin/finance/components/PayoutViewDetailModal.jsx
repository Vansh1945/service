import React, { useState } from 'react';
import { FiX, FiDollarSign, FiUser, FiCreditCard, FiCheckCircle, FiXCircle, FiClock, FiFileText } from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';

const PayoutViewDetailModal = ({ isOpen, onClose, entityData }) => {
  if (!isOpen || !entityData) return null;

  const data = entityData;
  const status = (data.status || 'PENDING').toUpperCase();
  const providerName = data.provider?.name || data.providerName || 'Service Provider';
  const providerPhone = data.provider?.phone || data.providerPhone || 'N/A';
  const amount = data.amount || 0;
  const bankName = data.bankDetails?.bankName || data.bankName || 'N/A';
  const accountNumber = data.bankDetails?.accountNumber || data.accountNumber || 'N/A';
  const ifscCode = data.bankDetails?.ifscCode || data.ifscCode || 'N/A';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white flex items-center justify-between border-b border-neutral-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <FiDollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">Payout & Withdrawal Detail</span>
                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                  status === 'APPROVED' || status === 'COMPLETED' || status === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  status === 'REJECTED' || status === 'FAILED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                  'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {status}
                </span>
              </div>
              <h2 className="text-lg font-black text-white">{data._id || 'Withdrawal Request'}</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
              <p className="text-xs text-primary font-bold uppercase tracking-wider">Payout Amount</p>
              <p className="text-3xl font-black text-neutral-900 mt-1">
                <PriceDisplay amount={amount} />
              </p>
            </div>
            <div className="p-4 bg-slate-100/70 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">UTR / Reference No.</p>
              <p className="text-lg font-mono font-bold text-slate-900 mt-1">
                {data.utrNo || data.transactionId || 'Pending Batch Settlement'}
              </p>
            </div>
          </div>

          {/* Provider Info */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
              <FiUser className="text-primary" /> Service Provider Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm pt-1">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Provider Name</span>
                <span className="font-bold text-slate-800">{providerName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Phone</span>
                <span className="font-semibold text-slate-800">{providerPhone}</span>
              </div>
            </div>
          </div>

          {/* Bank Account Details */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
              <FiCreditCard className="text-primary" /> Beneficiary Bank Account
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm pt-1">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Bank Name</span>
                <span className="font-bold text-slate-800">{bankName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Account Number</span>
                <span className="font-mono font-bold text-slate-800">{accountNumber}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">IFSC Code</span>
                <span className="font-mono font-bold text-slate-800">{ifscCode}</span>
              </div>
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
