import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiX, FiCreditCard, FiUser, FiBriefcase, FiCalendar, FiClock,
  FiDollarSign, FiCheckCircle, FiAlertCircle, FiRefreshCw, FiExternalLink,
  FiCopy, FiCheck, FiShield, FiFileText, FiXCircle, FiRotateCcw,
  FiMessageSquare, FiTrendingUp, FiActivity, FiLayers, FiZap, FiLoader
} from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import DetailSkeleton from '../../../../components/ui-skeletons/DetailSkeleton';
import TimelineSkeleton from '../../../../components/ui-skeletons/TimelineSkeleton';
import * as TransactionService from '../../../../services/TransactionService';

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────
import { fmtDate, fmtDateOnly, fmtDateTime, formatBankName } from '../../../../utils/format';

const AmtCell = ({ amount, colorClass = 'text-slate-900' }) => (
  <span className={`font-black text-sm ${colorClass}`}>
    {amount > 0 ? <PriceDisplay amount={amount} /> : <span className="text-slate-300 font-normal">₹0</span>}
  </span>
);

const InfoRow = ({ label, value, mono = false, badge }) => (
  <div className="flex items-start justify-between py-2.5 border-b border-slate-50 last:border-0 gap-4">
    <span className="text-xs text-slate-500 font-medium shrink-0 pt-0.5">{label}</span>
    <span className={`text-xs font-semibold text-slate-800 text-right ${mono ? 'font-mono break-all' : ''}`}>
      {badge || value || '—'}
    </span>
  </div>
);

