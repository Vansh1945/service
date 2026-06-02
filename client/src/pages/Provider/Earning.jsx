import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth';
import {
  Filter, Loader2, X, Info, TrendingDown, Eye, Banknote, Building,
  BarChart3, CreditCard, FileText, Download, TrendingUp, Activity,
  Wallet, Clock, CheckCircle, XCircle, AlertCircle, ChevronUp,
  ChevronDown, ArrowDownLeft, DollarSign, Calendar, Receipt, Lock, ShieldAlert
} from 'lucide-react';
import * as PaymentService from '../../services/PaymentService';
import * as ProviderService from '../../services/ProviderService';
import { formatDate, formatTime, formatDateTime, formatCurrency, formatNumber } from '../../utils/format';
import Loader from '../../components/Loader';

// ── Utility Helpers ──────────────────────────────────────────────────────────


const getStatusConfig = (status) => {
  const configs = {
    completed: { color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle, label: 'Success' },
    paid: { color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle, label: 'Paid' },
    processing: { color: 'bg-amber-50 text-amber-700', icon: Clock, label: 'Processing' },
    under_review: { color: 'bg-purple-50 text-purple-700', icon: Clock, label: 'Review' },
    approved: { color: 'bg-teal-50 text-teal-700', icon: CheckCircle, label: 'Approved' },
    requested: { color: 'bg-yellow-50 text-yellow-700', icon: Clock, label: 'Requested' },
    failed: { color: 'bg-red-50 text-red-700', icon: XCircle, label: 'Failed' },
    rejected: { color: 'bg-red-50 text-red-700', icon: XCircle, label: 'Rejected' },
    withdrawn: { color: 'bg-indigo-50 text-indigo-700', icon: CheckCircle, label: 'Withdrawn' },
    'dispute hold': { color: 'bg-red-50 text-red-700', icon: ShieldAlert, label: 'Dispute Hold' },
    'admin hold': { color: 'bg-orange-50 text-orange-700', icon: Lock, label: 'Admin Hold' },
    'held': { color: 'bg-orange-50 text-orange-700 border border-orange-200', icon: Lock, label: 'Held' },
    'available': { color: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircle, label: 'Ready for withdrawal' }
  };
  return configs[status?.toLowerCase()] || { color: 'bg-gray-100 text-gray-600', icon: AlertCircle, label: status || 'Unknown' };
};

// ── Shared UI Components ─────────────────────────────────────────────────────

