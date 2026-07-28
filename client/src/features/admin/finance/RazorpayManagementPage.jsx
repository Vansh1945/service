import React, { useState, useEffect } from 'react';
import { FiZap, FiCheckCircle, FiClock, FiEye, FiShield } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';
import { fmtDate } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';

const RazorpayManagementPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchRazorpayLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({
        page: currentPage,
        limit,
        paymentMethod: 'razorpay',
        search: debouncedSearch
      });
      const res = await TransactionService.getAllTransactions(params);
      if (res.data?.success) {
        const list = res.data.data.transactions || res.data.data || [];
        setTransactions(list);
        setPaginationData({
          total: res.data.data.total || res.data.total || list.length,
          pages: res.data.data.totalPages || res.data.totalPages || 1
        });
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
  }, [currentPage, limit, debouncedSearch]);

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl mr-3">
              <FiZap className="w-6 h-6" />
            </span>
            Razorpay Live Gateway Console
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time gateway synchronization merging stored MongoDB business source of truth with official Razorpay gateway records.
          </p>
        </div>
        <button
          onClick={fetchRazorpayLogs}
          className="text-xs bg-blue-700 text-white px-4 py-2.5 rounded-xl hover:bg-blue-800 font-bold shadow-xs transition-all flex items-center gap-1.5 self-start md:self-auto"
        >
          <FiShield className="w-4 h-4" /> Refresh Gateway Logs
        </button>
      </div>

      {/* Exact 14-Column Razorpay Gateway Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1400px]">
              <tbody>
                <TableSkeleton rows={6} cols={14} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 font-semibold text-sm">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No Razorpay gateway transaction logs found in live database yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1400px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3">Payment ID</th>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Booking ID</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Sub-Method</th>
                  <th className="p-3">Bank</th>
                  <th className="p-3">Captured Amount</th>
                  <th className="p-3">Refund Amount</th>
                  <th className="p-3">Settlement Status</th>
                  <th className="p-3">Gateway Status</th>
                  <th className="p-3">Payment Status</th>
                  <th className="p-3">Created Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transactions.map((txn) => {
                  const gross = txn.amount || 0;
                  const razorpayResp = txn.razorpayResponse || {};
                  const subMethod = razorpayResp.vpa ? 'UPI' : (razorpayResp.card ? `Card (${razorpayResp.card.network || 'Card'})` : (razorpayResp.bank ? `NetBanking (${razorpayResp.bank})` : (txn.paymentMethod || 'Online')));
                  const bank = razorpayResp.bank || 'N/A';
                  const refundAmt = txn.refundAmount || txn.booking?.refundAmount || 0;
                  const gatewayStatus = razorpayResp.status || (['success', 'completed'].includes(txn.paymentStatus) ? 'captured' : 'pending');
                  const settlementStatus = txn.settlementStatus || (['success', 'completed'].includes(txn.paymentStatus) ? 'Settled' : 'Processing');

                  return (
                    <tr key={txn._id} className="hover:bg-blue-50/20 transition-colors">

                      {/* 1. Payment ID */}
                      <td className="p-3 font-mono font-bold text-blue-700">
                        <button
                          onClick={() => openInvestigationDrawer('razorpay', txn._id, txn)}
                          className="hover:underline"
                        >
                          {txn.razorpayPaymentId || txn.transactionId || `#${txn._id.slice(-6)}`}
                        </button>
                      </td>

                      {/* 2. Order ID */}
                      <td className="p-3 font-mono text-slate-500">
                        {txn.razorpayOrderId || 'order_N/A'}
                      </td>

                      {/* 3. Customer */}
                      <td className="p-3 font-bold text-slate-900">
                        <button
                          onClick={() => openInvestigationDrawer('customer', txn.user?._id || txn.user)}
                          className="text-blue-700 hover:underline"
                        >
                          {txn.user?.name || 'Customer'}
                        </button>
                      </td>

                      {/* 4. Booking ID */}
                      <td className="p-3 font-mono font-bold text-slate-900">
                        <button
                          onClick={() => openInvestigationDrawer('booking', txn.booking?._id || txn.booking)}
                          className="text-blue-600 hover:underline font-mono"
                        >
                          {txn.booking?.bookingId || txn.bookingId || 'N/A'}
                        </button>
                      </td>

                      {/* 5. Payment Method */}
                      <td className="p-3 font-bold uppercase text-slate-700">
                        {txn.paymentMethod || 'Razorpay'}
                      </td>

                      {/* 6. UPI / Card / NetBanking / Wallet / EMI */}
                      <td className="p-3 font-semibold text-primary">
                        <span className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded-md text-[11px] font-bold">
                          {subMethod}
                        </span>
                      </td>

                      {/* 7. Bank */}
                      <td className="p-3 text-slate-700 font-medium">{bank}</td>

                      {/* 8. Captured Amount */}
                      <td className="p-3 font-black text-slate-900 text-sm">
                        <PriceDisplay amount={gross} />
                      </td>

                      {/* 9. Refund Amount */}
                      <td className="p-3 font-bold text-rose-600">
                        <PriceDisplay amount={refundAmt} />
                      </td>

                      {/* 10. Settlement Status */}
                      <td className="p-3 font-bold text-emerald-600">
                        <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-extrabold uppercase">
                          {settlementStatus}
                        </span>
                      </td>

                      {/* 11. Gateway Status */}
                      <td className="p-3 font-bold text-blue-600">
                        <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-extrabold uppercase">
                          {gatewayStatus}
                        </span>
                      </td>

                      {/* 12. Payment Status */}
                      <td className="p-3">
                        {['success', 'completed'].includes(txn.paymentStatus) ? (
                          <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-extrabold uppercase">
                            <FiCheckCircle className="mr-1" /> SUCCESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-extrabold uppercase">
                            <FiClock className="mr-1" /> PENDING
                          </span>
                        )}
                      </td>

                      {/* 13. Created Date */}
                      <td className="p-3 text-slate-400 whitespace-nowrap">
                        {fmtDate(txn.createdAt)}
                      </td>

                      {/* 14. Actions */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openInvestigationDrawer('razorpay', txn._id, txn)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-700 hover:text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
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

export default RazorpayManagementPage;
