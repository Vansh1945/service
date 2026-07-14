import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import { getStatusConfig } from '../../utils/providerHelpers';
import TableSkeleton from '../../components/ui-skeletons/TableSkeleton';

// ── Utility Helpers ──────────────────────────────────────────────────────────


import StatsCard from '../../components/ui/StatsCard';

// ── Shared UI Components ─────────────────────────────────────────────────────

const Badge = ({ status, className = "" }) => {
  const cfg = getStatusConfig(status);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${cfg.color} ${className}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
};

// ── Main Dashboard Component ─────────────────────────────────────────────────

const ProviderEarningsDashboard = () => {
  const { showToast, systemSettings } = useAuth();

  const fallbackSplits = systemSettings?.surgeSplitSettings || {
    visiting: 60,
    rain: 70,
    traffic: 70,
    night: 70,
    demand: 50
  };

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
  const [surchargeOpenId, setSurchargeOpenId] = useState(null);



  useEffect(() => {
    const handleDocumentClick = () => {
      setSurchargeOpenId(null);
    };
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []);

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
        const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(d.setDate(diff));
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
      } else if (timeFilter === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now);
      } else if (timeFilter === 'year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now);
      }

      const params = {};
      if (start) params.startDate = start.toISOString();
      if (end) params.endDate = end.toISOString();

      const response = await PaymentService.getEarningsSummary(params);
      const data = response.data;
      if (data.success) {
        setSummary({
          totalEarnings: data.totalEarnings || 0,
          lifetimeEarnings: data.lifetimeEarnings || 0,
          todayEarnings: data.todayEarnings || 0,
          availableBalance: data.availableBalance || 0,
          heldAmount: data.heldAmount || 0,
          disputeCount: data.disputeCount || 0,
          totalWithdrawn: data.totalWithdrawn || 0,
          lifetimeWithdrawn: data.lifetimeWithdrawn || 0,
          totalPendingWithdrawals: data.pendingWithdrawals || 0,
          withdrawalSecurity: data.withdrawalSecurity || null,
          minWithdrawalLimit: data.minWithdrawalLimit ?? 500
        });
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
    }
  }, [timeFilter]);

  const fetchWeeklyMonthlyData = useCallback(async () => {
    try {
      const response = await PaymentService.getWeeklyMonthlyStats();
      const data = response.data;
      if (data.success) {
        setWeeklyData(data.weekly || []);
        setMonthlyData(data.monthly || []);
      }
    } catch (err) {
      console.error('Failed to fetch weekly/monthly stats:', err);
    }
  }, []);

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
    const minLimit = summary.minWithdrawalLimit ?? 500;
    if (!withdrawalForm.amount || withdrawalForm.amount < minLimit) { showToast(`Minimum ₹${minLimit} required`, 'error'); return; }
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
    } catch (err) {
      let errMsg = 'Download failed';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const errorJson = JSON.parse(text);
          errMsg = errorJson.message || errorJson.error || errMsg;
        } catch (_) { }
      } else if (err.response?.data?.error) {
        errMsg = err.response.data.error;
      } else if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      }
      showToast(errMsg, 'error');
    } finally {
      setDownloading(prev => ({ ...prev, [type]: false }));
    }
  };

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSummary(),
        fetchWeeklyMonthlyData(),
        fetchEarningsReport(),
        fetchWithdrawalReport(),
        fetchHeldEarnings(),
        fetchProviderProfile()
      ]);
    } catch (err) { console.error('Refresh all error:', err); } finally { setLoading(false); }
  }, [fetchSummary, fetchWeeklyMonthlyData, fetchEarningsReport, fetchWithdrawalReport, fetchHeldEarnings, fetchProviderProfile]);

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
      <div className="min-h-screen p-6 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden p-4">
          <table className="w-full text-left">
            <tbody>
              <TableSkeleton rows={8} cols={6} />
            </tbody>
          </table>
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
            <h1 className="text-2xl font-bold text-secondary flex items-center gap-2">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-4">
          <StatsCard title="Gross Billed" value={formatCurrency(summary.totalEarnings)} icon={TrendingUp} subtext="Total paid by customers" iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatsCard title="Today's Earning" value={formatCurrency(summary.todayEarnings)} icon={Activity} subtext="Earned today" iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatsCard title="Withdrawable Balance" value={formatCurrency(summary.availableBalance)} icon={Wallet} subtext="Ready to withdraw (Net)" iconBg="bg-orange-50" iconColor="text-orange-500" />
          <StatsCard title="Total Withdrawn" value={formatCurrency(summary.totalWithdrawn)} icon={FileText} subtext={`This ${timeFilter}`} iconBg="bg-blue-50" iconColor="text-blue-500" />
          <StatsCard title="Processing" value={formatCurrency(summary.totalPendingWithdrawals)} icon={Clock} subtext="Awaiting clearance" iconBg="bg-amber-50" iconColor="text-amber-500" />
          <StatsCard title="Held Payouts" value={formatCurrency(summary.heldAmount)} icon={Lock} subtext="Under review" iconBg="bg-purple-50" iconColor="text-purple-500" />
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
            {expandedCards.weekly && (
              <div className="grid grid-cols-2 gap-3">
                {weeklyData.slice(0, 4).map((w) => (
                  <div key={w.week} className="bg-gray-50 p-3 rounded-lg animate-fadeIn flex flex-col justify-between min-w-0">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-0.5 uppercase tracking-wide truncate">{w.week}</p>
                      <p className="text-sm sm:text-base md:text-lg font-bold text-slate-800 leading-normal whitespace-nowrap">{formatCurrency(w.earnings)}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{w.count} bookings</p>
                  </div>
                ))}
              </div>
            )}
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
            {expandedCards.monthly && (
              <div className="grid grid-cols-3 gap-2 animate-fadeIn">
                {monthlyData.slice(0, 6).map((m, i) => {
                  const trend = i > 0 ? getTrend(m.earnings, monthlyData[i - 1].earnings) : { trend: 'neutral' };
                  return (
                    <div key={m.month} className="bg-gray-50 p-2.5 rounded-lg flex flex-col justify-between min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{m.month}</span>
                        {trend.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500 shrink-0" />}
                        {trend.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />}
                      </div>
                      <p className="text-sm sm:text-base font-bold text-slate-800 leading-normal whitespace-nowrap">{formatCurrency(m.earnings)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Withdrawal Quick Action */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="p-2.5 sm:p-3 bg-primary/10 rounded-xl text-primary shrink-0">
                <Wallet className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-medium text-slate-500 mb-0.5 truncate">Available for withdrawal</p>
                <p className="text-sm sm:text-base md:text-lg font-bold text-slate-800 leading-normal whitespace-nowrap">{formatCurrency(summary.availableBalance)}</p>
              </div>
            </div>
            <button
              onClick={() => { fetchProviderProfile(); setShowWithdrawalModal(true); }}
              disabled={summary.availableBalance < (summary.minWithdrawalLimit ?? 500)}
              className="shrink-0 px-3 sm:px-6 py-2 sm:py-3 bg-accent text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1 sm:gap-2 shadow-sm"
            >
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Request Payout</span>
            </button>
          </div>
          {summary.availableBalance < (summary.minWithdrawalLimit ?? 500) && (
            <p className="text-xs text-red-500 mt-3">Minimum ₹{summary.minWithdrawalLimit ?? 500} required for withdrawal</p>
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
          <div className="overflow-visible">
            {/* Overview Tab */}
            {activeTab === 'dashboard' && (
              <>
                {/* Desktop View */}
                <div className="hidden md:block">
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
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4 p-4">
                  {withdrawalReport.length > 0 ? (
                    withdrawalReport.slice(0, 10).map((r, i) => (
                      <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-2.5">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-gray-50 rounded-lg text-secondary/40">
                              <ArrowDownLeft className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-secondary">Bank Payout</p>
                              <p className="text-xs text-secondary/40 font-mono">Ref: {r.transactionReference || 'N/A'}</p>
                            </div>
                          </div>
                          <Badge status={r.status} />
                        </div>
                        <div className="flex justify-between items-center text-xs text-secondary/50 pt-2 border-t border-gray-50">
                          <span>{formatDate(r.createdAt)} {formatTime(r.createdAt)}</span>
                          <span className="text-sm font-bold text-red-500">-{formatCurrency(r.amount)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-secondary/30 bg-white rounded-xl border border-gray-100">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-xs">No recent transactions</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Available Earnings Tab */}
            {activeTab === 'earnings' && (
              <>
                {/* Desktop View */}
                <div className="hidden md:block">
                  <table className="w-full text-left min-w-[950px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Booking ID</th>
                        <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-center">Date</th>
                        <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Service Price</th>
                        <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Commission</th>
                        <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Other Income</th>
                        <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider text-right">Net</th>
                        <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-medium text-secondary/40 uppercase tracking-wider">Method</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {earningsReport.filter(e => e.isWithdrawable).length > 0 ? (
                        earningsReport.filter(e => e.isWithdrawable).map((e, i) => {
                          let parsedSplits = e.surgeSplitSettings;
                          if (typeof parsedSplits === 'string') {
                            try {
                              parsedSplits = JSON.parse(parsedSplits);
                            } catch (err) {
                              parsedSplits = null;
                            }
                          }
                          const splits = {
                            visiting: parsedSplits?.visiting ?? fallbackSplits.visiting,
                            rain: parsedSplits?.rain ?? fallbackSplits.rain,
                            traffic: parsedSplits?.traffic ?? fallbackSplits.traffic,
                            night: parsedSplits?.night ?? fallbackSplits.night,
                            demand: parsedSplits?.demand ?? fallbackSplits.demand
                          };
                          const rainShare = parseFloat(((e.rainCharge || 0) * (splits.rain / 100)).toFixed(2));
                          const trafficShare = parseFloat(((e.trafficCharge || 0) * (splits.traffic / 100)).toFixed(2));
                          const nightShare = parseFloat(((e.nightCharge || 0) * (splits.night / 100)).toFixed(2));
                          const visitingShare = parseFloat(((e.visitingCharge || 0) * (splits.visiting / 100)).toFixed(2));
                          const demandShare = parseFloat(((e.demandSurge || 0) * (splits.demand / 100)).toFixed(2));
                          const otherIncome = parseFloat((rainShare + trafficShare + nightShare + visitingShare + demandShare).toFixed(2));
                          const servicePriceWithSurge = (e.price || 0) + otherIncome;

                          return (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-xs font-mono font-medium text-secondary/60">
                                {e.bookingId || `#${e.booking?.slice(-8)}`}
                              </td>
                              <td className="px-6 py-4 text-center text-sm text-secondary/50">
                                {formatDate(e.createdAt)}
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-medium text-primary">
                                {formatCurrency(servicePriceWithSurge)}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <p className="text-sm text-red-500 font-medium">-{formatCurrency(e.commissionAmount)}</p>
                                <p className="text-[10px] text-secondary/30">Fee {e.commissionRate}%</p>
                              </td>
                              <td className="px-6 py-4 text-right relative group">
                                <span
                                  className="text-sm font-medium text-emerald-600 border-b border-dashed border-emerald-450 cursor-pointer flex items-center justify-end gap-1 select-none"
                                >
                                  {formatCurrency(otherIncome)}
                                  <Info className="w-3.5 h-3.5 text-emerald-600/70" />
                                </span>
                                <div className="absolute right-0 top-full mt-2 w-52 bg-slate-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl z-50 leading-normal text-left opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
                                  <p className="font-bold border-b border-slate-700 pb-1 mb-1 text-[11px]">Surcharge Split Details</p>
                                  <div className="flex justify-between py-0.5">
                                    <span>Rain Charge</span>
                                    <span>{formatCurrency(rainShare)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5">
                                    <span>Traffic Charge</span>
                                    <span>{formatCurrency(trafficShare)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5">
                                    <span>Night Charge</span>
                                    <span>{formatCurrency(nightShare)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5 border-t border-slate-700 mt-1 pt-1 font-bold">
                                    <span>Vis. Charge</span>
                                    <span>{formatCurrency(visitingShare)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5 font-bold">
                                    <span>Demand Charge</span>
                                    <span>{formatCurrency(demandShare)}</span>
                                  </div>
                                  <div className="flex justify-between py-0.5 border-t border-slate-700 mt-1 pt-1 font-bold">
                                    <span>Total Surcharge</span>
                                    <span>{formatCurrency(otherIncome)}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-bold text-green-600">
                                {formatCurrency(e.netAmount)}
                              </td>
                              <td className="px-6 py-4">
                                <Badge status={e.payoutStatus || e.status} />
                              </td>
                              <td className="px-6 py-4 text-xs font-medium capitalize text-secondary/60">
                                {e.paymentMethod || '—'}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="8" className="py-16 text-center text-secondary/30">
                            No available earnings records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4 p-4">
                  {earningsReport.filter(e => e.isWithdrawable).length > 0 ? (
                    earningsReport.filter(e => e.isWithdrawable).map((e, i) => {
                      let parsedSplits = e.surgeSplitSettings;
                      if (typeof parsedSplits === 'string') {
                        try {
                          parsedSplits = JSON.parse(parsedSplits);
                        } catch (err) {
                          parsedSplits = null;
                        }
                      }
                      const splits = {
                        visiting: parsedSplits?.visiting ?? fallbackSplits.visiting,
                        rain: parsedSplits?.rain ?? fallbackSplits.rain,
                        traffic: parsedSplits?.traffic ?? fallbackSplits.traffic,
                        night: parsedSplits?.night ?? fallbackSplits.night,
                        demand: parsedSplits?.demand ?? fallbackSplits.demand
                      };
                      const rainShare = parseFloat(((e.rainCharge || 0) * (splits.rain / 100)).toFixed(2));
                      const trafficShare = parseFloat(((e.trafficCharge || 0) * (splits.traffic / 100)).toFixed(2));
                      const nightShare = parseFloat(((e.nightCharge || 0) * (splits.night / 100)).toFixed(2));
                      const visitingShare = parseFloat(((e.visitingCharge || 0) * (splits.visiting / 100)).toFixed(2));
                      const demandShare = parseFloat(((e.demandSurge || 0) * (splits.demand / 100)).toFixed(2));
                      const otherIncome = parseFloat((rainShare + trafficShare + nightShare + visitingShare + demandShare).toFixed(2));
                      const servicePriceWithSurge = (e.price || 0) + otherIncome;

                      return (
                        <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-mono font-medium text-secondary/60">
                                {e.bookingId || `#${e.booking?.slice(-8)}`}
                              </p>
                              <p className="text-[11px] text-secondary/40">{formatDate(e.createdAt)}</p>
                            </div>
                            <Badge status={e.payoutStatus || e.status} />
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs border-t border-gray-50 pt-2">
                            <div>
                              <p className="text-secondary/40">Service Price</p>
                              <p className="font-semibold text-primary">{formatCurrency(servicePriceWithSurge)}</p>
                            </div>
                            <div>
                              <p className="text-secondary/40">Commission</p>
                              <p className="font-semibold text-red-500">-{formatCurrency(e.commissionAmount)} ({e.commissionRate}%)</p>
                            </div>
                            <div className="relative group">
                              <p className="text-secondary/40 flex items-center gap-1 select-none">
                                Other
                                <button
                                  type="button"
                                  className="text-emerald-600 hover:text-emerald-700 focus:outline-none"
                                >
                                  <Info className="w-3 h-3 inline" />
                                </button>
                              </p>
                              <p className="font-semibold text-emerald-600">
                                {formatCurrency(otherIncome)}
                              </p>
                              {/* Surcharge Details Popover on Hover */}
                              <div className="absolute left-0 bottom-full mb-2 w-52 bg-slate-900 text-white text-[10px] p-2.5 rounded-lg shadow-xl z-50 leading-normal text-left opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
                                <p className="font-bold border-b border-slate-700 pb-1 mb-1 text-[11px]">Surcharge Split Details</p>
                                <div className="flex justify-between py-0.5">
                                  <span>Rain Charge</span>
                                  <span>{formatCurrency(rainShare)}</span>
                                </div>
                                <div className="flex justify-between py-0.5">
                                  <span>Traffic Charge</span>
                                  <span>{formatCurrency(trafficShare)}</span>
                                </div>
                                <div className="flex justify-between py-0.5">
                                  <span>Night Charge</span>
                                  <span>{formatCurrency(nightShare)}</span>
                                </div>
                                <div className="flex justify-between py-0.5 border-t border-slate-700 mt-1 pt-1 font-bold">
                                  <span>Vis. Charge</span>
                                  <span>{formatCurrency(visitingShare)}</span>
                                </div>
                                <div className="flex justify-between py-0.5 font-bold">
                                  <span>Demand Charge</span>
                                  <span>{formatCurrency(demandShare)}</span>
                                </div>
                                <div className="flex justify-between py-0.5 border-t border-slate-700 mt-1 pt-1 font-bold">
                                  <span>Total Surcharge</span>
                                  <span>{formatCurrency(otherIncome)}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-secondary/40">Net Amt</p>
                              <p className="font-bold text-green-600">+{formatCurrency(e.netAmount)}</p>
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-secondary/40 border-t border-gray-50 pt-2">
                            <span>Method: <span className="font-semibold capitalize text-secondary/60">{e.paymentMethod || '—'}</span></span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-secondary/30 bg-white rounded-xl border border-gray-100">
                      No available earnings records found
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'held' && (
              <div className="p-4 space-y-4">
                <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3">
                  <Lock className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-orange-800">Payout Holds</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      Earnings are temporarily held for {systemSettings?.commissionSettings?.payoutHoldHours ?? 48} hours for customer protection or during active disputes.
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
              <>
                {/* Desktop View */}
                <div className="hidden md:block">
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
                            <td className="px-6 py-4 capitalize">
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
                </div>

                {/* Mobile View */}
                <div className="md:hidden space-y-4 p-4">
                  {withdrawalReport.length > 0 ? (
                    withdrawalReport.map((r, i) => (
                      <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-50 rounded-lg text-secondary/40">
                              <ArrowDownLeft className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-secondary">Payout</p>
                              <p className="text-xs text-secondary/40 font-mono">{r.transactionReference || 'REF_PENDING'}</p>
                            </div>
                          </div>
                          <Badge status={r.status} />
                        </div>
                        <div className="flex justify-between items-center text-xs text-secondary/50 pt-2 border-t border-gray-50">
                          <span>{formatDate(r.createdAt)}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-red-500">{formatCurrency(r.amount)}</span>
                            <button
                              onClick={() => setSelectedWithdrawal(r)}
                              className="p-1.5 text-secondary/40 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-secondary/30 bg-white rounded-xl border border-gray-100">
                      No payout history logged
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
                {/* Responsive Date Period Filter */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                  <div className="flex flex-col xs:flex-row xs:items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2 text-slate-500 shrink-0">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Select Period:</span>
                    </div>
                    <div className="flex items-center gap-2 w-full xs:w-auto">
                      <input
                        type="date"
                        value={dateFilter.startDate}
                        onChange={e => setDateFilter(p => ({ ...p, startDate: e.target.value }))}
                        className="w-full xs:w-auto px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 shadow-sm"
                      />
                      <span className="text-slate-300 font-bold shrink-0">→</span>
                      <input
                        type="date"
                        value={dateFilter.endDate}
                        onChange={e => setDateFilter(p => ({ ...p, endDate: e.target.value }))}
                        className="w-full xs:w-auto px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-slate-700 shadow-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                    className="text-xs font-bold text-teal-650 hover:text-teal-750 transition-colors self-end sm:self-center shrink-0 border border-teal-100 px-3.5 py-2 rounded-lg bg-teal-50/50 hover:bg-teal-50"
                  >
                    Clear Filters
                  </button>
                </div>

                {/* Info Note */}
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    <strong>Note:</strong> To download reports, select a date range. The selected range must be between <strong>7 days</strong> and <strong>2 months</strong>.
                  </span>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Earnings Report Card */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 flex flex-col justify-between">
                    <div>
                      <div className="p-3 bg-white rounded-lg text-primary mb-4 w-fit shadow-sm border border-gray-100/50">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-secondary mb-1">Earnings Report</h4>
                      <p className="text-xs text-secondary/40 mb-5">Full spreadsheet of services, revenue, and commission fees.</p>
                    </div>
                    <button
                      onClick={() => downloadReport('earnings')}
                      disabled={!dateFilter.startDate || !dateFilter.endDate || downloading.earnings}
                      className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      {downloading.earnings ? 'Generating...' : 'Download Excel'}
                    </button>
                  </div>

                  {/* Withdrawals Report Card */}
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 flex flex-col justify-between">
                    <div>
                      <div className="p-3 bg-white rounded-lg text-primary mb-4 w-fit shadow-sm border border-gray-100/50">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-secondary mb-1">Withdrawal Report</h4>
                      <p className="text-xs text-secondary/40 mb-5">Detailed history of bank transfers and clearance statuses.</p>
                    </div>
                    <button
                      onClick={() => downloadReport('withdrawals')}
                      disabled={!dateFilter.startDate || !dateFilter.endDate || downloading.withdrawals}
                      className="w-full py-3 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
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
        <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden animate-scale-up">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-secondary">Withdraw Funds</h3>
              <button onClick={() => setShowWithdrawalModal(false)} className="p-1 hover:bg-gray-100 rounded-lg text-secondary/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <p className="text-[11px] sm:text-xs text-secondary/50 mb-0.5">Available Balance</p>
                <p className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(summary.availableBalance)}</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-secondary/70 mb-1.5">Amount (₹)</label>
                <input
                  type="number"
                  value={withdrawalForm.amount}
                  onChange={e => setWithdrawalForm({ amount: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-base sm:text-lg font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter amount"
                />
                <p className="mt-1 text-[10px] sm:text-xs text-secondary/40">* Minimum ₹{summary.minWithdrawalLimit ?? 500} required</p>
              </div>

              {providerBankDetails && (
                <Link
                  to="/provider/profile"
                  className="block p-3 bg-gray-50 hover:bg-gray-100/70 border border-gray-200 hover:border-teal-200 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-[9px] sm:text-[10px] font-semibold text-secondary/40 uppercase tracking-wider">Destination Account</p>
                    <span className="text-[9px] sm:text-[10px] text-primary group-hover:underline font-bold">Edit Details →</span>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white rounded-lg text-primary shadow-sm border border-gray-100 group-hover:bg-primary/5 mt-0.5">
                      <Building className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-secondary truncate">
                        {providerBankDetails.bankName || 'Your Bank'}
                      </p>
                      <p className="text-[11px] sm:text-xs text-secondary/60 font-semibold mt-0.5">
                        A/C: {providerBankDetails.accountNo?.replace(/.(?=.{4})/g, '•') || 'N/A'}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-secondary/40 font-mono mt-0.5 uppercase">
                        IFSC: {providerBankDetails.ifsc || 'N/A'}
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-secondary/40 font-medium mt-0.5">
                        Holder: {providerBankDetails.accountName || providerBankDetails.accountHolderName || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Verification Status Banner */}
                  <div className="pt-1.5 border-t border-gray-200">
                    {providerBankDetails.verified ? (
                      <div className="flex items-center gap-1.5 p-1.5 bg-green-50 border border-green-100 text-green-700 rounded-lg text-[10px] sm:text-xs font-medium animate-fadeIn">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0 text-green-600" />
                        <span>Bank details verified and active.</span>
                      </div>
                    ) : providerBankDetails.verificationStatus === 'rejected' ? (
                      <div className="flex flex-col gap-0.5 p-1.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-[10px] sm:text-xs font-medium animate-fadeIn">
                        <div className="flex items-center gap-1 font-bold">
                          <XCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                          <span>Bank Details Rejected</span>
                        </div>
                        <p className="text-[9px] text-red-650/80">Please update bank details in profile to resubmit.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5 p-1.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg text-[10px] sm:text-xs font-medium animate-fadeIn">
                        <div className="flex items-center gap-1 font-bold">
                          <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                          <span>Pending Verification</span>
                        </div>
                        <p className="text-[9px] text-amber-650/80">Withdrawals are locked until details are approved.</p>
                      </div>
                    )}
                  </div>
                </Link>
              )}

              <button
                onClick={handleWithdrawalRequest}
                disabled={processingWithdrawal || !withdrawalForm.amount || withdrawalForm.amount < (summary.minWithdrawalLimit ?? 500) || !providerBankDetails?.verified}
                className="w-full py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {processingWithdrawal ? 'Processing...' : 'Request Payout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Details Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-secondary/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] sm:max-h-[90vh] overflow-y-auto scrollbar-hide animate-scale-up border border-gray-100" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-secondary">Payout Details</h3>
                <p className="text-[10px] sm:text-xs text-secondary/40 font-mono mt-0.5">Ref: {selectedWithdrawal.transactionReference || 'N/A'}</p>
              </div>
              <button onClick={() => setSelectedWithdrawal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-secondary/40 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
              <div className="flex items-center justify-between bg-emerald-50/50 p-3 sm:p-4 rounded-xl border border-emerald-100/50">
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-emerald-700/75 uppercase tracking-wider">Net Disbursed</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-0.5">{formatCurrency(selectedWithdrawal.netAmount || selectedWithdrawal.amount)}</p>
                </div>
                <Badge className="capitalize" status={selectedWithdrawal.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-100/50">
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-secondary/45 uppercase tracking-wider mb-0.5">Status</p>
                  <p className="text-xs sm:text-sm font-semibold text-secondary capitalize">{selectedWithdrawal.status?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-secondary/45 uppercase tracking-wider mb-0.5">Requested Amount</p>
                  <p className="text-xs sm:text-sm font-semibold text-secondary">{formatCurrency(selectedWithdrawal.amount)}</p>
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-secondary/45 uppercase tracking-wider mb-0.5">Request Date</p>
                  <p className="text-xs sm:text-sm font-semibold text-secondary">{formatDate(selectedWithdrawal.createdAt)}</p>
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-secondary/45 uppercase tracking-wider mb-0.5">Transfer Info</p>
                  <p className="text-xs sm:text-sm font-semibold text-secondary">
                    {selectedWithdrawal.transferDate ? (
                      selectedWithdrawal.transferTime 
                        ? `${formatDate(selectedWithdrawal.transferDate)} at ${formatTime(selectedWithdrawal.transferTime)}`
                        : formatDate(selectedWithdrawal.transferDate)
                    ) : 'Pending'}
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-[9px] sm:text-[10px] font-bold text-secondary/45 uppercase tracking-wider mb-2">Bank Destination</p>
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-lg text-primary border border-slate-100 shadow-sm mt-0.5">
                    <Building className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-secondary truncate">
                       {selectedWithdrawal.paymentDetails?.bankName || providerBankDetails?.bankName || 'Your Bank'}
                    </p>
                    <p className="text-[11px] sm:text-xs text-secondary/60 font-semibold mt-0.5">
                      A/C: {selectedWithdrawal.paymentDetails?.accountNumber || providerBankDetails?.accountNo || 'N/A'}
                    </p>
                    {(selectedWithdrawal.paymentDetails?.ifscCode || providerBankDetails?.ifscCode || providerBankDetails?.ifsc) && (
                      <p className="text-[9px] sm:text-[10px] text-secondary/40 font-mono mt-0.5 uppercase">
                        IFSC: {selectedWithdrawal.paymentDetails?.ifscCode || providerBankDetails?.ifscCode || providerBankDetails?.ifsc}
                      </p>
                    )}
                    {(selectedWithdrawal.paymentDetails?.accountName || providerBankDetails?.accountName || providerBankDetails?.accountHolderName) && (
                      <p className="text-[9px] sm:text-[10px] text-secondary/40 font-medium mt-0.5">
                        Holder: {selectedWithdrawal.paymentDetails?.accountName || providerBankDetails?.accountName || providerBankDetails?.accountHolderName}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {(selectedWithdrawal.adminRemark || selectedWithdrawal.paymentDetails) && (
                <div className="p-3 sm:p-4 bg-amber-50/70 border border-amber-100/70 rounded-xl">
                  <p className="text-[9px] sm:text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1.5">Notes from Admin/System</p>
                  {selectedWithdrawal.adminRemark && <p className="text-xs sm:text-sm font-medium text-amber-900">{selectedWithdrawal.adminRemark}</p>}
                  {selectedWithdrawal.paymentDetails && (
                    <div className="text-[11px] sm:text-xs text-amber-855 mt-2 space-y-1">
                      {typeof selectedWithdrawal.paymentDetails === 'object' ? (
                        Object.entries(selectedWithdrawal.paymentDetails).map(([k, v]) => {
                          if (!v) return null;
                          return (
                            <div key={k} className="flex justify-between py-0.5 border-b border-amber-100/30 last:border-0">
                              <span className="capitalize text-amber-750 font-medium">{k.replace(/([A-Z])/g, ' $1')}:</span>
                              <span className="font-semibold text-amber-900">{v?.toString()}</span>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-amber-800">{selectedWithdrawal.paymentDetails}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 sm:px-6 sm:py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setSelectedWithdrawal(null)}
                className="w-full py-3 bg-white border border-gray-250 text-secondary/70 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-secondary/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
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
