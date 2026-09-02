import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiDollarSign, FiBriefcase, FiUser, FiCheckCircle, FiClock,
  FiShield, FiTrendingUp, FiLayers, FiFileText, FiRefreshCw, FiExternalLink
} from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import { useAdminFilter } from '../../../../context/AdminFilterContext';
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate, fmtDateOnly } from '../../../../utils/format';
import { formatStatus } from '../../../../utils/status';

const InfoRow = ({ label, value, mono = false, badge, onClick }) => (
  <div className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0 gap-3 text-xs">
    <span className="text-neutral-500 font-medium shrink-0">{label}</span>
    {onClick ? (
      <button onClick={onClick} className={`font-semibold text-teal-600 hover:underline flex items-center gap-1 cursor-pointer ${mono ? 'font-mono' : ''}`}>
        {value} <FiExternalLink className="w-3 h-3 inline" />
      </button>
    ) : (
      <span className={`font-semibold text-neutral-800 text-right ${mono ? 'font-mono break-all' : ''}`}>
        {badge || value || '—'}
      </span>
    )}
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
    default: 'bg-neutral-100 text-neutral-600 border-neutral-200/80',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded-full ${types[type]}`}>
      {label}
    </span>
  );
};

const CashPaymentDetailModal = ({ isOpen, onClose, entityData, transactionId }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const { openInvestigationDrawer } = useAdminFilter();

  const fetchDetail = useCallback(async () => {
    const targetId = entityData?._id || transactionId;
    if (!targetId) return;

    try {
      setLoading(true);
      // Fetch unified details for cash_payment (populates mongoData, booking, customer, provider)
      const res = await TransactionService.getUnifiedEntityDetails('cash_payment', targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local cash record data:', err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, transactionId]);

  useEffect(() => {
    if (isOpen) fetchDetail();
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  // Unnest backend response data properly
  const rootData = details || {};
  const mongoData = rootData.mongoData || (details?.transactionId ? details : null) || entityData || {};
  const booking = rootData.booking || mongoData.booking || {};
  const customer = rootData.customer || mongoData.user || booking.customer || {};
  const provider = rootData.provider || mongoData.provider || booking.provider || {};
  const cashAmount = mongoData.amount || booking.totalAmount || entityData?.amount || 0;
  const isVerified = booking.cashCollectionVerified || mongoData.cashCollectionVerified || ['success', 'completed', 'paid'].includes(mongoData.paymentStatus) || mongoData.verificationStatus === 'Verified';

  const tabs = [
    { id: 'overview',     label: 'Overview',      icon: FiDollarSign },
    { id: 'booking',      label: 'Booking',       icon: FiBriefcase },
    { id: 'provider',     label: 'Collector',     icon: FiUser },
    { id: 'verification', label: 'Verification',  icon: FiCheckCircle },
    { id: 'ledger',       label: 'Audit Log',     icon: FiFileText },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[88vh]" onClick={e => e.stopPropagation()}>
        
        {/* Light Header */}
        <div className="bg-neutral-50 px-5 py-3.5 flex items-center justify-between border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-50 text-amber-600 rounded-xl border border-amber-200 flex items-center justify-center font-bold text-sm">
              <FiDollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">Cash Collection Management</h2>
                <StatusChip
                  label={isVerified ? 'VERIFIED' : 'PENDING VERIFICATION'}
                  type={isVerified ? 'success' : 'warning'}
                />
              </div>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                Record ID: <span className="font-mono text-neutral-800">{mongoData.transactionId || mongoData.cashCollectionId || mongoData._id || 'N/A'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={fetchDetail} className="p-1.5 bg-white hover:bg-neutral-100 rounded-lg text-neutral-600 border border-neutral-200 cursor-pointer" title="Refresh">
              <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-1.5 bg-white hover:bg-neutral-100 rounded-lg text-neutral-600 border border-neutral-200 cursor-pointer" title="Close">
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="bg-white border-b border-neutral-200 px-5 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`py-1 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  active ? 'bg-amber-600 text-white font-bold' : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-neutral-400'}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-neutral-50/20">

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SectionCard title="Cash Collection Summary" icon={FiDollarSign}>
                <InfoRow label="Cash Record ID" value={mongoData.transactionId || mongoData.cashCollectionId || mongoData._id} mono />
                <InfoRow
                  label="Booking ID"
                  value={booking.bookingId || mongoData.bookingIdDisplay || 'N/A'}
                  onClick={booking._id ? () => openInvestigationDrawer('booking', booking._id) : null}
                />
                <InfoRow
                  label="Customer"
                  value={customer.name || 'N/A'}
                  onClick={customer._id ? () => openInvestigationDrawer('customer', customer._id) : null}
                />
                <InfoRow
                  label="Provider (Collector)"
                  value={provider.name || 'Assigned Provider'}
                  onClick={provider._id ? () => openInvestigationDrawer('provider', provider._id) : null}
                />
                <InfoRow
                  label="Cash Amount"
                  badge={<span className="text-sm font-black text-amber-600"><PriceDisplay amount={cashAmount} /></span>}
                />
                <InfoRow label="Payment Method" value={(mongoData.paymentMethod || 'cash').toUpperCase()} />
                <InfoRow label="Collection Date" value={fmtDate(mongoData.createdAt || booking.completedAt || mongoData.collectionDate)} />
              </SectionCard>

              <SectionCard title="Lifecycle & Verification Status" icon={FiShield}>
                <InfoRow
                  label="Collection Status"
                  badge={<StatusChip label={booking.status === 'completed' ? 'COLLECTED' : 'PENDING COLLECTION'} type={booking.status === 'completed' ? 'success' : 'warning'} />}
                />
                <InfoRow
                  label="Verification Status"
                  badge={<StatusChip label={isVerified ? 'VERIFIED' : 'PENDING VERIFICATION'} type={isVerified ? 'success' : 'warning'} />}
                />
                <InfoRow
                  label="Deposit Status"
                  badge={<StatusChip label={formatStatus(mongoData.depositStatus || (isVerified ? 'Deposited' : 'Pending Deposit'))} type={isVerified ? 'success' : 'warning'} />}
                />
                <InfoRow label="Verified By" value={mongoData.verifiedBy || (isVerified ? 'System Rule' : 'Unverified')} />
                <InfoRow label="Verification Date" value={isVerified ? fmtDate(mongoData.verificationDate || mongoData.updatedAt) : 'Pending Verification'} />
              </SectionCard>
            </div>
          )}

          {/* BOOKING */}
          {activeTab === 'booking' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SectionCard title="Booking Details & Invoice" icon={FiBriefcase}>
                <InfoRow
                  label="Booking Ref"
                  value={booking.bookingId || mongoData.bookingIdDisplay || 'N/A'}
                  onClick={booking._id ? () => openInvestigationDrawer('booking', booking._id) : null}
                />
                <InfoRow label="Booking Status" badge={<StatusChip label={(booking.status || 'completed').toUpperCase()} type="success" />} />
                <InfoRow label="Service Title" value={booking.services?.[0]?.service?.title || mongoData.serviceName || 'Home Service'} />
                <InfoRow label="Scheduled Date" value={booking.date ? fmtDateOnly(booking.date) : 'N/A'} />
                <InfoRow label="Completed At" value={fmtDate(booking.completedAt || mongoData.createdAt)} />
                <InfoRow label="Total Payable" badge={<span className="font-bold text-neutral-900"><PriceDisplay amount={booking.totalAmount || cashAmount} /></span>} />
              </SectionCard>

              <SectionCard title="Customer Information" icon={FiUser}>
                <InfoRow label="Customer Name" value={customer.name || 'N/A'} />
                <InfoRow label="Email Address" value={customer.email || 'N/A'} />
                <InfoRow label="Phone Number" value={customer.phone || 'N/A'} />
                <InfoRow label="Customer ID" value={customer.customerId || customer._id} mono />
              </SectionCard>
            </div>
          )}

          {/* PROVIDER / COLLECTOR */}
          {activeTab === 'provider' && (
            <SectionCard title="Collector (Provider) Information" icon={FiUser}>
              <InfoRow label="Provider Name" value={provider.name || 'N/A'} />
              <InfoRow label="Email Address" value={provider.email || 'N/A'} />
              <InfoRow label="Phone Number" value={provider.phone || 'N/A'} />
              <InfoRow label="Provider ID" value={provider.providerId || provider._id} mono />
              <InfoRow label="Cash Holding Status" badge={<StatusChip label={isVerified ? 'SETTLED' : 'HOLDING CASH'} type={isVerified ? 'success' : 'warning'} />} />
            </SectionCard>
          )}

          {/* VERIFICATION */}
          {activeTab === 'verification' && (
            <SectionCard title="Verification Audit Details" icon={FiCheckCircle}>
              <InfoRow label="Verification Status" badge={<StatusChip label={isVerified ? 'VERIFIED' : 'PENDING VERIFICATION'} type={isVerified ? 'success' : 'warning'} />} />
              <InfoRow label="Verified By" value={mongoData.verifiedBy || (isVerified ? 'System Rule' : 'Unverified')} />
              <InfoRow label="Verification Time" value={isVerified ? fmtDate(mongoData.verificationDate || mongoData.updatedAt) : 'Pending'} />
              <InfoRow label="Verification Method" value={isVerified ? 'Provider App / System Audit' : 'Pending Verification'} />
            </SectionCard>
          )}

          {/* AUDIT LOG */}
          {activeTab === 'ledger' && (
            <SectionCard title="Cash Collection System Audit Log" icon={FiFileText}>
              <div className="space-y-2 text-xs">
                <InfoRow label="Collection Event Initiated" value={fmtDate(mongoData.createdAt)} />
                <InfoRow label="Cash Collected By Provider" value={`${provider.name || 'Provider'} (${fmtDate(booking.completedAt || mongoData.createdAt)})`} />
                <InfoRow label="Verification State" value={isVerified ? 'Verified & Reconciled' : 'Awaiting System/Admin Verification'} />
              </div>
            </SectionCard>
          )}

        </div>

        {/* Footer */}
        <div className="bg-white border-t border-neutral-200 px-5 py-3 flex items-center justify-between text-xs text-neutral-500">
          <span>Cash Collection Module • Safe Audit Logging Enabled</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold cursor-pointer">
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};

export default CashPaymentDetailModal;
