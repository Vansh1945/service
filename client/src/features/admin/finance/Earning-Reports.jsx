import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiDownload, FiCalendar, FiTrendingUp, FiUsers, FiDollarSign,
  FiCreditCard, FiFileText, FiClock, FiFilter, FiAlertCircle,
  FiRefreshCw, FiCheckCircle, FiSearch, FiPrinter, FiLayers, FiShield
} from 'react-icons/fi';
import * as PaymentService from '../../../services/PaymentService';
import * as BookingService from '../../../services/BookingService';
import { useAuth } from '../../../context/auth';
import { useAdminFilter } from '../../../context/AdminFilterContext';
import { normalizeStatus, formatStatus } from '../../../utils/status';
import StatusBadge from '../../../components/ui/StatusBadge';
import { formatCurrency, formatAmount, formatFinancialReportAmount, isMonetaryField, isPercentageField, formatDate } from '../../../utils/format';


const REPORT_CATEGORIES = [
  { id: 'REVENUE', label: 'Revenue & Sales', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'PAYMENTS', label: 'Customer Payments', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'PROVIDER', label: 'Provider & Commission', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'REFUNDS', label: 'Refunds & Returns', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'PAYOUTS', label: 'Provider Payouts', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'WALLETS', label: 'Wallet Ledgers', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'COUPONS', label: 'Coupons & Subsidies', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: 'REFERRALS', label: 'Referral Rewards', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { id: 'COMPLAINTS', label: 'Complaints', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'RECONCILIATION', label: 'Reconciliation', color: 'bg-slate-100 text-slate-800 border-slate-300' }
];

const REPORT_DEFINITIONS = [
  {
    id: 'summary',
    category: 'REVENUE',
    title: 'Financial Summary Report',
    desc: 'Overall period revenue, commission, and net platform metrics',
    filenamePrefix: 'Financial_Summary',
    supportedFilters: ['startDate', 'endDate', 'paymentMethod', 'paymentStatus', 'bookingStatus', 'providerId', 'customerId', 'bookingId', 'reconciliationStatus', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'date', header: 'Booking Date', type: 'date' },
      { key: 'customer', header: 'Customer', type: 'string' },
      { key: 'provider', header: 'Provider', type: 'string' },
      { key: 'totalAmount', header: 'Total Amount', type: 'currency' },
      { key: 'platformCommission', header: 'Platform Commission', type: 'currency' },
      { key: 'providerEarnings', header: 'Provider Earnings', type: 'currency' },
      { key: 'paymentMethod', header: 'Payment Method', type: 'payment_method' },
      { key: 'paymentStatus', header: 'Payment Status', type: 'status' },
      { key: 'bookingStatus', header: 'Booking Status', type: 'status' }
    ],
    exportHandler: (params, config) => PaymentService.downloadReportCenterExport(params, config)
  },
  {
    id: 'booking_revenue',
    category: 'REVENUE',
    title: 'Booking Revenue Report',
    desc: 'Detailed booking breakdown with subtotals, surcharges, and discounts',
    filenamePrefix: 'Booking_Revenue',
    supportedFilters: ['startDate', 'endDate', 'bookingStatus', 'paymentStatus', 'paymentMethod', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'bookingDate', header: 'Booking Date', type: 'date' },
      { key: 'completionDate', header: 'Completion Date', type: 'date' },
      { key: 'customer', header: 'Customer', type: 'string' },
      { key: 'provider', header: 'Provider', type: 'string' },
      { key: 'service', header: 'Service', type: 'string' },
      { key: 'subtotal', header: 'Subtotal', type: 'currency' },
      { key: 'normalDiscount', header: 'Discount', type: 'currency' },
      { key: 'surcharges', header: 'Surcharges', type: 'currency' },
      { key: 'totalAmount', header: 'Total Amount', type: 'currency' },
      { key: 'paymentMethod', header: 'Payment Method', type: 'payment_method' },
      { key: 'paymentStatus', header: 'Payment Status', type: 'status' },
      { key: 'bookingStatus', header: 'Booking Status', type: 'status' },
      { key: 'platformCommission', header: 'Platform Commission', type: 'currency' },
      { key: 'providerEarnings', header: 'Provider Earnings', type: 'currency' }
    ],
    exportHandler: (params, config) => PaymentService.downloadReportCenterExport(params, config)
  },
  {
    id: 'customer_payment',
    category: 'PAYMENTS',
    title: 'Customer Payment Report',
    desc: 'Payment transactions by method (Online, Razorpay, QR, Cash, Wallet, Mixed)',
    filenamePrefix: 'Customer_Payment',
    supportedFilters: ['startDate', 'endDate', 'paymentMethod', 'paymentStatus', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'transactionId', header: 'Transaction ID', type: 'id' },
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'customer', header: 'Customer', type: 'string' },
      { key: 'attemptedAmount', header: 'Attempted Amount', type: 'currency' },
      { key: 'actualCollectedAmount', header: 'Collected Amount', type: 'currency' },
      { key: 'collectionStatus', header: 'Collection Status', type: 'status' },
      { key: 'paymentMethod', header: 'Payment Method', type: 'payment_method' },
      { key: 'paymentStatus', header: 'Payment Status', type: 'status' },
      { key: 'transactionType', header: 'Transaction Type', type: 'string' },
      { key: 'razorpayOrderId', header: 'Razorpay Order ID', type: 'id' },
      { key: 'razorpayPaymentId', header: 'Razorpay Payment ID', type: 'id' },
      { key: 'createdAt', header: 'Created At', type: 'date' }
    ],
    exportHandler: (params, config) => PaymentService.downloadReportCenterExport(params, config)
  },
  {
    id: 'provider_earnings',
    category: 'PROVIDER',
    title: 'Provider Earnings Report',
    desc: 'Provider earnings lifecycle (held, available, paid)',
    filenamePrefix: 'Provider_Earnings',
    supportedFilters: ['startDate', 'endDate', 'providerId', 'customerId', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'earningId', header: 'Earning ID', type: 'id' },
      { key: 'provider', header: 'Provider', type: 'string' },
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'bookingDate', header: 'Booking Date', type: 'date' },
      { key: 'grossAmount', header: 'Gross Amount', type: 'currency' },
      { key: 'commissionRate', header: 'Commission Rate', type: 'percentage' },
      { key: 'commissionAmount', header: 'Commission Amount', type: 'currency' },
      { key: 'netAmount', header: 'Net Amount', type: 'currency' },
      { key: 'earningStatus', header: 'Earning Status', type: 'status' },
      { key: 'availableAfter', header: 'Available After', type: 'date' }
    ],
    exportHandler: (params, config) => {
      if (params.exportFormat === 'excel') return PaymentService.generateProviderEarningsReport(params, config);
      return PaymentService.downloadReportCenterExport(params, config);
    }
  },
  {
    id: 'commission',
    category: 'PROVIDER',
    title: 'Commission Report',
    desc: 'Booking commission rates, platform commission, and company retained earnings',
    filenamePrefix: 'Commission',
    supportedFilters: ['startDate', 'endDate', 'providerId', 'customerId', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'earningId', header: 'Earning ID', type: 'id' },
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'provider', header: 'Provider', type: 'string' },
      { key: 'bookingDate', header: 'Booking Date', type: 'date' },
      { key: 'commissionRate', header: 'Commission Rate', type: 'percentage' },
      { key: 'grossAmount', header: 'Gross Amount', type: 'currency' },
      { key: 'platformCommission', header: 'Platform Commission', type: 'currency' },
      { key: 'providerNetAmount', header: 'Provider Net Amount', type: 'currency' },
      { key: 'earningStatus', header: 'Earning Status', type: 'status' }
    ],
    exportHandler: (params, config) => {
      if (params.exportFormat === 'excel') return PaymentService.getCommissionReport(params, config);
      return PaymentService.downloadReportCenterExport(params, config);
    }
  },
  {
    id: 'refund',
    category: 'REFUNDS',
    title: 'Refund Report',
    desc: 'Wallet vs Gateway refund execution and balance tracking',
    filenamePrefix: 'Refund',
    supportedFilters: ['startDate', 'endDate', 'providerId', 'customerId', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'refundId', header: 'Refund ID', type: 'id' },
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'customer', header: 'Customer', type: 'string' },
      { key: 'requestedAmount', header: 'Requested Amount', type: 'currency' },
      { key: 'refundAmount', header: 'Refund Amount', type: 'currency' },
      { key: 'walletRefundAmount', header: 'Wallet Refund Amount', type: 'currency' },
      { key: 'gatewayRefundAmount', header: 'Gateway Refund Amount', type: 'currency' },
      { key: 'gatewayRefundId', header: 'Gateway Refund ID', type: 'id' },
      { key: 'refundStatus', header: 'Refund Status', type: 'status' },
      { key: 'refundReason', header: 'Refund Reason', type: 'string' },
      { key: 'createdAt', header: 'Created At', type: 'date' }
    ],
    exportHandler: (params, config) => {
      if (params.exportFormat === 'excel') return PaymentService.generateRefundReport(params, config);
      return PaymentService.downloadReportCenterExport(params, config);
    }
  },
  {
    id: 'payout',
    category: 'PAYOUTS',
    title: 'Provider Payout Report',
    desc: 'Manual bulk and RazorpayX automatic payout histories & UTRs',
    filenamePrefix: 'Payout',
    supportedFilters: ['startDate', 'endDate', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'paymentRecordId', header: 'Payment Record ID', type: 'id' },
      { key: 'transactionReference', header: 'Transaction Reference', type: 'id' },
      { key: 'provider', header: 'Provider', type: 'string' },
      { key: 'amount', header: 'Amount', type: 'currency' },
      { key: 'netAmount', header: 'Net Amount', type: 'currency' },
      { key: 'withdrawalType', header: 'Withdrawal Type', type: 'string' },
      { key: 'status', header: 'Status', type: 'status' },
      { key: 'razorpayPayoutId', header: 'Razorpay Payout ID', type: 'id' },
      { key: 'utrNo', header: 'UTR No', type: 'id' },
      { key: 'requestedAt', header: 'Requested At', type: 'date' },
      { key: 'completedAt', header: 'Completed At', type: 'date' }
    ],
    exportHandler: (params, config) => {
      if (params.exportFormat === 'excel') return PaymentService.payoutHistoryReport(params, config);
      return PaymentService.downloadReportCenterExport(params, config);
    }
  },
  {
    id: 'wallet_ledger',
    category: 'WALLETS',
    title: 'Wallet Ledger Report',
    desc: 'Provider & Customer wallet debits, credits, and balances',
    filenamePrefix: 'Wallet_Ledger',
    supportedFilters: ['startDate', 'endDate', 'paymentStatus', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'transactionId', header: 'Transaction ID', type: 'id' },
      { key: 'walletOwner', header: 'Wallet Owner', type: 'string' },
      { key: 'role', header: 'Role', type: 'string' },
      { key: 'entryDirection', header: 'Entry Direction', type: 'string' },
      { key: 'attemptedAmount', header: 'Attempted Amount', type: 'currency' },
      { key: 'postedFinancialImpact', header: 'Financial Impact', type: 'currency' },
      { key: 'ledgerStatus', header: 'Ledger Status', type: 'status' },
      { key: 'paymentStatus', header: 'Payment Status', type: 'status' },
      { key: 'balanceBefore', header: 'Balance Before', type: 'currency' },
      { key: 'balanceAfter', header: 'Balance After', type: 'currency' },
      { key: 'transactionType', header: 'Transaction Type', type: 'string' },
      { key: 'description', header: 'Description', type: 'string' },
      { key: 'createdAt', header: 'Created At', type: 'date' }
    ],
    exportHandler: (params, config) => PaymentService.downloadReportCenterExport(params, config)
  },
  {
    id: 'cash_recovery',
    category: 'PAYMENTS',
    title: 'Cash Recovery Report',
    desc: 'Cash collected vs platform commission recovery',
    filenamePrefix: 'Cash_Recovery',
    supportedFilters: ['startDate', 'endDate', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'customer', header: 'Customer', type: 'string' },
      { key: 'provider', header: 'Provider', type: 'string' },
      { key: 'totalAmount', header: 'Total Amount', type: 'currency' },
      { key: 'cashCollected', header: 'Cash Collected', type: 'currency' },
      { key: 'platformCommission', header: 'Platform Commission', type: 'currency' },
      { key: 'providerEarnings', header: 'Provider Earnings', type: 'currency' },
      { key: 'paymentStatus', header: 'Payment Status', type: 'status' },
      { key: 'verificationStatus', header: 'Verification Status', type: 'status' },
      { key: 'verifiedAt', header: 'Verified At', type: 'date' }
    ],
    exportHandler: (params, config) => PaymentService.downloadReportCenterExport(params, config)
  },
  {
    id: 'coupon',
    category: 'COUPONS',
    title: 'Coupon Financial Report',
    desc: 'Coupon discounts, company subsidies, and usage',
    filenamePrefix: 'Coupon',
    supportedFilters: ['startDate', 'endDate', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'customer', header: 'Customer', type: 'string' },
      { key: 'couponCode', header: 'Coupon Code', type: 'id' },
      { key: 'discountType', header: 'Discount Type', type: 'string' },
      { key: 'discountValue', header: 'Discount Value', type: 'currency' },
      { key: 'totalDiscount', header: 'Total Discount', type: 'currency' },
      { key: 'subtotal', header: 'Subtotal', type: 'currency' },
      { key: 'finalCustomerPaid', header: 'Final Customer Paid', type: 'currency' },
      { key: 'isReferralCoupon', header: 'Is Referral Coupon', type: 'boolean' },
      { key: 'usageDate', header: 'Usage Date', type: 'date' }
    ],
    exportHandler: (params, config) => PaymentService.downloadReportCenterExport(params, config)
  },
  {
    id: 'referral',
    category: 'REFERRALS',
    title: 'Referral Reward Report',
    desc: 'Customer & Provider referral logs, commission shares, and cash rewards',
    filenamePrefix: 'Referral',
    supportedFilters: ['startDate', 'endDate', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'rewardLogId', header: 'Reward Log ID', type: 'id' },
      { key: 'recipient', header: 'Recipient', type: 'string' },
      { key: 'recipientType', header: 'Recipient Type', type: 'string' },
      { key: 'rewardType', header: 'Reward Type', type: 'string' },
      { key: 'amount', header: 'Amount', type: 'currency' },
      { key: 'status', header: 'Status', type: 'status' },
      { key: 'createdAt', header: 'Created At', type: 'date' }
    ],
    exportHandler: (params, config) => PaymentService.downloadReportCenterExport(params, config)
  },
  {
    id: 'complaint',
    category: 'COMPLAINTS',
    title: 'Complaint Financial Report',
    desc: 'Complaints, compensation costs, and refund references',
    filenamePrefix: 'Complaint',
    supportedFilters: ['startDate', 'endDate', 'providerId', 'customerId', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'complaintId', header: 'Complaint ID', type: 'id' },
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'customer', header: 'Customer', type: 'string' },
      { key: 'provider', header: 'Provider', type: 'string' },
      { key: 'title', header: 'Title', type: 'string' },
      { key: 'category', header: 'Category', type: 'category' },
      { key: 'status', header: 'Status', type: 'status' },
      { key: 'createdAt', header: 'Created At', type: 'date' }
    ],
    exportHandler: (params, config) => {
      if (params.exportFormat === 'excel') return PaymentService.generateComplaintReport(params, config);
      return PaymentService.downloadReportCenterExport(params, config);
    }
  },
  {
    id: 'razorpay_reconcile',
    category: 'RECONCILIATION',
    title: 'Razorpay Reconciliation Report',
    desc: 'Match Razorpay gateway payments with database transactions',
    filenamePrefix: 'Razorpay_Reconciliation',
    supportedFilters: ['startDate', 'endDate', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'transactionId', header: 'Transaction ID', type: 'id' },
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'razorpayOrderId', header: 'Razorpay Order ID', type: 'id' },
      { key: 'razorpayPaymentId', header: 'Razorpay Payment ID', type: 'id' },
      { key: 'razorpayAmount', header: 'Razorpay Amount', type: 'currency' },
      { key: 'transactionAmount', header: 'Transaction Amount', type: 'currency' },
      { key: 'bookingAmount', header: 'Booking Amount', type: 'currency' },
      { key: 'razorpayGatewayStatus', header: 'Razorpay Gateway Status', type: 'status' },
      { key: 'transactionPaymentStatus', header: 'Transaction Payment Status', type: 'status' },
      { key: 'bookingPaymentStatus', header: 'Booking Payment Status', type: 'status' },
      { key: 'reconciliationStatus', header: 'Reconciliation Status', type: 'reconciliation_status' }
    ],
    exportHandler: (params, config) => PaymentService.downloadReportCenterExport(params, config)
  },
  {
    id: 'master_reconcile',
    category: 'RECONCILIATION',
    title: 'Master Reconciliation Report',
    desc: 'Complete Booking -> Txn -> Razorpay -> Earning -> Payout audit chain',
    filenamePrefix: 'Master_Reconciliation',
    supportedFilters: ['startDate', 'endDate', 'zoneIds'],
    supportedFormats: ['csv', 'excel', 'pdf'],
    columns: [
      { key: 'bookingId', header: 'Booking ID', type: 'id' },
      { key: 'bookingTotal', header: 'Booking Total', type: 'currency' },
      { key: 'customerPaid', header: 'Customer Paid', type: 'currency' },
      { key: 'platformCommission', header: 'Platform Commission', type: 'currency' },
      { key: 'providerEarning', header: 'Provider Earning', type: 'currency' },
      { key: 'walletAmount', header: 'Wallet Amount', type: 'currency' },
      { key: 'refundAmount', header: 'Refund Amount', type: 'currency' },
      { key: 'payoutAmount', header: 'Payout Amount', type: 'currency' },
      { key: 'paymentMethod', header: 'Payment Method', type: 'payment_method' },
      { key: 'bookingStatus', header: 'Booking Status', type: 'status' },
      { key: 'paymentStatus', header: 'Payment Status', type: 'status' },
      { key: 'reconciliationStatus', header: 'Reconciliation Status', type: 'reconciliation_status' }
    ],
    exportHandler: (params, config) => PaymentService.downloadReportCenterExport(params, config)
  }
];

