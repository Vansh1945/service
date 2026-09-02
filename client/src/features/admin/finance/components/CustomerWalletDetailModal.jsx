import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FiX, FiCreditCard, FiUser, FiActivity, FiBriefcase, FiMessageSquare,
  FiShield, FiRefreshCw, FiExternalLink, FiDollarSign, FiFileText, FiLayers
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

const CustomerWalletDetailModal = ({ isOpen, onClose, entityData, userId }) => {
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
    const targetId = entityData?._id || userId;
    if (!targetId) return;

    try {
      setLoading(true);
      const res = await TransactionService.getUnifiedEntityDetails('customer_wallet', targetId);
      if (res.data?.success && res.data?.data) {
        setDetails(res.data.data);
      } else {
        setDetails(entityData);
      }
    } catch (err) {
      console.warn('Falling back to local user data:', err);
      setDetails(entityData);
    } finally {
      setLoading(false);
    }
  }, [entityData, userId]);

  useEffect(() => {
    if (isOpen) fetchDetail();
  }, [isOpen, fetchDetail]);

  // 2. Data Definitions
  const data = details || {};
  const customer = data.customer || entityData || {};
  const walletSummary = data.walletSummary || {
    walletBalance: customer.wallet?.availableBalance ?? customer.walletBalance ?? 0,
    lifetimeCredits: customer.credits || 0,
    lifetimeDebits: customer.debits || 0,
    refundCredits: customer.wallet?.totalRefunded ?? customer.refundCredit ?? 0,
    status: customer.status || (customer.isActive === false ? 'suspended' : 'active')
  };

  const rawLedger = useMemo(() => {
    return data.walletLedger || (customer.wallet?.walletTransactions || []).map((t, idx) => ({
      _id: t._id || idx,
      transactionId: `WTXN-${(t._id || idx).toString().slice(-6)}`,
      credit: t.type === 'credit' ? (t.amount || 0) : 0,
      debit: t.type === 'debit' ? (t.amount || 0) : 0,
      balanceAfter: t.balanceAfter ?? walletSummary.walletBalance,
      type: t.type || 'wallet_transaction',
      description: t.reason || t.source || 'Wallet Entry',
      status: t.status || 'completed',
      createdAt: t.createdAt || customer.createdAt
    }));
  }, [data.walletLedger, customer]);

  const payments = data.transactions || [];
  const refunds = data.refunds || [];
  const bookings = data.bookings || [];
  const complaints = data.complaints || [];

  // Unified Transactions
  const unifiedTransactions = useMemo(() => {
    const combined = [];
    rawLedger.forEach(l => combined.push({
      _id: l._id, id: l.transactionId || `#${String(l._id).slice(-6)}`, createdAt: l.createdAt,
      type: l.credit > 0 ? 'Wallet Credit' : 'Wallet Debit', category: 'wallet', description: l.description,
      credit: l.credit, debit: l.debit, balanceAfter: l.balanceAfter, status: l.status
    }));
    payments.forEach(p => combined.push({
      _id: p._id, id: p.transactionId || p.razorpayPaymentId || `#${String(p._id).slice(-6)}`, createdAt: p.createdAt,
      type: 'Booking Payment', category: 'payment', description: `Payment via ${(p.paymentMethod || 'Online').toUpperCase()}`,
      credit: 0, debit: p.amount || 0, balanceAfter: '—', status: p.paymentStatus || 'completed'
    }));
    refunds.forEach(r => combined.push({
      _id: r._id, id: r.refundId || `#${String(r._id).slice(-6)}`, createdAt: r.createdAt,
      type: 'Refund', category: 'refund', description: `Refund (${r.refundType || 'Instant'})`,
      credit: r.refundAmount || 0, debit: 0, balanceAfter: '—', status: r.refundStatus || 'completed'
    }));
    return combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [rawLedger, payments, refunds]);

  const filteredTxns = useMemo(() => {
    return unifiedTransactions.filter(t => {
      const matchSearch = !txnSearch || t.id.toLowerCase().includes(txnSearch.toLowerCase()) || t.description.toLowerCase().includes(txnSearch.toLowerCase());
      const matchType = txnTypeFilter === 'all' || (txnTypeFilter === 'credit' ? t.credit > 0 : txnTypeFilter === 'debit' ? t.debit > 0 : t.category === txnTypeFilter);
      return matchSearch && matchType;
    });
  }, [unifiedTransactions, txnSearch, txnTypeFilter]);

  const paginatedTxns = filteredTxns.slice((txnPage - 1) * txnLimit, txnPage * txnLimit);
  const totalTxnPages = Math.ceil(filteredTxns.length / txnLimit) || 1;

  // Audit
  const auditLogs = useMemo(() => {
    const raw = data.auditRecords || [
      { _id: 'a1', createdAt: customer.createdAt, action: 'Customer wallet created', performedBy: 'System Auto', reason: 'Initial setup', previousValue: 'N/A', newValue: 'Initialized' }
    ];
    if (raw.length === 1 && refunds.length > 0) {
      refunds.forEach(r => raw.push({
        _id: `aud-${r._id}`, createdAt: r.createdAt, action: 'Refund credited', performedBy: r.approvedBy?.name || 'System',
        amount: r.refundAmount, reason: `Refund for booking`, previousValue: '—', newValue: `+₹${r.refundAmount}`
      }));
    }
    return raw.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [data.auditRecords, customer.createdAt, refunds]);

  const filteredAudits = useMemo(() => {
    return auditLogs.filter(a => !auditSearch || a.action.toLowerCase().includes(auditSearch.toLowerCase()) || (a.performedBy && a.performedBy.toLowerCase().includes(auditSearch.toLowerCase())));
  }, [auditLogs, auditSearch]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiCreditCard },
    { id: 'transactions', label: 'Transactions', icon: FiLayers },
    { id: 'activity', label: 'Activity', icon: FiActivity },
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
              {customer.name ? customer.name.charAt(0).toUpperCase() : <FiCreditCard />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-neutral-900">{customer.name || 'Customer Wallet'}</h2>
                <StatusChip label="CUSTOMER WALLET" type="info" />
                <StatusChip label={(walletSummary.status || 'ACTIVE').toUpperCase()} type={walletSummary.status === 'blocked' ? 'danger' : 'success'} />
              </div>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                ID: <span className="font-mono text-neutral-700">{customer.customerId || customer._id}</span>
                {customer.email && ` • ${customer.email}`}
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
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Wallet Balance</p>
                  <p className="text-base font-black text-teal-700 mt-0.5"><PriceDisplay amount={walletSummary.walletBalance} /></p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Total Credits</p>
                  <p className="text-base font-bold text-emerald-600 mt-0.5"><PriceDisplay amount={walletSummary.lifetimeCredits} /></p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Total Debits</p>
                  <p className="text-base font-bold text-rose-600 mt-0.5"><PriceDisplay amount={walletSummary.lifetimeDebits} /></p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Total Refunds</p>
                  <p className="text-base font-bold text-blue-600 mt-0.5"><PriceDisplay amount={walletSummary.refundCredits} /></p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Last Txn</p>
                  <p className="text-base font-bold text-neutral-800 mt-0.5">
                    {unifiedTransactions[0] ? <PriceDisplay amount={unifiedTransactions[0].credit || unifiedTransactions[0].debit || 0} /> : '₹0.00'}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-neutral-200">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase">Status</p>
                  <div className="mt-1"><StatusChip label={(walletSummary.status || 'Active').toUpperCase()} type={walletSummary.status === 'blocked' ? 'danger' : 'success'} /></div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SectionCard title="Customer Information" icon={FiUser}>
                  <InfoRow label="Customer Name" value={customer.name || 'N/A'} />
                  <InfoRow label="Customer ID" value={customer.customerId || customer._id} mono />
                  <InfoRow label="Email Address" value={customer.email || 'N/A'} />
                  <InfoRow label="Phone Number" value={customer.phone || 'N/A'} />
                  <InfoRow label="Account Created" value={fmtDateOnly(customer.createdAt)} />
                  <InfoRow label="Status" badge={<StatusChip label={(walletSummary.status || 'Active').toUpperCase()} type={walletSummary.status === 'blocked' ? 'danger' : 'success'} />} />
                </SectionCard>

                <SectionCard title="Recent Activity (Latest 5)" icon={FiActivity}>
                  {unifiedTransactions.slice(0, 5).length === 0 ? (
                    <p className="text-xs text-neutral-400 py-4 text-center">No recent activity.</p>
                  ) : (
                    <div className="space-y-2">
                      {unifiedTransactions.slice(0, 5).map(act => (
                        <div key={act._id} className="flex items-center justify-between p-2 bg-neutral-50 rounded-lg text-xs">
                          <div>
                            <p className="font-semibold text-neutral-800">{act.type}</p>
                            <p className="text-[10px] text-neutral-400">{fmtDate(act.createdAt)}</p>
                          </div>
                          <span className={`font-bold ${act.credit > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {act.credit > 0 ? '+' : '-'}<PriceDisplay amount={act.credit || act.debit || 0} />
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => { window.location.href = getEntityRoute ? getEntityRoute('customer_wallet', customer._id || userId) : `/admin/finance/customer-wallets?search=${customer._id}`; }}
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
              title="Combined Transaction Ledger"
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
                    <option value="credit">Credits</option>
                    <option value="debit">Debits</option>
                    <option value="payment">Payments</option>
                    <option value="refund">Refunds</option>
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
                            <td className="p-2.5"><StatusChip label={t.status.toUpperCase()} type={t.status === 'completed' || t.status === 'success' ? 'success' : 'warning'} /></td>
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

          {/* ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="space-y-5">
              <SectionCard
                title="Booking Summary"
                icon={FiBriefcase}
                rightElement={
                  <button onClick={() => { window.location.href = `/admin/bookings?search=${customer._id}`; }} className="text-xs text-teal-600 hover:underline font-semibold cursor-pointer">
                    View All Bookings &rarr;
                  </button>
                }
              >
                <div className="grid grid-cols-4 gap-2 mb-3 text-center text-xs">
                  <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-100"><p className="text-[10px] text-neutral-400 font-bold uppercase">Total</p><p className="font-bold">{bookings.length}</p></div>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100"><p className="text-[10px] text-emerald-600 font-bold uppercase">Completed</p><p className="font-bold text-emerald-700">{bookings.filter(b => b.status === 'completed').length}</p></div>
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-100"><p className="text-[10px] text-amber-600 font-bold uppercase">Pending</p><p className="font-bold text-amber-700">{bookings.filter(b => ['pending', 'accepted'].includes(b.status)).length}</p></div>
                  <div className="p-2 bg-rose-50 rounded-lg border border-rose-100"><p className="text-[10px] text-rose-600 font-bold uppercase">Cancelled</p><p className="font-bold text-rose-700">{bookings.filter(b => b.status === 'cancelled').length}</p></div>
                </div>
                {bookings.slice(0, 5).length === 0 ? <p className="text-xs text-neutral-400 text-center py-2">No bookings recorded.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-neutral-600">
                      <thead className="bg-neutral-50 text-neutral-500 uppercase text-[10px] font-bold border-b border-neutral-200">
                        <tr><th className="p-2">Booking ID</th><th className="p-2">Service</th><th className="p-2">Amount</th><th className="p-2">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-medium">
                        {bookings.slice(0, 5).map(b => (
                          <tr key={b._id} className="hover:bg-neutral-50">
                            <td className="p-2 font-mono"><button onClick={() => openInvestigationDrawer('booking', b._id)} className="text-teal-600 hover:underline">{b.bookingId || `#${b._id.slice(-6)}`}</button></td>
                            <td className="p-2">{b.services?.[0]?.service?.title || 'Home Service'}</td>
                            <td className="p-2 font-bold"><PriceDisplay amount={b.totalAmount || 0} /></td>
                            <td className="p-2"><StatusChip label={(b.status || 'pending').toUpperCase()} type={b.status === 'completed' ? 'success' : 'warning'} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Complaint Summary"
                icon={FiMessageSquare}
                rightElement={
                  <button onClick={() => { window.location.href = `/admin/complaints?search=${customer._id}`; }} className="text-xs text-teal-600 hover:underline font-semibold cursor-pointer">
                    View All Complaints &rarr;
                  </button>
                }
              >
                <div className="grid grid-cols-3 gap-2 mb-3 text-center text-xs">
                  <div className="p-2 bg-neutral-50 rounded-lg border border-neutral-100"><p className="text-[10px] text-neutral-400 font-bold uppercase">Total</p><p className="font-bold">{complaints.length}</p></div>
                  <div className="p-2 bg-rose-50 rounded-lg border border-rose-100"><p className="text-[10px] text-rose-600 font-bold uppercase">Open</p><p className="font-bold text-rose-700">{complaints.filter(c => ['open', 'pending'].includes(c.status)).length}</p></div>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100"><p className="text-[10px] text-emerald-600 font-bold uppercase">Resolved</p><p className="font-bold text-emerald-700">{complaints.filter(c => c.status === 'resolved').length}</p></div>
                </div>
                {complaints.slice(0, 5).length === 0 ? <p className="text-xs text-neutral-400 text-center py-2">No complaints filed.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-neutral-600">
                      <thead className="bg-neutral-50 text-neutral-500 uppercase text-[10px] font-bold border-b border-neutral-200">
                        <tr><th className="p-2">Complaint ID</th><th className="p-2">Subject</th><th className="p-2">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-medium">
                        {complaints.slice(0, 5).map(c => (
                          <tr key={c._id} className="hover:bg-neutral-50">
                            <td className="p-2 font-mono text-rose-600">{c.complaintId || `#${c._id.slice(-6)}`}</td>
                            <td className="p-2">{c.category || c.reason || 'General Issue'}</td>
                            <td className="p-2"><StatusChip label={(c.status || 'open').toUpperCase()} type={c.status === 'resolved' ? 'success' : 'danger'} /></td>
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
              title="System & Admin Audit Trail"
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
          <span>Customer Wallet Management • Production Audit Enabled</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold cursor-pointer">
            Close Details
          </button>
        </div>

      </div>
    </div>
  );
};

export default CustomerWalletDetailModal;
