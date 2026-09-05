import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, DollarSign, Layers, FileText, Clock, Shield,
  CheckCircle, AlertCircle, ArrowUpRight, ArrowDownLeft,
  Copy, Check, ExternalLink, TrendingUp, TrendingDown,
  CreditCard, Wallet, RefreshCw, User, Briefcase,
  Receipt, Banknote, AlertTriangle, Star, Gift
} from 'lucide-react';
import PriceDisplay from '../../../../components/PriceDisplay';
import * as TransactionService from '../../../../services/TransactionService';
import { normalizeStatus } from '../../../../utils/status';
import { fmtDate, fmtDateTime } from '../../../../utils/format';

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI atoms
// ─────────────────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value, mono = false, badge, highlight }) => (
  <div className={`flex items-center justify-between py-2 border-b border-neutral-100 last:border-0 gap-3 text-xs ${highlight ? 'bg-indigo-50/40 -mx-4 px-4 rounded' : ''}`}>
    <span className="text-neutral-500 font-medium shrink-0">{label}</span>
    <span className={`font-semibold text-neutral-800 text-right ${mono ? 'font-mono break-all' : ''}`}>
      {badge || value || '—'}
    </span>
  </div>
);

const SectionCard = ({ title, icon: Icon, iconColor = 'text-teal-600', children, noPad = false }) => (
  <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden">
    {title && (
      <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/60">
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
        <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{title}</h3>
      </div>
    )}
    <div className={noPad ? '' : 'p-4'}>{children}</div>
  </div>
);

