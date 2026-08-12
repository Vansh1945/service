import React, { useState, useEffect } from 'react';
import { FiXCircle, FiRefreshCw, FiEye, FiShield } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { fmtDate } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';

const FailedPaymentsPage = () => {
  const [data, setData] = useState({ transactions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchFailedPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page: currentPage, limit, search: debouncedSearch });
      const res = await TransactionService.getFailedPayments(params);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setPaginationData({
          total: res.data.data.total || res.data.data.transactions?.length || 0,
          pages: res.data.data.totalPages || 1
        });
      }
    } catch (err) {
      console.error("Error loading failed payments:", err);
      setError("Failed to fetch live failed payment records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFailedPayments();
  }, [currentPage, limit, debouncedSearch]);

  const handleRetryVerify = async (id) => {
    try {
      setRetryingId(id);
      const res = await TransactionService.adminRetryVerify(id);
      if (res.data?.success) {
        alert("Payment verified and reconciled successfully!");
        fetchFailedPayments();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to retry verification with Razorpay.");
    } fontally: {
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
            Payment Failure & Diagnostic Console
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Centralized audit of all failed payment attempts across Razorpay (UPI, Card, Netbanking, Wallet, EMI, PayLater), Wallet, and Mixed payments.
          </p>
        </div>
        <button
          onClick={fetchFailedPayments}
          className="text-xs bg-rose-700 text-white px-4 py-2.5 rounded-xl hover:bg-rose-800 font-bold shadow-xs transition-all flex items-center gap-1.5 self-start md:self-auto"
        >
          <FiShield className="w-4 h-4" /> Refresh Failure Log
        </button>
      </div>

      {/* Exact 18-Column Failed Payment Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1700px]">
              <tbody>
                <TableSkeleton rows={6} cols={18} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 font-semibold text-sm">{error}</div>
        ) : data.transactions.length === 0 ? (
          <div className="p-12 text-center text-emerald-600 font-bold text-sm">
            Awesome! Zero failed payment attempts recorded in live database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1700px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3">Payment ID</th>
                  <th className="p-3">Booking ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Payment Type</th>
                  <th className="p-3">Gateway</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Gateway Status</th>
                  <th className="p-3">Failure Reason</th>
                  <th className="p-3">Gateway Error Code</th>
                  <th className="p-3">Gateway Error Description</th>
                  <th className="p-3">Retry Count</th>
                  <th className="p-3">Retry Available</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created At</th>
                  <th className="p-3">Updated At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.transactions.map((txn) => {
                  const pid = txn.paymentIdDisplay || txn.razorpayPaymentId || txn.transactionId || `#${txn._id.slice(-6)}`;
                  const bid = txn.bookingIdDisplay || txn.booking?.bookingId || txn.bookingId || 'N/A';
                  const custName = txn.customerName || txn.user?.name || 'Customer';
                  const provName = txn.providerName || txn.provider?.name || 'Unassigned';
                  const method = txn.methodDisplay || txn.paymentMethod || 'online';
                  const type = txn.typeDisplay || txn.type || 'payment';
                  const gateway = txn.gatewayDisplay || (method === 'wallet' ? 'Wallet' : 'Razorpay');
                  const amount = txn.amountDisplay || txn.amount || 0;
                  const gatewayStatus = txn.gatewayStatusDisplay || 'failed';
                  const failureReason = txn.failureReasonDisplay || 'Payment captured failed / drop-off';
                  const errorCode = txn.errorCodeDisplay || 'BAD_REQUEST_ERROR';
                  const errorDesc = txn.errorDescriptionDisplay || 'Payment verification failed at gateway stage';
                  const retryCount = txn.retryCountDisplay || 1;

                  return (
                    <tr key={txn._id} className="hover:bg-rose-50/20 transition-colors">

                      {/* 1. Payment ID */}
                      <td className="p-3 font-mono font-bold text-rose-700">
                        <button
                          onClick={() => openInvestigationDrawer('failed_payment', txn._id, txn)}
                          className="hover:underline"
                        >
                          {pid}
                        </button>
                      </td>

                      {/* 2. Booking ID */}
                      <td className="p-3 font-bold text-slate-900">
                        <button
                          onClick={() => openInvestigationDrawer('booking', txn.booking?._id || txn.booking)}
                          className="text-blue-600 hover:underline font-mono"
                        >
                          {bid}
                        </button>
                      </td>

                      {/* 3. Customer */}
                      <td className="p-3 font-bold text-slate-800">
                        <button
                          onClick={() => openInvestigationDrawer('customer', txn.user?._id || txn.user)}
                          className="hover:underline text-slate-900"
                        >
                          {custName}
                        </button>
                      </td>

                      {/* 4. Provider */}
                      <td className="p-3 font-semibold text-slate-700">
                        <button
                          onClick={() => openInvestigationDrawer('provider', txn.provider?._id || txn.provider)}
                          className="hover:underline text-slate-800"
                        >
                          {provName}
                        </button>
                      </td>

                      {/* 5. Payment Method */}
                      <td className="p-3 font-bold uppercase text-slate-700">{method}</td>

                      {/* 6. Payment Type */}
                      <td className="p-3 font-mono uppercase text-slate-500">{type}</td>

                      {/* 7. Gateway */}
                      <td className="p-3 font-bold uppercase text-slate-600">{gateway}</td>

                      {/* 8. Amount */}
                      <td className="p-3 font-black text-slate-900 text-sm">
                        <PriceDisplay amount={amount} />
                      </td>

                      {/* 9. Gateway Status */}
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-extrabold uppercase">
                          {gatewayStatus}
                        </span>
                      </td>

                      {/* 10. Failure Reason */}
                      <td className="p-3 text-rose-700 font-semibold max-w-[200px] truncate" title={failureReason}>
                        {failureReason}
                      </td>

                      {/* 11. Gateway Error Code */}
                      <td className="p-3 font-mono text-slate-700 font-bold">{errorCode}</td>

                      {/* 12. Gateway Error Description */}
                      <td className="p-3 text-slate-500 max-w-[200px] truncate" title={errorDesc}>
                        {errorDesc}
                      </td>

                      {/* 13. Retry Count */}
                      <td className="p-3 font-mono font-bold text-slate-800 text-center">{retryCount}</td>

                      {/* 14. Retry Available */}
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-extrabold uppercase">
                          YES
                        </span>
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
                            className="inline-flex items-center px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                          >
                            <FiRefreshCw className={`mr-1 ${retryingId === txn._id ? 'animate-spin' : ''}`} />
                            {retryingId === txn._id ? 'Verifying...' : 'Retry Verify'}
                          </button>
                          <button
                            onClick={() => openInvestigationDrawer('failed_payment', txn._id, txn)}
                            className="inline-flex items-center px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-700 hover:text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
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
    </div>
  );
};

export default FailedPaymentsPage;
