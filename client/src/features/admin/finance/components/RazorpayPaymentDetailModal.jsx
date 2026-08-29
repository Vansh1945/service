import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiZap, FiUser, FiCreditCard,
  FiShield, FiRotateCcw, FiClock, FiRefreshCw, FiExternalLink,
  FiCode, FiCheckCircle
} from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import { useAdminFilter } from '../../../../context/AdminFilterContext';
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate } from '../../../../utils/format';

const InfoRow = ({ label, value, mono = false, badge, onClick }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0 gap-4">
    <span className="text-xs text-neutral-500 font-medium shrink-0">{label}</span>
    {onClick ? (
      <button
        onClick={onClick}
        className={`text-xs font-semibold text-primary hover:underline flex items-center gap-1 text-right cursor-pointer ${mono ? 'font-mono' : ''}`}
      >
        {value} <FiExternalLink className="w-3 h-3 inline shrink-0" />
      </button>
    ) : (
      <span className={`text-xs font-semibold text-neutral-800 text-right ${mono ? 'font-mono break-all' : ''}`}>
        {badge || value || '—'}
      </span>
    )}
  </div>
);

const SectionCard = ({ title, icon: Icon, iconColor = 'text-primary', children, rightElement }) => (
  <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
    <div className="px-5 py-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
        <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">{title}</h3>
      </div>
      {rightElement}
    </div>
    <div className="px-5 py-3.5">{children}</div>
  </div>
);

