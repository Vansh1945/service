import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiTrendingUp, FiCheckCircle, FiClock, FiEye, FiShield } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { fmtDate } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';
import Error from '../../../components/ui/Error';
import ProviderEarningDetailModal from './components/ProviderEarningDetailModal';

const ProviderEarningsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEarning, setSelectedEarning] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, getMergedQuery, getEntityRoute } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const abortControllerRef = useRef(null);

  const fetchEarnings = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page: currentPage, limit, search: debouncedSearch, type: 'payment' });
      const res = await TransactionService.getAllTransactions(params, { signal: abortControllerRef.current.signal });
      if (res.data?.success) {
        const list = res.data.data.transactions || res.data.data || [];
        setTransactions(list);
        setPaginationData({
          total: res.data.data.total || res.data.total || list.length,
          pages: res.data.data.totalPages || res.data.totalPages || 1
        });
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error("Error loading provider earnings:", err);
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [getMergedQuery, currentPage, limit, debouncedSearch, setPaginationData]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-secondary tracking-tight flex items-center">
            <span className="p-2 bg-primary/10 text-primary rounded-xl mr-3">
              <FiTrendingUp className="w-6 h-6" />
            </span>
            Provider Net Earnings Console
          </h1>
          <p className="text-sm text-neutral-500 mt-1 font-medium">
            Simple, lightweight, and production-ready job earnings ledger showing exact customer payments, platform commissions, provider net shares, settlement, and withdrawal statuses.
          </p>
        </div>
        <button
          onClick={fetchEarnings}
          className="text-xs bg-primary text-white px-4 py-2.5 rounded-xl hover:bg-primary/90 font-bold shadow-sm transition-all flex items-center gap-1.5 self-start md:self-auto"
        >
          <FiShield className="w-4 h-4" /> Refresh Earnings
        </button>
      </div>

      {/* Exact 9-Column Provider Earnings Table */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} columns={9} standalone />
        ) : error ? (
          <Error error={error} onRetry={fetchEarnings} />
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 text-sm font-medium">No provider earning records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-secondary min-w-[1100px]">
              <thead className="bg-neutral-50 text-neutral-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-neutral-100">
                <tr>
                  <th className="p-3.5">Booking ID</th>
                  <th className="p-3.5">Customer Paid</th>
                  <th className="p-3.5">Platform Commission</th>
                  <th className="p-3.5">Provider Net Share</th>
                  <th className="p-3.5">Settlement Status</th>
                  <th className="p-3.5">Withdrawal Status</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 font-medium">
                {transactions.map((txn) => {
                  const isWithdrawal = txn.type === 'withdrawal' || txn.ledgerType === 'withdrawal' || (txn.bookingId && txn.bookingId.startsWith('WDL-'));
                  const customerPaid = isWithdrawal ? 0 : (txn.amount || txn.booking?.totalAmount || 0);
                  const commission = isWithdrawal
                    ? 0
                    : ((txn.commission !== undefined && txn.commission !== null)
                      ? txn.commission
                      : ((txn.booking?.commissionAmount !== undefined && txn.booking?.commissionAmount !== null)
                        ? txn.booking.commissionAmount
                        : null));
                  const providerNetShare = isWithdrawal
                    ? 0
                    : ((txn.providerEarning !== undefined && txn.providerEarning !== null)
                      ? txn.providerEarning
                      : ((txn.booking?.providerEarnings !== undefined && txn.booking?.providerEarnings !== null)
                        ? txn.booking.providerEarnings
                        : (commission !== null ? customerPaid - commission : null)));
                  const settlementStatus = txn.settlementStatus || (txn.razorpaySettlementId ? 'Settled' : 'Pending');
                  const withdrawalStatus = txn.withdrawalStatus || 'Available';
                  const isCompleted = ['success', 'completed'].includes(txn.paymentStatus);

                  return (
                <tr key={txn._id} className="hover:bg-neutral-50/50 transition-colors">
                  <td className="p-3.5 font-bold text-secondary">
                    {isWithdrawal ? (
                      <span className="font-mono text-neutral-400">Withdrawal</span>
                    ) : (
                      <a
                        href={getEntityRoute('booking', txn.booking?._id || txn.booking || txn._id)}
                        className="text-primary font-mono hover:underline"
                      >
                        {txn.booking?.bookingId || txn.bookingId || `#${txn._id.slice(-6)}`}
                      </a>
                    )}
                  </td>

                  <td className="p-3.5 font-bold text-secondary text-sm">
                    <PriceDisplay amount={customerPaid} />
                  </td>

                  <td className="p-3.5 font-bold text-danger">
                    {commission !== null && commission !== undefined ? (
                      <PriceDisplay amount={commission} />
                    ) : (
                      <span className="text-neutral-400 font-medium text-xs">N/A</span>
                    )}
                  </td>

                  <td className="p-3.5 font-black text-success text-sm">
                    {providerNetShare !== null && providerNetShare !== undefined ? (
                      <PriceDisplay amount={providerNetShare} />
                    ) : (
                      <span className="text-neutral-400 font-medium text-xs">N/A</span>
                    )}
                  </td>

                  <td className="p-3.5 font-bold text-secondary">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold ${settlementStatus.toLowerCase().includes('settled') ? 'bg-success-light text-success' : 'bg-warning-light text-warning'}`}>
                      {settlementStatus}
                    </span>
                  </td>

                  <td className="p-3.5 font-bold text-secondary">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold bg-primary/10 text-primary">
                      {withdrawalStatus}
                    </span>
                  </td>

                  <td className="p-3.5">
                    {isCompleted ? (
                      <span className="inline-flex items-center px-2 py-0.5 bg-success-light text-success rounded-full text-[10px] font-extrabold uppercase">
                        <FiCheckCircle className="mr-1" /> COMPLETED
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 bg-warning-light text-warning rounded-full text-[10px] font-extrabold uppercase">
                        <FiClock className="mr-1" /> PENDING
                      </span>
                    )}
                  </td>

                  <td className="p-3.5 text-neutral-400 whitespace-nowrap">
                    {fmtDate(txn.createdAt)}
                  </td>

                  <td className="p-3.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => setSelectedEarning(txn)}
                      className="inline-flex items-center px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      <FiEye className="mr-1.5" /> View Details
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
          <div className="border-t border-neutral-100 flex justify-end">
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

      {/* Provider Earning Detail Modal */}
      <ProviderEarningDetailModal
        isOpen={!!selectedEarning}
        onClose={() => setSelectedEarning(null)}
        entityData={selectedEarning}
      />
    </div>
  );
};

export default ProviderEarningsPage;

