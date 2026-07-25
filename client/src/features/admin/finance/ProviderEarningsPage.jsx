import React, { useState, useEffect } from 'react';
import { FiTrendingUp, FiCheckCircle, FiClock, FiEye } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';

const ProviderEarningsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page, limit: 10, search: searchQuery });
      const res = await TransactionService.getAllTransactions(params);
      if (res.data?.success) {
        setTransactions(res.data.data.transactions || res.data.data || []);
        setTotalPages(res.data.data.totalPages || res.data.totalPages || 1);
      }
    } catch (err) {
      console.error("Error loading provider earnings:", err);
      setError("Failed to fetch live provider earnings records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, [page, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl mr-3">
              <FiTrendingUp className="w-6 h-6" />
            </span>
            Provider Net Earnings Breakdown (Live Data)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Detailed booking-level revenue splits showing gross pay, platform commission deductions, and net provider share.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">



        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} columns={7} /></div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 font-semibold text-sm">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No transaction earnings found in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-3.5">Booking ID</th>
                  <th className="p-3.5">Customer / Provider</th>
                  <th className="p-3.5">Customer Paid</th>
                  <th className="p-3.5">Commission</th>
                  <th className="p-3.5">Provider Net Share</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((txn) => {
                  const gross = txn.amount || 0;
                  const comm = txn.commission || (gross * 0.2);
                  const net = txn.providerEarning || (gross - comm);

                  return (
                    <tr key={txn._id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3.5">
                        <button
                          onClick={() => openInvestigationDrawer('booking', txn.booking?.bookingId || txn.bookingId || txn.booking?._id, txn.booking)}
                          className="font-mono text-xs font-semibold text-blue-600 hover:underline font-bold"
                        >
                          {txn.booking?.bookingId || txn.bookingId || `#${txn._id.slice(-6)}`}
                        </button>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-gray-800 text-xs">{txn.user?.name || 'Customer'}</div>
                        <div className="text-[11px] text-gray-400">P: {txn.provider?.name || 'Assigned Provider'}</div>
                      </td>
                      <td className="p-3.5 font-bold text-gray-900">
                        <PriceDisplay amount={gross} />
                      </td>
                      <td className="p-3.5 font-semibold text-amber-600">
                        <PriceDisplay amount={comm} />
                      </td>
                      <td className="p-3.5 font-black text-emerald-700">
                        <PriceDisplay amount={net} />
                      </td>
                      <td className="p-3.5">
                        {txn.paymentStatus === 'success' || txn.paymentStatus === 'completed' ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-bold">
                            <FiCheckCircle className="mr-1" /> SETTLED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs font-bold">
                            <FiClock className="mr-1" /> PENDING
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-xs text-gray-400">
                        {new Date(txn.createdAt || Date.now()).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
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

export default ProviderEarningsPage;
