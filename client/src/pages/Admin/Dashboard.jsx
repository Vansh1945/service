import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import {
  FiCalendar, FiDollarSign, FiUsers, FiUser,
  FiTrendingUp, FiPieChart, FiArrowUp, FiClock,
  FiCheckCircle, FiXCircle, FiAlertTriangle, FiActivity,
  FiFilter, FiRefreshCw
} from 'react-icons/fi';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';

const AdminDashboard = () => {
  const { user, API } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [revenueData, setRevenueData] = useState([]);
  const [bookingsStatus, setBookingsStatus] = useState([]);
  const [topProviders, setTopProviders] = useState([]);
  const [pendingActions, setPendingActions] = useState({});
  const [liveStats, setLiveStats] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [filters, setFilters] = useState({
    dateRange: '30d',
    city: '',
    serviceCategory: ''
  });

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [
        summaryRes,
        revenueRes,
        bookingsRes,
        providersRes,
        pendingRes,
        liveRes,
        activityRes
      ] = await Promise.all([
        fetch(`${API}/admin/dashboard/summary`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API}/admin/dashboard/revenue?period=${filters.dateRange}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API}/admin/dashboard/bookings-status`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API}/admin/dashboard/top-providers`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API}/admin/dashboard/pending-actions`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API}/admin/dashboard/live-stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API}/admin/dashboard/recent-activity`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
      ]);

      const [
        summaryData,
        revenueData,
        bookingsData,
        providersData,
        pendingData,
        liveData,
        activityData
      ] = await Promise.all([
        summaryRes.json(),
        revenueRes.json(),
        bookingsRes.json(),
        providersRes.json(),
        pendingRes.json(),
        liveRes.json(),
        activityRes.json()
      ]);

      if (summaryData.success) setSummary(summaryData.data);
      if (revenueData.success) setRevenueData(revenueData.data);
      if (bookingsData.success) setBookingsStatus(bookingsData.data);
      if (providersData.success) setTopProviders(providersData.data);
      if (pendingData.success) setPendingActions(pendingData.data);
      if (liveData.success) setLiveStats(liveData.data);
      if (activityData.success) setRecentActivity(activityData.data);

    } catch (error) {
      toast.error(error.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => `₹${amount.toLocaleString()}`;
  const formatDate = (date) => new Date(date).toLocaleDateString();

  const statusColors = {
    completed: '#10B981',
    confirmed: '#F59E0B',
    pending: '#6B7280',
    cancelled: '#EF4444'
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
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
      <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center mb-4">
          <FiFilter className="text-primary mr-2" />
          <h3 className="font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={filters.dateRange}
            onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <input
            type="text"
            placeholder="City"
            value={filters.city}
            onChange={(e) => setFilters({...filters, city: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="Service Category"
            value={filters.serviceCategory}
            onChange={(e) => setFilters({...filters, serviceCategory: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bookings</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{summary.totalBookings || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-50">
              <FiCalendar size={20} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Bookings</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{summary.todayBookings || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-green-50">
              <FiCheckCircle size={20} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Revenue</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{formatCurrency(summary.monthlyRevenue || 0)}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-50">
              <FiDollarSign size={20} className="text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Customers</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{summary.totalCustomers || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-50">
              <FiUsers size={20} className="text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center mb-4">
            <FiTrendingUp className="text-primary mr-2" />
            <h3 className="font-semibold text-gray-900">Revenue Overview</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#0D9488" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Booking Status Pie Chart */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center mb-4">
            <FiPieChart className="text-primary mr-2" />
            <h3 className="font-semibold text-gray-900">Booking Status</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={bookingsStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ status, count }) => `${status}: ${count}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {bookingsStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={statusColors[entry.status] || '#8884d8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Providers */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="flex items-center mb-4">
          <FiUsers className="text-primary mr-2" />
          <h3 className="font-semibold text-gray-900">Top Providers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Provider</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Total Earnings</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Bookings</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Rating</th>
              </tr>
            </thead>
            <tbody>
              {topProviders.map((provider, index) => (
                <tr key={index} className="border-t">
                  <td className="p-3 text-sm text-gray-900">{provider.providerName}</td>
                  <td className="p-3 text-sm font-medium text-gray-900">{formatCurrency(provider.totalEarnings)}</td>
                  <td className="p-3 text-sm text-gray-600">{provider.totalBookings}</td>
                  <td className="p-3 text-sm text-gray-600">{provider.averageRating.toFixed(1)} ⭐</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Actions & Live Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Pending Actions */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center mb-4">
            <FiAlertTriangle className="text-primary mr-2" />
            <h3 className="font-semibold text-gray-900">Pending Actions</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Provider Verifications</span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                {pendingActions.pendingVerifications || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Withdrawals</span>
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                {pendingActions.pendingWithdrawals || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Disputes</span>
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">
                {pendingActions.pendingDisputes || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Refunds</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {pendingActions.pendingRefunds || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Live Stats */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center mb-4">
            <FiActivity className="text-primary mr-2" />
            <h3 className="font-semibold text-gray-900">Live Activity</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Ongoing Bookings</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                {liveStats.ongoingBookings || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Active Providers</span>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                {liveStats.activeProviders || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Delayed Bookings (SLA)</span>
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                {liveStats.delayedBookings || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {recentActivity.map((activity, index) => (
            <div key={index} className="p-4 border-b last:border-b-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(activity.timestamp)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {activity.amount && (
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(activity.amount)}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    activity.status === 'completed' ? 'bg-green-100 text-green-800' :
                    activity.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
