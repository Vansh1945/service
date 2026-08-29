import React, { useState, useEffect, useCallback } from 'react';
import { toast } from '../../../../components/ui/Toast';
import {
  FiX, FiAlertTriangle, FiDollarSign, FiUser, FiBriefcase, FiCreditCard,
  FiShield, FiRefreshCw, FiClock, FiFileText, FiExternalLink, FiCheckCircle,
  FiXCircle
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

const SectionCard = ({ title, icon: Icon, iconColor = 'text-rose-600', children }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
      {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="px-5 py-4">{children}</div>
  </div>
);

const StatusChip = ({ label, type = 'danger' }) => {
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

const FailedPaymentDetailModal = ({ isOpen, onClose, entityData, paymentId }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);
  const [retrying, setRetrying] = useState(false);

  const { openInvestigationDrawer } = useAdminFilter();

  const fetchDetail = useCallback(async () => {
    const targetId = entityData?._id || entityData?.transactionId || paymentId;
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('failed_payment', targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local failed payment record data:', err);
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

  const handleRetryVerify = async () => {
    const targetId = entityData?._id || details?.mongoData?._id;
    if (!targetId) return;

    try {
      setRetrying(true);
      const res = await TransactionService.adminRetryVerify(targetId);
      if (res.data?.success) {
        toast.success("Payment verified and reconciled successfully!");
        fetchDetail();
      }
    } catch (err) {
      toast.error("We couldn't confirm the payment right now. Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  if (!isOpen) return null;

  const data = details || {};
  const fs = data.failureSummary || {};
  const ge = data.gatewayError || {};
  const rh = data.retryHistory || [];
  const bi = data.bookingInformation || {};
  const ci = data.customerInformation || {};
  const timeline = data.timeline || {};
  const wd = data.walletDiagnostics || {};
  const md = data.mixedDiagnostics || {};

  const booking = fs.booking || entityData?.booking || {};
  const customer = fs.customer || entityData?.user || {};
  const provider = fs.provider || entityData?.provider || {};

  const tabs = [
    { id: 'summary',  label: '1. Failure Summary', icon: FiXCircle },
    { id: 'gateway',  label: '2. Gateway Error',   icon: FiAlertTriangle },
    { id: 'retry',    label: '3. Retry History',   icon: FiRefreshCw },
    { id: 'booking',  label: '4. Booking Info',    icon: FiBriefcase },
    { id: 'customer', label: '5. Customer Info',   icon: FiUser },
    { id: 'timeline', label: '6. Timeline & Diagnostics', icon: FiClock },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white px-6 py-5 flex items-center justify-between shrink-0 border-b border-neutral-700/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30 text-primary">
              <FiXCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Payment Failure Diagnostics Console</h2>
                <StatusChip label={(fs.status || 'FAILED').toUpperCase()} type="danger" />
              </div>
              <p className="text-xs text-neutral-300 font-medium mt-0.5">
                Payment ID: <span className="font-mono font-bold text-white">{fs.paymentId || entityData?.transactionId || `#${(entityData?._id || '').slice(-6)}`}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetryVerify}
              disabled={retrying}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <FiRefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Verifying...' : 'Retry Verify'}
            </button>
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

          {/* TAB 1: FAILURE SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="p-5 bg-gradient-to-r from-rose-50 via-red-50 to-slate-50 rounded-2xl border border-rose-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Failed Payment Amount</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">
                    <PriceDisplay amount={fs.amount || entityData?.amount || 0} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip label={(fs.status || 'FAILED').toUpperCase()} type="danger" />
                  <StatusChip label={(fs.gateway || 'RAZORPAY').toUpperCase()} type="info" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Failure Overview" icon={FiXCircle}>
                  <InfoRow label="Payment ID" value={fs.paymentId || 'N/A'} mono />
                  <InfoRow
                    label="Booking ID"
                    value={booking.bookingId || entityData?.bookingId || 'N/A'}
                    onClick={() => openInvestigationDrawer('booking', booking._id || entityData?.booking)}
                  />
                  <InfoRow label="Payment Method" value={(fs.method || 'online').toUpperCase()} />
                  <InfoRow label="Gateway" value={fs.gateway || 'Razorpay'} />
                  <InfoRow label="Failure Reason" badge={<span className="font-bold text-rose-700">{fs.failureReason || 'Payment Captured Failed / Drop-off'}</span>} />
                </SectionCard>

                <SectionCard title="Parties Involved" icon={FiUser}>
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
                  <InfoRow label="Retry Option" badge={<StatusChip label="AVAILABLE" type="success" />} />
                </SectionCard>
              </div>
            </div>
          )}

          {/* TAB 2: GATEWAY ERROR DETAILS */}
          {activeTab === 'gateway' && (
            <div className="space-y-6">
              <SectionCard title="Gateway Error Diagnostics" icon={FiAlertTriangle}>
                <InfoRow label="Gateway Error Code" value={ge.errorCode || 'PAYMENT_FAILED'} mono />
                <InfoRow label="Error Source" value={(ge.errorSource || 'customer').toUpperCase()} />
                <InfoRow label="Error Description" badge={<span className="font-bold text-rose-700">{ge.errorDescription || 'Payment verification failed at gateway stage'}</span>} />
                <InfoRow label="Failure Stage" value={(ge.failureStage || 'payment_verification').toUpperCase()} />
                <InfoRow label="Signature Verification" badge={<StatusChip label={ge.signatureVerification || 'FAILED'} type="danger" />} />
                <InfoRow label="Webhook Event Status" badge={<StatusChip label={ge.webhookStatus || 'PAYMENT.FAILED'} type="warning" />} />
              </SectionCard>

              {ge.gatewayResponse && (
                <SectionCard title="Raw Gateway Error Object" icon={FiFileText}>
                  <pre className="p-4 bg-slate-900 text-rose-300 font-mono text-xs rounded-xl overflow-x-auto max-h-[300px]">
                    {JSON.stringify(ge.gatewayResponse, null, 2)}
                  </pre>
                </SectionCard>
              )}
            </div>
          )}

          {/* TAB 3: RETRY HISTORY */}
          {activeTab === 'retry' && (
            <SectionCard title="Automated Retry & Re-verification Log" icon={FiRefreshCw}>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Trigger Re-verification</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Queries Razorpay API to check if payment was captured on gateway side.</p>
                  </div>
                  <button
                    onClick={handleRetryVerify}
                    disabled={retrying}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <FiRefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                    {retrying ? 'Verifying...' : 'Initiate Retry'}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold border-b border-slate-100">
                      <tr>
                        <th className="p-3">Attempt #</th>
                        <th className="p-3">Timestamp</th>
                        <th className="p-3">Result</th>
                        <th className="p-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {rh.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-slate-800">Attempt {r.attempt || idx + 1}</td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(r.timestamp)}</td>
                          <td className="p-3"><StatusChip label={(r.result || 'FAILED').toUpperCase()} type={r.result === 'Passed' ? 'success' : 'danger'} /></td>
                          <td className="p-3 text-slate-700">{r.reason || 'Payment verification failed'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </SectionCard>
          )}

          {/* TAB 4: BOOKING INFORMATION */}
          {activeTab === 'booking' && (
            <SectionCard title="Associated Booking Context" icon={FiBriefcase}>
              <InfoRow
                label="Booking ID"
                value={booking.bookingId || 'N/A'}
                onClick={() => openInvestigationDrawer('booking', booking._id)}
              />
              <InfoRow label="Booking Status" badge={<StatusChip label={(bi.bookingStatus || 'pending').toUpperCase()} type="warning" />} />
              <InfoRow label="Booking Created" value={fmtDate(bi.bookingTimeline?.created)} />
              <InfoRow label="Scheduled Date & Time" value={bi.bookingTimeline?.scheduled || 'N/A'} />
              <InfoRow label="Assigned Provider" value={bi.assignedProvider || 'Unassigned'} />
              {bi.cancellation && (
                <InfoRow label="Cancellation Info" badge={<span className="font-bold text-rose-600">{bi.cancellation.reason}</span>} />
              )}
            </SectionCard>
          )}

          {/* TAB 5: CUSTOMER INFORMATION */}
          {activeTab === 'customer' && (
            <SectionCard title="Customer Profile & Balance" icon={FiUser}>
              <InfoRow
                label="Customer Name"
                value={ci.name || 'Customer'}
                onClick={() => openInvestigationDrawer('customer', customer._id)}
              />
              <InfoRow label="Phone Number" value={ci.phone || 'N/A'} />
              <InfoRow label="Email Address" value={ci.email || 'N/A'} />
              <InfoRow label="Customer Wallet Balance" badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={ci.walletBalance || 0} /></span>} />
            </SectionCard>
          )}

          {/* TAB 6: TIMELINE & DIAGNOSTICS */}
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              {/* Wallet Failure Diagnostic */}
              {wd.walletBalance !== undefined && (
                <SectionCard title="Wallet Failure Diagnostic" icon={FiShield}>
                  <InfoRow label="Available Wallet Balance" badge={<span className="font-bold text-blue-600"><PriceDisplay amount={wd.walletBalance} /></span>} />
                  <InfoRow label="Required Payment Amount" badge={<span className="font-bold text-slate-900"><PriceDisplay amount={wd.requiredAmount} /></span>} />
                  <InfoRow label="Diagnostic Reason" badge={<span className="font-bold text-rose-600">{wd.failureReason}</span>} />
                </SectionCard>
              )}

              {/* Mixed Payment Diagnostic */}
              {md.onlineAmount !== undefined && (
                <SectionCard title="Mixed Payment Breakdown" icon={FiCreditCard}>
                  <InfoRow label="Total Booking Amount" badge={<span className="font-black text-slate-900"><PriceDisplay amount={md.totalAmount} /></span>} />
                  <InfoRow label="Online Gateway Amount" badge={<span className="font-bold text-rose-600"><PriceDisplay amount={md.onlineAmount} /> (FAILED)</span>} />
                  <InfoRow label="Wallet Debited Amount" badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={md.walletAmount} /> (SUCCESS)</span>} />
                  <InfoRow label="Overall Status" badge={<StatusChip label={md.overallStatus.toUpperCase()} type="warning" />} />
                </SectionCard>
              )}

              <SectionCard title="Lifecycle Timeline" icon={FiClock}>
                <div className="space-y-4 text-xs">
                  <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">1. Booking Created</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.bookingCreated)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">2. Payment Initiated</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.paymentInitiated)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">3. Gateway Request Sent</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.gatewayRequest)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">4. Gateway Failure Response</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.failure)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">5. Automated Verification Attempt</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.retry || timeline.failure)}</p>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Payment Failure Console &bull; Centralized Exception Diagnostics
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Close Diagnostics
          </button>
        </div>

      </div>
    </div>
  );
};

export default FailedPaymentDetailModal;
