import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  FiCreditCard,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiEye,
  FiRefreshCw,
  FiFilter,
  FiX,
  FiExternalLink,
  FiRotateCcw,
  FiAlertCircle,
  FiZap
} from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import EmptyState from '../../../components/ui/EmptyState';
import Button from '../../../components/ui/Button';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import PaymentViewDetailModal from './components/PaymentViewDetailModal';
import { fmtDate, fmtDateTime } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';

const PaymentManagementPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeSection, setActiveSection] = useState(searchParams.get('section') || 'all');
  const [verificationFilter, setVerificationFilter] = useState('all');

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  // Modal state — dedicated Payment Detail Modal (not the generic investigation drawer)
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);

  const urlMethod = searchParams.get('method') || location.state?.methodFilter || location.state?.method;
  const urlStatus = searchParams.get('status') || location.state?.statusFilter || location.state?.status;
  const urlType = searchParams.get('type') || location.state?.typeFilter;

  const {
    searchQuery,
    paymentMethod,
    openInvestigationDrawer,
    getMergedQuery,
    refresh
  } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page: currentPage, limit, search: debouncedSearch });

      if (urlMethod) params.paymentMethod = urlMethod;
      if (urlStatus) params.status = urlStatus;

      const response = await TransactionService.getAllTransactions(params);
      if (response.data?.success) {
        const rawPayments = response.data.data?.transactions || response.data.data || [];

        // Deduplicate — one payment record per unique key
        const uniquePayments = [];
        const seenIds = new Set();
        rawPayments.forEach((txn) => {
          const key = txn.razorpayPaymentId || txn.transactionId || txn._id;
          if (key && !seenIds.has(key)) {
            seenIds.add(key);
            uniquePayments.push(txn);
          }
        });

        setPayments(uniquePayments);
        setPaginationData({
          total: response.data.data?.total || response.data.total || uniquePayments.length,
          pages: response.data.data?.totalPages || response.data.pages || response.data.totalPages || 1
        });
      }
    } catch (err) {
      console.error('Error loading payments:', err);
      setError('Failed to load payment records.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, paymentMethod, debouncedSearch, urlMethod, urlStatus, urlType, getMergedQuery, setPaginationData]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const [autoOpened, setAutoOpened] = useState(false);

  useEffect(() => {
    if (searchParams.get('openDetail') === 'true' && payments.length > 0 && !modalOpen && !autoOpened) {
      const searchVal = searchParams.get('search');
      const target = payments.find(p =>
        p.razorpayPaymentId === searchVal ||
        p.transactionId === searchVal ||
        p._id === searchVal ||
        p.bookingId === searchVal ||
        p.booking?.bookingId === searchVal
      ) || payments[0];
      if (target) {
        setSelectedTxn(target);
        setModalOpen(true);
        setAutoOpened(true);
      }
    }
  }, [searchParams, payments, modalOpen, autoOpened]);

  const handleClearUrlFilters = () => {
    setSearchParams({});
    navigate('/admin/payments', { replace: true, state: {} });
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTxn(null);
    if (searchParams.get('openDetail') === 'true') {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('openDetail');
      setSearchParams(newParams, { replace: true });
    }
  };

  // Open the dedicated Payment Detail Modal (lazy-loads full details)
  const handleOpenDetail = (txn) => {
    setSelectedTxn(txn);
    setModalOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Badge / display helpers — pure display, no financial calculations
  // ─────────────────────────────────────────────────────────────────────────────

  const getPaymentTypeBadge = (txn) => {
    const method = (txn.paymentMethod || '').toLowerCase();
    const configs = {
      mixed: { cls: 'bg-primary/10 text-primary border-primary/20', label: 'Mixed' },
      wallet: { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Wallet' },
      cash: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Cash' },
      cod: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Cash' },
    };
    const cfg = configs[method] || { cls: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Online' };
    return (
      <span className={`px-2.5 py-0.5 ${cfg.cls} border rounded-md text-[10px] font-extrabold uppercase tracking-wider`}>
        {cfg.label}
      </span>
    );
  };

  const getPaymentMethodBadge = (txn) => {
    const method = (txn.paymentMethod || '').toLowerCase();
    // Use real Razorpay method from stored response whenever available
    const razorpayMethod = (txn.razorpayResponse?.method || txn.gatewayMethod || '').toLowerCase();

    if (method === 'cash' || method === 'cod') {
      return <span className="text-xs font-semibold text-emerald-800">Cash on Delivery</span>;
    }
    if (method === 'wallet') {
      return <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[11px]">Customer Wallet</span>;
    }

    // Online / Mixed — show real Razorpay sub-method
    let label = 'UPI';
    if (razorpayMethod === 'card' || razorpayMethod === 'credit_card' || razorpayMethod === 'debit_card') label = 'Card';
    else if (razorpayMethod === 'netbanking') label = 'NetBanking';
    else if (razorpayMethod === 'wallet') label = 'Gateway Wallet';
    else if (razorpayMethod === 'emi') label = 'EMI';
    else if (razorpayMethod === 'paylater') label = 'PayLater';
    else if (razorpayMethod === 'upi') label = 'UPI';
    else if (method === 'mixed') label = 'Mixed';

    const colorMap = {
      UPI: 'bg-indigo-100 text-indigo-800',
      Card: 'bg-blue-100 text-blue-800',
      NetBanking: 'bg-cyan-100 text-cyan-800',
      'Gateway Wallet': 'bg-orange-100 text-orange-800',
      EMI: 'bg-rose-100 text-rose-800',
      PayLater: 'bg-pink-100 text-pink-800',
      Mixed: 'bg-purple-100 text-purple-800',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 ${colorMap[label] || 'bg-blue-100 text-blue-800'} rounded font-bold text-[11px] uppercase`}>
        {label}
      </span>
    );
  };

  const getGatewayLabel = (txn) => {
    const method = (txn.paymentMethod || '').toLowerCase();
    if (method === 'cash' || method === 'cod') return 'COD Direct';
    if (method === 'wallet') return 'Platform Wallet';
    if (method === 'mixed') return 'Razorpay + Wallet';
    return 'Razorpay';
  };

  const getPaymentStatusBadge = (txn) => {
    const s = (txn.paymentStatus || txn.status || '').toLowerCase();
    if (['success', 'completed', 'paid', 'captured'].includes(s))
      return <span className="inline-flex items-center px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase"><FiCheckCircle className="mr-1 w-3 h-3" />Success</span>;
    if (['pending', 'processing', 'authorized'].includes(s))
      return <span className="inline-flex items-center px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold uppercase"><FiClock className="mr-1 w-3 h-3" />Pending</span>;
    if (['refunded', 'partial_refund'].includes(s))
      return <span className="inline-flex items-center px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold uppercase"><FiRotateCcw className="mr-1 w-3 h-3" />Refunded</span>;
    return <span className="inline-flex items-center px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold uppercase"><FiXCircle className="mr-1 w-3 h-3" />Failed</span>;
  };

  const getCaptureStatusBadge = (txn) => {
    const s = (txn.paymentStatus || '').toLowerCase();
    if (['success', 'completed', 'paid'].includes(s))
      return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">Captured</span>;
    if (s === 'failed')
      return <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px] uppercase">Failed</span>;
    return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px] uppercase">Authorized</span>;
  };

  const getSettlementStatusBadge = (txn) => {
    const s = (txn.settlementStatus || '').toLowerCase();
    if (['settled', 'completed'].includes(s))
      return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px] uppercase">Settled</span>;
    if (['queued', 'processing'].includes(s))
      return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px] uppercase">Processing</span>;
    if (['failed', 'reversed'].includes(s))
      return <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px] uppercase">Failed</span>;
    if (['refunded', 'partial_refund'].includes(s))
      return <span className="px-2 py-0.5 bg-primary/10 text-primary rounded font-bold text-[10px] uppercase">Refunded</span>;
    // For wallet/cash — no gateway settlement
    const method = (txn.paymentMethod || '').toLowerCase();
    if (method === 'wallet' || method === 'cash') return <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded font-bold text-[10px] uppercase">N/A</span>;
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-bold text-[10px] uppercase">—</span>;
  };

  // Format INR amounts from booking fields (already in rupees — no paise conversion needed)
  const formatAmount = (amount) => {
    if (!amount && amount !== 0) return '—';
    if (amount === 0) return <span className="text-gray-400 font-normal">₹0</span>;
    return <PriceDisplay amount={amount} />;
  };



  return (
    <div className="space-y-5">
      {/* ── Header Banner ──────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-wider rounded-md border border-emerald-200">
              Master Ledger
            </span>
            <span className="text-xs text-gray-400 font-medium">Customer Payment Tracking Console</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center mt-1">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl mr-3">
              <FiCreditCard className="w-6 h-6" />
            </span>
            Payment Management
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
            {payments.length} Records
          </span>
          <button
            onClick={() => refresh(fetchPayments, setLoading)}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
            title="Refresh"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Pre-filtered Banner from Finance Dashboard ──────────────────── */}
      {(urlMethod || urlStatus || urlType) && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-semibold text-primary">
            <FiFilter className="w-4 h-4" />
            <span>Pre-filtered from Dashboard:</span>
            {urlMethod && <span className="px-2.5 py-0.5 bg-primary/10 text-primary font-bold uppercase rounded-md border border-primary/20">Method: {urlMethod}</span>}
            {urlStatus && <span className="px-2.5 py-0.5 bg-danger/10 text-danger font-bold uppercase rounded-md border border-danger/20">Status: {urlStatus}</span>}
            {urlType && <span className="px-2.5 py-0.5 bg-primary/10 text-primary font-bold uppercase rounded-md border border-primary/20">Type: {urlType}</span>}
          </div>
          <button
            onClick={handleClearUrlFilters}
            className="flex items-center space-x-1 text-xs text-neutral-500 hover:text-neutral-900 font-bold px-2 py-1 bg-white border border-neutral-200 rounded-lg shadow-xs hover:bg-neutral-50 cursor-pointer"
          >
            <FiX className="w-3.5 h-3.5" /><span>Clear</span>
          </button>
        </div>
      )}

      {/* ── Payment Records Table ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} columns={12} standalone />
        ) : error ? (
          <div className="p-10 text-center">
            <FiAlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <p className="text-rose-600 font-semibold text-sm">{error}</p>
            <button onClick={fetchPayments} className="mt-3 px-4 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold cursor-pointer hover:bg-rose-100">Retry</button>
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={FiCreditCard}
            title="No Payment Records Found"
            description="No payment records matched your selected filters or search parameters."
            action={
              <Button variant="outline" size="sm" onClick={handleClearUrlFilters}>
                Clear Filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-200">
            <table className="w-full text-left text-xs text-gray-600 min-w-[1200px]">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">Booking / Reference</th>
                  <th className="p-3.5 whitespace-nowrap">Payment ID</th>
                  <th className="p-3.5 whitespace-nowrap">Customer</th>
                  <th className="p-3.5 whitespace-nowrap">Provider</th>
                  <th className="p-3.5 whitespace-nowrap">Type</th>
                  <th className="p-3.5 whitespace-nowrap">Method</th>
                  <th className="p-3.5 whitespace-nowrap">Gateway</th>
                  <th className="p-3.5 whitespace-nowrap text-right">Amount</th>
                  <th className="p-3.5 whitespace-nowrap">Status</th>
                  <th className="p-3.5 whitespace-nowrap">Capture</th>
                  <th className="p-3.5 whitespace-nowrap">Settlement</th>
                  <th className="p-3.5 whitespace-nowrap">Date</th>
                  <th className="p-3.5 whitespace-nowrap text-center">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((txn) => {
                  const booking = txn.booking || {};
                  const bookingIdStr = booking.bookingId || (txn.bookingId && !txn.bookingId.startsWith('WDL-') ? txn.bookingId : null);
                  const paymentIdStr = txn.razorpayPaymentId || txn.transactionId || `TXN-${String(txn._id).slice(-8).toUpperCase()}`;
                  const customerName = txn.user?.name || (typeof txn.user === 'string' ? txn.user : '—');
                  const providerName = txn.provider?.name || (typeof txn.provider === 'string' ? txn.provider : null);

                  return (
                    <tr key={txn._id} className="hover:bg-slate-50/60 transition-colors group">

                      {/* 1. Booking / Reference */}
                      <td className="p-3.5 whitespace-nowrap">
                        {bookingIdStr ? (
                          <button
                            onClick={() => navigate(`/admin/bookings?search=${encodeURIComponent(bookingIdStr)}&openDetail=true`)}
                            className="font-mono font-bold text-blue-600 text-xs hover:underline flex items-center gap-1 group/link cursor-pointer"
                            title={`View Booking ${bookingIdStr}`}
                          >
                            {bookingIdStr}
                            <FiExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </button>
                        ) : txn.referenceNumber ? (
                          <span className="font-mono text-xs text-slate-500 font-semibold">{txn.referenceNumber}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>

                      {/* 2. Payment ID */}
                      <td className="p-3.5 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenDetail(txn)}
                          className="font-mono text-xs font-bold text-gray-800 hover:text-blue-600 max-w-[130px] block truncate cursor-pointer text-left"
                          title={paymentIdStr}
                        >
                          {paymentIdStr}
                        </button>
                      </td>

                      {/* 3. Customer */}
                      <td className="p-3.5 max-w-[140px]">
                        {customerName !== '—' ? (
                          <>
                            <button
                              onClick={() => navigate(`/admin/customers?search=${encodeURIComponent(customerName)}&openDetail=true`)}
                              className="text-left font-bold text-gray-900 text-xs hover:text-blue-600 transition-colors truncate block cursor-pointer"
                              title={customerName}
                            >
                              {customerName}
                            </button>
                            {txn.user?.email && (
                              <span className="text-[10px] text-gray-400 truncate block">{txn.user.email}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 text-xs">N/A</span>
                        )}
                      </td>

                      {/* 4. Provider */}
                      <td className="p-3.5 max-w-[130px]">
                        {providerName ? (
                          <button
                            onClick={() => navigate(`/admin/approve-providers?search=${encodeURIComponent(providerName)}&openDetail=true`)}
                            className="text-left font-semibold text-gray-800 text-xs hover:text-blue-600 transition-colors truncate block cursor-pointer"
                            title={providerName}
                          >
                            {providerName}
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Not Assigned</span>
                        )}
                      </td>

                      {/* 5. Payment Type */}
                      <td className="p-3.5 whitespace-nowrap">
                        {getPaymentTypeBadge(txn)}
                      </td>

                      {/* 6. Payment Method */}
                      <td className="p-3.5 whitespace-nowrap">
                        {getPaymentMethodBadge(txn)}
                      </td>

                      {/* 7. Gateway */}
                      <td className="p-3.5 text-xs font-medium text-gray-600 whitespace-nowrap">
                        {getGatewayLabel(txn)}
                      </td>

                      {/* 8. Amount (Authoritative from Backend) */}
                      <td className="p-3.5 whitespace-nowrap text-right">
                        <span className="font-black text-gray-900 text-xs">
                          <PriceDisplay amount={txn.amount || booking.totalAmount || 0} />
                        </span>
                      </td>

                      {/* 9. Payment Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        {getPaymentStatusBadge(txn)}
                      </td>

                      {/* 10. Capture Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        {getCaptureStatusBadge(txn)}
                      </td>

                      {/* 11. Settlement Status */}
                      <td className="p-3.5 whitespace-nowrap">
                        {getSettlementStatusBadge(txn)}
                      </td>

                      {/* 12. Date */}
                      <td className="p-3.5 text-xs text-gray-500 font-medium whitespace-nowrap">
                        {fmtDateTime(txn.createdAt)}
                      </td>

                      {/* 13. Details */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleOpenDetail(txn)}
                          id={`view-payment-${txn._id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-blue-600 text-white rounded-lg text-[11px] font-extrabold transition-all shadow-xs cursor-pointer group/btn"
                          title="View Payment Details"
                        >
                          <FiEye className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
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

        {totalPages > 1 && (
          <div className="border-t border-gray-100 flex justify-end">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              limit={limit}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </div>

      {/* ── Payment Detail Modal ─────────────────────────────────────────── */}
      <PaymentViewDetailModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        initialData={selectedTxn}
      />
    </div>
  );
};

export default PaymentManagementPage;
