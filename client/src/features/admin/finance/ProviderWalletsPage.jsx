import React, { useState, useEffect } from 'react';
import { FiBriefcase, FiDollarSign, FiLock, FiAlertCircle, FiEye } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';

const ProviderWalletsPage = () => {
  const [data, setData] = useState({
    providers: [],
    summary: { totalBalance: 0, totalEscrow: 0, totalPendingPayout: 0, totalPenalty: 0 }
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
      const res = await TransactionService.getProviderWallets(params);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setTotalPages(res.data.data.totalPages || 1);
      }
    } catch (err) {
      console.error("Error loading provider wallets:", err);
      setError("Failed to fetch live provider wallet ledgers.");
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
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl mr-3">
              <FiBriefcase className="w-6 h-6" />
            </span>
            Provider Wallet & Escrow Management (Live Data)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor provider available balances, escrow reserves, pending payout liabilities, and penalty deductions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">


        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Total Available Balance</p>
          <h3 className="text-2xl font-black text-blue-700 mt-1">
            <PriceDisplay amount={data.summary.totalBalance} />
          </h3>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Total Escrow Reserve</p>
          <h3 className="text-2xl font-black text-amber-600 mt-1">
            <PriceDisplay amount={data.summary.totalEscrow} />
          </h3>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Pending Payout Liability</p>
          <h3 className="text-2xl font-black text-purple-600 mt-1">
            <PriceDisplay amount={data.summary.totalPendingPayout} />
          </h3>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Penalties / Deductions</p>
          <h3 className="text-2xl font-black text-red-600 mt-1">
            <PriceDisplay amount={data.summary.totalPenalty} />
          </h3>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} columns={7} /></div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 font-semibold text-sm">{error}</div>
        ) : data.providers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No provider wallet records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-3.5">Provider</th>
                  <th className="p-3.5">Contact</th>
                  <th className="p-3.5">Available Balance</th>
                  <th className="p-3.5">Escrow Reserve</th>
                  <th className="p-3.5">Pending Payout</th>
                  <th className="p-3.5">Payout Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.providers.map((p) => (
                  <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3.5 font-semibold text-gray-900 text-xs">
                      <button
                        onClick={() => openInvestigationDrawer('provider', p._id, p)}
                        className="text-blue-700 font-bold hover:underline"
                      >
                        {p.name || 'Provider'}
                      </button>
                    </td>
                    <td className="p-3.5 text-xs text-gray-500">
                      <div>{p.email}</div>
                      <div className="text-[11px] text-gray-400">{p.phone}</div>
                    </td>
                    <td className="p-3.5 font-bold text-blue-700">
                      <PriceDisplay amount={p.wallet?.availableBalance || 0} />
                    </td>
                    <td className="p-3.5 font-semibold text-amber-600">
                      <PriceDisplay amount={p.wallet?.escrowBalance || 0} />
                    </td>
                    <td className="p-3.5 font-semibold text-purple-700">
                      <PriceDisplay amount={p.wallet?.pendingPayout || p.pendingPayout || 0} />
                    </td>
                    <td className="p-3.5">
                      {p.payoutHold ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-bold">
                          <FiLock className="mr-1" /> HOLD ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-xs font-bold">
                          READY FOR PAYOUT
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => openInvestigationDrawer('provider', p._id, p)}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all"
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

export default ProviderWalletsPage;
