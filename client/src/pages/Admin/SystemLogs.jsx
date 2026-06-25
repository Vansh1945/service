
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import { FiTerminal, FiRefreshCw, FiCopy, FiDownload, FiSearch, FiActivity, FiAlertTriangle, FiClock } from 'react-icons/fi';
import Pagination from '../../components/Pagination';
import StatsCard from '../../components/ui/StatsCard';

// LevelBadge component to show INFO, WARNING, ERROR beautifully
const LevelBadge = ({ level }) => {
  const getStyles = (l) => {
    switch (l?.toUpperCase()) {
      case 'ERROR':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'WARN':
      case 'WARNING':
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

// Parser engine to split the raw logs into structured data properties
const parseLogMessage = (message) => {
  if (!message) return { method: '-', endpoint: '-', status: '-', responseTime: '-', role: '-', userId: '-', ip: '-', isHttp: false };

  const trimmed = message.trim();
  const match = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS) ([^ ]+) ([0-9]{3}) ([0-9.]+) ms(?: - Role: ([^ ]+) - UserID: ([^ ]+) - IP: ([^ ]+))?/);

  if (match) {
    const [_, method, path, status, time, role, userId, ip] = match;
    const cleanEndpoint = path.split('?')[0];
    return {
      method,
      endpoint: cleanEndpoint,
      status: parseInt(status),
      responseTime: `${Math.round(parseFloat(time))} ms`,
      role: role || '-',
      userId: userId || '-',
      ip: ip || '-',
      isHttp: true
    };
  }

  return {
    method: '-',
    endpoint: trimmed,
    status: '-',
    responseTime: '-',
    role: '-',
    userId: '-',
    ip: '-',
    isHttp: false
  };
};

// Module detection utility from endpoints
const detectModule = (endpoint) => {
  if (!endpoint || endpoint === '-') return 'SYSTEM';
  const lower = endpoint.toLowerCase();

  // Prioritize prefix matching for major actor routes
  if (lower.startsWith('/api/admin') || lower.includes('/admin/')) return 'ADMIN';
  if (lower.startsWith('/api/customer') || lower.includes('/customer/')) return 'CUSTOMER';
  if (lower.startsWith('/api/provider') || lower.includes('/provider/')) return 'PROVIDER';

  if (lower.includes('/system-setting')) return 'SYSTEM';
  if (lower.includes('/auth') || lower.includes('/login')) return 'AUTH';
  if (lower.includes('/payment') || lower.includes('/transaction')) return 'PAYMENT';
  if (lower.includes('/notification')) return 'NOTIFICATION';
  if (lower.includes('/booking')) return 'BOOKING';
  if (lower.includes('/question')) return 'QUESTION';
  if (lower.includes('/coupon')) return 'COUPON';
  if (lower.includes('/service')) return 'SERVICE';
  if (lower.includes('/chat')) return 'CHAT';
  if (lower.includes('/customer')) return 'CUSTOMER';
  if (lower.includes('/provider')) return 'PROVIDER';
  return 'SYSTEM';
};

// HTTP Method badges styling
const getMethodBadgeClass = (method) => {
  switch (method) {
    case 'GET': return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'POST': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    case 'PUT': return 'bg-amber-50 text-amber-600 border-amber-100';
    case 'DELETE': return 'bg-rose-50 text-rose-600 border-rose-100';
    case 'OPTIONS': return 'bg-slate-50 text-slate-400 border-slate-200';
    default: return 'bg-slate-50 text-slate-600 border-slate-200';
  }
};

const getStatusText = (status) => {
  if (status === '-') return '-';
  if (status === undefined || status === null || status === '') return 'Unknown Status';
  const code = parseInt(status);
  if (isNaN(code)) return 'Unknown Status';
  switch (code) {
    case 200: return '200 OK';
    case 201: return '201 Created';
    case 202: return '202 Accepted';
    case 204: return '204 No Content';
    case 206: return '206 Partial Content';
    case 301: return '301 Moved Permanently';
    case 302: return '302 Found';
    case 304: return '304 Cached';
    case 307: return '307 Temporary Redirect';
    case 308: return '308 Permanent Redirect';
    case 400: return '400 Bad Request';
    case 401: return '401 Unauthorized';
    case 403: return '403 Forbidden';
    case 404: return '404 Not Found';
    case 405: return '405 Method Not Allowed';
    case 408: return '408 Request Timeout';
    case 409: return '409 Conflict';
    case 410: return '410 Gone';
    case 413: return '413 Payload Too Large';
    case 415: return '415 Unsupported Media Type';
    case 422: return '422 Validation Error';
    case 429: return '429 Too Many Requests';
    case 500: return '500 Server Error';
    case 502: return '502 Bad Gateway';
    case 503: return '503 Service Unavailable';
    case 504: return '504 Gateway Timeout';
    default: return 'Unknown Status';
  }
};

const getStatusBadgeClass = (status) => {
  if (status === '-') return 'bg-slate-50 text-slate-500 border-slate-200';
  const code = parseInt(status);
  if (code >= 200 && code < 300) return 'bg-emerald-50 text-emerald-600 border-emerald-100';
  if (code >= 300 && code < 400) return 'bg-blue-50 text-blue-500 border-blue-100';
  if (code >= 400 && code < 500) return 'bg-amber-50 text-amber-600 border-amber-100';
  if (code >= 500) return 'bg-rose-50 text-rose-600 border-rose-100';
  return 'bg-slate-50 text-slate-500 border-slate-200';
};

// Response Speed Badge styling based on thresholds (<800ms green, 800-1500ms yellow, >1500ms red)
const getSpeedBadgeClass = (speedStr) => {
  if (speedStr === '-') return 'text-slate-450';
  const speed = parseInt(speedStr);
  if (isNaN(speed)) return 'text-slate-450';
  if (speed < 800) return 'bg-emerald-50 text-emerald-700 border-emerald-200/40';
  if (speed >= 800 && speed < 1500) return 'bg-amber-50 text-amber-700 border-amber-200/40';
  return 'bg-rose-50 text-rose-700 border-rose-200/40';
};

const getSpeedDotColor = (speedStr) => {
  const speed = parseInt(speedStr);
  if (isNaN(speed)) return 'bg-slate-400';
  if (speed < 800) return 'bg-emerald-500';
  if (speed >= 800 && speed < 1500) return 'bg-amber-500';
  return 'bg-rose-500';
};

const formatUser = (role, userId, ip) => {
  if (role && role !== '-') {
    const shortId = userId && userId.length > 10 ? `${userId.substring(0, 5)}...${userId.slice(-4)}` : userId;
    return `${role} (${shortId})`;
  }
  if (ip && ip !== '-') {
    return ip === '::1' || ip === '127.0.0.1' ? 'Localhost' : ip;
  }
  return 'Guest';
};



const SystemLogs = () => {
  const { showToast } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchParams] = useSearchParams();
  const searchParamQuery = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(searchParamQuery);

  useEffect(() => {
    setSearchTerm(searchParamQuery);
  }, [searchParamQuery]);

  // Custom filter selections
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [selectedModule, setSelectedModule] = useState('All Modules');

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
        level: pagination.level,
        t: Date.now()
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

  // Level & Module sync state setter
  const handleFilterChange = (filter) => {
    setSelectedFilter(filter);

    // Convert visually friendly warning to backend 'WARN'
    let backendLevel = 'ALL';
    if (filter === 'INFO') backendLevel = 'INFO';
    if (filter === 'WARNING') backendLevel = 'WARN';
    if (filter === 'ERROR') backendLevel = 'ERROR';

    setPagination(p => ({
      ...p,
      level: backendLevel,
      page: 1
    }));
  };

  // Filter & Search computation
  const filteredLogs = logs.filter(log => {
    const parsed = parseLogMessage(log.message);
    const mod = detectModule(parsed.endpoint);

    // 1. Module filter dropdown check
    if (selectedModule !== 'All Modules') {
      if (mod.toUpperCase() !== selectedModule.toUpperCase()) return false;
    }

    // 2. Level and Success code filters
    if (selectedFilter !== 'ALL') {
      if (selectedFilter === 'SUCCESS') {
        if (parsed.status === '-' || parsed.status < 200 || parsed.status >= 300) return false;
      } else {
        const targetLevel = selectedFilter === 'WARNING' ? 'WARN' : selectedFilter;
        if (log.level?.toUpperCase() !== targetLevel.toUpperCase()) return false;
      }
    }

    // 3. Robust Search match (Endpoint, Module, Method, Status, Level)
    if (searchTerm.trim() !== '') {
      const query = searchTerm.toLowerCase();
      const endpointMatch = parsed.endpoint?.toLowerCase().includes(query);
      const moduleMatch = mod.toLowerCase().includes(query);
      const methodMatch = parsed.method?.toLowerCase().includes(query);
      const statusMatch = parsed.status?.toString().includes(query);
      const levelMatch = log.level?.toLowerCase().includes(query);
      const timestampMatch = log.timestamp?.includes(query);

      return endpointMatch || moduleMatch || methodMatch || statusMatch || levelMatch || timestampMatch;
    }

    return true;
  });

  // Summary Metrics calculations
  const totalRequests = logs.filter(l => parseLogMessage(l.message).isHttp).length;
  const errorCount = logs.filter(l => l.level?.toUpperCase() === 'ERROR').length;
  const warningCount = logs.filter(l => l.level?.toUpperCase() === 'WARN' || l.level?.toUpperCase() === 'WARNING').length;

  const httpLogs = logs.map(l => parseLogMessage(l.message)).filter(p => p.isHttp);
  const totalTime = httpLogs.reduce((acc, curr) => acc + parseInt(curr.responseTime), 0);
  const avgResponseTime = httpLogs.length > 0 ? `${Math.round(totalTime / httpLogs.length)} ms` : '-';

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
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white border border-primary/10 rounded-xl shadow-sm hover:shadow-md transition-all font-bold text-sm"
            >
              <FiDownload size={14} /> Download
            </button>
          </div>
        </div>

        {/* Dynamic Summary SaaS Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
          <StatsCard
            title="Total Requests"
            value={totalRequests}
            icon={FiActivity}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
            className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          />

          <StatsCard
            title="Errors"
            value={errorCount}
            icon={FiAlertTriangle}
            iconBg="bg-rose-50"
            iconColor="text-rose-600"
            className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          />

          <StatsCard
            title="Warnings"
            value={warningCount}
            icon={FiAlertTriangle}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
            className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          />

          <StatsCard
            title="Avg Response Time"
            value={avgResponseTime}
            icon={FiClock}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            className="rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          />
        </div>

        {/* Filters Panel */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center animate-slide-up">
          <div className="flex overflow-x-auto gap-2 w-full md:w-auto pb-1 md:pb-0">
            {['ALL', 'INFO', 'WARNING', 'ERROR', 'SUCCESS'].map(filter => (
              <button
                key={filter}
                onClick={() => handleFilterChange(filter)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border ${selectedFilter === filter
                  ? 'bg-gray-800 text-white border-gray-800 shadow-md scale-95'
                  : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100 hover:text-gray-900'
                  }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
            {/* Module Filter Dropdown */}
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full sm:w-44 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              {['All Modules', 'System', 'Auth', 'Booking', 'Payment', 'Notification', 'Admin', 'Customer', 'Provider'].map(modName => (
                <option key={modName} value={modName}>{modName}</option>
              ))}
            </select>

            {/* Search Input */}

          </div>
        </div>

        {/* Real-time Logs Dashboard Grid Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-slide-up">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full min-w-[1000px] text-left border-collapse">
              <thead>
                <tr>
                  <th className="sticky top-0 bg-gray-50 z-10 px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 w-36">Timestamp</th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 w-24">Level</th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 w-28">Module</th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 w-24">Method</th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Endpoint</th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 w-44">Status</th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 w-32">User</th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 w-32">Speed</th>
                  <th className="sticky top-0 bg-gray-50 z-10 px-6 py-4 text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 w-16">Action</th>
                </tr>
              </thead>
              {loading && logs.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan="9" className="px-6 py-4">
                      <div className="space-y-4 p-4 animate-pulse">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-10 bg-slate-100 rounded-xl w-full" />
                        ))}
                      </div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody className="divide-y divide-gray-50 font-sans text-xs">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2 text-gray-400">
                          <FiSearch size={32} className="text-gray-300 animate-bounce" />
                          <p className="font-bold text-sm">No logs found for selected filter</p>
                          <p className="text-xs text-gray-400">Try adjusting your filters or search query</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => {
                      const parsed = parseLogMessage(log.message);
                      const mod = detectModule(parsed.endpoint);

                      return (
                        <tr key={idx} className="hover:bg-gray-50/80 even:bg-gray-50/30 transition-colors">
                          {/* Time column */}
                          <td className="px-6 py-3.5 text-gray-500 whitespace-nowrap font-medium">
                            {log.timestamp || 'N/A'}
                          </td>

                          {/* Level column */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            {log.level ? <LevelBadge level={log.level} /> : <span className="text-gray-400 font-bold">RAW</span>}
                          </td>

                          {/* Module column */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                              {mod}
                            </span>
                          </td>

                          {/* Method column */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            {parsed.method === '-' ? (
                              <span className="text-gray-400 font-semibold font-mono">-</span>
                            ) : (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider border ${getMethodBadgeClass(parsed.method)}`}>
                                {parsed.method}
                              </span>
                            )}
                          </td>

                          {/* Endpoint column */}
                          <td className="px-6 py-3.5 font-mono text-[11px] text-gray-700 max-w-xs truncate font-semibold" title={parsed.endpoint}>
                            {parsed.endpoint}
                          </td>

                          {/* Status Code column */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            {parsed.status === '-' ? (
                              <span className="text-gray-400 font-semibold font-mono">-</span>
                            ) : (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black tracking-wide border ${getStatusBadgeClass(parsed.status)}`}>
                                {getStatusText(parsed.status)}
                              </span>
                            )}
                          </td>

                          {/* User column */}
                          <td className="px-6 py-3.5 whitespace-nowrap font-semibold text-gray-600" title={`Full ID: ${parsed.userId || '-'}`}>
                            {formatUser(parsed.role, parsed.userId, parsed.ip)}
                          </td>

                          {/* Response time Speed column */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            {parsed.responseTime === '-' ? (
                              <span className="text-gray-400 font-semibold font-mono">-</span>
                            ) : (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${getSpeedBadgeClass(parsed.responseTime)}`}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${getSpeedDotColor(parsed.responseTime)}`}></span>
                                {parsed.responseTime}
                              </span>
                            )}
                          </td>

                          {/* Copy log column */}
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <button
                              onClick={() => handleCopy(log.message || log)}
                              className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Copy log"
                            >
                              <FiCopy size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
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
                totalItems={pagination.total}
                limit={pagination.limit}
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
