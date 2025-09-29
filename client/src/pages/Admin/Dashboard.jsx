import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  FiCalendar, FiDollarSign, FiUsers, FiUser,
  FiTrendingUp, FiPieChart, FiArrowUp
} from 'react-icons/fi';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const AdminDashboard = () => {
  const { user, API } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API}/admin/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        if (!data.success) throw new Error(data.message);
        
        setDashboardData(data.data || {});
      } catch (error) {
        toast.error(error.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [API]);

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

  if (!dashboardData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load data</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-white rounded hover:bg-teal-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overview = {}, users = {}, providers = {}, recentBookings = [] } = dashboardData;

  // Stats Cards Data
  const stats = [
    {
      title: 'Total Bookings',
      value: overview.totalBookings || 0,
      icon: FiCalendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Revenue',
      value: `₹${(overview.totalRevenue || 0).toLocaleString()}`,
      icon: FiDollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Total Providers',
      value: providers.total || 0,
      icon: FiUsers,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Total Customers',
      value: users.total || 0,
      icon: FiUser,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  // Chart Data
  const revenueData = {
    labels: ['Today', 'Week', 'Month', 'Total'],
    datasets: [{
      label: 'Revenue',
      data: [
        overview.todayRevenue || 0,
        overview.weeklyRevenue || 0,
        overview.monthlyRevenue || 0,
        overview.totalRevenue || 0
      ],
      backgroundColor: 'rgba(13, 148, 136, 0.8)',
      borderColor: 'rgba(13, 148, 136, 1)',
      borderWidth: 2
    }]
  };

  const statusData = {
    labels: ['Completed', 'Confirmed', 'Pending', 'Cancelled'],
    datasets: [{
      data: overview.bookingStatus ? Object.values(overview.bookingStatus) : [0, 0, 0, 0],
      backgroundColor: [
        'rgba(13, 148, 136, 0.8)',
        'rgba(249, 115, 22, 0.8)',
        'rgba(59, 130, 246, 0.8)',
        'rgba(239, 68, 68, 0.8)'
      ]
    }]
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <ToastContainer />
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name || 'Admin'}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((item, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{item.title}</p>
                <p className="text-xl font-semibold text-gray-900 mt-1">{item.value}</p>
                <div className="flex items-center mt-2">
                  <FiArrowUp size={14} className="text-green-500 mr-1" />
                  <span className="text-xs text-green-600">+2.5%</span>
                </div>
              </div>
              <div className={`p-3 rounded-full ${item.bgColor}`}>
                <item.icon size={20} className={item.color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Chart */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center mb-4">
            <FiTrendingUp className="text-primary mr-2" />
            <h3 className="font-semibold text-gray-900">Revenue Overview</h3>
          </div>
          <Bar 
            data={revenueData}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true }
              }
            }}
            height={250}
          />
        </div>

        {/* Status Chart */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center mb-4">
            <FiPieChart className="text-primary mr-2" />
            <h3 className="font-semibold text-gray-900">Booking Status</h3>
          </div>
          <Pie 
            data={statusData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'bottom' }
              }
            }}
            height={250}
          />
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Recent Bookings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Customer</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Service</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="p-3 text-left text-sm font-medium text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length > 0 ? (
                recentBookings.map((booking, index) => (
                  <tr key={index} className="border-t">
                    <td className="p-3 text-sm text-gray-900">
                      {booking.customer?.name || 'Unknown'}
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {booking.service?.title || 'Unknown'}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                        booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {booking.status || 'unknown'}
                      </span>
                    </td>
                    <td className="p-3 text-sm font-medium text-gray-900">
                      ₹{booking.totalAmount || 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-gray-500">
                    No recent bookings
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;