const REPORT_TYPES = REPORT_DEFINITIONS;

const AdminFinancialReportCenter = () => {
  const { showToast } = useAuth();
  const { getComputedDateRange, getMergedQuery, resetGlobalFilters } = useAdminFilter();

  const [activeCategory, setActiveCategory] = useState('REVENUE');
  const [selectedReport, setSelectedReport] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [reportRows, setReportRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalRecords: 0, totalPages: 1 });

  // Sync with global top filter bar
  const globalDates = getComputedDateRange();

  // Filter State
  const [filters, setFilters] = useState({
    startDate: globalDates.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    endDate: globalDates.endDate || new Date().toISOString().split('T')[0],
    providerId: '',
    customerId: '',
    bookingId: '',
    paymentMethod: '',
    paymentStatus: '',
    bookingStatus: '',
    reconciliationStatus: ''
  });

  // Automatically update start and end dates when top global filter (year, month, quarter, financial year) changes
  useEffect(() => {
    if (globalDates.startDate && globalDates.endDate) {
      setFilters(prev => ({
        ...prev,
        startDate: globalDates.startDate,
        endDate: globalDates.endDate
      }));
    }
  }, [globalDates.startDate, globalDates.endDate]);

  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const fetchAbortControllerRef = useRef(null);

  const fetchReportData = useCallback(async (overrides = {}) => {
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    fetchAbortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const mergedQuery = getMergedQuery();
      const queryParams = {
        reportType: selectedReport,
        startDate: filters.startDate || mergedQuery.startDate,
        endDate: filters.endDate || mergedQuery.endDate,
        zoneIds: mergedQuery.zoneIds || undefined,
        providerId: filters.providerId || undefined,
        customerId: filters.customerId || undefined,
        bookingId: filters.bookingId || undefined,
        paymentMethod: filters.paymentMethod || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        bookingStatus: filters.bookingStatus || undefined,
        reconciliationStatus: filters.reconciliationStatus || undefined,
        page: overrides.page || pagination.page,
        limit: 50
      };

      const res = await PaymentService.getFinancialReportCenterData(queryParams, { signal: fetchAbortControllerRef.current.signal });
      if (res.data?.success) {
        setSummaryData(res.data.summaryCards || null);
        setReportRows(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        }
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('Error loading report center data:', err);
        showToast?.('Failed to load financial report data', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedReport, filters, pagination.page, getMergedQuery, showToast]);

  useEffect(() => {
    let count = 0;
    if (filters.providerId) count++;
    if (filters.customerId) count++;
    if (filters.bookingId) count++;
    if (filters.paymentMethod) count++;
    if (filters.paymentStatus) count++;
    if (filters.bookingStatus) count++;
    if (filters.reconciliationStatus) count++;
    setActiveFilterCount(count);

    fetchReportData();
  }, [selectedReport, filters.startDate, filters.endDate, fetchReportData]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    if (resetGlobalFilters) resetGlobalFilters();
    const fresh = getComputedDateRange();
    setFilters({
      startDate: fresh.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
      endDate: fresh.endDate || new Date().toISOString().split('T')[0],
      providerId: '',
      customerId: '',
      bookingId: '',
      paymentMethod: '',
      paymentStatus: '',
      bookingStatus: '',
      reconciliationStatus: ''
    });
    showToast?.('Filters synchronized and reset to global defaults', 'info');
  };

  // Centralized Export Handler based on REPORT_DEFINITIONS registry
  const handleExportFormat = async (format) => {
    const reportDef = REPORT_DEFINITIONS.find(r => r.id === selectedReport);
    if (!reportDef) {
      showToast?.(`Report definition not found for: ${selectedReport}`, 'error');
      return;
    }

    if (!reportDef.supportedFormats.includes(format)) {
      showToast?.(`${format.toUpperCase()} export is not supported for ${reportDef.title}`, 'warning');
      return;
    }



    try {
      showToast?.(`Preparing ${format.toUpperCase()} export for ${reportDef.title}...`, 'info');
      const config = { responseType: 'blob' };
      const mergedQuery = getMergedQuery ? getMergedQuery() : {};
      const sDate = filters.startDate || mergedQuery.startDate;
      const eDate = filters.endDate || mergedQuery.endDate;

      const params = {
        reportType: selectedReport,
        startDate: sDate,
        endDate: eDate,
        fromDate: sDate,
        toDate: eDate,
        zoneIds: mergedQuery.zoneIds || undefined,
        providerId: filters.providerId || undefined,
        customerId: filters.customerId || undefined,
        bookingId: filters.bookingId || undefined,
        paymentMethod: filters.paymentMethod || undefined,
        paymentStatus: filters.paymentStatus || undefined,
        bookingStatus: filters.bookingStatus || undefined,
        reconciliationStatus: filters.reconciliationStatus || undefined,
        exportFormat: format
      };

      const res = await reportDef.exportHandler(params, config);

      if (!res || !res.data) {
        showToast?.('Failed to download report: Empty response', 'error');
        return;
      }

      const mimeType = format === 'csv'
        ? 'text/csv;charset=utf-8'
        : format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const ext = format === 'excel' ? 'xlsx' : format;
      const blob = new Blob([res.data], { type: mimeType });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `${reportDef.filenamePrefix}_${params.startDate}_to_${params.endDate}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast?.(`${reportDef.title} ${format.toUpperCase()} exported successfully!`, 'success');
    } catch (e) {
      console.error(`Export error for ${selectedReport}:`, e);
      showToast?.(`Export failed for ${reportDef.title}`, 'error');
    }
  };

  const exportToCSV = () => handleExportFormat('csv');
  const exportToExcel = () => handleExportFormat('excel');
  const printPDF = () => handleExportFormat('pdf');

  const renderStatusBadge = (status) => (

    <StatusBadge status={status} module="earning" size="sm" />
  );


  return (
    <div className="p-4 md:p-8 space-y-8 bg-gray-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <FiFileText className="w-7 h-7 text-primary" /> Financial Reports
          </h1>
          <p className="text-xs md:text-sm text-gray-500 font-medium">Generate and download comprehensive financial reports</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className="px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center gap-1.5">
            <FiDownload className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={exportToExcel} className="px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm flex items-center gap-1.5">
            <FiDownload className="w-3.5 h-3.5" /> Excel (XLSX)
          </button>
          <button onClick={printPDF} className="px-3.5 py-2 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 transition-all shadow-sm flex items-center gap-1.5">
            <FiPrinter className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* TOP FINANCIAL SUMMARY CARDS */}
      {summaryData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Booking Value</p>
            <p className="text-base md:text-lg font-black text-gray-900 mt-0.5">{formatCurrency(summaryData.totalBookingValue || 0)}</p>
            <p className="text-[9px] font-medium text-gray-400 mt-1">Gross Order / Service Demand</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Collected Payments</p>
            <p className="text-base md:text-lg font-black text-blue-600 mt-0.5">{formatCurrency(summaryData.totalCustomerPayments || 0)}</p>
            <p className="text-[9px] font-medium text-blue-400 mt-1">Actual Customer Collections</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Platform Commission</p>
            <p className="text-base md:text-lg font-black text-purple-600 mt-0.5">{formatCurrency(summaryData.platformCommission || 0)}</p>
            <p className="text-[9px] font-medium text-purple-400 mt-1">Gross Commission Share</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Provider Earnings</p>
            <p className="text-base md:text-lg font-black text-emerald-600 mt-0.5">{formatCurrency(summaryData.providerEarnings || 0)}</p>
            <p className="text-[9px] font-medium text-emerald-400 mt-1">Provider Net Payable</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actual Refunded</p>
            <p className="text-base md:text-lg font-black text-rose-600 mt-0.5">{formatCurrency(summaryData.totalRefunds || 0)}</p>
            <p className="text-[9px] font-medium text-rose-400 mt-1">Financially Completed Refunds</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Payouts</p>
            <p className="text-base md:text-lg font-black text-indigo-600 mt-0.5">{formatCurrency(summaryData.totalPayouts || 0)}</p>
            <p className="text-[9px] font-medium text-indigo-400 mt-1">Disbursed Provider Payouts</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Referral Rewards</p>
            <p className="text-base md:text-lg font-black text-cyan-600 mt-0.5">{formatCurrency(summaryData.referralRewards || 0)}</p>
            <p className="text-[9px] font-medium text-cyan-400 mt-1">User Referral Subsidies</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Coupon Subsidy</p>
            <p className="text-base md:text-lg font-black text-amber-600 mt-0.5">{formatCurrency(summaryData.couponSubsidy || 0)}</p>
            <p className="text-[9px] font-medium text-amber-400 mt-1">Platform Discount Subsidies</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Provider Cash Collection</p>
            <p className="text-base md:text-lg font-black text-slate-700 mt-0.5">{formatCurrency(summaryData.providerCollectedCash || 0)}</p>
            <p className="text-[9px] font-medium text-slate-400 mt-1">Cash Collected by Providers</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cash Recovery</p>
            <p className="text-base md:text-lg font-black text-teal-600 mt-0.5">{formatCurrency(summaryData.cashRecovery || 0)}</p>
            <p className="text-[9px] font-medium text-teal-400 mt-1">Cash Booking Commission</p>
          </div>
          <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Net Platform Revenue</p>
            <p className="text-base md:text-lg font-black mt-0.5">{formatCurrency(summaryData.netPlatformRevenue || 0)}</p>
            <p className="text-[9px] font-medium text-emerald-200 mt-1">Net Retained Earnings</p>
          </div>
        </div>
      )}

      {/* CATEGORY SELECTOR TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {REPORT_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategory(cat.id);
              const firstRep = REPORT_TYPES.find(r => r.category === cat.id);
              if (firstRep) setSelectedReport(firstRep.id);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all border ${activeCategory === cat.id ? 'bg-secondary text-white border-secondary shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* REPORT TYPE CARDS (FOR SELECTED CATEGORY) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_TYPES.filter(r => r.category === activeCategory).map(rep => (
          <div
            key={rep.id}
            onClick={() => setSelectedReport(rep.id)}
            className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedReport === rep.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-gray-100 hover:border-gray-200'
              }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-900">{rep.title}</h3>
              {selectedReport === rep.id && <FiCheckCircle className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">{rep.desc}</p>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiFilter className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Report Filters (Synchronized with Global Bar)</h3>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full">{activeFilterCount} Active</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchReportData()} className="px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-all">
              Apply Filters
            </button>
            <button onClick={resetFilters} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-all">
              Reset Filters
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Start Date</label>
            <input type="date" value={filters.startDate} onChange={e => handleFilterChange('startDate', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">End Date</label>
            <input type="date" value={filters.endDate} onChange={e => handleFilterChange('endDate', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Payment Method</label>
            <select value={filters.paymentMethod} onChange={e => handleFilterChange('paymentMethod', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg">
              <option value="">All Methods</option>
              <option value="online">Online</option>
              <option value="cash">Cash</option>
              <option value="wallet">Wallet</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Payment Status</label>
            <select value={filters.paymentStatus} onChange={e => handleFilterChange('paymentStatus', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="escrowhold">Escrow Hold</option>
              <option value="paid">Paid</option>
              <option value="settled">Settled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Booking Status</label>
            <select value={filters.bookingStatus} onChange={e => handleFilterChange('bookingStatus', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg">
              <option value="">All Booking Statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="ontheway">On the way</option>
              <option value="workstarted">Work Started</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Provider ID</label>
            <input type="text" placeholder="Filter Provider ID" value={filters.providerId} onChange={e => handleFilterChange('providerId', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg" />
          </div>
        </div>
      </div>

      {/* REPORT PREVIEW TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden space-y-4">
        <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FiLayers className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Report Preview ({pagination.totalRecords} Records)</h3>
              <span className="text-[10px] text-gray-400 font-semibold block mt-0.5">
                Date Filter Basis: <span className="text-primary font-bold">{
                  selectedReport === 'booking_revenue' ? 'Booking Creation Date' :
                    selectedReport === 'customer_payment' ? 'Payment Transaction Event Date' :
                      (selectedReport === 'provider_earnings' || selectedReport === 'commission') ? 'Earning Ledger Date' :
                        selectedReport === 'refund' ? 'Refund Event Date' :
                          selectedReport === 'payout' ? 'Payout Execution Date' :
                            selectedReport === 'wallet_ledger' ? 'Wallet Transaction Date' :
                              'Financial Audit Timestamp'
                }</span> ({filters.startDate} to {filters.endDate})
              </span>
            </div>
          </div>
          <span className="text-[11px] text-gray-500 font-medium">Showing page {pagination.page} of {pagination.totalPages}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs font-bold">Loading authoritative report data...</div>
        ) : reportRows.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-xs font-bold">No financial records found for selected filters</div>
        ) : (
          {
            ...(() => {
              const activeReportDef = REPORT_DEFINITIONS.find(r => r.id === selectedReport);
              const explicitCols = activeReportDef?.columns;
              const sampleKeys = reportRows.length > 0 ? Object.keys(reportRows[0]) : [];
              const displayCols = explicitCols || sampleKeys.map(k => ({ key: k, header: k.replace(/([A-Z])/g, ' $1') }));

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100 font-bold text-gray-500 uppercase text-[10px]">
                        {displayCols.map(col => (
                          <th key={col.key} className="p-3 whitespace-nowrap">{col.header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reportRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                          {displayCols.map(col => {
                            const val = row[col.key];
                            const k = col.key.toLowerCase();
                            const explicitType = col.type || (
                              k.includes('phone') || k.includes('mobile') ? 'phone' :
                              k.includes('id') || k.includes('reference') || k.includes('utr') || k.includes('code') ? 'id' :
                              k.includes('status') ? 'status' :
                              k.includes('method') ? 'payment_method' :
                              k.includes('category') ? 'category' :
                              isMonetaryField(col.key) ? 'currency' :
                              isPercentageField(col.key) ? 'percentage' :
                              k.includes('date') || k.includes('time') || k === 'createdat' ? 'date' :
                              typeof val === 'boolean' ? 'boolean' :
                              'text'
                            );

                            return (
                              <td key={col.key} className="p-3 whitespace-nowrap font-medium text-gray-700">
                                {val === null || val === undefined || val === '' ? (
                                  <span className="text-gray-300">—</span>
                                ) : explicitType === 'currency' ? (
                                  formatFinancialReportAmount(val)
                                ) : explicitType === 'percentage' ? (
                                  (typeof val === 'number' || !isNaN(Number(val))) ? `${Number(val).toFixed(2)}%` : String(val)
                                ) : explicitType === 'date' ? (
                                  formatDate(val)
                                ) : explicitType === 'status' || explicitType === 'reconciliation_status' ? (
                                  renderStatusBadge(val)
                                ) : explicitType === 'payment_method' || explicitType === 'category' ? (
                                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 font-semibold text-[11px]">{formatStatus(val)}</span>
                                ) : explicitType === 'id' ? (
                                  <span className="font-mono text-gray-800 font-bold">{String(val)}</span>
                                ) : explicitType === 'phone' ? (
                                  <span className="font-mono text-gray-700">{String(val)}</span>
                                ) : explicitType === 'boolean' ? (
                                  val ? <span className="text-emerald-600 font-bold">Yes</span> : <span className="text-gray-400">No</span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    {reportRows.length > 0 && (
                      <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-800 uppercase text-[10px]">
                        <tr>
                          {displayCols.map((col, colIdx) => {
                            const k = col.key;
                            if (colIdx === 0) return <td key={col.key} className="p-3 whitespace-nowrap font-black">Page Subtotal</td>;
                            if (isMonetaryField(k)) {
                              const pageTotal = reportRows.reduce((sum, row) => sum + (Number(row[k]) || 0), 0);
                              return <td key={col.key} className="p-3 whitespace-nowrap font-black text-primary">{formatCurrency(pageTotal)}</td>;
                            }
                            return <td key={col.key} className="p-3 whitespace-nowrap text-gray-300">—</td>;
                          })}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              );
            })()
          }
        )}
      </div>
    </div>
  );
};

export default AdminFinancialReportCenter;
