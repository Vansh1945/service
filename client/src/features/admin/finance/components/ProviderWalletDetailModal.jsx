import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiBriefcase, FiUser, FiDollarSign, FiShield, FiTrendingUp,
  FiFileText, FiRefreshCw, FiExternalLink, FiLock, FiAlertTriangle,
  FiCheckCircle, FiClock, FiCreditCard, FiActivity
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

const ProviderWalletDetailModal = ({ isOpen, onClose, entityData, providerId }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const { openInvestigationDrawer } = useAdminFilter();

  const fetchDetail = useCallback(async () => {
    const targetId = entityData?._id || providerId;
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('provider_wallet', targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local provider data:', err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, providerId]);

  useEffect(() => {
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const data = details || {};
  const provider = data.provider || entityData || {};
  const walletSummary = data.walletSummary || {
    availableBalance: provider.availableBalance ?? provider.wallet?.availableBalance ?? 0,
    escrowBalance: provider.escrowBalance ?? provider.wallet?.escrowBalance ?? 0,
    pendingPayout: provider.pendingPayout ?? provider.wallet?.pendingPayout ?? 0,
    penalty: provider.penaltyBalance ?? provider.wallet?.totalPenalty ?? 0,
    withdrawn: provider.totalWithdrawn ?? provider.wallet?.totalWithdrawn ?? 0,
    payoutHold: provider.payoutHold || false
  };

  const bookings = data.bookings || [];
  const earnings = data.earnings || [];
  const settlements = data.settlements || [];
  const withdrawals = data.withdrawals || [];
  const penalties = data.penalties || [];
  const audit = data.audit || {};

  const tabs = [
    { id: 'summary',     label: '1. Wallet Summary', icon: FiBriefcase },
    { id: 'bookings',    label: '2. Bookings',       icon: FiBriefcase },
    { id: 'earnings',    label: '3. Earnings',       icon: FiTrendingUp },
    { id: 'settlements', label: '4. Settlements',    icon: FiShield },
    { id: 'withdrawals', label: '5. Withdrawals',    icon: FiDollarSign },
    { id: 'penalties',   label: '6. Penalties',      icon: FiAlertTriangle },
    { id: 'audit',       label: '7. Audit',          icon: FiFileText },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white px-6 py-5 flex items-center justify-between shrink-0 border-b border-neutral-700/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30 text-primary">
              <FiBriefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">{provider.name || 'Provider Wallet'}</h2>
                <StatusChip label="PROVIDER WALLET" type="info" />
                {walletSummary.payoutHold && <StatusChip label="HOLD ACTIVE" type="danger" />}
              </div>
              <p className="text-xs text-neutral-300 font-medium mt-0.5">
                Provider ID: <span className="font-mono font-bold text-white">{provider.providerId || provider._id}</span>
                {provider.email && ` | ${provider.email}`}
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

          {/* TAB 1: WALLET SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-blue-50/80 rounded-2xl border border-blue-100">
                  <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Available Balance</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">
                    <PriceDisplay amount={walletSummary.availableBalance} />
                  </p>
                </div>
                <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-100">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Escrow Reserve</p>
                  <p className="text-2xl font-black text-amber-600 mt-1">
                    <PriceDisplay amount={walletSummary.escrowBalance} />
                  </p>
                </div>
                <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-100">
                  <p className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Pending Payout</p>
                  <p className="text-2xl font-black text-purple-600 mt-1">
                    <PriceDisplay amount={walletSummary.pendingPayout} />
                  </p>
                </div>
                <div className="p-4 bg-rose-50/80 rounded-2xl border border-rose-100">
                  <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Penalty Balance</p>
                  <p className="text-2xl font-black text-rose-600 mt-1">
                    <PriceDisplay amount={walletSummary.penalty} />
                  </p>
                </div>
                <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100">
                  <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Total Withdrawn</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">
                    <PriceDisplay amount={walletSummary.withdrawn} />
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Provider Details" icon={FiUser}>
                  <InfoRow label="Provider Name" value={provider.name || 'N/A'} />
                  <InfoRow label="Email Address" value={provider.email || 'N/A'} />
                  <InfoRow label="Phone Number" value={provider.phone || 'N/A'} />
                  <InfoRow label="Provider ID" value={provider.providerId || provider._id} mono />
                  <InfoRow label="Registration Date" value={fmtDateOnly(provider.createdAt)} />
                </SectionCard>

                <SectionCard title="Payout & Wallet Status" icon={FiShield}>
                  <InfoRow
                    label="Payout Hold Status"
                    badge={<StatusChip label={walletSummary.payoutHold ? 'HOLD ACTIVE' : 'READY FOR PAYOUT'} type={walletSummary.payoutHold ? 'danger' : 'success'} />}
                  />
                  {walletSummary.payoutHoldReason && (
                    <InfoRow label="Hold Reason" value={walletSummary.payoutHoldReason} />
                  )}
                  <InfoRow
                    label="Available Balance"
                    badge={<span className="font-black text-blue-700"><PriceDisplay amount={walletSummary.availableBalance} /></span>}
                  />
                  <InfoRow
                    label="Escrow Reserve"
                    badge={<span className="font-bold text-amber-600"><PriceDisplay amount={walletSummary.escrowBalance} /></span>}
                  />
                </SectionCard>
              </div>
            </div>
          )}

          {/* TAB 2: BOOKINGS */}
          {activeTab === 'bookings' && (
            <SectionCard title="Provider Bookings History" icon={FiBriefcase}>
              {bookings.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No booking records found for this provider.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Booking ID</th>
                        <th className="p-3">Service</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Payment Status</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {bookings.map((b) => (
                        <tr key={b._id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold">
                            <button
                              onClick={() => openInvestigationDrawer('booking', b._id)}
                              className="text-blue-600 hover:underline font-bold"
                            >
                              {b.bookingId || `#${b._id.slice(-6)}`}
                            </button>
                          </td>
                          <td className="p-3 font-medium text-slate-800">
                            {b.services?.[0]?.service?.title || 'Home Service'}
                          </td>
                          <td className="p-3 text-slate-700">
                            {b.customer ? (
                              <button
                                onClick={() => openInvestigationDrawer('customer', b.customer._id || b.customer)}
                                className="text-slate-800 hover:underline"
                              >
                                {b.customer.name || 'Customer'}
                              </button>
                            ) : 'Customer'}
                          </td>
                          <td className="p-3">
                            <StatusChip label={(b.paymentStatus || 'pending').toUpperCase()} type={['paid', 'success'].includes(b.paymentStatus) ? 'success' : 'warning'} />
                          </td>
                          <td className="p-3 font-black text-slate-900">
                            <PriceDisplay amount={b.totalAmount || 0} />
                          </td>
                          <td className="p-3">
                            <StatusChip label={(b.status || 'pending').toUpperCase()} type={b.status === 'completed' ? 'success' : 'info'} />
                          </td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(b.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 3: EARNINGS */}
          {activeTab === 'earnings' && (
            <SectionCard title="Provider Job Earnings & Commission Breakdown" icon={FiTrendingUp}>
              {earnings.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No earning records found for this provider.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Booking</th>
                        <th className="p-3">Customer Paid</th>
                        <th className="p-3">Commission</th>
                        <th className="p-3">Provider Share</th>
                        <th className="p-3">Settlement Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {earnings.map((e) => (
                        <tr key={e._id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-semibold">
                            <button
                              onClick={() => openInvestigationDrawer('booking', e.booking?._id || e.booking)}
                              className="text-blue-600 hover:underline font-bold"
                            >
                              {e.booking?.bookingId || `#${(e.booking?._id || e._id).slice(-6)}`}
                            </button>
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            <PriceDisplay amount={e.grossAmount || e.booking?.totalAmount || 0} />
                          </td>
                          <td className="p-3 font-bold text-rose-600">
                            <PriceDisplay amount={e.commissionAmount || 0} />
                          </td>
                          <td className="p-3 font-black text-blue-600">
                            <PriceDisplay amount={e.netAmount || 0} />
                          </td>
                          <td className="p-3">
                            <StatusChip label={(e.status || 'available').toUpperCase()} type={e.status === 'withdrawn' || e.status === 'paid' ? 'success' : 'warning'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 4: SETTLEMENTS */}
          {activeTab === 'settlements' && (
            <SectionCard title="Provider Settlement Records" icon={FiShield}>
              {settlements.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No settlement records found for this provider.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Settlement ID</th>
                        <th className="p-3">Booking ID</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {settlements.map((s) => (
                        <tr key={s._id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-purple-600">
                            <button
                              onClick={() => openInvestigationDrawer('settlement', s._id)}
                              className="hover:underline"
                            >
                              {s.transactionId || `#${s._id.slice(-6)}`}
                            </button>
                          </td>
                          <td className="p-3 font-semibold">
                            {s.booking ? (
                              <button
                                onClick={() => openInvestigationDrawer('booking', s.booking._id || s.booking)}
                                className="text-blue-600 hover:underline font-bold"
                              >
                                {s.booking.bookingId || 'Booking'}
                              </button>
                            ) : 'N/A'}
                          </td>
                          <td className="p-3 font-black text-slate-900">
                            <PriceDisplay amount={s.amount || 0} />
                          </td>
                          <td className="p-3">
                            <StatusChip label={(s.paymentStatus || 'completed').toUpperCase()} type="success" />
                          </td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(s.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 5: WITHDRAWALS */}
          {activeTab === 'withdrawals' && (
            <SectionCard title="Provider Withdrawals & Payouts" icon={FiDollarSign}>
              {withdrawals.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No withdrawal records found for this provider.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Withdrawal ID</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Bank / Payout Details</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">UTR / Ref</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {withdrawals.map((w) => (
                        <tr key={w._id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-blue-600">
                            <button
                              onClick={() => openInvestigationDrawer('payout', w._id)}
                              className="hover:underline"
                            >
                              {w.transactionReference || `#${w._id.slice(-6)}`}
                            </button>
                          </td>
                          <td className="p-3 font-black text-emerald-600">
                            <PriceDisplay amount={w.amount || 0} />
                          </td>
                          <td className="p-3 text-slate-700">
                            {w.paymentDetails?.bankName ? `${w.paymentDetails.bankName} (${w.paymentDetails.accountNumber || ''})` : (w.paymentMethod || 'Bank Transfer')}
                          </td>
                          <td className="p-3">
                            <StatusChip label={(w.status || 'completed').toUpperCase()} type={w.status === 'completed' || w.status === 'transferred' ? 'success' : 'warning'} />
                          </td>
                          <td className="p-3 font-mono text-slate-500">{w.utrNo || w.transactionReference || '—'}</td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(w.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 6: PENALTIES */}
          {activeTab === 'penalties' && (
            <SectionCard title="Provider Penalties & Deductions" icon={FiAlertTriangle}>
              {penalties.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No penalty records found for this provider.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Penalty Type</th>
                        <th className="p-3">Reason</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Created By</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {penalties.map((p, idx) => (
                        <tr key={p._id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-bold text-rose-600 uppercase">{p.type || 'PENALTY'}</td>
                          <td className="p-3 text-slate-800">{p.description || p.reason || 'Late Cancellation / Policy Penalty'}</td>
                          <td className="p-3 font-black text-rose-600"><PriceDisplay amount={p.amount || 0} /></td>
                          <td className="p-3 text-slate-500">{p.approvedBy?.name || 'System Rule'}</td>
                          <td className="p-3"><StatusChip label="DEDUCTED" type="danger" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 7: AUDIT */}
          {activeTab === 'audit' && (
            <SectionCard title="Provider Wallet Audit & Timeline" icon={FiFileText}>
              <div className="space-y-4 text-xs text-slate-700">
                <InfoRow label="Wallet Account Created" value={fmtDate(audit.createdAt || provider.createdAt)} />
                <InfoRow label="Total Bookings Lifetime" value={`${audit.totalBookings || bookings.length} bookings`} />
                <InfoRow label="Total Earning Records" value={`${audit.totalEarnings || earnings.length} records`} />
                <InfoRow label="Total Withdrawal Requests" value={`${audit.totalWithdrawals || withdrawals.length} payouts`} />
                <InfoRow label="Total Penalty Records" value={`${audit.totalPenalties || penalties.length} deductions`} />
              </div>
            </SectionCard>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Provider Wallet Console &bull; Audit Trail Active
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

export default ProviderWalletDetailModal;
