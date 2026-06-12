import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import TableSkeleton from '../../components/ui-skeletons/TableSkeleton';
import * as TransactionService from '../../services/TransactionService';
import Pagination from '../../components/Pagination';
import { useAdminFilter } from '../../context/AdminFilterContext';
import AdminFilterBar from '../../components/AdminFilterBar';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/format';
import PriceDisplay from '../../components/PriceDisplay';
import {
    Search,
    Filter,
    Eye,
    CreditCard,
    ArrowUpRight,
    ArrowDownLeft,
    CheckCircle,
    XCircle,
    Clock,
    X,
    Calendar,
    User,
    Briefcase,
    Hash,
    DollarSign,
    ExternalLink
} from 'lucide-react';

const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'success', label: 'Success' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
    { value: 'processing', label: 'Processing' },
    { value: 'refunded', label: 'Refunded' }
];

const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
        case 'success':
        case 'completed':
        case 'paid':
        case 'escrow_hold':
            return 'bg-green-50 text-green-700 border-green-100';
        case 'pending':
        case 'processing':
            return 'bg-yellow-50 text-yellow-700 border-yellow-100';
        case 'failed':
        case 'cancelled':
            return 'bg-red-50 text-red-700 border-red-100';
        case 'refunded':
            return 'bg-blue-50 text-blue-700 border-blue-100';
        default:
            return 'bg-gray-50 text-gray-700 border-gray-100';
    }
};

const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
        case 'success':
        case 'completed':
        case 'paid':
        case 'escrow_hold':
            return <CheckCircle className="w-3.5 h-3.5 mr-1" />;
        case 'pending':
        case 'processing':
            return <Clock className="w-3.5 h-3.5 mr-1" />;
        case 'failed':
        case 'cancelled':
            return <XCircle className="w-3.5 h-3.5 mr-1" />;
        default:
            return <Clock className="w-3.5 h-3.5 mr-1" />;
    }
};

const getAmountInRupees = (txn) => {
    if (!txn) return 0;
    return txn.isRupees || ['cash', 'wallet'].includes(txn.paymentMethod?.toLowerCase())
        ? txn.amount
        : txn.amount / 100;
};

const getCommissionInRupees = (txn) => {
    if (!txn) return 0;
    return txn.isRupees || ['cash', 'wallet'].includes(txn.paymentMethod?.toLowerCase())
        ? (txn.commission || 0)
        : (txn.commission || 0) / 100;
};

const getProviderEarningInRupees = (txn) => {
    if (!txn) return 0;
    return txn.isRupees || ['cash', 'wallet'].includes(txn.paymentMethod?.toLowerCase())
        ? (txn.providerEarning || 0)
        : (txn.providerEarning || 0) / 100;
};

