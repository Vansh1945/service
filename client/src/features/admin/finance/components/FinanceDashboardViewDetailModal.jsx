import React from 'react';
import { FiX, FiTrendingUp, FiPieChart, FiDollarSign, FiActivity, FiLayers } from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';

const FinanceDashboardViewDetailModal = ({ isOpen, onClose, entityType, entityData }) => {
  if (!isOpen || !entityData) return null;

  const title = entityData.title || 'Executive Financial Metric';
  const amount = entityData.amount || entityData.value || 0;
  const details = entityData.extra || entityData.details || {};

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white flex items-center justify-between border-b border-neutral-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <FiTrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">Dashboard Deep-Dive</span>
              <h2 className="text-lg font-black text-white">{title}</h2>
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
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Current Metric Total</p>
              <p className="text-3xl font-black text-neutral-900 mt-1">
                {typeof amount === 'number' ? <PriceDisplay amount={amount} /> : amount}
              </p>
            </div>
            <div className="p-3 bg-white rounded-2xl shadow-xs text-primary">
              <FiActivity className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
              <FiPieChart className="text-primary" /> Metric Breakdown & Context
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm pt-2">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Metric Category</span>
                <span className="font-bold text-slate-800 uppercase">{entityType || 'Financial KPI'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Calculation Frequency</span>
                <span className="font-bold text-slate-800">Real-Time (Live Backend DB)</span>
              </div>
            </div>

            {Object.keys(details).length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase">Additional Attributes</p>
                <div className="bg-slate-50 p-3 rounded-xl space-y-1 font-mono text-xs text-slate-700">
                  {Object.entries(details).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-slate-500">{key}:</span>
                      <span className="font-bold text-slate-900">{String(val)}</span>
                    </div>
                  ))}
                </div>
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

export default FinanceDashboardViewDetailModal;
