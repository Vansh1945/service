import React, { useState, useEffect } from 'react';
import { FiXCircle, FiRefreshCw, FiAlertTriangle, FiEye } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';

const FailedPaymentsPage = () => {
  const [data, setData] = useState({ transactions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [retryingId, setRetryingId] = useState(null);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();

  const fetchFailedPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page, limit: 10, search: searchQuery });
      const res = await TransactionService.getFailedPayments(params);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setTotalPages(res.data.data.totalPages || 1);
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
  }, [page, searchQuery]);

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
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <span className="p-2 bg-red-50 text-red-600 rounded-xl mr-3">
              <FiXCircle className="w-6 h-6" />
            </span>
            Failed Payments & Exception Handling (Live Data)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Audit gateway payment drop-offs, signature failures, timeout exceptions, and initiate automated retry verifications.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">


        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} columns={6} /></div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 font-semibold text-sm">{error}</div>
        ) : data.transactions.length === 0 ? (
          <div className="p-12 text-center text-emerald-600 font-bold text-sm">
            Awesome! Zero failed payments found in live database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-3.5">Transaction ID</th>
                  <th className="p-3.5">Booking ID</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Razorpay Order ID</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.transactions.map((txn) => (
                  <tr key={txn._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3.5 font-mono text-xs font-semibold text-red-600">
                      <button
                        onClick={() => openInvestigationDrawer('payment', txn._id, txn)}
                        className="hover:underline font-bold"
                      >
                        {txn.transactionId || `#${txn._id.slice(-6)}`}
                      </button>
                    </td>
                    <td className="p-3.5 text-xs font-semibold text-gray-800">
                      <button
                        onClick={() => openInvestigationDrawer('booking', txn.booking?.bookingId || txn.bookingId || txn.booking?._id, txn.booking)}
                        className="hover:underline font-bold text-blue-600"
                      >
                        {txn.booking?.bookingId || txn.bookingId || 'N/A'}
                      </button>
                    </td>
                    <td className="p-3.5 text-xs text-gray-800">
                      {txn.user?.name || 'Customer'}
                    </td>
                    <td className="p-3.5 font-bold text-gray-900">
                      <PriceDisplay amount={txn.amount} />
                    </td>
                    <td className="p-3.5 font-mono text-xs text-gray-500">
                      {txn.razorpayOrderId || 'N/A'}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleRetryVerify(txn._id)}
                        disabled={retryingId === txn._id}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors disabled:opacity-50"
                      >
                        <FiRefreshCw className={`mr-1.5 ${retryingId === txn._id ? 'animate-spin' : ''}`} /> 
                        {retryingId === txn._id ? 'Verifying...' : 'Retry Verify'}
                      </button>

                      <button
                        onClick={() => openInvestigationDrawer('payment', txn._id, txn)}
                        className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-800 hover:text-white rounded-lg text-xs font-bold transition-all"
                      >
                        <FiEye className="mr-1.5" /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex justify-end">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
};

export default FailedPaymentsPage;
