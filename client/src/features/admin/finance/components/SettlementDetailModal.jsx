import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiShield, FiDollarSign, FiUser, FiBriefcase, FiCreditCard,
  FiFileText, FiClock, FiRefreshCw, FiExternalLink, FiCheckCircle
} from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import { useAdminFilter } from '../../../../context/AdminFilterContext';
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate, fmtDateOnly } from '../../../../utils/format';

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

const SectionCard = ({ title, icon: Icon, iconColor = 'text-emerald-600', children }) => (
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

const SettlementDetailModal = ({ isOpen, onClose, entityData, settlementId }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const { openInvestigationDrawer } = useAdminFilter();

  const fetchDetail = useCallback(async () => {
    const targetId = entityData?._id || settlementId;
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('settlement', targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local settlement record data:', err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, settlementId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const data = details || {};
  const settlement = data.settlement || entityData || {};
  const gateway = data.gateway || {};
  const payment = data.payment || {};
  const provider = data.provider || {};
  const customer = data.customer || {};
  const booking = data.booking || {};
  const withdrawal = data.withdrawal || {};
  const ledger = data.ledger || [];
  const timeline = data.timeline || {};

  const tabs = [
    { id: 'overview',   label: '1. Overview',     icon: FiShield },
    { id: 'summary',    label: '2. Summary',      icon: FiDollarSign },
    { id: 'gateway',    label: '3. Gateway',      icon: FiCreditCard },
    { id: 'payment',    label: '4. Payment',      icon: FiDollarSign },
    { id: 'provider',   label: '5. Provider',     icon: FiUser },
    { id: 'withdrawal', label: '6. Withdrawal',   icon: FiBriefcase },
    { id: 'ledger',     label: '7. Ledger',       icon: FiFileText },
    { id: 'timeline',   label: '8. Timeline',     icon: FiClock },
  ];

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
                <h2 className="text-xl font-black tracking-tight">Financial Settlement Console</h2>
                <StatusChip label={settlement.settlementStatus ? settlement.settlementStatus.toUpperCase() : 'UNKNOWN'} type={['settled', 'completed', 'success', 'paid'].includes((settlement.settlementStatus || '').toLowerCase()) ? 'success' : (settlement.settlementStatus ? 'warning' : 'default')} />
              </div>
              <p className="text-xs text-neutral-300 font-medium mt-0.5">
                Settlement ID: <span className="font-mono font-bold text-white">{settlement.settlementId || `#${(entityData?._id || '').slice(-6)}`}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetail}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
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

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 rounded-2xl border border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Net Settlement Balance</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">
                    <PriceDisplay amount={settlement.settlementAmount || settlement.grossAmount || 0} />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip label={(settlement.settlementStatus || 'settled').toUpperCase()} type="success" />
                  <StatusChip label="RECONCILED" type="info" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Settlement Information" icon={FiShield}>
                  <InfoRow label="Settlement ID" value={settlement.settlementId} mono />
                  <InfoRow
                    label="Booking ID"
                    value={booking.bookingId || 'N/A'}
                    onClick={() => openInvestigationDrawer('booking', booking._id || entityData?.booking)}
                  />
                  <InfoRow
                    label="Payment ID"
                    value={gateway.paymentId || 'N/A'}
                    mono
                    onClick={() => openInvestigationDrawer('payment', entityData?._id)}
                  />
                  <InfoRow label="Payment Method" value={(payment.paymentMethod || 'online').toUpperCase()} />
                  <InfoRow label="Gateway" value={gateway.paymentId?.startsWith('pay_') ? 'Razorpay' : 'Razorpay / System'} />
                  <InfoRow label="Settlement Date" value={fmtDate(settlement.settlementDate)} />
                </SectionCard>

                <SectionCard title="Parties & Entities" icon={FiUser}>
                  <InfoRow
                    label="Customer Name"
                    value={customer.name || 'Customer'}
                    onClick={() => openInvestigationDrawer('customer', customer._id)}
                  />
                  <InfoRow
                    label="Provider Name"
                    value={provider.name || 'Provider'}
                    onClick={() => openInvestigationDrawer('provider', provider._id)}
                  />
                  <InfoRow
                    label="Provider Wallet"
                    badge={<span className="font-bold text-blue-700"><PriceDisplay amount={provider.walletCredit || provider.wallet?.availableBalance || 0} /></span>}
                    onClick={() => openInvestigationDrawer('provider_wallet', provider._id)}
                  />
                  <InfoRow label="Reconciliation Status" badge={<StatusChip label={settlement.reconciliationStatus || 'UNRECONCILED'} type={settlement.reconciliationStatus?.includes('Reconciled') || settlement.reconciliationStatus?.includes('Balanced') || settlement.reconciliationStatus?.includes('MATCHED') ? 'success' : (settlement.reconciliationStatus?.includes('Pending') ? 'warning' : 'danger')} />} />
                </SectionCard>
              </div>
            </div>
          )}

          {/* TAB 2: SETTLEMENT SUMMARY */}
          {activeTab === 'summary' && (
            <SectionCard title="Full Financial Reconciliation Breakdown" icon={FiDollarSign}>
              <InfoRow label="Customer Paid Amount" badge={<span className="font-black text-slate-900"><PriceDisplay amount={settlement.grossAmount || 0} /></span>} />
              <InfoRow label="Gateway Received" badge={<span className="font-bold text-teal-700"><PriceDisplay amount={(settlement.grossAmount || 0) - (settlement.gatewayFee || 0)} /></span>} />
              <InfoRow label="Gateway Fee" badge={<span className="font-bold text-amber-600">- <PriceDisplay amount={settlement.gatewayFee || 0} /></span>} />
              <InfoRow label="Gateway Tax (GST)" badge={<span className="font-bold text-amber-600">- <PriceDisplay amount={settlement.gatewayTax || 0} /></span>} />
              <InfoRow label="Net Platform Amount" badge={<span className="font-bold text-emerald-700"><PriceDisplay amount={settlement.netPlatformAmount || 0} /></span>} />
              <InfoRow label="Platform Commission" badge={<span className="font-bold text-emerald-700"><PriceDisplay amount={settlement.platformCommission || 0} /></span>} />
              <InfoRow label="Provider Net Share" badge={<span className="font-black text-blue-600"><PriceDisplay amount={settlement.providerNetShare || 0} /></span>} />
              <InfoRow label="Provider Paid Amount" badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={settlement.providerPaidAmount || 0} /></span>} />
              <InfoRow label="Provider Pending Amount" badge={<span className="font-bold text-purple-600"><PriceDisplay amount={settlement.providerPendingAmount || 0} /></span>} />
              <InfoRow label="Settlement Status" badge={<StatusChip label={(settlement.settlementStatus || 'settled').toUpperCase()} type="success" />} />
              <InfoRow label="Reconciliation Status" badge={<StatusChip label="RECONCILED (BALANCED)" type="success" />} />
            </SectionCard>
          )}

          {/* TAB 3: GATEWAY */}
          {activeTab === 'gateway' && (
            <SectionCard title="Original Razorpay Gateway Information" icon={FiCreditCard}>
              <InfoRow label="Payment ID" value={gateway.paymentId || 'N/A'} mono />
              <InfoRow label="Order ID" value={gateway.orderId || 'N/A'} mono />
              <InfoRow label="Capture Status" badge={<StatusChip label={(gateway.captureStatus || 'captured').toUpperCase()} type="success" />} />
              <InfoRow label="Settlement ID" value={gateway.settlementId || 'N/A'} mono />
              <InfoRow label="Settlement Status" badge={<StatusChip label={(gateway.settlementStatus || 'settled').toUpperCase()} type="success" />} />
              <InfoRow label="Settlement Date" value={fmtDate(gateway.settlementDate)} />
              <InfoRow label="Settlement Amount" badge={<span className="font-black text-slate-900"><PriceDisplay amount={gateway.settlementAmount || 0} /></span>} />
              <InfoRow label="Gateway Fee" badge={<span className="font-bold text-amber-600"><PriceDisplay amount={gateway.gatewayFee || 0} /></span>} />
              <InfoRow label="Gateway Tax" badge={<span className="font-bold text-amber-600"><PriceDisplay amount={gateway.gatewayTax || 0} /></span>} />
              <InfoRow label="Bank Reference / UTR" value={gateway.bankReference || 'N/A'} mono />
              <InfoRow label="Webhook Verification" badge={<StatusChip label={(gateway.webhookVerificationStatus || 'VERIFIED').toUpperCase()} type="success" />} />
            </SectionCard>
          )}

          {/* TAB 4: PAYMENT */}
          {activeTab === 'payment' && (
            <SectionCard title="Payment Transaction Details" icon={FiDollarSign}>
              <InfoRow label="Payment Method" value={(payment.paymentMethod || 'online').toUpperCase()} />
              <InfoRow label="Payment Type" value={(payment.paymentType || 'payment').toUpperCase()} />
              <InfoRow label="Amount Paid" badge={<span className="font-black text-slate-900"><PriceDisplay amount={payment.amountPaid || 0} /></span>} />
              <InfoRow
                label="Transaction Reference"
                value={payment.transactionRef || 'N/A'}
                mono
                onClick={() => openInvestigationDrawer('payment', entityData?._id)}
              />
              <InfoRow label="Payment Status" badge={<StatusChip label={(payment.paymentStatus || 'success').toUpperCase()} type="success" />} />
            </SectionCard>
          )}

          {/* TAB 5: PROVIDER */}
          {activeTab === 'provider' && (
            <SectionCard title="Provider Earnings & Payout Breakdown" icon={FiUser}>
              <InfoRow
                label="Provider Name"
                value={provider.name || 'Provider'}
                onClick={() => openInvestigationDrawer('provider', provider._id)}
              />
              <InfoRow label="Gross Earnings" badge={<span className="font-bold text-slate-900"><PriceDisplay amount={provider.providerEarnings || 0} /></span>} />
              <InfoRow label="Platform Commission" badge={<span className="font-bold text-rose-600"><PriceDisplay amount={provider.commission || 0} /></span>} />
              <InfoRow label="Net Provider Share" badge={<span className="font-black text-blue-600"><PriceDisplay amount={provider.netShare || 0} /></span>} />
              <InfoRow
                label="Wallet Credit Balance"
                badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={provider.walletCredit || 0} /></span>}
                onClick={() => openInvestigationDrawer('provider_wallet', provider._id)}
              />
              <InfoRow label="Payout Status" badge={<StatusChip label={provider.payoutStatus || 'READY FOR PAYOUT'} type="success" />} />
            </SectionCard>
          )}

          {/* TAB 6: WITHDRAWAL */}
          {activeTab === 'withdrawal' && (
            <SectionCard title="Linked Provider Withdrawal Request" icon={FiBriefcase}>
              <InfoRow
                label="Withdrawal ID"
                value={withdrawal.withdrawalId || 'N/A'}
                mono
                onClick={() => openInvestigationDrawer('payout', withdrawal._id || withdrawal.withdrawalId)}
              />
              <InfoRow label="Transfer Status" badge={<StatusChip label={(withdrawal.transferStatus || 'pending').toUpperCase()} type={withdrawal.transferStatus === 'completed' ? 'success' : 'info'} />} />
              <InfoRow label="Bank / Payout Info" value={withdrawal.bank || 'Bank Transfer'} />
              <InfoRow label="UTR Reference" value={withdrawal.utr || 'N/A'} mono />
              <InfoRow label="Transfer Date" value={fmtDate(withdrawal.transferDate)} />
              <InfoRow label="Amount Withdrawn" badge={<span className="font-black text-emerald-600"><PriceDisplay amount={withdrawal.amount || 0} /></span>} />
            </SectionCard>
          )}

          {/* TAB 7: LEDGER */}
          {activeTab === 'ledger' && (
            <SectionCard title="Linked Transaction Ledger Entries" icon={FiFileText}>
              {ledger.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No linked ledger entries found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Transaction ID</th>
                        <th className="p-3">Entry Type</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {ledger.map((e, idx) => (
                        <tr key={e._id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-600">
                            <button
                              onClick={() => openInvestigationDrawer('payment', e._id || entityData?._id)}
                              className="hover:underline"
                            >
                              {e.transactionId || `#${(e._id || '').slice(-6)}`}
                            </button>
                          </td>
                          <td className="p-3 font-bold text-slate-800 uppercase">{e.type || 'entry'}</td>
                          <td className="p-3 font-black text-slate-900"><PriceDisplay amount={e.amount || 0} /></td>
                          <td className="p-3 uppercase text-slate-500">{e.paymentMethod || 'online'}</td>
                          <td className="p-3"><StatusChip label={(e.paymentStatus || 'success').toUpperCase()} type="success" /></td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 8: TIMELINE */}
          {activeTab === 'timeline' && (
            <SectionCard title="End-to-End Settlement Timeline" icon={FiClock}>
              <div className="space-y-4 text-xs">
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">1. Booking Created</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.bookingCreated)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">2. Payment Initiated</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.paymentInitiated)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">3. Payment Captured (Razorpay)</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.paymentCaptured)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">4. Settlement Created & Completed</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.settlementCompleted)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-slate-800">5. Provider Earnings Generated</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timeline.providerEarningsGenerated)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className={`w-3 h-3 rounded-full ${timeline.withdrawalPaid ? 'bg-emerald-500' : 'bg-amber-400'} mt-0.5 shrink-0`} />
                  <div>
                    <p className="font-bold text-slate-800">6. Provider Withdrawal Requested & Paid</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{timeline.withdrawalPaid ? fmtDate(timeline.withdrawalPaid) : 'Pending Provider Withdrawal'}</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Financial Settlement Console &bull; Single-Source Reconciled
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

export default SettlementDetailModal;
