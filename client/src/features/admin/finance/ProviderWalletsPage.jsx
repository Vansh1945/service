import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiBriefcase, FiDollarSign, FiLock, FiAlertCircle, FiEye, FiShield } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { fmtDate } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';
import ProviderWalletDetailModal from './components/ProviderWalletDetailModal';

const ProviderWalletsPage = () => {
  const [data, setData] = useState({
    providers: [],
    summary: { totalBalance: 0, totalEscrow: 0, totalPendingPayout: 0, totalPenalty: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, getMergedQuery, getEntityRoute } = useAdminFilter();
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
      const res = await TransactionService.getProviderWallets(params, { signal: abortControllerRef.current.signal });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setPaginationData({
          total: res.data.data.total || res.data.data.providers?.length || 0,
          pages: res.data.data.totalPages || 1
        });
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error("Error loading provider wallets:", err);
        setError("Failed to fetch live provider wallet ledgers.");
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
    if (params.get('openDetail') === 'true' && data.providers?.length > 0 && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const searchVal = params.get('search');
      const target = data.providers.find(p =>
        p._id === searchVal ||
        p.providerId === searchVal ||
        p.name === searchVal ||
        p.phone === searchVal
      ) || data.providers[0];
      if (target) {
        setSelectedWallet(target);
      }
    }
  }, [data.providers]);

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl mr-3">
              <FiBriefcase className="w-6 h-6" />
            </span>
            Provider Wallet Management Console
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Lightweight provider wallet console displaying available balances, escrow reserves, pending payouts, penalties, and settlement activity.
          </p>
        </div>
        <button
          onClick={fetchWallets}
          className="text-xs bg-blue-700 text-white px-4 py-2.5 rounded-xl hover:bg-blue-800 font-bold shadow-xs transition-all flex items-center gap-1.5 self-start md:self-auto"
        >
          <FiShield className="w-4 h-4" /> Refresh Ledger
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Available Balances</p>
          <h3 className="text-2xl font-black text-blue-700 mt-1">
            <PriceDisplay amount={data.summary?.totalBalance || 0} />
          </h3>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Escrow Reserves</p>
          <h3 className="text-2xl font-black text-amber-600 mt-1">
            <PriceDisplay amount={data.summary?.totalEscrow || 0} />
          </h3>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Pending Payouts</p>
          <h3 className="text-2xl font-black text-purple-600 mt-1">
            <PriceDisplay amount={data.summary?.totalPendingPayout || 0} />
          </h3>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Total Penalties</p>
          <h3 className="text-2xl font-black text-rose-600 mt-1">
            <PriceDisplay amount={data.summary?.totalPenalty || 0} />
          </h3>
        </div>
      </div>

      {/* 8-Column Provider Wallets Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1100px]">
              <tbody>
                <TableSkeleton rows={6} cols={8} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 font-semibold text-sm">{error}</div>
        ) : data.providers.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No provider wallet accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1100px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Provider</th>
                  <th className="p-3.5">Available Balance</th>
                  <th className="p-3.5">Escrow Balance</th>
                  <th className="p-3.5">Pending Payout</th>
                  <th className="p-3.5">Penalty Balance</th>
                  <th className="p-3.5">Total Withdrawn</th>
                  <th className="p-3.5">Last Settlement</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.providers.map((p) => (
                  <tr key={p._id} className="hover:bg-blue-50/20 transition-colors">

                    {/* 1. Provider Profile */}
                    <td className="p-3.5 font-bold text-slate-900">
                      <a
                        href={getEntityRoute('provider', p._id)}
                        className="text-blue-700 hover:underline flex flex-col text-left font-semibold"
                      >
                        <span className="font-extrabold">{p.name || 'Provider'}</span>
                        <span className="text-[11px] font-normal text-slate-400">{p.email || p.phone || 'N/A'}</span>
                      </a>
                    </td>

                    {/* 2. Available Balance */}
                    <td className="p-3.5 font-black text-blue-700 text-sm">
                      <PriceDisplay amount={p.availableBalance ?? p.wallet?.availableBalance ?? 0} />
                    </td>

                    {/* 3. Escrow Balance */}
                    <td className="p-3.5 font-bold text-amber-600">
                      <PriceDisplay amount={p.escrowBalance ?? p.wallet?.escrowBalance ?? 0} />
                    </td>

                    {/* 4. Pending Payout */}
                    <td className="p-3.5 font-bold text-purple-600">
                      <PriceDisplay amount={p.pendingPayout ?? p.wallet?.pendingPayout ?? 0} />
                    </td>

                    {/* 5. Penalty Balance */}
                    <td className="p-3.5 font-bold text-rose-600">
                      <PriceDisplay amount={p.penaltyBalance ?? p.wallet?.totalPenalty ?? 0} />
                    </td>

                    {/* 6. Total Withdrawn */}
                    <td className="p-3.5 font-bold text-emerald-600">
                      <PriceDisplay amount={p.totalWithdrawn ?? p.wallet?.totalWithdrawn ?? 0} />
                    </td>

                    {/* 7. Last Settlement Date */}
                    <td className="p-3.5 text-slate-400 whitespace-nowrap">
                      {fmtDate(p.lastSettlementDate || p.wallet?.lastUpdated || p.createdAt)}
                    </td>

                    {/* 8. Actions */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedWallet(p)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                      >
                        <FiEye className="mr-1.5" /> View Details
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

      {/* Provider Wallet Detail Modal */}
      <ProviderWalletDetailModal
        isOpen={!!selectedWallet}
        onClose={() => setSelectedWallet(null)}
        entityData={selectedWallet}
      />
    </div>
  );
};

export default ProviderWalletsPage;