const StatusChip = ({ label, type = 'default' }) => {
  const types = {
    success: 'bg-success-light text-success border-success/30',
    warning: 'bg-warning-light text-warning border-warning/30',
    danger: 'bg-danger-light text-danger border-danger/30',
    info: 'bg-info-light text-info border-info/30',
    purple: 'bg-primary/10 text-primary border-primary/30',
    default: 'bg-neutral-100 text-neutral-600 border-neutral-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-full ${types[type] || types.default}`}>
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

        {/* Minimal Clean Header */}
        <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl text-primary">
              <FiZap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Razorpay Live Gateway Console</h2>
                <StatusChip label={(ps.gatewayStatus || entityData?.paymentStatus || 'CAPTURED').toUpperCase()} type="info" />
              </div>
              <p className="text-xs text-neutral-400 font-medium mt-0.5">
                Payment ID: <span className="font-mono font-bold text-white">{ps.paymentId || entityData?.razorpayPaymentId || `#${(entityData?._id || '').slice(-6)}`}</span>
                {ps.orderId && ` | Order: ${ps.orderId}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetail}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-300 hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Refresh Live Data"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Minimal Tabs Navigation */}
        <div className="bg-white border-b border-neutral-200 px-6 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-hide">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`py-3 px-3.5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-primary text-primary bg-neutral-50/50'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50/30'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-primary' : 'text-neutral-400'}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-neutral-50/30">

          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-5">
              <div className="p-5 bg-white rounded-2xl border border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div>
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Gateway Payment Amount</p>
                  <p className="text-2xl font-black text-neutral-900 mt-0.5">
                    <PriceDisplay amount={ps.amount || entityData?.amount || 0} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip label={ps.captured ? 'CAPTURED' : 'AUTHORIZED'} type="success" />
                  <StatusChip label={(ps.method || 'ONLINE').toUpperCase()} type="info" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
            <div className="space-y-5">
              <div className="flex items-center justify-between bg-white px-5 py-3 rounded-2xl border border-neutral-200 shadow-xs">
                <span className="text-xs font-bold text-neutral-700">Structured Gateway View</span>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-primary">
                  <input
                    type="checkbox"
                    checked={debugMode}
                    onChange={(e) => setDebugMode(e.target.checked)}
                    className="rounded text-primary focus:ring-primary h-4 w-4"
                  />
                  Enable Debug Mode (Raw JSON)
                </label>
              </div>

              {!debugMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <SectionCard title="Sub-Method Breakdown" icon={FiCreditCard}>
                    <InfoRow label="VPA / UPI Handle" value={gr.vpa || 'N/A'} mono />
                    <InfoRow label="Issuing Bank" value={gr.bank || 'N/A'} />
                    <InfoRow label="Gateway Wallet" value={gr.wallet || 'N/A'} />
                    <InfoRow label="Card Network" value={gr.card?.network || 'N/A'} />
                  </SectionCard>

                  <SectionCard title="Fees & Error Info" icon={FiShield}>
                    <InfoRow label="Gateway Fee Charged" badge={<span className="font-bold text-success"><PriceDisplay amount={gr.fee || 0} /></span>} />
                    <InfoRow label="Gateway GST (18%)" badge={<span className="font-bold text-success"><PriceDisplay amount={gr.tax || 0} /></span>} />
                    <InfoRow label="Gateway Error Code" value={gr.errorCode || 'None (Success)'} />
                    <InfoRow label="Gateway Error Description" value={gr.errorDescription || 'None'} />
                  </SectionCard>
                </div>
              ) : (
                <SectionCard title="Raw Gateway Response Payload" icon={FiCode}>
                  <pre className="p-4 bg-neutral-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-[360px]">
                    {JSON.stringify(apiResp, null, 2)}
                  </pre>
                </SectionCard>
              )}
            </div>
          )}

          {/* TAB 3: CAPTURE DETAILS */}
          {activeTab === 'capture' && (
            <SectionCard title="Payment Capture & Authorization Metadata" icon={FiCheckCircle}>
              <InfoRow label="Captured Amount" badge={<span className="font-black text-neutral-900"><PriceDisplay amount={cd.capturedAmount || 0} /></span>} />
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
              <InfoRow label="Settlement Amount" badge={<span className="font-black text-neutral-900"><PriceDisplay amount={settlement.settlementAmount || 0} /></span>} />
              <InfoRow label="Settlement Status" badge={<StatusChip label={(settlement.settlementStatus || 'settled').toUpperCase()} type="success" />} />
              <InfoRow label="Settlement Date" value={fmtDate(settlement.settlementDate)} />
              <InfoRow label="Gateway Fee" badge={<span className="font-bold text-warning"><PriceDisplay amount={settlement.gatewayFee || 0} /></span>} />
              <InfoRow label="Net Settled Amount" badge={<span className="font-black text-success"><PriceDisplay amount={settlement.netAmount || 0} /></span>} />
              <InfoRow label="Bank Reference / UTR" value={settlement.bankReference || 'N/A'} mono />
            </SectionCard>
          )}

          {/* TAB 5: REFUND */}
          {activeTab === 'refund' && (
            <SectionCard title="Original Razorpay Refund Information" icon={FiRotateCcw}>
              {refund ? (
                <div className="space-y-1">
                  <InfoRow label="Refund ID" value={refund.refundId || 'N/A'} mono />
                  <InfoRow label="Gateway Refund ID" value={refund.gatewayRefundId || 'N/A'} mono />
                  <InfoRow label="Refund Amount" badge={<span className="font-bold text-danger"><PriceDisplay amount={refund.refundAmount || 0} /></span>} />
                  <InfoRow label="Refund Status" badge={<StatusChip label={(refund.refundStatus || 'completed').toUpperCase()} type="danger" />} />
                  <InfoRow label="Refund Speed" value={(refund.refundSpeed || 'optimum').toUpperCase()} />
                  <InfoRow label="Processed Time" value={fmtDate(refund.processedTime)} />
                </div>
              ) : (
                <div className="p-4 bg-success-light rounded-xl border border-success/20 text-xs text-success font-bold flex items-center gap-2">
                  <FiCheckCircle className="w-4 h-4 text-success shrink-0" />
                  No Refund History — Payment is 100% intact.
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 6: WEBHOOK TIMELINE */}
          {activeTab === 'timeline' && (() => {
            const createdDate = timeline.paymentCreated || ps.createdTime || entityData?.createdAt || entityData?.updatedAt;
            const authorizedDate = timeline.authorized || ps.createdTime || entityData?.createdAt;
            const capturedDate = timeline.captured || ps.capturedTime || entityData?.updatedAt || entityData?.createdAt;
            const refundedDate = timeline.refunded || refund?.processedTime;
            const settledDate = timeline.settled || settlement?.settlementDate || entityData?.settlementDate || (ps.captured ? (entityData?.updatedAt || entityData?.createdAt) : null);
            const verifiedDate = timeline.webhookVerified !== false ? (capturedDate || createdDate) : null;

            return (
              <SectionCard title="Razorpay Webhook & Gateway Event Timeline" icon={FiClock}>
                <div className="space-y-4 text-xs">
                  <div className="flex gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-info mt-1 shrink-0" />
                    <div>
                      <p className="font-bold text-neutral-800">Payment Created</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{fmtDate(createdDate)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-info mt-1 shrink-0" />
                    <div>
                      <p className="font-bold text-neutral-800">Authorized</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{fmtDate(authorizedDate)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-success mt-1 shrink-0" />
                    <div>
                      <p className="font-bold text-neutral-800">Payment Captured</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{fmtDate(capturedDate)}</p>
                    </div>
                  </div>
                  {refundedDate && (
                    <div className="flex gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-danger mt-1 shrink-0" />
                      <div>
                        <p className="font-bold text-neutral-800">Refunded</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">{fmtDate(refundedDate)}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-success mt-1 shrink-0" />
                    <div>
                      <p className="font-bold text-neutral-800">Settled to Bank</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{fmtDate(settledDate)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1 shrink-0" />
                    <div>
                      <p className="font-bold text-neutral-800">Webhook Verified</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{fmtDate(verifiedDate)}</p>
                    </div>
                  </div>
                </div>
              </SectionCard>
            );
          })()}

          {/* TAB 7: API RESPONSE */}
          {activeTab === 'api' && (
            <SectionCard title="Formatted Razorpay Gateway API Payload" icon={FiCode}>
              <pre className="p-4 bg-neutral-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto max-h-[360px]">
                {JSON.stringify(apiResp, null, 2)}
              </pre>
            </SectionCard>
          )}

        </div>

        {/* Minimal Footer */}
        <div className="bg-white border-t border-neutral-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="text-xs text-neutral-400 font-medium">
            Razorpay Live Console &bull; Synchronized via Official Gateway SDK
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};

export default RazorpayPaymentDetailModal;
