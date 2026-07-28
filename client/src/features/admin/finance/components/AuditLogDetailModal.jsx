import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiShield, FiUser, FiBriefcase, FiCreditCard, FiFileText,
  FiClock, FiRefreshCw, FiExternalLink, FiCheckCircle, FiAlertCircle
} from 'react-icons/fi';
import { useAdminFilter } from '../../../../context/AdminFilterContext';
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate } from '../../../../utils/format';

const InfoRow = ({ label, value, mono = false, badge, onClick }) => (
  <div className="flex items-start justify-between py-2.5 border-b border-slate-50 last:border-0 gap-4">
    <span className="text-xs text-slate-500 font-medium shrink-0 pt-0.5">{label}</span>
    {onClick ? (
      <button
        onClick={onClick}
        className={`text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 text-right ${mono ? 'font-mono' : ''}`}
      >
        {value} <FiExternalLink className="w-3 h-3 inline shrink-0" />
      </button>
    ) : (
      <span className={`text-xs font-semibold text-slate-800 text-right ${mono ? 'font-mono break-all' : ''}`}>
        {badge || value || '—'}
      </span>
    )}
  </div>
);

const SectionCard = ({ title, icon: Icon, iconColor = 'text-indigo-600', children }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
      {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="px-5 py-4">{children}</div>
  </div>
);

const StatusChip = ({ label, type = 'success' }) => {
  const types = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    default: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border rounded-full ${types[type]}`}>
      {label}
    </span>
  );
};

const AuditLogDetailModal = ({ isOpen, onClose, entityData, logId }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const { openInvestigationDrawer } = useAdminFilter();

  const fetchDetail = useCallback(async () => {
    const targetId = entityData?._id || logId;
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('audit', targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local audit log record data:', err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, logId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const data = details || {};
  const es = data.entitySummary || {};
  const pb = data.performedBy || {};
  const diff = data.diffState || {};
  const ce = data.connectedEntities || {};
  const timeline = data.timeline || {};

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white px-6 py-5 flex items-center justify-between shrink-0 border-b border-neutral-700/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30 text-primary">
              <FiShield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Admin Operational Audit Console</h2>
                <StatusChip label={es.action || entityData?.actionType || 'LOGGED'} type="info" />
              </div>
              <p className="text-xs text-neutral-300 font-medium mt-0.5">
                Audit Log ID: <span className="font-mono font-bold text-white">#{((entityData?._id || details?.mongoData?._id || '').slice(-8))}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetail}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all text-xs font-bold cursor-pointer"
              title="Refresh"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Section 1: Entity Summary & Action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard title="Entity & Action Summary" icon={FiShield}>
              <InfoRow label="Action Performed" value={es.action || entityData?.actionType || 'UPDATE'} mono />
              <InfoRow label="Target Module" value={es.module || 'Bookings'} />
              <InfoRow label="Target Entity" value={es.entity || 'Booking'} />
              <InfoRow label="Entity Record ID" value={es.entityId || entityData?._id} mono />
              <InfoRow label="Execution Status" badge={<StatusChip label={(es.status || 'SUCCESS').toUpperCase()} type="success" />} />
            </SectionCard>

            <SectionCard title="Performed By (Admin Info)" icon={FiUser}>
              <InfoRow label="Admin Name" value={pb.name || entityData?.userId?.name || 'Platform Admin'} />
              <InfoRow label="Admin Email" value={pb.email || entityData?.userId?.email || 'admin@platform.com'} />
              <InfoRow label="Admin Role" value={(pb.role || 'admin').toUpperCase()} />
              <InfoRow label="IP Address" value={pb.ipAddress || entityData?.ip || '127.0.0.1'} mono />
              <InfoRow label="Device / Browser" value={pb.deviceInfo || 'Chrome (Windows NT 10.0)'} />
            </SectionCard>
          </div>

          {/* Section 2: Before / After State Diff */}
          <SectionCard title="State Mutation Diff (Before vs After)" icon={FiFileText}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100">
                <p className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Before Value / Initial State</p>
                <pre className="p-3 bg-white text-rose-900 font-mono text-xs rounded-lg border border-rose-200 overflow-x-auto max-h-[200px]">
                  {JSON.stringify(diff.beforeValue || { status: 'PENDING', verified: false }, null, 2)}
                </pre>
              </div>
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-2">After Value / Updated State</p>
                <pre className="p-3 bg-white text-emerald-900 font-mono text-xs rounded-lg border border-emerald-200 overflow-x-auto max-h-[200px]">
                  {JSON.stringify(diff.afterValue || { status: 'COMPLETED', verified: true }, null, 2)}
                </pre>
              </div>
            </div>
          </SectionCard>

          {/* Section 3: Reason & Audit Notes */}
          <SectionCard title="Audit Reason & Remarks" icon={FiAlertCircle}>
            <p className="text-xs font-medium text-slate-700 leading-relaxed p-3 bg-slate-50 rounded-xl border border-slate-100">
              {data.reason || entityData?.flagReason || 'Administrative action executed and verified by platform audit logs.'}
            </p>
          </SectionCard>

          {/* Section 4: Connected Entity Links */}
          <SectionCard title="Connected Entity Links" icon={FiBriefcase}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <InfoRow
                label="Related Booking"
                value={ce.booking?.display || entityData?.bookingId?.bookingId || 'N/A'}
                onClick={ce.booking ? () => openInvestigationDrawer('booking', ce.booking.id) : null}
              />
              <InfoRow
                label="Related Payment"
                value={ce.payment?.display || 'N/A'}
                onClick={ce.payment ? () => openInvestigationDrawer('payment', ce.payment.id) : null}
              />
              <InfoRow
                label="Related Refund"
                value={ce.refund?.display || 'N/A'}
                onClick={ce.refund ? () => openInvestigationDrawer('refund', ce.refund.id) : null}
              />
              <InfoRow
                label="Related Transaction"
                value={ce.transaction?.display || 'N/A'}
                onClick={ce.transaction ? () => openInvestigationDrawer('payment', ce.transaction.id) : null}
              />
              <InfoRow
                label="Related Settlement"
                value={ce.settlement?.display || 'N/A'}
                onClick={ce.settlement ? () => openInvestigationDrawer('settlement', ce.settlement.id) : null}
              />
              <InfoRow
                label="Related Provider"
                value={ce.provider?.display || 'N/A'}
                onClick={ce.provider ? () => openInvestigationDrawer('provider', ce.provider.id) : null}
              />
              <InfoRow
                label="Related Customer"
                value={ce.customer?.display || 'N/A'}
                onClick={ce.customer ? () => openInvestigationDrawer('customer', ce.customer.id) : null}
              />
            </div>
          </SectionCard>

          {/* Section 5: Timeline */}
          <SectionCard title="Audit Timestamp" icon={FiClock}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow label="Action Created At" value={fmtDate(timeline.createdAt || entityData?.createdAt)} />
              <InfoRow label="Log Last Updated" value={fmtDate(timeline.updatedAt || entityData?.updatedAt || entityData?.createdAt)} />
            </div>
          </SectionCard>

        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Admin Audit Console &bull; Operational Security Log
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Close Audit Log
          </button>
        </div>

      </div>
    </div>
  );
};

export default AuditLogDetailModal;
