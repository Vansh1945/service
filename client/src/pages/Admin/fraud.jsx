import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/auth';
import * as AdminService from '../../services/AdminService';
import {
  FiShield, FiRefreshCw, FiAlertTriangle, FiSmartphone,
  FiMapPin, FiXCircle, FiMessageSquare, FiUserX,
  FiAlertCircle, FiChevronRight, FiUser
} from 'react-icons/fi';
import Pagination from '../../components/Pagination';

// Risk Badge Component
const RiskBadge = ({ risk }) => {
  const getStyles = (riskLevel) => {
    switch (riskLevel?.toUpperCase()) {
      case 'HIGH':
      case 'CRITICAL':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'LOW':
      default:
        return 'bg-green-100 text-green-700 border-green-200';
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
  <tbody className="divide-y divide-gray-50">
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
      <Icon size={48} className="mx-auto mb-4 opacity-20" />
      <p className="font-bold text-secondary">{message}</p>
      {subMessage && <p className="text-xs mt-1">{subMessage}</p>}
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
    cancellation: []
  });
  
  // Stats
  const [stats, setStats] = useState({
    suspiciousAccounts: 0,
    totalAlerts: 0,
    highRiskProviders: 0,
    highRiskCustomers: 0
  });

  const fetchFraudData = async (tab) => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case 'ip':
          res = await AdminService.getSameIPFraud();
          if (res.data?.success) {
            setData(prev => ({ ...prev, ip: res.data.data }));
          }
          break;
        case 'device':
          res = await AdminService.getDeviceAbuse();
          if (res.data?.success) {
            setData(prev => ({ ...prev, device: res.data.data }));
          }
          break;
        case 'cancellation':
          res = await AdminService.getCancellationAlerts();
          if (res.data?.success) {
            setData(prev => ({ ...prev, cancellation: res.data.data }));
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
        AdminService.getSameIPFraud().catch(() => ({ data: { data: [] } })),
        AdminService.getDeviceAbuse().catch(() => ({ data: { data: [] } })),
        AdminService.getCancellationAlerts().catch(() => ({ data: { data: [] } }))
      ]);

      const ipData = ipRes.data?.data || [];
      const deviceData = deviceRes.data?.data || [];
      const cancelData = cancelRes.data?.data || [];

      // Calculate stats
      const suspiciousAccounts = ipData.reduce((acc, curr) => acc + curr.totalAccounts, 0) + 
                                deviceData.reduce((acc, curr) => acc + curr.accounts, 0);
      
      const totalAlerts = ipData.length + deviceData.length + cancelData.length;
      
      const highRiskCustomers = cancelData.filter(c => c.suspicious).length;
                                
      // Simplified high risk providers calculation
      const highRiskProviders = 0; // Fake reviews were driving this

      setStats({
        suspiciousAccounts,
        totalAlerts,
        highRiskProviders,
        highRiskCustomers
      });

      // Update current tab data if it was fetched
      setData({
        ip: ipData,
        device: deviceData,
        cancellation: cancelData
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
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-inter">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl font-black text-secondary font-poppins flex items-center gap-3">
              <span className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
                <FiShield size={24} />
              </span>
              Fraud Detection System
            </h1>
            <p className="text-sm text-gray-400 mt-1">Monitor, detect, and prevent suspicious activities on the platform</p>
          </div>
          <button 
            onClick={() => { fetchAllDataForStats(); fetchFraudData(activeTab); }}
            className="flex items-center gap-2 px-4 py-2 bg-white text-secondary border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-all font-bold text-sm"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Systems
          </button>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
              <FiUserX size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Suspicious Accounts</p>
              <p className="text-2xl font-black text-secondary">{stats.suspiciousAccounts}</p>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
              <FiAlertTriangle size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Fraud Alerts</p>
              <p className="text-2xl font-black text-secondary">{stats.totalAlerts}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
              <FiAlertCircle size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">High Risk Providers</p>
              <p className="text-2xl font-black text-secondary">{stats.highRiskProviders}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
              <FiUser size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">High Risk Customers</p>
              <p className="text-2xl font-black text-secondary">{stats.highRiskCustomers}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-50 flex overflow-x-auto gap-2 animate-fade-in delay-100">
          {[
            { id: 'ip', label: 'Same IP Detection', icon: FiMapPin },
            { id: 'device', label: 'Device Abuse', icon: FiSmartphone },
            { id: 'cancellation', label: 'Cancellation Alerts', icon: FiXCircle }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === t.id 
                ? 'bg-secondary text-white shadow-md' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-secondary'
              }`}
            >
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-50 overflow-hidden animate-slide-up">
          
          {/* TAB 1: SAME IP */}
          {activeTab === 'ip' && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">IP Address</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Accounts Linked</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Bookings</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Risk Level</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                {loading ? <TableSkeleton columns={5} /> : (
                  <tbody className="divide-y divide-gray-50">
                    {data.ip.length === 0 ? (
                      <EmptyState icon={FiMapPin} message="No suspicious IP activity detected" subMessage="All IP addresses show normal account usage patterns" />
                    ) : (
                      data.ip.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-5">
                            <span className="text-sm font-mono font-bold text-secondary">{item.suspiciousIP}</span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex -space-x-2">
                              {item.users?.slice(0, 3).map((u, i) => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px]" title={u.name}>
                                  {u.name?.charAt(0)}
                                </div>
                              ))}
                              {item.users?.length > 3 && (
                                <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-[10px]">
                                  +{item.users.length - 3}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-gray-500 mt-1 block">{item.totalAccounts} total accounts</span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-sm font-bold text-secondary">{item.totalBookings}</span>
                          </td>
                          <td className="px-6 py-5">
                            <RiskBadge risk={item.totalAccounts > 5 ? 'HIGH' : item.totalAccounts > 2 ? 'MEDIUM' : 'LOW'} />
                          </td>
                          <td className="px-6 py-5">
                            <button className="text-primary hover:text-primary/80 font-bold text-sm flex items-center gap-1 transition-colors">
                              View Details <FiChevronRight size={16} />
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
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">User Agent / Device Info</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Accounts</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Risk Level</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                {loading ? <TableSkeleton columns={4} /> : (
                  <tbody className="divide-y divide-gray-50">
                    {data.device.length === 0 ? (
                      <EmptyState icon={FiSmartphone} message="No device abuse detected" subMessage="Device usage patterns look normal" />
                    ) : (
                      data.device.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-5">
                            <div className="max-w-md">
                              <p className="text-xs font-mono text-gray-500 truncate" title={item.device}>{item.device}</p>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-sm font-bold text-secondary">{item.accounts} accounts</span>
                          </td>
                          <td className="px-6 py-5">
                            <RiskBadge risk={item.accounts > 5 ? 'HIGH' : item.accounts > 3 ? 'MEDIUM' : 'LOW'} />
                          </td>
                          <td className="px-6 py-5">
                            <button className="text-primary hover:text-primary/80 font-bold text-sm flex items-center gap-1 transition-colors">
                              View Accounts <FiChevronRight size={16} />
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
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Total Bookings</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Cancelled</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Rate</th>
                    <th className="px-6 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">Risk</th>
                  </tr>
                </thead>
                {loading ? <TableSkeleton columns={6} /> : (
                  <tbody className="divide-y divide-gray-50">
                    {data.cancellation.length === 0 ? (
                      <EmptyState icon={FiXCircle} message="No high cancellation alerts" subMessage="All users are within normal cancellation thresholds" />
                    ) : (
                      data.cancellation.map((item, idx) => (
                        <tr key={idx} className={`hover:bg-gray-50/50 transition-colors ${item.suspicious ? 'bg-red-50/30' : ''}`}>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black text-[10px]">
                                {item.user?.name?.charAt(0)}
                              </div>
                              <div>
                                <span className="text-sm font-bold text-secondary block">{item.user?.name}</span>
                                <span className="text-[10px] text-gray-400">{item.user?.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-xs font-bold uppercase text-gray-500">{item.user?.role}</span>
                          </td>
                          <td className="px-6 py-5 text-sm font-bold text-secondary">{item.totalBookings}</td>
                          <td className="px-6 py-5 text-sm font-bold text-red-500">{item.cancelledBookings}</td>
                          <td className="px-6 py-5">
                            <span className={`text-sm font-bold ${item.cancellationRate > 50 ? 'text-red-500' : 'text-amber-500'}`}>
                              {item.cancellationRate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <RiskBadge risk={item.cancellationRate > 75 ? 'CRITICAL' : item.cancellationRate > 50 ? 'HIGH' : 'MEDIUM'} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                )}
              </table>
            </div>
          )}



        </div>
      </div>
    </div>
  );
};

export default AdminFraud;
