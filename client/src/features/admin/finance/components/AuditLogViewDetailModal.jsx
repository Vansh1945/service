import React from 'react';
import { FiX, FiShield, FiUser, FiFileText, FiClock, FiAlertCircle } from 'react-icons/fi';
import { fmtDate } from '../../../../utils/format';

const InfoRow = ({ label, value, mono = false, badge }) => (
  <div className="flex items-start justify-between py-2 border-b border-neutral-100 last:border-0 gap-4 text-xs">
    <span className="text-neutral-500 font-medium shrink-0">{label}</span>
    <span className={`font-semibold text-secondary text-right ${mono ? 'font-mono break-all' : ''}`}>
      {badge || value || '—'}
    </span>
  </div>
);

const SectionCard = ({ title, icon: Icon, children }) => (
  <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
    <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/50">
      {Icon && <Icon className="w-4 h-4 text-primary" />}
      <h3 className="text-xs font-bold text-secondary uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const StatusChip = ({ label, type = 'success' }) => {
  const types = {
    success: 'bg-success-light text-success border-success/30',
    warning: 'bg-warning-light text-warning border-warning/30',
    danger: 'bg-danger-light text-danger border-danger/30',
    info: 'bg-info/10 text-info border-info/30',
    default: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border rounded-full ${types[type] || types.default}`}>
      {label}
    </span>
  );
};

const AuditLogViewDetailModal = ({ isOpen, onClose, entityData }) => {
  if (!isOpen || !entityData) return null;

  const log = entityData;
  const action = log.actionDisplay || log.actionType || log.action || log.event || 'ADMIN_ACTION';
  const moduleName = log.moduleDisplay || log.module || log.targetModule || 'System Audit';
  const entityName = log.entityDisplay || log.userModel || log.targetEntity || log.resource || 'Audit Record';
  const entityId = log.entityIdDisplay || log.entityId || log._id;
  const status = log.statusDisplay || log.status || 'Success';

  const adminName = log.adminName || log.userId?.name || log.user?.name || 'Platform Admin';
  const adminEmail = log.adminEmail || log.userId?.email || log.user?.email || 'N/A';
  const adminRole = log.adminRole || log.userId?.role || log.user?.role || 'Admin';
  const ipAddress = log.ipDisplay || log.ipAddress || log.ip || '127.0.0.1';
  const userAgent = log.userAgent || log.deviceInfo || log.device || 'N/A';

  const reason = log.reason || log.flagReason || log.description || log.remarks || null;
  const remarks = log.remarks && log.remarks !== reason ? log.remarks : null;

  const beforeValue = log.beforeValue || log.beforeState || log.diffState?.beforeValue || null;
  const afterValue = log.afterValue || log.afterState || log.diffState?.afterValue || null;
  const metadata = log.metadata || log.auditMetadata || null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-secondary/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-secondary text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-lg text-primary">
              <FiShield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Audit Log Details</h2>
                <StatusChip label={action} type="info" />
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                Log ID: #{String(log._id || '').slice(-8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-neutral-50/50">
          
          {/* Section 1: Audit Summary & Performed By */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="Audit Summary" icon={FiShield}>
              <InfoRow label="Action" value={action} mono />
              <InfoRow label="Module" value={moduleName} />
              <InfoRow label="Target Entity" value={entityName} />
              <InfoRow label="Entity ID" value={entityId ? String(entityId) : 'N/A'} mono />
              <InfoRow label="Status" badge={<StatusChip label={status.toUpperCase()} type={status.toLowerCase() === 'success' ? 'success' : 'danger'} />} />
              <InfoRow label="Timestamp" value={fmtDate(log.createdAt || log.timestamp)} />
            </SectionCard>

            <SectionCard title="Performed By" icon={FiUser}>
              <InfoRow label="Admin Name" value={adminName} />
              <InfoRow label="Admin Email" value={adminEmail} />
              <InfoRow label="Admin Role" value={String(adminRole).toUpperCase()} />
              <InfoRow label="IP Address" value={ipAddress} mono />
              <InfoRow label="Device / Agent" value={userAgent} />
            </SectionCard>
          </div>

          {/* Section 2: Audit Reason & Remarks */}
          {(reason || remarks) && (
            <SectionCard title="Audit Reason & Remarks" icon={FiAlertCircle}>
              {reason && (
                <div className="mb-2">
                  <span className="text-xs font-semibold text-neutral-500 block mb-1">Reason / Description</span>
                  <p className="text-xs text-secondary bg-neutral-50 p-3 rounded-lg border border-neutral-200 leading-relaxed font-medium">
                    {reason}
                  </p>
                </div>
              )}
              {remarks && (
                <div>
                  <span className="text-xs font-semibold text-neutral-500 block mb-1">Additional Remarks</span>
                  <p className="text-xs text-secondary bg-neutral-50 p-3 rounded-lg border border-neutral-200 leading-relaxed font-medium">
                    {remarks}
                  </p>
                </div>
              )}
            </SectionCard>
          )}

          {/* Section 3: State Change (Before vs After) */}
          {(beforeValue || afterValue) && (
            <SectionCard title="State Change" icon={FiFileText}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold text-danger uppercase tracking-wider block mb-1.5">Before</span>
                  <pre className="p-3 bg-neutral-900 text-neutral-200 font-mono text-[11px] rounded-lg border border-neutral-800 overflow-x-auto max-h-[180px]">
                    {JSON.stringify(beforeValue || {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <span className="text-xs font-bold text-success uppercase tracking-wider block mb-1.5">After</span>
                  <pre className="p-3 bg-neutral-900 text-neutral-200 font-mono text-[11px] rounded-lg border border-neutral-800 overflow-x-auto max-h-[180px]">
                    {JSON.stringify(afterValue || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Section 4: Audit Metadata (only if explicitly present) */}
          {metadata && Object.keys(metadata).length > 0 && (
            <SectionCard title="Audit Metadata" icon={FiFileText}>
              <pre className="p-3 bg-neutral-900 text-neutral-200 font-mono text-[11px] rounded-lg border border-neutral-800 overflow-x-auto max-h-[160px]">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </SectionCard>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-neutral-200 flex justify-between items-center shrink-0">
          <span className="text-xs text-neutral-500 font-medium">Audit Record Details</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditLogViewDetailModal;