const AdminTransactions = () => {
    const { showToast } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [reasonText, setReasonText] = useState('');
    const [targetTxnId, setTargetTxnId] = useState(null);

    const {
        filterType,
        year,
        financialYear,
        month,
        quarter,
        zoneIds,
        getMergedQuery
    } = useAdminFilter();

    // Filters - initialize from URL to prevent race conditions
    const [filters, setFilters] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            bookingId: params.get('bookingId') || '',
            status: 'all'
        };
    });

    // Pagination
    const [pagination, setPagination] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return {
            page: parseInt(params.get('page')) || 1,
            limit: 20,
            total: 0,
            pages: 0
        };
    });

    const fetchTransactions = useCallback(async () => {
        try {
            setLoading(true);
            const params = {
                page: pagination.page,
                limit: pagination.limit,
                bookingId: filters.bookingId,
                status: filters.status,
                ...getMergedQuery()
            };
            const response = await TransactionService.getAllTransactions(params);
            if (response.data.success) {
                setTransactions(response.data.data);
                setPagination(prev => ({
                    ...prev,
                    total: response.data.total,
                    pages: response.data.pages
                }));
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            showToast(error.response?.data?.message || 'Failed to fetch transactions', 'error');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, filters, showToast, getMergedQuery]);

    const location = useLocation();

    // Update filters from URL search param if exists (for in-page navigation)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const bookingIdParam = params.get('bookingId');
        if (bookingIdParam !== undefined && bookingIdParam !== filters.bookingId) {
            setFilters(prev => ({ ...prev, bookingId: bookingIdParam || '' }));
            setPagination(prev => ({ ...prev, page: 1 }));
        }
    }, [location.search]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions, filterType, year, financialYear, month, quarter, zoneIds]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleRowClick = async (id) => {
        try {
            const response = await TransactionService.getTransactionById(id);
            if (response.data.success) {
                setSelectedTransaction(response.data.data);
                setShowModal(true);
            }
        } catch (error) {
            showToast('Failed to fetch transaction details', 'error');
        }
    };

    const navigateToBooking = (bookingId) => {
        if (!bookingId) {
            showToast('Booking ID not found for this transaction', 'error');
            return;
        }
        // Navigating to bookings page with search filter
        navigate(`/admin/bookings?search=${bookingId}`);
    };

    const handleRetryVerify = async (id) => {
        try {
            const response = await TransactionService.adminRetryVerify(id);
            if (response.data.success) {
                showToast(response.data.message || 'Payment successfully verified!', 'success');
                setShowModal(false);
                fetchTransactions();
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to retry verification', 'error');
        }
    };

    const handleMarkPaid = (id) => {
        setTargetTxnId(id);
        setReasonText('');
        setShowReasonModal(true);
    };

    const submitMarkPaid = async () => {
        const trimmedReason = reasonText.trim();
        if (trimmedReason.length < 5) {
            showToast('A detailed reconciliation reason (minimum 5 characters) is required to proceed.', 'error');
            return;
        }

        try {
            const response = await TransactionService.adminMarkPaid(targetTxnId, trimmedReason);
            if (response.data.success) {
                showToast(response.data.message || 'Transaction marked as paid successfully!', 'success');
                setShowReasonModal(false);
                setShowModal(false);
                fetchTransactions();
            }
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to mark transaction paid', 'error');
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-secondary">Transaction History</h1>
                    <p className="text-gray-500 text-sm mt-1">Monitor all platform payments and commissions</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-primary" />
                        <span className="text-sm font-semibold text-secondary">
                            Total: {pagination.total}
                        </span>
                    </div>
                </div>
            </div>

            {/* Reusable Premium Filter Bar */}
            <AdminFilterBar onApply={fetchTransactions} />

            {/* Local Page Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Search Booking / Txn ID</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            name="bookingId"
                            placeholder="Enter Booking ID..."
                            value={filters.bookingId}
                            onChange={handleFilterChange}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                        />
                    </div>
                </div>
                <div className="w-full md:w-64">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Payment Status</label>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all"
                        >
                            {statusOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setFilters({ bookingId: '', status: 'all' });
                        setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="px-6 py-2.5 text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
                >
                    Reset
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Transaction Details</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Booking ID & Parties</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Gross Billed</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Commission Split</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Surcharge Split</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Provider Receivable</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Platform Revenue</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <TableSkeleton rows={8} cols={9} />
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="py-20 text-center text-gray-400">
                                        No transactions found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((txn) => {
                                    const grossBilled = txn.booking?.totalAmount || getAmountInRupees(txn);
                                    const commissionSplit = txn.booking?.commissionAmount ?? getCommissionInRupees(txn);
                                    
                                    const visiting = txn.booking?.visitingCharge || 0;
                                    const rain = txn.booking?.rainCharge || 0;
                                    const traffic = txn.booking?.trafficCharge || 0;
                                    const night = txn.booking?.nightCharge || 0;
                                    const demand = txn.booking?.demandSurge || 0;
                                    const platformFee = txn.booking?.platformFee || 0;
                                    const custom = txn.booking?.customCharges || 0;
                                    const totalSurcharges = visiting + rain + traffic + night + demand + platformFee + custom;
                                    
                                    const providerSurchargeSplit = txn.booking?.providerSurgeShare || 0;
                                    const companySurchargeSplit = txn.booking?.companySurgeShare || 0;
                                    
                                    const finalProviderReceivable = txn.booking?.providerEarnings ?? getProviderEarningInRupees(txn);
                                    const finalPlatformRevenue = (txn.booking?.commissionAmount || 0) + (txn.booking?.companySurgeShare || 0);

                                    return (
                                        <tr key={txn._id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-semibold text-secondary font-mono">
                                                        {txn.transactionId || '---'}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-extrabold border ${txn.type === 'refund' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                                            {txn.type?.toUpperCase() || 'PAYMENT'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">
                                                            {txn.paymentMethod?.toUpperCase()} • {txn.currency}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 mt-1">
                                                        <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                                            {formatDateTime(txn.createdAt).split('at')[0]}
                                                        </span>
                                                        <span className="text-[9px] text-gray-400">
                                                            {formatDateTime(txn.createdAt).split('at')[1]}
                                                        </span>
                                                    </div>
                                                    {txn.razorpayPaymentId && (
                                                        <span className="text-[9px] text-orange-600 bg-orange-50/60 font-semibold font-mono px-2 py-0.5 rounded-lg border border-orange-100/60 w-fit mt-1" title={`Razorpay Payment ID: ${txn.razorpayPaymentId}`}>
                                                            RPID: {txn.razorpayPaymentId}
                                                        </span>
                                                    )}
                                                    {txn.razorpayOrderId && !txn.razorpayPaymentId && (
                                                        <span className="text-[9px] text-gray-600 bg-gray-50 font-semibold font-mono px-2 py-0.5 rounded-lg border border-gray-100 w-fit mt-1" title={`Razorpay Order ID: ${txn.razorpayOrderId}`}>
                                                            RPOID: {txn.razorpayOrderId}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <button
                                                        onClick={() => navigateToBooking(txn.bookingId || txn.booking?.bookingId || txn.booking?._id)}
                                                        className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline group/link w-fit"
                                                    >
                                                        {txn.bookingId || txn.booking?.bookingId || 'View Booking'}
                                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                                    </button>
                                                    <div className="flex flex-col gap-0.5 text-xs">
                                                        <span className="text-gray-600 font-medium flex items-center gap-1">
                                                            <span className="text-gray-400">Cust:</span> {txn.user?.name || '---'}
                                                        </span>
                                                        <span className="text-gray-600 font-medium flex items-center gap-1">
                                                            <span className="text-gray-400">Prov:</span> {txn.provider?.name || '---'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[9px] text-gray-400 mt-1 line-clamp-1 max-w-[150px]">
                                                        {txn.booking?.services?.[0]?.service?.title || txn.description || 'Service Details'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <PriceDisplay amount={grossBilled} type={txn.type === 'refund' ? 'negative' : 'default'} prefix={txn.type === 'refund' ? '-' : ''} className="text-sm font-bold" />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <PriceDisplay amount={commissionSplit} type={txn.type === 'refund' ? 'negative' : 'gray-bold'} prefix={txn.type === 'refund' ? '-' : ''} className="text-sm font-semibold" />
                                                    {txn.commissionRule?.name && (
                                                        <span className="text-[9px] text-gray-400 italic opacity-85">
                                                            {txn.commissionRule.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex flex-col items-end">
                                                    <PriceDisplay amount={totalSurcharges} type={txn.type === 'refund' ? 'negative' : 'gray-bold'} prefix={txn.type === 'refund' ? '-' : ''} className="text-sm font-semibold" />
                                                    {totalSurcharges > 0 && (
                                                        <div className="flex flex-col items-end text-[9px] text-gray-400 mt-0.5">
                                                            <span>Prov: <PriceDisplay amount={providerSurchargeSplit} type="text-only" /></span>
                                                            <span>Plat: <PriceDisplay amount={companySurchargeSplit} type="text-only" /></span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <PriceDisplay amount={finalProviderReceivable} type={txn.type === 'refund' ? 'negative' : 'earning'} prefix={txn.type === 'refund' ? '-' : ''} className="text-sm font-bold" />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <PriceDisplay amount={finalPlatformRevenue} type={txn.type === 'refund' ? 'negative' : 'primary'} prefix={txn.type === 'refund' ? '-' : ''} className="text-sm font-bold" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusColor(txn.paymentStatus)}`}>
                                                        {getStatusIcon(txn.paymentStatus)}
                                                        {txn.paymentStatus?.toUpperCase()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center">
                                                    <button
                                                        onClick={() => handleRowClick(txn._id)}
                                                        className="p-2 hover:bg-white hover:shadow-md rounded-lg text-primary transition-all"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="border-t border-gray-100 px-6 py-4">
                    <Pagination
                        currentPage={pagination.page}
                        totalPages={pagination.pages}
                        totalItems={pagination.total}
                        limit={pagination.limit}
                        onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))}
                    />
                </div>
            </div>

            {/* Details Modal */}
            {showModal && selectedTransaction && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-secondary/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
                    <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-secondary">Transaction Details</h3>
                                <p className="text-xs text-gray-400 mt-0.5">ID: {selectedTransaction.transactionId}</p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-8 py-8 space-y-8 overflow-y-auto max-h-[70vh]">
                            {/* Status and Amount Summary */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Total Paid</span>
                                    <p className="text-3xl font-black text-secondary">
                                        <PriceDisplay amount={getAmountInRupees(selectedTransaction)} type="text-only" />
                                    </p>
                                </div>
                                <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Payment Status</span>
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border mt-1 ${getStatusColor(selectedTransaction.paymentStatus)}`}>
                                        {getStatusIcon(selectedTransaction.paymentStatus)}
                                        {selectedTransaction.paymentStatus?.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                {/* Booking Info */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                            <Hash className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Booking</span>
                                            <button
                                                onClick={() => navigateToBooking(selectedTransaction.bookingId || selectedTransaction.booking?.bookingId || selectedTransaction.booking?._id)}
                                                className="text-sm font-black text-primary hover:text-primary-dark flex items-center gap-2 bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 transition-all hover:bg-primary/10"
                                            >
                                                {selectedTransaction.bookingId || selectedTransaction.booking?.bookingId || 'VIEW BOOKING'} <ExternalLink className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                                            <Briefcase className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Service</span>
                                            <p className="text-sm font-semibold text-secondary">
                                                {selectedTransaction.booking?.services?.[0]?.service?.title || 'Multiple Services'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Participants */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Customer</span>
                                            <p className="text-sm font-semibold text-secondary">{selectedTransaction.user?.name}</p>
                                            <p className="text-[10px] text-gray-400">{selectedTransaction.user?.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-500">
                                            <Briefcase className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Provider</span>
                                            <p className="text-sm font-semibold text-secondary">
                                                {selectedTransaction.provider?.name || selectedTransaction.booking?.provider?.name || 'Unassigned'}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {selectedTransaction.provider?.providerId || selectedTransaction.booking?.provider?.providerId || '---'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Financial Breakdown */}
                            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Financial Breakdown</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Service Amount (Subtotal)</span>
                                        <PriceDisplay amount={selectedTransaction.booking?.subtotal || getAmountInRupees(selectedTransaction)} type="default" />
                                    </div>

                                    {selectedTransaction.booking?.totalDiscount > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Discount {selectedTransaction.booking?.couponApplied?.code && '(' + selectedTransaction.booking.couponApplied.code + ')'}</span>
                                            <PriceDisplay amount={selectedTransaction.booking.totalDiscount} type="discount" prefix="-" />
                                        </div>
                                    )}

                                    {selectedTransaction.booking?.visitingCharge > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Visiting Charge</span>
                                            <PriceDisplay amount={selectedTransaction.booking.visitingCharge} type="negative" prefix="+" />
                                        </div>
                                    )}

                                    {selectedTransaction.booking?.rainCharge > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Rain Charge</span>
                                            <PriceDisplay amount={selectedTransaction.booking.rainCharge} type="negative" prefix="+" />
                                        </div>
                                    )}

                                    {selectedTransaction.booking?.trafficCharge > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Traffic Charge</span>
                                            <PriceDisplay amount={selectedTransaction.booking.trafficCharge} type="negative" prefix="+" />
                                        </div>
                                    )}

                                    {selectedTransaction.booking?.nightCharge > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Night Charge</span>
                                            <PriceDisplay amount={selectedTransaction.booking.nightCharge} type="negative" prefix="+" />
                                        </div>
                                    )}

                                    {selectedTransaction.booking?.demandSurge > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Demand Charge</span>
                                            <PriceDisplay amount={selectedTransaction.booking.demandSurge} type="negative" prefix="+" />
                                        </div>
                                    )}

                                    {selectedTransaction.booking?.platformFee > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Platform Fee</span>
                                            <PriceDisplay amount={selectedTransaction.booking.platformFee} type="negative" prefix="+" />
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-sm border-t border-gray-205 pt-2">
                                        <div className="flex flex-col">
                                            <span className="text-gray-500">Commission (Platform)</span>
                                            {selectedTransaction.commissionRule?.name && (
                                                <span className="text-[10px] text-gray-400 italic">
                                                    Rule: {selectedTransaction.commissionRule.name} ({selectedTransaction.commissionRule.rate}{selectedTransaction.commissionRule.type === 'percentage' ? '%' : ' Fixed'})
                                                </span>
                                            )}
                                        </div>
                                        <PriceDisplay amount={getCommissionInRupees(selectedTransaction)} type="negative" prefix="-" />
                                    </div>

                                    {selectedTransaction.booking?.providerSurgeShare > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Provider Surge Share</span>
                                            <PriceDisplay amount={selectedTransaction.booking.providerSurgeShare} type="positive" prefix="+" />
                                        </div>
                                    )}

                                    {selectedTransaction.booking?.companySurgeShare > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Platform Surge Share</span>
                                            <PriceDisplay amount={selectedTransaction.booking.companySurgeShare} type="purple-bold" prefix="+" />
                                        </div>
                                    )}

                                    <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-secondary">Provider Earning</span>
                                            <span className="text-[9px] text-gray-400">Commission-deducted base + surge share</span>
                                        </div>
                                        <PriceDisplay amount={getProviderEarningInRupees(selectedTransaction)} type="green-bold" className="text-lg" />
                                    </div>

                                    <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-secondary">Platform Earnings (Admin)</span>
                                            <span className="text-[9px] text-gray-400">Commission + platform surge share</span>
                                        </div>
                                        <PriceDisplay amount={
                                                getCommissionInRupees(selectedTransaction) + 
                                                (selectedTransaction.booking?.companySurgeShare || 0)
                                            } type="purple-bold" className="text-lg" />
                                    </div>
                                </div>
                            </div>

                            {/* Razorpay Verification Metadata */}
                            {['online', 'mixed', 'upi', 'card'].includes(selectedTransaction.paymentMethod?.toLowerCase()) && (
                                <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100/60">
                                    <h4 className="text-xs font-bold text-orange-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <CreditCard className="w-4 h-4" /> Razorpay Gatekeeper Verification
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="text-gray-400 block mb-0.5">Razorpay Order ID</span>
                                            <span className="font-mono text-secondary font-semibold bg-white px-2.5 py-1.5 rounded-xl border border-orange-100 block break-all">
                                                {selectedTransaction.razorpayOrderId || 'N/A'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block mb-0.5">Razorpay Payment ID</span>
                                            <span className="font-mono text-secondary font-semibold bg-white px-2.5 py-1.5 rounded-xl border border-orange-100 block break-all">
                                                {selectedTransaction.razorpayPaymentId || 'N/A'}
                                            </span>
                                        </div>
                                        {selectedTransaction.razorpaySignature && (
                                            <div className="md:col-span-2">
                                                <span className="text-gray-400 block mb-0.5">Cryptographic Signature</span>
                                                <span className="font-mono text-secondary font-semibold bg-white px-2.5 py-1.5 rounded-xl border border-orange-100 block truncate" title={selectedTransaction.razorpaySignature}>
                                                    {selectedTransaction.razorpaySignature}
                                                </span>
                                            </div>
                                        )}
                                        {selectedTransaction.razorpayResponse && (
                                            <div className="md:col-span-2">
                                                <span className="text-gray-400 block mb-1">Razorpay Captured Response State</span>
                                                <div className="bg-white p-3 rounded-2xl border border-orange-100 max-h-40 overflow-y-auto font-mono text-[10px] text-gray-600">
                                                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedTransaction.razorpayResponse, null, 2)}</pre>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Additional Info */}
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Payment Method</span>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-gray-100 rounded-lg">
                                            <CreditCard className="w-4 h-4 text-secondary" />
                                        </div>
                                        <span className="text-sm font-semibold text-secondary">{selectedTransaction.paymentMethod?.toUpperCase()}</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Transaction Date</span>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-gray-100 rounded-lg">
                                            <Calendar className="w-4 h-4 text-secondary" />
                                        </div>
                                        <span className="text-sm font-semibold text-secondary">{formatDateTime(selectedTransaction.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex flex-wrap justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                            {['pending', 'failed', 'processing'].includes(selectedTransaction.paymentStatus?.toLowerCase()) && (
                                <>
                                    {selectedTransaction.razorpayOrderId && (
                                        <button
                                            onClick={() => handleRetryVerify(selectedTransaction._id)}
                                            className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center gap-2"
                                        >
                                            Retry Verification
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleMarkPaid(selectedTransaction._id)}
                                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-600/20 transition-all flex items-center gap-2"
                                    >
                                        Mark Paid Manually
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => navigateToBooking(selectedTransaction.bookingId || selectedTransaction.booking?.bookingId || selectedTransaction.booking?._id)}
                                className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                            >
                                View Booking Details <ArrowUpRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Audit Reason Modal */}
            {showReasonModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-secondary/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowReasonModal(false)}></div>
                    <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-red-100">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-red-50 flex justify-between items-center bg-red-50/30">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">⚠️</span>
                                <h3 className="text-base font-bold text-red-800 uppercase tracking-wider">Manual Payment Reconcile</h3>
                            </div>
                            <button
                                onClick={() => setShowReasonModal(false)}
                                className="p-1.5 hover:bg-red-100 rounded-full text-red-400 hover:text-red-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-red-700 leading-relaxed font-medium bg-red-50 p-4 rounded-2xl border border-red-100/50">
                                WARNING: You are manually marking this booking as PAID. This bypasses automated gateway verification and will immediately qualify the provider for payouts. A valid audit reason is strictly required.
                            </p>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Reconciliation Audit Reason</label>
                                <textarea
                                    value={reasonText}
                                    onChange={(e) => setReasonText(e.target.value)}
                                    placeholder="Enter physical payment proof reason (e.g., GPAY direct transaction matching statement ID: 987654)"
                                    className="w-full h-24 px-4 py-3 rounded-2xl border border-gray-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none text-xs font-semibold text-secondary placeholder:text-gray-300 resize-none transition-all"
                                    required
                                />
                                <span className="text-[9px] text-gray-400 flex justify-between">
                                    <span>Minimum 5 characters required</span>
                                    <span className={reasonText.trim().length >= 5 ? "text-green-500 font-bold" : "text-red-500 font-bold"}>
                                        {reasonText.trim().length} chars
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2.5">
                            <button
                                onClick={() => setShowReasonModal(false)}
                                className="px-5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitMarkPaid}
                                disabled={reasonText.trim().length < 5}
                                className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all ${
                                    reasonText.trim().length >= 5 
                                        ? "bg-red-600 hover:bg-red-700 shadow-red-600/20 active:scale-95 cursor-pointer" 
                                        : "bg-red-300 shadow-none cursor-not-allowed opacity-75"
                                }`}
                            >
                                Confirm Payment Manually
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTransactions;
