import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/auth';
import {
  X, Eye, Building, BarChart3, FileText, Download,
  TrendingUp, TrendingDown, Activity, Wallet, Clock, CheckCircle, ChevronUp, ChevronDown, DollarSign, Calendar, Lock
} from 'lucide-react';
import * as PaymentService from '../../../services/PaymentService';
import * as ProviderService from '../../../services/ProviderService';
import { formatDate, formatCurrency, formatTime } from '../../../utils/format';
import { getStatusConfig } from '../../../utils/providerHelpers';
import DashboardSkeleton from '../../../components/ui-skeletons/DashboardSkeleton';
import StatCard from '../../../components/ui/StatCard';
import Pagination from '../../../components/ui/Pagination';
import usePagination from '../../../hooks/usePagination';

// ── Shared UI Badge ─────────────────────
const Badge = ({ status, className = "" }) => {
  const cfg = getStatusConfig(status);
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cfg.color} ${className}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
  );
};

// ── Main Dashboard Component ─────────────────────────────────────────────────
const ProviderEarningsDashboard = () => {
  const { showToast, systemSettings } = useAuth();
  const navigate = useNavigate();
  // NOTE: No surge-split percentages here — providerSurgeShare is returned
  // directly by the backend API and must never be recalculated in the frontend.

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: BarChart3 },
    { id: 'earnings', label: 'Available', icon: Wallet },
    { id: 'held', label: 'Held', icon: Lock },
    { id: 'withdrawals', label: 'Withdrawals', icon: FileText },
    { id: 'reports', label: 'Reports', icon: Download },
  ];

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    grossBilled: 0,          // SUM(grossAmount) — service base billed; NOT net
    totalEarnings: 0,        // SUM(netAmount) for period
    todayEarnings: 0,
    totalWithdrawn: 0,
    availableBalance: 0,
    totalPendingWithdrawals: 0,
    heldAmount: 0,
    minWithdrawalLimit: 500
  });

  const {
    currentPage,
    limit,
    totalItems,
    setTotalItems,
    totalPages,
    onPageChange
  } = usePagination(1, 10);

  const [earningsReport, setEarningsReport] = useState([]);
  const [heldEarnings, setHeldEarnings] = useState([]);
  const [withdrawalReport, setWithdrawalReport] = useState([]);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [expandedWeekly, setExpandedWeekly] = useState(false);
  const [expandedMonthly, setExpandedMonthly] = useState(false);
  const [downloading, setDownloading] = useState({
    earnings: false,
    withdrawals: false
  });
  const [providerBankDetails, setProviderBankDetails] = useState(null);
  const [dateFilter, setDateFilter] = useState({ startDate: '', endDate: '' });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeFilter, setTimeFilter] = useState('month');
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [hasError, setHasError] = useState(false);

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
          // grossBilled: separate SUM(grossAmount) aggregate from backend — MUST NOT fall back to totalEarnings
          grossBilled:            data.grossBilled            ?? null,
          totalEarnings:          data.totalEarnings          ?? 0,
          todayEarnings:          data.todayEarnings          ?? 0,
          availableBalance:       data.availableBalance       ?? 0,
          heldAmount:             data.heldAmount             ?? 0,
          totalWithdrawn:         data.totalWithdrawn         ?? 0,
          totalPendingWithdrawals: data.pendingWithdrawals    ?? 0,
          minWithdrawalLimit:     data.minWithdrawalLimit     ?? 500
        });
      } else {
        setHasError(true);
      }
    } catch (err) {
      console.error('Failed to fetch summary:', err);
      setHasError(true);
    }
  }, [timeFilter]);

  const fetchWeeklyMonthlyData = useCallback(async () => {
    try {
      const response = await PaymentService.getWeeklyMonthlyStats();
      const data = response.data;
      if (data.success) {
        setWeeklyData(data.weekly || []);
        setMonthlyData(data.monthly || []);
      } else {
        setHasError(true);
      }
    } catch (err) {
      console.error('Failed to fetch weekly/monthly stats:', err);
      setHasError(true);
    }
  }, []);

  const fetchEarningsReport = useCallback(async () => {
    try {
      const params = { page: currentPage, limit };
      if (dateFilter.startDate) params.startDate = dateFilter.startDate;
      if (dateFilter.endDate) params.endDate = dateFilter.endDate;

      const response = await PaymentService.getEarningsReport(params);
      const data = response.data;
      if (data.success) {
        setEarningsReport(data.earnings || []);
        setTotalItems(data.total || 0);
      } else {
        setHasError(true);
      }
    } catch {
      showToast('Failed to fetch earnings', 'error');
      setHasError(true);
    }
  }, [currentPage, limit, dateFilter, showToast, setTotalItems]);

  const fetchHeldEarnings = useCallback(async () => {
    try {
      const response = await PaymentService.getHeldEarnings();
      const data = response.data;
      if (data.success) setHeldEarnings(data.earnings || []);
    } catch {
      // Failed silently
    }
  }, []);

  const fetchWithdrawalReport = useCallback(async () => {
    try {
      const params = {};
      if (dateFilter.startDate) params.startDate = dateFilter.startDate;
      if (dateFilter.endDate) params.endDate = dateFilter.endDate;

      const response = await PaymentService.getWithdrawalReport(params);
      const data = response.data;
      if (data.success) {
        setWithdrawalReport(data.records || []);
      } else {
        setHasError(true);
      }
    } catch {
      showToast('Failed to fetch withdrawals', 'error');
      setHasError(true);
    }
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
        } catch {
          return;
        }
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

  const [commissionStatus, setCommissionStatus] = useState(null);

  const fetchCommissionStatus = useCallback(async () => {
    try {
      const res = await ProviderService.getCommissionStatus();
      if (res.data?.success) {
        setCommissionStatus(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch provider commission status:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setHasError(false);
    try {
      await Promise.all([
        fetchSummary(),
        fetchWeeklyMonthlyData(),
        fetchEarningsReport(),
        fetchWithdrawalReport(),
        fetchHeldEarnings(),
        fetchProviderProfile(),
        fetchCommissionStatus()
      ]);
    } catch (err) {
      console.error('Refresh all error:', err);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, fetchWeeklyMonthlyData, fetchEarningsReport, fetchWithdrawalReport, fetchHeldEarnings, fetchProviderProfile, fetchCommissionStatus]);

  const getTrend = (current, previous) => ({
    trend: previous === 0 ? 'neutral' : current > previous ? 'up' : current < previous ? 'down' : 'neutral',
    percentage: previous === 0 ? 0 : Math.abs(((current - previous) / previous) * 100).toFixed(1)
  });

  useEffect(() => { refreshAll(); }, [refreshAll]);
  useEffect(() => { fetchSummary(); }, [timeFilter, fetchSummary]);
  useEffect(() => { fetchEarningsReport(); fetchWithdrawalReport(); }, [dateFilter, fetchEarningsReport, fetchWithdrawalReport]);

  useEffect(() => {
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  if (loading && !summary.totalEarnings && !earningsReport.length) {
    return <DashboardSkeleton type="provider" showRecentBookings={true} />;
  }

  const getPeriodRangeLabel = () => {
    const now = new Date();
    let start;
    if (timeFilter === 'day') { start = new Date(now); start.setHours(0, 0, 0, 0); }
    else if (timeFilter === 'week') {
      const d = new Date(now);
      const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(d.setDate(diff)); start.setHours(0, 0, 0, 0);
    }
    else if (timeFilter === 'month') { start = new Date(now.getFullYear(), now.getMonth(), 1); }
    else if (timeFilter === 'year') { start = new Date(now.getFullYear(), 0, 1); }
    return `${formatDate(start)} to ${formatDate(now)}`;
  };
  const periodText = getPeriodRangeLabel();

  // Pre-calculate last payout entry
  const lastWithdrawal = withdrawalReport.length > 0 ? withdrawalReport[0] : null;

  return (
    <div className="min-h-screen font-inter bg-neutral-50/50 text-secondary">
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-8 flex flex-col gap-6">

        {/* Header (Desktop only) */}
        <div className="hidden md:flex flex-row items-center justify-between border-b border-neutral-100 pb-3">
          <div>
            <h1 className="text-xl font-bold text-neutral-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Earnings
            </h1>
            <p className="text-xs text-neutral-500">Track payouts and available balance</p>
          </div>
        </div>

        {/* Time Filter */}
        <div className="grid grid-cols-4 gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200 shadow-sm">
          {[
            { value: 'day', label: 'Today' },
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
            { value: 'year', label: 'This Year' }
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeFilter(opt.value)}
              className={`py-2 text-[10px] sm:text-xs font-bold text-center rounded-lg transition-all ${timeFilter === opt.value
                ? 'bg-primary text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Primary Wallet Card */}
        <div className="p-4 md:p-6 rounded-2xl bg-gradient-to-br from-neutral-800 via-neutral-900 to-black text-white shadow-md relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] font-bold uppercase tracking-wider">
                <Wallet className="w-4 h-4 text-primary" />
                <span>Available Balance</span>
              </div>
              <div className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
                {formatCurrency(summary.availableBalance)}
              </div>
              {lastWithdrawal && (
                <p className="text-[10px] text-neutral-400 mt-0.5">
                  Last Settlement: <span className="text-white font-semibold">{formatCurrency(lastWithdrawal.amount)}</span> ({lastWithdrawal.status ? lastWithdrawal.status.charAt(0).toUpperCase() + lastWithdrawal.status.slice(1).toLowerCase() : ''}) on {formatDate(lastWithdrawal.createdAt)}
                </p>
              )}
            </div>

            <div className="shrink-0">
              <button
                onClick={() => navigate('/provider/profile', { state: { tab: 'payout' } })}
                className="w-full sm:w-auto px-5 py-2.5 bg-accent text-white font-bold text-xs rounded-xl hover:bg-accent/90 transition-all shadow-sm flex items-center justify-center gap-1.5 min-w-[140px]"
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Withdraw / Manage Payout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards / Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { title: 'Withdrawable Balance', val: summary.availableBalance, iconBg: 'bg-primary/10', iconColor: 'text-primary', icon: Wallet },
            { title: "Today's Earnings", val: summary.todayEarnings, iconBg: 'bg-success/10', iconColor: 'text-success', icon: Activity },
            { title: 'Processing', val: summary.totalPendingWithdrawals, iconBg: 'bg-warning/10', iconColor: 'text-warning', icon: Clock },
            { title: 'Held Amount', val: summary.heldAmount, iconBg: 'bg-danger/10', iconColor: 'text-danger', icon: Lock }
          ].map((card, i) => (
            <StatCard
              key={i}
              title={card.title}
              value={formatCurrency(card.val)}
              icon={card.icon}
              iconBg={card.iconBg}
              iconColor={card.iconColor}
            />
          ))}
        </div>

        {/* Rating-Based Dynamic Commission Status Card */}
        {commissionStatus && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/80 p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white font-extrabold text-[10px] uppercase tracking-wider">
                    {commissionStatus.currentRule?.conditionType === 'rating' ? '⭐ Rating Commission Tier' : 'Standard Commission'}
                  </span>
                  <span className="text-xs font-bold text-amber-900">
                    Rule: {commissionStatus.currentRule?.name || 'System Default'}
                  </span>
                </div>
                <p className="text-xs text-amber-800 font-medium">
                  Effective Commission: <span className="font-extrabold text-amber-950">{commissionStatus.currentRule?.type === 'fixed' ? `₹${commissionStatus.currentRule?.value}` : `${commissionStatus.currentRule?.value || 10}%`}</span>
                </p>
              </div>
              <div className="flex items-center gap-4 bg-white/80 px-3 py-2 rounded-xl border border-amber-200/60 shadow-xs">
                <div className="text-center">
                  <p className="text-[9px] text-amber-700 font-bold uppercase tracking-wider">30-Day Rating</p>
                  <p className="text-sm font-black text-amber-950">{commissionStatus.averageRating ? `${commissionStatus.averageRating}★` : 'No reviews'}</p>
                </div>
                <div className="h-6 w-px bg-amber-200" />
                <div className="text-center">
                  <p className="text-[9px] text-amber-700 font-bold uppercase tracking-wider">Reviews</p>
                  <p className="text-sm font-black text-amber-950">{commissionStatus.ratingCount}</p>
                </div>
                <div className="h-6 w-px bg-amber-200" />
                <div className="text-center">
                  <p className="text-[9px] text-amber-700 font-bold uppercase tracking-wider">Status</p>
                  <p className={`text-xs font-black ${commissionStatus.eligibleForRatingCommission ? 'text-green-700' : 'text-amber-700'}`}>
                    {commissionStatus.eligibleForRatingCommission ? 'Qualified' : 'Rating Commission: Not configured'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performance Accordion / Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Weekly Performance */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            <button
              onClick={() => setExpandedWeekly(!expandedWeekly)}
              className="w-full flex items-center justify-between text-left"
            >
              <h3 className="font-bold text-neutral-800 flex items-center gap-1.5 text-xs md:text-sm">
                <BarChart3 className="w-4 h-4 text-primary" />
                Weekly Performance
              </h3>
              <div className="text-neutral-400">
                {expandedWeekly ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            <div className={`mt-3 ${expandedWeekly ? 'block' : 'hidden'}`}>
              {weeklyData.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {weeklyData.slice(0, 4).map((w) => (
                    <div key={w.week} className="bg-neutral-50/50 p-2.5 rounded-xl border border-neutral-100 flex flex-col justify-between">
                      <div>
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">{w.week}</p>
                        <p className="text-xs font-bold text-neutral-800 mt-0.5">{formatCurrency(w.earnings)}</p>
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">{w.count} jobs</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-400 text-xs bg-neutral-50/30 border border-neutral-100 border-dashed rounded-xl">
                  <Activity className="w-5 h-5 mx-auto text-neutral-300 mb-1" />
                  <p className="font-semibold text-neutral-500 text-[10px]">No weekly data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Performance */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
            <button
              onClick={() => setExpandedMonthly(!expandedMonthly)}
              className="w-full flex items-center justify-between text-left"
            >
              <h3 className="font-bold text-neutral-800 flex items-center gap-1.5 text-xs md:text-sm">
                <Activity className="w-4 h-4 text-primary" />
                Monthly Performance
              </h3>
              <div className="text-neutral-400">
                {expandedMonthly ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>
            <div className={`mt-3 ${expandedMonthly ? 'block' : 'hidden'}`}>
              {monthlyData.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {monthlyData.slice(0, 6).map((m, i) => {
                    const trend = i > 0 ? getTrend(m.earnings, monthlyData[i - 1].earnings) : { trend: 'neutral' };
                    return (
                      <div key={m.month} className="bg-neutral-50/50 p-2 rounded-xl border border-neutral-100 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider truncate">{m.month}</span>
                          {trend.trend === 'up' && <TrendingUp className="w-2.5 h-2.5 text-success shrink-0" />}
                          {trend.trend === 'down' && <TrendingDown className="w-2.5 h-2.5 text-danger shrink-0" />}
                        </div>
                        <p className="text-xs font-bold text-neutral-800 mt-1">{formatCurrency(m.earnings)}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-400 text-xs bg-neutral-50/30 border border-neutral-100 border-dashed rounded-xl">
                  <BarChart3 className="w-5 h-5 mx-auto text-neutral-300 mb-1" />
                  <p className="font-semibold text-neutral-500 text-[10px]">No monthly data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Sticky Tabs */}
        <div className="sticky top-0 z-20 bg-neutral-50/95 backdrop-blur-md border-b border-neutral-200/50 flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all rounded-full whitespace-nowrap border border-transparent ${activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm font-extrabold'
                  : 'text-neutral-550 hover:text-neutral-800 hover:bg-white hover:border-neutral-100'
                  }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content area */}
        <div className="min-h-[200px]">

          {/* Overview Panel */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 bg-neutral-100/50 p-3 rounded-2xl border border-neutral-200/30 shadow-sm">
                <div className="bg-white p-4 rounded-xl border border-neutral-100/50 shadow-sm flex-1 flex flex-col justify-between min-h-[105px]">
                  <div>
                    <span className="text-[10px] md:text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Net Earnings
                    </span>
                    {/* totalEarnings = SUM(netAmount) from backend (provider's Net Receivable take-home) */}
                    <p className="text-lg md:text-xl font-extrabold text-neutral-800 mt-1">
                      {hasError ? '—' : formatCurrency(summary.totalEarnings)}
                    </p>
                  </div>
                  <p className="text-[9px] text-neutral-400 font-medium mt-2 pt-1.5 border-t border-neutral-50 leading-tight">
                    Net booking revenue from {periodText}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-neutral-100/50 shadow-sm flex-1 flex flex-col justify-between min-h-[105px]">
                  <div>
                    <span className="text-[10px] md:text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Total Withdrawn
                    </span>
                    <p className="text-lg md:text-xl font-extrabold text-neutral-800 mt-1">{hasError ? '—' : formatCurrency(summary.totalWithdrawn)}</p>
                  </div>
                  <p className="text-[9px] text-neutral-400 font-medium mt-2 pt-1.5 border-t border-neutral-50 leading-tight">
                    Completed payouts from {periodText}
                  </p>
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Booking ID</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Date</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right pb-3">Net Amount</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Status</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {earningsReport.length > 0 ? (
                      earningsReport.map((e, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-4 py-3 text-xs font-mono font-medium text-neutral-600">
                            {e.bookingId || `#${e.booking?.slice(-8)}`}
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-550">
                            {formatDate(e.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-success">
                            {formatCurrency(e.netAmount)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge status={e.payoutStatus || e.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-550 capitalize">
                            {e.paymentMethod || '—'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-neutral-400 text-xs">
                          <Activity className="w-8 h-8 mx-auto text-neutral-350 mb-2" />
                          <p className="font-bold text-neutral-700">No recent bookings found</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">Your booking transaction records will appear here.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  limit={limit}
                  onPageChange={onPageChange}
                />
              </div>

              {/* Mobile Card list */}
              <div className="md:hidden space-y-2.5">
                {earningsReport.length > 0 ? (
                  <>
                    {earningsReport.map((e, idx) => (
                      <div key={idx} className="p-3.5 rounded-xl border border-neutral-100 bg-white shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-neutral-700">{e.bookingId || `#${e.booking?.slice(-8)}`}</span>
                          <Badge status={e.payoutStatus || e.status} />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-neutral-500">
                          <span>{formatDate(e.createdAt)}</span>
                          <span className="capitalize">{e.paymentMethod || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-50">
                          <span className="text-xs text-neutral-500 font-medium">Net Earnings</span>
                          <span className="text-sm font-bold text-success">+{formatCurrency(e.netAmount)}</span>
                        </div>
                      </div>
                    ))}
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      limit={limit}
                      onPageChange={onPageChange}
                    />
                  </>
                ) : (
                  <div className="py-12 text-center text-neutral-400 text-xs bg-white rounded-xl border border-neutral-100 space-y-2">
                    <Activity className="w-8 h-8 mx-auto text-neutral-300" />
                    <p className="font-bold text-neutral-700">No recent bookings found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Available Panel */}
          {activeTab === 'earnings' && (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Booking ID</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right pb-3">Service Price</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right pb-3">Commission</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right pb-3">Surcharge/Bonus</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right pb-3">Net</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Status</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {earningsReport.filter(e => e.isWithdrawable).length > 0 ? (
                      earningsReport.filter(e => e.isWithdrawable).map((e, idx) => {
                        // Backend provides all financial values — no recalculation in frontend.
                        // e.baseAmount        = service price / commission base (grossAmount)
                        // e.commissionAmount  = platform commission
                        // e.providerSurgeShare = provider's surcharge/bonus share
                        // e.netAmount         = final net receivable
                        const servicePrice   = e.baseAmount;
                        const commission     = e.commissionAmount;
                        const surchargeBonus = e.providerSurgeShare;

                        return (
                          <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                            <td className="px-4 py-3 text-xs font-mono font-medium text-neutral-600">
                              {e.bookingId || `#${e.booking?.slice(-8)}`}
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-medium text-neutral-700">
                              {servicePrice != null ? formatCurrency(servicePrice) : '—'}
                            </td>
                             <td className="px-4 py-3 text-right text-xs font-medium text-danger">
                              <span>{commission != null ? `-${formatCurrency(commission)}` : '—'}</span>
                              {e.paymentMethod === 'cash' && commission > 0 && (
                                <span className="text-[10px] text-danger font-bold ml-1.5 whitespace-nowrap bg-danger/5 px-1.5 py-0.5 rounded">
                                  (₹{commission} Wallet Debit)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-bold text-success">
                              {surchargeBonus != null && surchargeBonus > 0 ? `+${formatCurrency(surchargeBonus)}` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-bold text-success">
                              {formatCurrency(e.netAmount)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge status={e.payoutStatus || e.status} />
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-550 capitalize font-medium">
                              {e.paymentMethod || '—'}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-neutral-400 text-xs">
                          <Wallet className="w-8 h-8 mx-auto text-neutral-350 mb-2" />
                          <p className="font-bold text-neutral-700">No withdrawable earnings records found</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">Cleared balances ready for payout requests will display here.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  limit={limit}
                  onPageChange={onPageChange}
                />
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {earningsReport.filter(e => e.isWithdrawable).length > 0 ? (
                  <>
                    {earningsReport.filter(e => e.isWithdrawable).map((e, idx) => {
                      // Backend-authoritative fields — no frontend recalculation.
                      const servicePrice   = e.baseAmount;
                      const commission     = e.commissionAmount;
                      const surchargeBonus = e.providerSurgeShare;

                      return (
                        <div key={idx} className="p-3.5 rounded-xl border border-neutral-100 bg-white shadow-sm space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-mono font-bold text-neutral-700">{e.bookingId || `#${e.booking?.slice(-8)}`}</span>
                            <Badge status={e.payoutStatus || e.status} />
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-neutral-50">
                            <div>
                              <span className="text-neutral-400 block font-medium">Service Price</span>
                              <span className="font-semibold text-neutral-700">
                                {servicePrice != null ? formatCurrency(servicePrice) : '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-400 block font-medium">Commission</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-danger">
                                  {commission != null ? `-${formatCurrency(commission)}` : '—'}
                                </span>
                                {e.paymentMethod === 'cash' && commission > 0 && (
                                  <span className="text-[9px] text-danger font-bold bg-danger/5 px-1 py-0.5 rounded whitespace-nowrap">
                                    (₹{commission} Wallet Debit)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-neutral-400 block font-medium">Bonus / Surcharge</span>
                              <span className="font-semibold text-success">
                                {surchargeBonus != null && surchargeBonus > 0 ? `+${formatCurrency(surchargeBonus)}` : '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-neutral-400 block font-medium">Net Earnings</span>
                              <span className="font-bold text-success">{formatCurrency(e.netAmount)}</span>
                            </div>
                            <div>
                              <span className="text-neutral-400 block font-medium">Method</span>
                              <span className="font-semibold text-neutral-700 capitalize">{e.paymentMethod || '—'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      limit={limit}
                      onPageChange={onPageChange}
                    />
                  </>
                ) : (
                  <div className="py-12 text-center text-neutral-400 text-xs bg-white rounded-xl border border-neutral-100 space-y-2">
                    <Wallet className="w-8 h-8 mx-auto text-neutral-300" />
                    <p className="font-bold text-neutral-700">No withdrawable earnings records found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Held Panel */}
          {activeTab === 'held' && (
            <div className="space-y-4">
              <div className="p-3 bg-warning/5 border border-warning/10 rounded-xl flex items-start gap-2">
                <Lock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-warning">Payout Holds Policy</p>
                  <p className="text-[11px] text-neutral-600 mt-0.5">
                    Earnings are held for {systemSettings?.commissionSettings?.payoutHoldHours ?? 48} hours for security verification.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {heldEarnings.length > 0 ? (
                  heldEarnings.map((e, idx) => (
                    <div key={idx} className="p-4 bg-white border border-neutral-100 rounded-xl shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-neutral-700">{e.bookingId || `#${e.booking?.slice(-8)}`}</span>
                        <span className="text-sm font-extrabold text-neutral-800">{formatCurrency(e.netAmount)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-neutral-50 text-neutral-600">
                        <div>
                          <span className="text-neutral-400 block">Reason</span>
                          <span className="font-medium">{e.holdReason || 'Standard Hold'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-400 block">Release Date</span>
                          <span className="font-semibold text-neutral-700">
                            {e.holdUntil ? formatDate(e.holdUntil) : 'Under Review'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-white rounded-2xl border border-neutral-100 shadow-sm space-y-2">
                    <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto text-success">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-neutral-800">No Payouts on Hold</p>
                    <p className="text-[10px] text-neutral-500">All earnings are available or fully withdrawn.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Withdrawals Panel */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto bg-white rounded-2xl border border-neutral-100 shadow-sm p-4">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Reference ID</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right pb-3">Amount</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Date</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider pb-3">Status</th>
                      <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right pb-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {withdrawalReport.length > 0 ? (
                      withdrawalReport.map((r, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-4 py-3 text-xs font-mono font-medium text-neutral-600">
                            {r.transactionReference || 'REF_PENDING'}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-danger">
                            -{formatCurrency(r.amount)}
                          </td>
                          <td className="px-4 py-3 text-xs text-neutral-550">
                            {formatDate(r.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge status={r.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setSelectedWithdrawal(r)}
                              className="p-1 text-primary hover:bg-primary/5 rounded-lg transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-neutral-400 text-xs">
                          <FileText className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                          <p className="font-bold text-neutral-700">No payout history found</p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">Your submitted payout request records will appear here.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {withdrawalReport.length > 0 ? (
                  withdrawalReport.map((r, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-neutral-100 bg-white shadow-sm space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-bold text-neutral-700">{r.transactionReference || 'REF_PENDING'}</span>
                        <Badge status={r.status} />
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-neutral-500 pt-1.5 border-t border-neutral-50">
                        <span>{formatDate(r.createdAt)}</span>
                        <span className="font-semibold text-danger">-{formatCurrency(r.amount)}</span>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => setSelectedWithdrawal(r)}
                          className="text-[11px] font-bold text-primary hover:underline"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-neutral-400 text-xs bg-white rounded-xl border border-neutral-100 space-y-2">
                    <FileText className="w-8 h-8 mx-auto text-neutral-300" />
                    <p className="font-bold text-neutral-700">No payout history found</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reports Panel */}
          {activeTab === 'reports' && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date Period Select Card */}
                <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm flex flex-col justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-850 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-primary" /> Date Period Select
                    </h4>
                    <div className="flex items-center gap-1.5 mt-2">
                      <input
                        type="date"
                        value={dateFilter.startDate}
                        onChange={e => setDateFilter(p => ({ ...p, startDate: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-[10px] sm:text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-neutral-700 shadow-sm cursor-pointer"
                      />
                      <span className="text-neutral-400 text-xs font-bold font-mono">to</span>
                      <input
                        type="date"
                        value={dateFilter.endDate}
                        onChange={e => setDateFilter(p => ({ ...p, endDate: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-[10px] sm:text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-neutral-700 shadow-sm cursor-pointer"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setDateFilter({ startDate: '', endDate: '' })}
                    className="w-full py-2 bg-neutral-100 hover:bg-neutral-200/60 text-neutral-600 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm border border-neutral-200/50"
                  >
                    Clear Fields
                  </button>
                </div>

                {/* Earnings Sheet Card */}
                <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm flex flex-col justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-800">Earnings Sheet</h4>
                    <p className="text-[10px] text-neutral-400 mt-1">Excel file of booking revenues.</p>
                  </div>
                  <button
                    onClick={() => downloadReport('earnings')}
                    disabled={!dateFilter.startDate || !dateFilter.endDate || downloading.earnings}
                    className="w-full py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloading.earnings ? 'Generating...' : 'Excel'}</span>
                  </button>
                </div>

                {/* Withdrawals logs Card */}
                <div className="bg-white p-4 rounded-xl border border-neutral-100 shadow-sm flex flex-col justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-neutral-800">Withdrawals logs</h4>
                    <p className="text-[10px] text-neutral-400 mt-1">Spreadsheet of payouts list.</p>
                  </div>
                  <button
                    onClick={() => downloadReport('withdrawals')}
                    disabled={!dateFilter.startDate || !dateFilter.endDate || downloading.withdrawals}
                    className="w-full py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloading.withdrawals ? 'Generating...' : 'Excel'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>



      {/* Withdrawal Details Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/25 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-neutral-100 animate-scale-up">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-800">Payout Details</h3>
                <p className="text-[9px] text-neutral-400 font-mono mt-0.5">Ref: {selectedWithdrawal.transactionReference || 'N/A'}</p>
              </div>
              <button onClick={() => setSelectedWithdrawal(null)} className="p-1 hover:bg-neutral-50 rounded-lg text-neutral-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between bg-success/5 p-3 rounded-xl border border-success/10">
                <div>
                  <p className="text-[9px] font-bold text-success uppercase tracking-wider">Disbursed Amount</p>
                  <p className="text-xl font-bold text-success mt-0.5">{formatCurrency(selectedWithdrawal.netAmount || selectedWithdrawal.amount)}</p>
                </div>
                <Badge status={selectedWithdrawal.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100 text-[11px] text-neutral-600">
                <div>
                  <span className="text-neutral-400 block font-medium">Status</span>
                  <span className="font-semibold text-neutral-800 capitalize">{selectedWithdrawal.status?.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">Requested Amount</span>
                  <span className="font-semibold text-neutral-800">{formatCurrency(selectedWithdrawal.amount)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">Request Date</span>
                  <span className="font-semibold text-neutral-800">{formatDate(selectedWithdrawal.createdAt)}</span>
                </div>
                <div>
                  <span className="text-neutral-400 block font-medium">Settlement Date</span>
                  <span className="font-semibold text-neutral-800">
                    {selectedWithdrawal.transferDate ? formatDate(selectedWithdrawal.transferDate) : 'Pending'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-xl">
                <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Transfer Destination</p>
                <div className="flex items-start gap-2.5">
                  <Building className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 text-[11px]">
                    <p className="font-bold text-neutral-800 truncate">
                      {selectedWithdrawal.paymentDetails?.bankName || providerBankDetails?.bankName || 'Your Bank'}
                    </p>
                    <p className="text-neutral-500 font-semibold mt-0.5">
                      A/C: {selectedWithdrawal.paymentDetails?.accountNumber || providerBankDetails?.accountNo || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Transaction Info Block */}
              {(selectedWithdrawal.utrNo || selectedWithdrawal.adminRemark || selectedWithdrawal.transferDate) && (
                <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-xl space-y-2">
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-primary" />
                    <span>Transaction Info</span>
                  </p>
                  <div className="space-y-1.5 text-[11px]">
                    {selectedWithdrawal.utrNo && (
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-450 font-medium">UTR Number</span>
                        <span className="font-mono font-bold text-neutral-800">{selectedWithdrawal.utrNo}</span>
                      </div>
                    )}
                    {selectedWithdrawal.transferDate && (
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-450 font-medium">Transfer Date & Time</span>
                        <span className="font-semibold text-neutral-800">
                          {formatDate(selectedWithdrawal.transferDate)}
                          {selectedWithdrawal.transferTime ? ` at ${formatTime(selectedWithdrawal.transferTime)}` : ''}
                        </span>
                      </div>
                    )}
                    {selectedWithdrawal.adminRemark && (
                      <div className="mt-2 pt-2 border-t border-neutral-100">
                        <span className="text-neutral-400 block font-medium mb-1">Admin Remark</span>
                        <div className="bg-white p-2 rounded border border-neutral-100 text-neutral-700 font-semibold leading-relaxed">
                          {selectedWithdrawal.adminRemark}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50 flex justify-end">
              <button
                onClick={() => setSelectedWithdrawal(null)}
                className="px-4 py-2 bg-white border border-neutral-200 text-neutral-600 rounded-lg text-xs font-bold hover:bg-neutral-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProviderEarningsDashboard;
