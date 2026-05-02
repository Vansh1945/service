import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import Loader from '../../components/Loader';
import * as TransactionService from '../../services/TransactionService';
import Pagination from '../../components/Pagination';
import { formatDate, formatDateTime, formatCurrency } from '../../utils/format';
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

const AdminTransactions = () => {
    const { showToast } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [showModal, setShowModal] = useState(false);

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
            limit: 10,
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
                status: filters.status
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
    }, [pagination.page, pagination.limit, filters, showToast]);

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
    }, [fetchTransactions]);

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

            {/* Filters */}
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
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Booking ID</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Provider</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Amount</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Date</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="py-20 text-center">
                                        <Loader />
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-20 text-center text-gray-400">
                                        No transactions found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((txn) => (
                                    <tr key={txn._id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-secondary font-mono">
                                                    {txn.transactionId || '---'}
                                                </span>
                                                <span className="text-[10px] text-gray-400 flex items-center mt-0.5">
                                                    {txn.paymentMethod?.toUpperCase()} • {txn.currency}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <button
                                                    onClick={() => navigateToBooking(txn.bookingId || txn.booking?.bookingId || txn.booking?._id)}
                                                    className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline group/link w-fit"
                                                >
                                                    {txn.bookingId || txn.booking?.bookingId || 'View Booking'}
                                                    <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                                </button>
                                                <span className="text-[10px] text-gray-400 mt-0.5 line-clamp-1 max-w-[150px]">
                                                    {txn.booking?.services?.[0]?.service?.title || txn.description || 'Service Details'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {txn.user?.name || '---'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {txn.provider?.name || '---'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-bold text-secondary">
                                                    {formatCurrency(txn.paymentMethod?.toLowerCase() === 'online' || txn.paymentMethod?.toLowerCase() === 'upi' ? txn.amount / 100 : txn.amount)}
                                                </span>
                                                {(txn.commission > 0 || txn.provider) && (
                                                    <div className="flex flex-col items-end mt-0.5">
                                                        <span className="text-[10px] text-gray-400">
                                                            Comm: {formatCurrency(txn.paymentMethod?.toLowerCase() === 'online' || txn.paymentMethod?.toLowerCase() === 'upi' ? (txn.commission || 0) / 100 : (txn.commission || 0))}
                                                            {txn.commissionRule?.name && <span className="ml-1 opacity-70 italic text-[9px]">({txn.commissionRule.name})</span>}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">
                                                            Provider: {formatCurrency(txn.paymentMethod?.toLowerCase() === 'online' || txn.paymentMethod?.toLowerCase() === 'upi' ? (txn.providerEarning || 0) / 100 : (txn.providerEarning || 0))}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusColor(txn.paymentStatus)}`}>
                                                    {getStatusIcon(txn.paymentStatus)}
                                                    {txn.paymentStatus?.toUpperCase()}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-gray-500">
                                            <div className="flex flex-col items-end">
                                                <span className="whitespace-nowrap">{formatDateTime(txn.createdAt).split('at')[0]}</span>
                                                <span className="text-[10px] text-gray-400">{formatDateTime(txn.createdAt).split('at')[1]}</span>
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
                                ))
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
                                        {formatCurrency(selectedTransaction.paymentMethod?.toLowerCase() === 'online' || selectedTransaction.paymentMethod?.toLowerCase() === 'upi' ? selectedTransaction.amount / 100 : selectedTransaction.amount)}
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
                                        <span className="font-semibold text-secondary">
                                            {formatCurrency(selectedTransaction.booking?.subtotal || (selectedTransaction.paymentMethod?.toLowerCase() === 'online' || selectedTransaction.paymentMethod?.toLowerCase() === 'upi' ? selectedTransaction.amount / 100 : selectedTransaction.amount))}
                                        </span>
                                    </div>
                                    
                                    {selectedTransaction.booking?.totalDiscount > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Discount {selectedTransaction.booking?.couponApplied?.code && `(${selectedTransaction.booking.couponApplied.code})`}</span>
                                            <span className="font-semibold text-green-600">
                                                -{formatCurrency(selectedTransaction.booking.totalDiscount)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-gray-500">Commission (Platform)</span>
                                            {selectedTransaction.commissionRule?.name && (
                                                <span className="text-[10px] text-gray-400 italic">
                                                    Rule: {selectedTransaction.commissionRule.name} ({selectedTransaction.commissionRule.rate}{selectedTransaction.commissionRule.type === 'percentage' ? '%' : ' Fixed'})
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-semibold text-red-500">
                                            -{formatCurrency(selectedTransaction.paymentMethod?.toLowerCase() === 'online' || selectedTransaction.paymentMethod?.toLowerCase() === 'upi' ? (selectedTransaction.commission || 0) / 100 : (selectedTransaction.commission || 0))}
                                        </span>
                                    </div>
                                    <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                                        <span className="font-bold text-secondary">Provider Earning</span>
                                        <span className="text-lg font-black text-green-600">
                                            {formatCurrency(selectedTransaction.paymentMethod?.toLowerCase() === 'online' || selectedTransaction.paymentMethod?.toLowerCase() === 'upi' ? (selectedTransaction.providerEarning || 0) / 100 : (selectedTransaction.providerEarning || 0))}
                                        </span>
                                    </div>
                                </div>
                            </div>

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
                        <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-6 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
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
        </div>
    );
};

export default AdminTransactions;
