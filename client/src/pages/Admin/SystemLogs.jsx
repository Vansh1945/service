import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import { FiTerminal, FiRefreshCw, FiCopy, FiDownload, FiSearch } from 'react-icons/fi';
import Pagination from '../../components/Pagination';

const LevelBadge = ({ level }) => {
  const getStyles = (l) => {
    switch (l?.toUpperCase()) {
      case 'ERROR':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'WARN':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'INFO':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStyles(level)}`}>
      {level || 'UNKNOWN'}
    </span>
  );
};

const TableSkeleton = () => (
  <tbody className="divide-y divide-gray-50">
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded-full w-32" /></td>
        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded-full w-16" /></td>
        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded-full w-full" /></td>
        <td className="px-6 py-4"><div className="h-4 bg-gray-100 rounded-full w-8" /></td>
      </tr>
    ))}
  </tbody>
);

const SystemLogs = () => {
  const { showToast } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    pages: 0,
    level: 'ALL'
  });

  const fetchLogs = useCallback(async (isAuto = false) => {
    if (!isAuto) setLoading(true);
    try {
      const res = await AdminService.getSystemLogs({
        page: pagination.page,
        limit: pagination.limit,
        level: pagination.level
      });
      if (res.data?.success) {
        setLogs(res.data.logs);
        setPagination(prev => ({
          ...prev,
          total: res.data.total,
          pages: res.data.pages
        }));
      }
    } catch (err) {
      if (!isAuto) showToast('Failed to fetch system logs', 'error');
    } finally {
      if (!isAuto) setLoading(false);
    }
  }, [pagination.page, pagination.limit, pagination.level, showToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchLogs(true);
      }, 10000); // 10 seconds
    }
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs]);

  const handleCopy = (message) => {
    navigator.clipboard.writeText(message);
    showToast('Log copied to clipboard', 'success');
  };

  const handleDownload = () => {
    const textData = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    const blob = new Blob([textData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system_logs_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter(log => 
    log.message?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.timestamp?.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-inter">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-black text-secondary font-poppins flex items-center gap-3">
              <span className="w-12 h-12 bg-gray-800 rounded-2xl flex items-center justify-center text-white shadow-lg">
                <FiTerminal size={24} />
              </span>
              System Logs
            </h1>
            <p className="text-sm text-gray-400 mt-1">Real-time system health, API requests, and application logs</p>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-500 cursor-pointer">
              <input 
                type="checkbox" 
                checked={autoRefresh} 
                onChange={(e) => setAutoRefresh(e.target.checked)} 
                className="w-4 h-4 rounded text-primary focus:ring-primary/20 border-gray-300"
              />
              Auto-refresh (10s)
            </label>
            <button 
              onClick={() => fetchLogs()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-secondary border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all font-bold text-sm"
            >
              <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white border border-primary/10 rounded-xl shadow-sm hover:shadow-md transition-all font-bold text-sm"
            >
              <FiDownload size={14} /> Download
            </button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center animate-slide-up">
          <div className="flex overflow-x-auto gap-2 w-full md:w-auto">
            {['ALL', 'INFO', 'WARN', 'ERROR'].map(level => (
              <button
                key={level}
                onClick={() => {
                  setPagination(p => ({ ...p, level, page: 1 }));
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  pagination.level === level 
                  ? 'bg-gray-800 text-white shadow-md' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {level}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-gray-200 outline-none"
            />
          </div>
        </div>

        {/* Log Viewer */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-slide-up">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest w-48">Timestamp</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest w-24">Level</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">Message</th>
                  <th className="px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest w-16">Action</th>
                </tr>
              </thead>
              {loading && logs.length === 0 ? (
                <TableSkeleton />
              ) : (
                <tbody className="divide-y divide-gray-50 font-mono text-xs">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-400">
                        No logs found matching your criteria
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{log.timestamp || 'N/A'}</td>
                        <td className="px-6 py-3">
                          {log.level ? <LevelBadge level={log.level} /> : <span className="text-gray-400">RAW</span>}
                        </td>
                        <td className="px-6 py-3 text-gray-700 break-all">{log.message || log}</td>
                        <td className="px-6 py-3">
                          <button 
                            onClick={() => handleCopy(log.message || log)}
                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Copy Log"
                          >
                            <FiCopy size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
          
          {pagination.pages > 1 && (
            <div className="p-4 border-t border-gray-100 bg-gray-50/50">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={(page) => setPagination(p => ({ ...p, page }))}
              />
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SystemLogs;
