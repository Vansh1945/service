import React, { useState, useEffect } from 'react';
import { FiUserCheck, FiDollarSign, FiRefreshCw, FiEye } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';

const CustomerWalletsPage = () => {
  const [data, setData] = useState({
    users: [],
    summary: { totalAvailableBalance: 0, totalRefunded: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page, limit: 10, search: searchQuery });
      const res = await TransactionService.getCustomerWallets(params);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setTotalPages(res.data.data.totalPages || 1);
      }
    } catch (err) {
      console.error("Error loading customer wallets:", err);
      setError("Failed to fetch live customer wallet ledgers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [page, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl mr-3">
              <FiUserCheck className="w-6 h-6" />
            </span>
            Customer Wallet Management (Live Data)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor customer promotional credits, instant refund balances, and deposit ledgers. Click any record for 360° audit.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">


        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Total Customer Active Balances</p>
            <h3 className="text-2xl font-black text-purple-700 mt-1">
              <PriceDisplay amount={data.summary.totalAvailableBalance} />
            </h3>
            <span className="text-xs text-purple-600 font-medium">Available Cash & Credits</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <FiDollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Total Refunds Credited to Wallet</p>
            <h3 className="text-2xl font-black text-green-600 mt-1">
              <PriceDisplay amount={data.summary.totalRefunded} />
            </h3>
            <span className="text-xs text-green-600 font-medium">Instant Cancellation Deposits</span>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <FiRefreshCw className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} columns={6} /></div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 font-semibold text-sm">{error}</div>
        ) : data.users.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No customer wallet records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Contact</th>
                  <th className="p-3.5">Available Balance</th>
                  <th className="p-3.5">Total Refund Deposits</th>
                  <th className="p-3.5">Wallet Entries</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.users.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3.5 font-semibold text-gray-900 text-xs">
                      <button
                        onClick={() => openInvestigationDrawer('customer', u._id, u)}
                        className="text-purple-700 font-bold hover:underline"
                      >
                        {u.name || 'Customer'}
                      </button>
                    </td>
                    <td className="p-3.5 text-xs text-gray-500">
                      <div>{u.email}</div>
                      <div className="text-[11px] text-gray-400">{u.phone}</div>
                    </td>
                    <td className="p-3.5 font-bold text-purple-700">
                      <PriceDisplay amount={u.wallet?.availableBalance || 0} />
                    </td>
                    <td className="p-3.5 font-semibold text-green-600">
                      <PriceDisplay amount={u.wallet?.totalRefunded || 0} />
                    </td>
                    <td className="p-3.5 text-xs text-gray-600 font-mono">
                      {u.wallet?.walletTransactions?.length || 0} entries
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => openInvestigationDrawer('customer', u._id, u)}
                        className="inline-flex items-center px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white rounded-lg text-xs font-bold transition-all"
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

export default CustomerWalletsPage;
