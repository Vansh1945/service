import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiDollarSign, FiBriefcase, FiUser, FiCheckCircle, FiClock,
  FiShield, FiTrendingUp, FiLayers, FiFileText, FiRefreshCw, FiExternalLink,
  FiAlertTriangle, FiCheck, FiNavigation, FiCalendar, FiCreditCard, FiLock
} from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import { useAdminFilter } from '../../../../context/AdminFilterContext';
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate, fmtDateOnly } from '../../../../utils/format';
import { formatStatus } from '../../../../utils/status';

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

const SectionCard = ({ title, icon: Icon, iconColor = 'text-amber-600', children }) => (
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
      const res = await TransactionService.getAdminPaymentDetails(targetId);
      if (res.data?.success) {
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
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const data = details || entityData || {};
  const booking = data.booking || {};
  const customer = data.customer || data.user || booking.customer || {};
  const provider = data.provider || booking.provider || {};
  const settlement = data.settlement || {};
  const isVerified = booking.cashCollectionVerified || data.paymentStatus === 'success' || data.paymentStatus === 'completed' || data.verificationStatus === 'Verified';

  const tabs = [
    { id: 'overview',     label: 'Overview',      icon: FiDollarSign },
    { id: 'booking',      label: 'Booking',       icon: FiBriefcase },
    { id: 'provider',     label: 'Provider',      icon: FiUser },
    { id: 'verification', label: 'Verification',  icon: FiCheckCircle },
    { id: 'deposit',      label: 'Cash Deposit',  icon: FiShield },
    { id: 'ledger',       label: 'Ledger',        icon: FiLayers },
    { id: 'audit',        label: 'Audit',         icon: FiFileText },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white px-6 py-5 flex items-center justify-between shrink-0 border-b border-neutral-700/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30 text-primary">
              <FiDollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">Cash Collection Management</h2>
                <StatusChip
                  label={isVerified ? 'VERIFIED' : 'PENDING VERIFICATION'}
                  type={isVerified ? 'success' : 'warning'}
                />
              </div>
              <p className="text-xs text-neutral-300 font-medium mt-0.5">
                Cash Record ID: <span className="font-mono font-bold text-white">{data.cashId || data.transactionId || `#${(data._id || '').slice(-6)}`}</span>
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

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionCard title="Cash Collection Summary" icon={FiDollarSign}>
                <InfoRow label="Cash ID" value={data.cashId || data.transactionId || data._id} mono />
                <InfoRow
                  label="Booking ID"
                  value={booking.bookingId || data.bookingIdDisplay || 'N/A'}
                  onClick={() => openInvestigationDrawer('booking', booking._id || data.bookingId)}
                />
                <InfoRow
                  label="Customer"
                  value={customer.name || 'N/A'}
                  onClick={() => openInvestigationDrawer('customer', customer._id || data.user)}
                />
                <InfoRow
                  label="Provider (Collector)"
                  value={provider.name || 'Assigned Provider'}
                  onClick={() => openInvestigationDrawer('provider', provider._id || data.provider)}
                />
                <InfoRow
                  label="Cash Amount"
                  badge={<span className="text-sm font-black text-amber-600"><PriceDisplay amount={data.amount || booking.totalAmount || 0} /></span>}
                />
                <InfoRow label="Payment Method" value={(data.paymentMethod || 'cash').toUpperCase()} />
                <InfoRow label="Collection Date" value={fmtDate(data.collectionDate || booking.completedAt || data.createdAt)} />
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
                  label="Settlement Status"
                  badge={<StatusChip label="N/A" type="default" />}
                />
                <InfoRow
                  label="Deposit Status"
                  badge={<StatusChip label={formatStatus(data.depositStatus || (isVerified ? 'Deposited' : 'Pending Deposit'))} type={isVerified ? 'success' : 'warning'} />}
                />
                <InfoRow label="Verified By" value={data.verifiedBy || (isVerified ? 'System Rule' : 'Unverified')} />
                <InfoRow label="Verification Date" value={isVerified ? fmtDate(data.verificationDate || data.updatedAt) : 'Pending Verification'} />
              </SectionCard>
            </div>
          )}

          {/* BOOKING TAB */}
          {activeTab === 'booking' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionCard title="Booking Details & Invoice" icon={FiBriefcase}>
                <InfoRow
                  label="Booking Ref"
                  value={booking.bookingId || data.bookingIdDisplay || 'N/A'}
                  onClick={() => openInvestigationDrawer('booking', booking._id || data.bookingId)}
                />
                <InfoRow label="Booking Status" badge={<StatusChip label={(booking.status || 'completed').toUpperCase()} type="success" />} />
                <InfoRow label="Service Title" value={data.serviceName || booking.services?.[0]?.service?.title || 'Home Service'} />
                <InfoRow label="Scheduled Date & Time" value={`${fmtDateOnly(booking.date)} at ${booking.time || 'N/A'}`} />
                <InfoRow label="OTP Verification" value={booking.OTP ? `Verified OTP (${booking.OTP})` : 'OTP Confirmed'} />
                <InfoRow label="Job Completed At" value={fmtDate(booking.completedAt || data.createdAt)} />
                <InfoRow
                  label="Total Payable"
                  badge={<span className="font-black text-slate-900"><PriceDisplay amount={booking.totalAmount || data.amount || 0} /></span>}
                />
              </SectionCard>

              <SectionCard title="Parties Involved" icon={FiUser}>
                <InfoRow
                  label="Customer Name"
                  value={customer.name || 'N/A'}
                  onClick={() => openInvestigationDrawer('customer', customer._id || data.user)}
                />
                <InfoRow label="Customer Contact" value={`${customer.email || 'N/A'} | ${customer.phone || 'N/A'}`} />
                <InfoRow
                  label="Provider Name"
                  value={provider.name || 'Assigned Provider'}
                  onClick={() => openInvestigationDrawer('provider', provider._id || data.provider)}
                />
                <InfoRow label="Provider Contact" value={`${provider.email || 'N/A'} | ${provider.phone || 'N/A'}`} />
                <InfoRow label="Service Zone" value={data.zoneName || booking.zoneId?.name || 'Default Service Zone'} />
              </SectionCard>
            </div>
          )}

          {/* PROVIDER TAB */}
          {activeTab === 'provider' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionCard title="Provider Liability & Earnings" icon={FiUser}>
                <InfoRow
                  label="Provider Profile"
                  value={provider.name || 'Provider'}
                  onClick={() => openInvestigationDrawer('provider', provider._id || data.provider)}
                />
                <InfoRow
                  label="Provider Wallet Balance"
                  badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={provider.wallet?.availableBalance || 0} /></span>}
                  onClick={() => openInvestigationDrawer('provider_wallet', provider._id || data.provider)}
                />
                <InfoRow
                  label="Job Gross Cash Collected"
                  badge={<span className="font-bold text-amber-600"><PriceDisplay amount={data.amount || booking.totalAmount || 0} /></span>}
                />
                <InfoRow
                  label="Platform Commission"
                  badge={<span className="font-bold text-rose-600"><PriceDisplay amount={booking.commissionAmount || data.commissionAmount || 0} /></span>}
                />
                <InfoRow
                  label="Net Provider Earnings"
                  badge={<span className="font-black text-blue-600"><PriceDisplay amount={booking.providerEarnings || data.providerEarnings || 0} /></span>}
                />
              </SectionCard>

              <SectionCard title="Cash Liability Calculation" icon={FiAlertTriangle}>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-2 mb-4">
                  <p className="font-bold flex items-center">
                    <FiAlertTriangle className="mr-1.5 w-4 h-4 text-amber-600" />
                    Provider Cash Liability Rule:
                  </p>
                  <p>
                    When a provider collects cash on delivery, the collected amount remains an unverified liability until reconciled and verified by admin/system rules.
                  </p>
                </div>
                <InfoRow
                  label="Active Cash Liability"
                  badge={
                    <span className="font-black text-amber-600">
                      <PriceDisplay amount={isVerified ? 0 : (data.amount || booking.totalAmount || 0)} />
                    </span>
                  }
                />
                <InfoRow label="Liability Status" badge={<StatusChip label={isVerified ? 'RECONCILED' : 'ACTIVE LIABILITY'} type={isVerified ? 'success' : 'warning'} />} />
              </SectionCard>
            </div>
          )}

          {/* VERIFICATION TAB */}
          {activeTab === 'verification' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionCard title="Verification Audit Details" icon={FiCheckCircle}>
                <InfoRow label="Collected By" value={data.collectedBy || provider.name || 'Provider'} />
                <InfoRow label="Verified By" value={data.verifiedBy || (isVerified ? 'System Auto-Rule' : 'Pending Admin Action')} />
                <InfoRow label="Verification Status" badge={<StatusChip label={isVerified ? 'VERIFIED' : 'PENDING'} type={isVerified ? 'success' : 'warning'} />} />
                <InfoRow label="Verification Method" value={isVerified ? 'Trust Score Auto-Rule / Admin Verified' : 'Manual Admin Review'} />
                <InfoRow label="Verification Time" value={isVerified ? fmtDate(data.verificationDate || data.updatedAt) : 'N/A'} />
                <InfoRow label="Verification Notes" value={data.description || 'Cash payment collected upon booking completion.'} />
              </SectionCard>

              <SectionCard title="Auto-Verification Rule Safeguard" icon={FiShield}>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-800 space-y-2">
                  <p className="font-bold flex items-center">
                    <FiShield className="mr-1.5 w-4 h-4 text-blue-600" />
                    Business Rule:
                  </p>
                  <p>
                    Cash collections are held in <strong>Collected (Pending Verification)</strong> status to allow verification against system trust rules or manual admin audit before settlement.
                  </p>
                </div>
              </SectionCard>
            </div>
          )}

          {/* CASH DEPOSIT TAB */}
          {activeTab === 'deposit' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionCard title="Bank Deposit & Reconciliation" icon={FiShield}>
                <InfoRow label="Deposit Status" badge={<StatusChip label={formatStatus(data.depositStatus || (isVerified ? 'Deposited' : 'Pending Deposit'))} type={isVerified ? 'success' : 'warning'} />} />
                <InfoRow label="Deposit Date" value={fmtDate(data.verificationDate || data.createdAt)} />
                <InfoRow
                  label="Deposit Amount"
                  badge={<span className="font-bold text-slate-900"><PriceDisplay amount={data.amount || 0} /></span>}
                />
                <InfoRow label="Deposit Reference" value={data.cashId || `DEP-${data._id}`} mono />
                <InfoRow label="Reconciliation Status" badge={<StatusChip label={isVerified ? 'RECONCILED' : 'UNMATCHED'} type={isVerified ? 'success' : 'warning'} />} />
                {settlement._id && (
                  <InfoRow
                    label="Settlement Link"
                    value={settlement.settlementId || `#${settlement._id.slice(-6)}`}
                    onClick={() => openInvestigationDrawer('settlement', settlement._id)}
                  />
                )}
              </SectionCard>

              <SectionCard title="Deposit Safeguard Summary" icon={FiTrendingUp}>
                <p className="text-xs text-slate-600">
                  Cash collected by providers is automatically matched against platform commissions during weekly/bi-weekly settlement runs.
                </p>
              </SectionCard>
            </div>
          )}

          {/* LEDGER TAB */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              <SectionCard title="Financial Breakdown & Linked Entries" icon={FiLayers}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Total Cash Paid</p>
                    <p className="text-xl font-black text-amber-600 mt-1"><PriceDisplay amount={data.amount || 0} /></p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Platform Share</p>
                    <p className="text-xl font-black text-rose-600 mt-1"><PriceDisplay amount={booking.commissionAmount || data.commissionAmount || 0} /></p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Provider Share</p>
                    <p className="text-xl font-black text-blue-600 mt-1"><PriceDisplay amount={booking.providerEarnings || data.providerEarnings || 0} /></p>
                  </div>
                </div>

                <InfoRow
                  label="Linked Cash Transaction"
                  value={data.cashId || data.transactionId}
                  mono
                  onClick={() => openInvestigationDrawer('payment', data._id || data.transactionId)}
                />
                <InfoRow
                  label="Linked Customer Wallet"
                  value={customer.name ? `${customer.name}'s Wallet` : 'N/A'}
                  onClick={() => openInvestigationDrawer('wallet', customer._id)}
                />
                <InfoRow
                  label="Linked Settlement"
                  value={settlement.settlementId || 'Pending Settlement Batch'}
                  onClick={settlement._id ? () => openInvestigationDrawer('settlement', settlement._id) : undefined}
                />
              </SectionCard>
            </div>
          )}

          {/* AUDIT TAB */}
          {activeTab === 'audit' && (
            <SectionCard title="Cash Collection Timeline & Audit Log" icon={FiFileText}>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Booking Completed & Cash Collected</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(booking.completedAt || data.createdAt)}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className={`w-3 h-3 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-400'} mt-0.5 shrink-0`} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      {isVerified ? 'Cash Collection Verified' : 'Pending Verification'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{isVerified ? fmtDate(data.verificationDate || data.updatedAt) : 'Awaiting auto-rule or admin verification'}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className={`w-3 h-3 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-slate-300'} mt-0.5 shrink-0`} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Cash Reconciled & Settled</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{isVerified ? fmtDate(data.updatedAt) : 'Pending reconciliation'}</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Cash Collection Module &bull; Safe Audit Logging Enabled
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

export default CashPaymentDetailModal;
