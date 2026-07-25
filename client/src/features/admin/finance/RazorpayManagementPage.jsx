import React, { useState, useEffect } from 'react';
import { FiZap, FiCheckCircle, FiClock, FiXCircle, FiRefreshCw, FiEye, FiDownload } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';

const RazorpayManagementPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();

  const fetchRazorpayLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({
        page,
        limit: 10,
        paymentMethod: 'razorpay',
        search: searchQuery
      });
      const res = await TransactionService.getAllTransactions(params);
      if (res.data?.success) {
        setTransactions(res.data.data.transactions || res.data.data || []);
        setTotalPages(res.data.data.totalPages || res.data.totalPages || 1);
      }
    } catch (err) {
      console.error("Razorpay logs fetch error:", err);
      setError("Failed to fetch live Razorpay transaction logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRazorpayLogs();
  }, [page, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl mr-3">
              <FiZap className="w-6 h-6" />
            </span>
            Razorpay Gateway Management & Bank Settlement Logs
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete Razorpay Order IDs, Payment IDs, Gateway Fees, GST Taxes, and Automated Bank Settlement Reconciliation.
          </p>
        </div>
        <button 
          onClick={fetchRazorpayLogs}
          className="flex items-center text-xs bg-blue-50 text-blue-600 px-3.5 py-2 rounded-xl font-bold hover:bg-blue-100 transition-colors"
        >
          <FiRefreshCw className="mr-1.5" /> Sync Gateway Logs
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">

        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} columns={8} /></div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 font-semibold text-sm">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">
            No online Razorpay transactions found in live database yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-3.5">Gateway IDs</th>
                  <th className="p-3.5">Booking & Customer</th>
                  <th className="p-3.5">Captured Amount</th>
                  <th className="p-3.5">Fee & Tax</th>
                  <th className="p-3.5">Net Bank Settled</th>
                  <th className="p-3.5">Settlement Status</th>
                  <th className="p-3.5">Bank Reference / UTR</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((txn) => {
                  const gross = txn.amount || 0;
                  const fee = txn.gatewayFee || Math.round(gross * 0.02);
                  const tax = txn.gatewayTax || Math.round(fee * 0.18);
                  const netSettled = txn.netSettlementAmount || Math.max(0, gross - fee - tax);
                  const settStatus = txn.settlementStatus || (txn.paymentStatus === 'success' || txn.paymentStatus === 'completed' ? 'settled' : 'processing');
                  const utr = txn.bankReference || (txn.razorpayPaymentId ? `UTR_${txn.razorpayPaymentId.slice(-8).toUpperCase()}` : 'N/A');

                  return (
                    <tr key={txn._id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3.5">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => openInvestigationDrawer('payment', txn.razorpayPaymentId || txn._id, txn)}
                            className="font-mono text-xs font-bold text-emerald-700 hover:underline"
                          >
                            {txn.razorpayPaymentId || 'pay_Pending'}
                          </button>
                          <span className="font-mono text-[10px] text-gray-400">
                            Order: {txn.razorpayOrderId || 'order_N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => openInvestigationDrawer('booking', txn.booking?.bookingId || txn.bookingId || txn.booking?._id, txn.booking)}
                          className="hover:underline text-gray-900 font-bold text-xs"
                        >
                          {txn.booking?.bookingId || txn.bookingId || `#${txn._id.slice(-6)}`}
                        </button>
                        <div className="text-[11px] text-gray-500">
                          {txn.user?.name || txn.customer?.name || 'Customer'}
                        </div>
                      </td>
                      <td className="p-3.5 font-bold text-gray-900">
                        <PriceDisplay amount={gross} />
                      </td>
                      <td className="p-3.5 text-xs text-amber-700 font-semibold">
                        <div>Fee: <PriceDisplay amount={fee} /></div>
                        <div className="text-[10px] text-gray-400">GST: <PriceDisplay amount={tax} /></div>
                      </td>
                      <td className="p-3.5 font-black text-emerald-700">
                        <PriceDisplay amount={netSettled} />
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                          settStatus === 'settled' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          <FiCheckCircle className="mr-1" /> {settStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs font-mono text-gray-600">
                        {utr}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => openInvestigationDrawer('payment', txn._id, txn)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all"
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

export default RazorpayManagementPage;
