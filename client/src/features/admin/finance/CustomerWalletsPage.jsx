import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiUserCheck, FiDollarSign, FiRefreshCw, FiEye, FiShield } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { fmtDate } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';
import CustomerWalletDetailModal from './components/CustomerWalletDetailModal';

const CustomerWalletsPage = () => {
  const [data, setData] = useState({
    users: [],
    summary: { totalAvailableBalance: 0, totalRefunded: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, getMergedQuery, getEntityRoute, refresh } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const abortControllerRef = useRef(null);

  const fetchWallets = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page: currentPage, limit, search: debouncedSearch });
      const res = await TransactionService.getCustomerWallets(params, { signal: abortControllerRef.current.signal });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setPaginationData({
          total: res.data.data.total || res.data.data.users?.length || 0,
          pages: res.data.data.totalPages || 1
        });
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error("Error loading customer wallets:", err);
        setError("Failed to fetch live customer wallet ledgers.");
      }
    } finally {
      setLoading(false);
    }
  }, [getMergedQuery, currentPage, limit, debouncedSearch, setPaginationData]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openDetail') === 'true' && data.users?.length > 0 && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const searchVal = params.get('search') || '';
      const searchLower = searchVal.toLowerCase();
      const target = data.users.find(u =>
        u._id === searchVal ||
        u.customerId === searchVal ||
        u.name?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower) ||
        u.phone?.includes(searchVal)
      ) || data.users[0];
      if (target) {
        setSelectedWallet(target);
      }
    }
  }, [data.users]);

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <span className="p-2 bg-purple-50 text-purple-600 rounded-xl mr-3">
              <FiUserCheck className="w-6 h-6" />
            </span>
            Customer Wallet Balances Console
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Immutable tracking of customer wallet deposits, promotional credits, refund additions, booking debits, and balance ledgers.
          </p>
        </div>
        <button
          onClick={fetchWallets}
          className="text-xs bg-purple-700 text-white px-4 py-2.5 rounded-xl hover:bg-purple-800 font-bold shadow-xs transition-all flex items-center gap-1.5 self-start md:self-auto"
        >
          <FiShield className="w-4 h-4" /> Refresh Wallet Balances
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Active Customer Wallet Balances</p>
          <h3 className="text-2xl font-black text-purple-700 mt-1">
            <PriceDisplay amount={data.summary?.totalAvailableBalance || 0} />
          </h3>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Refund Credits Deposited</p>
          <h3 className="text-2xl font-black text-blue-600 mt-1">
            <PriceDisplay amount={data.summary?.totalRefunded || 0} />
          </h3>
        </div>
      </div>

      {/* 11-Column Customer Wallets Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1200px]">
              <tbody>
                <TableSkeleton rows={6} cols={11} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 font-semibold text-sm">{error}</div>
        ) : data.users.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No customer wallet accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1200px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Contact Details</th>
                  <th className="p-3.5">Wallet Balance</th>
                  <th className="p-3.5">Total Credits</th>
                  <th className="p-3.5">Total Debits</th>
                  <th className="p-3.5">Refund Credit</th>
                  <th className="p-3.5">Cashback Credit</th>
                  <th className="p-3.5">Bookings Count</th>
                  <th className="p-3.5">Transactions Count</th>
                  <th className="p-3.5">Last Activity</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.users.map((u) => (
                  <tr key={u._id} className="hover:bg-purple-50/20 transition-colors">

                    {/* 1. Customer */}
                    <td className="p-3.5 font-bold text-slate-900">
                      <a
                        href={getEntityRoute('customer', u._id)}
                        className="text-purple-700 hover:underline flex items-center gap-1.5"
                      >
                        {u.name || 'Customer'}
                      </a>
                    </td>

                    {/* 2. Contact */}
                    <td className="p-3.5 text-slate-500">
                      <div className="font-semibold text-slate-700">{u.email || 'N/A'}</div>
                      <div className="text-[11px] text-slate-400">{u.phone || 'N/A'}</div>
                    </td>

                    {/* 3. Wallet Balance */}
                    <td className="p-3.5 font-black text-purple-700 text-sm">
                      <PriceDisplay amount={u.walletBalance ?? u.wallet?.availableBalance ?? 0} />
                    </td>

                    {/* 4. Credits */}
                    <td className="p-3.5 font-bold text-emerald-600">
                      <PriceDisplay amount={u.credits || 0} />
                    </td>

                    {/* 5. Debits */}
                    <td className="p-3.5 font-bold text-rose-600">
                      <PriceDisplay amount={u.debits || 0} />
                    </td>

                    {/* 6. Refund Credit */}
                    <td className="p-3.5 font-bold text-blue-600">
                      <PriceDisplay amount={u.refundCredit ?? u.wallet?.totalRefunded ?? 0} />
                    </td>

                    {/* 7. Cashback */}
                    <td className="p-3.5 font-bold text-amber-600">
                      <PriceDisplay amount={u.cashback || 0} />
                    </td>

                    {/* 8. Bookings Count */}
                    <td className="p-3.5 font-mono text-slate-700 font-bold">
                      {u.bookingsCount || 0}
                    </td>

                    {/* 9. Transactions Count */}
                    <td className="p-3.5 font-mono text-slate-700 font-bold">
                      {u.transactionsCount || u.wallet?.walletTransactions?.length || 0}
                    </td>

                    {/* 10. Last Activity */}
                    <td className="p-3.5 text-slate-400 whitespace-nowrap">
                      {fmtDate(u.lastActivity || u.wallet?.lastUpdated || u.createdAt)}
                    </td>

                    {/* 11. Actions */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedWallet(u)}
                        className="inline-flex items-center px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
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

      {/* Customer Wallet Detail Modal */}
      <CustomerWalletDetailModal
        isOpen={!!selectedWallet}
        onClose={() => setSelectedWallet(null)}
        entityData={selectedWallet}
      />
    </div>
  );
};

export default CustomerWalletsPage;
