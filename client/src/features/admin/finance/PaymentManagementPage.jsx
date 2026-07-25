import React, { useState, useEffect } from 'react';
import { FiCreditCard, FiCheckCircle, FiClock, FiXCircle, FiEye } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';

const PaymentManagementPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const {
    getMergedQuery,
    openInvestigationDrawer,
    paymentMethod,
    setPaymentMethod,
    searchQuery
  } = useAdminFilter();

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page, limit: 10 });
      const response = await TransactionService.getAllTransactions(params);
      if (response.data?.success) {
        setPayments(response.data.data.transactions || response.data.data || []);
        setTotalPages(response.data.data.totalPages || response.data.pages || response.data.totalPages || 1);
      }
    } catch (err) {
      console.error("Error loading payments:", err);
      setError("Failed to load real payment records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [page, paymentMethod, searchQuery]);

  const getMethodBadge = (method) => {
    switch (method?.toLowerCase()) {
      case 'razorpay':
      case 'online':
        return <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">Online (Razorpay)</span>;
      case 'cash':
      case 'cod':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-semibold">Cash (COD)</span>;
      case 'wallet':
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-semibold">Wallet</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-50 text-gray-700 rounded text-xs font-semibold">{method || 'Mixed'}</span>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'completed':
      case 'paid':
      case 'captured':
        return <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-bold"><FiCheckCircle className="mr-1" /> CAPTURED</span>;
      case 'pending':
      case 'processing':
        return <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold"><FiClock className="mr-1" /> PENDING</span>;
      case 'failed':
        return <span className="inline-flex items-center px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-bold"><FiXCircle className="mr-1" /> FAILED</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 bg-gray-50 text-gray-700 rounded-full text-xs font-bold">{status?.toUpperCase() || 'UNKNOWN'}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl mr-3">
              <FiCreditCard className="w-6 h-6" />
            </span>
            Payment Management (Live Records)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Connected payment investigation console. Click any record to audit complete financial flow.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">


        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} columns={7} /></div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 font-semibold text-sm">{error}</div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No live payment transactions found in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-3.5">Booking / Transaction ID</th>
                  <th className="p-3.5">Customer / Provider</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Razorpay Ref / ID</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((txn) => {
                  const bId = txn.booking?.bookingId || txn.booking?._id || txn.transactionId || `#${txn._id.slice(-6)}`;
                  return (
                    <tr key={txn._id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3.5">
                        <button
                          onClick={() => openInvestigationDrawer('payment', txn._id, txn)}
                          className="font-semibold text-blue-600 font-mono text-xs hover:underline flex items-center"
                        >
                          {bId}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-gray-800 text-xs">
                          {txn.user?.name || txn.customer?.name || 'Customer'}
                        </div>
                        {txn.provider?.name && (
                          <div className="text-[11px] text-gray-400">
                            -&gt; {txn.provider.name}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">{getMethodBadge(txn.paymentMethod)}</td>
                      <td className="p-3.5 font-bold text-gray-900">
                        <PriceDisplay amount={txn.amount} />
                      </td>
                      <td className="p-3.5 text-xs font-mono text-gray-500">
                        {txn.razorpayPaymentId ? (
                          <button
                            onClick={() => openInvestigationDrawer('payment', txn.razorpayPaymentId, txn)}
                            className="text-emerald-700 hover:underline font-bold"
                          >
                            {txn.razorpayPaymentId}
                          </button>
                        ) : (
                          'N/A (Cash)'
                        )}
                      </td>
                      <td className="p-3.5">{getStatusBadge(txn.paymentStatus || txn.status)}</td>
                      <td className="p-3.5 text-xs text-gray-400">
                        {new Date(txn.createdAt || Date.now()).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => openInvestigationDrawer('payment', txn._id, txn)}
                          className="inline-flex items-center px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <FiEye className="mr-1.5" /> Details
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
          <div className="p-4 border-t border-gray-100 flex justify-end">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentManagementPage;
