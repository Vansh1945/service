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

// Lightweight, Reusable Card Hover Detail Popover (Solid Light Theme with tailwind.config.js tokens)
const CardHoverPopover = ({ title, items = [], onViewAll, badgeColor = 'bg-primary/10 text-primary', align = 'left' }) => {
  if (!items || items.length === 0) return null;

  const positionClass = align === 'right' ? 'right-0' : 'left-0';

  return (
    <div className={`absolute ${positionClass} top-full mt-2 w-80 sm:w-84 bg-white text-neutral-900 p-4 rounded-2xl shadow-2xl z-[100] border border-neutral-200 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto max-h-84 overflow-y-auto ring-1 ring-neutral-900/10`}>
      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5 mb-3 bg-white">
        <span className="font-bold text-xs text-neutral-900 tracking-wide">{title}</span>
        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${badgeColor}`}>
          Top {items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id || idx} className="text-xs bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-1.5 hover:border-neutral-300 hover:bg-white transition-all shadow-xs">
            <div className="flex items-center justify-between font-mono font-bold">
              <span className="text-sm font-extrabold text-emerald-600 font-mono tracking-tight">₹{Number(item.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] font-sans font-bold px-2 py-0.5 bg-white text-neutral-700 rounded-md border border-neutral-200 shadow-2xs capitalize">
                {item.status && item.status !== 'none' ? item.status : 'Completed'}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-800 text-xs">
              <span className="truncate max-w-[140px] font-bold text-neutral-900">{item.customer}</span>
              <span className="font-mono text-[10px] text-neutral-600 font-semibold bg-white px-1.5 py-0.5 rounded border border-neutral-200 shadow-2xs">{item.bookingId}</span>
            </div>
            {item.provider && item.provider !== 'Provider' && (
              <div className="text-[11px] text-neutral-600 truncate font-medium">
                <span className="text-neutral-400 font-normal">Provider: </span>
                <span className="text-neutral-700 font-semibold">{item.provider}</span>
              </div>
            )}
            {item.reason && item.reason !== 'Service Request' && (
              <div className="text-[11px] text-amber-700 truncate italic font-medium">
                <span className="text-neutral-400 font-normal">Note: </span>
                {item.reason}
              </div>
            )}
            <div className="flex items-center justify-between text-neutral-500 pt-1.5 border-t border-neutral-200/80 mt-1 font-medium text-[11px]">
              <span className="capitalize font-semibold text-neutral-700">{item.paymentMethod}</span>
              <span className="text-neutral-400">{item.date}</span>
            </div>
          </div>
        ))}
      </div>
      {onViewAll && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewAll();
          }}
          className="w-full mt-3 pt-2 pb-1.5 border-t border-neutral-100 text-xs text-primary hover:text-primary/80 font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors bg-neutral-50 hover:bg-neutral-100 rounded-xl"
        >
          <span>View all records →</span>
        </button>
      )}
    </div>
  );
};

const FinanceDashboardPage = () => {
  const navigate = useNavigate();
  const {
    filterType,
    year,
    financialYear,
    month,
    quarter,
    zoneIds,
    getMergedQuery,
    refresh
  } = useAdminFilter();

  const [selectedEntity, setSelectedEntity] = useState({ isOpen: false, type: null, data: null });
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Fetching live data...');

  // Real dynamic overview state from Backend API
  const [overview, setOverview] = useState({
    grossBookingValue: 0,
    totalRevenue: 0,
    totalCollections: 0,
    netCollections: 0,
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
    providerPayable: 0,
    providerPaid: 0,
    settledAmount: 0,
    pendingSettlement: 0,
    platformEarnings: 0,
    totalProviderEarnings: 0,
    failedPaymentsCount: 0,
    disputedPaymentsCount: 0,
    paymentSuccessRate: 100,
    refundRate: 0,
    activeGatewayStatus: 'Razorpay (Live / Operational)',
    cashPendingVerification: 0,
    hoverDetails: {}
  });

  const [recentSettlements, setRecentSettlements] = useState([]);
  const [revenueTrendData, setRevenueTrendData] = useState([]);
  const [paymentSplitData, setPaymentSplitData] = useState([]);
  const [refundTrendData, setRefundTrendData] = useState([]);
  const [bookingVsRevenueData, setBookingVsRevenueData] = useState([]);
  const [settlementStatusData, setSettlementStatusData] = useState([]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const query = getMergedQuery();

      const [overviewRes, settlementsRes] = await Promise.allSettled([
        TransactionService.getFinanceOverview(query),
        TransactionService.getSettlements({ limit: 5 })
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.data?.success && overviewRes.value.data?.data) {
        const d = overviewRes.value.data.data;
        const onlineCol = d.onlineCollection ?? 0;
        const cashCol = d.cashCollection ?? 0;
        const walletCol = d.walletCollection ?? 0;
        const mixedCol = d.mixedCollection ?? 0;
        const totalCol = d.totalCollections ?? d.totalRevenue ?? (onlineCol + cashCol + walletCol + mixedCol);
        const completedRef = d.completedRefunds ?? 0;
        const pendingRef = d.pendingRefunds ?? 0;
        const netCol = d.netCollections ?? Math.max(0, totalCol - completedRef);
        const gmv = d.grossBookingValue ?? totalCol;
        const pendingSet = d.pendingSettlement ?? d.reconciliation?.pendingSettlement ?? 0;
        const settledAmt = d.settledAmount ?? d.reconciliation?.totalSettled ?? 0;

        setOverview({
          grossBookingValue: gmv,
          totalRevenue: totalCol,
          totalCollections: totalCol,
          netCollections: netCol,
          todayRevenue: d.todayRevenue ?? 0,
          weeklyRevenue: d.weeklyRevenue ?? 0,
          monthlyRevenue: d.monthlyRevenue ?? 0,
          onlineCollection: onlineCol,
          cashCollection: cashCol,
          walletCollection: walletCol,
          mixedCollection: mixedCol,
          totalRefunds: d.totalRefunds ?? (completedRef + pendingRef),
          pendingRefunds: pendingRef,
          completedRefunds: completedRef,
          providerPendingPayout: d.providerPendingPayout ?? d.providerPayable ?? 0,
          providerPayable: d.providerPayable ?? d.providerPendingPayout ?? 0,
          providerPaid: d.providerPaid ?? d.completedPayout ?? 0,
          settledAmount: settledAmt,
          pendingSettlement: pendingSet,
          platformEarnings: d.platformEarnings ?? 0,
          totalProviderEarnings: d.totalProviderEarnings ?? 0,
          failedPaymentsCount: d.failedPaymentsCount ?? 0,
          disputedPaymentsCount: d.disputedPaymentsCount ?? 0,
          paymentSuccessRate: d.paymentSuccessRate ?? 100,
          refundRate: d.refundRate ?? 0,
          activeGatewayStatus: d.activeGatewayStatus || 'Razorpay (Live / Operational)',
          cashPendingVerification: d.cashPendingVerification ?? 0,
          hoverDetails: d.hoverDetails || {}
        });

        // Payment Method Split — percentage calculation
        const totalForSplit = onlineCol + cashCol + walletCol + mixedCol || 1;
        setPaymentSplitData([
          { name: 'Online', value: onlineCol, percentage: Math.round((onlineCol / totalForSplit) * 100), color: '#3B82F6' },
          { name: 'Cash', value: cashCol, percentage: Math.round((cashCol / totalForSplit) * 100), color: '#10B981' },
          { name: 'Wallet', value: walletCol, percentage: Math.round((walletCol / totalForSplit) * 100), color: '#F59E0B' },
          { name: 'Mixed', value: mixedCol, percentage: Math.round((mixedCol / totalForSplit) * 100), color: '#8B5CF6' }
        ]);

        setSettlementStatusData([
          { status: 'Settled', amount: settledAmt, color: '#10B981' },
          { status: 'Pending Settlement', amount: pendingSet, color: '#F59E0B' },
          { status: 'Processing', amount: d.reconciliation?.processingSettlement || 0, color: '#6366F1' },
          { status: 'Failed', amount: d.reconciliation?.failedSettlement || 0, color: '#EF4444' }
        ]);
      }

      // Fetch dynamic trend data with active period filter
      try {
        const trendsRes = await getChartTrends(query);
        if (trendsRes.data?.success && trendsRes.data?.data) {
          const td = trendsRes.data.data;
          if (td.revenueTrend?.length) setRevenueTrendData(td.revenueTrend);
          if (td.refundTrend?.length) setRefundTrendData(td.refundTrend);
          if (td.bookingVsRevenue?.length) setBookingVsRevenueData(td.bookingVsRevenue);
        }
      } catch (tErr) {
        console.warn('Chart trends fetch failed, keeping computed data:', tErr);
      }

      if (settlementsRes.status === 'fulfilled' && settlementsRes.value.data?.success && settlementsRes.value.data?.data?.settlements) {
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
  }, [filterType, year, financialYear, month, quarter, zoneIds]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setIsReady(true), 250);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
    }
  }, [loading]);

  const handleRevenueCardClick = (filterPath, filterParams = {}) => {
    navigate(filterPath, { state: filterParams });
  };

  const handleRefundCardClick = (statusFilter = 'all') => {
    navigate(`/admin/refunds?status=${statusFilter}`, { state: { statusFilter } });
  };

  // Custom Chart Tooltip (Light Theme matching tailwind.config.js)
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white text-neutral-900 p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-neutral-200 z-50 ring-1 ring-neutral-900/10 min-w-[170px]">
          <p className="font-bold text-neutral-900 border-b border-neutral-100 pb-1 text-xs">{label}</p>
          {payload.map((entry, index) => {
            const isCount = entry.dataKey === 'bookings' || String(entry.name || '').toLowerCase().includes('count');
            const formattedVal = isCount
              ? Number(entry.value || 0).toLocaleString('en-IN')
              : `₹${Number(entry.value || 0).toLocaleString('en-IN')}`;

            return (
              <div key={index} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-neutral-600">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></span>
                  <span>{entry.name}:</span>
                </span>
                <span className="font-mono font-bold text-neutral-900">
                  {formattedVal}
                </span>
              </div>
            );
          })}
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
            <span className="text-xs text-neutral-400 font-medium">Real-Time Platform Financial Ledger</span>
          </div>
          <h1 className="text-2xl font-black text-neutral-900 tracking-tight mt-1">
            Admin Finance Dashboard
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

      {/* SECTION 1: 16 CARDS IN 4 STRUCTURED ROWS */}
      <div className="space-y-6">

        {/* ROW 1 – COLLECTION OVERVIEW */}
        <div>
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2 px-1">
            ROW 1 — COLLECTION OVERVIEW
          </span>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

            {/* CARD 1: Gross Booking Value / GMV */}
            <div
              onClick={() => navigate('/admin/bookings')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <FiLayers className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-1.5 sm:px-2 py-0.5 rounded-md">
                    GMV
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">GROSS BOOKING VALUE</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.grossBookingValue} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-indigo-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Valid service value</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Gross Booking Value (GMV)"
                items={overview.hoverDetails?.gmv}
                badgeColor="bg-indigo-100 text-indigo-800"
                align="left"
                onViewAll={() => navigate('/admin/bookings')}
              />
            </div>

            {/* CARD 2: Total Collections */}
            <div
              onClick={() => navigate('/admin/payments')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <FiDollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Gross Collections
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">TOTAL COLLECTIONS</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.totalCollections} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-emerald-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Successful collections</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Total Collections Breakup"
                items={overview.hoverDetails?.totalCollections}
                badgeColor="bg-emerald-100 text-emerald-800"
                align="left"
                onViewAll={() => navigate('/admin/payments')}
              />
            </div>

            {/* CARD 3: Net Collections */}
            <div
              onClick={() => navigate('/admin/payments')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <FiTrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Net Collections
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">NET COLLECTIONS</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.netCollections} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-blue-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Minus completed refunds</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Net Collections Overview"
                items={overview.hoverDetails?.totalCollections}
                badgeColor="bg-blue-100 text-blue-800"
                align="right"
                onViewAll={() => navigate('/admin/payments')}
              />
            </div>

            {/* CARD 4: Completed Refunds */}
            <div
              onClick={() => handleRefundCardClick('completed')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-teal-50 text-teal-600 rounded-xl">
                    <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Resolved Refunds
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">COMPLETED REFUNDS</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.completedRefunds} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-teal-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Completed refunds</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Completed Refunds Preview"
                items={overview.hoverDetails?.completedRefunds}
                badgeColor="bg-teal-100 text-teal-800"
                align="right"
                onViewAll={() => handleRefundCardClick('completed')}
              />
            </div>
          </div>
        </div>

        {/* ROW 2 – PAYMENT METHODS */}
        <div>
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2 px-1">
            ROW 2 — PAYMENT METHODS
          </span>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

            {/* CARD 5: Online Collection */}
            <div
              onClick={() => handleRevenueCardClick('/admin/payments', { methodFilter: 'ONLINE' })}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <FiGlobe className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Online / Gateway
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">ONLINE COLLECTION</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.onlineCollection} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-blue-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Cards, UPI, NetBanking</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Online Payments Preview"
                items={overview.hoverDetails?.onlineCollection}
                badgeColor="bg-blue-100 text-blue-800"
                align="left"
                onViewAll={() => handleRevenueCardClick('/admin/payments', { methodFilter: 'ONLINE' })}
              />
            </div>

            {/* CARD 6: Cash Collection */}
            <div
              onClick={() => navigate('/admin/cash-payments')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <FiDollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    COD / Cash
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">CASH COLLECTION</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.cashCollection} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-emerald-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Direct cash collected</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Cash Collections Preview"
                items={overview.hoverDetails?.cashCollection}
                badgeColor="bg-emerald-100 text-emerald-800"
                align="left"
                onViewAll={() => navigate('/admin/cash-payments')}
              />
            </div>

            {/* CARD 7: Wallet Collection */}
            <div
              onClick={() => navigate('/admin/customer-wallets')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <FaWallet className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Customer Wallet
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">WALLET COLLECTION</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.walletCollection} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-amber-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Used for bookings</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Wallet Payments Preview"
                items={overview.hoverDetails?.walletCollection}
                badgeColor="bg-amber-100 text-amber-800"
                align="right"
                onViewAll={() => navigate('/admin/customer-wallets')}
              />
            </div>

            {/* CARD 8: Mixed Payment Collection */}
            <div
              onClick={() => handleRevenueCardClick('/admin/payments', { methodFilter: 'MIXED' })}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-purple-50 text-purple-600 rounded-xl">
                    <FiLayers className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Split Pay
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">MIXED PAYMENT COLLECTION</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.mixedCollection} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-purple-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Gateway + Wallet pay</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Mixed Payments Preview"
                items={overview.hoverDetails?.mixedCollection}
                badgeColor="bg-purple-100 text-purple-800"
                align="right"
                onViewAll={() => handleRevenueCardClick('/admin/payments', { methodFilter: 'MIXED' })}
              />
            </div>
          </div>
        </div>

        {/* ROW 3 – PLATFORM / PROVIDER */}
        <div>
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2 px-1">
            ROW 3 — PLATFORM & PROVIDER
          </span>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

            {/* CARD 9: Platform Commission */}
            <div
              onClick={() => navigate('/admin/commission')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-primary/10 text-primary rounded-xl">
                    <FiTrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Net Platform Fee
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">PLATFORM COMMISSION</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.platformEarnings} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-primary transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Eligible booking commission</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Platform Commission Details"
                items={overview.hoverDetails?.platformCommission}
                badgeColor="bg-red-100 text-red-800"
                align="left"
                onViewAll={() => navigate('/admin/commission')}
              />
            </div>

            {/* CARD 10: Provider Earnings */}
            <div
              onClick={() => navigate('/admin/provider-earnings')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-violet-50 text-violet-600 rounded-xl">
                    <FiAward className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Net Earnings
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">PROVIDER EARNINGS</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.totalProviderEarnings} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-violet-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Gross provider net earnings</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Provider Earnings Preview"
                items={overview.hoverDetails?.providerEarnings}
                badgeColor="bg-violet-100 text-violet-800"
                align="left"
                onViewAll={() => navigate('/admin/provider-earnings')}
              />
            </div>

            {/* CARD 11: Provider Payable / Pending Payout */}
            <div
              onClick={() => navigate('/admin/payout?status=pending')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <FiClock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Provider Owed
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">PROVIDER PAYABLE</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.providerPayable} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-indigo-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Payable to providers</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Provider Pending Payout"
                items={overview.hoverDetails?.providerPayable}
                badgeColor="bg-indigo-100 text-indigo-800"
                align="right"
                onViewAll={() => navigate('/admin/payout?status=pending')}
              />
            </div>

            {/* CARD 12: Provider Paid */}
            <div
              onClick={() => navigate('/admin/payout?status=completed')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Payout Cleared
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">PROVIDER PAID</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.providerPaid} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-emerald-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Total paid to providers</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Provider Paid Out Summary"
                items={overview.hoverDetails?.providerPaid}
                badgeColor="bg-emerald-100 text-emerald-800"
                align="right"
                onViewAll={() => navigate('/admin/payout?status=completed')}
              />
            </div>
          </div>
        </div>

        {/* ROW 4 – SETTLEMENT / ISSUES */}
        <div>
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-2 px-1">
            ROW 4 — SETTLEMENT & ISSUES
          </span>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

            {/* CARD 13: Settled Amount */}
            <div
              onClick={() => navigate('/admin/settlements?status=completed')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <FiShield className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Cleared Bank
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">SETTLED AMOUNT</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.settledAmount} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-emerald-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Settled to bank</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Settled Batches Preview"
                items={overview.hoverDetails?.settledAmount}
                badgeColor="bg-emerald-100 text-emerald-800"
                align="left"
                onViewAll={() => navigate('/admin/settlements?status=completed')}
              />
            </div>

            {/* CARD 14: Pending Settlement */}
            <div
              onClick={() => navigate('/admin/settlements?status=pending')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <FiCreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Gateway Queue
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">PENDING SETTLEMENT</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.pendingSettlement} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-amber-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Awaiting settlement</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Pending Settlements Preview"
                items={overview.hoverDetails?.pendingSettlement}
                badgeColor="bg-amber-100 text-amber-800"
                align="left"
                onViewAll={() => navigate('/admin/settlements?status=pending')}
              />
            </div>

            {/* CARD 15: Pending Refund */}
            <div
              onClick={() => handleRefundCardClick('pending')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <FiClock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Action Required
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">PENDING REFUND</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1">
                    <PriceDisplay amount={overview.pendingRefunds} />
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-amber-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Refund requests pending</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Pending Refund Requests"
                items={overview.hoverDetails?.pendingRefunds}
                badgeColor="bg-amber-100 text-amber-800"
                align="right"
                onViewAll={() => handleRefundCardClick('pending')}
              />
            </div>

            {/* CARD 16: Failed & Disputed Payments */}
            <div
              onClick={() => navigate('/admin/failed-payments')}
              className="relative group hover:z-[100] bg-white p-3.5 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="p-1.5 sm:p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <FiAlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-1.5 sm:px-2 py-0.5 rounded-md truncate">
                    Issues & Retries
                  </span>
                </div>
                <div className="mt-2.5 sm:mt-3">
                  <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-wider text-neutral-400 block truncate">FAILED & DISPUTED</span>
                  <div className="text-lg sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5 sm:mt-1 flex items-baseline gap-1.5 flex-wrap">
                    <span>{overview.failedPaymentsCount}</span>
                    <span className="text-[10px] sm:text-xs font-semibold text-neutral-400">Failed</span>
                    {overview.disputedPaymentsCount > 0 && (
                      <span className="text-[10px] sm:text-xs font-extrabold text-rose-600">({overview.disputedPaymentsCount} disp.)</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400 group-hover:text-rose-600 transition-colors">
                <span className="text-[10px] sm:text-[11px] font-medium truncate">Failed attempts & disputes</span>
                <FiChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
              <CardHoverPopover
                title="Failed Payment Attempts"
                items={overview.hoverDetails?.failedPayments}
                badgeColor="bg-rose-100 text-rose-800"
                align="right"
                onViewAll={() => navigate('/admin/failed-payments')}
              />
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 2: 5 CHARTS GRID */}
      <div>
        <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest block mb-3 px-1">
          FINANCIAL ANALYTICS & TREND CHARTS
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
                      1. Revenue & Collections Trend
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">Gross Collections vs Completed Refunds vs Net Collections</p>
                  </div>
                  <span className="px-2.5 py-1 bg-neutral-100 text-neutral-700 font-bold text-[10px] uppercase rounded-lg">
                    Filtered Period
                  </span>
                </div>

                <div className="h-72 w-full pt-2 min-w-0" style={{ minHeight: '280px' }}>
                  {isReady ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} debounce={50} initialDimension={{ width: 600, height: 280 }}>
                      <AreaChart data={revenueTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                        <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Area type="monotone" dataKey="grossCollections" name="Gross Collections (₹)" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorGross)" />
                        <Area type="monotone" dataKey="netCollections" name="Net Collections (₹)" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNet)" />
                        <Line type="monotone" dataKey="completedRefunds" name="Completed Refunds (₹)" stroke="#EF4444" strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <ChartSkeleton />
                  )}
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
                  {isReady ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180} debounce={50} initialDimension={{ width: 300, height: 220 }}>
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
                  ) : (
                    <ChartSkeleton />
                  )}
                </div>

                {/* Legend Pills with Percentages */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {paymentSplitData.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-neutral-400 block uppercase">{item.name}</span>
                          <span className="text-[10px] font-extrabold text-neutral-600">{item.percentage}%</span>
                        </div>
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
                  {isReady ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={50} initialDimension={{ width: 300, height: 240 }}>
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
                  ) : (
                    <ChartSkeleton />
                  )}
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
                  {isReady ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={50} initialDimension={{ width: 300, height: 240 }}>
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
                  ) : (
                    <ChartSkeleton />
                  )}
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
                  {isReady ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={50} initialDimension={{ width: 300, height: 240 }}>
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
                  ) : (
                    <ChartSkeleton />
                  )}
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${['SETTLED', 'SUCCESS', 'COMPLETED', 'CAPTURED'].includes(row.status)
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
