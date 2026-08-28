import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiZap, FiCheckCircle, FiClock, FiEye, FiShield } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { fmtDate } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';
import RazorpayPaymentDetailModal from './components/RazorpayPaymentDetailModal';

const RazorpayManagementPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRazorpay, setSelectedRazorpay] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, getMergedQuery, getEntityRoute } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const abortControllerRef = useRef(null);

  const fetchRazorpayLogs = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({
        page: currentPage,
        limit,
        paymentMethod: 'razorpay',
        search: debouncedSearch
      });
      const res = await TransactionService.getAllTransactions(params, { signal: abortControllerRef.current.signal });
      if (res.data?.success) {
        const list = res.data.data.transactions || res.data.data || [];
        setTransactions(list);
        setPaginationData({
          total: res.data.data.total || res.data.total || list.length,
          pages: res.data.data.totalPages || res.data.totalPages || 1
        });
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error("Razorpay logs fetch error:", err);
        setError("Failed to fetch live Razorpay transaction logs.");
      }
    } finally {
      setLoading(false);
    }
  }, [getMergedQuery, currentPage, limit, debouncedSearch, setPaginationData]);

  useEffect(() => {
    fetchRazorpayLogs();
  }, [fetchRazorpayLogs]);

  const [syncing, setSyncing] = useState(false);

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      await TransactionService.syncRazorpayAll();
      await fetchRazorpayLogs();
    } catch (err) {
      console.error("Razorpay Sync Error:", err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl mr-3">
              <FiZap className="w-6 h-6" />
            </span>
            Razorpay Payment Gateway Console
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time Razorpay telemetry tracking order creation, signature validation, payment IDs, bank RRN references, and webhook events.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="text-xs bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <FiZap className="w-4 h-4" /> {syncing ? 'Syncing Gateway...' : 'Sync All Gateway Data'}
          </button>
          <button
            onClick={fetchRazorpayLogs}
            className="text-xs bg-blue-700 text-white px-4 py-2.5 rounded-xl hover:bg-blue-800 font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FiShield className="w-4 h-4" /> Refresh Gateway Logs
          </button>
        </div>
      </div>

      {/* 14-Column Razorpay Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1300px]">
              <tbody>
                <TableSkeleton rows={6} cols={14} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 font-semibold text-sm">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No Razorpay transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1300px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3">Razorpay Payment ID</th>
                  <th className="p-3">Booking ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Sub-Method</th>
                  <th className="p-3">Bank</th>
                  <th className="p-3">Gross Amount</th>
                  <th className="p-3">Refund Amount</th>
                  <th className="p-3">Settlement</th>
                  <th className="p-3">Gateway Status</th>
                  <th className="p-3">Payment Status</th>
                  <th className="p-3">Created Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transactions.map((txn) => {
                  const payId = txn.razorpayPaymentId || txn.paymentId || txn.transactionId || `#${txn._id.slice(-6)}`;
                  const gross = txn.amount || txn.grossAmount || txn.booking?.totalAmount || 0;
                  const refundAmt = txn.refundAmount || 0;
                  const subMethod = txn.paymentSubMethod || txn.subMethod || (txn.paymentMethod === 'razorpay' ? 'UPI / Card' : 'Online');
                  const bank = txn.bank || txn.bankName || 'Razorpay Gateway';
                  const pMethod = (txn.paymentMethod || '').toLowerCase();
                  const isCash = pMethod === 'cash' || pMethod === 'cod';

                  const gatewayStatus = isCash ? 'N/A' : (txn.gatewayStatus || txn.razorpayStatus || txn.paymentStatus || 'created');
                  const settlementStatus = isCash ? 'N/A' : (txn.settlementStatus || (txn.razorpaySettlementId ? 'Settled' : 'Pending'));

                  return (
                    <tr key={txn._id} className="hover:bg-blue-50/20 transition-colors">

                      {/* 1. Payment ID */}
                      <td className="p-3 font-mono font-bold text-blue-700">
                        <button
                          onClick={() => setSelectedRazorpay(txn)}
                          className="hover:underline cursor-pointer"
                        >
                          {payId}
                        </button>
                      </td>

                      {/* 2. Booking ID */}
                      <td className="p-3 font-bold text-slate-900">
                        <a
                          href={getEntityRoute('booking', txn.booking?._id || txn.booking)}
                          className="text-blue-600 hover:underline font-mono"
                        >
                          {txn.booking?.bookingId || txn.bookingId || 'N/A'}
                        </a>
                      </td>

                      {/* 3. Customer */}
                      <td className="p-3 font-semibold text-slate-800">
                        <a
                          href={getEntityRoute('customer', txn.user?._id || txn.user)}
                          className="hover:underline text-slate-900 font-bold"
                        >
                          {txn.user?.name || 'Customer'}
                        </a>
                      </td>

                      {/* 4. Provider */}
                      <td className="p-3 font-semibold text-slate-800">
                        <a
                          href={getEntityRoute('provider', txn.provider?._id || txn.provider)}
                          className="hover:underline text-slate-900 font-bold"
                        >
                          {txn.provider?.name || 'Provider'}
                        </a>
                      </td>

                      {/* 5. Payment Method */}
                      <td className="p-3 font-bold uppercase text-slate-700">
                        {txn.paymentMethod || 'Razorpay'}
                      </td>

                      {/* 6. Sub-Method */}
                      <td className="p-3 font-semibold text-primary">
                        <span className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[11px] font-bold">
                          {subMethod}
                        </span>
                      </td>

                      {/* 7. Bank */}
                      <td className="p-3 text-slate-700 font-medium">{bank}</td>

                      {/* 8. Gross Amount */}
                      <td className="p-3 font-black text-slate-900 text-sm">
                        <PriceDisplay amount={gross} />
                      </td>

                      {/* 9. Refund Amount */}
                      <td className="p-3 font-bold text-rose-600">
                        <PriceDisplay amount={refundAmt} />
                      </td>

                      {/* 10. Settlement Status */}
                      <td className="p-3 font-bold text-emerald-600">
                        <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-extrabold uppercase">
                          {settlementStatus}
                        </span>
                      </td>

                      {/* 11. Gateway Status */}
                      <td className="p-3 font-bold text-blue-600">
                        <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-extrabold uppercase">
                          {gatewayStatus}
                        </span>
                      </td>

                      {/* 12. Payment Status */}
                      <td className="p-3">
                        {['success', 'completed'].includes(txn.paymentStatus) ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-extrabold uppercase">
                            <FiCheckCircle className="mr-1" /> SUCCESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-extrabold uppercase">
                            <FiClock className="mr-1" /> PENDING
                          </span>
                        )}
                      </td>

                      {/* 13. Created Date */}
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {fmtDate(txn.createdAt)}
                      </td>

                      {/* 14. Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedRazorpay(txn)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          <FiEye className="mr-1.5" /> View Details
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
          <div className="border-t border-slate-100 flex justify-end">
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

      {/* Razorpay Detail Modal */}
      <RazorpayPaymentDetailModal
        isOpen={!!selectedRazorpay}
        onClose={() => setSelectedRazorpay(null)}
        entityData={selectedRazorpay}
      />
    </div>
  );
};

export default RazorpayManagementPage;
