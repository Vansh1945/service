import React from 'react';
import { FiX, FiShield, FiAlertTriangle, FiSmartphone, FiMapPin, FiUser, FiActivity } from 'react-icons/fi';

const FraudRiskViewDetailModal = ({ isOpen, onClose, entityData }) => {
  if (!isOpen || !entityData) return null;

  const data = entityData;
  const riskLevel = (data.riskLevel || data.severity || 'HIGH').toUpperCase();
  const title = data.ruleTriggered || data.reason || 'Security Anomaly Detected';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white flex items-center justify-between border-b border-neutral-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <FiShield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">Fraud & Security Audit</span>
                <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full ${
                  riskLevel === 'CRITICAL' || riskLevel === 'HIGH' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                  'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {riskLevel} RISK
                </span>
              </div>
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
          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start gap-3">
            <FiAlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <div className="text-xs text-rose-950 space-y-1">
              <p className="font-bold uppercase tracking-wider text-rose-800">Risk Assessment Flag</p>
              <p>{data.description || data.flaggedReason || 'Suspicious payment pattern or multiple failed verification attempts flagged by security engine.'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
                <FiUser className="text-primary" /> Flagged Account Details
              </h3>
              <div className="space-y-2 text-sm pt-1">
                <div>
                  <span className="text-xs text-slate-400 font-medium block">User ID / Name</span>
                  <span className="font-bold text-slate-800">{data.userName || data.userId || 'Anonymous User'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Email / Contact</span>
                  <span className="font-semibold text-slate-800">{data.userEmail || data.contact || 'N/A'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
                <FiSmartphone className="text-primary" /> Device & Network Fingerprint
              </h3>
              <div className="space-y-2 text-sm pt-1">
                <div>
                  <span className="text-xs text-slate-400 font-medium block">IP Address</span>
                  <span className="font-mono font-bold text-slate-800">{data.ipAddress || '192.168.1.1'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Location / Device</span>
                  <span className="font-semibold text-slate-800">{data.location || data.device || 'Web Browser'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Raw Log */}
          <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-xs overflow-x-auto border border-slate-800">
            <p className="text-[10px] text-slate-400 font-sans font-bold uppercase mb-2">Raw Security Log Payload</p>
            <pre>{JSON.stringify(data, null, 2)}</pre>
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

export default FraudRiskViewDetailModal;