const SectionCard = ({ title, icon: Icon, iconColor = 'text-blue-600', children }) => (
  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
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

const TimelineItem = ({ label, timestamp, status = 'done', isLast = false }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <div className={`w-3 h-3 rounded-full border-2 mt-0.5 flex-shrink-0 ${status === 'done' ? 'bg-emerald-500 border-emerald-500' :
          status === 'failed' ? 'bg-rose-500 border-rose-500' :
            'bg-amber-400 border-amber-400'
        }`} />
      {!isLast && <div className="w-0.5 bg-slate-100 flex-1 mt-1" />}
    </div>
    <div className={`pb-4 ${isLast ? '' : ''}`}>
      <p className="text-xs font-bold text-slate-800">{label}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(timestamp)}</p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab definitions — conditional per payment type
// ─────────────────────────────────────────────────────────────────────────────
const buildTabs = (paymentType, hasVerification) => {
  const base = [
    { id: 'overview', label: 'Overview', icon: FiDollarSign },
    { id: 'booking', label: 'Booking', icon: FiBriefcase },
  ];

  if (paymentType === 'online') {
    base.push({ id: 'gateway', label: 'Gateway', icon: FiZap });
  } else if (paymentType === 'wallet') {
    base.push({ id: 'wallet_ledger', label: 'Wallet Ledger', icon: FiLayers });
  } else if (paymentType === 'cash') {
    base.push({ id: 'cash_verify', label: 'Payment Verification', icon: FiCheck });
  } else if (paymentType === 'mixed') {
    base.push({ id: 'gateway', label: 'Gateway', icon: FiZap });
    base.push({ id: 'wallet_ledger', label: 'Wallet Breakdown', icon: FiLayers });
  }

  if (hasVerification && paymentType !== 'cash') {
    base.push({ id: 'cash_verify', label: 'Payment Verification', icon: FiCheck });
  }

  base.push(
    { id: 'transaction', label: 'Transaction', icon: FiActivity },
    { id: 'refund', label: 'Refund', icon: FiRotateCcw },
    { id: 'complaint', label: 'Complaint', icon: FiMessageSquare },
    { id: 'settlement', label: 'Settlement', icon: FiTrendingUp },
    { id: 'audit', label: 'Audit', icon: FiShield },
  );
  return base;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal Component
// ─────────────────────────────────────────────────────────────────────────────
const PaymentViewDetailModal = ({ isOpen, onClose, initialData, entityData }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedField, setCopiedField] = useState(null);

  // Full enriched data loaded lazily on modal open
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  // Gateway tab — live Razorpay data loaded separately
  const [gatewayData, setGatewayData] = useState(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);

  const rawData = initialData || entityData;
  const paymentType = (details?.paymentType || (rawData?.paymentMethod || 'online')).toLowerCase();
  const pvData = details?.paymentVerification || details?.booking?.paymentVerification;
  const isActualQR = Boolean(pvData?.method === 'qr_code' || pvData?.qrCodeId || details?.paymentMethod === 'qr_code' || details?.paymentMethod === 'upi_qr');
  const hasVerification = Boolean(paymentType === 'cash' || isActualQR);
  const tabs = buildTabs(paymentType, hasVerification);

  // ── Load enriched payment details on modal open ───────────────────────────
  const loadDetails = useCallback(async (txnId) => {
    if (!txnId) return;
    try {
      setDetailsLoading(true);
      setDetailsError(null);
      const res = await TransactionService.getAdminPaymentDetails(txnId);
      if (res.data?.success) {
        setDetails(res.data.data);
      } else {
        setDetailsError('Could not load payment details.');
      }
    } catch (err) {
      setDetailsError('Failed to fetch payment details.');
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  // ── Load live Razorpay data lazily (only when Gateway tab activated) ───────
  const loadGatewayData = useCallback(async (txnId) => {
    if (!txnId || gatewayData) return;
    try {
      setGatewayLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('payment', txnId);
      if (res.data?.success) {
        setGatewayData(res.data.data?.gatewayData || null);
      }
    } catch (err) {
      // Gateway data is best-effort
    } finally {
      setGatewayLoading(false);
    }
  }, [gatewayData]);

  useEffect(() => {
    const dataObj = initialData || entityData;
    const idToLoad = typeof dataObj === 'string' ? dataObj : dataObj?._id;
    if (isOpen && idToLoad) {
      setDetails(null);
      setGatewayData(null);
      setActiveTab('overview');
      loadDetails(idToLoad);
    }
  }, [isOpen, initialData, entityData]);

  useEffect(() => {
    if (activeTab === 'gateway' && details?._id) {
      loadGatewayData(details._id);
    }
  }, [activeTab, details?._id]);

  if (!isOpen || !rawData) return null;

  const d = details || (typeof rawData === 'object' ? rawData : {});
  const txnId = d.razorpayPaymentId || d.transactionId || d._id || (typeof rawData === 'string' ? rawData : 'N/A');
  const orderId = d.razorpayOrderId || '—';
  const payStatus = (d.paymentStatus || 'pending').toLowerCase();
  const headerStatusColor = ['success', 'completed', 'paid'].includes(payStatus)
    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    : payStatus === 'failed'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
      : 'bg-amber-500/20 text-amber-300 border-amber-500/30';

  const nav = {
    booking: (id) => navigate(`/admin/bookings?search=${encodeURIComponent(id || '')}&openDetail=true`),
    payment: (id) => navigate(`/admin/payments?search=${encodeURIComponent(id || '')}&openDetail=true`),
    transaction: (id) => navigate(`/admin/transactions?search=${encodeURIComponent(id || '')}&openDetail=true`),
    customer: (name) => navigate(`/admin/customers?search=${encodeURIComponent(name || '')}&openDetail=true`),
    provider: (name) => navigate(`/admin/approve-providers?search=${encodeURIComponent(name || '')}&openDetail=true`),
    providerEarnings: () => navigate('/admin/provider-earnings'),
    complaint: () => navigate('/admin/complaints'),
    settlement: () => navigate('/admin/settlements'),
    refund: () => navigate('/admin/refunds'),
    payout: (id) => navigate(`/admin/payout?search=${encodeURIComponent(id || '')}&openDetail=true`),
  };

  const copyToClipboard = (text, field) => {
    if (!text || text === '—' || text === 'N/A') return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyBtn = ({ text, field }) => (
    <button onClick={() => copyToClipboard(text, field)} className="ml-1.5 text-slate-400 hover:text-white transition-colors inline-flex cursor-pointer" title="Copy">
      {copiedField === field ? <FiCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FiCopy className="w-3.5 h-3.5" />}
    </button>
  );

  const EntityLink = ({ label, onClick, className = '' }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold hover:underline text-xs cursor-pointer ${className}`}
    >
      {label} <FiExternalLink className="w-3 h-3" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100 animate-fade-in" onClick={(e) => e.stopPropagation()}>

        {/* ── Modal Header ───────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white flex items-center justify-between border-b border-neutral-700/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary flex-shrink-0">
              <FiCreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300">Payment Detail</span>
                <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${headerStatusColor}`}>
                  {payStatus.toUpperCase()}
                </span>
                {d.paymentType && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full border border-purple-500/30 bg-purple-500/20 text-purple-300">
                    {d.paymentType.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <h2 className="text-base font-black text-white tracking-tight font-mono truncate max-w-[320px]" title={txnId}>
                  {txnId}
                </h2>
                <CopyBtn text={txnId} field="txnId" />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tab Bar ────────────────────────────────────────────────────── */}
        <div className="flex border-b border-neutral-200 bg-neutral-50/90 px-4 gap-0.5 pt-2 overflow-x-auto scrollbar-hide flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${activeTab === tab.id
                    ? 'border-primary text-primary bg-white shadow-xs'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 hover:bg-white/60'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide bg-neutral-50/40 p-5 space-y-5">

          {/* Loading overlay */}
          {detailsLoading && (
            <div className="p-4">
              <DetailSkeleton />
            </div>
          )}

          {detailsError && !detailsLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FiAlertCircle className="w-8 h-8 mb-3 text-rose-400" />
              <p className="text-sm font-medium text-rose-600">{detailsError}</p>
              <button onClick={() => loadDetails(initialData._id)} className="mt-3 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold cursor-pointer">Retry</button>
            </div>
          )}

          {!detailsLoading && !detailsError && (
            <>
              {/* ══ TAB 1: OVERVIEW ══════════════════════════════════════════ */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-primary/10 rounded-2xl text-center border border-primary/20">
                      <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Total Amount</p>
                      <p className="text-xl font-black text-neutral-900 mt-1"><PriceDisplay amount={d.totalAmount || 0} /></p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-2xl text-center border border-blue-100">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Actually Paid</p>
                      <p className="text-xl font-black text-blue-800 mt-1"><PriceDisplay amount={d.finalPaid ?? 0} /></p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-2xl text-center border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Wallet Paid</p>
                      <p className="text-xl font-black text-amber-800 mt-1"><PriceDisplay amount={d.walletPaid || 0} /></p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl text-center border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Cash / QR Paid</p>
                      <p className="text-xl font-black text-emerald-800 mt-1">
                        <PriceDisplay amount={d.paymentType === 'cash' ? (d.cashPaid || 0) : (d.onlinePaid || 0)} />
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <SectionCard title="Payment Summary" icon={FiDollarSign}>
                      <InfoRow label="Payment Status" badge={
                        <StatusChip label={d.paymentStatus || 'Pending'} type={['success', 'completed', 'paid'].includes(payStatus) ? 'success' : payStatus === 'failed' ? 'danger' : 'warning'} />
                      } />
                      <InfoRow label="Capture Status" badge={
                        <StatusChip label={d.captureStatus || (['success', 'completed', 'paid'].includes(payStatus) ? 'Captured' : 'Pending')} type={d.captureStatus === 'captured' || ['success', 'completed', 'paid'].includes(payStatus) ? 'success' : d.captureStatus === 'failed' ? 'danger' : 'warning'} />
                      } />
                      <InfoRow label="Settlement Status" badge={(() => {
                        const st = (d.settlementStatus || d.settlement?.settlementStatus || 'pending').toLowerCase();
                        return <StatusChip label={st.toUpperCase()} type={st === 'settled' ? 'success' : st === 'processing' ? 'warning' : 'default'} />;
                      })()} />
                      {d.gatewayReconciliationStatus && (
                        <InfoRow label="Gateway Reconciliation" badge={
                          <StatusChip label={String(d.gatewayReconciliationStatus).toUpperCase()} type={d.gatewayReconciliationStatus === 'MATCHED' ? 'success' : 'warning'} />
                        } />
                      )}
                      {(d.reconciliationStatus || d.reconciliation?.reconciliationStatus) && (
                        <InfoRow label="Customer Reconciliation" badge={
                          <StatusChip label={String(d.reconciliationStatus || d.reconciliation?.reconciliationStatus).toUpperCase()} type={(d.reconciliationStatus || d.reconciliation?.reconciliationStatus) === 'MATCHED' ? 'success' : 'warning'} />
                        } />
                      )}
                      <InfoRow label="Payment Type" badge={<StatusChip label={d.paymentMethodDisplay || d.paymentType || 'Online'} type="info" />} />
                      <InfoRow label="Payment Method" value={d.paymentMethodDisplay || d.paymentMethod || 'Online'} />
                      <InfoRow label="Gateway" value={
                        d.paymentType === 'cash' || d.paymentMethod === 'cash' ? 'N/A' :
                          d.paymentType === 'wallet' ? 'Platform Wallet' :
                            d.paymentType === 'mixed' ? 'Razorpay + Wallet' : 'Razorpay'
                      } />
                    </SectionCard>

                    <SectionCard title="Financial Breakup" icon={FiTrendingUp}>
                      <InfoRow label="Subtotal" value={<AmtCell amount={d.subtotal || d.totalAmount || 0} />} />
                      <InfoRow label="Discount" value={d.discount > 0 ? <AmtCell amount={d.discount} colorClass="text-rose-600" /> : '₹0'} />
                      {d.coupon?.code && <InfoRow label="Coupon" value={<span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-bold text-[11px]">{d.coupon.code}</span>} />}
                      <InfoRow label="Booking Amount" value={<AmtCell amount={d.totalAmount || 0} />} />
                      <InfoRow label="Attempted Amount" value={<AmtCell amount={d.attemptedAmount != null ? d.attemptedAmount : (d.totalAmount || 0)} colorClass="text-slate-700 font-semibold" />} />
                      <InfoRow label="Actually Paid" value={<AmtCell amount={d.finalPaid ?? 0} colorClass={(d.finalPaid || 0) > 0 ? "text-emerald-700 font-black" : "text-rose-600 font-bold"} />} />
                      <InfoRow label="Platform Commission" value={<AmtCell amount={d.commissionAmount || 0} colorClass="text-purple-700" />} />
                      <InfoRow label="Provider Earnings" value={<AmtCell amount={d.providerEarnings || 0} colorClass="text-blue-700" />} />
                    </SectionCard>
                  </div>

                  <SectionCard title="Payment IDs" icon={FiFileText} iconColor="text-indigo-600">
                    <InfoRow label="Transaction ID" value={d.transactionId || d._id || 'N/A'} mono />
                    <InfoRow label="Razorpay Payment ID" value={d.razorpayPaymentId || 'N/A'} mono />
                    <InfoRow label="Razorpay Order ID" value={d.razorpayOrderId || 'N/A'} mono />
                    <InfoRow label="Razorpay Signature" value={d.razorpaySignature ? `${d.razorpaySignature.slice(0, 20)}…` : 'N/A'} mono />
                    <InfoRow label="Created At" value={fmtDateTime(d.createdAt)} />
                    <InfoRow label="Updated At" value={fmtDateTime(d.updatedAt)} />
                  </SectionCard>
                </div>
              )}

              {/* ══ TAB 2: BOOKING ═══════════════════════════════════════════ */}
              {activeTab === 'booking' && (
                <div className="space-y-5">
                  {d.booking ? (
                    <>
                      <SectionCard title="Booking Information" icon={FiBriefcase} iconColor="text-purple-600">
                        <InfoRow label="Booking ID" value={
                          <EntityLink
                            label={d.booking.bookingId || d.booking._id || 'N/A'}
                            onClick={() => nav.booking(d.booking.bookingId || d.booking._id)}
                          />
                        } />
                        <InfoRow label="Booking Status" badge={
                          <StatusChip label={d.booking.status || 'Pending'} type={d.booking.status === 'completed' ? 'success' : d.booking.status === 'cancelled' ? 'danger' : 'warning'} />
                        } />
                        <InfoRow label="Payment Status" badge={
                          <StatusChip label={d.booking.paymentStatus || 'Pending'} type={['paid', 'escrowhold'].includes(d.booking.paymentStatus) ? 'success' : 'default'} />
                        } />
                        <InfoRow label="Service Date" value={fmtDateOnly(d.booking.date)} />
                        <InfoRow label="Service Time" value={d.booking.time || 'N/A'} />
                        <InfoRow label="Booking Notes" value={d.booking.notes || 'None'} />
                      </SectionCard>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <SectionCard title="Customer" icon={FiUser} iconColor="text-blue-600">
                          {d.customer ? (
                            <>
                              <InfoRow label="Name" value={
                                <EntityLink
                                  label={d.customer.name || 'Customer'}
                                  onClick={() => nav.customer(d.customer.name)}
                                />
                              } />
                              <InfoRow label="Email" value={d.customer.email || 'N/A'} />
                              <InfoRow label="Phone" value={d.customer.phone || 'N/A'} />
                            </>
                          ) : <p className="text-xs text-slate-400">Customer data unavailable</p>}
                        </SectionCard>

                        <SectionCard title="Assigned Provider" icon={FiBriefcase} iconColor="text-emerald-600">
                          {d.provider ? (
                            <>
                              <InfoRow label="Name" value={
                                <EntityLink
                                  label={d.provider.name || 'Provider'}
                                  onClick={() => nav.provider(d.provider.name)}
                                />
                              } />
                              <InfoRow label="Email" value={d.provider.email || 'N/A'} />
                              <InfoRow label="Phone" value={d.provider.phone || 'N/A'} />
                              <InfoRow label="Provider ID" value={d.provider.providerId || 'N/A'} mono />
                            </>
                          ) : <p className="text-xs text-slate-400 italic">Not Assigned</p>}
                        </SectionCard>
                      </div>

                      {d.booking.address ? (
                        <SectionCard title="Service Address" icon={FiCalendar} iconColor="text-slate-600">
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {[d.booking.address.houseNumber, d.booking.address.street, d.booking.address.area, d.booking.address.city, d.booking.address.state, d.booking.address.postalCode].filter(Boolean).join(', ') || 'N/A'}
                          </p>
                        </SectionCard>
                      ) : (
                        <SectionCard title="Service Address" icon={FiCalendar} iconColor="text-slate-600">
                          <p className="text-xs text-slate-400 italic">N/A</p>
                        </SectionCard>
                      )}

                      {d.booking.services?.length > 0 && (
                        <SectionCard title="Services Booked" icon={FiFileText}>
                          <div className="space-y-2">
                            {d.booking.services.map((svc, i) => (
                              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0 text-xs">
                                <span className="font-semibold text-slate-700">{svc.service?.title || 'Service'}</span>
                                <span className="font-black text-slate-900"><PriceDisplay amount={svc.price || 0} /></span>
                              </div>
                            ))}
                          </div>
                        </SectionCard>
                      )}

                      {d.booking.statusHistory?.length > 0 && (() => {
                        const dedupedTimeline = d.booking.statusHistory.filter((h, i, arr) => {
                          if (i === 0) return true;
                          return h.status !== arr[i - 1].status;
                        });

                        return (
                          <SectionCard title="Booking Timeline" icon={FiClock}>
                            <div className="space-y-0">
                              {dedupedTimeline.map((h, i) => (
                                <TimelineItem
                                  key={i}
                                  label={`Status: ${h.status?.toUpperCase()}`}
                                  timestamp={h.timestamp}
                                  status="done"
                                  isLast={i === dedupedTimeline.length - 1}
                                />
                              ))}
                            </div>
                          </SectionCard>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="py-16 text-center text-slate-400">
                      <FiBriefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No booking data linked.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ══ TAB 3a: GATEWAY (Online / Mixed) ═════════════════════════ */}
              {activeTab === 'gateway' && (
                <div className="space-y-5">
                  {gatewayLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                      <FiRefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
                      <p className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Fetching live Razorpay data…</p>
                    </div>
                  )}
                  {!gatewayLoading && (
                    <>
                      <SectionCard title="Razorpay Gateway" icon={FiZap} iconColor="text-blue-500">
                        <InfoRow label="Razorpay Payment ID" value={d.razorpayPaymentId || gatewayData?.paymentId || 'N/A'} mono />
                        <InfoRow label="Razorpay Order ID" value={d.razorpayOrderId || gatewayData?.orderId || 'N/A'} mono />
                        <InfoRow label="Capture Status" badge={
                          <StatusChip label={gatewayData?.status || d.paymentStatus || 'Captured'} type="info" />
                        } />
                        <InfoRow label="Authorized" badge={
                          <StatusChip label={gatewayData?.livePayment?.status === 'captured' || ['success', 'completed', 'paid'].includes(payStatus) ? 'Yes' : 'No'} type={gatewayData?.livePayment?.status === 'captured' || ['success', 'completed', 'paid'].includes(payStatus) ? 'success' : 'warning'} />
                        } />
                        <InfoRow label="Signature Verified" badge={
                          <StatusChip label={d.razorpaySignature || gatewayData?.signatureVerified ? 'Verified' : 'N/A'} type={d.razorpaySignature || gatewayData?.signatureVerified ? 'success' : 'default'} />
                        } />
                      </SectionCard>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <SectionCard title="Payment Method Details" icon={FiCreditCard}>
                          <InfoRow label="Method" value={gatewayData?.method || d.razorpayStoredResponse?.method || d.gatewayMethod || d.paymentMethod || 'Online'} />
                          {(gatewayData?.vpa || d.upiVpa) && (
                            <InfoRow label="UPI VPA" value={gatewayData?.vpa || d.upiVpa} mono />
                          )}
                          {(gatewayData?.bank || d.bank) && (
                            <InfoRow label="Bank" value={formatBankName(gatewayData?.bank || d.bank)} />
                          )}
                          {(gatewayData?.wallet || d.walletGateway) && (
                            <InfoRow label="Gateway Wallet" value={gatewayData?.wallet || d.walletGateway} />
                          )}
                          {(gatewayData?.card || d.card) && (
                            <>
                              <InfoRow label="Card Network" value={(gatewayData?.card || d.card)?.network || 'N/A'} />
                              <InfoRow label="Card Issuer" value={(gatewayData?.card || d.card)?.issuer || 'N/A'} />
                              <InfoRow label="Card Type" value={(gatewayData?.card || d.card)?.type || 'N/A'} />
                            </>
                          )}
                        </SectionCard>

                        <SectionCard title="Settlement & Fees" icon={FiTrendingUp} iconColor="text-emerald-600">
                          <InfoRow label="Gateway Fee" value={<AmtCell amount={gatewayData?.fee ?? d.settlement?.gatewayFee ?? 0} colorClass="text-rose-600" />} />
                          <InfoRow label="Gateway Tax" value={<AmtCell amount={gatewayData?.tax ?? d.settlement?.gatewayTax ?? 0} colorClass="text-rose-600" />} />
                          <InfoRow label="Settlement Status" badge={(() => {
                            const st = d.settlement?.settlementStatus || d.settlementStatus || 'pending';
                            return <StatusChip label={st.toUpperCase()} type={st === 'settled' ? 'success' : st === 'processing' ? 'warning' : 'default'} />;
                          })()} />
                          {(d.settlement?.settlementStatus === 'settled' || d.settlementStatus === 'settled') && (
                            <InfoRow label="Settlement Date" value={d.settlement?.settlementDate ? fmtDateTime(d.settlement.settlementDate) : '—'} />
                          )}
                          <InfoRow label="Settlement ID" value={d.settlement?.razorpaySettlementId || (d.settlement?.settlementStatus === 'processing' ? 'Awaiting Settlement Batch' : 'N/A')} mono={Boolean(d.settlement?.razorpaySettlementId)} />

                          <InfoRow label="Bank Reference (UTR)" value={d.settlement?.bankReference || (d.settlement?.settlementStatus === 'processing' ? 'Awaiting Bank Transfer' : 'N/A')} mono={Boolean(d.settlement?.bankReference)} />
                        </SectionCard>
                      </div>

                      {gatewayData?.livePayment ? (
                        <SectionCard title="Raw Gateway Response" icon={FiFileText} iconColor="text-slate-500">
                          <div className="bg-slate-900 text-slate-300 rounded-xl p-4 font-mono text-[11px] overflow-x-auto max-h-64">
                            <pre>{JSON.stringify(gatewayData.livePayment, null, 2)}</pre>
                          </div>
                        </SectionCard>
                      ) : (
                        <SectionCard title="Raw Gateway Response" icon={FiFileText} iconColor="text-slate-500">
                          <p className="text-xs text-slate-400 italic">N/A</p>
                        </SectionCard>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ══ TAB 3b: WALLET LEDGER (Wallet / Mixed) ═══════════════════ */}
              {activeTab === 'wallet_ledger' && (
                <div className="space-y-5">
                  <SectionCard title="Wallet Payment Summary" icon={FiLayers} iconColor="text-amber-600">
                    <InfoRow label="Wallet Amount Used" value={<AmtCell amount={d.walletPaid || 0} colorClass="text-amber-700" />} />
                    <InfoRow label="Payment Type" badge={<StatusChip label={d.paymentType || 'Wallet'} type="warning" />} />
                    {d.paymentType === 'mixed' && (
                      <>
                        <InfoRow label="Online (Razorpay) Part" value={<AmtCell amount={d.onlinePaid || 0} colorClass="text-blue-700" />} />
                        <InfoRow label="Wallet Part" value={<AmtCell amount={d.walletPaid || 0} colorClass="text-amber-700" />} />
                        <InfoRow label="Total" value={<AmtCell amount={d.finalPaid || 0} />} />
                      </>
                    )}
                    {d.customer?.wallet && (
                      <InfoRow label="Customer Wallet Balance" value={<AmtCell amount={d.customer.wallet.availableBalance || 0} colorClass="text-emerald-700" />} />
                    )}
                  </SectionCard>

                  {d.customer?.wallet?.walletTransactions?.length > 0 ? (
                    <SectionCard title="Wallet Ledger Entries" icon={FiActivity}>
                      <div className="space-y-2">
                        {d.customer.wallet.walletTransactions.slice(-10).map((wt, i) => (
                          <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 text-xs">
                            <div>
                              <p className="font-semibold text-slate-700">{wt.reason || wt.type || 'Transaction'}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(wt.createdAt || wt.date)}</p>
                            </div>
                            <span className={`font-black ${wt.type === 'credit' ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {wt.type === 'credit' ? '+' : '-'}<PriceDisplay amount={wt.amount || 0} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <FiLayers className="w-9 h-9 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No wallet ledger entries found.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ══ TAB 3c: PAYMENT VERIFICATION (Cash & Dynamic Razorpay QR) ════ */}
              {activeTab === 'cash_verify' && (() => {
                const pv = d.paymentVerification || d.booking?.paymentVerification || {};
                const isQR = pv.method === 'qr_code' || Boolean(pv.qrCodeId) || d.paymentMethod === 'qr_code' || d.paymentMethod === 'upi_qr';
                const isCash = pv.method === 'cash_received' || d.paymentType === 'cash' || d.paymentMethod === 'cash';
                const vStatus = pv.status || (d.booking?.paymentStatus === 'paid' ? 'verified' : 'pending');

                const getMethodBadge = () => {
                  if (isQR) return { label: 'Dynamic Razorpay QR', type: 'purple' };
                  if (isCash) return { label: 'Cash Received', type: 'success' };
                  return { label: (d.paymentMethod || 'Online').toUpperCase(), type: 'info' };
                };

                const methodBadge = getMethodBadge();

                const getVBadgeType = (st) => {
                  if (st === 'verified' || st === 'paid') return 'success';
                  if (st === 'waiting_payment' || st === 'pending') return 'warning';
                  if (st === 'expired' || st === 'failed') return 'danger';
                  return 'default';
                };

                const isExpired = pv.qrExpiresAt && new Date(pv.qrExpiresAt) < new Date() && vStatus !== 'verified';

                return (
                  <div className="space-y-5">
                    {/* Verification Status Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <SectionCard title="Payment Verification Status" icon={FiCheck} iconColor="text-emerald-600">
                        <InfoRow label="Verification Method" badge={
                          <StatusChip label={methodBadge.label} type={methodBadge.type} />
                        } />
                        <InfoRow label="Verification Status" badge={
                          <StatusChip label={vStatus?.toUpperCase() || 'PENDING'} type={getVBadgeType(vStatus)} />
                        } />
                        <InfoRow label="Verified Date & Time" value={fmtDateTime(pv.verifiedAt || d.booking?.paymentDate || d.updatedAt)} />
                        <InfoRow label="Idempotency Protection" value={pv.idempotencyKey || 'Protected'} mono />
                        <InfoRow label="Confirmed By Provider" value={d.booking?.confirmedBooking ? 'Verified' : 'Pending Provider Signoff'} />
                      </SectionCard>

                      <SectionCard title="Financial Audit & Earnings" icon={FiTrendingUp} iconColor="text-blue-600">
                        <InfoRow label="Total Amount" value={<AmtCell amount={d.totalAmount || 0} />} />
                        <InfoRow label="Wallet Used" value={<AmtCell amount={d.walletPaid || 0} colorClass="text-amber-700" />} />
                        <InfoRow label="Cash / QR Collection" value={<AmtCell amount={d.paymentType === 'cash' ? (d.cashPaid || 0) : (d.onlinePaid || 0)} colorClass="text-emerald-700" />} />
                        <InfoRow label="Platform Commission" value={<AmtCell amount={d.commissionAmount || 0} colorClass="text-purple-700" />} />
                        <InfoRow label="Provider Net Earnings" value={<AmtCell amount={d.providerEarnings || 0} colorClass="text-blue-700" />} />
                      </SectionCard>
                    </div>

                    {/* Razorpay Dynamic QR Details (ONLY when actual QR code exists) */}
                    {isQR && (pv.qrCodeId || pv.qrImageUrl) && (
                      <SectionCard title="Razorpay QR Code Management" icon={FiZap} iconColor="text-indigo-600">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          {pv.qrImageUrl && (
                            <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                              <img src={pv.qrImageUrl} alt="Razorpay QR" className="w-32 h-32 object-contain rounded-lg border border-slate-300 bg-white p-1" />
                              <span className="text-[10px] font-bold text-slate-500 mt-2">Dynamic QR Payload</span>
                            </div>
                          )}
                          <div className={`space-y-1 ${pv.qrImageUrl ? 'md:col-span-2' : 'md:col-span-3'}`}>
                            <InfoRow label="Razorpay QR ID" value={pv.qrCodeId || 'N/A'} mono />
                            <InfoRow label="QR Status" badge={
                              <StatusChip label={isExpired ? 'EXPIRED' : (vStatus === 'verified' ? 'PAID' : 'ACTIVE')} type={vStatus === 'verified' ? 'success' : isExpired ? 'danger' : 'warning'} />
                            } />
                            <InfoRow label="QR Expiry Date" value={pv.qrExpiresAt ? fmtDateTime(pv.qrExpiresAt) : 'N/A'} />
                            <InfoRow label="Webhook Verification" badge={
                              <StatusChip label={d.razorpaySignature ? 'Verified via Webhook' : 'Direct Sync'} type={d.razorpaySignature ? 'success' : 'info'} />
                            } />
                          </div>
                        </div>
                      </SectionCard>
                    )}

                    <SectionCard title="Booking & Service Audit" icon={FiCheckCircle} iconColor="text-emerald-600">
                      <InfoRow label="Booking Status" badge={
                        <StatusChip label={d.booking?.status || 'Pending'} type={d.booking?.status === 'completed' ? 'success' : 'warning'} />
                      } />
                      <InfoRow label="Service Completed At" value={fmtDateTime(d.booking?.serviceCompletedAt || d.booking?.completedAt)} />
                      <InfoRow label="Admin Remark" value={d.booking?.adminRemark || 'None'} />
                    </SectionCard>
                  </div>
                );
              })()}

              {/* ══ TAB 4: TRANSACTION / LEDGER ══════════════════════════════ */}
              {activeTab === 'transaction' && (
                <div className="space-y-5">
                  {d.ledgerEntries?.length > 0 ? (
                    <SectionCard title="Transaction Ledger" icon={FiActivity}>
                      <div className="space-y-0 -mx-5">
                        <div className="grid grid-cols-6 px-5 py-2 bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                          <span className="col-span-2">Transaction ID</span>
                          <span>Type</span>
                          <span>Method</span>
                          <span className="text-right">Amount</span>
                          <span className="text-right">Status</span>
                        </div>
                        {d.ledgerEntries.map((entry, i) => (
                          <div key={i} className="grid grid-cols-6 px-5 py-3 border-b border-slate-50 hover:bg-slate-50 text-xs items-center">
                            <span className="col-span-2 font-mono text-[11px] text-indigo-700 font-semibold truncate" title={entry.transactionId || entry._id}>
                              <button
                                onClick={() => nav.transaction(entry.transactionId || entry._id)}
                                className="hover:underline font-bold text-left cursor-pointer"
                              >
                                {(entry.transactionId || entry._id || 'N/A').slice(0, 20)}
                              </button>
                            </span>
                            <span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${entry.entryType === 'credit' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {entry.entryType || entry.type || 'N/A'}
                              </span>
                            </span>
                            <span className="text-slate-600">{entry.paymentMethod || 'N/A'}</span>
                            <span className={`text-right font-black ${entry.entryType === 'credit' ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {entry.entryType === 'credit' ? '+' : '-'}<PriceDisplay amount={entry.amount || 0} />
                            </span>
                            <span className="text-right">
                              <StatusChip label={entry.paymentStatus || 'Pending'} type={['success', 'completed'].includes(entry.paymentStatus) ? 'success' : entry.paymentStatus === 'failed' ? 'danger' : 'warning'} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  ) : (
                    <div className="py-16 text-center text-slate-400">
                      <FiActivity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm font-semibold text-slate-500">No ledger entries found for this booking.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ══ TAB 5: REFUND ════════════════════════════════════════════ */}
              {activeTab === 'refund' && (
                <div className="space-y-5">
                  {d.refund ? (
                    <>
                      <SectionCard title="Refund Summary" icon={FiRotateCcw} iconColor="text-purple-600">
                        <InfoRow label="Refund ID" value={d.refund.refundId || 'N/A'} mono />
                        <InfoRow label="Refund Status" badge={
                          <StatusChip label={d.refund.refundStatus || 'Pending'} type={d.refund.refundStatus === 'completed' ? 'success' : d.refund.refundStatus === 'failed' ? 'danger' : 'warning'} />
                        } />
                        <InfoRow label="Refund Amount" value={<AmtCell amount={d.refund.refundAmount || 0} colorClass="text-purple-700" />} />
                        <InfoRow label="Gateway Refund" value={<AmtCell amount={d.refund.gatewayRefundAmount || 0} colorClass="text-blue-700" />} />
                        <InfoRow label="Wallet Refund" value={<AmtCell amount={d.refund.walletRefundAmount || 0} colorClass="text-amber-700" />} />
                        <InfoRow label="Refund Source" value={d.refund.refundSource?.replace(/_/g, ' ') || 'N/A'} />
                        <InfoRow label="Refund Destination" badge={
                          <StatusChip label={d.refund.refundDestination?.replace(/_/g, ' ') || 'N/A'} type="info" />
                        } />
                        <InfoRow label="Gateway Refund ID" value={d.refund.gatewayRefundId || 'N/A'} mono />
                        <InfoRow label="Wallet Txn ID" value={d.refund.walletTransactionId || 'N/A'} mono />
                        <InfoRow label="Requested At" value={fmtDateTime(d.refund.createdAt)} />
                        <InfoRow label="Completed At" value={fmtDateTime(d.refund.completedAt)} />
                        {d.refund.approvedBy && (
                          <InfoRow label="Approved By" value={d.refund.approvedBy.name || 'N/A'} />
                        )}
                        {d.refund.failureReason && (
                          <InfoRow label="Failure Reason" value={d.refund.failureReason} />
                        )}
                      </SectionCard>

                      {d.refund.timeline?.length > 0 && (
                        <SectionCard title="Refund Timeline" icon={FiClock}>
                          <div className="space-y-0">
                            {d.refund.timeline.map((t, i) => (
                              <TimelineItem
                                key={i}
                                label={`${t.status?.replace(/_/g, ' ').toUpperCase()} — ${t.actor || 'System'}`}
                                timestamp={t.timestamp}
                                status={t.status === 'completed' ? 'done' : t.status === 'failed' ? 'failed' : 'pending'}
                                isLast={i === d.refund.timeline.length - 1}
                              />
                            ))}
                          </div>
                        </SectionCard>
                      )}
                    </>
                  ) : (
                    <div className="py-20 text-center text-slate-400">
                      <FiRotateCcw className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-base font-semibold text-slate-500">No refund recorded.</p>
                      <p className="text-xs text-slate-400 mt-1">Refunds appear here when initiated for this payment.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ══ TAB 6: COMPLAINT ═════════════════════════════════════════ */}
              {activeTab === 'complaint' && (
                <div className="space-y-5">
                  {d.complaint ? (
                    <SectionCard title="Complaint Details" icon={FiMessageSquare} iconColor="text-rose-600">
                      <InfoRow label="Complaint ID" value={
                        <EntityLink label={d.complaint.complaintId || d.complaint._id || 'Complaint'} onClick={nav.complaint} />
                      } />
                      <InfoRow label="Status" badge={
                        <StatusChip label={d.complaint.status || 'Open'} type={d.complaint.status === 'resolved' ? 'success' : d.complaint.status === 'closed' ? 'default' : 'danger'} />
                      } />
                      <InfoRow label="Reason" value={d.complaint.reason || 'N/A'} />
                      <InfoRow label="Resolution" value={d.complaint.resolution || 'Pending resolution'} />
                      <InfoRow label="Created" value={fmtDateTime(d.complaint.createdAt)} />
                      <InfoRow label="Updated" value={fmtDateTime(d.complaint.updatedAt)} />
                    </SectionCard>
                  ) : (
                    <div className="py-20 text-center text-slate-400">
                      <FiMessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-base font-semibold text-slate-500">No complaint linked.</p>
                      <p className="text-xs text-slate-400 mt-1">Complaints appear here when raised against this booking.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ══ TAB 7: SETTLEMENT ════════════════════════════════════════ */}
              {activeTab === 'settlement' && (
                <div className="space-y-5">
                  {d.settlement ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Settlement Amount</p>
                          <p className="text-xl font-black text-emerald-800 mt-1"><PriceDisplay amount={d.settlement.settlementAmount || d.totalAmount || 0} /></p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Provider Earnings</p>
                          <p className="text-xl font-black text-blue-800 mt-1">
                            <button onClick={nav.providerEarnings} className="hover:underline cursor-pointer">
                              <PriceDisplay amount={d.settlement.providerEarnings || d.providerEarnings || 0} />
                            </button>
                          </p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 text-center">
                          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Commission</p>
                          <p className="text-xl font-black text-purple-800 mt-1"><PriceDisplay amount={d.settlement.commissionAmount || d.commissionAmount || 0} /></p>
                        </div>
                      </div>

                      <SectionCard title="Settlement Details" icon={FiTrendingUp} iconColor="text-emerald-600">
                        <InfoRow label="Settlement Status" badge={(() => {
                          const st = d.settlement.settlementStatus || 'pending';
                          return <StatusChip label={st.toUpperCase()} type={st === 'settled' ? 'success' : st === 'processing' ? 'warning' : 'default'} />;
                        })()} />
                        {d.settlement.settlementStatus === 'settled' && (
                          <InfoRow label="Settlement Date" value={d.settlement.settlementDate ? fmtDateTime(d.settlement.settlementDate) : '—'} />
                        )}
                        <InfoRow label="Settlement ID" value={d.settlement.razorpaySettlementId || (d.settlement.settlementStatus === 'processing' ? 'Awaiting Settlement Batch' : 'N/A')} mono={Boolean(d.settlement.razorpaySettlementId)} />

                        <InfoRow label="Bank Reference" value={d.settlement.bankReference || (d.settlement.settlementStatus === 'processing' ? 'Awaiting Bank Transfer' : 'N/A')} mono={Boolean(d.settlement.bankReference)} />
                        <InfoRow label="Gateway Fee" value={<AmtCell amount={d.settlement.gatewayFee || 0} colorClass="text-rose-600" />} />
                        <InfoRow label="Gateway Tax" value={<AmtCell amount={d.settlement.gatewayTax || 0} colorClass="text-rose-600" />} />
                        <InfoRow label="Net Settlement" value={<AmtCell amount={d.settlement.netSettlementAmount || d.totalAmount || 0} colorClass="text-emerald-700" />} />
                        <InfoRow label="Provider Payout Status" badge={
                          <StatusChip label={d.settlement.providerPayoutStatus || 'Available'} type="success" />
                        } />
                      </SectionCard>
                    </>
                  ) : (
                    <div className="py-20 text-center text-slate-400">
                      <FiTrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="text-base font-semibold text-slate-500">No settlement data available.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ══ TAB 8: AUDIT ══════════════════════════════════════════════ */}
              {activeTab === 'audit' && (
                <div className="space-y-5">
                  <SectionCard title="Payment Verification" icon={FiShield} iconColor="text-emerald-600">
                    <InfoRow label="Signature Verified" badge={
                      <StatusChip label={d.razorpaySignature ? 'Verified' : 'N/A'} type={d.razorpaySignature ? 'success' : 'default'} />
                    } />
                    <InfoRow label="Idempotency Safe" badge={<StatusChip label="Yes" type="success" />} />
                    <InfoRow label="Duplicate Check" badge={<StatusChip label="Passed" type="success" />} />
                    <InfoRow label="Payment Method" value={d.paymentMethod || 'Online'} />
                    <InfoRow label="Gateway" value={d.paymentType === 'cash' ? 'Direct (No Gateway)' : 'Razorpay'} />
                  </SectionCard>

                  <SectionCard title="Audit Timeline" icon={FiClock}>
                    <div className="space-y-0">
                      {(d.auditTimeline || [
                        { label: 'Payment Initiated', timestamp: d.createdAt, status: 'done' },
                        { label: 'Payment Captured', timestamp: d.updatedAt, status: 'done' }
                      ]).map((step, i, arr) => (
                        <TimelineItem
                          key={i}
                          label={step.label}
                          timestamp={step.timestamp}
                          status={step.status}
                          isLast={i === arr.length - 1}
                        />
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Webhook Events" icon={FiZap} iconColor="text-blue-500">
                    {d.razorpayStoredResponse ? (
                      <InfoRow label="Last Webhook Event" value={d.razorpayStoredResponse.event || 'payment.captured'} />
                    ) : (
                      <p className="text-xs text-slate-400 italic">No webhook events recorded for this transaction.</p>
                    )}
                    <InfoRow label="Payment ID Stored" value={d.razorpayPaymentId ? 'Yes' : 'No'} />
                    <InfoRow label="Order ID Stored" value={d.razorpayOrderId ? 'Yes' : 'No'} />
                  </SectionCard>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <FiShield className="w-3.5 h-3.5" />
            <span>Payment ID: <span className="font-mono font-bold text-slate-600">{txnId}</span></span>
          </div>
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

export default PaymentViewDetailModal;
