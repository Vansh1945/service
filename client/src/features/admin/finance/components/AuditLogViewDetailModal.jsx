import React from 'react';
import { FiX, FiFileText, FiUser, FiClock, FiShield } from 'react-icons/fi';

const AuditLogViewDetailModal = ({ isOpen, onClose, entityData }) => {
  if (!isOpen || !entityData) return null;

  const data = entityData;
  const action = data.action || data.event || 'ADMIN_ACTION';
  const adminName = data.adminName || data.user?.name || 'Admin User';
  const ipAddress = data.ipAddress || data.ip || '127.0.0.1';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white flex items-center justify-between border-b border-neutral-700/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
              <FiFileText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">System Audit Trail</span>
              <h2 className="text-lg font-black text-white">{action}</h2>
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
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 border-slate-100 flex items-center gap-2">
              <FiShield className="text-primary" /> Audit Log Event Summary
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm pt-1">
              <div>
                <span className="text-xs text-slate-400 font-medium block">Performed By</span>
                <span className="font-bold text-slate-800">{adminName}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">IP Address</span>
                <span className="font-mono font-bold text-slate-800">{ipAddress}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Timestamp</span>
                <span className="font-semibold text-slate-800">
                  {data.createdAt ? new Date(data.createdAt).toLocaleString('en-IN') : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">Target Resource</span>
                <span className="font-mono text-slate-800">{data.resource || data.target || 'Finance System'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 font-mono text-xs overflow-x-auto border border-slate-800">
            <p className="text-[10px] text-slate-400 font-sans font-bold uppercase mb-2">Raw Payload Diff</p>
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

export default AuditLogViewDetailModal;
