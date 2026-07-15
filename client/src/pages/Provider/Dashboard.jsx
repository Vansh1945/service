import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FiDollarSign, FiCalendar, FiCheckCircle, FiStar,
  FiTrendingUp, FiClock, FiAlertCircle, FiCreditCard,
  FiPieChart, FiBriefcase, FiChevronRight, FiAlertTriangle
} from 'react-icons/fi';
import DashboardSkeleton from '../../components/ui-skeletons/DashboardSkeleton';
import StatsCard from '../../components/ui/StatsCard';
import { useAuth } from '../../context/auth';
import { useSocket } from '../../socket/SocketContext';
import * as ProviderService from '../../services/ProviderService';
import { formatCurrency, formatDate, formatTime } from '../../utils/format';
import { formatAddress } from '../../utils/providerHelpers';
import PwaInstallBanner from '../../components/PwaInstallBanner';
const Dashboard = () => {
  const { showToast, user, refreshUser, logoutUser } = useAuth();
  const { socket } = useSocket();

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


  const fetchDashboardData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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
        recentBookings: analytics?.recentBookings || sortedBookings.slice(0, 5),
        heldPayouts,
        disputesCount,
        pendingReviews
      });
    } catch {
      showToast('Failed to load dashboard data', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast, dateRange]);

  // Silent Refresh on window focus and online status
  useEffect(() => {
    const handleFocus = () => {
      fetchDashboardData(true);
    };
    const handleOnline = () => {
      fetchDashboardData(true);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!socket) return;

    const handleBookingUpdated = (data) => {
      if (!data || !data.booking) return;
      fetchDashboardData(true);
    };

    const handleBookingDeleted = (data) => {
      if (!data || !data.bookingId) return;
      fetchDashboardData(true);
    };

    const handleProviderStatusChanged = (data) => {
      if (!data || data.providerId !== user?._id) return;
      showToast(`Your profile status was updated: ${data.status}`, 'info');
      if (refreshUser) refreshUser();
      fetchDashboardData(true);
    };

    socket.on('booking-updated', handleBookingUpdated);
    socket.on('booking-deleted', handleBookingDeleted);
    socket.on('provider-status-changed', handleProviderStatusChanged);

    const handleReconnect = () => {
      fetchDashboardData(true);
    };
    socket.on('connect', handleReconnect);
    socket.on('reconnect', handleReconnect);

    return () => {
      socket.off('booking-updated', handleBookingUpdated);
      socket.off('booking-deleted', handleBookingDeleted);
      socket.off('provider-status-changed', handleProviderStatusChanged);
      socket.off('connect', handleReconnect);
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, fetchDashboardData, user, refreshUser, showToast]);


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
    <div className="min-h-screen bg-neutral-50/50 p-3 sm:p-5 font-inter animate-slide-up">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <PwaInstallBanner role="provider" />

        {/* Header */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-neutral-800 flex items-center flex-wrap gap-2 font-poppins leading-tight">
                Welcome back, {profile?.name || 'Provider'}! <span className="animate-bounce">👋</span>
              </h1>
              <p className="text-neutral-500 text-xs sm:text-sm mt-1">Here's what's happening today.</p>
            </div>
          </div>
          <div className="flex flex-row flex-nowrap items-center gap-1.5 sm:gap-3 self-start sm:self-center w-full sm:w-auto overflow-x-auto scrollbar-none whitespace-nowrap">
            {/* Provider ID */}
            {profile?.providerId && (
              <span className="text-xs font-bold px-2.5 py-1 bg-neutral-50 text-neutral-600 rounded-full border border-neutral-200/60 shrink-0">
                ID: {profile.providerId}
              </span>
            )}

            {/* Date Filter */}
            <select
              value={`${dateRange.startDate}_${dateRange.endDate}`}
              onChange={(e) => {
                const [start, end] = e.target.value.split('_');
                setDateRange({ startDate: start, endDate: end });
              }}
              className="text-xs font-bold border border-neutral-200 rounded-xl px-2.5 py-1 bg-neutral-50 hover:bg-neutral-100/50 text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer transition-all duration-200 shrink-0"
            >
              <option value={`${new Date().toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>Today</option>
              <option value={`${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>7 days</option>
              <option value={`${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>30 days</option>
              <option value={`${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}_${new Date().toISOString().split('T')[0]}`}>90 days</option>
            </select>
          </div>
        </div>

        {/* Account Warning/Restriction/Suspended/Blocked Alert Banner */}
        {user?.blockedTill && new Date(user.blockedTill) > new Date() && (
          <div className="bg-danger border border-danger/25 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md text-white animate-pulse">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="w-8 h-8 text-white shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-lg text-white">Account Blocked</p>
                <p className="text-white/90 text-xs mt-1 leading-relaxed">
                  Your account has been blocked by the administrator. All actions have been restricted.
                  {user.rejectionReason && ` Reason: ${user.rejectionReason}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => logoutUser()}
              className="px-4 py-2 bg-white text-danger font-bold text-xs rounded-xl hover:bg-slate-100 transition-all self-start sm:self-center"
            >
              Logout
            </button>
          </div>
        )}

        {user?.isSuspended && (
          <div className="bg-danger border border-danger/25 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md text-white">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="w-8 h-8 text-white shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-lg text-white">Account Suspended</p>
                <p className="text-white/90 text-xs mt-1 leading-relaxed">
                  Your account is suspended. All login-protected provider operations are restricted.
                  {user.suspensionReason && ` Reason: ${user.suspensionReason}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => logoutUser()}
              className="px-4 py-2 bg-white text-danger font-bold text-xs rounded-xl hover:bg-slate-100 transition-all self-start sm:self-center"
            >
              Logout
            </button>
          </div>
        )}

        {ratings?.restrictionsActive && !user?.isSuspended && !(user?.blockedTill && new Date(user.blockedTill) > new Date()) && (
          <div className="bg-warning/5 border border-warning/20 p-4 rounded-2xl flex items-start gap-3 shadow-sm border-l-4 border-l-warning">
            <FiAlertTriangle className="w-7 h-7 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-warning text-sm">Account Restricted</p>
              <div className="text-warning text-xs mt-1 space-y-1 leading-relaxed">
                <p>Your account is currently restricted. Restricted features have been disabled.</p>
                <p><strong>Current Status:</strong> Restricted</p>
                <p><strong>Reason:</strong> {ratings.restrictionReason || 'Manual restriction'}</p>
                {ratings.restrictedUntil && <p><strong>Action Date:</strong> {new Date(ratings.restrictedUntil).toLocaleString()}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <StatsCard
            to="/provider/earnings"
            title="Total Earnings"
            value={formatCurrency(totalEarnings)}
            icon={FiDollarSign}
            iconBg="bg-success/5"
            iconColor="text-success"
            className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-neutral-100 h-full"
          />

          <StatsCard
            to="/provider/earnings"
            title="Today's Earnings"
            value={formatCurrency(todaysEarnings)}
            icon={FiDollarSign}
            iconBg="bg-success/5"
            iconColor="text-success"
            className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-neutral-100 h-full"
          />

          <StatsCard
            to="/provider/earnings"
            title="Available Balance"
            value={formatCurrency(wallet?.currentBalance || 0)}
            icon={FiCreditCard}
            iconBg="bg-primary/5"
            iconColor="text-primary"
            className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-neutral-100 h-full"
          />

          <StatsCard
            title="Released Payouts"
            value={formatCurrency(wallet?.releasedPayouts || 0)}
            icon={FiCheckCircle}
            iconBg="bg-info/5"
            iconColor="text-info"
            className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-neutral-100 h-full"
          />

          <StatsCard
            title="Refund Deductions"
            value={formatCurrency(wallet?.refundedDeductions || 0)}
            icon={FiTrendingUp}
            iconBg="bg-danger/5"
            iconColor="text-danger"
            className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-neutral-100 h-full"
          />

          <StatsCard
            title="Completed"
            value={summary?.completedJobs || 0}
            icon={FiCheckCircle}
            iconBg="bg-success/5"
            iconColor="text-success"
            className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-neutral-100 h-full"
          />
        </div>

        {/* Provider Performance Card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-warning/5 flex items-center justify-center text-warning">
                <FiStar className="w-4.5 h-4.5 fill-warning" />
              </div>
              <div>
                <span className="font-bold text-neutral-800 text-sm sm:text-base">Provider Performance</span>
                <p className="text-[10px] text-neutral-400">Based on your recent completed services</p>
              </div>
            </div>
            <span className={`text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full tracking-wider border shadow-sm ${
              performanceBadge === 'Platinum' ? 'bg-neutral-900 border-neutral-800 text-white' :
              performanceBadge === 'Gold' ? 'bg-warning/10 border-warning/20 text-warning font-black' :
              performanceBadge === 'Silver' ? 'bg-neutral-100 border-neutral-200 text-neutral-700' :
              'bg-amber-900 border-amber-955 text-white'
            }`}>
              {performanceBadge} Partner
            </span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-neutral-100 text-center">
            <div className="py-1">
              <div className="flex items-center justify-center gap-1">
                <FiStar className="text-warning w-4 h-4 fill-warning shrink-0" />
                <p className="text-lg md:text-xl font-extrabold text-neutral-800">{Number(ratings?.averageRating ?? 0).toFixed(1)}</p>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-neutral-400 mt-1 uppercase tracking-wider">Rating</p>
            </div>
            <div className="py-1">
              <div className="flex items-center justify-center gap-1">
                <FiClock className="text-primary w-4 h-4 shrink-0" />
                <p className="text-lg md:text-xl font-extrabold text-neutral-800">{Number(ratings?.onTimeRate ?? 0).toFixed(1)}%</p>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-neutral-400 mt-1 uppercase tracking-wider">On-Time</p>
            </div>
            <div className="py-1">
              <div className="flex items-center justify-center gap-1">
                <FiCheckCircle className="text-success w-4 h-4 shrink-0" />
                <p className="text-lg md:text-xl font-extrabold text-neutral-800">{Number(ratings?.completionRate ?? 0).toFixed(1)}%</p>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-neutral-400 mt-1 uppercase tracking-wider">Completion</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Earnings Area Chart */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300 min-h-[320px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-800 text-sm sm:text-base flex items-center gap-2">
                <FiTrendingUp className="text-success w-5 h-5" />
                Earnings Trend
              </h3>
            </div>
            
            <div className="h-[180px] w-full flex items-center justify-center my-3">
              {(!earnings?.chartData || earnings.chartData.length < 2) ? (
                <div className="text-center py-4">
                  <FiTrendingUp className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 font-bold">No trend data for this period</p>
                  <p className="text-[10px] text-neutral-400 mt-1">Select a longer range (e.g., 7 days) to view trend chart</p>
                </div>
              ) : (
                isReady && Recharts && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={earnings.chartData}>
                      <defs>
                        <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0D9488" stopOpacity={0.2} />
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
                )
              )}
            </div>

            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Earnings</p>
                <p className="text-lg sm:text-xl font-extrabold text-neutral-800 mt-0.5">{formatCurrency(totalEarnings)}</p>
              </div>
              {earnings?.chartData && earnings.chartData.length >= 2 && (
                <span className="text-xs font-bold px-2 py-1 bg-success/5 text-success rounded-full border border-success/10 flex items-center gap-1">
                  ↑ Stable
                </span>
              )}
            </div>
          </div>

          {/* Bookings Breakdown Donut Chart */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300 min-h-[320px] flex flex-col justify-between">
            <h3 className="font-bold text-neutral-800 text-sm sm:text-base flex items-center gap-2">
              <FiPieChart className="text-primary w-5 h-5" />
              Bookings Breakdown
            </h3>
            
            <div className="flex flex-row items-center justify-between gap-4 my-3 flex-grow">
              {!bookings?.pieChartData || bookings.pieChartData.length === 0 || totalPieValue === 0 ? (
                <div className="w-full text-center py-6">
                  <FiPieChart className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 font-bold">No bookings breakdown available</p>
                  <p className="text-[10px] text-neutral-400 mt-1">Complete bookings to populate metrics</p>
                </div>
              ) : (
                <>
                  <div className="w-1/2 flex justify-center h-[140px] min-w-0">
                    {isReady && Recharts && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={bookings?.pieChartData || []}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={60}
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
                  <div className="w-1/2 flex flex-col gap-1.5 max-h-[140px] overflow-y-auto">
                    {(bookings?.pieChartData || []).map((entry, index) => (
                      <div key={index} className="flex items-center justify-between min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-xs font-bold text-neutral-600 truncate">{entry.name}</span>
                        </div>
                        <span className="text-[11px] font-semibold text-neutral-450 shrink-0 ml-1">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="pt-3 border-t border-neutral-100">
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Bookings</p>
              <p className="text-lg sm:text-xl font-extrabold text-neutral-800 mt-0.5">{summary?.totalBookings ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Links & Recent Bookings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Quick Action Navigation Links */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 sm:gap-4">
            <Link to="/provider/booking-requests" className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 block min-w-0">
              <div className="flex lg:flex-row flex-col justify-between lg:items-center gap-1.5">
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider truncate">Pending Requests</p>
                  <p className="text-lg sm:text-2xl font-extrabold text-accent mt-0.5">{pendingRequests?.length || 0}</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-accent/5 flex items-center justify-center text-accent shrink-0 self-start lg:self-center">
                  <FiClock className="w-4 h-4" />
                </div>
              </div>
            </Link>

            <Link to="/provider/active-jobs" className="bg-white rounded-2xl p-4 border border-neutral-150 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 block min-w-0">
              <div className="flex lg:flex-row flex-col justify-between lg:items-center gap-1.5">
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider truncate">Active Jobs</p>
                  <p className="text-lg sm:text-2xl font-extrabold text-success mt-0.5">{dashboardData.activeJobs?.length || 0}</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-success/5 flex items-center justify-center text-success shrink-0 self-start lg:self-center">
                  <FiBriefcase className="w-4 h-4" />
                </div>
              </div>
            </Link>

            <Link to="/provider/earnings" className="bg-white rounded-2xl p-4 border border-neutral-100 shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 block min-w-0">
              <div className="flex lg:flex-row flex-col justify-between lg:items-center gap-1.5">
                <div>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider truncate">Available</p>
                  <p className="text-lg sm:text-2xl font-extrabold text-primary mt-0.5">{formatCurrency(wallet?.currentBalance || 0)}</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 self-start lg:self-center">
                  <FiCreditCard className="w-4 h-4" />
                </div>
              </div>
            </Link>
          </div>

          {/* Recent Bookings List Card */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-300 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-100">
                <h2 className="font-bold text-neutral-800 text-sm sm:text-base flex items-center gap-2">
                  <FiCalendar className="text-primary w-5 h-5" />
                  Recent Bookings
                </h2>
                <Link to="/provider/booking-requests" className="text-primary hover:text-primary/80 text-xs font-bold flex items-center gap-0.5 transition-colors">
                  View All <FiChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="p-4 sm:p-5 space-y-3.5">
                {!recentBookings?.length ? (
                  <div className="text-center py-10">
                    <FiCalendar className="w-10 h-10 text-neutral-250 mx-auto mb-2" />
                    <p className="text-neutral-400 text-xs font-bold">No recent bookings</p>
                  </div>
                ) : (
                  recentBookings.map((booking) => {
                    const title = getRecentBookingServiceTitle(booking);
                    return (
                      <div key={booking._id} className="flex items-center gap-3 p-3 bg-neutral-50/50 rounded-2xl border border-neutral-100 hover:bg-neutral-50 transition-colors">
                        {getRecentBookingServiceIcon(title)}
                        <div className="flex-grow min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-neutral-800 truncate">{title}</h4>
                          <p className="text-[10px] sm:text-xs text-neutral-450 truncate mt-0.5">{formatAddress(booking.location)}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <span className="text-[9px] sm:text-2xs font-semibold text-neutral-400">
                            {formatDate(booking.date)} • {formatTime(booking.time)}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider border ${
                              booking.status === 'completed' ? 'bg-success/5 text-success border-success/15' :
                              booking.status === 'accepted' ? 'bg-info/5 text-info border-info/15' :
                              booking.status === 'pending' ? 'bg-warning/5 text-warning border-warning/15' :
                              'bg-neutral-100 text-neutral-500 border-neutral-200'
                            }`}>
                              {booking.status === 'in-progress' ? 'In Progress' : booking.status}
                            </span>
                            <span className="text-xs sm:text-sm font-extrabold text-neutral-800">{formatCurrency(booking.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="p-3.5 bg-neutral-50/20 border-t border-neutral-100 rounded-b-2xl text-center">
              <Link to="/provider/booking-requests" className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                View All Bookings
              </Link>
            </div>
          </div>
        </div>

        {/* Setup Required Alert Banner */}
        {profile && (!profile.approved || !profile.testPassed) && (
          <div className="bg-warning/5 rounded-2xl p-4 border border-warning/15 flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-grow">
              <h4 className="text-sm font-bold text-warning">Account Setup Required</h4>
              <ul className="mt-1.5 text-xs text-warning space-y-1">
                {!profile.approved && <li>• Your account is pending approval by the administrator</li>}
                {!profile.testPassed && (
                  <li className="flex items-center gap-2 justify-between">
                    <span>• Complete your skill test to start accepting bookings</span>
                    <Link to="/provider/test" className="text-primary font-bold hover:underline">Take Test →</Link>
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
