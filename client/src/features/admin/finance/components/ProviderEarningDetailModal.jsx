import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiTrendingUp, FiBriefcase, FiDollarSign, FiShield,
  FiRotateCcw, FiRefreshCw, FiExternalLink, FiCheckCircle, FiClock,
  FiCheck, FiAlertTriangle
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

const ProviderEarningDetailModal = ({ isOpen, onClose, entityData, earningId }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const { openInvestigationDrawer } = useAdminFilter();

  const fetchDetail = useCallback(async () => {
    const targetId = entityData?._id || earningId;
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await TransactionService.getAdminPaymentDetails(targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local earning record data:', err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, earningId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const data = details || entityData || {};
  const booking = data.booking || {};
  const customer = data.customer || data.user || booking.customer || {};
  const provider = data.provider || booking.provider || {};
  const refund = data.refund || null;
  const settlement = data.settlement || {};
  const paymentRecord = data.paymentRecord || {};

  const customerPaid = data.amount || data.totalAmount || booking.totalAmount || booking.subtotal || 0;
  const commission = (data.commission !== undefined && data.commission !== null)
    ? data.commission
    : ((booking.commissionAmount !== undefined && booking.commissionAmount !== null)
      ? booking.commissionAmount
      : (data.platformFee || 0));

  const serviceBase = data.grossAmount || booking.subtotal || customerPaid;
  const providerShare = data.providerEarnings || data.providerEarning || data.netAmount || (serviceBase - commission);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white px-6 py-5 flex items-center justify-between shrink-0 border-b border-neutral-700/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30 text-primary">
              <FiTrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Provider Net Earning Detail</h2>
                <StatusChip label="NET SHARE" type="success" />
              </div>
              <p className="text-xs text-neutral-300 font-medium mt-0.5">
                Booking ID: <span className="font-mono font-bold text-white">{booking.bookingId || data.bookingId || `#${(data._id || '').slice(-6)}`}</span>
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* 1. Commission & Earnings Breakdown */}
          <div className="p-5 bg-gradient-to-r from-blue-50 via-slate-50 to-emerald-50 rounded-2xl border border-blue-100/80 shadow-2xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Customer Paid</p>
                <p className="text-2xl font-black text-slate-900 mt-1"><PriceDisplay amount={customerPaid} /></p>
              </div>
              <div>
                <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Platform Commission</p>
                <p className="text-2xl font-black text-rose-600 mt-1">- <PriceDisplay amount={commission} /></p>
              </div>
              <div>
                <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider">Provider Net Share</p>
                <p className="text-2xl font-black text-emerald-700 mt-1"><PriceDisplay amount={providerShare} /></p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 2. Booking Section */}
            <SectionCard title="1. Booking Information" icon={FiBriefcase}>
              <InfoRow
                label="Booking ID"
                value={booking.bookingId || data.bookingId || 'N/A'}
                onClick={() => openInvestigationDrawer('booking', booking._id || data.booking)}
              />
              <InfoRow label="Booking Status" badge={<StatusChip label={(booking.status || 'completed').toUpperCase()} type="success" />} />
              <InfoRow label="Service Title" value={booking.services?.[0]?.service?.title || 'Home Service'} />
              <InfoRow
                label="Customer Name"
                value={customer.name || 'Customer'}
                onClick={() => openInvestigationDrawer('customer', customer._id || data.user)}
              />
              <InfoRow
                label="Provider Name"
                value={provider.name || 'Provider'}
                onClick={() => openInvestigationDrawer('provider', provider._id || data.provider)}
              />
              <InfoRow label="Booking Date" value={fmtDate(booking.createdAt || data.createdAt)} />
            </SectionCard>

            {/* 3. Payment Section */}
            <SectionCard title="2. Payment Information" icon={FiDollarSign}>
              <InfoRow label="Payment Method" value={(data.paymentMethod || booking.paymentMethod || 'online').toUpperCase()} />
              <InfoRow label="Payment Type" value={(data.type || 'payment').toUpperCase()} />
              <InfoRow
                label="Amount Paid"
                badge={<span className="font-black text-slate-900"><PriceDisplay amount={customerPaid} /></span>}
              />
              <InfoRow label="Transaction Ref" value={data.transactionId || data.razorpayPaymentId || `#${(data._id || '').slice(-6)}`} mono />
              <InfoRow label="Payment Status" badge={<StatusChip label={(data.paymentStatus || 'success').toUpperCase()} type="success" />} />
            </SectionCard>

            {/* 4. Settlement Section */}
            <SectionCard title="3. Settlement Information" icon={FiShield}>
              <InfoRow
                label="Settlement Status"
                badge={<StatusChip label={settlement.settlementStatus || (data.paymentStatus === 'success' ? 'SETTLED' : 'PENDING')} type="success" />}
              />
              <InfoRow label="Settlement Date" value={fmtDate(settlement.settlementDate || data.updatedAt)} />
              <InfoRow
                label="Settlement Amount"
                badge={<span className="font-bold text-slate-900"><PriceDisplay amount={settlement.settlementAmount || providerShare} /></span>}
              />
            </SectionCard>

            {/* 5. Withdrawal Section */}
            <SectionCard title="4. Withdrawal Information" icon={FiTrendingUp}>
              <InfoRow
                label="Withdrawal Status"
                badge={<StatusChip label={(paymentRecord.status || 'AVAILABLE FOR PAYOUT').toUpperCase()} type={paymentRecord.status === 'completed' ? 'success' : 'info'} />}
              />
              <InfoRow
                label="Withdrawal Amount"
                badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={paymentRecord.amount || providerShare} /></span>}
              />
              <InfoRow label="Transfer Date" value={paymentRecord.completedAt ? fmtDate(paymentRecord.completedAt) : 'Pending Withdrawal'} />
            </SectionCard>

          </div>

          {/* 6. Refund Impact Section */}
          <SectionCard title="5. Refund Impact" icon={FiRotateCcw}>
            {refund ? (
              <div className="space-y-2">
                <InfoRow label="Refund Amount" badge={<span className="font-bold text-rose-600"><PriceDisplay amount={refund.refundAmount || refund.amount || 0} /></span>} />
                <InfoRow label="Refund Status" badge={<StatusChip label={(refund.refundStatus || refund.status || 'completed').toUpperCase()} type="danger" />} />
                <InfoRow label="Provider Deduction" value={refund.providerDeduction ? `₹${refund.providerDeduction}` : 'No Deduction Applied'} />
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
                <FiCheckCircle className="w-4 h-4 text-emerald-600" />
                No Refund Impact — Full provider net share credited.
              </div>
            )}
          </SectionCard>

          {/* 7. Lifecycle Timeline */}
          <SectionCard title="6. Lifecycle Timeline" icon={FiClock}>
            <div className="space-y-4 text-xs">
              <div className="flex gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800">Booking Created</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(booking.createdAt || data.createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800">Payment Completed</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(data.createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800">Work Completed</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(booking.completedAt || data.createdAt)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800">Settlement</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(settlement.settlementDate || data.updatedAt)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className={`w-3 h-3 rounded-full ${paymentRecord.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-400'} mt-0.5 shrink-0`} />
                <div>
                  <p className="font-bold text-slate-800">Withdrawal</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{paymentRecord.completedAt ? fmtDate(paymentRecord.completedAt) : 'Pending Payout Request'}</p>
                </div>
              </div>
            </div>
          </SectionCard>

        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Provider Earnings Module &bull; Calculated from Backend Single Source
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

export default ProviderEarningDetailModal;
