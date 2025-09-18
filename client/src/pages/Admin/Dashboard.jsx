import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/auth';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { 
  FiCalendar, FiDollarSign, FiUsers, FiUser,
  FiTrendingUp, FiBarChart2, FiPieChart
} from 'react-icons/fi';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const AdminDashboard = () => {
  const { user, API } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  // Fetch all dashboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const statsResponse = await fetch(`${API}/admin/dashboard/stats`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!statsResponse.ok) {
          throw new Error(`Failed to fetch stats: ${statsResponse.status}`);
        }
        
        const statsData = await statsResponse.json();
        
        if (!statsData.success) {
          throw new Error(statsData.message || 'Failed to fetch dashboard data');
        }
        
        setDashboardData(statsData.data || {});
        setLoading(false);
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error(error.message || 'Failed to load dashboard data');
        setLoading(false);
      }
    };
    
    fetchData();
  }, [API]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 text-lg">Failed to load dashboard data</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Safely access nested properties with fallbacks
  const overview = dashboardData.overview || {};
  const usersData = dashboardData.users || {};
  const providersData = dashboardData.providers || {};
  const recentBookings = dashboardData.recentBookings || [];

  // Chart data with proper fallbacks
  const revenueChartData = {
    labels: ['Today', 'This Week', 'This Month', 'Total'],
    datasets: [
      {
        label: 'Revenue',
        data: [
          overview.todayRevenue || 0,
          overview.weeklyRevenue || 0,
          overview.monthlyRevenue || 0,
          overview.totalRevenue || 0
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.6)',
          'rgba(99, 102, 241, 0.6)',
          'rgba(168, 85, 247, 0.6)',
          'rgba(236, 72, 153, 0.6)'
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(99, 102, 241, 1)',
          'rgba(168, 85, 247, 1)',
          'rgba(236, 72, 153, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const bookingStatusData = {
    labels: overview.bookingStatus ? Object.keys(overview.bookingStatus) : ['Completed', 'Confirmed', 'Pending', 'Cancelled'],
    datasets: [
      {
        data: overview.bookingStatus ? Object.values(overview.bookingStatus) : [0, 0, 0, 0],
        backgroundColor: [
          'rgba(16, 185, 129, 0.6)', // completed - green
          'rgba(59, 130, 246, 0.6)',  // confirmed - blue
          'rgba(245, 158, 11, 0.6)',  // pending - yellow
          'rgba(239, 68, 68, 0.6)'    // cancelled - red
        ],
        borderColor: [
          'rgba(16, 185, 129, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const userGrowthData = {
    labels: usersData.dailySignups ? 
      usersData.dailySignups.map(day => day._id || 'Unknown').reverse() : 
      ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
    datasets: [
      {
        label: 'New Users',
        data: usersData.dailySignups ? 
          usersData.dailySignups.map(day => day.count || 0).reverse() : 
          [0, 0, 0, 0, 0, 0, 0],
        fill: false,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        tension: 0.1
      }
    ]
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <ToastContainer />
      
      {/* Welcome Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name || 'Admin'}!</p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <FiCalendar size={20} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Bookings</p>
              <p className="text-2xl font-semibold text-gray-900">{overview.totalBookings || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <FiDollarSign size={20} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">
                ₹{(overview.totalRevenue || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600">
              <FiUsers size={20} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Providers</p>
              <p className="text-2xl font-semibold text-gray-900">{providersData.total || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-pink-100 text-pink-600">
              <FiUser size={20} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Customers</p>
              <p className="text-2xl font-semibold text-gray-900">{usersData.total || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Overview</h3>
          <Bar 
            data={revenueChartData} 
            options={{
              responsive: true,
              plugins: {
                legend: {
                  display: false
                }
              }
            }} 
          />
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Booking Status</h3>
          <Pie 
            data={bookingStatusData} 
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: 'right'
                }
              }
            }} 
          />
        </div>
      </div>

      {/* User Growth Chart */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">User Growth (Last 7 Days)</h3>
        <Line 
          data={userGrowthData} 
          options={{
            responsive: true,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  stepSize: 1
                }
              }
            }
          }} 
        />
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Bookings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentBookings.length > 0 ? (
                recentBookings.map((booking, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-600">
                            {booking.customer?.name?.charAt(0)?.toUpperCase() || 'C'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {booking.customer?.name || 'Unknown Customer'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {booking.provider?.name || 'Unknown Provider'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {booking.service?.title || 'Unknown Service'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                        booking.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                        booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {booking.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{booking.totalAmount || 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    No recent bookings found
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