import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiCreditCard, FiUser, FiActivity, FiArrowUpRight, FiArrowDownLeft,
  FiBriefcase, FiRotateCcw, FiMessageSquare, FiShield, FiRefreshCw, FiExternalLink,
  FiDollarSign, FiClock, FiFileText, FiLayers, FiCheckCircle, FiAlertCircle
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

const SectionCard = ({ title, icon: Icon, iconColor = 'text-purple-600', children }) => (
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

const CustomerWalletDetailModal = ({ isOpen, onClose, entityData, userId }) => {
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const { openInvestigationDrawer } = useAdminFilter();

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
    if (isOpen) {
      fetchDetail();
    }
  }, [isOpen, fetchDetail]);

  if (!isOpen) return null;

  const data = details || {};
  const customer = data.customer || entityData || {};
  const walletSummary = data.walletSummary || {
    walletBalance: customer.wallet?.availableBalance || customer.walletBalance || 0,
    lifetimeCredits: customer.credits || 0,
    lifetimeDebits: customer.debits || 0,
    refundCredits: customer.wallet?.totalRefunded || customer.refundCredit || 0,
    cashbackCredits: customer.cashback || 0,
    currentBalance: customer.wallet?.availableBalance || customer.walletBalance || 0,
    lastActivity: customer.lastActivity || customer.createdAt
  };

  const walletLedger = data.walletLedger || (customer.wallet?.walletTransactions || []).map((t, idx) => ({
    _id: t._id || idx,
    transactionId: `WTXN-${(t._id || idx).toString().slice(-6)}`,
    reference: t.booking ? `Booking #${t.booking}` : (t.source || 'Wallet System'),
    credit: t.type === 'credit' ? (t.amount || 0) : 0,
    debit: t.type === 'debit' ? (t.amount || 0) : 0,
    balanceAfter: walletSummary.walletBalance,
    source: t.source || 'Wallet System',
    type: t.type,
    reason: t.reason || t.type,
    status: 'completed',
    createdAt: t.createdAt || customer.createdAt
  }));

  const bookings = data.bookings || [];
  const payments = data.transactions || [];
  const refunds = data.refunds || [];
  const complaints = data.complaints || [];
  const audit = data.audit || {};

  const tabs = [
    { id: 'summary',    label: '1. Wallet Summary', icon: FiCreditCard },
    { id: 'ledger',     label: '2. Wallet Ledger',  icon: FiLayers },
    { id: 'bookings',   label: '3. Bookings',       icon: FiBriefcase },
    { id: 'payments',   label: '4. Payments',       icon: FiDollarSign },
    { id: 'refunds',    label: '5. Refunds',        icon: FiRotateCcw },
    { id: 'complaints', label: '6. Complaints',     icon: FiMessageSquare },
    { id: 'audit',      label: '7. Audit',          icon: FiFileText },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      <div className="bg-slate-50 w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-secondary via-neutral-800 to-secondary text-white px-6 py-5 flex items-center justify-between shrink-0 border-b border-neutral-700/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-primary/20 backdrop-blur-md rounded-2xl border border-primary/30 text-primary">
              <FiCreditCard className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight">{customer.name || 'Customer Wallet'}</h2>
                <StatusChip label="CUSTOMER WALLET" type="purple" />
              </div>
              <p className="text-xs text-neutral-300 font-medium mt-0.5">
                Customer ID: <span className="font-mono font-bold text-white">{customer.customerId || customer._id}</span>
                {customer.email && ` | ${customer.email}`}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 bg-purple-50/80 rounded-2xl border border-purple-100">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Current Available Balance</p>
                  <p className="text-3xl font-black text-slate-900 mt-1">
                    <PriceDisplay amount={walletSummary.walletBalance} />
                  </p>
                </div>
                <div className="p-5 bg-emerald-50/80 rounded-2xl border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Lifetime Credits</p>
                  <p className="text-3xl font-black text-emerald-600 mt-1">
                    <PriceDisplay amount={walletSummary.lifetimeCredits} />
                  </p>
                </div>
                <div className="p-5 bg-rose-50/80 rounded-2xl border border-rose-100">
                  <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Lifetime Debits</p>
                  <p className="text-3xl font-black text-rose-600 mt-1">
                    <PriceDisplay amount={walletSummary.lifetimeDebits} />
                  </p>
                </div>
                <div className="p-5 bg-blue-50/80 rounded-2xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Refund Deposits</p>
                  <p className="text-3xl font-black text-blue-600 mt-1">
                    <PriceDisplay amount={walletSummary.refundCredits} />
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Customer Profile Information" icon={FiUser}>
                  <InfoRow label="Customer Name" value={customer.name || 'N/A'} />
                  <InfoRow label="Email Address" value={customer.email || 'N/A'} />
                  <InfoRow label="Phone Number" value={customer.phone || 'N/A'} />
                  <InfoRow label="Customer ID" value={customer.customerId || customer._id} mono />
                  <InfoRow label="Member Since" value={fmtDateOnly(customer.createdAt)} />
                </SectionCard>

                <SectionCard title="Wallet Credit Breakdown" icon={FiCreditCard}>
                  <InfoRow
                    label="Current Balance"
                    badge={<span className="font-black text-purple-700 text-sm"><PriceDisplay amount={walletSummary.currentBalance} /></span>}
                  />
                  <InfoRow
                    label="Refund Credits"
                    badge={<span className="font-bold text-emerald-600"><PriceDisplay amount={walletSummary.refundCredits} /></span>}
                  />
                  <InfoRow
                    label="Promotional Cashback Credits"
                    badge={<span className="font-bold text-blue-600"><PriceDisplay amount={walletSummary.cashbackCredits} /></span>}
                  />
                  <InfoRow label="Last Activity Date" value={fmtDate(walletSummary.lastActivity)} />
                </SectionCard>
              </div>
            </div>
          )}

          {/* TAB 2: WALLET LEDGER */}
          {activeTab === 'ledger' && (
            <SectionCard title="Wallet Ledger Transactions" icon={FiLayers}>
              {walletLedger.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No wallet ledger transactions found for this customer.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Transaction ID</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Credit</th>
                        <th className="p-3">Debit</th>
                        <th className="p-3">Balance After</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {walletLedger.map((txn, idx) => (
                        <tr key={txn._id || idx} className="hover:bg-purple-50/20 transition-colors">
                          <td className="p-3 font-mono font-bold text-purple-700">{txn.transactionId}</td>
                          <td className="p-3 text-slate-700">{txn.reference}</td>
                          <td className="p-3 font-bold text-emerald-600">
                            {txn.credit > 0 ? <PriceDisplay amount={txn.credit} /> : '—'}
                          </td>
                          <td className="p-3 font-bold text-rose-600">
                            {txn.debit > 0 ? <PriceDisplay amount={txn.debit} /> : '—'}
                          </td>
                          <td className="p-3 font-black text-slate-900">
                            <PriceDisplay amount={txn.balanceAfter || 0} />
                          </td>
                          <td className="p-3 text-slate-500">{txn.source}</td>
                          <td className="p-3">
                            <StatusChip label={txn.type?.toUpperCase() || 'ENTRY'} type={txn.type === 'credit' ? 'success' : 'danger'} />
                          </td>
                          <td className="p-3">
                            <StatusChip label="COMPLETED" type="success" />
                          </td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(txn.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 3: BOOKINGS */}
          {activeTab === 'bookings' && (
            <SectionCard title="Customer Bookings History" icon={FiBriefcase}>
              {bookings.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No booking records found for this customer.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Booking ID</th>
                        <th className="p-3">Service</th>
                        <th className="p-3">Provider</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Booking Status</th>
                        <th className="p-3">Payment Status</th>
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
                            {b.provider ? (
                              <button
                                onClick={() => openInvestigationDrawer('provider', b.provider._id || b.provider)}
                                className="text-slate-800 hover:underline"
                              >
                                {b.provider.name || 'Provider'}
                              </button>
                            ) : 'Unassigned'}
                          </td>
                          <td className="p-3 font-black text-slate-900">
                            <PriceDisplay amount={b.totalAmount || 0} />
                          </td>
                          <td className="p-3">
                            <StatusChip label={(b.status || 'pending').toUpperCase()} type={b.status === 'completed' ? 'success' : 'info'} />
                          </td>
                          <td className="p-3">
                            <StatusChip label={(b.paymentStatus || 'pending').toUpperCase()} type={['paid', 'success'].includes(b.paymentStatus) ? 'success' : 'warning'} />
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

          {/* TAB 4: PAYMENTS */}
          {activeTab === 'payments' && (
            <SectionCard title="Payment & Order Transactions" icon={FiDollarSign}>
              {payments.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No payment transactions found for this customer.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Payment ID / Ref</th>
                        <th className="p-3">Order ID</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Breakdown / Gateway Ref</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {payments.map((p) => {
                        const pm = (p.paymentMethod || 'online').toLowerCase();
                        return (
                          <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-600">
                              <button
                                onClick={() => openInvestigationDrawer('payment', p._id)}
                                className="hover:underline"
                              >
                                {p.transactionId || `#${p._id.slice(-6)}`}
                              </button>
                            </td>
                            <td className="p-3 font-mono text-slate-500">{p.razorpayOrderId || '—'}</td>
                            <td className="p-3 font-bold uppercase">{pm}</td>
                            <td className="p-3 text-slate-700">
                              {pm === 'online' || pm === 'razorpay' ? (
                                <span className="font-mono text-purple-700">{p.razorpayPaymentId || 'Razorpay Gateway'}</span>
                              ) : pm === 'mixed' ? (
                                <span>Wallet: <PriceDisplay amount={p.booking?.walletUsed || 0} /> + Online: <PriceDisplay amount={p.booking?.onlinePaid || p.amount} /></span>
                              ) : (
                                <span className="font-mono text-slate-600">{p.transactionId || 'Wallet Ledger'}</span>
                              )}
                            </td>
                            <td className="p-3 font-black text-slate-900"><PriceDisplay amount={p.amount || 0} /></td>
                            <td className="p-3">
                              <StatusChip label={(p.paymentStatus || 'success').toUpperCase()} type={p.paymentStatus === 'failed' ? 'danger' : 'success'} />
                            </td>
                            <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 5: REFUNDS */}
          {activeTab === 'refunds' && (
            <SectionCard title="Refund Records" icon={FiRotateCcw}>
              {refunds.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No refund records found for this customer.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Refund ID</th>
                        <th className="p-3">Booking ID</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Gateway Refund</th>
                        <th className="p-3">Wallet Refund</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Approved By</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {refunds.map((r) => (
                        <tr key={r._id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-emerald-600">{r.refundId || `#${r._id.slice(-6)}`}</td>
                          <td className="p-3 font-semibold">
                            <button
                              onClick={() => openInvestigationDrawer('booking', r.bookingId?._id || r.bookingId)}
                              className="text-blue-600 hover:underline font-bold"
                            >
                              {r.bookingId?.bookingId || 'Booking'}
                            </button>
                          </td>
                          <td className="p-3 font-bold uppercase">{r.refundType || 'instant'}</td>
                          <td className="p-3 font-mono text-slate-500">{r.gatewayRefundId || '—'}</td>
                          <td className="p-3 font-mono text-emerald-700">{r.walletTransactionId || (r.refundMode === 'wallet' ? 'Wallet Deposit' : '—')}</td>
                          <td className="p-3 font-black text-emerald-600"><PriceDisplay amount={r.refundAmount || 0} /></td>
                          <td className="p-3">
                            <StatusChip label={(r.refundStatus || 'completed').toUpperCase()} type={r.refundStatus === 'failed' ? 'danger' : 'success'} />
                          </td>
                          <td className="p-3 text-slate-600">{r.approvedBy?.name || 'System Auto'}</td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* TAB 6: COMPLAINTS */}
          {activeTab === 'complaints' && (
            <SectionCard title="Customer Complaints" icon={FiMessageSquare}>
              {complaints.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">No complaints recorded for this customer.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="p-3">Complaint ID</th>
                        <th className="p-3">Booking ID</th>
                        <th className="p-3">Category / Reason</th>
                        <th className="p-3">Priority</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Resolution</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {complaints.map((c) => (
                        <tr key={c._id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-3 font-mono font-bold text-rose-600">{c.complaintId || `#${c._id.slice(-6)}`}</td>
                          <td className="p-3 font-semibold">
                            <button
                              onClick={() => openInvestigationDrawer('booking', c.booking?._id || c.booking)}
                              className="text-blue-600 hover:underline font-bold"
                            >
                              {c.booking?.bookingId || 'Booking'}
                            </button>
                          </td>
                          <td className="p-3 text-slate-800">{c.category || c.reason || 'General Issue'}</td>
                          <td className="p-3 font-bold text-amber-600 uppercase">{c.priority || 'medium'}</td>
                          <td className="p-3">
                            <StatusChip label={(c.status || 'open').toUpperCase()} type={c.status === 'resolved' ? 'success' : 'warning'} />
                          </td>
                          <td className="p-3 text-slate-600 max-w-[160px] truncate">{c.resolution || 'Pending Review'}</td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(c.createdAt)}</td>
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
            <SectionCard title="Wallet Adjustments & System Audit Log" icon={FiFileText}>
              <div className="space-y-4 text-xs text-slate-700">
                <InfoRow label="Wallet Account Created" value={fmtDate(audit.createdAt || customer.createdAt)} />
                <InfoRow label="Total Refund Credits Processed" value={`${audit.refundCount || refunds.length} deposits`} />
                <InfoRow label="Total Customer Complaints" value={`${audit.complaintCount || complaints.length} raised`} />
                <InfoRow label="Total Bookings Lifetime" value={`${audit.totalBookings || bookings.length} bookings`} />
                <InfoRow label="Total Transaction Records" value={`${audit.totalTransactions || (payments.length + walletLedger.length)} records`} />
              </div>
            </SectionCard>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            Customer Wallet Management &bull; Production Audit Enabled
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

export default CustomerWalletDetailModal;
