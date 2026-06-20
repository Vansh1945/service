import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FiDollarSign, FiCalendar, FiCheckCircle, FiStar,
  FiTrendingUp, FiClock, FiAlertCircle, FiCreditCard,
  FiPieChart, FiBriefcase, FiChevronRight, FiLock, FiUnlock, FiAlertTriangle
} from 'react-icons/fi';
import DashboardSkeleton from '../../components/ui-skeleton/DashboardSkeleton';
import StatsCard from '../../components/ui/StatsCard';
import { useAuth } from '../../context/auth';
import * as ProviderService from '../../services/ProviderService';
import * as BookingService from '../../services/BookingService';
import * as ComplaintService from '../../services/ComplaintService';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';
import { formatAddress } from '../../utils/providerHelpers';



import PwaInstallBanner from '../../components/PwaInstallBanner';

const Dashboard = () => {
  const { token, showToast } = useAuth();

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
    AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
  } = Recharts || {};

  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
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


  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ProviderService.getDashboardData({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      const { summary, earnings, bookings, wallet, ratings, profile, analytics } = response.data.data;

      const combinedBookings = [...(analytics?.todayJobs || []), ...(analytics?.upcomingJobs || [])];

      // Calculate dispute/hold metrics from bookings
      const heldPayouts = combinedBookings.filter(b => b.payoutHoldUntil && new Date(b.payoutHoldUntil) > new Date()).length;
      const disputesCount = combinedBookings.filter(b => b.disputeRaised).length;
      const pendingReviews = combinedBookings.filter(b => b.disputeStatus === 'UNDER_REVIEW').length;

      const sortedBookings = [...combinedBookings].sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return 0;
      });

      setDashboardData({
        summary: summary || null,
        earnings: earnings || null,
        bookings: bookings || null,
        wallet: wallet || null,
        ratings: ratings || null,
        profile: profile || null,
        totalEarnings: summary?.totalEarnings || 0,
        todaysEarnings: summary?.todaysEarnings || 0,
        pendingRequests: new Array(summary?.pendingBookings || 0),
        activeJobs: combinedBookings,
        recentBookings: sortedBookings.slice(0, 5),
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


  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!loading && dashboardData.summary) {
      const timer = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [loading, dashboardData.summary]);

  if (loading) return <DashboardSkeleton type="provider" showRecentBookings={true} />;

  const { summary, earnings, bookings, wallet, ratings, profile, totalEarnings, todaysEarnings, pendingRequests, recentBookings } = dashboardData;
  const COLORS = ['#0D9488', '#F97316', '#F59E0B', '#EF4444', '#8B5CF6'];

  const totalPieValue = (bookings?.pieChartData || []).reduce((sum, item) => sum + item.value, 0) || 1;
  const performanceBadge = ratings?.performanceBadge || 'Bronze';
  const badgeColors = {
    'Platinum': 'bg-slate-800 text-white',
    'Gold': 'bg-amber-500 text-white',
    'Silver': 'bg-slate-300 text-slate-800',
    'Bronze': 'bg-amber-800 text-white'
  };

  const getRecentBookingServiceTitle = (booking) => {
    if (booking.services && booking.services.length > 0) {
      return booking.services[0].service?.title || 'General Service';
    }
    return 'General Service';
  };

  const getRecentBookingServiceIcon = (title) => {
    const t = title.toLowerCase();
    if (t.includes('wiring') || t.includes('electric') || t.includes('mcb')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
          <FiAlertTriangle className="w-5 h-5" />
        </div>
      );
    }
    if (t.includes('fan') || t.includes('install')) {
      return (
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
          <FiBriefcase className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
        <FiCheckCircle className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 font-inter animate-slide-up">
      <div className="max-w-7xl mx-auto space-y-6">
        <PwaInstallBanner role="provider" />

        {/* Header */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 font-poppins">
              Welcome back, {profile?.name || 'Provider'}! <span className="animate-bounce">👋</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-center">
            {profile?.providerId && (
              <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100/50">
                ID: {profile.providerId}
              </span>
            )}
            <select
              value={`${dateRange.startDate}_${dateRange.endDate}`}
              onChange={(e) => {
                const [start, end] = e.target.value.split('_');
                setDateRange({ startDate: start, endDate: end });
              }}
              className="text-xs font-semibold border border-slate-100 rounded-lg px-2.5 py-1.5 bg-slate-50/50 text-slate-500 focus:outline-none shadow-sm cursor-pointer"
            >
              <option value={`${new Date().toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>Today</option>
              <option value={`${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>7 days</option>
              <option value={`${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>30 days</option>
              <option value={`${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>90 days</option>
            </select>
          </div>
        </div>

        {/* Account Restriction or Low Performance Alert Banner */}
        {ratings?.restrictionsActive && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 shadow-sm">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-2 sm:gap-4">
          <StatsCard
            to="/provider/earnings"
            title="Total Earnings"
            value={formatCurrency(totalEarnings)}
            icon={FiDollarSign}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />

          <StatsCard
            to="/provider/earnings"
            title="Today's Earnings"
            value={formatCurrency(todaysEarnings)}
            icon={FiDollarSign}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />

          <StatsCard
            to="/provider/earnings"
            title="Available Balance"
            value={formatCurrency(wallet?.currentBalance || 0)}
            icon={FiCreditCard}
            iconBg="bg-orange-50"
            iconColor="text-orange-500"
          />

          <StatsCard
            title="Released Payouts"
            value={formatCurrency(wallet?.releasedPayouts || 0)}
            icon={FiCheckCircle}
            iconBg="bg-blue-50"
            iconColor="text-blue-500"
          />

          <StatsCard
            title="Refund Deductions"
            value={formatCurrency(wallet?.refundedDeductions || 0)}
            icon={FiTrendingUp}
            iconBg="bg-rose-50"
            iconColor="text-rose-500"
          />

          <StatsCard
            title="Completed"
            value={summary?.completedJobs || 0}
            icon={FiCheckCircle}
            iconBg="bg-teal-50"
            iconColor="text-teal-600"
          />
        </div>

        {/* Provider Performance Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div className="flex items-center gap-1.5 min-w-0">
              <FiStar className="text-amber-500 w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="font-bold text-slate-800 text-sm sm:text-base truncate">Provider Performance</span>
            </div>
            <span className={`text-2xs sm:text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${badgeColors[performanceBadge] || 'bg-amber-800 text-white'}`}>
              {performanceBadge}
            </span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
            <div>
              <p className="text-lg md:text-xl font-bold text-slate-800">{Number(ratings?.averageRating ?? 0).toFixed(1)}</p>
              <p className="text-xs font-medium text-slate-400 mt-1.5">Rating</p>
            </div>
            <div>
              <p className="text-lg md:text-xl font-bold text-slate-800">{Number(ratings?.onTimeRate ?? 0).toFixed(1)}%</p>
              <p className="text-xs font-medium text-slate-400 mt-1.5">On-Time</p>
            </div>
            <div>
              <p className="text-lg md:text-xl font-bold text-slate-800">{Number(ratings?.completionRate ?? 0).toFixed(1)}%</p>
              <p className="text-xs font-medium text-slate-400 mt-1.5">Completion</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Earnings Area Chart */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <FiTrendingUp className="text-emerald-500 w-5 h-5" />
                Earnings Trend
              </h3>
            </div>
            {isReady && Recharts && (
              <div className="h-[200px] w-full mt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={earnings?.chartData || []}>
                    <defs>
                      <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [`₹${value}`, 'Earnings']} contentStyle={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="earnings" stroke="#0D9488" strokeWidth={2} fillOpacity={1} fill="url(#colorEarnings)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Earnings</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">{formatCurrency(totalEarnings)}</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/30 flex items-center gap-1">
                ↑ 18.6%
              </span>
            </div>
          </div>

          {/* Bookings Breakdown Donut Chart */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
              <FiPieChart className="text-emerald-500 w-5 h-5" />
              Bookings Breakdown
            </h3>
            <div className="flex flex-row items-center justify-between gap-4 flex-1">
              <div className="w-1/2 flex justify-center h-[160px] min-w-0">
                {isReady && Recharts && (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={bookings?.pieChartData || []}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {(bookings?.pieChartData || []).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="w-1/2 flex flex-col gap-2">
                {(bookings?.pieChartData || []).map((entry, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs font-semibold text-slate-600">{entry.name}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-400">
                      {entry.value} ({((entry.value / totalPieValue) * 100).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Bookings</p>
              <p className="text-xl font-bold text-slate-800 mt-0.5">{summary?.totalBookings ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Links & Recent Bookings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Action Navigation Links */}
          <div className="flex flex-col gap-4">
            <Link to="/provider/booking-requests" className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-extrabold text-orange-500 mt-1">{pendingRequests?.length || 0}</p>
                <p className="text-xs text-slate-400 mt-1.5">Awaiting response</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 border border-orange-100/50">
                <FiClock className="w-6 h-6" />
              </div>
            </Link>

            <Link to="/provider/active-jobs" className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Jobs</p>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1">{dashboardData.activeJobs?.length || 0}</p>
                <p className="text-xs text-slate-400 mt-1.5">In progress</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100/50">
                <FiBriefcase className="w-6 h-6" />
              </div>
            </Link>

            <Link to="/provider/earnings" className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md transition-all flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Balance</p>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(wallet?.currentBalance || 0)}</p>
                <p className="text-xs text-slate-400 mt-1.5">Ready to withdraw</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100/50">
                <FiCreditCard className="w-6 h-6" />
              </div>
            </Link>
          </div>

          {/* Recent Bookings List Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <FiCalendar className="text-emerald-600 w-5 h-5" />
                  Recent Bookings
                </h2>
                <Link to="/provider/booking-requests" className="text-emerald-600 hover:text-emerald-700 text-xs font-bold flex items-center gap-1 transition-all">
                  View All <FiChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="p-5 space-y-4">
                {!recentBookings?.length ? (
                  <div className="text-center py-12">
                    <FiCalendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm font-medium">No recent bookings</p>
                  </div>
                ) : (
                  recentBookings.map((booking) => {
                    const title = getRecentBookingServiceTitle(booking);
                    return (
                      <div key={booking._id} className="flex items-center gap-4 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                        {getRecentBookingServiceIcon(title)}
                        <div className="flex-grow min-w-0">
                          <h4 className="text-sm font-bold text-slate-800 truncate">{title}</h4>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{formatAddress(booking.location)}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400">
                            {formatDate(booking.date)} at {formatTime(booking.time)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider border
                              ${booking.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-150' :
                                booking.status === 'accepted' ? 'bg-blue-50 text-blue-600 border-blue-150' :
                                  booking.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-150' :
                                    'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {booking.status === 'in-progress' ? 'In Progress' : booking.status}
                            </span>
                            <span className="text-sm font-bold text-slate-800">{formatCurrency(booking.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="p-4 bg-slate-50/30 border-t border-slate-100 rounded-b-2xl text-center">
              <Link to="/provider/booking-requests" className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                View All Bookings
              </Link>
            </div>
          </div>
        </div>

        {/* Setup Required Alert Banner */}
        {profile && (!profile.approved || !profile.testPassed) && (
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-grow">
              <h4 className="text-sm font-bold text-amber-800">Account Setup Required</h4>
              <ul className="mt-1.5 text-xs text-amber-700 space-y-1">
                {!profile.approved && <li>• Your account is pending approval by the administrator</li>}
                {!profile.testPassed && (
                  <li className="flex items-center gap-2 justify-between">
                    <span>• Complete your skill test to start accepting bookings</span>
                    <Link to="/provider/test" className="text-emerald-600 font-bold hover:underline">Take Test →</Link>
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
