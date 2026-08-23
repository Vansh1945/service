import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import {
  FiDollarSign,
  FiCreditCard,
  FiLayers,
  FiRefreshCw,
  FiCheckCircle,
  FiClock,
  FiTrendingUp,
  FiAlertTriangle,
  FiAlertCircle,
  FiShield,
  FiChevronRight,
  FiGlobe,
  FiExternalLink,
  FiBarChart2,
  FiPieChart,
  FiTrendingDown,
  FiArrowUpRight,
  FiRotateCcw,
  FiAward
} from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line
} from 'recharts';
import * as TransactionService from '../../../services/TransactionService';
import { getChartTrends } from '../../../services/TransactionService';
import PriceDisplay from '../../../components/PriceDisplay';
import ChartSkeleton from '../../../components/ui-skeletons/ChartSkeleton';
import FinanceDashboardViewDetailModal from './components/FinanceDashboardViewDetailModal';

const FinanceDashboardPage = () => {
  const navigate = useNavigate();
  const { refresh } = useAdminFilter();
  const [selectedEntity, setSelectedEntity] = useState({ isOpen: false, type: null, data: null });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('Fetching live data...');

  // Real dynamic overview state from Backend API
  const [overview, setOverview] = useState({
    totalRevenue: 0,
    todayRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    onlineCollection: 0,
    cashCollection: 0,
    walletCollection: 0,
    mixedCollection: 0,
    totalRefunds: 0,
    pendingRefunds: 0,
    completedRefunds: 0,
    providerPendingPayout: 0,
    settledAmount: 0,
    pendingSettlement: 0,
    platformEarnings: 0,
    totalProviderEarnings: 0,
    failedPaymentsCount: 0,
    disputedPaymentsCount: 0,
    paymentSuccessRate: 100,
    refundRate: 0,
    activeGatewayStatus: 'Razorpay (Live / Operational)',
    cashPendingVerification: 0
  });

  // Real settlements list from Backend API
  const [recentSettlements, setRecentSettlements] = useState([]);

  // Trend Data for Charts
  const [revenueTrendData, setRevenueTrendData] = useState([]);
  const [paymentSplitData, setPaymentSplitData] = useState([]);
  const [refundTrendData, setRefundTrendData] = useState([]);
  const [bookingVsRevenueData, setBookingVsRevenueData] = useState([]);
  const [settlementStatusData, setSettlementStatusData] = useState([]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const [overviewRes, settlementsRes] = await Promise.allSettled([
        TransactionService.getFinanceOverview(),
        TransactionService.getSettlements({ limit: 5 })
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.data?.success && overviewRes.value.data?.data) {
        const d = overviewRes.value.data.data;
        const totalRev = d.totalRevenue ?? 0;
        const onlineCol = d.onlineCollection ?? 0;
        const cashCol = d.cashCollection ?? 0;
        const walletCol = d.walletCollection ?? 0;
        const mixedCol = d.mixedCollection ?? 0;
        const pendingRef = d.pendingRefunds ?? 0;
        const completedRef = d.completedRefunds ?? 0;
        const totalRef = d.totalRefunds ?? (completedRef + pendingRef);
        const platformEarn = d.platformEarnings ?? 0;
        const pendingSet = d.pendingSettlement ?? d.reconciliation?.pendingSettlement ?? 0;
        const settledAmt = d.settledAmount ?? d.reconciliation?.totalSettled ?? totalRev;

        setOverview({
          totalRevenue: totalRev,
          todayRevenue: d.todayRevenue ?? 0,
          weeklyRevenue: d.weeklyRevenue ?? 0,
          monthlyRevenue: d.monthlyRevenue ?? 0,
          onlineCollection: onlineCol,
          cashCollection: cashCol,
          walletCollection: walletCol,
          mixedCollection: mixedCol,
          totalRefunds: totalRef,
          pendingRefunds: pendingRef,
          completedRefunds: completedRef,
          providerPendingPayout: d.providerPendingPayout ?? 0,
          settledAmount: settledAmt,
          pendingSettlement: pendingSet,
          platformEarnings: platformEarn,
          totalProviderEarnings: d.totalProviderEarnings ?? 0,
          failedPaymentsCount: d.failedPaymentsCount ?? 0,
          disputedPaymentsCount: d.disputedPaymentsCount ?? 0,
          paymentSuccessRate: d.paymentSuccessRate ?? 100,
          refundRate: d.refundRate ?? 0,
          activeGatewayStatus: d.activeGatewayStatus || 'Razorpay (Live / Operational)',
          cashPendingVerification: d.cashPendingVerification ?? 0
        });

        // Payment Method Split — derived from real totals in overview
        setPaymentSplitData([
          { name: 'Online', value: onlineCol, color: '#3B82F6' },
          { name: 'Cash', value: cashCol, color: '#10B981' },
          { name: 'Wallet', value: walletCol, color: '#F59E0B' },
          { name: 'Mixed', value: mixedCol, color: '#8B5CF6' }
        ]);

        // Settlement Status Chart Data (computed from overview totals — not time-series)
        setSettlementStatusData([
          { status: 'Settled', amount: d.reconciliation?.totalSettled ?? d.settledAmount ?? 0, color: '#10B981' },
          { status: 'Pending Settlement', amount: pendingSet, color: '#F59E0B' },
          { status: 'Processing', amount: d.reconciliation?.processingSettlement || d.processingSettlement || 0, color: '#6366F1' },
          { status: 'Failed', amount: d.reconciliation?.failedSettlement || 0, color: '#EF4444' }
        ]);
      }

      // Fetch real daily trend data from DB aggregations
      try {
        const trendsRes = await getChartTrends(30);
        if (trendsRes.data?.success && trendsRes.data?.data) {
          const td = trendsRes.data.data;
          if (td.revenueTrend?.length) setRevenueTrendData(td.revenueTrend);
          if (td.refundTrend?.length) setRefundTrendData(td.refundTrend);
          if (td.bookingVsRevenue?.length) setBookingVsRevenueData(td.bookingVsRevenue);
        }
      } catch (tErr) {
        console.warn('Chart trends fetch failed, keeping computed data:', tErr);
        if (overviewRes.value.data?.data?.recentActivities && Array.isArray(overviewRes.value.data?.data?.recentActivities) && overviewRes.value.data?.data?.recentActivities.length > 0) {
          const mappedActivities = overviewRes.value.data.data.recentActivities.map((s) => ({
            batchId: s.transactionId || (s._id ? `#${String(s._id).slice(-6).toUpperCase()}` : 'TXN-REF'),
            typeLabel: s.displayType || 'Activity',
            provider: s.provider?.name || s.user?.name || s.description || 'System Financial Event',
            amount: s.amount || 0,
            direction: s.financialDirection || 'neutral',
            status: String(s.displayStatus || s.paymentStatus || s.status || 'PENDING').toUpperCase(),
            time: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'
          }));
          setRecentSettlements(mappedActivities);
        } else if (settlementsRes.status === 'fulfilled' && settlementsRes.value.data?.success && settlementsRes.value.data?.data?.settlements) {
          const rawSettlements = settlementsRes.value.data.data.settlements;
          if (Array.isArray(rawSettlements) && rawSettlements.length > 0) {
            const mapped = rawSettlements.map((s) => ({
              batchId: s.transactionId || (s._id ? `#${String(s._id).slice(-6).toUpperCase()}` : 'SET-BATCH'),
              typeLabel: 'Settlement Batch',
              provider: s.provider?.name || s.user?.name || s.description || 'Razorpay Settlement',
              amount: s.amount || 0,
              direction: 'neutral',
              status: String(s.paymentStatus || s.status || 'SETTLED').toUpperCase(),
              time: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'
            }));
            setRecentSettlements(mapped);
          } else {
            setRecentSettlements([]);
          }
        }
      }

      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error("Dashboard overview error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const openModal = (type, title, amount, extra = {}) => {
    setSelectedEntity({
      isOpen: true,
      type,
      data: { title, amount, isMetricSummary: true, ...extra }
    });
  };

  // Card Navigation Handlers
  const handleRevenueCardClick = (filterPath, filterParams = {}) => {
    navigate(filterPath, { state: filterParams });
  };

  const handleRefundCardClick = (statusFilter = 'all') => {
    navigate(`/admin/refunds?status=${statusFilter}`, { state: { statusFilter } });
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label, isCurrency = true }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-neutral-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-neutral-700">
          <p className="font-bold text-neutral-300 border-b border-neutral-700 pb-1">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                {entry.name}:
              </span>
              <span className="font-mono font-bold">
                {isCurrency && typeof entry.value === 'number' ? `₹${entry.value.toLocaleString('en-IN')}` : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-12 font-sans bg-neutral-50/50 p-2 sm:p-4 rounded-3xl min-h-screen text-neutral-800 animate-fade-in">
      <FinanceDashboardViewDetailModal
        isOpen={selectedEntity.isOpen}
        onClose={() => setSelectedEntity({ isOpen: false, type: null, data: null })}
        entityType={selectedEntity.type}
        entityData={selectedEntity.data}
      />

      {/* Top Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 bg-primary/10 text-primary font-bold text-[10px] uppercase tracking-wider rounded-md border border-primary/20">
              Executive Summary
            </span>
            <span className="text-xs text-neutral-400 font-medium">Real-Time Platform Financial Overview</span>
          </div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
            Finance Dashboard
          </h1>
        </div>

        <div className="flex items-center space-x-3 text-xs text-neutral-500">
          <span>Last updated: <strong className="text-neutral-700 font-semibold">{lastUpdated}</strong></span>
          <button
            onClick={() => refresh(() => loadOverview(), setLoading)}
            disabled={loading}
            className="p-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-all cursor-pointer shadow-xs text-neutral-700 hover:text-neutral-900 flex items-center gap-1.5 font-bold"
            title="Refresh Live Financial Ledger"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: 14 EXECUTIVE CARDS GRID */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block">
            EXECUTIVE FINANCIAL OVERVIEW (14 CARDS)
          </span>
          <span className="text-[11px] text-neutral-500 font-medium">
            💡 Click any card to navigate to the related management page
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CARD 1: Total Revenue */}
          <div
            onClick={() => navigate('/admin/payments')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FiDollarSign className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Revenue
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">TOTAL REVENUE</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.totalRevenue} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-emerald-600 transition-colors">
              <span className="text-[11px] font-medium">All Verified Collections</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 2: Online Collection */}
          <div
            onClick={() => handleRevenueCardClick('/admin/payments', { methodFilter: 'ONLINE' })}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <FiGlobe className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  Online / Gateway
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">ONLINE COLLECTION</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.onlineCollection} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-blue-600 transition-colors">
              <span className="text-[11px] font-medium">Cards, UPI, NetBanking</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 3: Cash Collection */}
          <div
            onClick={() => navigate('/admin/cash-payments')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FiDollarSign className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  COD / Cash
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">CASH COLLECTION</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.cashCollection} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-emerald-600 transition-colors">
              <span className="text-[11px] font-medium">Direct Provider Cash</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 4: Wallet Collection */}
          <div
            onClick={() => navigate('/admin/customer-wallets')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <FaWallet className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  Customer Wallet
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">WALLET COLLECTION</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.walletCollection} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-amber-600 transition-colors">
              <span className="text-[11px] font-medium">Closed Loop Balance</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 5: Mixed Payment Collection */}
          <div
            onClick={() => handleRevenueCardClick('/admin/payments', { methodFilter: 'MIXED' })}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <FiLayers className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Split Pay
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">MIXED PAYMENT COLLECTION</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.mixedCollection} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-primary transition-colors">
              <span className="text-[11px] font-medium">Gateway + Wallet Split</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 6: Pending Refund */}
          <div
            onClick={() => handleRefundCardClick('pending')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <FiClock className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  Action Required
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">PENDING REFUND</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.pendingRefunds} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-amber-600 transition-colors">
              <span className="text-[11px] font-medium">Refund Management</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 7: Completed Refund */}
          <div
            onClick={() => handleRefundCardClick('completed')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                  <FiCheckCircle className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                  Resolved
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">COMPLETED REFUND</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.completedRefunds} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-teal-600 transition-colors">
              <span className="text-[11px] font-medium">Refund Management</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 8: Pending Provider Payout */}
          <div
            onClick={() => navigate('/admin/payout?status=pending')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FiAward className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Provider Owed
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">PENDING PROVIDER PAYOUT</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.providerPendingPayout} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-indigo-600 transition-colors">
              <span className="text-[11px] font-medium">Payout Management</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 9: Settled Amount */}
          <div
            onClick={() => navigate('/admin/settlements?status=completed')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FiShield className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Cleared Bank
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">SETTLED AMOUNT</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.settledAmount} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-emerald-600 transition-colors">
              <span className="text-[11px] font-medium">Settlement Records</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 10: Pending Settlement */}
          <div
            onClick={() => navigate('/admin/settlements?status=pending')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <FiCreditCard className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Gateway Queue
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">PENDING SETTLEMENT</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.pendingSettlement} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-primary transition-colors">
              <span className="text-[11px] font-medium">Batch Settlements</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 11: Platform Commission */}
          <div
            onClick={() => navigate('/admin/commission')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <FiTrendingUp className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                  Net Revenue
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">PLATFORM COMMISSION</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.platformEarnings} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-primary transition-colors">
              <span className="text-[11px] font-medium">Commission Details</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 12: Provider Earnings */}
          <div
            onClick={() => navigate('/admin/provider-earnings')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                  <FiAward className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md">
                  Gross Earnings
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">PROVIDER EARNINGS</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  <PriceDisplay amount={overview.totalProviderEarnings} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-violet-600 transition-colors">
              <span className="text-[11px] font-medium">Provider Earnings View</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 13: Failed Payments */}
          <div
            onClick={() => navigate('/admin/failed-payments')}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-red-50 text-red-600 rounded-xl">
                  <FiAlertTriangle className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
                  Failed Logs
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">FAILED PAYMENTS</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  {overview.failedPaymentsCount} <span className="text-xs font-semibold text-neutral-400">Attempts</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-red-600 transition-colors">
              <span className="text-[11px] font-medium">Failed Payment Logs</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>

          {/* CARD 14: Disputed Payments */}
          <div
            onClick={() => navigate('/admin/failed-payments?type=dispute', { state: { typeFilter: 'dispute' } })}
            className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <FiAlertCircle className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                  Disputes
                </span>
              </div>
              <div className="mt-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block">DISPUTED PAYMENTS</span>
                <div className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
                  {overview.disputedPaymentsCount} <span className="text-xs font-semibold text-neutral-400">Cases</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-rose-600 transition-colors">
              <span className="text-[11px] font-medium">Complaints & Disputes</span>
              <FiChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: 5 CHARTS GRID */}
      <div>
        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-3 px-1">
          FINANCIAL ANALYTICS & TREND CHARTS (5 CHARTS)
        </span>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
            <div className="lg:col-span-8">
              <ChartSkeleton />
            </div>
            <div className="lg:col-span-4">
              <ChartSkeleton />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-5">
            {/* CHART 1: REVENUE TREND (8 Cols) */}
          <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <FiBarChart2 className="w-4 h-4 text-primary" />
                  1. Revenue Trend
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">Gross Revenue vs Platform Commission Trajectory</p>
              </div>
              <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 font-bold text-[10px] uppercase rounded-lg">
                Last 30 Days
              </span>
            </div>

            <div className="h-72 w-full pt-2 min-w-0" style={{ minHeight: '280px' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" dataKey="revenue" name="Gross Revenue (₹)" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="earnings" name="Platform Earnings (₹)" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEarnings)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 2: PAYMENT METHOD SPLIT (4 Cols) */}
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <FiPieChart className="w-4 h-4 text-purple-600" />
                  2. Payment Method Split
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">Online vs Cash vs Wallet vs Mixed</p>
              </div>
            </div>

            <div className="h-56 w-full relative flex items-center justify-center min-w-0" style={{ minHeight: '220px' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180}>
                <PieChart>
                  <Pie
                    data={paymentSplitData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentSplitData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend Pills */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {paymentSplitData.map((item, idx) => (
                <div key={idx} className="flex items-center space-x-2 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-neutral-400 block uppercase">{item.name}</span>
                    <span className="text-xs font-extrabold text-neutral-900 block truncate">
                      ₹{item.value.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Charts 3, 4, 5 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* CHART 3: REFUND TREND */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <FiRotateCcw className="w-4 h-4 text-rose-600" />
                  3. Refund Trend
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">Completed vs Pending Refunds</p>
              </div>
            </div>

            <div className="h-60 w-full min-w-0" style={{ minHeight: '240px' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <BarChart data={refundTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                  <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                  <Bar dataKey="completed" name="Completed (₹)" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Pending (₹)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 4: BOOKING VS REVENUE */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <FiLayers className="w-4 h-4 text-indigo-600" />
                  4. Booking vs Revenue
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">Booking Count vs Revenue (₹)</p>
              </div>
            </div>

            <div className="h-60 w-full min-w-0" style={{ minHeight: '240px' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <ComposedChart data={bookingVsRevenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#6366F1" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" stroke="#10B981" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                  <Bar yAxisId="left" dataKey="bookings" name="Bookings Count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* CHART 5: SETTLEMENT STATUS */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <FiShield className="w-4 h-4 text-emerald-600" />
                  5. Settlement Status
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">Batch Settlement Lifecycle</p>
              </div>
            </div>

            <div className="h-60 w-full min-w-0" style={{ minHeight: '240px' }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                <BarChart data={settlementStatusData} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <YAxis dataKey="status" type="category" stroke="#9CA3AF" fontSize={10} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" name="Amount (₹)" radius={[0, 4, 4, 0]}>
                    {settlementStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      {/* SECTION 3: RECENT SETTLEMENTS & GATEWAY CYCLE */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">
              Recent Settlement Batches & Payout Queue
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">Live gateway settlement batches synchronized with backend</p>
          </div>
          <button
            onClick={() => navigate('/admin/settlements')}
            className="text-xs font-bold text-neutral-900 hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-wider text-[11px]"
          >
            VIEW SETTLEMENTS <FiExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          {recentSettlements.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  <th className="py-3 px-2">BATCH ID</th>
                  <th className="py-3 px-2">PROVIDER / GATEWAY</th>
                  <th className="py-3 px-2">AMOUNT</th>
                  <th className="py-3 px-2">STATUS</th>
                  <th className="py-3 px-2 text-right">TIME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {recentSettlements.map((row, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-3.5 px-2 font-mono font-bold text-neutral-900">
                      <div>
                        <span>{row.batchId}</span>
                        {row.typeLabel && <span className="block text-[10px] text-neutral-400 font-sans font-medium">{row.typeLabel}</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-2 font-medium text-neutral-700">{row.provider}</td>
                    <td className="py-3.5 px-2 font-bold text-neutral-900">
                      {row.direction === 'credit' ? (
                        <span className="text-emerald-600 font-bold">+<PriceDisplay amount={row.amount} /></span>
                      ) : row.direction === 'debit' ? (
                        <span className="text-rose-600 font-bold">-<PriceDisplay amount={row.amount} /></span>
                      ) : (
                        <span className="text-neutral-600 font-medium">
                          <PriceDisplay amount={row.amount} />
                          {row.status === 'FAILED' && <span className="text-[10px] text-rose-500 font-bold ml-1">(Attempted)</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        ['SETTLED', 'SUCCESS', 'COMPLETED', 'CAPTURED'].includes(row.status)
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : (['FAILED', 'REJECTED', 'DECLINED', 'CANCELLED'].includes(row.status)
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200')
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-right text-neutral-400 font-medium">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-xs text-neutral-400 font-medium">
              No recent settlements found in the database.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboardPage;
