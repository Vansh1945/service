import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiXCircle, FiRefreshCw, FiEye, FiShield } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { fmtDate } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';
import FailedPaymentDetailModal from './components/FailedPaymentDetailModal';

const FailedPaymentsPage = () => {
  const [data, setData] = useState({ transactions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [selectedFailedPayment, setSelectedFailedPayment] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, getMergedQuery, getEntityRoute } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const abortControllerRef = useRef(null);

  const fetchFailedPayments = useCallback(async (silent = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      if (!silent) setLoading(true);
      setError(null);
      const params = getMergedQuery({ page: currentPage, limit, search: debouncedSearch });
      const res = await TransactionService.getFailedPayments(params, { signal: abortControllerRef.current.signal });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setPaginationData({
          total: res.data.data.total || res.data.data.transactions?.length || 0,
          pages: res.data.data.totalPages || 1
        });
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error("Error loading failed payments:", err);
        setError("Failed to fetch live failed payment logs.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [getMergedQuery, currentPage, limit, debouncedSearch, setPaginationData]);

  useEffect(() => {
    fetchFailedPayments();
  }, [fetchFailedPayments]);

  const handleRetryVerify = async (paymentId) => {
    try {
      setRetryingId(paymentId);
      const res = await TransactionService.adminRetryVerify(paymentId);
      if (res.data?.success) {
        fetchFailedPayments(true);
      }
    } catch (err) {
      console.error("Retry verification failed:", err);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl mr-3">
              <FiXCircle className="w-6 h-6" />
            </span>
            Failed Payment & Webhook Audit Module
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time audit log of payment gateway failures, dropped webhooks, authentication timeouts, and automated retry verification.
          </p>
        </div>
        <button
          onClick={() => fetchFailedPayments()}
          className="text-xs bg-rose-600 text-white px-4 py-2.5 rounded-xl hover:bg-rose-700 font-bold shadow-xs transition-all flex items-center gap-1.5 self-start md:self-auto"
        >
          <FiShield className="w-4 h-4" /> Refresh Failed Logs
        </button>
      </div>

      {/* 18-Column Main Failed Payments Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1500px]">
              <tbody>
                <TableSkeleton rows={6} cols={18} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 font-semibold text-sm">{error}</div>
        ) : data.transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No failed payment records found in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1500px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">Booking ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Gateway</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Failure Reason</th>
                  <th className="p-3">Error Code</th>
                  <th className="p-3">Error Description</th>
                  <th className="p-3">Gateway Order ID</th>
                  <th className="p-3">Gateway Payment ID</th>
                  <th className="p-3">Retry Count</th>
                  <th className="p-3">Last Retry Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created At</th>
                  <th className="p-3">Updated At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.transactions.map((txn) => {
                  return (
                    <tr key={txn._id} className="hover:bg-rose-50/20 transition-colors">

                      {/* 1. Transaction ID */}
                      <td className="p-3 font-mono font-bold text-rose-700">
                        <button
                          onClick={() => setSelectedFailedPayment(txn)}
                          className="hover:underline cursor-pointer"
                        >
                          {txn.transactionId || `#${txn._id.slice(-6)}`}
                        </button>
                      </td>

                      {/* 2. Booking ID */}
                      <td className="p-3 font-semibold">
                        <a
                          href={getEntityRoute('booking', txn.booking?._id || txn.bookingId || txn.booking)}
                          className="hover:underline text-blue-600 font-bold font-mono"
                        >
                          {txn.bookingIdDisplay || txn.booking?.bookingId || 'N/A'}
                        </a>
                      </td>

                      {/* 3. Customer */}
                      <td className="p-3 text-slate-800">
                        <a
                          href={getEntityRoute('customer', txn.user?._id || txn.user)}
                          className="hover:underline text-slate-800 font-semibold"
                        >
                          {txn.user?.name || 'Customer'}
                        </a>
                      </td>

                      {/* 4. Provider */}
                      <td className="p-3 text-slate-800">
                        <a
                          href={getEntityRoute('provider', txn.provider?._id || txn.provider)}
                          className="hover:underline text-slate-800 font-semibold"
                        >
                          {txn.provider?.name || 'Assigned Provider'}
                        </a>
                      </td>

                      {/* 5. Gateway */}
                      <td className="p-3 font-bold uppercase text-slate-500">
                        {txn.gateway || 'Razorpay'}
                      </td>

                      {/* 6. Amount */}
                      <td className="p-3 font-black text-slate-900">
                        <PriceDisplay amount={txn.amount || 0} />
                      </td>

                      {/* 7. Payment Method */}
                      <td className="p-3 uppercase text-slate-600 font-semibold">
                        {txn.paymentMethod || 'online'}
                      </td>

                      {/* 8. Failure Reason */}
                      <td className="p-3 text-rose-700 font-semibold truncate max-w-[140px]" title={txn.failureReason}>
                        {txn.failureReason || 'Gateway Declined'}
                      </td>

                      {/* 9. Error Code */}
                      <td className="p-3 font-mono text-slate-500 text-[11px]">
                        {txn.errorCode || 'BAD_REQUEST_ERROR'}
                      </td>

                      {/* 10. Error Description */}
                      <td className="p-3 text-slate-500 truncate max-w-[180px]" title={txn.errorDescription}>
                        {txn.errorDescription || 'Payment processing failed at bank gateway'}
                      </td>

                      {/* 11. Gateway Order ID */}
                      <td className="p-3 font-mono text-slate-500 text-[11px]">
                        {txn.gatewayOrderId || 'order_N/A'}
                      </td>

                      {/* 12. Gateway Payment ID */}
                      <td className="p-3 font-mono text-slate-500 text-[11px]">
                        {txn.gatewayPaymentId || 'pay_N/A'}
                      </td>

                      {/* 13. Retry Count */}
                      <td className="p-3 font-mono text-slate-700 font-bold text-center">
                        {txn.retryCount || 0}
                      </td>

                      {/* 14. Last Retry Date */}
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {txn.lastRetryDate ? fmtDate(txn.lastRetryDate) : 'Never'}
                      </td>

                      {/* 15. Status */}
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-extrabold uppercase">
                          FAILED
                        </span>
                      </td>

                      {/* 16. Created At */}
                      <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(txn.createdAt)}</td>

                      {/* 17. Updated At */}
                      <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(txn.updatedAt || txn.createdAt)}</td>

                      {/* 18. Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRetryVerify(txn._id)}
                            disabled={retryingId === txn._id}
                            className="inline-flex items-center px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <FiRefreshCw className={`mr-1 ${retryingId === txn._id ? 'animate-spin' : ''}`} />
                            {retryingId === txn._id ? 'Verifying...' : 'Retry Verify'}
                          </button>
                          <button
                            onClick={() => setSelectedFailedPayment(txn)}
                            className="inline-flex items-center px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-700 hover:text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            <FiEye className="mr-1" /> View Details
                          </button>
                        </div>
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

      {/* Failed Payment Detail Modal */}
      <FailedPaymentDetailModal
        isOpen={!!selectedFailedPayment}
        onClose={() => setSelectedFailedPayment(null)}
        entityData={selectedFailedPayment}
      />
    </div>
  );
};

export default FailedPaymentsPage;
