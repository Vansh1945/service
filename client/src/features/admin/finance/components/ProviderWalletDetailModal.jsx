import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FiX, FiBriefcase, FiUser, FiDollarSign, FiShield,
  FiFileText, FiRefreshCw, FiExternalLink, FiActivity, FiLayers
} from 'react-icons/fi';
import PriceDisplay from '../../../../components/PriceDisplay';
import { useAdminFilter } from '../../../../context/AdminFilterContext';
import * as TransactionService from '../../../../services/TransactionService';
import { fmtDate, fmtDateOnly } from '../../../../utils/format';

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

const SectionCard = ({ title, icon: Icon, iconColor = 'text-teal-600', rightElement, children }) => (
  <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden">
    <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
        <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">{title}</h3>
      </div>
      {rightElement}
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

const ProviderWalletDetailModal = ({ isOpen, onClose, entityData, providerId }) => {
  // 1. Hooks (Top Level Unconditional)
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const [txnSearch, setTxnSearch] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState('all');
  const [txnPage, setTxnPage] = useState(1);
  const txnLimit = 7;

  const [auditSearch, setAuditSearch] = useState('');
  const { openInvestigationDrawer, getEntityRoute } = useAdminFilter();

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
    if (isOpen) fetchDetail();
  }, [isOpen, fetchDetail]);

  // 2. Data Definitions
  const data = details || {};
  const provider = data.provider || entityData || {};
  const walletSummary = data.walletSummary || {
    availableBalance: provider.availableBalance ?? provider.wallet?.availableBalance ?? 0,
    pendingEarnings: provider.pendingEarnings ?? provider.wallet?.pendingEarnings ?? 0,
    escrowBalance: provider.escrowBalance ?? provider.wallet?.escrowBalance ?? 0,
    pendingPayout: provider.pendingPayout ?? provider.wallet?.pendingPayout ?? 0,
    penalty: provider.penaltyBalance ?? provider.wallet?.totalPenalty ?? 0,
    withdrawn: provider.totalWithdrawn ?? provider.wallet?.totalWithdrawn ?? 0,
    payoutHold: provider.payoutHold || false,
    payoutHoldReason: provider.payoutHoldReason || null,
    nextPayoutDate: provider.nextPayoutDate || provider.wallet?.nextPayoutDate,
    payoutEligibility: provider.payoutEligibility || (provider.payoutHold ? 'On Hold' : 'Eligible for Payout'),
    bankAccount: provider.bankAccount || (provider.payoutDetails?.accountNumber ? `•••• ${String(provider.payoutDetails.accountNumber).slice(-4)}` : 'Bank Transfer Set'),
    status: provider.status || 'active'
  };

  const earnings = data.earnings || [];
  const settlements = data.settlements || [];
  const withdrawals = data.withdrawals || [];
  const penalties = data.penalties || [];

  // Unified Transactions
  const unifiedTransactions = useMemo(() => {
    const combined = [];
    earnings.forEach(e => combined.push({
      _id: e._id, id: e.booking?.bookingId || `#${String(e._id).slice(-6)}`, createdAt: e.createdAt,
      type: 'Booking Earning', category: 'earning', description: `Earning for Booking`,
      credit: e.netAmount || 0, debit: 0, status: e.status || 'available'
    }));
    settlements.forEach(s => combined.push({
      _id: s._id, id: s.transactionId || `#${String(s._id).slice(-6)}`, createdAt: s.createdAt,
      type: 'Settlement', category: 'settlement', description: `Settlement Record`,
      credit: s.amount || 0, debit: 0, status: s.paymentStatus || 'completed'
    }));
    withdrawals.forEach(w => combined.push({
      _id: w._id, id: w.transactionReference || `#${String(w._id).slice(-6)}`, createdAt: w.createdAt,
      type: 'Withdrawal', category: 'withdrawal', description: `Payout to Bank (${w.paymentMethod || 'Transfer'})`,
      credit: 0, debit: w.amount || 0, status: w.status || 'completed'
    }));
    penalties.forEach(p => combined.push({
      _id: p._id, id: `PEN-${String(p._id || '').slice(-6)}`, createdAt: p.createdAt || provider.createdAt,
      type: 'Penalty', category: 'penalty', description: p.description || p.reason || 'Penalty Deduction',
      credit: 0, debit: p.amount || 0, status: 'deducted'
    }));
    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [earnings, settlements, withdrawals, penalties, provider.createdAt]);

  const filteredTxns = useMemo(() => {
    return unifiedTransactions.filter(t => {
      const matchSearch = !txnSearch || t.id.toLowerCase().includes(txnSearch.toLowerCase()) || t.type.toLowerCase().includes(txnSearch.toLowerCase());
      const matchType = txnTypeFilter === 'all' || t.category === txnTypeFilter;
      return matchSearch && matchType;
    });
  }, [unifiedTransactions, txnSearch, txnTypeFilter]);

  const paginatedTxns = filteredTxns.slice((txnPage - 1) * txnLimit, txnPage * txnLimit);
  const totalTxnPages = Math.ceil(filteredTxns.length / txnLimit) || 1;

  // Audit
  const auditLogs = useMemo(() => {
    const raw = data.auditRecords || [
      { _id: 'pa1', createdAt: provider.createdAt, action: 'Provider wallet created', performedBy: 'System Auto', reason: 'Registration setup', previousValue: 'N/A', newValue: 'Initialized' }
    ];
    if (penalties.length > 0) {
      penalties.forEach(p => raw.push({
        _id: `aud-pen-${p._id}`, createdAt: p.createdAt || provider.createdAt, action: 'Penalty applied', performedBy: p.approvedBy?.name || 'System Rule',
        reason: p.description || 'Penalty', previousValue: '—', newValue: `-₹${p.amount}`
      }));
    }
    if (walletSummary.payoutHold) {
      raw.push({
        _id: 'aud-hold', createdAt: provider.updatedAt || provider.createdAt, action: 'Payout hold added', performedBy: 'Admin Console',
        reason: walletSummary.payoutHoldReason || 'Admin Hold', previousValue: 'Ready', newValue: 'Hold Active'
      });
    }
    return raw.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [data.auditRecords, provider.createdAt, provider.updatedAt, penalties, walletSummary.payoutHold, walletSummary.payoutHoldReason]);

  const filteredAudits = useMemo(() => {
    return auditLogs.filter(a => !auditSearch || a.action.toLowerCase().includes(auditSearch.toLowerCase()) || (a.performedBy && a.performedBy.toLowerCase().includes(auditSearch.toLowerCase())));
  }, [auditLogs, auditSearch]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiBriefcase },
    { id: 'transactions', label: 'Transactions', icon: FiLayers },
    { id: 'payouts', label: 'Payouts', icon: FiDollarSign },
    { id: 'audit', label: 'Audit', icon: FiFileText },
  ];

  // 3. Early Return (After all hooks)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-neutral-200 overflow-hidden flex flex-col max-h-[88vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-neutral-50 px-5 py-3.5 flex items-center justify-between border-b border-neutral-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-50 text-teal-600 rounded-xl border border-teal-200 flex items-center justify-center font-bold text-sm">
              {provider.name ? provider.name.charAt(0).toUpperCase() : <FiBriefcase />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">{provider.name || 'Provider Wallet'}</h2>
                <StatusChip label="PROVIDER WALLET" type="info" />
                {walletSummary.payoutHold && <StatusChip label="HOLD ACTIVE" type="danger" />}
              </div>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                ID: <span className="font-mono text-neutral-700">{provider.providerId || provider._id}</span>
                {provider.email && ` • ${provider.email}`}
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
                  active ? 'bg-teal-600 text-white font-bold' : 'text-neutral-600 hover:bg-neutral-100'
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
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Available Balance</p>
                  <p className="text-base font-black text-emerald-600 mt-0.5"><PriceDisplay amount={walletSummary.availableBalance} /></p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Pending Earnings</p>
                  <p className="text-base font-bold text-teal-600 mt-0.5"><PriceDisplay amount={walletSummary.pendingEarnings} /></p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Escrow Reserve</p>
                  <p className="text-base font-bold text-amber-600 mt-0.5"><PriceDisplay amount={walletSummary.escrowBalance} /></p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Pending Payout</p>
                  <p className="text-base font-bold text-blue-600 mt-0.5"><PriceDisplay amount={walletSummary.pendingPayout} /></p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Penalty Balance</p>
                  <p className="text-base font-bold text-rose-600 mt-0.5"><PriceDisplay amount={walletSummary.penalty} /></p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Total Withdrawn</p>
                  <p className="text-base font-bold text-neutral-800 mt-0.5"><PriceDisplay amount={walletSummary.withdrawn} /></p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="Provider Information" icon={FiUser}>
                  <InfoRow label="Provider Name" value={provider.name || 'N/A'} />
                  <InfoRow label="Provider ID" value={provider.providerId || provider._id} mono />
                  <InfoRow label="Email Address" value={provider.email || 'N/A'} />
                  <InfoRow label="Phone Number" value={provider.phone || 'N/A'} />
                  <InfoRow label="Registration Date" value={fmtDateOnly(provider.createdAt)} />
                  <InfoRow label="Status" badge={<StatusChip label={(walletSummary.status || 'Active').toUpperCase()} type="success" />} />
                </SectionCard>

                <SectionCard title="Wallet & Payout Status" icon={FiShield}>
                  <InfoRow label="Payout Hold Status" badge={<StatusChip label={walletSummary.payoutHold ? 'HOLD ACTIVE' : 'READY FOR PAYOUT'} type={walletSummary.payoutHold ? 'danger' : 'success'} />} />
                  {walletSummary.payoutHoldReason && <InfoRow label="Hold Reason" value={walletSummary.payoutHoldReason} />}
                  <InfoRow label="Available Balance" badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={walletSummary.availableBalance} /></span>} />
                  <InfoRow label="Escrow Reserve" badge={<span className="font-semibold text-amber-600"><PriceDisplay amount={walletSummary.escrowBalance} /></span>} />
                  <InfoRow label="Next Payout Date" value={walletSummary.nextPayoutDate ? fmtDateOnly(walletSummary.nextPayoutDate) : 'Standard Cycle'} />
                  <InfoRow label="Bank Account" value={walletSummary.bankAccount} mono />
                </SectionCard>
              </div>

              <SectionCard title="Recent Financial Activity (Latest 5)" icon={FiActivity}>
                {unifiedTransactions.slice(0, 5).length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4 text-center">No recent financial transactions.</p>
                ) : (
                  <div className="space-y-2">
                    {unifiedTransactions.slice(0, 5).map(act => (
                      <div key={act._id} className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg text-xs">
                        <div>
                          <p className="font-semibold text-neutral-800">{act.type}</p>
                          <p className="text-[10px] text-neutral-400">{fmtDate(act.createdAt)} • {act.description}</p>
                        </div>
                        <span className={`font-bold ${act.credit > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {act.credit > 0 ? '+' : '-'}<PriceDisplay amount={act.credit || act.debit || 0} />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <div className="flex justify-end">
                <button
                  onClick={() => { window.location.href = getEntityRoute ? getEntityRoute('provider_wallet', provider._id || providerId) : `/admin/finance/provider-wallets?search=${provider._id}`; }}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  View Full Financial Report &rarr;
                </button>
              </div>
            </div>
          )}

          {/* TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <SectionCard
              title="Unified Transaction Ledger"
              icon={FiLayers}
              rightElement={
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search..."
                    value={txnSearch}
                    onChange={e => { setTxnSearch(e.target.value); setTxnPage(1); }}
                    className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs w-32 focus:outline-none"
                  />
                  <select
                    value={txnTypeFilter}
                    onChange={e => { setTxnTypeFilter(e.target.value); setTxnPage(1); }}
                    className="py-1 px-2 bg-white border border-neutral-200 rounded-lg text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="all">All</option>
                    <option value="earning">Earnings</option>
                    <option value="settlement">Settlements</option>
                    <option value="withdrawal">Withdrawals</option>
                    <option value="penalty">Penalties</option>
                  </select>
                </div>
              }
            >
              {paginatedTxns.length === 0 ? (
                <div className="py-8 text-center text-neutral-400 text-xs">No transactions found.</div>
              ) : (
                <div className="space-y-2.5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-neutral-600 min-w-[640px]">
                      <thead className="bg-neutral-50 text-neutral-500 uppercase text-[10px] font-bold tracking-wider border-b border-neutral-200">
                        <tr>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">ID</th>
                          <th className="p-2.5">Type</th>
                          <th className="p-2.5">Description</th>
                          <th className="p-2.5">Credit</th>
                          <th className="p-2.5">Debit</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-medium">
                        {paginatedTxns.map(t => (
                          <tr key={t._id} className="hover:bg-neutral-50 transition-colors">
                            <td className="p-2.5 text-neutral-400 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                            <td className="p-2.5 font-mono font-semibold text-teal-700">{t.id}</td>
                            <td className="p-2.5 font-semibold text-neutral-800">{t.type}</td>
                            <td className="p-2.5 text-neutral-600 max-w-[160px] truncate">{t.description}</td>
                            <td className="p-2.5 font-bold text-emerald-600">{t.credit > 0 ? <PriceDisplay amount={t.credit} /> : '—'}</td>
                            <td className="p-2.5 font-bold text-rose-600">{t.debit > 0 ? <PriceDisplay amount={t.debit} /> : '—'}</td>
                            <td className="p-2.5"><StatusChip label={t.status.toUpperCase()} type={['completed', 'available', 'success'].includes(t.status) ? 'success' : 'warning'} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalTxnPages > 1 && (
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-100">
                      <span className="text-neutral-400">Page {txnPage} of {totalTxnPages}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setTxnPage(p => Math.max(1, p - 1))} disabled={txnPage === 1} className="px-2 py-0.5 bg-white border border-neutral-200 rounded disabled:opacity-40 cursor-pointer">Prev</button>
                        <button onClick={() => setTxnPage(p => Math.min(totalTxnPages, p + 1))} disabled={txnPage === totalTxnPages} className="px-2 py-0.5 bg-white border border-neutral-200 rounded disabled:opacity-40 cursor-pointer">Next</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}

          {/* PAYOUTS */}
          {activeTab === 'payouts' && (
            <div className="space-y-5">
              <SectionCard title="Current Payout Status & Eligibility" icon={FiShield}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <InfoRow label="Available for Payout" badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={walletSummary.availableBalance} /></span>} />
                    <InfoRow label="Pending Payout Amount" badge={<span className="font-semibold text-blue-600"><PriceDisplay amount={walletSummary.pendingPayout} /></span>} />
                    <InfoRow label="Payout Hold Status" badge={<StatusChip label={walletSummary.payoutHold ? 'HOLD ACTIVE' : 'READY FOR PAYOUT'} type={walletSummary.payoutHold ? 'danger' : 'success'} />} />
                  </div>
                  <div>
                    {walletSummary.payoutHoldReason && <InfoRow label="Hold Reason" value={walletSummary.payoutHoldReason} />}
                    <InfoRow label="Next Payout Cycle" value={walletSummary.nextPayoutDate ? fmtDateOnly(walletSummary.nextPayoutDate) : 'Standard Cycle'} />
                    <InfoRow label="Bank Account" value={walletSummary.bankAccount} mono />
                  </div>
                </div>
              </SectionCard>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 bg-white rounded-xl border border-neutral-200"><p className="text-[10px] font-bold text-neutral-400 uppercase">Total Paid</p><p className="text-base font-bold text-emerald-600 mt-0.5"><PriceDisplay amount={walletSummary.withdrawn} /></p></div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200"><p className="text-[10px] font-bold text-neutral-400 uppercase">Total Withdrawn</p><p className="text-base font-bold text-neutral-800 mt-0.5"><PriceDisplay amount={walletSummary.withdrawn} /></p></div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200"><p className="text-[10px] font-bold text-neutral-400 uppercase">Pending Amount</p><p className="text-base font-bold text-blue-600 mt-0.5"><PriceDisplay amount={walletSummary.pendingPayout} /></p></div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200"><p className="text-[10px] font-bold text-neutral-400 uppercase">Failed Payouts</p><p className="text-base font-bold text-rose-600 mt-0.5">{withdrawals.filter(w => w.status === 'failed').length}</p></div>
              </div>

              <SectionCard
                title="Recent Payouts & Withdrawals (Latest 5)"
                icon={FiDollarSign}
                rightElement={
                  <button onClick={() => { window.location.href = `/admin/finance/payouts?search=${provider._id}`; }} className="text-xs text-teal-600 hover:underline font-semibold cursor-pointer">
                    View Full Settlement & Payout Report &rarr;
                  </button>
                }
              >
                {withdrawals.slice(0, 5).length === 0 ? <p className="text-xs text-neutral-400 text-center py-4">No withdrawal records found.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-neutral-600">
                      <thead className="bg-neutral-50 text-neutral-500 uppercase text-[10px] font-bold border-b border-neutral-200">
                        <tr><th className="p-2.5">Payout ID</th><th className="p-2.5">Date</th><th className="p-2.5">Amount</th><th className="p-2.5">Method</th><th className="p-2.5">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-medium">
                        {withdrawals.slice(0, 5).map(w => (
                          <tr key={w._id} className="hover:bg-neutral-50">
                            <td className="p-2.5 font-mono"><button onClick={() => openInvestigationDrawer('payout', w._id)} className="text-blue-600 hover:underline">{w.transactionReference || `#${w._id.slice(-6)}`}</button></td>
                            <td className="p-2.5 text-neutral-400 whitespace-nowrap">{fmtDate(w.createdAt)}</td>
                            <td className="p-2.5 font-bold text-emerald-600"><PriceDisplay amount={w.amount || 0} /></td>
                            <td className="p-2.5 text-neutral-700">{w.paymentMethod || 'Bank Transfer'}</td>
                            <td className="p-2.5"><StatusChip label={(w.status || 'completed').toUpperCase()} type={['completed', 'transferred'].includes(w.status) ? 'success' : 'warning'} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* AUDIT */}
          {activeTab === 'audit' && (
            <SectionCard
              title="Provider System & Admin Audit Trail"
              icon={FiFileText}
              rightElement={
                <input
                  type="text"
                  placeholder="Search audit..."
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-xs w-36 focus:outline-none"
                />
              }
            >
              {filteredAudits.length === 0 ? <div className="py-8 text-center text-neutral-400 text-xs">No audit records found.</div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-neutral-600 min-w-[580px]">
                    <thead className="bg-neutral-50 text-neutral-500 uppercase text-[10px] font-bold tracking-wider border-b border-neutral-200">
                      <tr>
                        <th className="p-2.5">Date & Time</th>
                        <th className="p-2.5">Action</th>
                        <th className="p-2.5">Performed By</th>
                        <th className="p-2.5">Reason</th>
                        <th className="p-2.5">New Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 font-medium">
                      {filteredAudits.map((log, idx) => (
                        <tr key={log._id || idx} className="hover:bg-neutral-50 transition-colors">
                          <td className="p-2.5 text-neutral-400 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                          <td className="p-2.5 font-semibold text-neutral-900">{log.action}</td>
                          <td className="p-2.5 text-neutral-700">{log.performedBy || 'System'}</td>
                          <td className="p-2.5 text-neutral-600 truncate max-w-[140px]">{log.reason || '—'}</td>
                          <td className="p-2.5 font-mono font-semibold text-emerald-700">{log.newValue || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

        </div>

        {/* Footer */}
        <div className="bg-white border-t border-neutral-200 px-5 py-3 flex items-center justify-between text-xs text-neutral-500">
          <span>Provider Wallet Console • Real-time Audit Active</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold cursor-pointer">
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};

export default ProviderWalletDetailModal;
