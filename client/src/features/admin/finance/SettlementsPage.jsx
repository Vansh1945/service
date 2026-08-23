import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiCheckCircle, FiDollarSign, FiEye, FiShield, FiAlertTriangle } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { fmtDate } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';

const SettlementsPage = () => {
  const [data, setData] = useState({
    settlements: [],
    summary: { bookingSettlement: 0, providerSettlement: 0, commissionSettlement: 0, walletSettlement: 0, settlementDifference: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const abortControllerRef = useRef(null);

  const fetchSettlements = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page: currentPage, limit, search: debouncedSearch });
      const res = await TransactionService.getSettlements(params, { signal: abortControllerRef.current.signal });
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setPaginationData({
          total: res.data.data.total || res.data.data.settlements?.length || 0,
          pages: res.data.data.totalPages || 1
        });
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error("Error loading settlements:", err);
        setError("Failed to fetch live settlement records.");
      }
    } finally {
      setLoading(false);
    }
  }, [getMergedQuery, currentPage, limit, debouncedSearch, setPaginationData]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openDetail') === 'true' && data.settlements?.length > 0 && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const searchVal = params.get('search');
      const target = data.settlements.find(s =>
        s.settlementId === searchVal ||
        s._id === searchVal ||
        s.bookingId === searchVal
      ) || data.settlements[0];
      if (target) {
        openInvestigationDrawer('settlement', target.settlementId || target._id, target);
      }
    }
  }, [data.settlements, openInvestigationDrawer]);

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl mr-3">
              <FiCheckCircle className="w-6 h-6" />
            </span>
            Financial Settlements & Reconciliation Console
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Production-grade financial reconciliation showing Customer Paid, Original Razorpay Gateway Fees, Net Platform Amounts, and Provider Shares.
          </p>
        </div>
        <button
          onClick={fetchSettlements}
          className="text-xs bg-emerald-700 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-800 font-bold shadow-xs transition-all flex items-center gap-1.5 self-start md:self-auto"
        >
          <FiShield className="w-4 h-4" /> Refresh Ledger
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Gross Booking Collections</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">
            <PriceDisplay amount={data.summary?.bookingSettlement || 0} />
          </h3>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Provider Share Payable</p>
          <h3 className="text-2xl font-black text-blue-600 mt-1">
            <PriceDisplay amount={data.summary?.providerSettlement || 0} />
          </h3>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Platform Net Commission</p>
          <h3 className="text-2xl font-black text-emerald-600 mt-1">
            <PriceDisplay amount={data.summary?.commissionSettlement || 0} />
          </h3>
        </div>
        <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-xs">
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Reconciliation Status</p>
          <h3 className="text-2xl font-black mt-1 flex items-center gap-1.5">
            {data.summary?.settlementDifference != null ? (
              Math.abs(data.summary.settlementDifference) < 0.01 ? (
                <span className="text-emerald-600 flex items-center gap-1.5">
                  <FiCheckCircle className="w-5 h-5 text-emerald-500" /> Balanced
                </span>
              ) : (
                <span className="text-rose-600 flex items-center gap-1.5 text-lg">
                  <FiAlertTriangle className="w-5 h-5 text-rose-500" /> Unbalanced (<PriceDisplay amount={data.summary.settlementDifference} />)
                </span>
              )
            ) : (
              <span className="text-slate-400 text-lg font-normal">N/A (Unknown)</span>
            )}
          </h3>
        </div>
      </div>

      {/* Exact 13-Column Settlement Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1300px]">
              <tbody>
                <TableSkeleton rows={6} cols={13} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 font-semibold text-sm">{error}</div>
        ) : data.settlements.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No settlement records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1300px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Settlement ID</th>
                  <th className="p-3.5">Booking ID</th>
                  <th className="p-3.5">Payment ID</th>
                  <th className="p-3.5">Gateway</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Provider</th>
                  <th className="p-3.5">Gross Amount</th>
                  <th className="p-3.5">Gateway Fee</th>
                  <th className="p-3.5">Net Amount</th>
                  <th className="p-3.5">Platform Commission</th>
                  <th className="p-3.5">Settlement Status</th>
                  <th className="p-3.5">Settlement Date</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.settlements.map((s) => {
                  const gross = s.grossAmount || s.amount || s.booking?.totalAmount || 0;
                  const fee = (s.gatewayFee !== undefined && s.gatewayFee !== null) ? s.gatewayFee : null;
                  const net = (s.netAmount !== undefined && s.netAmount !== null) 
                    ? s.netAmount 
                    : ((s.settlementAmount !== undefined && s.settlementAmount !== null) ? s.settlementAmount : null);
                  const comm = (s.platformCommission !== undefined && s.platformCommission !== null)
                    ? s.platformCommission
                    : ((s.commission !== undefined && s.commission !== null)
                      ? s.commission
                      : ((s.booking?.commissionAmount !== undefined && s.booking?.commissionAmount !== null)
                        ? s.booking.commissionAmount
                        : null));
                  const rawSettlementStatus = s.settlementStatus || (s.payoutStatus ? s.payoutStatus : null);
                  const rawStatusLower = String(rawSettlementStatus || '').toLowerCase();
                  const isSettled = ['success', 'completed', 'settled', 'paid'].includes(rawStatusLower);
                  const isPending = ['pending', 'processing', 'queued', 'initiated'].includes(rawStatusLower);
                  const isFailed = ['failed', 'rejected', 'declined', 'cancelled'].includes(rawStatusLower);

                  return (
                    <tr key={s._id} className="hover:bg-emerald-50/20 transition-colors">

                      {/* 1. Settlement ID */}
                      <td className="p-3.5 font-mono font-bold text-emerald-700">
                        {s.settlementId || s.razorpaySettlementId || s.transactionId || `#${s._id.slice(-6)}`}
                      </td>

                      {/* 2. Booking ID */}
                      <td className="p-3.5 font-bold text-slate-900">
                        <button
                          onClick={() => openInvestigationDrawer('booking', s.booking?._id || s.booking)}
                          className="text-blue-600 hover:underline font-mono"
                        >
                          {s.booking?.bookingId || s.bookingId || 'N/A'}
                        </button>
                      </td>

                      {/* 3. Payment ID */}
                      <td className="p-3.5 font-mono text-slate-700 font-semibold">
                        <button
                          onClick={() => openInvestigationDrawer('payment', s._id)}
                          className="hover:underline text-slate-800"
                        >
                          {s.paymentId || s.razorpayPaymentId || s.transactionId || `#${s._id.slice(-6)}`}
                        </button>
                      </td>

                      {/* 4. Gateway */}
                      <td className="p-3.5 font-bold uppercase text-slate-500">
                        {s.gateway || (s.paymentMethod === 'razorpay' ? 'Razorpay' : (s.paymentMethod || 'Razorpay'))}
                      </td>

                      {/* 5. Customer */}
                      <td className="p-3.5 font-semibold text-slate-800">
                        <button
                          onClick={() => openInvestigationDrawer('customer', s.user?._id || s.user)}
                          className="hover:underline text-slate-900 font-bold"
                        >
                          {s.user?.name || 'Customer'}
                        </button>
                      </td>

                      {/* 6. Provider */}
                      <td className="p-3.5 font-semibold text-slate-800">
                        <button
                          onClick={() => openInvestigationDrawer('provider', s.provider?._id || s.provider)}
                          className="hover:underline text-slate-900 font-bold"
                        >
                          {s.provider?.name || 'Provider'}
                        </button>
                      </td>

                      {/* 7. Gross Amount */}
                      <td className="p-3.5 font-black text-slate-900 text-sm">
                        <PriceDisplay amount={gross} />
                      </td>

                      {/* 8. Gateway Fee */}
                      <td className="p-3.5 font-bold text-amber-600">
                        {fee !== null && fee !== undefined ? (
                          <PriceDisplay amount={fee} />
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">N/A</span>
                        )}
                      </td>

                      {/* 9. Net Amount */}
                      <td className="p-3.5 font-black text-teal-700">
                        {net !== null && net !== undefined ? (
                          <PriceDisplay amount={net} />
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">N/A</span>
                        )}
                      </td>

                      {/* 10. Platform Commission */}
                      <td className="p-3.5 font-bold text-emerald-700">
                        {comm !== null && comm !== undefined ? (
                          <PriceDisplay amount={comm} />
                        ) : (
                          <span className="text-slate-400 font-medium text-xs">N/A</span>
                        )}
                      </td>

                      {/* 11. Settlement Status */}
                      <td className="p-3.5">
                        {isSettled ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-extrabold uppercase">
                            <FiCheckCircle className="mr-1" /> SETTLED
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-extrabold uppercase">
                            <FiClock className="mr-1" /> PENDING
                          </span>
                        ) : isFailed ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-extrabold uppercase">
                            <FiXCircle className="mr-1" /> FAILED
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-extrabold uppercase">
                            <FiHelpCircle className="mr-1" /> UNKNOWN
                          </span>
                        )}
                      </td>

                      {/* 12. Settlement Date */}
                      <td className="p-3.5 text-slate-400 whitespace-nowrap">
                        {fmtDate(s.settlementDate || s.updatedAt || s.createdAt)}
                      </td>

                      {/* 13. Action */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => openInvestigationDrawer('settlement', s._id, s)}
                          className="inline-flex items-center px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-700 hover:text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
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
    </div>
  );
};

export default SettlementsPage;
