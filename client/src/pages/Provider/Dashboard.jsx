import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FiDollarSign, FiCalendar, FiCheckCircle, FiStar,
  FiTrendingUp, FiClock, FiAlertCircle, FiCreditCard,
  FiPieChart, FiBriefcase, FiChevronRight
} from 'react-icons/fi';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Loader from '../../components/Loader';
import { useAuth } from '../../context/auth';
import * as ProviderService from '../../services/ProviderService';
import * as BookingService from '../../services/BookingService';
import * as ComplaintService from '../../services/ComplaintService';
import { formatCurrency, formatDate } from '../../utils/format';

const Dashboard = () => {
  const { token, API, showToast } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [dashboardData, setDashboardData] = useState({
    summary: null,
    earnings: null,
    bookings: null,
    wallet: null,
    ratings: null,
    profile: null,
    totalEarnings: 0,
    todaysEarnings: 0,
    pendingRequests: [],
    activeJobs: [],
    recentBookings: []
  });
  const [actionLoading, setActionLoading] = useState({});
  const [complaintsCount, setComplaintsCount] = useState(0);

  const formatAddress = useCallback((address) => {
    if (!address) return 'Address not specified';
    if (typeof address === 'string') return address;
    const parts = [address.street, address.city, address.state].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Address not specified';
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryRes, earningsRes, bookingsRes, walletRes, ratingsRes, profileRes, analyticsRes] = await Promise.all([
        ProviderService.getDashboardSummary(),
        ProviderService.getEarningsAnalytics({ startDate: dateRange.startDate, endDate: dateRange.endDate }),
        ProviderService.getBookingStatusBreakdown(),
        ProviderService.getWalletInfo(),
        ProviderService.getPerformanceRatings(),
        ProviderService.getProfile(),
        ProviderService.getDashboardAnalytics()
      ]);

      const summary = summaryRes.data;
      const earnings = earningsRes.data;
      const bookings = bookingsRes.data;
      const wallet = walletRes.data;
      const ratings = ratingsRes.data;
      const profile = profileRes.data;
      const analyticsData = analyticsRes.data?.data || null;

      const combinedBookings = [...(analyticsData?.todayJobs || []), ...(analyticsData?.upcomingJobs || [])];

      setDashboardData({
        summary: summary?.data || null,
        earnings: earnings?.data || null,
        bookings: bookings?.data || null,
        wallet: wallet?.data || null,
        ratings: ratings?.data || null,
        profile: profile?.provider || null,
        totalEarnings: summary?.data?.totalEarnings || 0,
        todaysEarnings: summary?.data?.todaysEarnings || 0,
        pendingRequests: new Array(summary?.data?.pendingBookings || 0),
        activeJobs: combinedBookings,
        recentBookings: combinedBookings.slice(0, 5)
      });
    } catch (error) {
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, dateRange]);

  // Fetch provider's complaint count
  useEffect(() => {
    const fetchComplaintsCount = async () => {
      try {
        const response = await ComplaintService.getMyComplaints();
        const data = response.data;
        if (data?.success) setComplaintsCount(data.data?.length || 0);
      } catch (e) { /* silent */ }
    };
    if (token) fetchComplaintsCount();
  }, [token]);

  const handleBookingAction = async (bookingId, action) => {
    try {
      setActionLoading(prev => ({ ...prev, [bookingId]: action }));
      
      let response;
      if (action === 'accept') response = await BookingService.acceptBooking(bookingId);
      else if (action === 'reject') response = await BookingService.rejectBooking(bookingId);
      else if (action === 'start') response = await BookingService.startBooking(bookingId);
      else if (action === 'complete') response = await BookingService.completeBooking(bookingId);
      else throw new Error('Invalid action');

      showToast(`Booking ${action}ed successfully`, 'success');
      fetchDashboardData();
    } catch (error) {
      showToast(error.response?.data?.message || error.message, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [bookingId]: null }));
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) return <Loader />;

  const { summary, earnings, bookings, wallet, ratings, profile, totalEarnings, todaysEarnings, pendingRequests, recentBookings } = dashboardData;
  const COLORS = ['#0D9488', '#F97316', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 font-inter animate-slide-up">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-5">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <h1 className="text-xl md:text-2xl font-semibold text-secondary font-poppins">
            Welcome back, {profile?.name || 'Provider'}!
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {profile?.providerId && (
              <span className="text-xs font-medium px-3 py-1 bg-primary/10 text-primary rounded-full">
                ID: {profile.providerId}
              </span>
            )}
            <p className="text-secondary/50 text-sm">Here's what's happening today.</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Link to="/provider/earnings" className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-primary hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <FiDollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Total Earning</p>
                <p className="text-xl font-bold text-secondary">{formatCurrency(totalEarnings)}</p>
              </div>
            </div>
          </Link>

          <Link to="/provider/earnings" className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-emerald-500 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <FiDollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Today's Earning</p>
                <p className="text-xl font-bold text-secondary">{formatCurrency(todaysEarnings)}</p>
              </div>
            </div>
          </Link>

          <Link to="/provider/earnings" className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-accent hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-xl">
                <FiTrendingUp className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Balance</p>
                <p className="text-xl font-bold text-secondary">{formatCurrency(wallet?.currentBalance || 0)}</p>
              </div>
            </div>
          </Link>

          <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-xl">
                <FiCheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Completed</p>
                <p className="text-xl font-bold text-secondary">{summary?.completedJobs || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-yellow-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-xl">
                <FiStar className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Rating</p>
                <p className="text-xl font-bold text-secondary">
                  {ratings?.averageRating ? ratings.averageRating.toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </div>
          <Link to="/provider/support" className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-red-400 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-xl">
                <FiAlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">My Complaints</p>
                <p className="text-xl font-bold text-secondary">{complaintsCount}</p>
                <p className="text-[10px] text-red-500 font-medium">Total Complaints Received</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Performance Card */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium text-secondary flex items-center gap-2">
              <FiStar className="text-yellow-500" />
              Provider Performance
            </h2>
            {ratings?.performanceBadge && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full text-white
                ${ratings.performanceBadge === 'Platinum' ? 'bg-gradient-to-r from-gray-700 to-black' :
                  ratings.performanceBadge === 'Gold' ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                    ratings.performanceBadge === 'Silver' ? 'bg-gradient-to-r from-gray-300 to-gray-500 text-gray-800' :
                      'bg-gradient-to-r from-amber-600 to-amber-800'}`}>
                {ratings.performanceBadge}
              </span>
            )}
          </div>
          <div className="flex justify-around items-center bg-gray-50 rounded-xl p-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-secondary">{ratings?.averageRating?.toFixed(1) || '0.0'}</p>
              <p className="text-xs text-secondary/50 mt-1">Rating</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-secondary">{ratings?.onTimeRate?.toFixed(1) || '0.0'}%</p>
              <p className="text-xs text-secondary/50 mt-1">On-Time</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-secondary">{ratings?.completionRate?.toFixed(1) || '0.0'}%</p>
              <p className="text-xs text-secondary/50 mt-1">Completion</p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-secondary flex items-center gap-2">
                <FiTrendingUp className="text-primary" />
                Earnings
              </h3>
              <select
                value={`${dateRange.startDate}_${dateRange.endDate}`}
                onChange={(e) => {
                  const [start, end] = e.target.value.split('_');
                  setDateRange({ startDate: start, endDate: end });
                }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50"
              >
                <option value={`${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>7 days</option>
                <option value={`${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>30 days</option>
                <option value={`${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>90 days</option>
              </select>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={earnings?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip formatter={(value) => [`₹${value}`, 'Earnings']} />
                <Line type="monotone" dataKey="earnings" stroke="#0D9488" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <h3 className="font-medium text-secondary flex items-center gap-2 mb-4">
              <FiPieChart className="text-primary" />
              Bookings Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={bookings?.pieChartData || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {(bookings?.pieChartData || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-2">
              {(bookings?.pieChartData || []).map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-xs text-secondary/60">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent Bookings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            <Link to="/provider/booking-requests" className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-shadow block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-secondary/50 uppercase tracking-wide">Pending</p>
                  <p className="text-3xl font-bold text-accent">{pendingRequests?.length || 0}</p>
                  <p className="text-xs text-secondary/50 mt-1">Awaiting response</p>
                </div>
                <div className="p-3 bg-accent/10 rounded-xl">
                  <FiClock className="w-6 h-6 text-accent" />
                </div>
              </div>
            </Link>

            <Link to="/provider/active-jobs" className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-shadow block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-secondary/50 uppercase tracking-wide">Active Jobs</p>
                  <p className="text-3xl font-bold text-primary">{dashboardData.activeJobs?.length || 0}</p>
                  <p className="text-xs text-secondary/50 mt-1">In progress</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <FiBriefcase className="w-6 h-6 text-primary" />
                </div>
              </div>
            </Link>

            <Link to="/provider/earnings" className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 hover:shadow-md transition-shadow block">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-secondary/50 uppercase tracking-wide">Available</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(wallet?.currentBalance || 0)}</p>
                  <p className="text-xs text-secondary/50 mt-1">Ready to withdraw</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <FiCreditCard className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </Link>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-medium text-secondary flex items-center gap-2">
                <FiCalendar className="text-primary" />
                Recent Bookings
              </h2>
              <Link to="/provider/booking-requests" className="text-primary text-sm font-medium flex items-center gap-1 hover:gap-2 transition-all">
                View All <FiChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {!recentBookings?.length ? (
                <div className="text-center py-8">
                  <FiCalendar className="w-10 h-10 text-secondary/20 mx-auto mb-2" />
                  <p className="text-secondary/50 text-sm">No recent bookings</p>
                </div>
              ) : (
                recentBookings.map((booking) => (
                  <div key={booking._id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${booking.status === 'pending' ? 'bg-orange-50 text-accent' : 'bg-primary/10 text-primary'}`}>
                            <FiCalendar className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-secondary">{booking.customer?.name || 'Customer'}</h4>
                            <p className="text-xs text-secondary/50">
                              {formatDate(booking.date)} at {booking.time}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-secondary/50">{formatAddress(booking.location)}</span>
                          <span className="text-sm font-semibold text-primary">{formatCurrency(booking.totalAmount)}</span>
                        </div>
                      </div>
                      <div className="ml-3">
                        {booking.status === 'pending' ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleBookingAction(booking._id, 'accept')}
                              disabled={actionLoading[booking._id]}
                              className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleBookingAction(booking._id, 'reject')}
                              disabled={actionLoading[booking._id]}
                              className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className={`px-3 py-1.5 text-xs rounded-full capitalize
                            ${booking.status === 'completed' ? 'bg-green-50 text-green-600' :
                              booking.status === 'accepted' ? 'bg-blue-50 text-blue-600' :
                                booking.status === 'rejected' ? 'bg-red-50 text-red-600' :
                                  'bg-gray-100 text-secondary/60'}`}>
                            {booking.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        {profile && (!profile.approved || !profile.testPassed) && (
          <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-yellow-800">Account Setup Required</h4>
              <ul className="mt-1 text-xs text-yellow-700 space-y-0.5">
                {!profile.approved && <li>• Your account is pending approval</li>}
                {!profile.testPassed && (
                  <li className="flex items-center gap-2">
                    • Complete your skill test to start accepting bookings
                    <Link to="/provider/test" className="text-primary font-medium underline ml-auto">Take Test →</Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;