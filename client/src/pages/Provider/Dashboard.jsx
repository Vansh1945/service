import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FiDollarSign, FiCalendar, FiCheckCircle, FiStar,
  FiTrendingUp, FiClock, FiAlertCircle, FiCreditCard,
  FiPieChart, FiBriefcase, FiChevronRight, FiLock, FiUnlock, FiAlertTriangle
} from 'react-icons/fi';
import Loader from '../../components/Loader';
import { useAuth } from '../../context/auth';
import * as ProviderService from '../../services/ProviderService';
import * as BookingService from '../../services/BookingService';
import * as ComplaintService from '../../services/ComplaintService';
import { formatCurrency, formatDate } from '../../utils/format';

const PayoutStatusBadge = ({ status }) => {
  const cfg = {
    'Payout On Hold': 'bg-orange-100 text-orange-700 border-orange-200',
    'Payout Ready': 'bg-green-100 text-green-700 border-green-200',
    'Payout Released': 'bg-blue-100 text-blue-700 border-blue-200',
    'Refund Adjusted': 'bg-gray-100 text-gray-500 border-gray-200',
    'Dispute Hold': 'bg-red-100 text-red-700 border-red-200',
    'Not Processed': 'bg-gray-50 text-gray-400 border-gray-100',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg[status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
      {status === 'Payout On Hold' || status === 'Dispute Hold' ? <FiLock size={10} /> : <FiUnlock size={10} />}
      {status || 'Unknown'}
    </span>
  );
};

const Dashboard = () => {
  const { token, API, showToast } = useAuth();

  const [loading, setLoading] = useState(true);
  const [Recharts, setRecharts] = useState(null);

  useEffect(() => {
    import('recharts').then(module => {
      setRecharts(module);
    }).catch(err => {
      console.error("Failed to load charts library:", err);
    });
  }, []);

  const {
    LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
  } = Recharts || {};

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
    recentBookings: [],
    heldPayouts: 0,
    disputesCount: 0,
    pendingReviews: 0
  });
  const [isReady, setIsReady] = useState(false);
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

      // Calculate dispute/hold metrics from bookings
      const allBookingsFlat = [...(analyticsData?.todayJobs || []), ...(analyticsData?.upcomingJobs || [])];
      const heldPayouts = allBookingsFlat.filter(b => b.payoutHoldUntil && new Date(b.payoutHoldUntil) > new Date()).length;
      const disputesCount = allBookingsFlat.filter(b => b.disputeRaised).length;
      const pendingReviews = allBookingsFlat.filter(b => b.disputeStatus === 'UNDER_REVIEW').length;

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
        recentBookings: combinedBookings.slice(0, 5),
        heldPayouts,
        disputesCount,
        pendingReviews
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

  useEffect(() => {
    if (!loading && dashboardData.summary) {
      const timer = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [loading, dashboardData.summary]);

  if (loading) return <Loader />;

  const { summary, earnings, bookings, wallet, ratings, profile, totalEarnings, todaysEarnings, pendingRequests, recentBookings, heldPayouts, disputesCount, pendingReviews } = dashboardData;
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

        {/* Account Restriction or Low Performance Alert Banner */}
        {ratings?.restrictionsActive && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl mb-6 flex items-start gap-3 shadow-sm">
            <FiAlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-800 text-sm">Account Restricted</p>
              <p className="text-red-700 text-xs mt-1 leading-relaxed">
                Your account is restricted from accepting new bookings.
                {ratings.restrictionReason && ` Reason: ${ratings.restrictionReason}`}
                {ratings.restrictedUntil && ` Restricting until: ${new Date(ratings.restrictedUntil).toLocaleDateString()}`}
              </p>
            </div>
          </div>
        )}
        {!ratings?.restrictionsActive && Number(ratings?.trustScore !== undefined ? ratings.trustScore : 100) < 80 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl mb-6 flex items-start gap-3 shadow-sm">
            <FiAlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 text-sm">Action Required: Low Performance Score</p>
              <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                Your Trust Score is currently at {Number(ratings?.trustScore !== undefined ? ratings.trustScore : 100).toFixed(0)}%. 
                If it drops below 60%, your account will be automatically restricted. 
                Please ensure on-time service delivery and avoid cancellation rejections to improve your score.
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Wallet Balance</p>
                <p className="text-xl font-bold text-secondary">{formatCurrency(wallet?.currentBalance || 0)}</p>
              </div>
            </div>
          </Link>

          <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-indigo-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-xl">
                <FiCheckCircle className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Released Payouts</p>
                <p className="text-xl font-bold text-secondary">{formatCurrency(wallet?.releasedPayouts || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-red-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-xl">
                <FiTrendingUp className="w-5 h-5 text-red-600 rotate-180" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Refund Deductions</p>
                <p className="text-xl font-bold text-secondary">{formatCurrency(wallet?.refundedDeductions || 0)}</p>
              </div>
            </div>
          </div>

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
                  {ratings?.averageRating ? Number(ratings.averageRating).toFixed(1) : '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-orange-400">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 rounded-xl">
                <FiLock className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Held Payouts</p>
                <p className="text-xl font-bold text-secondary">{heldPayouts}</p>
                <p className="text-[10px] text-orange-500 font-medium">Awaiting Release</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-purple-400">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-xl">
                <FiAlertTriangle className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Disputes</p>
                <p className="text-xl font-bold text-secondary">{disputesCount}</p>
                <p className="text-[10px] text-purple-500 font-medium">{pendingReviews} Under Review</p>
              </div>
            </div>
          </div>

          <Link to="/provider/support" className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-red-400 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-xl">
                <FiAlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-secondary/50 uppercase tracking-wide">Complaints</p>
                <p className="text-xl font-bold text-secondary">{complaintsCount}</p>
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
              <p className="text-2xl font-bold text-secondary">{Number(ratings?.averageRating || 0).toFixed(1)}</p>
              <p className="text-xs text-secondary/50 mt-1">Rating</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-secondary">{Number(ratings?.onTimeRate || 0).toFixed(1)}%</p>
              <p className="text-xs text-secondary/50 mt-1">On-Time</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-secondary">{Number(ratings?.completionRate || 0).toFixed(1)}%</p>
              <p className="text-xs text-secondary/50 mt-1">Completion</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className={`text-2xl font-bold ${Number(ratings?.trustScore !== undefined ? ratings.trustScore : 100) < 60 ? 'text-red-600 animate-pulse font-black' : Number(ratings?.trustScore !== undefined ? ratings.trustScore : 100) < 80 ? 'text-amber-600 font-bold' : 'text-secondary'}`}>
                {Number(ratings?.trustScore !== undefined ? ratings.trustScore : 100).toFixed(0)}%
              </p>
              <p className="text-xs text-secondary/50 mt-1">Trust Score</p>
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
            {isReady && Recharts && (
              <ResponsiveContainer width="100%" height={240}>
              <LineChart data={earnings?.chartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip formatter={(value) => [`₹${value}`, 'Earnings']} />
                <Line type="monotone" dataKey="earnings" stroke="#0D9488" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <h3 className="font-medium text-secondary flex items-center gap-2 mb-4">
              <FiPieChart className="text-primary" />
              Bookings Breakdown
            </h3>
            {isReady && Recharts && (
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
            )}
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
                          <div className={`p-2 rounded-lg ${booking.disputeRaised ? 'bg-red-50 text-red-500' : booking.status === 'pending' ? 'bg-orange-50 text-accent' : 'bg-primary/10 text-primary'}`}>
                            {booking.disputeRaised
                              ? <FiAlertTriangle className="w-4 h-4" />
                              : <FiCalendar className="w-4 h-4" />
                            }
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-secondary">{booking.customer?.name || 'Customer'}</h4>
                            <p className="text-xs text-secondary/50">
                              {formatDate(booking.date)} at {booking.time}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs text-secondary/50">{formatAddress(booking.location)}</span>
                          <div className="flex items-center gap-2">
                            {booking.disputeRaised && (
                              <span className="text-[10px] font-bold uppercase text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">Under Review</span>
                            )}
                            <div className="flex flex-col items-end gap-1">
                              <PayoutStatusBadge status={booking.payoutStatus} />
                              {booking.payoutHoldUntil && new Date(booking.payoutHoldUntil) > new Date() && booking.payoutStatus === 'Payout On Hold' && (
                                <span className="text-[9px] text-gray-400 italic">
                                  Hold ends {new Date(booking.payoutHoldUntil).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-primary">{formatCurrency(booking.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-3">
                        {booking.status === 'pending' ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleBookingAction(booking._id, 'accept')}
                              disabled={Object.values(actionLoading).some(Boolean)}
                              className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary/90 disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleBookingAction(booking._id, 'reject')}
                              disabled={Object.values(actionLoading).some(Boolean)}
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