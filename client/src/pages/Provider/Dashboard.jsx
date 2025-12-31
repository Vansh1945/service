import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FiDollarSign, FiCalendar, FiCheckCircle, FiStar,
  FiTrendingUp, FiClock, FiUser, FiMapPin,
  FiPhone, FiMail, FiEye, FiCheck, FiX,
  FiPlay, FiAlertCircle, FiCreditCard,
  FiPieChart, FiBriefcase, FiFilter
} from 'react-icons/fi';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import Loader from '../../components/Loader';
import { useAuth } from '../../store/auth';

const Dashboard = () => {
  const { token, API, showToast } = useAuth();

  // Format currency in Indian Rupees
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [dashboardData, setDashboardData] = useState({
    summary: null,
    earnings: null,
    bookings: null,
    analytics: null,
    wallet: null,
    ratings: null,
    profile: null
  });
  const [actionLoading, setActionLoading] = useState({});

  // Format address object to string
  const formatAddress = useCallback((address) => {
    if (!address) return 'Address not specified';
    if (typeof address === 'string') return address;

    const parts = [
      address.street,
      address.city,
      address.state,
      address.postalCode,
      address.country
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : 'Address not specified';
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all dashboard data in parallel
      const [
        summaryRes, earningsRes, bookingsRes, analyticsRes, walletRes, ratingsRes, profileRes
      ] = await Promise.all([
        fetch(`${API}/provider/dashboard/summary`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/provider/dashboard/earnings?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/provider/dashboard/bookings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/provider/dashboard/analytics`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/provider/dashboard/wallet`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/provider/dashboard/ratings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/provider/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      // Process responses
      const summary = summaryRes.ok ? await summaryRes.json() : null;
      const earnings = earningsRes.ok ? await earningsRes.json() : null;
      const bookings = bookingsRes.ok ? await bookingsRes.json() : null;
      const analytics = analyticsRes.ok ? await analyticsRes.json() : null;
      const wallet = walletRes.ok ? await walletRes.json() : null;
      const ratings = ratingsRes.ok ? await ratingsRes.json() : null;
      const profile = profileRes.ok ? await profileRes.json() : null;

      // Check for errors
      const errors = [];
      if (!summaryRes.ok) errors.push('summary');
      if (!earningsRes.ok) errors.push('earnings');
      if (!bookingsRes.ok) errors.push('bookings');
      if (!analyticsRes.ok) errors.push('analytics');
      if (!walletRes.ok) errors.push('wallet');
      if (!ratingsRes.ok) errors.push('ratings');
      if (!profileRes.ok) errors.push('profile');

      if (errors.length > 0) {
        console.error('Failed to fetch data for:', errors);
        setError(`Failed to load data for: ${errors.join(', ')}`);
      }

      setDashboardData({
        summary: summary?.data || null,
        earnings: earnings?.data || null,
        bookings: bookings?.data || null,
        analytics: analytics?.data || null,
        wallet: wallet?.data || null,
        ratings: ratings?.data || null,
        profile: profile?.provider || null
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [API, token, showToast, dateRange]);

  // Handle booking actions
  const handleBookingAction = async (bookingId, action, additionalData = {}) => {
    try {
      setActionLoading(prev => ({ ...prev, [bookingId]: action }));

      const endpoint = `${API}/booking/provider/${bookingId}/${action}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(additionalData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} booking`);
      }

      const result = await response.json();
      showToast(result.message || `Booking ${action}ed successfully`, 'success');
      
      // Refresh dashboard data
      fetchDashboardData();

    } catch (error) {
      console.error(`Error ${action}ing booking:`, error);
      showToast(error.message || `Failed to ${action} booking`, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [bookingId]: null }));
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Loading state
  if (loading) {
    return <Loader />;
  }

  const { summary, earnings, bookings, analytics, wallet, ratings, profile } = dashboardData;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="bg-background rounded-xl shadow-md p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-secondary">
              Welcome back, {profile?.name || 'Provider'}!
            </h1>
            <p className="text-gray-600 mt-1 text-sm md:text-base">
              Here's what's happening with your services today.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        {/* Total Earnings */}
        <Link to="/provider/earnings" className="block bg-background rounded-xl shadow-md p-3 sm:p-4 md:p-5 border-l-4 border-primary hover:shadow-lg transition-all duration-300">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
              <FiDollarSign className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Earnings</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-secondary">
                {formatCurrency(earnings?.totalEarnings || 0)}
              </p>
            </div>
          </div>
        </Link>

        {/* Available Balance */}
        <Link to="/provider/earnings" className="block bg-background rounded-xl shadow-md p-3 sm:p-4 md:p-5 border-l-4 border-accent hover:shadow-lg transition-all duration-300">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-accent/10 rounded-lg">
              <FiTrendingUp className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-accent" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Available Balance</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-secondary">
                {formatCurrency(wallet?.currentBalance || 0)}
              </p>
            </div>
          </div>
        </Link>

        {/* Completed Jobs */}
        <div className="bg-background rounded-xl shadow-md p-3 sm:p-4 md:p-5 border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
              <FiCheckCircle className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-green-600" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Completed Jobs</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-secondary">{summary?.completedJobs || 0}</p>
            </div>
          </div>
        </div>

        {/* Average Rating */}
        <div className="bg-background rounded-xl shadow-md p-3 sm:p-4 md:p-5 border-l-4 border-yellow-500">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg">
              <FiStar className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-yellow-600" />
            </div>
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Average Rating</p>
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-secondary">
                {(ratings?.averageRating || 0) > 0 ? (ratings.averageRating).toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings Chart */}
        <div className="bg-background rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-secondary flex items-center">
              <FiTrendingUp className="mr-2 text-primary" />
              Earnings Overview
            </h3>
            <div className="flex items-center space-x-2">
              <FiFilter className="text-gray-500" />
              <select
                value={`${dateRange.startDate}_${dateRange.endDate}`}
                onChange={(e) => {
                  const [start, end] = e.target.value.split('_');
                  setDateRange({ startDate: start, endDate: end });
                }}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value={`${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>
                  Last 7 days
                </option>
                <option value={`${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>
                  Last 30 days
                </option>
                <option value={`${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>
                  Last 3 months
                </option>
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={earnings?.chartData || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`₹${value}`, 'Earnings']} />
              <Line type="monotone" dataKey="earnings" stroke="#3B82F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bookings Breakdown Pie Chart */}
        <div className="bg-background rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-secondary flex items-center mb-4">
            <FiPieChart className="mr-2 text-primary" />
            Bookings Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={bookings?.pieChartData || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {(bookings?.pieChartData || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][index % 5]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions & Recent Bookings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Quick Actions Section */}
        <div className="lg:col-span-1 space-y-4 md:space-y-5">
          {/* Pending Requests */}
          <Link
            to="/provider/booking-requests"
            className="bg-background rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-all duration-300 block"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base md:text-lg font-semibold text-secondary">Pending Requests</h3>
                <p className="text-2xl md:text-3xl font-bold text-accent mt-1 md:mt-2">{summary?.pendingBookings || 0}</p>
                <p className="text-xs md:text-sm text-gray-600 mt-1">Awaiting your response</p>
              </div>
              <div className="p-2 md:p-3 bg-accent/10 rounded-lg">
                <FiClock className="h-5 w-5 md:h-6 md:w-6 text-accent" />
              </div>
            </div>
          </Link>

          {/* Active Jobs */}
          <Link
            to="/provider/active-jobs"
            className="bg-background rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-all duration-300 block"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base md:text-lg font-semibold text-secondary">Active Jobs</h3>
                <p className="text-2xl md:text-3xl font-bold text-primary mt-1 md:mt-2">
                  {(analytics?.todayJobs?.length || 0) + (analytics?.upcomingJobs?.length || 0)}
                </p>
                <p className="text-xs md:text-sm text-gray-600 mt-1">Currently in progress</p>
              </div>
              <div className="p-2 md:p-3 bg-primary/10 rounded-lg">
                <FiBriefcase className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              </div>
            </div>
          </Link>

          {/* Earnings */}
          <Link
            to="/provider/earnings"
            className="bg-background rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-all duration-300 block"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base md:text-lg font-semibold text-secondary">Available Earnings</h3>
                <p className="text-2xl md:text-3xl font-bold text-green-600 mt-1 md:mt-2">
                  {formatCurrency(wallet?.currentBalance || 0)}
                </p>
                <p className="text-xs md:text-sm text-gray-600 mt-1">Ready to withdraw</p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-lg">
                <FiCreditCard className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
              </div>
            </div>
          </Link>

          {/* Reports */}
          <Link
            to="/provider/reports"
            className="bg-background rounded-xl shadow-md p-4 md:p-5 hover:shadow-lg transition-all duration-300 block"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base md:text-lg font-semibold text-secondary">Reports</h3>
                <p className="text-xs md:text-sm text-gray-600 mt-1">View earnings & withdrawal history</p>
              </div>
              <div className="p-2 md:p-3 bg-purple-100 rounded-lg">
                <FiPieChart className="h-5 w-5 md:h-6 md:w-6 text-purple-600" />
              </div>
            </div>
          </Link>
        </div>

        {/* Recent Bookings Section */}
        <div className="lg:col-span-2 bg-background rounded-xl shadow-md">
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold text-secondary flex items-center">
              <FiCalendar className="mr-2 text-primary" />
              Recent Bookings
            </h2>
            <Link
              to="/provider/booking-requests"
              className="text-primary hover:text-primary/80 text-xs md:text-sm font-medium flex items-center"
            >
              View All
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="p-4 md:p-6">
            {(!analytics?.todayJobs || analytics.todayJobs.length === 0) &&
             (!analytics?.upcomingJobs || analytics.upcomingJobs.length === 0) ? (
              <div className="text-center py-6 md:py-8">
                <FiCalendar className="mx-auto h-8 w-8 md:h-12 md:w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No recent bookings</h3>
                <p className="mt-1 text-xs md:text-sm text-gray-500">
                  New booking requests will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {/* Today's Jobs */}
                {analytics?.todayJobs?.map((booking) => (
                  <div key={booking._id} className="bg-gray-50 rounded-lg p-3 md:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <FiUser className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-secondary">
                              {booking.customer?.name || 'Customer'}
                            </h4>
                            <p className="text-xs text-gray-600">
                              {new Date(booking.date).toLocaleDateString()} at {booking.time}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {formatAddress(booking.location)}
                          </span>
                          <span className="text-sm font-semibold text-primary">
                            {formatCurrency(booking.totalAmount)}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleBookingAction(booking._id, 'accept')}
                          disabled={actionLoading[booking._id] === 'accept'}
                          className="px-3 py-1 bg-green-500 text-white text-xs rounded-md hover:bg-green-600 disabled:opacity-50"
                        >
                          {actionLoading[booking._id] === 'accept' ? '...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleBookingAction(booking._id, 'reject')}
                          disabled={actionLoading[booking._id] === 'reject'}
                          className="px-3 py-1 bg-red-500 text-white text-xs rounded-md hover:bg-red-600 disabled:opacity-50"
                        >
                          {actionLoading[booking._id] === 'reject' ? '...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Upcoming Jobs */}
                {analytics?.upcomingJobs?.map((booking) => (
                  <div key={booking._id} className="bg-blue-50 rounded-lg p-3 md:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FiCalendar className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-secondary">
                              {booking.customer?.name || 'Customer'}
                            </h4>
                            <p className="text-xs text-gray-600">
                              {new Date(booking.date).toLocaleDateString()} at {booking.time}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {formatAddress(booking.location)}
                          </span>
                          <span className="text-sm font-semibold text-blue-600">
                            {formatCurrency(booking.totalAmount)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          Scheduled
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Status Alert */}
      {profile && (!profile.approved || !profile.testPassed) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 md:p-4">
          <div className="flex">
            <FiAlertCircle className="h-4 w-4 md:h-5 md:w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Account Setup Required
              </h3>
              <div className="mt-1 md:mt-2 text-xs md:text-sm text-yellow-700">
                <ul className="list-disc list-inside space-y-1">
                  {!profile.approved && (
                    <li>Your account is pending approval from admin</li>
                  )}
                  {!profile.testPassed && (
                    <li>
                      Complete your skill test to start accepting bookings
                      <Link to="/provider/test" className="ml-1 md:ml-2 text-yellow-800 underline">
                        Take Test
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;