const StatusChip = ({ label, type = 'default', size = 'sm' }) => {
  const types = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    info: 'bg-blue-50 text-blue-700 border-blue-200/80',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    default: 'bg-neutral-100 text-neutral-600 border-neutral-200/80',
  };
  const sz = size === 'lg' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center ${sz} font-bold uppercase tracking-wider border rounded-full ${types[type]}`}>
      {label}
    </span>
  );
};

const AmtRow = ({ label, amount, colorClass = 'text-slate-700', bold = false, indent = false }) => (
  <div className={`flex items-center justify-between py-1.5 ${indent ? 'pl-4' : ''}`}>
    <span className={`text-xs text-slate-500 ${bold ? 'font-bold text-slate-700' : ''}`}>{label}</span>
    <span className={`text-xs font-bold ${colorClass}`}>
      {amount > 0 ? <PriceDisplay amount={amount} /> : <span className="text-slate-300">₹0</span>}
    </span>
  </div>
);

const CopyBtn = ({ text, fieldKey, copiedField, setCopiedField }) => {
  const copy = () => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text).catch(() => { });
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };
  return (
    <button onClick={copy} className="ml-1 text-slate-400 hover:text-slate-600 transition-colors inline-flex" title="Copy">
      {copiedField === fieldKey
        ? <Check className="w-3 h-3 text-emerald-500" />
        : <Copy className="w-3 h-3" />}
    </button>
  );
};

const ConnectedRecordRow = ({ icon: Icon, iconColor, label, value, onClick, empty }) => {
  if (empty || !value) {
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
        <div className={`p-1.5 rounded-lg bg-slate-100`}>
          <Icon className="w-3.5 h-3.5 text-slate-400" />
        </div>
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <span className="ml-auto text-xs text-slate-300">Not linked</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className={`p-1.5 rounded-lg ${iconColor.replace('text-', 'bg-').replace('-700', '-100').replace('-600', '-100')}`}>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <p className="font-mono text-xs font-bold text-slate-800 truncate" title={value}>{value}</p>
      </div>
      {onClick && (
        <button
          onClick={onClick}
          className="ml-auto p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors"
          title={`Open ${label}`}
        >
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tab definitions
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview', icon: DollarSign },
  { id: 'breakdown', label: 'Financial Breakdown', icon: Layers },
  { id: 'connected', label: 'Connected Records', icon: FileText },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'audit', label: 'Audit', icon: Shield },
];

// ─────────────────────────────────────────────────────────────────────────────
// TransactionLedgerDetailModal — dedicated to Transaction Ledger only
// NOT reusing PaymentViewDetailModal or any other modal
// ─────────────────────────────────────────────────────────────────────────────
const TransactionLedgerDetailModal = ({ isOpen, onClose, initialData }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedField, setCopiedField] = useState(null);

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Load full ledger detail from backend ─────────────────────────────────
  const loadDetail = useCallback(async (txnId) => {
    if (!txnId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await TransactionService.getLedgerDetail(txnId);
      if (res.data?.success) {
        setDetails(res.data.data);
      } else {
        setError('Could not load ledger detail.');
      }
    } catch (err) {
      setError('Failed to fetch transaction detail.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && initialData?._id) {
      setDetails(null);
      setActiveTab('overview');
      loadDetail(initialData._id);
    }
  }, [isOpen, initialData?._id]);

  if (!isOpen || !initialData) return null;

  const d = details || initialData;

  // Payment status colour
  const payStatus = (d.paymentStatus || 'pending').toLowerCase();
  const isSuccess = ['success', 'completed', 'paid'].includes(payStatus);
  const isFailed = payStatus === 'failed';
  const headerBg = isSuccess
    ? 'bg-emerald-600'
    : isFailed
      ? 'bg-rose-600'
      : 'bg-amber-500';

  const txnLabel = d.transactionId || d.razorpayPaymentId || `#${String(d._id || '').slice(-8).toUpperCase()}`;

  // ── Navigation callbacks ─────────────────────────────────────────────────
  const nav = {
    booking: (id) => navigate(`/admin/bookings?search=${encodeURIComponent(id || d.booking?.bookingId || '')}&openDetail=true`),
    payment: (id) => navigate(`/admin/payments?search=${encodeURIComponent(id || d.razorpayPaymentId || d.transactionId || '')}&openDetail=true`),
    refund: (id) => navigate(`/admin/refunds?search=${encodeURIComponent(id || d.refundId || '')}&openDetail=true`),
    settlement: (id) => navigate(`/admin/settlements?search=${encodeURIComponent(id || d.settlementId || d.razorpaySettlementId || '')}&openDetail=true`),
    customer: (id) => navigate(`/admin/customers?search=${encodeURIComponent(id || d.customer?.customerId || d.customer?._id || '')}&openDetail=true`),
    provider: (id) => navigate(`/admin/approve-providers?search=${encodeURIComponent(id || d.provider?.providerId || d.provider?._id || '')}&openDetail=true`),
    custWallet: (id) => navigate(`/admin/customer-wallets?search=${encodeURIComponent(id || d.walletTransactionId || '')}&openDetail=true`),
    provWallet: (id) => navigate(`/admin/provider-wallets?search=${encodeURIComponent(id || d.walletTransactionId || '')}&openDetail=true`),
    provEarnings: () => navigate('/admin/provider-earnings'),
    payout: (id) => navigate(`/admin/payout?search=${encodeURIComponent(id || d.paymentRecord?.transactionReference || d.bookingId || '')}&openDetail=true`),
  };

  // ── Type badge styling ───────────────────────────────────────────────────
  const getTxnTypeChip = (type) => {
    const map = {
      payment: { label: 'Customer Payment', type: 'success' },
      wallet_topup: { label: 'Wallet Payment', type: 'warning' },
      refund: { label: 'Refund', type: 'danger' },
      refundrecovery: { label: 'Wallet Refund', type: 'danger' },
      commissiondeduction: { label: 'Commission', type: 'default' },
      settlement: { label: 'Settlement', type: 'info' },
      withdrawal: { label: 'Withdrawal', type: 'indigo' },
      withdrawalrejection: { label: 'Withdrawal Rejected', type: 'danger' },
      penalty: { label: 'Penalty', type: 'danger' },
      referralreward: { label: 'Referral Reward', type: 'purple' },
      cashback: { label: 'Cashback / Coupon', type: 'success' },
      escrow_hold: { label: 'Escrow Hold', type: 'info' },
      escrow_release: { label: 'Escrow Release', type: 'success' },
      adjustment: { label: 'Adjustment', type: 'default' },
    };
    const cfg = map[type] || { label: type?.replace(/_/g, ' ') || 'Unknown', type: 'default' };
    return <StatusChip label={cfg.label} type={cfg.type} size="lg" />;
  };

  const getStatusChip = (status) => {
    const s = (status || '').toLowerCase();
    if (['success', 'completed', 'paid'].includes(s)) return <StatusChip label="Success" type="success" />;
    if (['pending', 'processing'].includes(s)) return <StatusChip label={s} type="warning" />;
    if (s === 'failed') return <StatusChip label="Failed" type="danger" />;
    if (s === 'refunded') return <StatusChip label="Refunded" type="purple" />;
    return <StatusChip label={s || 'Unknown'} />;
  };

  const isWithdrawal = d.type === 'withdrawal' || d.ledgerType === 'withdrawal' || (d.bookingId && d.bookingId.startsWith('WDL-'));

  // ─────────────────────────────────────────────────────────────────────────
  // Tab renderers
  // ─────────────────────────────────────────────────────────────────────────

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Transaction Summary */}
      <SectionCard title="Transaction Summary" icon={DollarSign} iconColor="text-indigo-600">
        <InfoRow label="Transaction ID" value={d.transactionId || d._id} mono />
        {d.referenceNumber && d.referenceNumber !== d.transactionId && (
          <InfoRow label="Reference No." value={d.referenceNumber} mono />
        )}
        <InfoRow label="Type" badge={getTxnTypeChip(d.type)} />
        <InfoRow label="Ledger" value={d.ledgerType} />
        <InfoRow label="Entry" badge={
          d.entryType === 'credit' || ['payment', 'settlement', 'wallet_topup', 'referralreward', 'cashback', 'escrow_release'].includes(d.type)
            ? <StatusChip label="Credit (Cr)" type="success" />
            : <StatusChip label="Debit (Dr)" type="danger" />
        } />
        <InfoRow label="Status" badge={getStatusChip(d.paymentStatus)} />
        <InfoRow label="Currency" value={d.currency || 'INR'} />
        <InfoRow label="Description" value={d.description} />
      </SectionCard>

      {/* Financial Summary */}
      <SectionCard title="Financial Summary" icon={Layers} iconColor="text-emerald-600">
        <InfoRow
          label="Amount"
          value=""
          badge={
            <span className="font-black text-slate-900 text-sm">
              <PriceDisplay amount={d.amount || 0} />
            </span>
          }
          highlight
        />
        {(d.debitAmount || 0) > 0 && (
          <InfoRow label="Debit (Dr)" badge={
            <span className="font-black text-rose-600 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <PriceDisplay amount={d.debitAmount} />
            </span>
          } />
        )}
        {(d.creditAmount || 0) > 0 && (
          <InfoRow label="Credit (Cr)" badge={
            <span className="font-black text-emerald-600 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <PriceDisplay amount={d.creditAmount} />
            </span>
          } />
        )}
        {d.balanceBefore != null && (
          <InfoRow label="Balance Before" badge={<span className="font-mono font-bold text-slate-700"><PriceDisplay amount={d.balanceBefore} /></span>} />
        )}
        {d.balanceAfter != null && (
          <InfoRow label="Balance After" badge={<span className="font-mono font-bold text-indigo-700"><PriceDisplay amount={d.balanceAfter} /></span>} />
        )}
        <InfoRow label="Payment Method" badge={
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold uppercase">
            {d.paymentMethod || 'N/A'}
          </span>
        } />
        <InfoRow label="Gateway" value={d.razorpayPaymentId ? 'Razorpay' : d.paymentMethod === 'cash' ? 'Cash' : d.paymentMethod === 'wallet' ? 'Platform Wallet' : 'N/A'} />
      </SectionCard>

      {/* Reference IDs */}
      <SectionCard title="Reference Numbers" icon={Receipt} iconColor="text-slate-600">
        <InfoRow label="Payment ID" value={d.razorpayPaymentId || '—'} mono />
        <InfoRow label="Order ID" value={d.razorpayOrderId || '—'} mono />
        <InfoRow label="Settlement ID" value={d.razorpaySettlementId || '—'} mono />
        <InfoRow label="Refund ID" value={d.refundId || '—'} mono />
        <InfoRow label="Wallet TXN" value={d.walletTransactionId || '—'} mono />
        <InfoRow label="Bank Reference" value={d.settlement?.bankReference || '—'} mono />
      </SectionCard>

      {/* Entities */}
      <SectionCard title="Parties" icon={User} iconColor="text-sky-600">
        {d.customer ? (
          <>
            <InfoRow label="Customer" badge={
              <button onClick={() => nav.customer(d.customer._id || d.customer.customerId)} className="text-blue-600 hover:underline font-bold text-xs cursor-pointer">{d.customer.name}</button>
            } />
            <InfoRow label="Customer Email" value={d.customer.email} />
            <InfoRow label="Customer Phone" value={d.customer.phone} />
          </>
        ) : isWithdrawal ? (
          <InfoRow label="Customer" value="Not applicable (Provider Withdrawal)" />
        ) : null}

        {d.provider ? (
          <>
            <InfoRow label="Provider" badge={
              <button onClick={() => nav.provider(d.provider._id || d.provider.providerId)} className="text-blue-600 hover:underline font-bold text-xs cursor-pointer">{d.provider.name}</button>
            } />
            <InfoRow label="Provider Email" value={d.provider.email} />
          </>
        ) : null}

        <InfoRow label="Created By" value={d.audit?.createdBy || '—'} />
        <InfoRow label="Created At" value={fmtDateTime(d.createdAt)} />
        <InfoRow label="Updated At" value={fmtDateTime(d.updatedAt)} />
      </SectionCard>
    </div>
  );

  const renderBreakdown = () => {
    if (isWithdrawal) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard title="Withdrawal Outflow Breakdown" icon={CreditCard} iconColor="text-indigo-600">
            <div className="divide-y divide-slate-50">
              <AmtRow label="Withdrawal Requested Amount" amount={d.amount || 0} bold />
              <AmtRow label="Platform Commission" amount={0} colorClass="text-emerald-600" indent />
              <AmtRow label="Wallet Debit (Outflow)" amount={d.amount || 0} bold colorClass="text-rose-600" indent />
              <div className="pt-2 mt-1">
                <InfoRow label="Remaining Wallet Balance" badge={<span className="font-mono font-bold text-indigo-700"><PriceDisplay amount={d.balanceAfter ?? d.provider?.wallet?.availableBalance ?? 0} /></span>} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Payout Settlement Status" icon={Banknote} iconColor="text-sky-600">
            <InfoRow label="Payout Status" badge={
              <StatusChip
                label={d.paymentStatus || 'completed'}
                type={['completed', 'transferred', 'success'].includes(d.paymentStatus) ? 'success' : 'warning'}
              />
            } />
            <AmtRow label="Transferred Amount" amount={d.amount || 0} bold colorClass="text-sky-700" />
            <InfoRow label="Reference / UTR" value={d.referenceNumber || d.paymentRecord?.utrNo || '—'} mono />
          </SectionCard>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Split */}
        <SectionCard title="Payment Split" icon={CreditCard} iconColor="text-indigo-600">
          <div className="divide-y divide-slate-50">
            <AmtRow label="Total Booking Amount" amount={d.totalAmount || 0} bold />
            {(d.discount || 0) > 0 && <AmtRow label="Discount Applied" amount={d.discount} colorClass="text-amber-600" indent />}
            {(d.subtotal || 0) > 0 && <AmtRow label="Subtotal" amount={d.subtotal} indent />}
            <div className="pt-2 mt-1">
              {(d.onlinePaid || d.onlineAmount || 0) > 0 && <AmtRow label="Online (Razorpay / UPI)" amount={d.onlinePaid || d.onlineAmount} colorClass="text-blue-700" indent />}
              {(d.walletPaid || d.walletAmount || 0) > 0 && <AmtRow label="Wallet Used" amount={d.walletPaid || d.walletAmount} colorClass="text-amber-700" indent />}
              {(d.cashPaid || d.cashAmount || 0) > 0 && <AmtRow label="Cash Paid" amount={d.cashPaid || d.cashAmount} colorClass="text-lime-700" indent />}
            </div>
            <div className="pt-1 space-y-1">
              <AmtRow label="Attempted Amount" amount={d.attemptedAmount != null ? d.attemptedAmount : (d.amount || 0)} colorClass="text-slate-600" indent />
              <AmtRow label="Actually Paid" amount={d.finalPaid ?? (d.totalPaidAmount || d.amount || 0)} bold colorClass={(d.finalPaid || d.totalPaidAmount || d.amount || 0) > 0 ? "text-emerald-700 font-black" : "text-rose-600 font-bold"} />
            </div>
          </div>
        </SectionCard>

        {/* Commission & Earnings */}
        <SectionCard title="Commission & Provider Earnings" icon={TrendingUp} iconColor="text-emerald-600">
          <AmtRow label="Gross Amount" amount={d.totalAmount || d.totalPaidAmount || d.amount || 0} bold />
          <AmtRow label="Commission Deducted" amount={d.commissionAmount || 0} colorClass="text-orange-600" indent />
          <AmtRow label="Provider Earnings (Net)" amount={d.providerEarnings || 0} colorClass="text-emerald-600" bold />
          <div className="border-t border-slate-100 mt-2 pt-2">
            {d.providerEarningRecord && <>
              <InfoRow label="Earning Status" badge={
                <StatusChip label={d.providerEarningRecord.status || 'held'} type={
                  d.providerEarningRecord.status === 'available' || d.providerEarningRecord.status === 'paid' ? 'success'
                    : d.providerEarningRecord.status === 'held' ? 'warning' : 'default'
                } />
              } />
              {d.providerEarningRecord.availableAfter && (
                <InfoRow label="Available After" value={fmtDate(d.providerEarningRecord.availableAfter)} />
              )}
            </>}
          </div>
        </SectionCard>

        {/* Gateway & Settlement */}
        <SectionCard title="Gateway & Settlement" icon={Banknote} iconColor="text-sky-600">
          <InfoRow label="Gateway" value={d.razorpayPaymentId ? 'Razorpay' : d.paymentMethod === 'cash' ? 'Cash' : d.paymentMethod === 'wallet' ? 'Platform Wallet' : 'N/A'} />
          <InfoRow label="Settlement Status" badge={
            <StatusChip
              label={d.settlement?.settlementStatus || d.settlementStatus || 'pending'}
              type={['settled', 'completed'].includes(d.settlement?.settlementStatus || d.settlementStatus) ? 'success' : 'warning'}
            />
          } />
          <AmtRow label="Settlement Amount" amount={d.settlement?.settlementAmount || 0} />
          <AmtRow label="Gateway Fee" amount={d.gatewayFee || 0} colorClass="text-orange-600" indent />
          <AmtRow label="Gateway Tax" amount={d.gatewayTax || 0} colorClass="text-orange-600" indent />
          <AmtRow label="Net Settlement" amount={d.settlement?.netSettlementAmount || 0} bold colorClass="text-sky-700" />
          {d.settlement?.settlementDate && (
            <InfoRow label="Settlement Date" value={fmtDate(d.settlement.settlementDate)} />
          )}
          {d.settlement?.bankReference && (
            <InfoRow label="Bank Reference" value={d.settlement.bankReference} mono />
          )}
        </SectionCard>

        {/* Refund Breakdown */}
        {(d.refund || d.refundedAmount > 0 || ['completed', 'partial', 'processing'].includes(d.refundStatus)) && (() => {
          const rf = d.refund || {
            refundId: d.gatewayRefundId || `RFND-${String(d._id).slice(-6)}`,
            refundStatus: d.refundStatus || (d.gatewayRefundId ? 'processing' : 'completed'),
            requestedAmount: d.refundedAmount || 0,
            refundAmount: d.refundedAmount || 0,
            gatewayRefundAmount: d.gatewayRefundId ? (d.refundedAmount || 0) : 0,
            walletRefundAmount: d.gatewayRefundId ? 0 : (d.refundedAmount || 0),
            feeDeducted: 0,
            refundType: 'cancellation',
            refundSource: 'cancellation',
            refundDestination: d.gatewayRefundId ? 'original_payment' : 'wallet'
          };
          return (
            <SectionCard title="Refund Breakdown" icon={RefreshCw} iconColor="text-rose-500">
              <InfoRow label="Refund ID" value={rf.refundId} mono />
              <InfoRow label="Status" badge={
                <StatusChip 
                  label={rf.refundStatus === 'processing' ? 'PROCESSING (5-7 DAYS)' : (rf.refundStatus || 'COMPLETED').toUpperCase()} 
                  type={rf.refundStatus === 'completed' ? 'success' : rf.refundStatus === 'processing' ? 'warning' : rf.refundStatus === 'failed' ? 'danger' : 'warning'} 
                />
              } />
              <AmtRow label="Requested Amount" amount={rf.requestedAmount || rf.refundAmount || 0} />
              <AmtRow label="Refund Amount" amount={rf.refundAmount || 0} bold colorClass="text-rose-600" />
              <AmtRow label="Gateway Refund" amount={rf.gatewayRefundAmount || 0} indent />
              <AmtRow label="Wallet Refund" amount={rf.walletRefundAmount || 0} indent />
              {rf.feeDeducted > 0 && (
                <AmtRow label="Fee Deducted" amount={rf.feeDeducted} colorClass="text-orange-600" indent />
              )}
              {rf.refundType && <InfoRow label="Refund Type" value={rf.refundType} />}
              {rf.refundSource && <InfoRow label="Source" value={rf.refundSource?.replace(/_/g, ' ')} />}
              {rf.refundDestination && <InfoRow label="Destination" value={rf.refundDestination?.replace(/_/g, ' ')} />}
            </SectionCard>
          );
        })()}

        {/* Booking ledger entries */}
        {d.ledgerEntries && d.ledgerEntries.length > 0 && (
          <div className="md:col-span-2">
            <SectionCard title="All Booking Ledger Entries" icon={Layers} iconColor="text-indigo-600" noPad>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[600px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="p-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Method</th>
                      <th className="p-2.5 text-right text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Debit</th>
                      <th className="p-2.5 text-right text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Credit</th>
                      <th className="p-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="p-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {d.ledgerEntries.map((entry, i) => {
                      const isD = entry.entryType === 'debit' || ['refund', 'withdrawal', 'penalty', 'commissiondeduction', 'refundrecovery'].includes(entry.type);
                      return (
                        <tr key={entry._id || i} className="hover:bg-slate-50/60">
                          <td className="p-2.5 font-semibold text-slate-700 capitalize">{(entry.type || '').replace(/_/g, ' ')}</td>
                          <td className="p-2.5 text-slate-500 uppercase text-[10px] font-bold">{entry.paymentMethod}</td>
                          <td className="p-2.5 text-right font-bold text-rose-600">
                            {isD ? <PriceDisplay amount={entry.amount || 0} /> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="p-2.5 text-right font-bold text-emerald-600">
                            {!isD ? <PriceDisplay amount={entry.amount || 0} /> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase">{entry.paymentStatus}</span>
                          </td>
                          <td className="p-2.5 text-slate-400">{fmtDate(entry.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    );
  };

  const renderConnected = () => {
    const booking = d.booking || {};
    const bookingIdStr = booking.bookingId || (d.bookingId && !d.bookingId.startsWith('WDL-') ? d.bookingId : null);
    const wdlRefStr = isWithdrawal ? (d.bookingId || d.referenceNumber || null) : null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Primary Records" icon={FileText} iconColor="text-indigo-600">
          <ConnectedRecordRow icon={Briefcase} iconColor="text-blue-700" label="Booking"
            value={bookingIdStr}
            onClick={bookingIdStr ? () => nav.booking(bookingIdStr) : null}
            empty={!bookingIdStr}
          />
          <ConnectedRecordRow icon={CreditCard} iconColor="text-emerald-600" label="Payment"
            value={d.razorpayPaymentId || d.transactionId}
            onClick={() => nav.payment(d.razorpayPaymentId || d.transactionId)}
            empty={!d.razorpayPaymentId && !d.transactionId}
          />
          <ConnectedRecordRow icon={RefreshCw} iconColor="text-rose-600" label="Refund"
            value={d.refundId}
            onClick={d.refundId ? () => nav.refund(d.refundId) : null}
            empty={!d.refundId}
          />
          <ConnectedRecordRow icon={Wallet} iconColor="text-amber-600" label="Wallet TXN"
            value={d.walletTransactionId}
            onClick={d.walletTransactionId ? () => (d.provider ? nav.provWallet(d.walletTransactionId) : nav.custWallet(d.walletTransactionId)) : null}
            empty={!d.walletTransactionId}
          />
          <ConnectedRecordRow icon={TrendingUp} iconColor="text-sky-600" label="Settlement"
            value={d.settlementId || d.razorpaySettlementId}
            onClick={() => nav.settlement(d.settlementId || d.razorpaySettlementId)}
            empty={!d.settlementId && !d.razorpaySettlementId}
          />
        </SectionCard>

        <SectionCard title="Provider & Earnings" icon={TrendingUp} iconColor="text-emerald-600">
          <ConnectedRecordRow icon={User} iconColor="text-indigo-600" label="Provider"
            value={d.provider?.name ? `${d.provider.name} (${d.provider.providerId || d.provider.email || ''})` : null}
            onClick={d.provider ? () => nav.provider(d.provider.providerId || d.provider._id) : null}
            empty={!d.provider}
          />
          <ConnectedRecordRow icon={TrendingUp} iconColor="text-emerald-600" label="Provider Earnings"
            value={d.providerEarningRecord ? `₹${d.providerEarnings || 0} (${d.providerEarningRecord.status || 'held'})` : null}
            onClick={d.providerEarningRecord ? nav.provEarnings : null}
            empty={!d.providerEarningRecord}
          />
          <ConnectedRecordRow icon={Banknote} iconColor="text-violet-600" label="Payout / Withdrawal"
            value={wdlRefStr ? `${wdlRefStr} (₹${d.amount || 0})` : d.paymentRecord ? `₹${d.paymentRecord.amount || 0} — ${d.paymentRecord.status || 'pending'}` : null}
            onClick={wdlRefStr ? () => nav.payout(wdlRefStr) : d.paymentRecord ? () => nav.payout(d.paymentRecord.transactionReference) : null}
            empty={!wdlRefStr && !d.paymentRecord}
          />
          <ConnectedRecordRow icon={AlertTriangle} iconColor="text-orange-600" label="Complaint"
            value={d.complaint ? `${d.complaint.complaintId || '#'} (${d.complaint.status || 'open'})` : null}
            onClick={null}
            empty={!d.complaint}
          />
        </SectionCard>

        {/* Razorpay IDs */}
        <SectionCard title="Razorpay Gateway" icon={CreditCard} iconColor="text-blue-600">
          <ConnectedRecordRow icon={Receipt} iconColor="text-blue-600" label="Razorpay Payment ID"
            value={d.razorpayPaymentId}
            onClick={null}
            empty={!d.razorpayPaymentId}
          />
          <ConnectedRecordRow icon={Receipt} iconColor="text-indigo-600" label="Razorpay Order ID"
            value={d.razorpayOrderId}
            onClick={null}
            empty={!d.razorpayOrderId}
          />
          <ConnectedRecordRow icon={Receipt} iconColor="text-sky-600" label="Razorpay Settlement ID"
            value={d.razorpaySettlementId}
            onClick={null}
            empty={!d.razorpaySettlementId}
          />
          {d.refund?.gatewayRefundId && (
            <ConnectedRecordRow icon={RefreshCw} iconColor="text-rose-600" label="Razorpay Refund ID"
              value={d.refund.gatewayRefundId}
              onClick={null}
              empty={false}
            />
          )}
          <InfoRow label="Signature Verified" badge={
            d.razorpaySignature
              ? <StatusChip label="Verified" type="success" />
              : <StatusChip label="N/A" />
          } />
        </SectionCard>

        {/* Booking Details */}
        {d.booking && (
          <SectionCard title="Booking Details" icon={Briefcase} iconColor="text-slate-600">
            <InfoRow label="Booking ID" value={d.booking.bookingId} mono />
            <InfoRow label="Booking Status" badge={
              <StatusChip
                label={d.booking.status || '—'}
                type={d.booking.status === 'completed' ? 'success' : d.booking.status === 'cancelled' ? 'danger' : 'warning'}
              />
            } />
            <InfoRow label="Payment Status" badge={
              <StatusChip
                label={d.booking.paymentStatus || '—'}
                type={['paid', 'escrowhold'].includes(normalizeStatus(d.booking.paymentStatus)) ? 'success' : 'warning'}
              />
            } />
            <InfoRow label="Total Amount" badge={<span className="font-black text-slate-800"><PriceDisplay amount={d.booking.totalAmount || 0} /></span>} />
            <InfoRow label="Date" value={fmtDate(d.booking.date)} />
            <InfoRow label="Services" value={d.booking.services?.map(s => s.service?.title).filter(Boolean).join(', ') || '—'} />
          </SectionCard>
        )}
      </div>
    );
  };

  const renderTimeline = () => {
    const events = d.timeline || [];
    return (
      <SectionCard title="Transaction Timeline" icon={Clock} iconColor="text-indigo-600">
        {events.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No timeline events available.</p>
        ) : (
          <div className="space-y-1 mt-1">
            {events.map((ev, i) => {
              const isLast = i === events.length - 1;
              const isDone = ev.status === 'done';
              const isFail = ev.status === 'failed';
              const isPend = !isDone && !isFail;
              return (
                <div key={i} className="flex gap-3">
                  {/* Line */}
                  <div className="flex flex-col items-center">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 ${isDone ? 'bg-emerald-500 border-emerald-500'
                        : isFail ? 'bg-rose-500 border-rose-500'
                          : 'bg-amber-400 border-amber-400'
                      }`} />
                    {!isLast && <div className="w-0.5 bg-slate-100 flex-1 mt-1 mb-0.5 min-h-[20px]" />}
                  </div>
                  {/* Content */}
                  <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                    <p className="text-xs font-bold text-slate-800">{ev.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {ev.timestamp && (
                        <p className="text-[11px] text-slate-400">{fmtDateTime(ev.timestamp)}</p>
                      )}
                      {ev.actor && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded font-bold">{ev.actor}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    );
  };

  const renderAudit = () => {
    const audit = d.audit || {};
    const refundLogs = d.refundAuditLogs || [];
    return (
      <div className="space-y-4">
        <SectionCard title="Transaction Audit Trail" icon={Shield} iconColor="text-indigo-600">
          <InfoRow label="Created By" value={audit.createdBy || '—'} />
          <InfoRow label="Role" value={audit.createdByRole || '—'} />
          <InfoRow label="Updated By" value={audit.updatedBy || '—'} />
          <InfoRow label="Reason / Description" value={audit.reason || '—'} />
          <InfoRow label="Idempotency Key" value={audit.idempotencyKey || (d.type === 'payment' ? 'Standard Checkout (Signature Verified)' : '—')} mono />
          <InfoRow label="Created At" value={fmtDateTime(audit.createdAt)} />
          <InfoRow label="Updated At" value={fmtDateTime(audit.updatedAt)} />
        </SectionCard>

        {refundLogs.length > 0 && (
          <SectionCard title="Refund Audit Logs" icon={Shield} iconColor="text-rose-500" noPad>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Action</th>
                    <th className="p-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Role</th>
                    <th className="p-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Details</th>
                    <th className="p-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">IP</th>
                    <th className="p-2.5 text-left text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {refundLogs.map((log, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="p-2.5 font-semibold text-slate-700">{log.action}</td>
                      <td className="p-2.5 text-slate-500 uppercase text-[10px] font-bold">{log.userRole || '—'}</td>
                      <td className="p-2.5 text-slate-500 max-w-[160px] truncate" title={JSON.stringify(log.details)}>
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details || '—'}
                      </td>
                      <td className="p-2.5 font-mono text-[10px] text-slate-500">{log.ip || '—'}</td>
                      <td className="p-2.5 text-slate-400">{fmtDateTime(log.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[88vh]" onClick={e => e.stopPropagation()}>

        {/* Light Header */}
        <div className="bg-neutral-50 px-5 py-3.5 flex items-center justify-between border-b border-neutral-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200 flex items-center justify-center font-bold text-sm">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900 font-mono">{txnLabel}</h2>
                {getTxnTypeChip(d.type)}
              </div>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                Master Ledger Record • {fmtDateTime(d.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(d.creditAmount || 0) > 0 && (
              <div className="px-3 py-1 bg-emerald-50 border border-emerald-200/80 rounded-xl text-right">
                <div className="text-[9px] uppercase font-bold text-emerald-600">Credit</div>
                <div className="font-black text-xs text-emerald-700"><PriceDisplay amount={d.creditAmount} /></div>
              </div>
            )}
            {(d.debitAmount || 0) > 0 && (
              <div className="px-3 py-1 bg-rose-50 border border-rose-200/80 rounded-xl text-right">
                <div className="text-[9px] uppercase font-bold text-rose-600">Debit</div>
                <div className="font-black text-xs text-rose-700"><PriceDisplay amount={d.debitAmount} /></div>
              </div>
            )}
            <button onClick={onClose} className="p-1.5 bg-white hover:bg-neutral-100 rounded-lg text-neutral-600 border border-neutral-200 cursor-pointer ml-1" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="bg-white border-b border-neutral-200 px-5 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-1 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${active ? 'bg-indigo-600 text-white font-bold' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-neutral-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-neutral-50/20">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-neutral-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium">Loading ledger detail…</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <p className="text-rose-600 text-xs font-semibold">{error}</p>
              <button
                onClick={() => loadDetail(initialData._id)}
                className="mt-3 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'breakdown' && renderBreakdown()}
              {activeTab === 'connected' && renderConnected()}
              {activeTab === 'timeline' && renderTimeline()}
              {activeTab === 'audit' && renderAudit()}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-neutral-200 px-5 py-3 flex items-center justify-between text-xs text-neutral-500 shrink-0">
          <span className="font-mono text-neutral-600 font-medium">TXN • {String(d._id || '').slice(-12).toUpperCase()}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadDetail(d._id || initialData._id)}
              className="flex items-center gap-1 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button onClick={onClose} className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold cursor-pointer">
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TransactionLedgerDetailModal;
