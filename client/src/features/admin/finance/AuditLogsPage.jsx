import React, { useState, useEffect, useRef } from 'react';
import { FiShield, FiEye, FiCheckCircle } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/ui/Pagination';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { fmtDate } from '../../../utils/format';
import usePagination from '../../../hooks/usePagination';
import useDebounce from '../../../hooks/useDebounce';

const AuditLogsPage = () => {
  const [data, setData] = useState({ logs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { currentPage, limit, totalItems, totalPages, onPageChange, setPaginationData } = usePagination(1, 10);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();
  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page: currentPage, limit, search: debouncedSearch });
      const res = await TransactionService.getAuditLogs(params);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setPaginationData({
          total: res.data.data.total || res.data.data.logs?.length || 0,
          pages: res.data.data.totalPages || 1
        });
      }
    } catch (err) {
      console.error("Error loading audit logs:", err);
      setError("Failed to fetch live audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage, limit, debouncedSearch]);

  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openDetail') === 'true' && data.logs?.length > 0 && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const searchVal = params.get('search');
      const target = data.logs.find(l =>
        l._id === searchVal ||
        l.bookingId === searchVal ||
        l.transactionId === searchVal ||
        l.paymentId === searchVal ||
        l.refundId === searchVal
      ) || data.logs[0];
      if (target) {
        openInvestigationDrawer('audit_log', target._id, target);
      }
    }
  }, [data.logs, openInvestigationDrawer]);

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl mr-3">
              <FiShield className="w-6 h-6" />
            </span>
            Admin Operational & Security Audit Trail
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable tracking of administrative actions, state mutations, payment verifications, refund approvals, and operational overrides.
          </p>
        </div>
        <button
          onClick={fetchAuditLogs}
          className="text-xs bg-indigo-700 text-white px-4 py-2.5 rounded-xl hover:bg-indigo-800 font-bold shadow-xs transition-all flex items-center gap-1.5 self-start md:self-auto"
        >
          <FiShield className="w-4 h-4" /> Refresh Audit Trail
        </button>
      </div>

      {/* Exact 13-Column Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1500px]">
              <tbody>
                <TableSkeleton rows={6} cols={13} />
              </tbody>
            </table>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-rose-600 font-semibold text-sm">{error}</div>
        ) : data.logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No security audit logs found in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[1500px]">
              <thead className="bg-slate-50 text-slate-700 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-100">
                <tr>
                  <th className="p-3">Action</th>
                  <th className="p-3">Module</th>
                  <th className="p-3">Admin</th>
                  <th className="p-3">Entity</th>
                  <th className="p-3">Entity ID</th>
                  <th className="p-3">Booking ID</th>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">Payment ID</th>
                  <th className="p-3">Refund ID</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">IP Address</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3 text-right">View Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {data.logs.map((log) => {
                  const act = log.actionDisplay || log.actionType || 'UPDATE';
                  const mod = log.moduleDisplay || 'Authentication';
                  const adminName = log.adminName || log.userId?.name || 'Platform Admin';
                  const entity = log.entityDisplay || log.userModel || 'Booking';
                  const entityId = log.entityIdDisplay || log._id;
                  const bId = log.bookingIdDisplay || log.bookingId?.bookingId || 'N/A';
                  const tId = log.transactionIdDisplay || log.transactionId || 'N/A';
                  const pId = log.paymentIdDisplay || log.paymentId || 'N/A';
                  const rId = log.refundIdDisplay || log.refundId || 'N/A';
                  const status = log.statusDisplay || 'Success';
                  const ip = log.ipDisplay || log.ip || '127.0.0.1';

                  return (
                    <tr key={log._id} className="hover:bg-indigo-50/20 transition-colors">

                      {/* 1. Action */}
                      <td className="p-3 font-mono font-bold text-indigo-700 uppercase">
                        {act}
                      </td>

                      {/* 2. Module */}
                      <td className="p-3 font-bold text-slate-800">{mod}</td>

                      {/* 3. Admin */}
                      <td className="p-3 font-semibold text-slate-900">{adminName}</td>

                      {/* 4. Entity */}
                      <td className="p-3 font-bold uppercase text-slate-600">{entity}</td>

                      {/* 5. Entity ID */}
                      <td className="p-3 font-mono text-slate-500">#{String(entityId).slice(-6)}</td>

                      {/* 6. Booking ID */}
                      <td className="p-3 font-bold text-blue-600">
                        {bId !== 'N/A' ? (
                          <button
                            onClick={() => openInvestigationDrawer('booking', log.bookingId?._id || log.bookingId)}
                            className="hover:underline font-mono"
                          >
                            {bId}
                          </button>
                        ) : '—'}
                      </td>

                      {/* 7. Transaction ID */}
                      <td className="p-3 font-mono text-slate-700">
                        {tId !== 'N/A' ? (
                          <button
                            onClick={() => openInvestigationDrawer('payment', tId)}
                            className="hover:underline text-blue-600 font-bold"
                          >
                            {tId}
                          </button>
                        ) : '—'}
                      </td>

                      {/* 8. Payment ID */}
                      <td className="p-3 font-mono text-slate-700">
                        {pId !== 'N/A' ? (
                          <button
                            onClick={() => openInvestigationDrawer('payment', pId)}
                            className="hover:underline text-blue-600 font-bold"
                          >
                            {pId}
                          </button>
                        ) : '—'}
                      </td>

                      {/* 9. Refund ID */}
                      <td className="p-3 font-mono text-slate-700">
                        {rId !== 'N/A' ? (
                          <button
                            onClick={() => openInvestigationDrawer('refund', rId)}
                            className="hover:underline text-rose-600 font-bold"
                          >
                            {rId}
                          </button>
                        ) : '—'}
                      </td>

                      {/* 10. Status */}
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${status === 'Success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                          <FiCheckCircle className="mr-1" /> {status}
                        </span>
                      </td>

                      {/* 11. IP Address */}
                      <td className="p-3 font-mono text-slate-500">{ip}</td>

                      {/* 12. Date & Time */}
                      <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(log.createdAt)}</td>

                      {/* 13. View Details */}
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openInvestigationDrawer('audit', log._id, log)}
                          className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-700 hover:text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
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

export default AuditLogsPage;
