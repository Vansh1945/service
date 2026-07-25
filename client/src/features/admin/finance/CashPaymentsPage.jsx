import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiAlertTriangle, FiCheckCircle, FiClock, FiEye } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';

const CashPaymentsPage = () => {
  const [data, setData] = useState({
    transactions: [],
    summary: { pendingVerification: 0, verifiedCash: 0, disputedCash: 0, providerCashLiability: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();

  const fetchCashLedger = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page, limit: 10, search: searchQuery });
      const res = await TransactionService.getCashLedger(params);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setTotalPages(res.data.data.totalPages || 1);
      }
    } catch (err) {
      console.error("Error loading cash ledger:", err);
      setError("Failed to fetch live cash collection ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashLedger();
  }, [page, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl mr-3">
              <FiDollarSign className="w-6 h-6" />
            </span>
            Cash Payment & Collection Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track Cash on Delivery (COD) collections, provider cash liabilities, and verification status in real time.
          </p>
        </div>
        <button 
          onClick={fetchCashLedger}
          className="text-xs bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700 font-bold shadow-sm"
        >
          Refresh Cash Ledger
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">

        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 flex items-start">
          <FiAlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Cash Collection Safeguard:</strong> Provider wallet liabilities are calculated live based on unverified cash collections on active bookings.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold uppercase">Pending Verification</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              <PriceDisplay amount={data.summary.pendingVerification} />
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold uppercase">Verified Cash</p>
            <p className="text-2xl font-black text-green-600 mt-1">
              <PriceDisplay amount={data.summary.verifiedCash} />
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold uppercase">Disputed / Unresolved Cash</p>
            <p className="text-2xl font-black text-red-600 mt-1">
              <PriceDisplay amount={data.summary.disputedCash} />
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} columns={7} /></div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 font-semibold text-sm">{error}</div>
        ) : data.transactions.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No cash transaction records found in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-3.5">Transaction Ref</th>
                  <th className="p-3.5">Booking</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Provider</th>
                  <th className="p-3.5">Cash Amount</th>
                  <th className="p-3.5">Verification Status</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.transactions.map((txn) => (
                  <tr key={txn._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3.5 font-mono text-xs font-semibold text-blue-600">
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
                        className="hover:underline text-blue-600 font-bold"
                      >
                        {txn.booking?.bookingId || txn.bookingId || 'N/A'}
                      </button>
                    </td>
                    <td className="p-3.5 text-xs text-gray-800">
                      {txn.user?.name || 'Customer'}
                    </td>
                    <td className="p-3.5 text-xs text-gray-800">
                      {txn.provider?.name || 'Unassigned'}
                    </td>
                    <td className="p-3.5 font-bold text-gray-900">
                      <PriceDisplay amount={txn.amount} />
                    </td>
                    <td className="p-3.5">
                      {txn.paymentStatus === 'success' || txn.paymentStatus === 'completed' ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-bold">
                          <FiCheckCircle className="mr-1" /> VERIFIED
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
                        className="inline-flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white rounded-lg text-xs font-bold transition-all"
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

export default CashPaymentsPage;
