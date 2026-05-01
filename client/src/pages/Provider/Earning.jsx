import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/auth';
import {
  Filter, Loader2, X, Info, TrendingDown, Eye, Banknote, Building,
  BarChart3, CreditCard, FileText, Download, TrendingUp, Activity,
  Wallet, Clock, CheckCircle, XCircle, AlertCircle, ChevronUp,
  ChevronDown, ArrowDownLeft, DollarSign, Calendar, Receipt
} from 'lucide-react';
import * as PaymentService from '../../services/PaymentService';
import * as ProviderService from '../../services/ProviderService';
import { formatDate, formatTime, formatCurrency, formatNumber } from '../../utils/format';

// ── Utility Helpers ──────────────────────────────────────────────────────────


const getStatusConfig = (status) => {
  const configs = {
    completed: { color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle, label: 'Success' },
    paid: { color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle, label: 'Paid' },
    available: { color: 'bg-teal-50 text-teal-700', icon: Wallet, label: 'Available' },
    processing: { color: 'bg-amber-50 text-amber-700', icon: Clock, label: 'Processing' },
    under_review: { color: 'bg-purple-50 text-purple-700', icon: Clock, label: 'Review' },
    approved: { color: 'bg-teal-50 text-teal-700', icon: CheckCircle, label: 'Approved' },
    requested: { color: 'bg-yellow-50 text-yellow-700', icon: Clock, label: 'Requested' },
    failed: { color: 'bg-red-50 text-red-700', icon: XCircle, label: 'Failed' },
    rejected: { color: 'bg-red-50 text-red-700', icon: XCircle, label: 'Rejected' }
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
  const { token, API, showToast } = useAuth();

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: BarChart3 },
    { id: 'earnings', label: 'Earnings', icon: CreditCard },
    { id: 'withdrawals', label: 'Withdrawals', icon: FileText },
    { id: 'reports', label: 'Reports', icon: Download },
  ];

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ totalEarnings: 0, todayEarnings: 0, totalWithdrawn: 0, availableBalance: 0, totalPendingWithdrawals: 0 });
  const [earningsReport, setEarningsReport] = useState([]);
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
          totalPendingWithdrawals: data.pendingWithdrawals || 0
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
    setConfirmMessage(`Withdraw ${formatCurrency(withdrawalForm.amount)}? This cannot be undone.`);
    setConfirmAction(() => async () => {
      try {
        setProcessingWithdrawal(true);
        const response = await PaymentService.withdraw({ amount: parseFloat(withdrawalForm.amount) });
        const data = response.data;
        if (data.success) {
          showToast('Withdrawal requested!', 'success');
          setShowWithdrawalModal(false);
          setWithdrawalForm({ amount: '' });
          refreshAll();
        } else { showToast(data.error || 'Withdrawal failed', 'error'); }
      } catch (err) { showToast(err.response?.data?.message || err.message || 'Processing error', 'error'); } finally { setProcessingWithdrawal(false); }
    });
    setShowConfirmModal(true);
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
      await Promise.all([fetchSummary(), fetchWeeklyMonthlyData(), fetchEarningsReport(), fetchWithdrawalReport()]);
    } catch (err) { console.error('Refresh all error:', err); } finally { setLoading(false); }
  }, [fetchSummary, fetchWeeklyMonthlyData, fetchEarningsReport, fetchWithdrawalReport]);

  const getTrend = (current, previous) => ({
    trend: previous === 0 ? 'neutral' : current > previous ? 'up' : current < previous ? 'down' : 'neutral',
    percentage: previous === 0 ? 0 : Math.abs(((current - previous) / previous) * 100).toFixed(1)
  });

  useEffect(() => { refreshAll(); }, [timeFilter, dateFilter, refreshAll]);
  useEffect(() => {
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  if (loading && !summary.totalEarnings && !earningsReport.length) {
    return (
      <div className="min-h-screen flex items-center justify-center font-inter">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="mt-3 text-sm text-secondary/50 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Total Earnings" value={formatCurrency(summary.totalEarnings)} icon={TrendingUp} subtext={`This ${timeFilter}`} />
          <StatCard title="Today's Earning" value={formatCurrency(summary.todayEarnings)} icon={Activity} subtext="Earned today" />
          <StatCard title="Available Balance" value={formatCurrency(summary.availableBalance)} icon={Wallet} subtext="Ready to withdraw" />
          <StatCard title="Total Withdrawn" value={formatCurrency(summary.totalWithdrawn)} icon={FileText} subtext={`This ${timeFilter}`} />
          <StatCard title="Processing" value={formatCurrency(summary.totalPendingWithdrawals)} icon={Clock} subtext="Awaiting clearance" />
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

            {/* Earnings Tab */}
            {activeTab === 'earnings' && (
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Booking ID</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-center">Date</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Amount</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Commission</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Net</th>
                    <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Payment Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {earningsReport.length > 0 ? (
                    earningsReport.map((e, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono font-medium text-secondary/60">
                          #{e.booking?.slice(-8)}
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
                        <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                          +{formatCurrency(e.netAmount)}
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-secondary/40 uppercase">
                          {e.paymentMethod?.replace('_', ' ') || 'Online'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-16 text-center text-secondary/30">
                        No earnings records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
                    <h4 className="text-sm font-semibold text-secondary mb-1">Revenue Audit</h4>
                    <p className="text-xs text-secondary/40 mb-5">Full spreadsheet of services, revenue, and commission fees.</p>
                    <button
                      onClick={() => downloadReport('earnings')}
                      disabled={!dateFilter.startDate || downloading.earnings}
                      className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {downloading.earnings ? 'Generating...' : 'Export Excel'}
                    </button>
                  </div>

                  {/* Withdrawals Report Card */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                    <div className="p-3 bg-white rounded-lg text-primary mb-4 w-fit">
                      <Receipt className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-secondary mb-1">Payout Journal</h4>
                    <p className="text-xs text-secondary/40 mb-5">Detailed history of bank transfers and clearance statuses.</p>
                    <button
                      onClick={() => downloadReport('withdrawals')}
                      disabled={!dateFilter.startDate || downloading.withdrawals}
                      className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      {downloading.withdrawals ? 'Generating...' : 'Export Journal'}
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