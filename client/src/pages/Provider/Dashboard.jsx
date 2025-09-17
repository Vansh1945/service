import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FiDollarSign, FiCalendar, FiCheckCircle, FiStar,
  FiTrendingUp, FiClock, FiUser, FiMapPin,
  FiPhone, FiMail, FiEye, FiCheck, FiX,
  FiPlay, FiAlertCircle, FiCreditCard,
  FiPieChart, FiBriefcase
} from 'react-icons/fi';
import { useAuth } from '../../store/auth';

const Dashboard = () => {
  const { token, API, showToast } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    profile: null,
    recentBookings: [],
    stats: {
      totalEarnings: 0,
      availableBalance: 0,
      completedBookings: 0,
      pendingBookings: 0,
      averageRating: 0,
      totalWithdrawals: 0
    }
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

      // Fetch profile, earnings, and bookings in parallel
      const [profileResponse, summaryResponse, pendingResponse, acceptedResponse, completedResponse, withdrawalsResponse] = await Promise.all([
        fetch(`${API}/provider/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/payment/summary`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/booking/provider/status/pending?limit=5`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/booking/provider/status/accepted?limit=3`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/booking/provider/status/completed?limit=3`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API}/payment/withdrawal-report?limit=5`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      // Process responses
      const profileData = profileResponse.ok ? await profileResponse.json() : { provider: null };
      const summaryData = summaryResponse.ok ? await summaryResponse.json() : { data: { totalEarnings: 0, availableBalance: 0 } };
      const pendingData = pendingResponse.ok ? await pendingResponse.json() : { data: [] };
      const acceptedData = acceptedResponse.ok ? await acceptedResponse.json() : { data: [] };
      const completedData = completedResponse.ok ? await completedResponse.json() : { data: [] };
      const withdrawalsData = withdrawalsResponse.ok ? await withdrawalsResponse.json() : { records: [] };

      if (!profileResponse.ok) {
        console.error('Failed to fetch profile data');
      }
      if (!summaryResponse.ok) {
        console.error('Failed to fetch earnings summary');
      }

      // Combine recent bookings
      const recentBookings = [
        ...(pendingData.data || []),
        ...(acceptedData.data || []),
        ...(completedData.data || [])
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

      // Calculate stats
      const totalWithdrawals = withdrawalsData.records 
        ? withdrawalsData.records.reduce((sum, record) => sum + (record.amount || 0), 0)
        : 0;

      const stats = {
        totalEarnings: summaryData.data?.totalEarnings || 0,
        availableBalance: summaryData.data?.availableBalance || 0,
        completedBookings: profileData.provider?.completedBookings || 0,
        pendingBookings: pendingData.data?.length || 0,
        averageRating: parseFloat(profileData.provider?.averageRating || 0),
        totalWithdrawals
      };

      setDashboardData({
        profile: profileData.provider,
        recentBookings,
        stats
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [API, token, showToast]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { profile, recentBookings, stats } = dashboardData;

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
                ₹{stats.totalEarnings.toLocaleString()}
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
                ₹{stats.availableBalance.toLocaleString()}
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
              <p className="text-lg sm:text-xl md:text-2xl font-bold text-secondary">{stats.completedBookings}</p>
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
                {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : 'N/A'}
              </p>
            </div>
          </div>
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
                <p className="text-2xl md:text-3xl font-bold text-accent mt-1 md:mt-2">{stats.pendingBookings}</p>
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
                  {recentBookings.filter(b => ['accepted', 'in-progress'].includes(b.status)).length}
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
                  ₹{stats.availableBalance.toLocaleString()}
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
            {recentBookings.length === 0 ? (
              <div className="text-center py-6 md:py-8">
                <FiCalendar className="mx-auto h-8 w-8 md:h-12 md:w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No recent bookings</h3>
                <p className="mt-1 text-xs md:text-sm text-gray-500">
                  New booking requests will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {recentBookings.map((booking) => (
                  <div
                    key={booking._id}
                    className="border border-gray-200 rounded-lg p-3 md:p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 md:space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <FiUser className="w-3 h-3 md:w-5 md:h-5 text-primary" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs md:text-sm font-medium text-secondary truncate">
                              {booking.customer?.name || 'Customer'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {booking.services?.[0]?.service?.title || 'Service'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 md:mt-3 flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500">
                          <div className="flex items-center">
                            <FiCalendar className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                            {new Date(booking.date).toLocaleDateString()}
                          </div>
                          {booking.time && (
                            <div className="flex items-center">
                              <FiClock className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                              {booking.time}
                            </div>
                          )}
                          <div className="flex items-center">
                            <FiDollarSign className="mr-1 h-3 w-3 md:h-4 md:w-4" />
                            ₹{booking.totalAmount}
                          </div>
                        </div>

                        {booking.address && (
                          <div className="mt-1 md:mt-2 flex items-center text-xs md:text-sm text-gray-500">
                            <FiMapPin className="mr-1 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span className="truncate">{formatAddress(booking.address)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end space-y-1 md:space-y-2 ml-2 md:ml-4">
                        {/* Status Badge */}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          booking.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                          booking.status === 'in-progress' ? 'bg-purple-100 text-purple-800' :
                          booking.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1).replace('-', ' ')}
                        </span>

                        {/* Action Buttons */}
                        <div className="flex space-x-1">
                          {booking.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleBookingAction(booking._id, 'accept')}
                                disabled={actionLoading[booking._id] === 'accept'}
                                className="p-1 text-green-600 hover:bg-green-100 rounded-full disabled:opacity-50 transition-colors"
                                title="Accept Booking"
                              >
                                {actionLoading[booking._id] === 'accept' ? (
                                  <div className="animate-spin h-3 w-3 md:h-4 md:w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                                ) : (
                                  <FiCheck className="h-3 w-3 md:h-4 md:w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleBookingAction(booking._id, 'reject', { reason: 'Provider declined' })}
                                disabled={actionLoading[booking._id] === 'reject'}
                                className="p-1 text-red-600 hover:bg-red-100 rounded-full disabled:opacity-50 transition-colors"
                                title="Reject Booking"
                              >
                                {actionLoading[booking._id] === 'reject' ? (
                                  <div className="animate-spin h-3 w-3 md:h-4 md:w-4 border-2 border-red-600 border-t-transparent rounded-full"></div>
                                ) : (
                                  <FiX className="h-3 w-3 md:h-4 md:w-4" />
                                )}
                              </button>
                            </>
                          )}

                          {booking.status === 'accepted' && (
                            <button
                              onClick={() => handleBookingAction(booking._id, 'start')}
                              disabled={actionLoading[booking._id] === 'start'}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded-full disabled:opacity-50 transition-colors"
                              title="Start Job"
                            >
                              {actionLoading[booking._id] === 'start' ? (
                                <div className="animate-spin h-3 w-3 md:h-4 md:w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                              ) : (
                                <FiPlay className="h-3 w-3 md:h-4 md:w-4" />
                              )}
                            </button>
                          )}

                          {booking.status === 'in-progress' && (
                            <button
                              onClick={() => handleBookingAction(booking._id, 'complete')}
                              disabled={actionLoading[booking._id] === 'complete'}
                              className="p-1 text-green-600 hover:bg-green-100 rounded-full disabled:opacity-50 transition-colors"
                              title="Complete Job"
                            >
                              {actionLoading[booking._id] === 'complete' ? (
                                <div className="animate-spin h-3 w-3 md:h-4 md:w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                              ) : (
                                <FiCheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                              )}
                            </button>
                          )}

                          {/* View Details Button */}
                          <Link
                            to={`/provider/booking/${booking._id}`}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                            title="View Details"
                          >
                            <FiEye className="h-3 w-3 md:h-4 md:w-4" />
                          </Link>
                        </div>
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