const StatCard = ({ title, value, icon: Icon, subtext }) => (
  <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs font-medium text-secondary/50 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-secondary mt-1">{value}</p>
        {subtext && <p className="text-xs text-secondary/40 mt-1">{subtext}</p>}
      </div>
      <div className="p-3 bg-primary/10 rounded-xl text-primary">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const Badge = ({ status }) => {
  const cfg = getStatusConfig(status);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
};

// ── Main Dashboard Component ─────────────────────────────────────────────────

const ProviderEarningsDashboard = () => {
  const { showToast } = useAuth();

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: BarChart3 },
    { id: 'earnings', label: 'Available', icon: Wallet },
    { id: 'held', label: 'Held', icon: Lock },
    { id: 'withdrawals', label: 'Withdrawals', icon: FileText },
    { id: 'reports', label: 'Reports', icon: Download },
  ];

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalEarnings: 0, todayEarnings: 0, totalWithdrawn: 0,
    availableBalance: 0, totalPendingWithdrawals: 0,
    heldAmount: 0, disputeCount: 0,
    withdrawalSecurity: null
  });
  const [earningsReport, setEarningsReport] = useState([]);
  const [heldEarnings, setHeldEarnings] = useState([]);
  const [withdrawalReport, setWithdrawalReport] = useState([]);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [expandedCards, setExpandedCards] = useState({ weekly: false, monthly: false });
  const [withdrawalForm, setWithdrawalForm] = useState({ amount: '' });
  const [downloading, setDownloading] = useState({ earnings: false, withdrawals: false });
  const [providerBankDetails, setProviderBankDetails] = useState(null);
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pagination, setPagination] = useState({ currentPage: 1, pageSize: 20, totalEarnings: 0 });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [timeFilter, setTimeFilter] = useState('month');
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [processingWithdrawal, setProcessingWithdrawal] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpDelivery, setOtpDelivery] = useState(null);
  const [otpTimer, setOtpTimer] = useState(0);
  const [cooldownTime, setCooldownTime] = useState(null);

  // ── API Handlers ─────────────────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    try {
      const now = new Date();
      let start, end;
      if (timeFilter === 'day') {
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
      } else if (timeFilter === 'week') {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day;
        start = new Date(d.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date();
      } else if (timeFilter === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (timeFilter === 'year') {
        start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), 11, 31);
      } else {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date();
      }
      end.setHours(23, 59, 59, 999);

      const params = {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
      };

      const response = await PaymentService.getEarningsSummary(params);
      const data = response.data;
      if (data.success) {
        setSummary({
          totalEarnings: data.totalEarnings || 0,
          todayEarnings: data.todayEarnings || 0,
          totalWithdrawn: data.totalWithdrawn || 0,
          availableBalance: data.availableBalance || 0,
          totalPendingWithdrawals: data.pendingWithdrawals || 0,
          heldAmount: data.heldAmount || 0,
          disputeCount: data.disputeCount || 0,
          withdrawalSecurity: data.withdrawalSecurity || null
        });
      }
    } catch (err) { console.error('Error fetching summary:', err); }
  }, [timeFilter]);

  const processWeeklyData = useCallback((earnings) => {
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const weeks = [];
    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(startOfMonth.getDate() + (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekEarnings = earnings.filter(e => {
        const d = new Date(e.createdAt);
        return d >= weekStart && d <= weekEnd;
      });
      weeks.push({
        week: `Week ${i + 1}`,
        earnings: weekEarnings.reduce((s, e) => s + (e.netAmount || 0), 0),
        count: weekEarnings.length
      });
    }
    setWeeklyData(weeks);
  }, []);

  const processMonthlyData = useCallback((earnings) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyEarnings = months.map((month, i) => {
      const monthEarnings = earnings.filter(e => new Date(e.createdAt).getMonth() === i);
      return {
        month,
        earnings: monthEarnings.reduce((s, e) => s + (e.netAmount || 0), 0),
        count: monthEarnings.length
      };
    });
    setMonthlyData(monthlyEarnings);
  }, []);

  const fetchWeeklyMonthlyData = useCallback(async () => {
    try {
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      const endOfYear = new Date(currentDate.getFullYear(), 11, 31);

      const [weeklyRes, monthlyRes] = await Promise.all([
        PaymentService.getEarningsReport({ startDate: startOfMonth.toISOString().split('T')[0], endDate: endOfMonth.toISOString().split('T')[0] }),
        PaymentService.getEarningsReport({ startDate: startOfYear.toISOString().split('T')[0], endDate: endOfYear.toISOString().split('T')[0] })
      ]);

      const weeklyData = weeklyRes.data;
      const monthlyData = monthlyRes.data;
      if (weeklyData.success) processWeeklyData(weeklyData.earnings);
      if (monthlyData.success) processMonthlyData(monthlyData.earnings);
    } catch (err) { console.error('Error fetching trends:', err); }
  }, [processWeeklyData, processMonthlyData]);

  const fetchEarningsReport = useCallback(async (page = 1, limit = 20) => {
    try {
      const params = { page, limit };
      if (dateFilter.startDate) params.startDate = dateFilter.startDate;
      if (dateFilter.endDate) params.endDate = dateFilter.endDate;

      const response = await PaymentService.getEarningsReport(params);
      const data = response.data;
      if (data.success) {
        setEarningsReport(data.earnings || []);
        setPagination({ currentPage: page, pageSize: limit, totalEarnings: data.totalCount || 0 });
      }
    } catch (err) { showToast('Failed to fetch earnings', 'error'); }
  }, [dateFilter, showToast]);

  const fetchHeldEarnings = useCallback(async () => {
    try {
      const response = await PaymentService.getHeldEarnings();
      const data = response.data;
      if (data.success) setHeldEarnings(data.earnings || []);
    } catch (err) { console.error('Failed to fetch held earnings:', err); }
  }, []);

  const fetchWithdrawalReport = useCallback(async () => {
    try {
      const params = {};
      if (dateFilter.startDate) params.startDate = dateFilter.startDate;
      if (dateFilter.endDate) params.endDate = dateFilter.endDate;

      const response = await PaymentService.getWithdrawalReport(params);
      const data = response.data;
      if (data.success) setWithdrawalReport(data.records || []);
    } catch (err) { showToast('Failed to fetch withdrawals', 'error'); }
  }, [dateFilter, showToast]);

  const fetchProviderProfile = useCallback(async () => {
    try {
      const response = await ProviderService.getProfile();
      const data = response.data;
      if (data.provider?.bankDetails) {
        setProviderBankDetails(data.provider.bankDetails);
        return data.provider.bankDetails;
      }
    } catch (err) { console.error('Profile fetch error:', err); }
    return null;
  }, []);

  const handleWithdrawalRequest = async () => {
    if (!withdrawalForm.amount || withdrawalForm.amount < 500) { showToast('Minimum ₹500 required', 'error'); return; }
    if (withdrawalForm.amount > summary.availableBalance) { showToast(`Insufficient balance. Available: ${formatCurrency(summary.availableBalance)}`, 'error'); return; }

    try {
      setProcessingWithdrawal(true);
      const response = await PaymentService.withdraw({ amount: parseFloat(withdrawalForm.amount) });
      const data = response.data;
      if (data.success) {
        showToast(data.message || 'Withdrawal requested successfully!', 'success');
        setShowWithdrawalModal(false);
        setWithdrawalForm({ amount: '' });
        refreshAll();
      } else {
        showToast(data.error || 'Withdrawal failed', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.error || err.message || 'Processing error', 'error');
    } finally {
      setProcessingWithdrawal(false);
    }
  };

  const downloadReport = async (type) => {
    if (!dateFilter.startDate || !dateFilter.endDate) { showToast('Select date range', 'error'); return; }
    try {
      setDownloading(prev => ({ ...prev, [type]: true }));
      const params = {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        download: 'true'
      };

      const res = type === 'earnings'
        ? await PaymentService.downloadEarningsReport(params, { responseType: 'blob' })
        : await PaymentService.downloadWithdrawalReport(params, { responseType: 'blob' });

      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Report downloaded!', 'success');
    } catch (err) { showToast('Download failed', 'error'); } finally { setDownloading(prev => ({ ...prev, [type]: false })); }
  };

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchSummary(), fetchWeeklyMonthlyData(), fetchEarningsReport(), fetchWithdrawalReport(), fetchHeldEarnings()]);
    } catch (err) { console.error('Refresh all error:', err); } finally { setLoading(false); }
  }, [fetchSummary, fetchWeeklyMonthlyData, fetchEarningsReport, fetchWithdrawalReport, fetchHeldEarnings]);

  const getTrend = (current, previous) => ({
    trend: previous === 0 ? 'neutral' : current > previous ? 'up' : current < previous ? 'down' : 'neutral',
    percentage: previous === 0 ? 0 : Math.abs(((current - previous) / previous) * 100).toFixed(1)
  });

  useEffect(() => {
    let timer;
    if (otpTimer > 0 && showOTPModal) {
      timer = setInterval(() => setOtpTimer(t => t - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpTimer, showOTPModal]);

  useEffect(() => { refreshAll(); }, [timeFilter, dateFilter, refreshAll]);
  useEffect(() => {
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  if (loading && !summary.totalEarnings && !earningsReport.length) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen font-inter">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-secondary flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-primary" />
              Earnings Dashboard
            </h1>
            <p className="text-sm text-secondary/50 mt-1">Track your earnings and manage withdrawals</p>
          </div>
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-secondary/70 focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="day">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          <StatCard title="Gross Billed" value={formatCurrency(summary.totalEarnings)} icon={TrendingUp} subtext="Total paid by customers" />
          <StatCard title="Today's Earning" value={formatCurrency(summary.todayEarnings)} icon={Activity} subtext="Earned today" />
          <StatCard title="Withdrawable Balance" value={formatCurrency(summary.availableBalance)} icon={Wallet} subtext="Ready to withdraw (Net)" />
          <StatCard title="Total Withdrawn" value={formatCurrency(summary.totalWithdrawn)} icon={FileText} subtext={`This ${timeFilter}`} />
          <StatCard title="Processing" value={formatCurrency(summary.totalPendingWithdrawals)} icon={Clock} subtext="Awaiting clearance" />
          <StatCard title="Held Payouts" value={formatCurrency(summary.heldAmount)} icon={Lock} subtext="Under review" />
          <StatCard title="Disputes" value={summary.disputeCount} icon={ShieldAlert} subtext="Active disputes" />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Weekly Card */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-secondary flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Weekly Earnings
              </h3>
              <button
                onClick={() => setExpandedCards(p => ({ ...p, weekly: !p.weekly }))}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-secondary/40"
              >
                {expandedCards.weekly ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {weeklyData.slice(0, 4).map((w) => (
                <div key={w.week} className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-secondary/50 uppercase">{w.week}</p>
                  <p className="text-lg font-bold text-secondary">{formatCurrency(w.earnings)}</p>
                  <p className="text-[10px] text-secondary/40">{w.count} bookings</p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Card */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-secondary flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Monthly Earnings
              </h3>
              <button
                onClick={() => setExpandedCards(p => ({ ...p, monthly: !p.monthly }))}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-secondary/40"
              >
                {expandedCards.monthly ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {monthlyData.slice(0, 6).map((m, i) => {
                const trend = i > 0 ? getTrend(m.earnings, monthlyData[i - 1].earnings) : { trend: 'neutral' };
                return (
                  <div key={m.month} className="bg-gray-50 p-2 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-secondary/50 uppercase">{m.month}</span>
                      {trend.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                      {trend.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                    </div>
                    <p className="text-sm font-bold text-secondary">{formatCurrency(m.earnings)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Withdrawal Quick Action */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-secondary/50">Available for withdrawal</p>
                <p className="text-2xl font-bold text-secondary">{formatCurrency(summary.availableBalance)}</p>
              </div>
            </div>
            <button
              onClick={() => { fetchProviderProfile(); setShowWithdrawalModal(true); }}
              disabled={summary.availableBalance < 500}
              className="w-full sm:w-auto px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Request Payout
            </button>
          </div>
          {summary.availableBalance < 500 && (
            <p className="text-xs text-red-500 mt-3">Minimum ₹500 required for withdrawal</p>
          )}

          {summary.withdrawalSecurity?.lastRequestTime && (
            (() => {
              const last = new Date(summary.withdrawalSecurity.lastRequestTime);
              const now = new Date();
              const hoursDiff = (now - last) / (1000 * 60 * 60);
              if (hoursDiff < 24) {
                const remainingHours = Math.floor(24 - hoursDiff);
                const remainingMinutes = Math.floor((24 - hoursDiff - remainingHours) * 60);
                return (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 text-amber-700">
                    <Clock className="w-4 h-4" />
                    <p className="text-xs font-medium">
                      Cooldown Active: You can request another withdrawal in {remainingHours}h {remainingMinutes}m
                    </p>
                  </div>
                );
              }
              return null;
            })()
          )}

          {summary.withdrawalSecurity?.isFlagged && (
            <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-700">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs font-medium">
                Suspicious activity detected in previous requests. Your withdrawals may be held for manual security review.
              </p>
            </div>
          )}
        </div>

        {/* Tabbed Content */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Tab Bar */}
          <div className="flex border-b border-gray-100 px-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors relative whitespace-nowrap ${activeTab === tab.id ? 'text-primary' : 'text-secondary/40 hover:text-secondary/70'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Panels */}
          <div className="overflow-x-auto">
            {/* Overview Tab */}
            {activeTab === 'dashboard' && (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Activity Details</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Value</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {withdrawalReport.length > 0 ? (
                    withdrawalReport.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-secondary/40">
                              <ArrowDownLeft className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-secondary">Bank Payout</p>
                              <p className="text-xs text-secondary/40 font-mono">Ref: {r.transactionReference || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-secondary/50">
                          {formatDate(r.createdAt)}
                          <span className="text-secondary/30 ml-1">{formatTime(r.createdAt)}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-red-500">
                          -{formatCurrency(r.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge status={r.status} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-16 text-center">
                        <div className="flex flex-col items-center text-secondary/30">
                          <AlertCircle className="w-10 h-10 mb-2" />
                          <p className="text-sm">No recent transactions</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* Available Earnings Tab */}
            {activeTab === 'earnings' && (
              <table className="w-full text-left min-w-[950px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Booking ID</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-center">Date</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Amount</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Commission</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Other Income</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Net</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {earningsReport.filter(e => e.isWithdrawable).length > 0 ? (
                    earningsReport.filter(e => e.isWithdrawable).map((e, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono font-medium text-secondary/60">
                          {e.bookingId || `#${e.booking?.slice(-8)}`}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-secondary/50">
                          {formatDate(e.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-secondary/40 line-through">
                          {formatCurrency(e.grossAmount)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-sm text-red-500 font-medium">-{formatCurrency(e.commissionAmount)}</p>
                          <p className="text-[10px] text-secondary/30">Fee {e.commissionRate}%</p>
                        </td>
                        <td className="px-6 py-4 text-right relative group">
                          {(() => {
                            const splits = e.surgeSplitSettings || { visiting: 60, rain: 70, traffic: 70, night: 70, demand: 50 };
                            const rainShare = parseFloat(((e.rainCharge || 0) * (splits.rain / 100)).toFixed(2));
                            const trafficShare = parseFloat(((e.trafficCharge || 0) * (splits.traffic / 100)).toFixed(2));
                            const nightShare = parseFloat(((e.nightCharge || 0) * (splits.night / 100)).toFixed(2));
                            const visitingShare = parseFloat(((e.visitingCharge || 0) * (splits.visiting / 100)).toFixed(2));
                            const demandShare = parseFloat(((e.demandSurge || 0) * (splits.demand / 100)).toFixed(2));
                            const otherIncome = parseFloat((rainShare + trafficShare + nightShare).toFixed(2));

                            return (
                              <>
                                <span className="text-sm font-medium text-emerald-600 border-b border-dashed border-emerald-450 cursor-help">
                                  {formatCurrency(otherIncome)}
                                </span>
                                <div className="absolute right-0 bottom-full mb-2 w-52 hidden group-hover:block bg-slate-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl z-30 leading-normal pointer-events-none text-left">
                                  <p className="font-bold border-b border-slate-700 pb-1 mb-1 text-[11px]">Surcharge Split Details</p>
                                  <div className="flex justify-between py-0.5">
                                    <span>Rain Share ({splits.rain}%)</span>
                                    <span>{formatCurrency(rainShare)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5">
                                    <span>Traffic Share ({splits.traffic}%)</span>
                                    <span>{formatCurrency(trafficShare)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5">
                                    <span>Night Share ({splits.night}%)</span>
                                    <span>{formatCurrency(nightShare)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5 border-t border-slate-700 mt-1 pt-1 font-bold">
                                    <span>Vis. Share ({splits.visiting}%)</span>
                                    <span>{formatCurrency(visitingShare)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5 font-bold">
                                    <span>Demand Share ({splits.demand}%)</span>
                                    <span>{formatCurrency(demandShare)}</span>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                          +{formatCurrency(e.netAmount)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge status={e.payoutStatus || e.status} />
                        </td>
                        <td className="px-6 py-4 text-xs font-medium capitalize text-secondary/60">
                          {e.paymentMethod || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-16 text-center text-secondary/30">
                        No available earnings records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'held' && (
              <div className="p-4 space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3">
                  <Lock className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-orange-800">Payout Holds</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      Earnings are temporarily held for 48 hours for customer protection or during active disputes.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {heldEarnings.length > 0 ? heldEarnings.map((e, i) => (
                    <div key={i} className={`bg-white rounded-xl border p-5 transition-all hover:shadow-md ${e.holdReason?.toLowerCase().includes('dispute') ? 'border-red-200 bg-red-50/20' : 'border-orange-200 bg-orange-50/20'
                      }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-mono font-bold text-secondary/60">{e.bookingId || `#${e.booking?.slice(-8)}`}</span>
                            <Badge status={e.payoutStatus || e.status} />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="flex items-start gap-3">
                              <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                <Clock className="w-3.5 h-3.5 text-orange-500" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-secondary/40 uppercase tracking-wider">Held Until</p>
                                <p className="text-sm font-bold text-secondary">
                                  {e.holdUntil ? new Date(e.holdUntil).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : 'Under Review'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="p-1.5 bg-white rounded-lg shadow-sm">
                                <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-secondary/40 uppercase tracking-wider">Reason</p>
                                <p className="text-sm font-medium text-secondary/80">
                                  {e.holdReason || 'Standard payout hold'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-right border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-100 min-w-[120px]">
                          <p className="text-[10px] font-black text-secondary/40 uppercase tracking-wider">Amount</p>
                          <p className="text-2xl font-black text-secondary">{formatCurrency(e.netAmount)}</p>
                          <p className="text-[10px] text-secondary/40 mt-1 font-medium">Earned: {formatDate(e.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="bg-white rounded-xl border border-gray-100 py-16 text-center">
                      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                      <p className="text-sm font-bold text-secondary">No Payouts on Hold</p>
                      <p className="text-xs text-secondary/40 mt-1">All your earnings are available or already withdrawn.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Withdrawals Tab */}
            {activeTab === 'withdrawals' && (
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Operation</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Reference ID</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Amount</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-center">Date</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {withdrawalReport.length > 0 ? (
                    withdrawalReport.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-secondary/40">
                              <ArrowDownLeft className="w-4 h-4" />
                            </div>
                            <p className="text-sm font-medium text-secondary">Payout<br /><span className="text-xs text-secondary/40">Bank Transfer</span></p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono font-medium text-secondary/40">
                          {r.transactionReference || 'REF_PENDING'}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-red-500">
                          {formatCurrency(r.amount)}
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-secondary/50">
                          {formatDate(r.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge status={r.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedWithdrawal(r)}
                            className="p-2 text-secondary/40 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-16 text-center text-secondary/30">
                        No payout history logged
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-4 mb-8 bg-gray-50 p-4 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <p className="text-xs font-medium text-secondary/40 uppercase">Select Period:</p>
                  </div>
                  <input
                    type="date"
                    value={dateFilter.startDate}
                    onChange={e => setDateFilter(p => ({ ...p, startDate: e.target.value }))}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-gray-300">→</span>
                  <input
                    type="date"
                    value={dateFilter.endDate}
                    onChange={e => setDateFilter(p => ({ ...p, endDate: e.target.value }))}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                    className="text-xs font-medium text-primary hover:text-primary/80 ml-auto"
                  >
                    Clear Filters
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
                  {/* Earnings Report Card */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div className="p-3 bg-white rounded-lg text-primary mb-4 w-fit">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-secondary mb-1">Earnings Report</h4>
                    <p className="text-xs text-secondary/40 mb-5">Full spreadsheet of services, revenue, and commission fees.</p>
                    <button
                      onClick={() => downloadReport('earnings')}
                      disabled={!dateFilter.startDate || downloading.earnings}
                      className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {downloading.earnings ? 'Generating...' : 'Download Excel'}
                    </button>
                  </div>

                  {/* Withdrawals Report Card */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div className="p-3 bg-white rounded-lg text-primary mb-4 w-fit">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-secondary mb-1">Withdrawal Report</h4>
                    <p className="text-xs text-secondary/40 mb-5">Detailed history of bank transfers and clearance statuses.</p>
                    <button
                      onClick={() => downloadReport('withdrawals')}
                      disabled={!dateFilter.startDate || downloading.withdrawals}
                      className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {downloading.withdrawals ? 'Generating...' : 'Download Report'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawalModal && (
        <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-secondary">Withdraw Funds</h3>
              <button onClick={() => setShowWithdrawalModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-secondary/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-sm text-secondary/50 mb-1">Available Balance</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(summary.availableBalance)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary/70 mb-2">Amount (₹)</label>
                <input
                  type="number"
                  value={withdrawalForm.amount}
                  onChange={e => setWithdrawalForm({ amount: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter amount"
                />
                <p className="mt-2 text-xs text-secondary/40">* Minimum ₹500 required</p>
              </div>

              {providerBankDetails && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <p className="text-xs font-medium text-secondary/40 uppercase">Destination Account</p>
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-lg text-primary shadow-sm border border-gray-100">
                        <Building className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-secondary/30 uppercase tracking-widest leading-none mb-1">Account Holder</p>
                        <p className="text-sm font-bold text-secondary truncate">{providerBankDetails.accountName || providerBankDetails.accountHolderName || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pl-11">
                      <div>
                        <p className="text-[9px] font-bold text-secondary/30 uppercase tracking-widest leading-none mb-1">Bank Name</p>
                        <p className="text-xs font-semibold text-secondary truncate">{providerBankDetails.bankName}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-secondary/30 uppercase tracking-widest leading-none mb-1">IFSC Code</p>
                        <p className="text-xs font-semibold text-secondary uppercase tracking-wider">{providerBankDetails.ifscCode || providerBankDetails.ifsc || 'N/A'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-[9px] font-bold text-secondary/30 uppercase tracking-widest leading-none mb-1">Account Number</p>
                        <p className="text-xs font-bold text-secondary tracking-widest">{providerBankDetails.accountNo?.replace(/.(?=.{4})/g, '•')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleWithdrawalRequest}
                disabled={processingWithdrawal || !withdrawalForm.amount || withdrawalForm.amount < 500}
                className="w-full py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {processingWithdrawal ? 'Processing...' : 'Request Payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Details Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-secondary">Payout Details</h3>
                <p className="text-xs text-secondary/40 font-mono">Ref: {selectedWithdrawal.transactionReference || 'N/A'}</p>
              </div>
              <button onClick={() => setSelectedWithdrawal(null)} className="p-1 hover:bg-gray-100 rounded-lg text-secondary/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between bg-primary/5 p-4 rounded-lg border border-primary/10">
                <div>
                  <p className="text-xs font-medium text-primary/60 uppercase">Net Disbursed</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(selectedWithdrawal.netAmount || selectedWithdrawal.amount)}</p>
                </div>
                <Badge status={selectedWithdrawal.status} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-secondary/40 uppercase mb-1">Status</p>
                  <p className="text-sm font-medium text-secondary capitalize">{selectedWithdrawal.status?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary/40 uppercase mb-1">Requested Amount</p>
                  <p className="text-sm font-medium text-secondary">{formatCurrency(selectedWithdrawal.amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary/40 uppercase mb-1">Request Date</p>
                  <p className="text-sm font-medium text-secondary">{formatDate(selectedWithdrawal.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary/40 uppercase mb-1">Transfer Info</p>
                  <p className="text-sm font-medium text-secondary">
                    {selectedWithdrawal.transferDate ? `${formatDate(selectedWithdrawal.transferDate)}` : 'Pending'}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-secondary/40 uppercase mb-2">Bank Destination</p>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg text-primary">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary">{providerBankDetails?.bankName || 'Your Bank'}</p>
                    <p className="text-xs text-secondary/40">A/C: {providerBankDetails?.accountNo || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {(selectedWithdrawal.adminRemark || selectedWithdrawal.paymentDetails) && (
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-xs font-medium text-amber-600 uppercase mb-2">Notes from Admin</p>
                  {selectedWithdrawal.adminRemark && <p className="text-sm text-amber-700">{selectedWithdrawal.adminRemark}</p>}
                  {selectedWithdrawal.paymentDetails && (
                    <div className="text-xs text-amber-600 mt-2">
                      {typeof selectedWithdrawal.paymentDetails === 'object' ? (
                        Object.entries(selectedWithdrawal.paymentDetails).map(([k, v]) => (
                          <div key={k} className="flex justify-between py-0.5">
                            <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}:</span>
                            <span>{v?.toString()}</span>
                          </div>
                        ))
                      ) : (
                        <p>{selectedWithdrawal.paymentDetails}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedWithdrawal(null)}
                className="w-full py-3 bg-gray-100 text-secondary/60 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-secondary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center animate-scale-up">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Info className="w-7 h-7 text-amber-500" />
            </div>
            <h3 className="text-xl font-semibold text-secondary mb-2">Confirm Withdrawal</h3>
            <p className="text-sm text-secondary/60 mb-6">{confirmMessage}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 border border-gray-200 rounded-lg text-sm font-medium text-secondary/50 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { if (confirmAction) confirmAction(); setShowConfirmModal(false); }}
                className="flex-1 py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default ProviderEarningsDashboard;
