import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import {
  FiShield, FiRefreshCw, FiAlertTriangle, FiSmartphone,
  FiMapPin, FiXCircle, FiMessageSquare, FiUserX,
  FiAlertCircle, FiChevronRight, FiUser, FiCheckCircle,
  FiInfo, FiSearch, FiActivity, FiClock, FiFileText
} from 'react-icons/fi';
import Pagination from '../../components/Pagination';

// Risk Badge Component
const RiskBadge = ({ risk }) => {
  const getStyles = (riskLevel) => {
    switch (riskLevel?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'MEDIUM':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'LOW':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStyles(risk)}`}>
      {risk || 'LOW'}
    </span>
  );
};

// Skeleton Loader
const TableSkeleton = ({ columns }) => (
  <tbody className="divide-y divide-gray-100">
    {Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="animate-pulse">
        {Array.from({ length: columns }).map((_, j) => (
          <td key={j} className="px-6 py-5">
            <div className="h-4 bg-gray-100 rounded-full w-24" />
          </td>
        ))}
      </tr>
    ))}
  </tbody>
);

// Empty State
const EmptyState = ({ icon: Icon, message, subMessage }) => (
  <tr>
    <td colSpan="100%" className="px-6 py-20 text-center text-gray-400">
      <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100">
        <Icon size={28} className="text-gray-300" />
      </div>
      <p className="font-bold text-gray-700 text-sm">{message}</p>
      {subMessage && <p className="text-xs text-gray-400 mt-1">{subMessage}</p>}
    </td>
  </tr>
);

const AdminFraud = () => {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('ip');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    ip: [],
    device: [],
    cancellation: [],
    sessions: []
  });
  
  // Stats
  const [stats, setStats] = useState({
    suspiciousAccounts: 0,
    totalAlerts: 0,
    highRiskProviders: 0,
    highRiskCustomers: 0
  });

  // Filters & Pagination
  const [filterRisk, setFilterRisk] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  // Modals / Deep-Dive State
  const [selectedItem, setSelectedItem] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [suspendingUser, setSuspendingUser] = useState(null);
  const [suspensionReason, setSuspensionReason] = useState('');

  const fetchFraudData = async (tab) => {
    setLoading(true);
    try {
      let res;
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        risk: filterRisk || undefined,
        date: filterDate !== 'all' ? filterDate : undefined
      };

      switch (tab) {
        case 'ip':
          res = await AdminService.getSameIPFraud(params);
          if (res.data?.success) {
            setData(prev => ({ ...prev, ip: res.data.data }));
            setTotalPages(res.data.pagination?.pages || 1);
          }
          break;
        case 'device':
          res = await AdminService.getDeviceAbuse(params);
          if (res.data?.success) {
            setData(prev => ({ ...prev, device: res.data.data }));
            setTotalPages(res.data.pagination?.pages || 1);
          }
          break;
        case 'cancellation':
          res = await AdminService.getCancellationAlerts(params);
          if (res.data?.success) {
            setData(prev => ({ ...prev, cancellation: res.data.data }));
            setTotalPages(res.data.pagination?.pages || 1);
          }
          break;
        case 'sessions':
          res = await AdminService.getActiveSessions({ ...params, role: filterRisk === 'PROVIDER' ? 'provider' : 'customer' });
          if (res.data?.success) {
            setData(prev => ({ ...prev, sessions: res.data.data }));
            setTotalPages(res.data.pagination?.pages || 1);
          }
          break;
      }
    } catch (err) {
      showToast('Failed to fetch fraud data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDataForStats = async () => {
    try {
      const [ipRes, deviceRes, cancelRes] = await Promise.all([
        AdminService.getSameIPFraud({ page: 1, limit: 100 }),
        AdminService.getDeviceAbuse({ page: 1, limit: 100 }),
        AdminService.getCancellationAlerts({ page: 1, limit: 100 })
      ]);

      const ipData = ipRes.data?.data || [];
      const deviceData = deviceRes.data?.data || [];
      const cancelData = cancelRes.data?.data || [];

      // Calculate stats based on actual data
      const suspiciousAccounts = ipData.reduce((acc, curr) => acc + (curr.users?.length || 0), 0) + 
                                 deviceData.reduce((acc, curr) => acc + (curr.users?.length || 0), 0);
      
      const totalAlerts = ipData.length + deviceData.length + cancelData.length;
      const highRiskCustomers = cancelData.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL').length;
      const highRiskProviders = cancelData.filter(c => c.role === 'provider' && (c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL')).length;

      setStats({
        suspiciousAccounts,
        totalAlerts,
        highRiskProviders,
        highRiskCustomers
      });
      
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  useEffect(() => {
    fetchAllDataForStats();
  }, []);

  useEffect(() => {
    fetchFraudData(activeTab);
  }, [activeTab, filterRisk, filterDate, currentPage]);

  const handleRefresh = () => {
    fetchAllDataForStats();
    fetchFraudData(activeTab);
    showToast('Fraud detection metrics synchronized.', 'success');
  };

  // Administrative Actions
  const handleMarkSafe = async (id, isSafe) => {
    try {
      const res = await AdminService.markFraudLogSafe(id, { isSafe });
      if (res.data?.success) {
        showToast(res.data.message || 'Log risk override updated successfully', 'success');
        fetchFraudData(activeTab);
        if (selectedItem) {
          setSelectedItem(prev => ({ ...prev, isSafe, riskLevel: isSafe ? 'LOW' : prev.riskLevel }));
        }
      }
    } catch (err) {
      showToast('Failed to apply override', 'error');
    }
  };

  const handleAddNote = async (id) => {
    if (!newNote.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await AdminService.addFraudLogNote(id, { note: newNote });
      if (res.data?.success) {
        showToast('Investigation note saved', 'success');
        setNewNote('');
        if (selectedItem) {
          setSelectedItem(res.data.data);
        }
        fetchFraudData(activeTab);
      }
    } catch (err) {
      showToast('Failed to save note', 'error');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleSuspendUser = async (userId, suspend) => {
    if (suspend && !suspensionReason.trim()) {
      showToast('Please provide a suspension reason', 'warning');
      return;
    }
    try {
      const res = await AdminService.suspendUserAccount(userId, {
        suspend,
        reason: suspend ? suspensionReason : undefined
      });
      if (res.data?.success) {
        showToast(res.data.message || 'Account status updated successfully', 'success');
        setSuspendingUser(null);
        setSuspensionReason('');
        // Refresh details modal users list
        if (selectedItem && selectedItem.users) {
          const updatedUsers = selectedItem.users.map(u => 
            u._id === userId ? { ...u, isSuspended: suspend } : u
          );
          setSelectedItem(prev => ({ ...prev, users: updatedUsers }));
        }
        fetchFraudData(activeTab);
      }
    } catch (err) {
      showToast('Failed to toggle account suspension', 'error');
    }
  };

  const handleForceLogout = async (userId, role) => {
    try {
      const res = await AdminService.forceLogoutUser({ userId, role });
      if (res.data?.success) {
        showToast(res.data.message, 'success');
        fetchFraudData(activeTab);
      }
    } catch (err) {
      showToast('Failed to force logout user', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-inter text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-black text-slate-900 font-poppins flex items-center gap-3">
              <span className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shadow-inner">
                <FiShield size={24} />
              </span>
              Fraud & Risk Intelligence
            </h1>
            <p className="text-sm text-slate-500 mt-1">Real-time heuristics, proxy protection, and administrative mitigation overrides</p>
          </div>
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:bg-slate-50 transition-all font-bold text-sm"
          >
            <FiRefreshCw size={15} className={loading ? "animate-spin text-red-500" : "text-slate-500"} /> Sync System
          </button>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-100">
              <FiUserX size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Suspicious Linked Accounts</p>
              <p className="text-2xl font-black text-slate-800">{stats.suspiciousAccounts}</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 border border-rose-100">
              <FiAlertTriangle size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total System Alerts</p>
              <p className="text-2xl font-black text-slate-800">{stats.totalAlerts}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100">
              <FiAlertCircle size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">High Risk Providers</p>
              <p className="text-2xl font-black text-slate-800">{stats.highRiskProviders}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 border border-orange-100">
              <FiUser size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">High Risk Customers</p>
              <p className="text-2xl font-black text-slate-800">{stats.highRiskCustomers}</p>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 overflow-x-auto w-full md:w-auto">
            {[
              { id: 'ip', label: 'Same IP Detection', icon: FiMapPin },
              { id: 'device', label: 'Device Abuse', icon: FiSmartphone },
              { id: 'cancellation', label: 'Cancellation Alerts', icon: FiXCircle },
              { id: 'sessions', label: 'Active Sessions', icon: FiShield }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setCurrentPage(1); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  activeTab === t.id 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50' 
                  : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search database..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all w-full"
              />
            </div>

            <select
              value={filterRisk}
              onChange={(e) => { setFilterRisk(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              <option value="">All Risk Levels</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              {activeTab === 'sessions' && <option value="PROVIDER">Filter: Providers</option>}
            </select>

            <select
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="24h">Past 24 Hours</option>
              <option value="7d">Past 7 Days</option>
              <option value="30d">Past 30 Days</option>
            </select>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-slide-up">
          
          {/* TAB 1: SAME IP */}
          {activeTab === 'ip' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Network Node (IP)</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Accounts Linked</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Network activity (Logins/Attempts)</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Risk Index</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Status Override</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                {loading ? <TableSkeleton columns={6} /> : (
                  <tbody className="divide-y divide-slate-100">
                    {data.ip.length === 0 ? (
                      <EmptyState icon={FiMapPin} message="No suspicious IP activity detected" subMessage="All IP addresses show normal account usage patterns" />
                    ) : (
                      data.ip
                        .filter(item => !searchQuery || item._id.includes(searchQuery))
                        .map((item, idx) => (
                          <tr key={idx} className={`hover:bg-slate-50/30 transition-colors ${item.isSafe ? 'opacity-60' : ''}`}>
                            <td className="px-6 py-5">
                              <span className="text-sm font-mono font-bold text-slate-950 flex items-center gap-1.5">
                                <FiMapPin className="text-slate-400" size={14} />
                                {item._id}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5 block flex items-center gap-1">
                                <FiClock size={10} /> Last active: {new Date(item.lastActive).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex -space-x-2 mb-1.5">
                                {item.users?.slice(0, 4).map((u, i) => (
                                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-[10px] text-white shadow-sm ${u.isSuspended ? 'bg-rose-500' : u.role === 'provider' ? 'bg-indigo-500' : 'bg-emerald-500'}`} title={`${u.name} (${u.role})`}>
                                    {u.name?.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {item.users?.length > 4 && (
                                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px] shadow-sm">
                                    +{item.users.length - 4}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 font-medium">{item.users?.length || 0} unique accounts</span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                                <span className="bg-slate-100 px-2 py-1 rounded-md text-[10px]" title="Successful Logins">IN: {item.logins}</span>
                                <span className="bg-red-50 text-red-600 px-2 py-1 rounded-md text-[10px]" title="Failed Logins">BAD: {item.failedLogins}</span>
                                <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-[10px]" title="Registrations">REG: {item.registrations}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1 items-start">
                                <RiskBadge risk={item.isSafe ? 'LOW' : item.riskLevel} />
                                <span className="text-[10px] text-slate-400 font-mono">Score: {item.maxFraudScore}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <button 
                                onClick={() => handleMarkSafe(item._id, !item.isSafe)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                                  item.isSafe 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {item.isSafe ? '✓ Marked Safe' : 'Mark Safe'}
                              </button>
                            </td>
                            <td className="px-6 py-5">
                              <button 
                                onClick={() => setSelectedItem(item)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center gap-1 transition-colors"
                              >
                                Deep-Dive <FiChevronRight size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                )}
              </table>
            </div>
          )}

          {/* TAB 2: DEVICE ABUSE */}
          {activeTab === 'device' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Device Hash / Details</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Accounts Linked</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Device Activity (OTP/Cancellations)</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Risk Index</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Status Override</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                {loading ? <TableSkeleton columns={6} /> : (
                  <tbody className="divide-y divide-slate-100">
                    {data.device.length === 0 ? (
                      <EmptyState icon={FiSmartphone} message="No device abuse detected" subMessage="Device usage patterns look normal" />
                    ) : (
                      data.device
                        .filter(item => {
                          if (!searchQuery) return true;
                          const query = searchQuery.toLowerCase();
                          if (item._id.includes(searchQuery)) return true;
                          const detailsStr = typeof item.deviceDetails === 'string' 
                            ? item.deviceDetails.toLowerCase() 
                            : JSON.stringify(item.deviceDetails || {}).toLowerCase();
                          return detailsStr.includes(query);
                        })
                        .map((item, idx) => (
                          <tr key={idx} className={`hover:bg-slate-50/30 transition-colors ${item.isSafe ? 'opacity-60' : ''}`}>
                            <td className="px-6 py-5">
                              <div className="max-w-md">
                                <span className="text-xs font-mono font-bold text-slate-900 truncate block flex items-center gap-1.5">
                                  <FiSmartphone className="text-slate-400" size={14} />
                                  {item._id.substring(0, 16)}...
                                </span>
                                <span 
                                  className="text-[10px] text-slate-500 block truncate mt-0.5" 
                                  title={typeof item.deviceDetails === 'string' ? item.deviceDetails : JSON.stringify(item.deviceDetails)}
                                >
                                  {typeof item.deviceDetails === 'string' 
                                    ? item.deviceDetails 
                                    : (item.deviceDetails ? `${item.deviceDetails.platform || 'Unknown OS'} - ${item.deviceDetails.userAgent?.substring(0, 30) || 'Unknown Browser'}` : 'Standard browser specifications')}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex -space-x-2 mb-1.5">
                                {item.users?.slice(0, 4).map((u, i) => (
                                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold text-[10px] text-white shadow-sm ${u.isSuspended ? 'bg-rose-500' : u.role === 'provider' ? 'bg-indigo-500' : 'bg-emerald-500'}`} title={`${u.name} (${u.role})`}>
                                    {u.name?.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {item.users?.length > 4 && (
                                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px] shadow-sm">
                                    +{item.users.length - 4}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-slate-500 font-medium">{item.users?.length || 0} unique accounts</span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                                <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md text-[10px]" title="OTP Requests">OTP: {item.otpRequests}</span>
                                <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded-md text-[10px]" title="Booking Cancellations">CANCELS: {item.cancellations}</span>
                                <span className="bg-slate-100 px-2 py-1 rounded-md text-[10px]">TOTAL: {item.logsCount}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1 items-start">
                                <RiskBadge risk={item.isSafe ? 'LOW' : item.riskLevel} />
                                <span className="text-[10px] text-slate-400 font-mono">Score: {item.maxFraudScore}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <button 
                                onClick={() => handleMarkSafe(item._id, !item.isSafe)}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                                  item.isSafe 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                {item.isSafe ? '✓ Marked Safe' : 'Mark Safe'}
                              </button>
                            </td>
                            <td className="px-6 py-5">
                              <button 
                                onClick={() => setSelectedItem(item)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center gap-1 transition-colors"
                              >
                                Deep-Dive <FiChevronRight size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                )}
              </table>
            </div>
          )}

          {/* TAB 3: CANCELLATION ALERTS */}
          {activeTab === 'cancellation' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Account Details</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Booking Context</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Dynamic Risk Reasons</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Fraud Score</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Risk Level</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                {loading ? <TableSkeleton columns={6} /> : (
                  <tbody className="divide-y divide-slate-100">
                    {data.cancellation.length === 0 ? (
                      <EmptyState icon={FiXCircle} message="No high cancellation alerts" subMessage="All users are within normal cancellation thresholds" />
                    ) : (
                      data.cancellation
                        .filter(item => {
                          if (!searchQuery) return true;
                          const name = item.user?.name || '';
                          const email = item.user?.email || '';
                          const bid = item.booking?.bookingId || '';
                          return name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 bid.toLowerCase().includes(searchQuery.toLowerCase());
                        })
                        .map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${item.user?.isSuspended ? 'bg-rose-500' : item.role === 'provider' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                                  {item.user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                    {item.user?.name || 'Deactivated Account'}
                                    {item.user?.isSuspended && <span className="bg-rose-100 text-rose-700 text-[8px] font-extrabold px-1 rounded">SUSPENDED</span>}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">{item.user?.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              {item.booking ? (
                                <div className="text-xs font-semibold text-slate-700">
                                  <p className="font-mono text-[11px] text-indigo-600">ID: {item.booking.bookingId}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Amount: ${item.booking.totalAmount}</p>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-5">
                              <p className="text-xs text-slate-600 font-semibold" title={item.flagReason}>
                                {item.flagReason || 'Normal cancellation'}
                              </p>
                              <span className="text-[10px] text-slate-400 mt-1 block flex items-center gap-1">
                                <FiClock size={10} /> {new Date(item.createdAt).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-sm font-bold text-slate-800 font-mono">
                              {item.fraudScore}
                            </td>
                            <td className="px-6 py-5">
                              <RiskBadge risk={item.riskLevel} />
                            </td>
                            <td className="px-6 py-5">
                              <button 
                                onClick={() => setSelectedItem(item)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center gap-1 transition-colors"
                              >
                                View Log <FiChevronRight size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                )}
              </table>
            </div>
          )}

          {/* TAB 4: ACTIVE SESSIONS */}
          {activeTab === 'sessions' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">User Details</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Active Sessions</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Last Known IP</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Trust Score</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                {loading ? <TableSkeleton columns={5} /> : (
                  <tbody className="divide-y divide-slate-100">
                    {data.sessions.length === 0 ? (
                      <EmptyState icon={FiShield} message="No active sessions found" />
                    ) : (
                      data.sessions
                        .filter(item => !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.email.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${item.role === 'provider' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                                  {item.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">{item.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm font-bold text-slate-800 font-mono">
                              {item.activeSessions} Device(s)
                            </td>
                            <td className="px-6 py-5 text-sm font-bold text-slate-800 font-mono">
                              {item.lastLoginIp || 'Unknown'}
                            </td>
                            <td className="px-6 py-5">
                              <RiskBadge risk={item.suspiciousScore > 50 ? 'HIGH' : item.suspiciousScore > 20 ? 'MEDIUM' : 'LOW'} />
                            </td>
                            <td className="px-6 py-5">
                              <button 
                                onClick={() => handleForceLogout(item.userId, item.role)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all border bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                              >
                                Revoke Sessions
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                )}
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}

        </div>
      </div>

      {/* 🔍 DETAILED DEEP-DIVE MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-scale-in">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <FiActivity size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Deep-Dive Risk Audit</h3>
                  <p className="text-xs text-slate-400">Analyzing signature: <span className="font-mono">{selectedItem._id?.substring(0, 24)}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedItem(null)} 
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-700">
              
              {/* Top Overview Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">Risk Rating</span>
                  <RiskBadge risk={selectedItem.isSafe ? 'LOW' : selectedItem.riskLevel} />
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">Agg Fraud Score</span>
                  <span className="text-base font-black text-slate-800 font-mono">{selectedItem.isSafe ? 0 : selectedItem.maxFraudScore || selectedItem.fraudScore || 0}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold mb-0.5">Alert Origin</span>
                  <span className="text-xs font-bold text-slate-800 capitalize flex items-center gap-1 mt-0.5">
                    <FiInfo size={12} className="text-slate-400" />
                    {selectedItem.actionType || activeTab}
                  </span>
                </div>
              </div>

              {/* Suspicious parameters/reasons for cancellation */}
              {selectedItem.flagReason && (
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3 text-rose-800">
                  <FiAlertTriangle className="text-rose-500 mt-0.5 shrink-0" size={18} />
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wide">Threat Flag Reasons</h4>
                    <p className="text-xs mt-0.5 font-medium">{selectedItem.flagReason}</p>
                  </div>
                </div>
              )}

              {/* Linked Accounts List */}
              <div>
                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <FiUser size={14} className="text-indigo-500" />
                  Linked Accounts ({selectedItem.users?.length || (selectedItem.user ? 1 : 0)})
                </h4>
                
                <div className="space-y-3">
                  {/* Handle IP/Device linked users array */}
                  {selectedItem.users && selectedItem.users.map((u, idx) => (
                    <div key={idx} className="bg-slate-50 p-4 border border-slate-100 rounded-2xl flex items-center justify-between hover:bg-slate-100/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${u.isSuspended ? 'bg-rose-500' : u.role === 'provider' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                          {u.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            {u.name} 
                            <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">{u.role}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{u.email} • {u.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (u.isSuspended) {
                            handleSuspendUser(u._id, false);
                          } else {
                            setSuspendingUser(u._id);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          u.isSuspended 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                          : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {u.isSuspended ? '✓ Reactivate' : 'Suspend'}
                      </button>
                    </div>
                  ))}

                  {/* Handle Cancellation Single User */}
                  {selectedItem.user && !selectedItem.users && (
                    <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${selectedItem.user.isSuspended ? 'bg-rose-500' : selectedItem.user.role === 'provider' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                          {selectedItem.user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            {selectedItem.user.name} 
                            <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">{selectedItem.user.role}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedItem.user.email} • {selectedItem.user.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          if (selectedItem.user.isSuspended) {
                            handleSuspendUser(selectedItem.userId, false);
                          } else {
                            setSuspendingUser(selectedItem.userId);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                          selectedItem.user.isSuspended 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' 
                          : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {selectedItem.user.isSuspended ? '✓ Reactivate' : 'Suspend'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Security & Verification Log Audits */}
              {selectedItem.recentLogs && selectedItem.recentLogs.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                    <FiShield className="text-rose-500 animate-pulse" size={14} />
                    Security & Verification Log Audits ({selectedItem.recentLogs.length})
                  </h4>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {selectedItem.recentLogs.map((log, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col gap-1.5 hover:bg-slate-100/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wide bg-slate-200/60 px-2 py-0.5 rounded">
                            {log.actionType}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.flagReason && (
                          <p className="text-xs font-medium text-rose-700 bg-rose-50/50 border border-rose-100 px-2.5 py-1 rounded-xl">
                            {log.flagReason}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                          <span>Risk: <span className={log.riskLevel === 'CRITICAL' || log.riskLevel === 'HIGH' ? 'text-red-600 font-bold' : 'text-slate-600'}>{log.riskLevel}</span></span>
                          <span>Score: <span className="font-mono text-slate-800">{log.fraudScore}</span></span>
                          {log.bookingId && (
                            <span className="font-mono text-indigo-600">Booking: {log.bookingId}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Investigation Notes Timeline */}
              <div>
                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                  <FiFileText className="text-indigo-500" size={14} />
                  Case Investigation Notes
                </h4>
                
                {/* Notes History */}
                <div className="space-y-2 max-h-[150px] overflow-y-auto mb-3 pr-1">
                  {!selectedItem.notes || selectedItem.notes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No notes recorded for this threat node yet. Add one below to initialize case history.</p>
                  ) : (
                    selectedItem.notes.map((n, i) => (
                      <div key={i} className="bg-slate-50 p-3 border border-slate-100 rounded-xl">
                        <p className="text-xs text-slate-600 font-medium">{n.note}</p>
                        <p className="text-[9px] text-slate-400 mt-1 flex items-center justify-between font-mono">
                          <span>By Admin: {n.admin || 'System Admin'}</span>
                          <span>{new Date(n.createdAt).toLocaleString()}</span>
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add new note input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Append internal audit or verification notes..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs bg-slate-50 focus:bg-white transition-all"
                  />
                  <button
                    onClick={() => handleAddNote(selectedItem._id)}
                    disabled={submittingNote || !newNote.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center gap-1.5"
                  >
                    Add Note
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FiCheckCircle size={15} className={selectedItem.isSafe ? "text-emerald-500 animate-pulse" : "text-slate-300"} />
                <span className="text-xs text-slate-500 font-medium">
                  {selectedItem.isSafe ? 'Verified and whitelisted safe' : 'Threat requires attention'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-300 transition-all"
                >
                  Close Audit
                </button>
                <button
                  onClick={() => handleMarkSafe(selectedItem._id, !selectedItem.isSafe)}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border ${
                    selectedItem.isSafe
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700 shadow'
                  }`}
                >
                  {selectedItem.isSafe ? 'Revoke Safe Status' : 'Whitelist Safe'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ⚠️ ACCONT SUSPENSION REASON MODAL */}
      {suspendingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-scale-in border border-rose-100">
            
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2.5 bg-rose-50">
              <div className="w-9 h-9 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 shadow-inner">
                <FiUserX size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Confirm Account Suspension</h3>
                <p className="text-xs text-slate-400">Lock user credentials and restrict system endpoints</p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-500 leading-relaxed font-semibold">
                Are you sure you want to suspend this account? The suspended user will be instantly logged out and blocked from logging into the customer or provider panels.
              </p>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Suspension Reason (Required)</label>
                <textarea
                  placeholder="e.g. Account linked to device fingerprint showing cancellation abuse..."
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs bg-slate-50 focus:bg-white transition-all h-24 resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => { setSuspendingUser(null); setSuspensionReason(''); }}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSuspendUser(suspendingUser, true)}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 shadow"
              >
                Confirm Block
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default AdminFraud;
