import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiTrendingUp, FiBriefcase, FiDollarSign, FiShield,
  FiRotateCcw, FiRefreshCw, FiCheckCircle, FiClock
} from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import { useAdminFilter } from '../../../../context/AdminFilterContext';
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate } from '../../../../utils/format';

const InfoRow = ({ label, value, mono = false, badge, linkUrl }) => (
  <div className="flex items-start justify-between py-2 border-b border-neutral-100 last:border-0 gap-4 text-xs">
    <span className="text-neutral-500 font-medium shrink-0">{label}</span>
    {linkUrl ? (
      <a
        href={linkUrl}
        className={`font-semibold text-primary hover:underline text-right ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </a>
    ) : (
      <span className={`font-semibold text-secondary text-right ${mono ? 'font-mono break-all' : ''}`}>
        {badge || value || '—'}
      </span>
    )}
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

const StatusChip = ({ label, type = 'default' }) => {
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

const ProviderEarningDetailModal = ({ isOpen, onClose, entityData, earningId }) => {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const { getEntityRoute } = useAdminFilter();

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
  const earningStatus = data.earningStatus || (['success', 'completed'].includes((data.paymentStatus || booking.status || '').toLowerCase()) ? 'Credited' : 'Pending');
  const payoutStatus = data.payoutStatus || paymentRecord.status || (earningStatus === 'Credited' ? 'Available for Payout' : 'Pending');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-secondary/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-secondary text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-lg text-primary">
              <FiTrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Provider Earning Details</h2>
                <StatusChip label={String(earningStatus).toUpperCase()} type="success" />
              </div>
              <p className="text-xs text-neutral-400 mt-0.5 font-mono">
                Booking ID: {booking.bookingId || data.bookingId || `#${String(data._id || '').slice(-6)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetail}
              className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Refresh"
            >
              <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-neutral-50/50">

          {/* Earnings KPI Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-neutral-200">
              <span className="text-[11px] font-medium text-neutral-500 block">Gross Booking Amount</span>
              <span className="text-base font-black text-secondary mt-0.5 block">
                <PriceDisplay amount={customerPaid} />
              </span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-neutral-200">
              <span className="text-[11px] font-medium text-neutral-500 block">Platform Commission</span>
              <span className="text-base font-bold text-danger mt-0.5 block">
                - <PriceDisplay amount={commission} />
              </span>
            </div>
            <div className="p-3.5 bg-white rounded-xl border border-neutral-200">
              <span className="text-[11px] font-medium text-neutral-500 block">Provider Net Share</span>
              <span className="text-base font-black text-success mt-0.5 block">
                <PriceDisplay amount={providerShare} />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Provider & Service Information */}
            <SectionCard title="Provider & Service Info" icon={FiBriefcase}>
              <InfoRow
                label="Provider Name"
                value={provider.name || 'Assigned Provider'}
                linkUrl={provider._id ? getEntityRoute('provider', provider._id) : null}
              />
              <InfoRow
                label="Booking ID"
                value={booking.bookingId || data.bookingId || 'N/A'}
                mono
                linkUrl={getEntityRoute('booking', booking._id || data.booking)}
              />
              <InfoRow label="Service Name" value={booking.services?.[0]?.service?.title || data.serviceName || 'Home Service'} />
              <InfoRow
                label="Customer"
                value={customer.name || 'Customer'}
                linkUrl={customer._id ? getEntityRoute('customer', customer._id) : null}
              />
              <InfoRow label="Booking Date" value={fmtDate(booking.createdAt || data.createdAt)} />
            </SectionCard>

            {/* Earning Breakdown & Availability */}
            <SectionCard title="Earning & Payout Status" icon={FiDollarSign}>
              <InfoRow label="Earning Status" badge={<StatusChip label={String(earningStatus).toUpperCase()} type="success" />} />
              <InfoRow label="Payout Status" badge={<StatusChip label={String(payoutStatus).toUpperCase()} type="info" />} />
              <InfoRow label="Available After" value={data.availableAfter ? fmtDate(data.availableAfter) : 'Job Completion'} />
              <InfoRow label="Paid Date" value={paymentRecord.completedAt ? fmtDate(paymentRecord.completedAt) : 'N/A'} />
              {refund && (
                <InfoRow label="Refund Deduction" badge={<span className="font-bold text-danger">- <PriceDisplay amount={refund.providerDeduction || 0} /></span>} />
              )}
            </SectionCard>

          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-neutral-200 flex justify-between items-center shrink-0">
          <span className="text-xs text-neutral-500 font-medium">Provider Earning Record</span>
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

export default ProviderEarningDetailModal;

