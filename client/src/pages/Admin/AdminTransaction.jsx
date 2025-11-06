import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../store/auth';
import {
    Search,
    Calendar,
    User,
    Clock,
    MapPin,
    Eye,
    Download,
    CheckCircle,
    XCircle,
    AlertCircle,
    CreditCard,
    BarChart2,
    DollarSign,
    Users,
    Briefcase,
    Edit,
    RefreshCw,
    TrendingUp,
    Activity,
    Filter,
    MoreHorizontal,
    Phone,
    Mail,
    Star,
    Award,
    Target,
    X,
    ChevronLeft,
    ChevronRight,
    FileText,
    Receipt
} from 'lucide-react';

const AdminTransaction = () => {
    const { token, API, showToast } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Filter states
    const [filters, setFilters] = useState({
        filter: 'lifetime', // Default to lifetime
        search: ''
    });

    // Pagination state
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        pages: 0
    });

    // Filter options
    const filterOptions = [
        { value: 'lifetime', label: 'Lifetime' },
        { value: '1month', label: 'Last Month' },
        { value: '3months', label: 'Last 3 Months' },
        { value: '6months', label: 'Last 6 Months' },
        { value: 'current_fy', label: 'Current FY' },
        { value: 'previous_fy', label: 'Previous FY' }
    ];

    // Payment status colors
    const getPaymentStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'bg-green-50 text-green-800 border-green-200';
            case 'pending': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
            case 'processing': return 'bg-blue-50 text-blue-800 border-blue-200';
            case 'failed': return 'bg-red-50 text-red-800 border-red-200';
            case 'refunded': return 'bg-gray-50 text-gray-800 border-gray-200';
            default: return 'bg-gray-50 text-gray-800 border-gray-200';
        }
    };

    // Payment status icons
    const getPaymentStatusIcon = (status) => {
        const baseClass = "w-4 h-4";
        switch (status) {
            case 'completed': return <CheckCircle className={baseClass} />;
            case 'pending': return <AlertCircle className={baseClass} />;
            case 'processing': return <Activity className={baseClass} />;
            case 'failed': return <XCircle className={baseClass} />;
            case 'refunded': return <Receipt className={baseClass} />;
            default: return <AlertCircle className={baseClass} />;
        }
    };

    // Fetch transactions with filters and pagination
    const fetchTransactions = async () => {
        try {
            setLoading(true);

            const queryParams = new URLSearchParams({
                page: pagination.page.toString(),
                limit: pagination.limit.toString(),
                filter: filters.filter
            });

            // Add search filter
            if (filters.search) queryParams.append('search', filters.search);

            const response = await fetch(`${API}/admin/transactions?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const fetchedTransactions = data.transactions || [];
                setTransactions(fetchedTransactions);
                setPagination(prev => ({
                    ...prev,
                    total: data.total || 0,
                    pages: data.pages || 1
                }));
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch transactions');
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
            showToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Fetch transaction details
    const fetchTransactionDetails = async (transactionId) => {
        try {
            setActionLoading(true);
            // For now, we'll use the transaction data we already have
            // In a full implementation, you might want a separate endpoint for detailed transaction info
            const transaction = transactions.find(t => t._id === transactionId);
            if (transaction) {
                setSelectedTransaction(transaction);
                setShowModal(true);
            } else {
                throw new Error('Transaction not found');
            }
        } catch (error) {
            console.error('Error fetching transaction details:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Export transactions to CSV
    const handleExportCSV = async () => {
        try {
            setActionLoading(true);
            const queryParams = new URLSearchParams({
                filter: filters.filter
            });

            const response = await fetch(`${API}/admin/transactions/export?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `transactions_${filters.filter}_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                showToast('CSV exported successfully', 'success');
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to export CSV');
            }
        } catch (error) {
            console.error('Error exporting CSV:', error);
            showToast(error.message, 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle filter changes
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Clear search filter
    const clearSearch = () => {
        setFilters(prev => ({ ...prev, search: '' }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Pagination handlers
    const goToPage = (page) => {
        setPagination(prev => ({ ...prev, page }));
    };

    const nextPage = () => {
        if (pagination.page < pagination.pages) {
            setPagination(prev => ({ ...prev, page: prev.page + 1 }));
        }
    };

    const prevPage = () => {
        if (pagination.page > 1) {
            setPagination(prev => ({ ...prev, page: prev.page - 1 }));
        }
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Format currency
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount || 0);
    };

    // Calculate stats from transactions
    const calculateStats = useMemo(() => {
        const stats = {
            total: transactions.length,
            completed: 0,
            pending: 0,
            failed: 0,
            totalAmount: 0
        };

        transactions.forEach(transaction => {
            if (transaction.paymentStatus) {
                stats[transaction.paymentStatus] = (stats[transaction.paymentStatus] || 0) + 1;
            }
            if (transaction.paymentStatus === 'completed') {
                stats.totalAmount += (transaction.paymentMethod === 'online' ? transaction.amount / 100 : transaction.amount) || 0;
            }
        });

        return stats;
    }, [transactions]);

    // Memoized filtered transactions count
    const filteredTransactionsCount = useMemo(() => {
        return transactions.length;
    }, [transactions]);

    // Fetch data on component mount and when filters/pagination change
    useEffect(() => {
        fetchTransactions();
    }, [filters, pagination.page, pagination.limit]);

    // Generate pagination items
    const getPaginationItems = () => {
        const items = [];
        const maxVisiblePages = 5;
        let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(pagination.pages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            items.push(
                <button
                    key={i}
                    onClick={() => goToPage(i)}
                    className={`px-3 py-1 rounded-lg ${
                        pagination.page === i
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                    {i}
                </button>
            );
        }

        return items;
    };

    return (
        <div className="min-h-screen p-4 md:p-6">
            {/* Header Section */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-secondary mb-2">Transaction Management</h1>
                <p className="text-gray-600">Monitor and manage all payment transactions</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Transactions</p>
                            <p className="text-2xl font-bold text-secondary">{calculateStats.total}</p>
                        </div>
                        <div className="p-2 bg-teal-50 rounded-full">
                            <Receipt className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Completed</p>
                            <p className="text-2xl font-bold text-green-600">{calculateStats.completed}</p>
                        </div>
                        <div className="p-2 bg-green-50 rounded-full">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Pending</p>
                            <p className="text-2xl font-bold text-yellow-600">{calculateStats.pending}</p>
                        </div>
                        <div className="p-2 bg-yellow-50 rounded-full">
                            <AlertCircle className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Total Revenue</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(calculateStats.totalAmount)}</p>
                        </div>
                        <div className="p-2 bg-teal-50 rounded-full">
                            <DollarSign className="w-6 h-6 text-primary" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-secondary">Filters</h3>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={clearSearch}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                        >
                            Clear Search
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Time Period Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
                        <select
                            value={filters.filter}
                            onChange={(e) => handleFilterChange('filter', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            {filterOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                value={filters.search}
                                onChange={(e) => handleFilterChange('search', e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Active Filters Badges */}
                <div className="flex flex-wrap gap-2 mt-4">
                    {filters.filter !== 'lifetime' && (
                        <span className="inline-flex items-center px-2 py-1 bg-teal-50 text-primary text-sm rounded-full border border-teal-100">
                            Period: {filterOptions.find(f => f.value === filters.filter)?.label}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('filter', 'lifetime')} />
                        </span>
                    )}
                    {filters.search && (
                        <span className="inline-flex items-center px-2 py-1 bg-teal-50 text-primary text-sm rounded-full border border-teal-100">
                            Search: {filters.search}
                            <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => handleFilterChange('search', '')} />
                        </span>
                    )}
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-semibold text-secondary">All Transactions</h3>
                        <p className="text-sm text-gray-600">
                            Showing {filteredTransactionsCount} of {pagination.total} transactions
                        </p>
                    </div>
                    <button
                        onClick={handleExportCSV}
                        disabled={actionLoading}
                        className="flex items-center px-4 py-2 bg-accent text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Transaction ID
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Amount
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Payment Status
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                                    Method
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                                    Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                // Loading skeleton
                                Array.from({ length: 5 }).map((_, index) => (
                                    <tr key={index} className="animate-pulse">
                                        <td className="px-4 py-4">
                                            <div className="h-4 bg-gray-200 rounded w-20"></div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="h-4 bg-gray-200 rounded w-24"></div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="h-4 bg-gray-200 rounded w-16"></div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                                        </td>
                                        <td className="px-4 py-4 hidden md:table-cell">
                                            <div className="h-4 bg-gray-200 rounded w-12"></div>
                                        </td>
                                        <td className="px-4 py-4 hidden lg:table-cell">
                                            <div className="h-4 bg-gray-200 rounded w-24"></div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="h-8 bg-gray-200 rounded w-20"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                        <Receipt className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                                        <p>No transactions found</p>
                                        <p className="text-sm">Try adjusting your filters</p>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((transaction) => (
                                    <tr key={transaction._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-secondary">
                                                #{transaction.transactionId || transaction._id?.substring(transaction._id.length - 8) || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-secondary">
                                                    {transaction.user?.name || 'N/A'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {transaction.user?.email || 'N/A'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="text-sm font-bold text-primary">
                                                {formatCurrency(transaction.paymentMethod === 'online' ? transaction.amount / 100 : transaction.amount)}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {transaction.currency || 'INR'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPaymentStatusColor(transaction.paymentStatus)}`}>
                                                {getPaymentStatusIcon(transaction.paymentStatus)}
                                                <span className="ml-1 capitalize">{transaction.paymentStatus}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                                            <div className="text-sm text-secondary capitalize">
                                                {transaction.paymentMethod || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap hidden lg:table-cell">
                                            <div className="text-sm text-secondary">
                                                {formatDate(transaction.createdAt)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => fetchTransactionDetails(transaction._id)}
                                                    className="p-1 text-primary hover:text-teal-700"
                                                    title="View Details"
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
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                        <div className="text-sm text-gray-700">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                            {pagination.total} results
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={prevPage}
                                disabled={pagination.page === 1}
                                className="p-1 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            {getPaginationItems()}

                            <button
                                onClick={nextPage}
                                disabled={pagination.page === pagination.pages}
                                className="p-1 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Transaction Details Modal */}
            {showModal && selectedTransaction && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-secondary">Transaction Details</h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left Column */}
                                <div className="space-y-4">
                                    {/* Transaction Information */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h3 className="font-semibold text-secondary mb-3">Transaction Information</h3>
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-sm text-gray-600">Transaction ID:</span>
                                                <p className="font-medium">{selectedTransaction.transactionId || selectedTransaction._id}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Amount:</span>
                                                <p className="font-medium">{formatCurrency(selectedTransaction.paymentMethod === 'online' ? selectedTransaction.amount / 100 : selectedTransaction.amount)} {selectedTransaction.currency}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Payment Status:</span>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(selectedTransaction.paymentStatus)}`}>
                                                    {getPaymentStatusIcon(selectedTransaction.paymentStatus)}
                                                    <span className="ml-1 capitalize">{selectedTransaction.paymentStatus}</span>
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Payment Method:</span>
                                                <p className="font-medium capitalize">{selectedTransaction.paymentMethod || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Created:</span>
                                                <p className="font-medium">{formatDate(selectedTransaction.createdAt)}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Updated:</span>
                                                <p className="font-medium">{formatDate(selectedTransaction.updatedAt)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer Information */}
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <h3 className="font-semibold text-secondary mb-3">Customer Information</h3>
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-sm text-gray-600">Name:</span>
                                                <p className="font-medium">{selectedTransaction.user?.name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Email:</span>
                                                <p className="font-medium">{selectedTransaction.user?.email || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">Phone:</span>
                                                <p className="font-medium">{selectedTransaction.user?.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Razorpay Information */}
                                    {(selectedTransaction.razorpayOrderId || selectedTransaction.razorpayPaymentId) && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                            <h3 className="font-semibold text-secondary mb-3">Razorpay Details</h3>
                                            <div className="space-y-2">
                                                {selectedTransaction.razorpayOrderId && (
                                                    <div>
                                                        <span className="text-sm text-gray-600">Order ID:</span>
                                                        <p className="font-medium font-mono text-sm">{selectedTransaction.razorpayOrderId}</p>
                                                    </div>
                                                )}
                                                {selectedTransaction.razorpayPaymentId && (
                                                    <div>
                                                        <span className="text-sm text-gray-600">Payment ID:</span>
                                                        <p className="font-medium font-mono text-sm">{selectedTransaction.razorpayPaymentId}</p>
                                                    </div>
                                                )}
                                                {selectedTransaction.razorpaySignature && (
                                                    <div>
                                                        <span className="text-sm text-gray-600">Signature:</span>
                                                        <p className="font-medium font-mono text-xs break-all">{selectedTransaction.razorpaySignature}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column */}
                                <div className="space-y-4">
                                    {/* Booking Information */}
                                    {selectedTransaction.booking && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                            <h3 className="font-semibold text-secondary mb-3">Booking Information</h3>
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-sm text-gray-600">Booking ID:</span>
                                                    <p className="font-medium">#{selectedTransaction.booking._id?.substring(selectedTransaction.booking._id.length - 8) || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-600">Status:</span>
                                                    <p className="font-medium capitalize">{selectedTransaction.booking.status || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-600">Date:</span>
                                                    <p className="font-medium">{formatDate(selectedTransaction.booking.date)}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-600">Time:</span>
                                                    <p className="font-medium">{selectedTransaction.booking.time || 'Not specified'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-600">Total Amount:</span>
                                                    <p className="font-medium">{formatCurrency(selectedTransaction.booking.totalAmount)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Service Information */}
                                    {selectedTransaction.service && (
                                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                                            <h3 className="font-semibold text-secondary mb-3">Service Information</h3>
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-sm text-gray-600">Service:</span>
                                                    <p className="font-medium">{selectedTransaction.service.title || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-600">Category:</span>
                                                    <p className="font-medium">{selectedTransaction.service.category || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <span className="text-sm text-gray-600">Description:</span>
                                                    <p className="font-medium text-sm">{selectedTransaction.service.description || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex space-x-3">
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTransaction;
