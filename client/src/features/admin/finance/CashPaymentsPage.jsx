import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiAlertTriangle, FiCheckCircle, FiClock, FiEye, FiShield, FiTrendingUp } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import PriceDisplay from '../../../components/PriceDisplay';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';
import QrPreviewModal from '../../../components/modals/QrPreviewModal';

import { fmtDate, fmtDateTime } from '../../../utils/format';
import { formatStatus, getDepositStatusBadge, getStatusColor } from '../../../utils/status';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';

const CashPaymentsPage = () => {
  const [data, setData] = useState({
    transactions: [],
    summary: { pendingVerification: 0, verifiedCash: 0, disputedCash: 0, providerCashLiability: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchCashLedger = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page: currentPage, limit, search: debouncedSearch });
      const res = await TransactionService.getCashLedger(params);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setPaginationData({
          total: res.data.data.total || res.data.data.transactions?.length || 0,
          pages: res.data.data.totalPages || 1
        });
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
  }, [currentPage, limit, debouncedSearch]);

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl mr-3">
              <FiDollarSign className="w-6 h-6" />
            </span>
            Cash Collection Management Module
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise COD cash tracking, provider liabilities, auto-verification safeguards, and bank deposit reconciliation.
          </p>
        </div>
        <button
          onClick={fetchCashLedger}
          className="text-xs bg-amber-600 text-white px-4 py-2.5 rounded-xl hover:bg-amber-700 font-bold shadow-xs transition-all flex items-center gap-1.5 self-start md:self-auto"
        >
          <FiShield className="w-4 h-4" /> Refresh Ledger
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
        <div className="p-4 bg-amber-50/80 rounded-xl border border-amber-200/60 text-xs text-amber-900 flex items-start">
          <FiAlertTriangle className="w-5 h-5 mr-2.5 flex-shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong>Auto-Verification Safeguard:</strong> Cash collections are tracked as <strong>Collected (Pending Verification)</strong> upon job completion and verified strictly via system trust rules or admin audit.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold uppercase">Pending Verification</p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              <PriceDisplay amount={data.summary?.pendingVerification || 0} />
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold uppercase">Verified Cash</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              <PriceDisplay amount={data.summary?.verifiedCash || 0} />
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold uppercase">Disputed / Unresolved</p>
            <p className="text-2xl font-black text-rose-600 mt-1">
              <PriceDisplay amount={data.summary?.disputedCash || 0} />
            </p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 font-semibold uppercase">Active Provider Liability</p>
            <p className="text-2xl font-black text-blue-600 mt-1">
              <PriceDisplay amount={data.summary?.providerCashLiability || 0} />
            </p>
          </div>
        </div>
      </div>

      {/* 17-Column Main Cash Collection Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} columns={17} standalone />
        ) : error ? (
          <div className="p-6 text-center text-rose-600 font-semibold text-sm">{error}</div>
        ) : data.transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No cash collection records found in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1400px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3.5">Cash ID</th>
                  <th className="p-3.5">Booking ID</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Provider</th>
                  <th className="p-3.5">Service</th>
                  <th className="p-3.5">Zone</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Collected By</th>
                  <th className="p-3.5">Verified By</th>
                  <th className="p-3.5">Verification</th>
                  <th className="p-3.5">Collection</th>
                  <th className="p-3.5">Settlement</th>
                  <th className="p-3.5">Deposit</th>
                  <th className="p-3.5">Collection Date</th>
                  <th className="p-3.5">Verification Date</th>
                  <th className="p-3.5">Created At</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.transactions.map((txn) => {
                  const isVerified = txn.verificationStatus === 'Verified';

                  return (
                    <tr key={txn._id} className="hover:bg-amber-50/30 transition-colors">

                      {/* 1. Cash ID */}
                      <td className="p-3.5 font-mono font-bold text-amber-700">
                        <button
                          onClick={() => openInvestigationDrawer('cash_payment', txn._id, txn)}
                          className="hover:underline"
                        >
                          {txn.cashId || txn.transactionId || `#${txn._id.slice(-6)}`}
                        </button>
                      </td>

                      {/* 2. Booking ID */}
                      <td className="p-3.5 font-semibold">
                        <button
                          onClick={() => openInvestigationDrawer('booking', txn.booking?._id || txn.bookingId || txn.booking)}
                          className="hover:underline text-blue-600 font-bold"
                        >
                          {txn.bookingIdDisplay || txn.booking?.bookingId || 'N/A'}
                        </button>
                      </td>

                      {/* 3. Customer */}
                      <td className="p-3.5 text-slate-800">
                        <button
                          onClick={() => openInvestigationDrawer('customer', txn.user?._id || txn.user)}
                          className="hover:underline text-slate-800 font-semibold"
                        >
                          {txn.user?.name || 'Customer'}
                        </button>
                      </td>

                      {/* 4. Provider */}
                      <td className="p-3.5 text-slate-800">
                        <button
                          onClick={() => openInvestigationDrawer('provider', txn.provider?._id || txn.provider)}
                          className="hover:underline text-slate-800 font-semibold"
                        >
                          {txn.provider?.name || 'Assigned Provider'}
                        </button>
                      </td>

                      {/* 5. Service */}
                      <td className="p-3.5 text-slate-700 truncate max-w-[140px]" title={txn.serviceName}>
                        {txn.serviceName || 'Home Service'}
                      </td>

                      {/* 6. Zone */}
                      <td className="p-3.5 text-slate-500">
                        {txn.zoneName || 'Default Zone'}
                      </td>

                      {/* 7. Amount */}
                      <td className="p-3.5 font-black text-slate-900">
                        <PriceDisplay amount={txn.amount || 0} />
                      </td>

                      {/* 8. Collected By */}
                      <td className="p-3.5 text-slate-700">
                        {txn.collectedBy || txn.provider?.name || 'Provider'}
                      </td>

                      {/* 9. Verified By */}
                      <td className="p-3.5 text-slate-500">
                        {txn.verifiedBy || (isVerified ? 'System Rule' : 'Unverified')}
                      </td>

                      {/* 10. Verification Status */}
                      <td className="p-3.5">
                        {isVerified ? (
                          (txn.paymentMethod === 'upi' || txn.description?.includes('QR')) ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-extrabold border border-indigo-200">
                              <FiCheckCircle className="mr-1" /> QR VERIFIED
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-extrabold border border-emerald-200">
                              <FiCheckCircle className="mr-1" /> CASH VERIFIED
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-extrabold border border-amber-200">
                            <FiClock className="mr-1" /> PENDING VERIFY
                          </span>
                        )}
                      </td>

                      {/* 11. Collection Status */}
                      <td className="p-3.5">
                        {(() => {
                          const rawCollection = txn.collectionStatus || 'Collected';
                          const color = getStatusColor(rawCollection);
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${color}`}>
                              {formatStatus(rawCollection)}
                            </span>
                          );
                        })()}
                      </td>

                      {/* 12. Settlement Status */}
                      <td className="p-3.5">
                        {(() => {
                          const rawSettlement = txn.settlementStatus || (isVerified ? 'Settled' : 'Pending Settlement');
                          const color = getStatusColor(rawSettlement);
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${color}`}>
                              {formatStatus(rawSettlement)}
                            </span>
                          );
                        })()}
                      </td>

                      {/* 13. Deposit Status */}
                      <td className="p-3.5">
                        {(() => {
                          const rawDeposit = txn.depositStatus || (isVerified ? 'Deposited' : 'Pending Deposit');
                          const badge = getDepositStatusBadge(rawDeposit);
                          return (
                            <span className={badge.className}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* 14. Collection Date */}
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {fmtDate(txn.collectionDate || txn.createdAt)}
                      </td>

                      {/* 15. Verification Date */}
                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        {txn.verificationDate ? fmtDate(txn.verificationDate) : '—'}
                      </td>

                      {/* 16. Created At */}
                      <td className="p-3.5 text-slate-400 whitespace-nowrap">
                        {fmtDate(txn.createdAt)}
                      </td>

                      {/* 17. Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => openInvestigationDrawer('cash_payment', txn._id, txn)}
                          className="inline-flex items-center px-3 py-1.5 bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
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

export default CashPaymentsPage;
