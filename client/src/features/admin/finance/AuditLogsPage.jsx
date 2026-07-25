import React, { useState, useEffect } from 'react';
import { FiShield, FiUserCheck, FiClock, FiEye } from 'react-icons/fi';
import * as TransactionService from '../../../services/TransactionService';
import TableSkeleton from '../../../components/ui-skeletons/TableSkeleton';
import Pagination from '../../../components/Pagination';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import AdminFilterBar from '../../../components/AdminFilterBar';

const AuditLogsPage = () => {
  const [data, setData] = useState({ logs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { searchQuery, openInvestigationDrawer, getMergedQuery } = useAdminFilter();

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = getMergedQuery({ page, limit: 10, search: searchQuery });
      const res = await TransactionService.getAuditLogs(params);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
        setTotalPages(res.data.data.totalPages || 1);
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
  }, [page, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl mr-3">
              <FiShield className="w-6 h-6" />
            </span>
            Financial Security & Audit Logs (Live Data)
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Immutable tracking of payment verifications, refund approvals, manual wallet adjustments, and administrative overrides.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">


        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} columns={6} /></div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 font-semibold text-sm">{error}</div>
        ) : data.logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No security audit logs found in database.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 uppercase text-[11px] font-bold">
                <tr>
                  <th className="p-3.5">Action Type</th>
                  <th className="p-3.5">User / Admin ID</th>
                  <th className="p-3.5">Risk Level / Score</th>
                  <th className="p-3.5">IP Address</th>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.logs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3.5 font-semibold text-indigo-700 text-xs uppercase">
                      {log.actionType}
                    </td>
                    <td className="p-3.5 text-xs text-gray-800 font-medium">
                      {log.userId?.name || log.userId?.email || log.userModel || 'System'}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        log.riskLevel === 'HIGH' || log.riskLevel === 'CRITICAL' 
                          ? 'bg-red-50 text-red-700' 
                          : log.riskLevel === 'MEDIUM' 
                            ? 'bg-amber-50 text-amber-700' 
                            : 'bg-green-50 text-green-700'
                      }`}>
                        {log.riskLevel || 'LOW'} (Score: {log.fraudScore || 0})
                      </span>
                    </td>
                    <td className="p-3.5 text-xs font-mono text-gray-500">
                      {log.ip || '127.0.0.1'}
                    </td>
                    <td className="p-3.5 text-xs text-gray-400">
                      {new Date(log.createdAt || Date.now()).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => openInvestigationDrawer('booking', log.bookingId || log._id, log)}
                        className="inline-flex items-center px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-all"
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

export default AuditLogsPage;
