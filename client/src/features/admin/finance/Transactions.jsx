import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import * as TransactionService from '../../../services/TransactionService';
import Pagination from '../../../components/ui/Pagination';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import PriceDisplay from '../../../components/PriceDisplay';
import TransactionLedgerDetailModal from './components/TransactionLedgerDetailModal';
import { fmtDateTime, fmtDate, truncateId } from '../../../utils/format';
import {
  Layers, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  AlertCircle, ArrowUpRight, ArrowDownLeft, Minus
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers — pure display, no financial logic
// ─────────────────────────────────────────────────────────────────────────────

const TXN_TYPE_CONFIG = {
  payment: { label: 'Customer Payment', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  wallet_topup: { label: 'Wallet Payment', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  cash: { label: 'Cash Collection', bg: 'bg-lime-50 text-lime-700 border-lime-200' },
  mixed: { label: 'Mixed Payment', bg: 'bg-primary/10 text-primary border-primary/20' },
  refund: { label: 'Refund', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  refundrecovery: { label: 'Wallet Refund', bg: 'bg-pink-50 text-pink-700 border-pink-200' },
  commissiondeduction: { label: 'Commission', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  settlement: { label: 'Settlement', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
  withdrawal: { label: 'Withdrawal', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  withdrawalrejection: { label: 'Withdrawal Rejected', bg: 'bg-red-50 text-red-700 border-red-200' },
  penalty: { label: 'Penalty', bg: 'bg-red-50 text-red-700 border-red-200' },
  adjustment: { label: 'Adjustment', bg: 'bg-gray-50 text-gray-700 border-gray-200' },
  referralreward: { label: 'Referral Reward', bg: 'bg-primary/10 text-primary border-primary/20' },
  cashback: { label: 'Coupon / Cashback', bg: 'bg-teal-50 text-teal-700 border-teal-200' },
  escrow_hold: { label: 'Escrow Hold', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  escrow_release: { label: 'Escrow Release', bg: 'bg-cyan-50 text-cyan-800 border-cyan-300' },
};

const PAY_STATUS_CONFIG = {
  success: { label: 'Success', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  processing: { label: 'Processing', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  failed: { label: 'Failed', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  refunded: { label: 'Refunded', cls: 'bg-primary/10 text-primary border-primary/20' },
};

const TypeBadge = ({ type, paymentMethod }) => {
  const key = type || (paymentMethod === 'cash' ? 'cash' : paymentMethod === 'mixed' ? 'mixed' : 'payment');
  const cfg = TXN_TYPE_CONFIG[key] || { label: key?.replace(/_/g, ' ') || 'Unknown', bg: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={`px-2.5 py-0.5 ${cfg.bg} border rounded-full text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap`}>
      {cfg.label}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const cfg = PAY_STATUS_CONFIG[(status || '').toLowerCase()] || { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`px-2.5 py-0.5 ${cfg.cls} border rounded-full text-[10px] font-bold uppercase`}>
      {cfg.label}
    </span>
  );
};

const MethodBadge = ({ method }) => {
  const m = (method || '').toLowerCase();
  const map = {
    upi: 'bg-indigo-100 text-indigo-800 font-extrabold',
    card: 'bg-blue-100 text-blue-800',
    netbanking: 'bg-cyan-100 text-cyan-800',
    wallet: 'bg-amber-100 text-amber-800',
    cash: 'bg-lime-100 text-lime-800',
    mixed: 'bg-primary/10 text-primary',
    online: 'bg-sky-100 text-sky-800',
    system: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`px-2 py-0.5 ${map[m] || 'bg-gray-100 text-gray-600'} rounded-md text-[10px] font-bold uppercase`}>
      {m === 'upi' ? 'UPI (Razorpay QR)' : m || 'N/A'}
    </span>
  );
};

const EntryIcon = ({ entryType, type }) => {
  const isDebit = entryType === 'debit' || ['refund', 'withdrawal', 'withdrawalrejection', 'penalty', 'commissiondeduction', 'refundrecovery', 'escrow_hold'].includes(type);
  const isCredit = entryType === 'credit' || ['payment', 'settlement', 'wallet_topup', 'referralreward', 'cashback', 'escrow_release'].includes(type);

  if (isDebit && !isCredit) return <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500" />;
  if (isCredit && !isDebit) return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
};

const EntityLink = ({ label, title, onClick, mono = false, truncate = true }) => (
  <button
    onClick={onClick}
    className={`text-blue-600 hover:text-blue-800 hover:underline text-left transition-colors ${mono ? 'font-mono text-[11px]' : 'text-xs font-semibold'} ${truncate ? 'max-w-[120px] block truncate' : ''}`}
    title={title || label}
  >
    {label}
  </button>
);


// ─────────────────────────────────────────────────────────────────────────────
// Ledger Sub-Tabs
// ─────────────────────────────────────────────────────────────────────────────
const LEDGER_TABS = [
  { id: 'all', label: 'All Entries' },
  { id: 'payment', label: 'Payment' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'refund', label: 'Refund' },
  { id: 'commission', label: 'Commission' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'withdrawal', label: 'Withdrawal' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const AdminTransactions = () => {
  const navigate = useNavigate();

  const {
    getMergedQuery,
    searchQuery,
    filterType,
    year,
    financialYear,
    month,
    quarter,
    zoneIds
  } = useAdminFilter();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeLedger, setActiveLedger] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);

  // ── Fetch from Master Ledger endpoint ──────────────────────────────────────
  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const base = getMergedQuery();
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(activeLedger !== 'all' ? { ledgerType: activeLedger } : {}),
        ...(base.startDate ? { startDate: base.startDate } : {}),
        ...(base.endDate ? { endDate: base.endDate } : {}),
        ...(base.zoneIds ? { zoneIds: base.zoneIds } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
      };

      const response = await TransactionService.getMasterLedger(params);
      if (response.data?.success) {
        setTransactions(response.data.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.total || 0,
          pages: response.data.pages || 1,
        }));
      }
    } catch (err) {
      console.error('Master Ledger fetch error:', err);
      setError('Failed to load ledger records.');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, activeLedger, getMergedQuery, searchQuery]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger, filterType, year, financialYear, month, quarter, zoneIds, searchQuery]);

  // Auto-open TransactionLedgerDetailModal if openDetail query param is present
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openDetail') === 'true' && transactions.length > 0 && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const searchVal = params.get('search');
      const target = transactions.find(t =>
        t.transactionId === searchVal ||
        t._id === searchVal ||
        t.razorpayPaymentId === searchVal ||
        t.bookingId === searchVal ||
        t.booking?.bookingId === searchVal
      ) || transactions[0];
      if (target) {
        setSelectedTxn(target);
        setModalOpen(true);
      }
    }
  }, [transactions]);

  // Reset to page 1 when ledger tab changes
  const handleTabChange = (tabId) => {
    setActiveLedger(tabId);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // ── Open detail modal ──────────────────────────────────────────────────────
  const handleViewDetail = (txn) => {
    setSelectedTxn(txn);
    setModalOpen(true);
  };

  // ── Navigation helpers — clickable entity links ────────────────────────────
  const goToBooking = (bookingId) => {
    if (bookingId) navigate(`/admin/bookings?search=${encodeURIComponent(bookingId)}&openDetail=true`);
  };
  const goToPayment = (txnId) => {
    if (txnId) navigate(`/admin/payments?search=${encodeURIComponent(txnId)}&openDetail=true`);
  };
  const goToRefund = (refundId) => navigate(`/admin/refunds?search=${encodeURIComponent(refundId || '')}&openDetail=true`);
  const goToSettlement = (settlementId) => navigate(`/admin/settlements?search=${encodeURIComponent(settlementId || '')}&openDetail=true`);
  const goToCustomer = (customerId) => navigate(`/admin/customers?search=${encodeURIComponent(customerId || '')}&openDetail=true`);
  const goToProvider = (providerId) => navigate(`/admin/approve-providers?search=${encodeURIComponent(providerId || '')}&openDetail=true`);
  const goToCustomerWallet = (walletId) => navigate(`/admin/customer-wallets?search=${encodeURIComponent(walletId || '')}&openDetail=true`);
  const goToProviderWallet = (walletId) => navigate(`/admin/provider-wallets?search=${encodeURIComponent(walletId || '')}&openDetail=true`);
  const goToPayout = (payoutId) => navigate(`/admin/payout?search=${encodeURIComponent(payoutId || '')}&openDetail=true`);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalCredit = transactions.reduce((s, t) => s + (t.creditAmount || 0), 0);
  const totalDebit = transactions.reduce((s, t) => s + (t.debitAmount || 0), 0);
  const lastBalance = transactions.length > 0 ? (transactions[transactions.length - 1].runningBalance ?? null) : null;

  return (
    <div className="space-y-5">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold text-[10px] uppercase tracking-wider rounded-md border border-indigo-200">
                Master Ledger
              </span>
              <span className="text-[11px] text-gray-400 font-medium">Single Source of Truth · Double-Entry Accounting</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl mr-3">
                <Layers className="w-6 h-6" />
              </span>
              Transaction Ledger
            </h1>
            <p className="text-xs text-gray-500 mt-1 ml-12">
              Every financial movement on the platform — payments, wallets, refunds, settlements, commissions, withdrawals.
            </p>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
              <div className="text-emerald-500 font-semibold uppercase tracking-wide text-[10px]">Total Credit</div>
              <div className="font-black text-emerald-700 text-sm mt-0.5">
                <PriceDisplay amount={totalCredit} />
              </div>
            </div>
            <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-xs">
              <div className="text-rose-500 font-semibold uppercase tracking-wide text-[10px]">Total Debit</div>
              <div className="font-black text-rose-700 text-sm mt-0.5">
                <PriceDisplay amount={totalDebit} />
              </div>
            </div>
            {lastBalance !== null && (
              <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs">
                <div className="text-indigo-500 font-semibold uppercase tracking-wide text-[10px]">Net Balance</div>
                <div className={`font-black text-sm mt-0.5 ${lastBalance >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
                  <PriceDisplay amount={Math.abs(lastBalance)} />
                </div>
              </div>
            )}
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs">
              <div className="text-gray-500 font-semibold uppercase tracking-wide text-[10px]">Entries</div>
              <div className="font-black text-gray-800 text-sm mt-0.5">{pagination.total.toLocaleString('en-IN')}</div>
            </div>
            <button
              onClick={fetchLedger}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
              title="Refresh Ledger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Ledger Sub-Tabs ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {LEDGER_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${activeLedger === tab.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Ledger Table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

        {loading ? (
          <TableSkeleton rows={8} columns={11} standalone />
        ) : error ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <p className="text-rose-600 font-semibold text-sm">{error}</p>
            <button onClick={fetchLedger} className="mt-3 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100">
              Retry
            </button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center">
            <Layers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm font-medium">No ledger entries found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700 whitespace-nowrap min-w-[1100px]">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  {/* 1 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider">Transaction ID</th>
                  {/* 2 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider">Booking / Reference</th>
                  {/* 3 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider">Party</th>
                  {/* 4 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider">Type</th>
                  {/* 5 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider">Method</th>
                  {/* 6 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider text-right">Amount</th>
                  {/* 7 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider text-center">Entry</th>
                  {/* 8 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider text-right">Running Balance</th>
                  {/* 9 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider">Status</th>
                  {/* 10 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider">Date</th>
                  {/* 11 */}
                  <th className="p-3 text-[10px] font-extrabold text-gray-600 uppercase tracking-wider text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {transactions.map((txn, idx) => {
                  const booking = txn.booking || {};
                  const bookingIdStr = booking.bookingId || (txn.bookingId && !txn.bookingId.startsWith('WDL-') ? txn.bookingId : null);
                  const isWithdrawal = txn.type === 'withdrawal' || txn.ledgerType === 'withdrawal' || (txn.bookingId && txn.bookingId.startsWith('WDL-'));
                  const wdlRefStr = isWithdrawal ? (txn.bookingId || txn.referenceNumber || null) : null;
                  const refundIdStr = txn.refundId || (txn.type === 'refund' ? txn.referenceNumber : null);
                  const txnIdStr = txn.transactionId || txn.razorpayPaymentId || `#${String(txn._id).slice(-8).toUpperCase()}`;

                  // Party resolution based on transaction type
                  const isProviderPrimary = isWithdrawal || txn.type === 'commissiondeduction' || txn.type === 'settlement' || (!txn.user && txn.provider);
                  const primaryParty = isProviderPrimary
                    ? { name: txn.provider?.name || 'Provider', sub: txn.provider?.email || txn.provider?.phone || 'Provider', onClick: () => goToProvider(txn.provider?.providerId || txn.provider?._id) }
                    : { name: txn.user?.name || 'Customer', sub: txn.user?.email || txn.user?.phone || 'Customer', onClick: () => goToCustomer(txn.user?.customerId || txn.user?._id) };

                  // Entry type: Credit / Debit
                  const isDebit = txn.entryType === 'debit' || ['refund', 'withdrawal', 'withdrawalrejection', 'penalty', 'commissiondeduction', 'refundrecovery', 'escrow_hold'].includes(txn.type);
                  const isCredit = !isDebit;
                  const runBalance = txn.runningBalance;
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={txn._id}
                      className={`hover:bg-indigo-50/40 transition-colors group ${isEven ? 'bg-white' : 'bg-gray-50/30'}`}
                    >
                      {/* 1. Transaction ID */}
                      <td className="p-3">
                        <span className="font-mono font-bold text-gray-800 text-[11px]" title={txnIdStr}>
                          {truncateId(txnIdStr, 18)}
                        </span>
                      </td>

                      {/* 2. Booking / Reference */}
                      <td className="p-3">
                        {bookingIdStr ? (
                          <EntityLink
                            label={bookingIdStr}
                            title={`Go to Booking ${bookingIdStr}`}
                            onClick={() => goToBooking(bookingIdStr)}
                            mono
                          />
                        ) : wdlRefStr ? (
                          <EntityLink
                            label={wdlRefStr}
                            title={`Go to Payout / Withdrawal ${wdlRefStr}`}
                            onClick={() => goToPayout(wdlRefStr)}
                            mono
                          />
                        ) : refundIdStr ? (
                          <EntityLink
                            label={refundIdStr}
                            title={`Go to Refund ${refundIdStr}`}
                            onClick={() => goToRefund(refundIdStr)}
                            mono
                          />
                        ) : txn.referenceNumber ? (
                          <span className="font-mono text-[11px] text-gray-600">{truncateId(txn.referenceNumber, 16)}</span>
                        ) : (
                          <span className="text-gray-300 font-mono text-[11px]">—</span>
                        )}
                      </td>

                      {/* 3. Party */}
                      <td className="p-3 max-w-[140px]">
                        <EntityLink
                          label={primaryParty.name}
                          title={`${primaryParty.name} (${primaryParty.sub})`}
                          onClick={primaryParty.onClick}
                          truncate
                        />
                        {primaryParty.sub && (
                          <span className="text-[10px] text-gray-400 block truncate max-w-[130px]">{primaryParty.sub}</span>
                        )}
                      </td>

                      {/* 4. Type */}
                      <td className="p-3">
                        <TypeBadge type={txn.type} paymentMethod={txn.paymentMethod} />
                      </td>

                      {/* 5. Method */}
                      <td className="p-3">
                        <MethodBadge method={txn.paymentMethod} />
                      </td>

                      {/* 6. Amount */}
                      <td className="p-3 text-right">
                        <span className="font-black text-gray-900 text-xs">
                          <PriceDisplay amount={txn.amount || 0} />
                        </span>
                      </td>

                      {/* 7. Entry (CREDIT / DEBIT) */}
                      <td className="p-3 text-center">
                        {isCredit ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                            <ArrowUpRight className="w-3 h-3" />
                            Credit
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                            <ArrowDownLeft className="w-3 h-3" />
                            Debit
                          </span>
                        )}
                      </td>

                      {/* 8. Running Balance */}
                      <td className="p-3 text-right">
                        {runBalance !== null && runBalance !== undefined ? (
                          <span className={`font-black text-xs ${runBalance >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                            <PriceDisplay amount={Math.abs(runBalance)} />
                            {runBalance < 0 && <span className="text-[10px] text-rose-400 ml-0.5">Dr</span>}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* 9. Status */}
                      <td className="p-3">
                        <StatusBadge status={txn.paymentStatus} />
                      </td>

                      {/* 10. Date */}
                      <td className="p-3 text-[11px] text-gray-500 font-medium">
                        {fmtDateTime(txn.createdAt)}
                      </td>

                      {/* 11. Action */}
                      <td className="p-3 text-center">
                        <button
                          id={`view-ledger-${txn._id}`}
                          onClick={() => handleViewDetail(txn)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 hover:bg-indigo-600 text-white rounded-lg text-[11px] font-extrabold transition-all shadow-sm cursor-pointer"
                          title="View Ledger Detail"
                        >
                          <DollarSign className="w-3 h-3" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString('en-IN')} entries
            </span>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))}
            />
          </div>
        )}
      </div>

      {/* ── Transaction Ledger Detail Modal ───────────────────────────────── */}
      <TransactionLedgerDetailModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedTxn(null);
          const params = new URLSearchParams(window.location.search);
          if (params.get('openDetail') === 'true') {
            params.delete('openDetail');
            const searchStr = params.toString();
            navigate(searchStr ? `?${searchStr}` : window.location.pathname, { replace: true });
          }
        }}
        initialData={selectedTxn}
      />
    </div>
  );
};

export default AdminTransactions;
