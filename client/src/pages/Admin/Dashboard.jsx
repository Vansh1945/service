import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/auth';
import { useNavigate } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import LoadingSpinner from '../../components/Loader';
import {
  FiCalendar, FiDollarSign, FiUsers, FiUser,
  FiTrendingUp, FiPieChart, FiArrowUp, FiClock,
  FiCheckCircle, FiXCircle, FiAlertTriangle, FiActivity,
  FiFilter, FiRefreshCw
} from 'react-icons/fi';
import * as AdminService from '../../services/AdminService';
import { formatDate, formatCurrency } from '../../utils/format';

// Pure helpers at module scope — created once, never re-allocated

const STATUS_COLORS = {
  completed: '#10B981',
  confirmed: '#F59E0B',
  pending: '#6B7280',
  cancelled: '#EF4444'
};

const AdminDashboard = () => {
  const { user, API } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({ period: '30d' });
  const [isReady, setIsReady] = useState(false);
  const [Recharts, setRecharts] = useState(null);

  useEffect(() => {
    import('recharts').then(module => {
      setRecharts(module);
    }).catch(err => {
      console.error("Failed to load charts library:", err);
    });
  }, []);

  const {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    PieChart, Pie, Cell, ResponsiveContainer
  } = Recharts || {};

  const fetchDashboardData = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setInitialLoading(true);
      } else {
        setLoading(true);
      }

      const response = await AdminService.getDashboardAnalytics({ period: filters.period });

      if (response.data?.success) {
        setAnalytics(response.data);
      } else {
        toast.error('Failed to fetch dashboard data');
      }

    } catch (error) {
      console.error('Dashboard Error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to load dashboard');
    } finally {
      setInitialLoading(false);
      setLoading(false);
    }
  }, [filters.period]);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Handle chart rendering delay to avoid width(-1) error
  useEffect(() => {
    if (!initialLoading && analytics) {
      const timer = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [initialLoading, analytics]);

  if (initialLoading) {
    return <LoadingSpinner />;
  }


  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <ToastContainer />

      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name || 'Admin'}</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-teal-700"
        >
          <FiRefreshCw className="mr-2" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center">
            <div className="p-2 bg-primary/10 rounded-lg mr-3">
              <FiFilter className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Global System Filter</h3>
              <p className="text-xs text-gray-500">Live analytics synchronization</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filters.period}
              onChange={(e) => setFilters(prev => ({ ...prev, period: e.target.value }))}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            >
              <option value="1d">1 Day (Today)</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Quarterly (3 Months)</option>
              <option value="180d">Last 6 Months</option>
              <option value="365d">Last 12 Months</option>
            </select>
            <button
              onClick={() => fetchDashboardData()}
              disabled={loading}
              className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {loading ? 'Updating...' : 'Apply Filter'}
            </button>
          </div>
        </div>
      </div>

      {/* LIVE COMMAND CENTER */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-zinc-900 text-white p-6 rounded-2xl border border-slate-700 shadow-xl mb-6 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-teal-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700/60 relative z-10">
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-100">Live Command Center</h2>
              <p className="text-[10px] text-slate-400">Real-time platform dispatch & infrastructure monitor</p>
            </div>
          </div>
          <span className="text-[10px] bg-slate-850 text-slate-300 font-bold px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Live Sync Status
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 relative z-10">
          {/* Live Bookings */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 p-4 rounded-xl flex flex-col justify-between hover:border-teal-500/50 transition-all duration-300 group">
            <div>
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Live Bookings</p>
                <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg group-hover:scale-110 transition-transform">
                  <FiClock size={14} className="animate-spin-slow" />
                </span>
              </div>
              <h3 className="text-2xl font-black mt-2 text-white">{analytics?.bookingStats?.inProgress || 0}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Technicians en-route or working</p>
            </div>
            <button
              onClick={() => navigate('/admin/bookings')}
              className="mt-4 w-full py-1.5 bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg hover:bg-slate-600 transition-colors uppercase tracking-wider"
            >
              Monitor Dispatch
            </button>
          </div>

          {/* Active Providers */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 p-4 rounded-xl flex flex-col justify-between hover:border-teal-500/50 transition-all duration-300 group">
            <div>
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Active Providers</p>
                <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-110 transition-transform">
                  <FiUsers size={14} />
                </span>
              </div>
              <h3 className="text-2xl font-black mt-2 text-white">{analytics?.providerStats?.active || 0}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Online & approved Providers</p>
            </div>
            <button
              onClick={() => navigate('/admin/providers')}
              className="mt-4 w-full py-1.5 bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg hover:bg-slate-600 transition-colors uppercase tracking-wider"
            >
              Manage Fleet
            </button>
          </div>

          {/* Open Complaints */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 p-4 rounded-xl flex flex-col justify-between hover:border-teal-500/50 transition-all duration-300 group">
            <div>
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Open Disputes</p>
                <span className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg group-hover:scale-110 transition-transform">
                  <FiAlertTriangle size={14} className="animate-bounce" />
                </span>
              </div>
              <h3 className="text-2xl font-black mt-2 text-white">{analytics?.pendingActions?.pendingDisputes || 0}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Disputes requiring arbitration</p>
            </div>
            <button
              onClick={() => navigate('/admin/complaints')}
              className="mt-4 w-full py-1.5 bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg hover:bg-slate-600 transition-colors uppercase tracking-wider"
            >
              Audit Dispute
            </button>
          </div>

          {/* Financial Transactions */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 p-4 rounded-xl flex flex-col justify-between hover:border-teal-500/50 transition-all duration-300 group">
            <div>
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Volume</p>
                <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg group-hover:scale-110 transition-transform">
                  <FiDollarSign size={14} />
                </span>
              </div>
              <h3 className="text-2xl font-black mt-2 text-white">₹{analytics?.revenueStats?.totalRevenue || 0}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Aggregate gross sales volume</p>
            </div>
            <button
              onClick={() => navigate('/admin/transactions')}
              className="mt-4 w-full py-1.5 bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg hover:bg-slate-600 transition-colors uppercase tracking-wider"
            >
              View Ledgers
            </button>
          </div>

          {/* Live Geolocation Maps Launcher */}
          <div className="bg-gradient-to-br from-primary/20 via-teal-900/40 to-emerald-950/20 border border-primary/40 p-4 rounded-xl flex flex-col justify-between hover:border-primary/80 transition-all duration-300 group relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full filter blur-xl pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <p className="text-[10px] font-black uppercase text-teal-300 tracking-wider">Live Maps</p>
                <span className="p-1.5 bg-primary/20 text-teal-300 rounded-lg group-hover:scale-125 transition-transform shadow-lg shadow-primary/20 animate-pulse">
                  <FiPieChart size={14} />
                </span>
              </div>
              <h3 className="text-[11px] font-extrabold mt-3 text-white uppercase tracking-wider">Geo-Monitor</h3>
              <p className="text-[9px] text-slate-300 mt-1 leading-relaxed">Density mapping & live tracking visualizer</p>
            </div>
            <button
              onClick={() => navigate('/admin/live-map')}
              className="mt-4 w-full py-2 bg-primary hover:bg-teal-700 text-white text-[10px] font-black rounded-lg transition-all duration-300 shadow-md shadow-primary/30 uppercase tracking-widest relative z-10"
            >
              Launch Live Map
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Bookings</span>
            <div className="p-2 bg-blue-50 rounded-lg">
              <FiCalendar className="text-blue-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-bold text-gray-900">{analytics?.bookingStats?.total || 0}</h4>
            <span className="text-xs text-gray-400">Total vs {analytics?.bookingStats?.completed || 0} Done</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Filter: {filters.period}</p>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Revenue Overview</span>
            <div className="p-2 bg-green-50 rounded-lg">
              <FiDollarSign className="text-green-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-bold text-gray-900">{formatCurrency(analytics?.revenueStats?.totalRevenue || 0)}</h4>
            <span className={`text-xs font-bold ${parseFloat(analytics?.revenueStats?.growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analytics?.revenueStats?.growth}%
            </span>
          </div>
          <div className="flex gap-4 mt-2 border-t pt-2 border-gray-50">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Commission</p>
              <p className="text-xs font-bold text-primary">{formatCurrency(analytics?.revenueStats?.platformCommission || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Payouts</p>
              <p className="text-xs font-bold text-orange-600">{formatCurrency(analytics?.revenueStats?.providerPayout || 0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Booking Status</span>
            <div className="p-2 bg-purple-50 rounded-lg">
              <FiPieChart className="text-purple-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Completed</p>
              <p className="text-sm font-bold text-gray-900">{analytics?.bookingStats?.completed || 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Cancelled</p>
              <p className="text-sm font-bold text-red-600">{analytics?.bookingStats?.cancelled || 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">In-Progress</p>
              <p className="text-sm font-bold text-blue-600">{analytics?.bookingStats?.inProgress || 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase font-bold">Pending</p>
              <p className="text-sm font-bold text-gray-500">{analytics?.bookingStats?.pending || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Customer Growth</span>
            <div className="p-2 bg-orange-50 rounded-lg">
              <FiUsers className="text-orange-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-bold text-gray-900">+{analytics?.customerStats?.new || 0}</h4>
            <span className="text-xs text-gray-400">of {analytics?.customerStats?.total || 0} total</span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3">
            <div
              className="bg-orange-500 h-1.5 rounded-full"
              style={{ width: `${(analytics?.customerStats?.new / (analytics?.customerStats?.total || 1)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-2 bg-primary/10 rounded-lg mr-3">
                <FiTrendingUp className="text-primary" />
              </div>
              <h3 className="font-bold text-gray-900">Revenue Analytics</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-50 px-2 py-1 rounded">Successful Bookings</span>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {filters.period.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="h-80 w-full min-h-[320px] relative overflow-hidden">
            {(!analytics?.revenueStats?.chartData?.length || !isReady) && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 rounded-xl z-10">
                <p className="text-sm text-gray-400">Synchronizing chart layout...</p>
              </div>
            )}
            {isReady && Recharts && (
              <ResponsiveContainer width="100%" height={320} minWidth={0} debounce={100}>
                <LineChart data={analytics?.revenueStats?.chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="_id"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#94a3b8' }}
                    tickFormatter={(val) => `₹${val}`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0D9488"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#0D9488', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Cancellation Reasons */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center mb-6 justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-red-50 rounded-lg mr-3">
                <FiXCircle className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">Cancellation Analysis</h3>
            </div>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded">{analytics?.cancelledStats?.rate}% Rate</span>
          </div>
          <div className="h-64 w-full min-h-[256px] relative overflow-hidden">
            {(analytics?.cancelledStats?.reasons?.length > 0 && isReady && Recharts) ? (
              <ResponsiveContainer width="100%" height={256} minWidth={0} debounce={100}>
                <PieChart>
                  <Pie
                    data={analytics?.cancelledStats?.reasons || []}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="reason"
                  >
                    {(analytics?.cancelledStats?.reasons || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                No cancellations in this period
              </div>
            )}
          </div>
          <div className="space-y-2 mt-4 max-h-32 overflow-y-auto pr-2">
            {(analytics?.cancelledStats?.reasons || []).slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981'][idx % 5] }}></div>
                  <span className="text-gray-600 truncate max-w-[120px]">{item.reason}</span>
                </div>
                <span className="font-semibold">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Providers */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="p-2 bg-primary/10 rounded-lg mr-3">
              <FiTrendingUp className="text-primary" />
            </div>
            <h3 className="font-bold text-gray-900">Top Performing Providers</h3>
          </div>
          <span className="text-xs text-gray-400 font-medium italic">Ranked by total earnings</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-4 font-semibold text-gray-500 text-sm">Provider Details</th>
                <th className="pb-4 font-semibold text-gray-500 text-sm text-center">Completed Jobs</th>
                <th className="pb-4 font-semibold text-gray-500 text-sm text-right">Total Earnings</th>
                <th className="pb-4 font-semibold text-gray-500 text-sm text-right">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(analytics?.topProviders || []).map((provider, index) => (
                <tr key={index} className="group hover:bg-gray-50/50 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-gray-100 mr-3 flex items-center justify-center text-primary font-bold overflow-hidden border border-gray-100">
                        {provider.profilePic ? (
                          <img src={provider.profilePic} alt={provider.name} className="w-full h-full object-cover" />
                        ) : (
                          provider.name?.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{provider.name}</p>
                        <p className="text-xs text-gray-400 uppercase tracking-tighter font-mono">{provider.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 font-medium text-gray-700 text-center">{provider.jobs} Jobs</td>
                  <td className="py-4 font-bold text-gray-900 text-right">{formatCurrency(provider.earnings)}</td>
                  <td className="py-4 text-right">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider ${index === 0 ? 'bg-yellow-50 text-yellow-600' :
                      index === 1 ? 'bg-gray-100 text-gray-600' :
                        index === 2 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                      }`}>
                      {index === 0 ? '🏆 Star' : index === 1 ? '🥈 Pro' : index === 2 ? '🥉 Elite' : 'Top Tier'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity & Pending Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-primary/10 rounded-lg mr-3">
                <FiActivity className="text-primary" />
              </div>
              <h3 className="font-bold text-gray-900">Live Activity Feed</h3>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span>
              Real-time
            </span>
          </div>
          <div className="max-h-[450px] overflow-y-auto p-2">
            {(analytics?.liveActivity || []).map((activity, index) => (
              <div key={index} className="p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-start">
                    <div className={`mt-1 p-2 rounded-lg mr-3 ${activity.type === 'completion' ? 'bg-green-50 text-green-600' :
                      activity.type === 'registration' ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-600'
                      }`}>
                      {activity.type === 'completion' ? <FiCheckCircle size={14} /> :
                        activity.type === 'registration' ? <FiUser size={14} /> : <FiClock size={14} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400">{formatDate(activity.timestamp)}</span>
                        {activity.amount && (
                          <span className="text-xs font-bold text-gray-900">• {formatCurrency(activity.amount)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${activity.status === 'completed' || activity.type === 'completion' ? 'bg-green-100 text-green-700' :
                    activity.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      activity.status === 'new_user' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {activity.status?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Actions */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-primary/10 rounded-lg mr-3">
              <FiAlertTriangle className="text-primary" />
            </div>
            <h3 className="font-bold text-gray-900">Critical Pending Actions</h3>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl flex items-center justify-between group hover:border-yellow-300 transition-colors cursor-pointer">
              <div className="flex items-center">
                <div className="p-2 bg-white rounded-lg mr-3 shadow-sm group-hover:scale-110 transition-transform">
                  <FiUser className="text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Provider Verifications</p>
                  <p className="text-xs text-gray-500">Awaiting document review</p>
                </div>
              </div>
              <span className="text-lg font-bold text-yellow-700 bg-white px-3 py-1 rounded-lg border border-yellow-100">
                {analytics?.pendingActions?.pendingVerifications || 0}
              </span>
            </div>

            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center justify-between group hover:border-red-300 transition-colors cursor-pointer">
              <div className="flex items-center">
                <div className="p-2 bg-white rounded-lg mr-3 shadow-sm group-hover:scale-110 transition-transform">
                  <FiDollarSign className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Pending Withdrawals</p>
                  <p className="text-xs text-gray-500">Process provider payouts</p>
                </div>
              </div>
              <span className="text-lg font-bold text-red-700 bg-white px-3 py-1 rounded-lg border border-red-100">
                {analytics?.pendingActions?.pendingWithdrawals || 0}
              </span>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-between group hover:border-orange-300 transition-colors cursor-pointer">
              <div className="flex items-center">
                <div className="p-2 bg-white rounded-lg mr-3 shadow-sm group-hover:scale-110 transition-transform">
                  <FiAlertTriangle className="text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Active Disputes</p>
                  <p className="text-xs text-gray-500">Unresolved customer complaints</p>
                </div>
              </div>
              <span className="text-lg font-bold text-orange-700 bg-white px-3 py-1 rounded-lg border border-orange-100">
                {analytics?.pendingActions?.pendingDisputes || 0}
              </span>
            </div>
          </div>
          <div className="mt-8 p-6 bg-gray-900 rounded-2xl relative overflow-hidden">
            <div className="relative z-10">
              <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">System Intelligence</h5>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                  <span className="text-sm text-white font-medium">All Microservices Live</span>
                </div>
                <FiActivity className="text-gray-600 animate-pulse" />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center">
                <p className="text-[10px] text-gray-500">Last Sync: {new Date().toLocaleTimeString()}</p>
                <button className="text-[10px] text-primary font-bold hover:underline">View System Logs</button>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
