import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiZap, FiDollarSign, FiUser, FiBriefcase, FiCreditCard,
  FiShield, FiRotateCcw, FiClock, FiFileText, FiRefreshCw, FiExternalLink,
  FiCode, FiCheckCircle
} from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
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

const SectionCard = ({ title, icon: Icon, iconColor = 'text-blue-600', children }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
      {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="px-5 py-4">{children}</div>
  </div>
);

const StatusChip = ({ label, type = 'default' }) => {
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

const RazorpayPaymentDetailModal = ({ isOpen, onClose, entityData, paymentId }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [debugMode, setDebugMode] = useState(false);

  const { openInvestigationDrawer } = useAdminFilter();

  const fetchDetail = useCallback(async () => {
    const targetId = entityData?.razorpayPaymentId || entityData?._id || paymentId;
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('razorpay', targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local Razorpay payment record data:', err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, paymentId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const data = details || {};
  const ps = data.paymentSummary || {};
  const booking = ps.booking || entityData?.booking || {};
  const customer = ps.customer || entityData?.user || {};
  const provider = ps.provider || entityData?.provider || {};

  const gr = data.gatewayResponse || {};
  const cd = data.captureDetails || {};
  const settlement = data.settlement || {};
  const refund = data.refund || null;
  const timeline = data.webhookTimeline || {};
  const apiResp = data.apiResponse || {};

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FiZap },
    { id: 'gateway', label: 'Response', icon: FiCreditCard },
    { id: 'capture', label: 'Capture', icon: FiCheckCircle },
    { id: 'settlement', label: 'Settlement', icon: FiShield },
    { id: 'refund', label: 'Refund', icon: FiRotateCcw },
    { id: 'timeline', label: 'Timeline', icon: FiClock },
    { id: 'api', label: 'API Payload', icon: FiCode },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white px-6 py-5 flex items-center justify-between shrink-0 border-b border-neutral-700/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30 text-primary">
              <FiZap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Razorpay Live Gateway Console</h2>
                <StatusChip label={(ps.gatewayStatus || entityData?.paymentStatus || 'CAPTURED').toUpperCase()} type="info" />
              </div>
              <p className="text-xs text-neutral-300 font-medium mt-0.5">
                Payment ID: <span className="font-mono font-bold text-white">{ps.paymentId || entityData?.razorpayPaymentId || `#${(entityData?._id || '').slice(-6)}`}</span>
                {ps.orderId && ` | Order: ${ps.orderId}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetail}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Refresh Live Data"
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

        {/* Tabs Bar */}
        <div className="bg-neutral-50/90 border-b border-neutral-200 px-6 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-hide">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`py-3.5 px-4 font-extrabold text-xs flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-primary text-primary bg-white shadow-xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-slate-400'}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="p-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Gateway Payment Amount</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">
                    <PriceDisplay amount={ps.amount || entityData?.amount || 0} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip label={ps.captured ? 'CAPTURED' : 'AUTHORIZED'} type="success" />
                  <StatusChip label={(ps.method || 'ONLINE').toUpperCase()} type="info" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Payment & Order Reference" icon={FiZap}>
                  <InfoRow label="Razorpay Payment ID" value={ps.paymentId || 'N/A'} mono />
                  <InfoRow label="Razorpay Order ID" value={ps.orderId || 'N/A'} mono />
                  <InfoRow
                    label="Booking ID"
                    value={booking.bookingId || entityData?.bookingId || 'N/A'}
                    onClick={() => openInvestigationDrawer('booking', booking._id || entityData?.booking)}
                  />
                  <InfoRow label="Method" value={(ps.method || 'online').toUpperCase()} />
                  <InfoRow label="Gateway Status" badge={<StatusChip label={(ps.gatewayStatus || 'captured').toUpperCase()} type="success" />} />
                  <InfoRow label="Captured Status" badge={<StatusChip label={ps.captured ? 'TRUE' : 'FALSE'} type={ps.captured ? 'success' : 'warning'} />} />
                  <InfoRow label="Authorized Status" badge={<StatusChip label={ps.authorized ? 'TRUE' : 'FALSE'} type="success" />} />
                  <InfoRow label="Created Time" value={fmtDate(ps.createdTime)} />
                  <InfoRow label="Captured Time" value={fmtDate(ps.capturedTime)} />
                </SectionCard>

                <SectionCard title="Business Entities" icon={FiUser}>
                  <InfoRow
                    label="Customer Name"
                    value={customer.name || 'Customer'}
                    onClick={() => openInvestigationDrawer('customer', customer._id || entityData?.user)}
                  />
                  <InfoRow
                    label="Provider Name"
                    value={provider.name || 'Provider'}
                    onClick={() => openInvestigationDrawer('provider', provider._id || entityData?.provider)}
                  />
                  <InfoRow
                    label="Settlement Link"
                    value={settlement.settlementId || 'Settlement Details'}
                    onClick={() => openInvestigationDrawer('settlement', entityData?._id)}
                  />
                </SectionCard>
              </div>
            </div>
          )}

          {/* TAB 2: GATEWAY RESPONSE */}
          {activeTab === 'gateway' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-slate-200/80">
                <span className="text-xs font-bold text-slate-600">Structured Gateway View</span>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-blue-700">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                  Enable Debug Mode (Raw JSON)
                </label>
              </div>

              {!debugMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <SectionCard title="Sub-Method Breakdown" icon={FiCreditCard}>
                    <InfoRow label="VPA / UPI Handle" value={gr.vpa || 'N/A'} mono />
                    <InfoRow label="Issuing Bank" value={gr.bank || 'N/A'} />
                    <InfoRow label="Gateway Wallet" value={gr.wallet || 'N/A'} />
                    <InfoRow label="Card Network" value={gr.card?.network || 'N/A'} />
                  </SectionCard>

                  <SectionCard title="Fees & Error Info" icon={FiShield}>
                    <InfoRow label="Gateway Fee Charged" badge={<span className="font-bold text-amber-600"><PriceDisplay amount={gr.fee || 0} /></span>} />
                    <InfoRow label="Gateway GST (18%)" badge={<span className="font-bold text-amber-600"><PriceDisplay amount={gr.tax || 0} /></span>} />
                    <InfoRow label="Gateway Error Code" value={gr.errorCode || 'None (Success)'} />
                    <InfoRow label="Gateway Error Description" value={gr.errorDescription || 'None'} />
                  </SectionCard>
                </div>
              ) : (
                <SectionCard title="Raw Gateway Response Payload" icon={FiCode}>
                  <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-[400px]">
                    {JSON.stringify(apiResp, null, 2)}
                  </pre>
                </SectionCard>
              )}
            </div>
          )}

          {/* TAB 3: CAPTURE DETAILS */}
          {activeTab === 'capture' && (
            <SectionCard title="Payment Capture & Authorization Metadata" icon={FiCheckCircle}>
              <InfoRow label="Captured Amount" badge={<span className="font-black text-slate-900"><PriceDisplay amount={cd.capturedAmount || 0} /></span>} />
              <InfoRow label="Captured Time" value={fmtDate(cd.capturedTime)} />
              <InfoRow label="Gateway Status" badge={<StatusChip label={(cd.gatewayStatus || 'captured').toUpperCase()} type="success" />} />
              <InfoRow label="Payment Method" value={(cd.paymentMethod || 'online').toUpperCase()} />
              <InfoRow label="Issuing Bank" value={cd.bank || 'N/A'} />
              <InfoRow label="VPA Handle" value={cd.vpa || 'N/A'} mono />
              <InfoRow label="Card Network" value={cd.cardNetwork || 'N/A'} />
              <InfoRow label="Card Last 4 Digits" value={cd.lastFour !== 'N/A' ? `•••• ${cd.lastFour}` : 'N/A'} mono />
            </SectionCard>
          )}

          {/* TAB 4: SETTLEMENT */}
          {activeTab === 'settlement' && (
            <SectionCard title="Original Razorpay Settlement Metadata" icon={FiShield}>
              <InfoRow
                label="Settlement ID"
                value={settlement.settlementId || 'N/A'}
                mono
                onClick={() => openInvestigationDrawer('settlement', entityData?._id)}
              />
              <InfoRow label="Settlement Amount" badge={<span className="font-black text-slate-900"><PriceDisplay amount={settlement.settlementAmount || 0} /></span>} />
              <InfoRow label="Settlement Status" badge={<StatusChip label={(settlement.settlementStatus || 'settled').toUpperCase()} type="success" />} />
              <InfoRow label="Settlement Date" value={fmtDate(settlement.settlementDate)} />
              <InfoRow label="Gateway Fee" badge={<span className="font-bold text-amber-600"><PriceDisplay amount={settlement.gatewayFee || 0} /></span>} />
              <InfoRow label="Net Settled Amount" badge={<span className="font-black text-emerald-700"><PriceDisplay amount={settlement.netAmount || 0} /></span>} />
              <InfoRow label="Bank Reference / UTR" value={settlement.bankReference || 'N/A'} mono />
            </SectionCard>
          )}

          {/* TAB 5: REFUND */}
          {activeTab === 'refund' && (
            <SectionCard title="Original Razorpay Refund Information" icon={FiRotateCcw}>
              {refund ? (
                <div className="space-y-2">
                  <InfoRow label="Refund ID" value={refund.refundId || 'N/A'} mono />
                  <InfoRow label="Gateway Refund ID" value={refund.gatewayRefundId || 'N/A'} mono />
                  <InfoRow label="Refund Amount" badge={<span className="font-bold text-rose-600"><PriceDisplay amount={refund.refundAmount || 0} /></span>} />
                  <InfoRow label="Refund Status" badge={<StatusChip label={(refund.refundStatus || 'completed').toUpperCase()} type="danger" />} />
                  <InfoRow label="Refund Speed" value={(refund.refundSpeed || 'optimum').toUpperCase()} />
                  <InfoRow label="Processed Time" value={fmtDate(refund.processedTime)} />
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
                  <FiCheckCircle className="w-4 h-4 text-emerald-600" />
                  No Refund History — Payment is 100% intact.
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 6: WEBHOOK TIMELINE */}
          {activeTab === 'timeline' && (
            <SectionCard title="Razorpay Webhook & Gateway Event Timeline" icon={FiClock}>
              <div className="space-y-4 text-xs">
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">Payment Created</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.paymentCreated)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">Authorized</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.authorized)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">Payment Captured</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.captured)}</p>
                  </div>
                </div>
                {timeline.refunded && (
                  <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">Refunded</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.refunded)}</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">Settled to Bank</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.settled)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">Webhook Verified</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.webhookVerified ? timeline.captured : null)}</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* TAB 7: API RESPONSE */}
          {activeTab === 'api' && (
            <SectionCard title="Formatted Razorpay Gateway API Payload" icon={FiCode}>
              <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-[400px]">
                {JSON.stringify(apiResp, null, 2)}
              </pre>
            </SectionCard>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Razorpay Live Console &bull; Synchronized via Official Gateway SDK
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};

export default RazorpayPaymentDetailModal;
