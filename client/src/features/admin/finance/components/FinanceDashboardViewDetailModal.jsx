import React from 'react';
import { FiX, FiTrendingUp, FiPieChart, FiActivity } from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';

const FinanceDashboardViewDetailModal = ({ isOpen, onClose, entityType, entityData }) => {
  if (!isOpen || !entityData) return null;

  const title = entityData.title || 'Executive Financial Metric';
  const amount = entityData.amount || entityData.value || 0;
  const details = entityData.extra || entityData.details || {};

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-xl border border-neutral-200 flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 bg-neutral-900 text-white flex items-center justify-between border-b border-neutral-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <FiTrendingUp className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Dashboard Metric</span>
              <h2 className="text-base font-bold text-white leading-tight">{title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 bg-neutral-50/30">
          <div className="p-5 bg-white rounded-2xl border border-neutral-200 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Current Metric Total</p>
              <p className="text-2xl font-black text-neutral-900 mt-1">
                {typeof amount === 'number' ? <PriceDisplay amount={amount} /> : amount}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <FiActivity className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider border-b pb-2 border-neutral-100 flex items-center gap-2">
              <FiPieChart className="text-primary" /> Metric Context & Attributes
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <span className="text-[11px] text-neutral-400 font-medium block">Category</span>
                <span className="font-bold text-neutral-800 uppercase">{entityType || 'Financial KPI'}</span>
              </div>
              <div>
                <span className="text-[11px] text-neutral-400 font-medium block">Frequency</span>
                <span className="font-bold text-neutral-800">Real-Time (Backend DB)</span>
              </div>
            </div>

            {Object.keys(details).length > 0 && (
              <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                <p className="text-[11px] font-bold text-neutral-500 uppercase">Attributes</p>
                <div className="bg-neutral-50 p-3 rounded-xl space-y-1 font-mono text-xs text-neutral-700">
                  {Object.entries(details).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-neutral-500">{key}:</span>
                      <span className="font-bold text-neutral-900">{String(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-neutral-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default FinanceDashboardViewDetailModal;
