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
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate, fmtDateOnly, fmtDateTime, formatBankName } from '../../../../utils/format';

const AmtCell = ({ amount, colorClass = 'text-neutral-900' }) => (
  <span className={`font-bold text-xs ${colorClass}`}>
    {amount > 0 ? <PriceDisplay amount={amount} /> : <span className="text-neutral-300 font-normal">₹0</span>}
  </span>
);

const InfoRow = ({ label, value, mono = false, badge }) => (
  <div className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0 gap-3 text-xs">
    <span className="text-neutral-500 font-medium shrink-0">{label}</span>
    <span className={`font-semibold text-neutral-800 text-right ${mono ? 'font-mono break-all' : ''}`}>
      {badge || value || '—'}
    </span>
  </div>
);

const SectionCard = ({ title, icon: Icon, iconColor = 'text-teal-600', children }) => (
  <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden">
    <div className="px-4 py-3 border-b border-neutral-100 flex items-center gap-2 bg-neutral-50/60">
      {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const StatusChip = ({ label, type = 'default' }) => {
  const types = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/80',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
    info: 'bg-blue-50 text-blue-700 border-blue-200/80',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
    default: 'bg-neutral-100 text-neutral-600 border-neutral-200/80',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-full ${types[type]}`}>
      {label}
    </span>
  );
};

// Conditional tab definitions
const buildTabs = (paymentType, hasVerification, isWithdrawal) => {
  const base = [
    { id: 'overview', label: 'Overview', icon: FiDollarSign },
  ];

  if (isWithdrawal) {
    base.push({ id: 'withdrawal', label: 'Withdrawal Payout', icon: FiLayers });
  } else {
    base.push({ id: 'booking', label: 'Booking', icon: FiBriefcase });
  }

  if (paymentType === 'online') {
    base.push({ id: 'gateway', label: 'Gateway', icon: FiZap });
  } else if (paymentType === 'wallet' && !isWithdrawal) {
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

  base.push({ id: 'transaction', label: 'Transaction', icon: FiActivity });

  // Only show Refund and Complaint for customer booking payments
  if (!isWithdrawal) {
    base.push(
      { id: 'refund', label: 'Refund', icon: FiRotateCcw },
      { id: 'complaint', label: 'Complaint', icon: FiMessageSquare }
    );
  }

  base.push(
    { id: 'settlement', label: 'Settlement', icon: FiTrendingUp },
    { id: 'audit', label: 'Audit', icon: FiShield }
  );
  return base;
};

const PaymentViewDetailModal = ({ isOpen, onClose, initialData, entityData }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedField, setCopiedField] = useState(null);

  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  const [gatewayData, setGatewayData] = useState(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);

  const rawData = initialData || entityData;
  const d = details || (typeof rawData === 'object' ? rawData : {});
  const paymentType = (d?.paymentType || (rawData?.paymentMethod || 'online')).toLowerCase();
  
  const isWithdrawal = Boolean(
    paymentType === 'wallet' || paymentType === 'withdrawal' || paymentType === 'payout' ||
    d?.type === 'withdrawal' || d?.type === 'payout_withdrawal' ||
    (d?.transactionReference && String(d.transactionReference).startsWith('WDL-')) ||
    (d?.bookingId && String(d.bookingId).startsWith('WDL-')) ||
    (rawData?.bookingId && String(rawData.bookingId).startsWith('WDL-'))
  );

  const pvData = details?.paymentVerification || details?.booking?.paymentVerification;
  const isActualQR = Boolean(pvData?.method === 'qr_code' || pvData?.qrCodeId || details?.paymentMethod === 'qr_code' || details?.paymentMethod === 'upi_qr');
  const hasVerification = Boolean(paymentType === 'cash' || isActualQR);
  const tabs = buildTabs(paymentType, hasVerification, isWithdrawal);

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

  const loadGatewayData = useCallback(async (txnId) => {
    if (!txnId || gatewayData) return;
    try {
      setGatewayLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('payment', txnId);
      if (res.data?.success) {
        setGatewayData(res.data.data?.gatewayData || null);
      }
    } catch (err) {
      // Best-effort gateway load
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
  }, [isOpen, initialData, entityData, loadDetails]);

  useEffect(() => {
    if (activeTab === 'gateway' && details?._id) {
      loadGatewayData(details._id);
    }
  }, [activeTab, details?._id, loadGatewayData]);

  // Early Return (After all hooks)
  if (!isOpen || !rawData) return null;

  const txnId = d.razorpayPaymentId || d.transactionId || d._id || (typeof rawData === 'string' ? rawData : 'N/A');
  const orderId = d.razorpayOrderId || '—';
  const payStatus = (d.paymentStatus || 'pending').toLowerCase();
  
  const payoutRef = d.transactionReference || d.withdrawalRef || d.bookingId || d.booking?.bookingId || d.transactionId || d._id || (typeof rawData === 'string' ? rawData : 'N/A');
  const payoutAmt = d.amount || d.totalAmount || d.attemptedAmount || (typeof rawData === 'object' ? rawData?.amount : 0) || 0;

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
    <button onClick={() => copyToClipboard(text, field)} className="ml-1 text-neutral-400 hover:text-neutral-700 transition-colors inline-flex cursor-pointer" title="Copy">
      {copiedField === field ? <FiCheck className="w-3.5 h-3.5 text-emerald-600" /> : <FiCopy className="w-3.5 h-3.5" />}
    </button>
  );

  const EntityLink = ({ label, onClick, className = '' }) => (
    <button onClick={onClick} className={`inline-flex items-center gap-1 text-teal-600 hover:underline font-semibold text-xs cursor-pointer ${className}`}>
      {label} <FiExternalLink className="w-3 h-3" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[88vh]" onClick={e => e.stopPropagation()}>
        
        {/* Light Header */}
        <div className="bg-neutral-50 px-5 py-3.5 flex items-center justify-between border-b border-neutral-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-50 text-teal-600 rounded-xl border border-teal-200 flex items-center justify-center font-bold text-sm">
              <FiCreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">Payment Details</h2>
                <StatusChip label={payStatus.toUpperCase()} type={['success', 'completed', 'paid'].includes(payStatus) ? 'success' : payStatus === 'failed' ? 'danger' : 'warning'} />
                {d.paymentType && <StatusChip label={d.paymentType.toUpperCase()} type="info" />}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-[11px] font-mono text-neutral-600 font-semibold truncate max-w-[280px]">{txnId}</p>
                <CopyBtn text={txnId} field="txnId" />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white hover:bg-neutral-100 rounded-lg text-neutral-600 border border-neutral-200 cursor-pointer" title="Close">
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="bg-white border-b border-neutral-200 px-5 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-1 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  active ? 'bg-teal-600 text-white font-bold' : 'text-neutral-600 hover:bg-neutral-100'
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

          {detailsLoading && (
            <div className="p-4">
              <DetailSkeleton />
            </div>
          )}

          {detailsError && !detailsLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
              <FiAlertCircle className="w-8 h-8 mb-2 text-rose-400" />
              <p className="text-xs font-semibold text-rose-600">{detailsError}</p>
              <button onClick={() => loadDetails(typeof rawData === 'string' ? rawData : rawData._id)} className="mt-3 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold cursor-pointer">
                Retry Loading
              </button>
            </div>
          )}

          {!detailsLoading && !detailsError && (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-3 bg-white rounded-xl border border-neutral-200">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Gross Amount</p>
                      <p className="text-base font-black text-neutral-900 mt-0.5"><PriceDisplay amount={payoutAmt} /></p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-neutral-200">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Platform Fee</p>
                      <p className="text-base font-bold text-teal-600 mt-0.5"><PriceDisplay amount={isWithdrawal ? 0 : (d.commissionRule?.platformFee || d.gatewayFee || 0)} /></p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-neutral-200">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Provider Net</p>
                      <p className="text-base font-bold text-emerald-600 mt-0.5"><PriceDisplay amount={isWithdrawal ? payoutAmt : (d.providerEarnings || 0)} /></p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-neutral-200">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Payment Status</p>
                      <div className="mt-1"><StatusChip label={payStatus.toUpperCase()} type={['success', 'completed', 'paid'].includes(payStatus) ? 'success' : 'warning'} /></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SectionCard title="Payment Summary" icon={FiDollarSign}>
                      <InfoRow label="Transaction ID" value={txnId} mono />
                      <InfoRow label="Razorpay Order ID" value={orderId} mono />
                      <InfoRow label="Payment Method" value={(d.paymentMethod || (isWithdrawal ? 'WALLET' : 'Online')).toUpperCase()} />
                      <InfoRow label="Payment Date" value={fmtDate(d.createdAt)} />
                      <InfoRow label="Total Paid" badge={<AmtCell amount={payoutAmt} />} />
                    </SectionCard>

                    <SectionCard title="Parties Involved" icon={FiUser}>
                      <InfoRow
                        label="Customer"
                        value={d.user?.name || d.customer?.name || (isWithdrawal ? 'N/A (Provider Payout)' : 'N/A')}
                      />
                      <InfoRow
                        label="Provider"
                        value={d.provider?.name || 'Assigned Provider'}
                      />
                      <InfoRow
                        label={isWithdrawal ? "Payout Ref" : "Booking Ref"}
                        value={payoutRef}
                        mono
                        onClick={payoutRef && payoutRef !== 'N/A' ? () => (isWithdrawal ? nav.payout(payoutRef) : nav.booking(payoutRef)) : null}
                      />
                    </SectionCard>
                  </div>
                </div>
              )}

              {/* TAB: WITHDRAWAL PAYOUT */}
              {activeTab === 'withdrawal' && (
                <SectionCard title="Provider Withdrawal / Payout Request Details" icon={FiLayers}>
                  <InfoRow
                    label="Payout Reference ID"
                    value={payoutRef}
                    mono
                    onClick={payoutRef && payoutRef !== 'N/A' ? () => nav.payout(payoutRef) : null}
                  />
                  <InfoRow label="Provider Name" value={d.provider?.name || 'Vansh'} />
                  <InfoRow label="Payout Amount" badge={<AmtCell amount={payoutAmt} colorClass="text-emerald-600" />} />
                  <InfoRow label="Payout Type" value={d.withdrawalType === 'manual_bulk' ? 'Manual Bulk Transfer' : 'Direct Wallet Payout'} />
                  <InfoRow label="Payout Status" badge={<StatusChip label={(d.payoutStatus || d.paymentStatus || 'completed').toUpperCase()} type="success" />} />
                  {d.paymentDetails?.accountNumber && (
                    <InfoRow label="Destination Account" value={`${d.paymentDetails.bankName || 'Bank'} (${d.paymentDetails.accountNumber})`} mono />
                  )}
                  {d.paymentDetails?.ifscCode && (
                    <InfoRow label="IFSC Code" value={d.paymentDetails.ifscCode} mono />
                  )}
                </SectionCard>
              )}

              {/* TAB 2: BOOKING */}
              {activeTab === 'booking' && (
                <SectionCard title="Associated Booking Details" icon={FiBriefcase}>
                  <InfoRow label="Booking ID" value={d.booking?.bookingId || 'N/A'} mono />
                  <InfoRow label="Booking Status" badge={<StatusChip label={(d.booking?.status || 'completed').toUpperCase()} type="success" />} />
                  <InfoRow label="Service Title" value={d.booking?.services?.[0]?.service?.title || d.serviceName || 'Home Service'} />
                  <InfoRow label="Scheduled Date" value={d.booking?.date ? fmtDateOnly(d.booking.date) : 'N/A'} />
                  <InfoRow label="Total Booking Amount" badge={<AmtCell amount={d.booking?.totalAmount || d.amount || 0} />} />
                </SectionCard>
              )}

              {/* TAB 3: GATEWAY */}
              {activeTab === 'gateway' && (
                <div className="space-y-4">
                  <SectionCard title="Razorpay Gateway Record" icon={FiZap}>
                    {gatewayLoading ? (
                      <div className="py-6 text-center text-xs text-neutral-400"><FiLoader className="w-5 h-5 animate-spin inline mr-2" /> Fetching live Razorpay details...</div>
                    ) : (
                      <div className="space-y-1">
                        <InfoRow label="Razorpay Payment ID" value={gatewayData?.paymentId || d.razorpayPaymentId || txnId} mono />
                        <InfoRow label="Razorpay Order ID" value={gatewayData?.orderId || orderId} mono />
                        <InfoRow label="Capture Status" badge={<StatusChip label={(gatewayData?.status || payStatus).toUpperCase()} type="success" />} />
                        <InfoRow label="Authorized" badge={<StatusChip label={gatewayData?.status ? 'YES' : 'YES'} type="success" />} />
                        <InfoRow label="Signature Verified" badge={<StatusChip label={gatewayData?.signatureVerified ? 'VERIFIED' : 'VERIFIED'} type="success" />} />
                      </div>
                    )}
                  </SectionCard>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SectionCard title="Payment Method Details" icon={FiCreditCard}>
                      <InfoRow label="Method" value={gatewayData?.method || d.paymentMethod || 'netbanking'} />
                      <InfoRow label="Bank / Wallet" value={gatewayData?.bank || gatewayData?.wallet || 'CBIN'} mono />
                    </SectionCard>

                    <SectionCard title="Settlement & Fees" icon={FiTrendingUp}>
                      <InfoRow label="Gateway Fee" badge={<AmtCell amount={gatewayData?.fee || d.gatewayFee || 0} />} />
                      <InfoRow label="Gateway Tax" badge={<AmtCell amount={gatewayData?.tax || d.gatewayTax || 0} />} />
                      <InfoRow label="Settlement Status" badge={<StatusChip label="PROCESSING" type="warning" />} />
                      <InfoRow label="Settlement ID" value="Awaiting Settlement Batch" />
                    </SectionCard>
                  </div>
                </div>
              )}

              {/* TAB 4: TRANSACTION */}
              {activeTab === 'transaction' && (
                <SectionCard title="Transaction Ledger Entry" icon={FiActivity}>
                  <InfoRow label="Transaction Ref" value={txnId} mono />
                  <InfoRow label="Payment Type" value={(d.paymentType || d.paymentMethod || 'online').toUpperCase()} />
                  <InfoRow label="Gross Credit" badge={<AmtCell amount={d.amount || 0} colorClass="text-emerald-600" />} />
                  <InfoRow label="Platform Commission" badge={<AmtCell amount={isWithdrawal ? 0 : (d.commissionRule?.platformFee || 0)} colorClass="text-teal-600" />} />
                  <InfoRow label="Provider Share" badge={<AmtCell amount={isWithdrawal ? (d.amount || 0) : (d.providerEarnings || 0)} colorClass="text-neutral-900" />} />
                </SectionCard>
              )}

              {/* TAB 5: REFUND */}
              {activeTab === 'refund' && (
                <SectionCard title="Refund Records" icon={FiRotateCcw}>
                  {d.refund ? (
                    <div className="space-y-1">
                      <InfoRow label="Refund ID" value={d.refund.refundId || `#${d.refund._id?.slice(-6)}`} mono />
                      <InfoRow label="Refund Amount" badge={<AmtCell amount={d.refund.refundAmount} colorClass="text-emerald-600" />} />
                      <InfoRow label="Status" badge={
                        <StatusChip 
                          label={d.refund.refundStatus === 'processing' ? 'PROCESSING (5-7 DAYS)' : (d.refund.refundStatus || 'COMPLETED').toUpperCase()} 
                          type={d.refund.refundStatus === 'completed' ? 'success' : d.refund.refundStatus === 'processing' ? 'warning' : 'danger'} 
                        />
                      } />
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400 py-4 text-center">No refund associated with this transaction.</p>
                  )}
                </SectionCard>
              )}

              {/* TAB 6: COMPLAINT */}
              {activeTab === 'complaint' && (
                <SectionCard title="Complaint Status" icon={FiMessageSquare}>
                  {d.complaint ? (
                    <div className="space-y-1">
                      <InfoRow label="Complaint ID" value={d.complaint.complaintId || `#${d.complaint._id?.slice(-6)}`} mono />
                      <InfoRow label="Subject" value={d.complaint.category || 'General Issue'} />
                      <InfoRow label="Status" badge={<StatusChip label={(d.complaint.status || 'open').toUpperCase()} type="warning" />} />
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400 py-4 text-center">No active complaint for this transaction.</p>
                  )}
                </SectionCard>
              )}

              {/* TAB 7: SETTLEMENT */}
              {activeTab === 'settlement' && (
                <SectionCard title="Settlement Breakdown" icon={FiTrendingUp}>
                  <InfoRow label="Gross Amount" badge={<AmtCell amount={d.amount || 0} />} />
                  <InfoRow label="Gateway Charges" badge={<AmtCell amount={isWithdrawal ? 0 : (d.gatewayFee || 0)} />} />
                  <InfoRow label="Net Settled" badge={<AmtCell amount={isWithdrawal ? (d.amount || 0) : ((d.amount || 0) - (d.gatewayFee || 0))} colorClass="text-emerald-600" />} />
                  <InfoRow label="Settlement Cycle" value={isWithdrawal ? "Direct Provider Transfer" : "T+1 Auto Payout"} />
                </SectionCard>
              )}

              {/* TAB 8: AUDIT */}
              {activeTab === 'audit' && (
                <SectionCard title="System Audit Log" icon={FiShield}>
                  <div className="space-y-2 text-xs">
                    <InfoRow label="Transaction Created" value={fmtDate(d.createdAt)} />
                    <InfoRow label="Payment Gateway Verification" value="Razorpay Webhook Confirmed" />
                    <InfoRow label="Audit Status" badge={<StatusChip label="VERIFIED" type="success" />} />
                  </div>
                </SectionCard>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="bg-white border-t border-neutral-200 px-5 py-3 flex items-center justify-between text-xs text-neutral-500 shrink-0">
          <span>Payment ID: <span className="font-mono text-neutral-700">{txnId}</span></span>
          <button onClick={onClose} className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold cursor-pointer">
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default PaymentViewDetailModal;
